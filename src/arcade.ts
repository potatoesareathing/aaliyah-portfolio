/**
 * The arcade cabinet.
 *
 * - The screen is a carousel: one slide per game. Switching games plays a
 *   short burst of TV static (drawn on a canvas) before the next slide.
 * - "Play" (or the A button) loads the game into an iframe *inside the screen*,
 *   with a CRT power-on effect. B stops it; the full-screen button enlarges it.
 * - The iframe is created on Play and removed on stop. Removing it (instead of
 *   pointing it at about:blank) matters: the pygbag loader asks "are you sure
 *   you want to leave?" when its page is navigated away from.
 */

// The Python runtime the games need, served by pygbag's CDN (about 22 MB).
const PYGBAG_CDN = "https://pygame-web.github.io/cdn/";
const RUNTIME_FILES = [
  "0.9.3/pythons.js",
  "0.9.3/cpython312/main.js",
  "0.9.3/cpython312/main.wasm",
  "0.9.3/cpython312/main.data",
  "cp312/pygame_ce-2.5.7-cp312-cp312-wasm32_bi_emscripten.whl",
];

/**
 * Start downloading the runtime in the background once the visitor reaches the
 * arcade, so pressing Play is much faster. Skipped when the visitor has asked
 * to save data or is on a slow connection.
 */
function prefetchRuntimeWhenNear(section: HTMLElement) {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /(^|-)2g|3g/.test(conn?.effectiveType ?? "")) return;
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    for (const file of RUNTIME_FILES) {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = PYGBAG_CDN + file;
      link.crossOrigin = "anonymous"; // same request mode the game uses, so the cached copy is reused
      document.head.append(link);
    }
  }, { rootMargin: "400px 0px" });
  io.observe(section);
}

/** A burst of black-and-white noise, like changing channel on an old TV. */
function playStatic(canvas: HTMLCanvasElement, ms: number) {
  const g = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  const img = g.createImageData(w, h);
  const end = performance.now() + ms;
  return new Promise<void>((resolve) => {
    const draw = () => {
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      // a rolling dark bar, the classic bad-signal look
      g.fillStyle = "rgba(0,0,0,0.5)";
      g.fillRect(0, ((performance.now() / 4) % (h + 20)) - 20, w, 14);
      if (performance.now() < end) requestAnimationFrame(draw);
      else resolve();
    };
    draw();
  });
}

export function setupArcade(reducedMotion: boolean) {
  const crt = document.getElementById("crt")!;
  const slides = [...crt.querySelectorAll<HTMLElement>(".crt__slide")];
  const play = crt.querySelector<HTMLElement>(".crt__play")!;
  const frameBox = crt.querySelector<HTMLElement>(".crt__frame")!;
  const status = crt.querySelector<HTMLElement>(".crt__status")!;
  const noise = crt.querySelector<HTMLCanvasElement>(".crt__static")!;
  const dots = [...document.querySelectorAll<HTMLButtonElement>("[data-goto]")];
  const prevBtn = document.querySelector<HTMLButtonElement>("[data-prev]")!;
  const nextBtn = document.querySelector<HTMLButtonElement>("[data-next]")!;
  const aBtn = document.querySelector<HTMLButtonElement>("[data-start-current]")!;
  const bBtn = document.querySelector<HTMLButtonElement>("[data-exit]")!;
  const fullBtn = document.querySelector<HTMLButtonElement>("[data-fullscreen]")!;

  let current = 0;
  let switching = false;
  let readyPoll = 0;

  prefetchRuntimeWhenNear(document.getElementById("arcade")!);

  /* ---------------- choosing a game ---------------- */
  async function show(index: number) {
    if (switching || playing()) return;
    const next = (index + slides.length) % slides.length;
    if (next === current) return;
    switching = true;
    if (!reducedMotion) {
      crt.classList.add("is-switching");
      await playStatic(noise, 260);
    }
    slides[current].hidden = true;
    slides[current].classList.remove("is-current");
    slides[next].hidden = false;
    slides[next].classList.add("is-current");
    dots.forEach((d, i) => (i === next ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current")));
    current = next;
    crt.classList.remove("is-switching");
    switching = false;
  }

  // physical buttons press down briefly, even when triggered from the keyboard
  const press = (el: HTMLElement) => {
    el.classList.add("is-pressed");
    setTimeout(() => el.classList.remove("is-pressed"), 140);
  };

  prevBtn.addEventListener("click", () => show(current - 1));
  nextBtn.addEventListener("click", () => show(current + 1));
  dots.forEach((d) => d.addEventListener("click", () => show(Number(d.dataset.goto))));

  crt.addEventListener("keydown", (e) => {
    if (playing()) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); press(prevBtn); show(current - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); press(nextBtn); show(current + 1); }
    if (e.key === "Enter" && e.target === crt) { e.preventDefault(); press(aBtn); start(); }
  });

  // swipe on phones
  let touchX = 0;
  crt.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
  crt.addEventListener("touchend", (e) => {
    if (playing()) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
  });

  /* ---------------- playing ---------------- */
  const playing = () => !play.hidden;
  const removeGame = () => frameBox.replaceChildren();

  function start() {
    if (playing() || switching) return;
    const slide = slides[current];
    const { game, title } = slide.dataset;
    const controls = (slide.querySelector(".crt__controls")?.textContent ?? "").trim().replace(/\.?$/, ".");

    const frame = document.createElement("iframe");
    frame.title = `${title} game`;
    frame.allow = "autoplay; fullscreen";
    frame.src = `${import.meta.env.BASE_URL}games/${game}/index.html`;
    frame.addEventListener("load", () => {
      // the loader page is grey around the game; make it match the black screen
      try {
        frame.contentDocument!.documentElement.style.background = "#000";
        frame.contentDocument!.body.style.background = "#000";
      } catch { /* not same-origin: leave it */ }
      frame.focus();
    }, { once: true });
    frameBox.replaceChildren(frame);

    status.textContent = "Starting Python in your browser. The first time can take up to a minute, after that it's quick.";
    play.hidden = false;
    crt.classList.add("is-playing", "is-booting");
    setTimeout(() => crt.classList.remove("is-booting"), 600);
    bBtn.disabled = false;
    fullBtn.disabled = false;
    aBtn.disabled = true;
    prevBtn.disabled = nextBtn.disabled = true;

    // the game sets its window caption when it starts, so its page title
    // changing to the game's name means it's ready to play
    clearInterval(readyPoll);
    readyPoll = window.setInterval(() => {
      try {
        if (frame.contentDocument?.title === title) {
          clearInterval(readyPoll);
          status.textContent = `${title}: ${controls} Press B to stop.`;
          frame.focus();
        }
      } catch {
        clearInterval(readyPoll);
      }
    }, 500);

    window.addEventListener("beforeunload", removeGame);
  }

  function stop() {
    if (!playing()) return;
    clearInterval(readyPoll);
    if (document.fullscreenElement) void document.exitFullscreen();
    removeGame();
    play.hidden = true;
    crt.classList.remove("is-playing");
    bBtn.disabled = true;
    fullBtn.disabled = true;
    aBtn.disabled = false;
    prevBtn.disabled = nextBtn.disabled = false;
    window.removeEventListener("beforeunload", removeGame);
    crt.focus();
  }

  crt.querySelectorAll<HTMLButtonElement>("[data-start]").forEach((b) => b.addEventListener("click", start));
  aBtn.addEventListener("click", start);
  bBtn.addEventListener("click", stop);
  fullBtn.addEventListener("click", () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void crt.requestFullscreen?.();
  });

  // the room's arcade cabinet and nav link land here; stop a game if the visitor scrolls far away
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) stop();
  }).observe(crt);
}
