/**
 * Page-wide motion:
 *  - reveal-on-scroll: elements with [data-reveal] get the class "is-in" the
 *    first time they enter the screen; styles.css animates from there
 *  - project screens tilt toward the pointer
 *  - About numbers count up
 *  - "Also built" cartridges flip over
 *  - a drifting pixel starfield behind the page that speeds up while you scroll
 *
 * Everything respects prefers-reduced-motion.
 */
export function setupMotion(reducedMotion: boolean) {
  numberChildren();
  reveal();
  if (!reducedMotion) tilt();
  carts();
  if (!reducedMotion) stars();
}

/** give each child a --n index so CSS can stagger them */
function numberChildren() {
  const groups = [
    ".quest__text",
    ".stats",
    ".contact__links",
    ".inventory__group ul",
    ".wins__list",
  ];
  for (const sel of groups)
    document.querySelectorAll(sel).forEach((parent) =>
      [...parent.children].forEach((c, i) => (c as HTMLElement).style.setProperty("--n", String(i))),
    );
}

function reveal() {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
        if (e.target.classList.contains("about") || e.target.classList.contains("wins")) countUp(e.target as HTMLElement);
      }
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
  );
  document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
}

function countUp(scope: HTMLElement) {
  scope.querySelectorAll<HTMLElement>(".stats dd, dd[data-count]").forEach((dd) => {
    const final = dd.textContent ?? "";
    const target = parseFloat(dd.dataset.count ?? final);
    if (Number.isNaN(target)) return;
    const decimals = (final.split(".")[1] ?? "").length;
    const start = performance.now();
    const dur = 900;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      // count in chunky steps, like a score counter
      const k = Math.floor(t * 12) / 12;
      dd.textContent = (target * k).toFixed(decimals);
      if (t < 1) requestAnimationFrame(step);
      else dd.textContent = final;
    };
    requestAnimationFrame(step);
  });
}

function tilt() {
  document.querySelectorAll<HTMLElement>(".quest .screen").forEach((screen) => {
    screen.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = screen.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      screen.style.setProperty("--ry", `${x * 10}deg`);
      screen.style.setProperty("--rx", `${-y * 8}deg`);
    });
    screen.addEventListener("pointerleave", () => {
      screen.style.setProperty("--ry", "0deg");
      screen.style.setProperty("--rx", "0deg");
    });
  });
}

function carts() {
  document.querySelectorAll<HTMLElement>(".cart").forEach((cart) => {
    const btn = cart.querySelector<HTMLButtonElement>(".cart__flip")!;
    const back = cart.querySelector<HTMLElement>(".cart__back")!;
    const set = (flipped: boolean) => {
      cart.classList.toggle("is-flipped", flipped);
      btn.setAttribute("aria-expanded", String(flipped));
      back.inert = !flipped;
    };
    set(false);
    btn.addEventListener("click", () => set(!cart.classList.contains("is-flipped")));
    // clicking the back (but not its link) flips it over again
    back.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("a")) return;
      set(false);
      btn.focus();
    });
    cart.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && cart.classList.contains("is-flipped")) {
        set(false);
        btn.focus();
      }
    });
  });
}

function stars() {
  const canvas = document.getElementById("stars") as HTMLCanvasElement | null;
  if (!canvas) return;
  const g = canvas.getContext("2d")!;
  const SCALE = 3; // draw at 1/3 resolution, so every star is a chunky pixel
  const colors = ["#e8ecff", "#3d5bff", "#f4ff3a", "#8c95cc"];
  let w = 0, h = 0;
  let list: { x: number; y: number; z: number; c: string; tw: number }[] = [];

  const resize = () => {
    w = canvas.width = Math.ceil(innerWidth / SCALE);
    h = canvas.height = Math.ceil(innerHeight / SCALE);
    list = Array.from({ length: Math.round((w * h) / 900) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: 0.2 + Math.random() * 0.8, // depth: near stars move faster
      c: colors[Math.floor(Math.random() * colors.length)],
      tw: Math.random() * 6.28,
    }));
  };
  resize();
  addEventListener("resize", resize);

  let lastY = scrollY;
  let speed = 0;
  let raf = 0;
  const frame = (t: number) => {
    // scrolling pushes the stars; the push fades out smoothly
    const dy = scrollY - lastY;
    lastY = scrollY;
    speed = speed * 0.9 + dy * 0.06;
    g.clearRect(0, 0, w, h);
    for (const s of list) {
      s.y -= (0.04 + speed) * s.z;
      if (s.y < 0) s.y += h;
      if (s.y >= h) s.y -= h;
      const on = Math.sin(t / 600 + s.tw) > -0.6; // twinkle
      if (!on) continue;
      g.globalAlpha = 0.35 + s.z * 0.5;
      g.fillStyle = s.c;
      g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    if (document.visibilityState === "visible") raf = requestAnimationFrame(frame);
  });
}
