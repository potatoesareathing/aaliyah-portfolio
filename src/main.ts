import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/600.css";
import "@fontsource/pixelify-sans/700.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./styles.css";

import type { HotspotKey, Room } from "./room";
import { setupArcade } from "./arcade";
import { setupMotion } from "./motion";
import { setupLevels } from "./levels";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------
   Room menu buttons <-> 3D objects
   ------------------------------------------------------------------ */
const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-hotspot]")];
const buttonFor = (key: HotspotKey) => buttons.find((b) => b.dataset.hotspot === key)!;
const labels = Object.fromEntries(
  buttons.map((b) => [b.dataset.hotspot, b.textContent?.replace(b.querySelector(".key")?.textContent ?? "", "").trim() ?? ""]),
) as Record<HotspotKey, string>;

const roomEl = document.querySelector<HTMLElement>(".room")!;
const hint = document.getElementById("room-hint")!;
let room: Room | null = null;

function goTo(key: HotspotKey) {
  const target = document.querySelector(buttonFor(key).dataset.target!);
  if (!target) return;
  const scroll = () => target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  // zoom toward the object first, then travel to its section
  if (room) room.focus(key).then(scroll);
  else scroll();
}

buttons.forEach((b) => {
  const key = b.dataset.hotspot as HotspotKey;
  b.addEventListener("click", () => goTo(key));
  b.addEventListener("pointerenter", () => room?.highlight(key));
  b.addEventListener("pointerleave", () => room?.highlight(null));
  b.addEventListener("focus", () => room?.highlight(key));
  b.addEventListener("blur", () => room?.highlight(null));
});

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

async function startRoom() {
  if (!hasWebGL()) {
    document.documentElement.classList.add("no-webgl");
    return;
  }
  // three.js is the biggest download, so it loads as its own chunk after the page is readable
  const { createRoom } = await import("./room");
  room = createRoom({
    canvas: document.getElementById("room-canvas") as HTMLCanvasElement,
    reducedMotion,
    labels,
    onHover(key, x, y) {
      roomEl.classList.toggle("is-hovering", !!key);
      buttons.forEach((b) => b.classList.toggle("is-active", b.dataset.hotspot === key));
      if (key) {
        const r = roomEl.getBoundingClientRect();
        hint.textContent = labels[key];
        hint.style.left = `${x - r.left}px`;
        hint.style.top = `${y - r.top}px`;
        hint.classList.add("is-visible");
      } else {
        hint.classList.remove("is-visible");
      }
    },
    onActivate: goTo,
  });

  // only animate while the room is on screen and the tab is visible
  let visible = true;
  const update = () => room?.setRunning(visible && document.visibilityState === "visible");
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    // coming back up to the room: ease the camera back out
    if (entry.intersectionRatio > 0.6) room?.resetCamera();
    update();
  }, { threshold: [0, 0.6] }).observe(roomEl);
  document.addEventListener("visibilitychange", update);
  update();
}

startRoom();

/* ------------------------------------------------------------------
   Highlight the nav link for the section in view
   ------------------------------------------------------------------ */
const navLinks = [...document.querySelectorAll<HTMLAnchorElement>(".nav a")];
const sections = navLinks.map((a) => document.querySelector<HTMLElement>(a.hash)!).filter(Boolean);
const navObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      // back at the room: no section is current
      navLinks.forEach((a) => {
        if (a.hash === `#${e.target.id}`) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }
  },
  { rootMargin: "-45% 0px -50% 0px" },
);
sections.forEach((s) => navObserver.observe(s));
navObserver.observe(roomEl);

setupArcade(reducedMotion);
setupMotion(reducedMotion);
setupLevels(reducedMotion);
