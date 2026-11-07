/**
 * Projects and achievements: a tabbed "level select" with a pixel
 * disintegration transition.
 *
 * How the effect works (about 650 ms in total):
 *  1. Dissolve (~260 ms). A canvas sits on top of the panel and is cut into a
 *     grid of square cells. Cell by cell, in a sweeping random order, the canvas
 *     paints that cell dark (so the content underneath "vanishes") and launches
 *     a small square particle from it that scatters outward.
 *  2. Dark (~90 ms). Everything is covered; the old panel is hidden and the new
 *     one shown underneath, where nobody can see the swap.
 *  3. Rebuild (~300 ms). The same thing in reverse: particles fly in from
 *     scattered positions, and as each lands its cell is cleared, revealing the
 *     new content square by square.
 *
 * The canvas runs at CSS-pixel resolution and the cell size grows with the
 * panel so there are never more than ~900 particles. Only this one canvas is
 * redrawn during the effect, so the rest of the page stays smooth.
 */

const COLORS = ["#3d5bff", "#3d5bff", "#f4ff3a", "#f4ff3a", "#e8ecff"]; // blue and yellow, a little white
const BG = "#000000";
const MAX_CELLS = 900;
const DISSOLVE = 260;
const DARK = 90;
const REBUILD = 300;

interface Cell {
  x: number;
  y: number;
  t: number; // 0..1, when this cell goes, within its phase
  vx: number;
  vy: number;
  color: string;
  emits: boolean; // only some cells throw a particle, the rest just vanish
  piece: number; // particle size
}

function makeCells(w: number, h: number) {
  const size = Math.max(14, Math.ceil(Math.sqrt((w * h) / MAX_CELLS)));
  const cols = Math.ceil(w / size);
  const rows = Math.ceil(h / size);
  const cells: Cell[] = [];
  const cx = w / 2, cy = h / 2;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = c * size, y = r * size;
      // a left-to-right sweep with noise, so it reads as "breaking apart" not as a wipe
      const t = Math.min(1, Math.max(0, (c / cols) * 0.7 + Math.random() * 0.3));
      // scatter outward from the centre, with a little upward drift
      const dx = x - cx, dy = y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const speed = 0.5 + Math.random() * 0.9; // px per ms
      cells.push({
        x, y, t,
        vx: (dx / len) * speed + (Math.random() - 0.5) * 0.5,
        vy: (dy / len) * speed - 0.2 + (Math.random() - 0.5) * 0.5,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        emits: Math.random() < 0.55,
        piece: Math.max(3, Math.round(size * (0.22 + Math.random() * 0.22))),
      });
    }
  return { cells, size };
}

/**
 * Draw one frame of the dissolve. p runs 0..1; running it from 1 back to 0
 * plays the same timeline in reverse, which is the rebuild.
 */
function drawPhase(g: CanvasRenderingContext2D, w: number, h: number, cells: Cell[], size: number, p: number) {
  g.clearRect(0, 0, w, h);
  const span = 0.4; // how long each particle is in flight, as a share of the phase
  for (const cell of cells) {
    // local progress of this cell's particle: 0 = still attached, 1 = gone
    const start = cell.t * (1 - span);
    const k = Math.min(1, Math.max(0, (p - start) / span));
    const gone = k;
    // the hole where content used to be
    if (gone > 0) {
      g.fillStyle = BG;
      g.fillRect(cell.x, cell.y, size, size);
    }
    // the particle itself, while it's in flight
    if (cell.emits && gone > 0 && gone < 1) {
      const travel = gone * 200 * (0.3 + gone); // eases out of the panel
      const x = cell.x + size / 2 + cell.vx * travel;
      const y = cell.y + size / 2 + cell.vy * travel;
      g.globalAlpha = 1 - gone * gone;
      g.fillStyle = cell.color;
      g.fillRect(Math.round(x - cell.piece / 2), Math.round(y - cell.piece / 2), cell.piece, cell.piece);
      g.globalAlpha = 1;
    }
  }
}

function animate(ms: number, step: (p: number) => void) {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      step(p);
      if (p < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

export function setupLevels(reducedMotion: boolean) {
  const root = document.querySelector<HTMLElement>("[data-levels]");
  if (!root) return;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")!)!);
  const stage = root.querySelector<HTMLElement>(".levels__stage")!;
  const fx = root.querySelector<HTMLCanvasElement>(".levels__fx")!;
  const g = fx.getContext("2d")!;
  const indexLabel = root.querySelector<HTMLElement>("[data-level-index]")!;
  let current = 0;
  let busy = false;

  // the first panel plays its own entrance once the section scrolls into view
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    panels[current].classList.add("is-in");
    io.disconnect();
  }, { threshold: 0.15 }).observe(stage);

  const sizeCanvas = () => {
    const r = stage.getBoundingClientRect();
    fx.width = Math.ceil(r.width);
    fx.height = Math.ceil(r.height);
    return { w: fx.width, h: fx.height };
  };

  const select = (i: number) => {
    tabs.forEach((t, j) => {
      t.setAttribute("aria-selected", String(j === i));
      t.tabIndex = j === i ? 0 : -1;
    });
    indexLabel.textContent = String(i + 1);
  };

  async function go(next: number, focusTab = false) {
    next = (next + panels.length) % panels.length;
    if (busy || next === current) return;
    busy = true;
    select(next);
    if (focusTab) tabs[next].focus();

    const from = panels[current];
    const to = panels[next];

    // keep the stage in view: if its top has scrolled above the header, bring it back
    const top = stage.getBoundingClientRect().top;
    if (top < 80) stage.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });

    if (reducedMotion) {
      from.hidden = true;
      from.classList.remove("is-in");
      to.hidden = false;
      to.classList.add("is-in");
    } else {
      // 1. dissolve the outgoing panel
      stage.style.minHeight = `${stage.offsetHeight}px`;
      let { w, h } = sizeCanvas();
      let grid = makeCells(w, h);
      fx.classList.add("is-active");
      await animate(DISSOLVE, (p) => drawPhase(g, w, h, grid.cells, grid.size, p));

      // 2. dark: swap panels underneath the fully covered canvas
      from.hidden = true;
      from.classList.remove("is-in");
      to.hidden = false;
      stage.style.minHeight = "";
      ({ w, h } = sizeCanvas());
      g.fillStyle = BG;
      g.fillRect(0, 0, w, h);
      grid = makeCells(w, h);
      await new Promise((r) => setTimeout(r, DARK));

      // 3. rebuild the incoming panel in reverse
      to.classList.add("is-in");
      await animate(REBUILD, (p) => drawPhase(g, w, h, grid.cells, grid.size, 1 - p));
      g.clearRect(0, 0, w, h);
      fx.classList.remove("is-active");
    }

    current = next;
    busy = false;
  }

  tabs.forEach((t, i) => t.addEventListener("click", () => go(i)));

  // arrow keys move between tabs, as screen-reader users expect from a tablist
  root.querySelector('[role="tablist"]')!.addEventListener("keydown", (e) => {
    const k = (e as KeyboardEvent).key;
    if (k === "ArrowRight") { e.preventDefault(); go(current + 1, true); }
    if (k === "ArrowLeft") { e.preventDefault(); go(current - 1, true); }
    if (k === "Home") { e.preventDefault(); go(0, true); }
    if (k === "End") { e.preventDefault(); go(panels.length - 1, true); }
  });

  root.querySelector("[data-level-prev]")!.addEventListener("click", () => go(current - 1));
  root.querySelector("[data-level-next]")!.addEventListener("click", () => go(current + 1));

  // swipe on phones
  let sx = 0, sy = 0;
  stage.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
  });
}
