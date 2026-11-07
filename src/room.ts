/**
 * The pixel room.
 *
 * How it works, in three steps:
 *  1. Build a small 3D bedroom out of boxes with Three.js (walls, desk, PC,
 *     arcade cabinet, shelf...). Textures are tiny canvases drawn in code.
 *  2. Render that scene into a LOW-resolution image (about 1/4 of the screen).
 *  3. Stretch that image to fill the screen with "nearest" sampling, so every
 *     low-res pixel becomes a crisp square, and apply an ordered (Bayer)
 *     dither that limits the colours. Smooth 3D comes out looking like pixel art.
 *
 * Clickable objects ("hotspots") get a yellow outline on hover and scroll the
 * page to their section when clicked.
 */
import * as THREE from "three";

export type HotspotKey = "pc" | "arcade" | "shelf" | "toolbox" | "phone";

export interface RoomOptions {
  canvas: HTMLCanvasElement;
  reducedMotion: boolean;
  labels: Record<HotspotKey, string>;
  onHover: (key: HotspotKey | null, clientX: number, clientY: number) => void;
  onActivate: (key: HotspotKey) => void;
}

export interface Room {
  highlight: (key: HotspotKey | null) => void;
  focus: (key: HotspotKey) => Promise<void>;
  resetCamera: () => void;
  setRunning: (running: boolean) => void;
}

// palette, shared with styles.css
const C = {
  void: 0x000000,
  night: 0x0a1450,
  wall: 0x141c5c,
  wallDark: 0x0c1240,
  floor: 0x1c1844,
  wood: 0x2a2468,
  blue: 0x3d5bff,
  yellow: 0xf4ff3a,
  paper: 0xe8ecff,
  pink: 0xff4fa8,
};

/* ------------------------------------------------------------------ */
/* canvas textures                                                     */
/* ------------------------------------------------------------------ */

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return { texture: t, ctx: g, canvas: c };
}

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");

function floorTexture() {
  return canvasTexture(64, 64, (g) => {
    g.fillStyle = hex(C.floor);
    g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) {
      g.fillStyle = "#14112f";
      g.fillRect(0, y, 64, 1); // plank seams
      const off = (y / 8) % 2 ? 0 : 24;
      g.fillRect(off, y, 1, 8);
      g.fillRect(off + 32, y, 1, 8);
      g.fillStyle = "#231d52";
      g.fillRect(off + 6, y + 3, 10, 1); // grain
    }
  }).texture;
}

function wallTexture() {
  return canvasTexture(32, 32, (g) => {
    g.fillStyle = hex(C.wall);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = "#18216a";
    for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 3, 32); // wallpaper stripes
    g.fillStyle = "#1d2878";
    for (let y = 4; y < 32; y += 16) for (let x = 5; x < 32; x += 16) g.fillRect(x, y, 2, 2);
  }).texture;
}

function rugTexture() {
  return canvasTexture(32, 24, (g) => {
    g.fillStyle = hex(C.blue);
    g.fillRect(0, 0, 32, 24);
    g.fillStyle = hex(C.night);
    g.fillRect(2, 2, 28, 20);
    g.fillStyle = "#1a2680";
    g.fillRect(5, 5, 22, 14);
    g.fillStyle = hex(C.night);
    g.fillRect(7, 7, 18, 10);
  }).texture;
}

function posterTexture() {
  return canvasTexture(24, 32, (g) => {
    g.fillStyle = "#0b0f38";
    g.fillRect(0, 0, 24, 32);
    g.fillStyle = hex(C.pink);
    g.beginPath();
    g.arc(12, 13, 7, 0, Math.PI * 2);
    g.fill(); // planet
    g.fillStyle = hex(C.yellow);
    g.fillRect(2, 13, 20, 1); // ring
    g.fillStyle = hex(C.paper);
    [[3, 3], [19, 5], [6, 24], [17, 22], [21, 28]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
    g.fillStyle = hex(C.blue);
    g.fillRect(4, 27, 16, 2);
  }).texture;
}

/* animated screens: return a texture plus a function that redraws it */
function monitorScreen() {
  const s = canvasTexture(48, 30, () => {});
  const lines = [
    [2, 10, C.pink], [2, 18, C.paper], [6, 14, C.blue], [6, 22, C.paper],
    [6, 8, C.yellow], [2, 6, C.pink], [6, 16, C.paper], [10, 12, C.blue],
  ] as const;
  let frame = 0;
  const draw = () => {
    const g = s.ctx;
    g.fillStyle = "#060a2e";
    g.fillRect(0, 0, 48, 30);
    g.fillStyle = hex(C.blue);
    g.fillRect(0, 0, 48, 3); // title bar
    g.fillStyle = hex(C.yellow);
    g.fillRect(2, 1, 1, 1);
    const shown = Math.min(lines.length, 3 + (frame % 14));
    for (let i = 0; i < shown; i++) {
      const [x, w, col] = lines[i];
      g.fillStyle = hex(col);
      g.fillRect(3 + x, 5 + i * 3, w, 1);
    }
    if (frame % 2 === 0) {
      g.fillStyle = hex(C.yellow);
      g.fillRect(4, 5 + shown * 3, 3, 1); // cursor
    }
    s.texture.needsUpdate = true;
    frame++;
  };
  draw();
  return { texture: s.texture, tick: draw };
}

function arcadeScreen() {
  const s = canvasTexture(24, 24, () => {});
  let t = 0;
  const invader = [
    "..x...x..",
    "...xxx...",
    "..xxxxx..",
    ".xx.x.xx.",
    "xxxxxxxxx",
    "x.x...x.x",
  ];
  const draw = () => {
    const g = s.ctx;
    g.fillStyle = "#000004";
    g.fillRect(0, 0, 24, 24);
    const ox = 3 + Math.round(Math.sin(t / 4) * 3);
    g.fillStyle = t % 2 ? hex(C.yellow) : "#c8ff2a";
    invader.forEach((row, y) =>
      [...row].forEach((ch, x) => ch === "x" && g.fillRect(ox + x, 3 + y, 1, 1)),
    );
    g.fillStyle = hex(C.blue);
    g.fillRect(10 + Math.round(Math.sin(t / 3) * 6), 20, 4, 2); // ship
    g.fillStyle = hex(C.paper);
    g.fillRect(12 + Math.round(Math.sin(t / 3) * 6), 18 - (t % 8), 1, 2); // shot
    s.texture.needsUpdate = true;
    t++;
  };
  draw();
  return { texture: s.texture, tick: draw };
}

function windowView() {
  const W = 64, H = 56;
  const s = canvasTexture(W, H, () => {});
  // a fixed skyline, drawn once into an offscreen canvas
  const sky = document.createElement("canvas");
  sky.width = W;
  sky.height = H;
  const k = sky.getContext("2d")!;
  const grad = k.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#03051c");
  grad.addColorStop(1, "#1b1f78");
  k.fillStyle = grad;
  k.fillRect(0, 0, W, H);
  k.fillStyle = hex(C.paper);
  k.fillRect(48, 8, 5, 5); // moon
  k.fillStyle = "#03051c";
  k.fillRect(50, 8, 3, 3);
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let x = 0; x < W; ) {
    const bw = 4 + Math.floor(rand() * 7);
    const bh = 12 + Math.floor(rand() * 26);
    k.fillStyle = rand() > 0.5 ? "#070a30" : "#0b0f3e";
    k.fillRect(x, H - bh, bw, bh);
    for (let wy = H - bh + 2; wy < H - 2; wy += 3)
      for (let wx = x + 1; wx < x + bw - 1; wx += 2)
        if (rand() > 0.62) {
          k.fillStyle = rand() > 0.7 ? hex(C.yellow) : rand() > 0.5 ? "#7f8cff" : "#ffb44f";
          k.fillRect(wx, wy, 1, 1);
        }
    x += bw + (rand() > 0.7 ? 1 : 0);
  }
  // a radio tower with a blinking light
  k.fillStyle = "#070a30";
  k.fillRect(30, H - 46, 1, 20);
  const drops = Array.from({ length: 34 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 2 + Math.random() * 2 }));
  let t = 0;
  const draw = () => {
    const g = s.ctx;
    g.drawImage(sky, 0, 0);
    g.fillStyle = t % 20 < 10 ? "#ff3d5a" : "#5a1020";
    g.fillRect(30, H - 47, 1, 1);
    g.fillStyle = "rgba(160,180,255,0.55)";
    for (const d of drops) {
      g.fillRect(Math.round(d.x), Math.round(d.y), 1, 3);
      d.y += d.v;
      d.x -= 0.4;
      if (d.y > H) { d.y = -3; d.x = Math.random() * (W + 10); }
    }
    s.texture.needsUpdate = true;
    t++;
  };
  draw();
  return { texture: s.texture, tick: draw };
}

function neonSign() {
  const s = canvasTexture(256, 72, () => {});
  const draw = (on: number) => {
    const g = s.ctx;
    g.clearRect(0, 0, 256, 72);
    g.font = '700 50px "Pixelify Sans", monospace';
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (on > 0) {
      g.shadowColor = hex(C.yellow);
      g.shadowBlur = 16 * on;
    }
    g.fillStyle = on > 0 ? hex(C.yellow) : "#3a3d1c";
    g.fillText("aaliyah", 128, 38);
    g.shadowBlur = 0;
    // the tube's darker core reads as glass
    g.fillStyle = on > 0 ? "rgba(255,255,230,0.55)" : "rgba(0,0,0,0)";
    g.fillText("aaliyah", 128, 37);
    s.texture.needsUpdate = true;
  };
  draw(0);
  return { texture: s.texture, draw };
}

/* ------------------------------------------------------------------ */
/* the pixel-art post process                                          */
/* ------------------------------------------------------------------ */

const PIXEL_SHADER = {
  vertex: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragment: /* glsl */ `
    uniform sampler2D tScene;
    uniform vec2 uLowRes;
    varying vec2 vUv;

    // 4x4 Bayer matrix, values 0..15
    float bayer(vec2 p) {
      int x = int(mod(p.x, 4.0));
      int y = int(mod(p.y, 4.0));
      int i = x + y * 4;
      int m[16] = int[16](0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5);
      return float(m[i]) / 16.0 - 0.5;
    }

    void main() {
      vec2 cell = floor(vUv * uLowRes);
      vec3 linear = texture2D(tScene, (cell + 0.5) / uLowRes).rgb;
      // the scene is rendered in linear light; convert to screen (sRGB) values first,
      // otherwise every dark blue would round down to black below
      // empty space around the room stays pure black, with no dither noise
      if (max(linear.r, max(linear.g, linear.b)) < 0.0004) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
      vec3 col = pow(linear, vec3(1.0 / 2.2));
      // tint the shadows night-blue instead of grey
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col += vec3(0.01, 0.02, 0.09) * (1.0 - smoothstep(0.0, 0.35, luma));
      // limit each channel to a few levels, dithered, like an old console
      float levels = 14.0;
      col = floor(col * levels + bayer(cell) * 0.55 + 0.5) / levels;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/* ------------------------------------------------------------------ */
/* building the room                                                   */
/* ------------------------------------------------------------------ */

export function createRoom(opts: RoomOptions): Room {
  const { canvas, reducedMotion } = opts;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.void);

  const target = new THREE.WebGLRenderTarget(1, 1, {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
    colorSpace: THREE.SRGBColorSpace,
  });

  const post = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: target.texture }, uLowRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: PIXEL_SHADER.vertex,
    fragmentShader: PIXEL_SHADER.fragment,
    depthTest: false,
    depthWrite: false,
  });
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const lookAt = new THREE.Vector3(0, 2.9, 0);
  const camHome = new THREE.Vector3(12, 10.5, 12);

  // --- helpers
  const lambert = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) =>
    new THREE.MeshLambertMaterial({ color, ...extra });
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // --- lights
  scene.add(new THREE.AmbientLight(0x5866b8, 1.0));
  const moon = new THREE.DirectionalLight(0x9aa6ff, 0.9);
  moon.position.set(-8, 8, 3);
  scene.add(moon);
  const monitorLight = new THREE.PointLight(0x5c78ff, 30, 9, 1.4);
  monitorLight.position.set(1.2, 3.4, -2.6);
  scene.add(monitorLight);
  const signLight = new THREE.PointLight(C.yellow, 0, 10, 1.3);
  signLight.position.set(1.4, 5.2, -3.9);
  scene.add(signLight);
  const arcadeLight = new THREE.PointLight(0xff6ac0, 14, 6, 1.5);
  arcadeLight.position.set(-2.4, 3.2, -2.2);
  scene.add(arcadeLight);

  // --- shell: floor and two walls (the camera looks into the corner)
  const floorTex = floorTexture();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(2.5, 2.5);
  box(10, 0.4, 10, lambert(0xffffff, { map: floorTex }), 0, -0.2, 0);
  const wallTex = wallTexture();
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(5, 3.5);
  box(10, 7, 0.4, lambert(0xffffff, { map: wallTex }), 0, 3.5, -5.2);
  const wallTex2 = wallTex.clone();
  wallTex2.repeat.set(5, 3.5);
  box(0.4, 7, 10.4, lambert(0xffffff, { map: wallTex2 }), -5.2, 3.5, 0);
  // skirting boards with a blue LED strip
  box(10, 0.3, 0.12, lambert(C.wallDark), 0, 0.15, -4.94);
  box(0.12, 0.3, 10, lambert(C.wallDark), -4.94, 0.15, 0);
  const led = new THREE.MeshBasicMaterial({ color: C.blue });
  box(10, 0.06, 0.06, led, 0, 6.9, -4.96);
  box(0.06, 0.06, 10, led, -4.96, 6.9, 0);

  // rug
  box(5, 0.04, 3.6, lambert(0xffffff, { map: rugTexture() }), 0.6, 0.02, 0.8);

  // --- desk against the back wall
  const deskMat = lambert(C.wood);
  box(4.4, 0.2, 1.8, deskMat, 1.4, 2.0, -3.9);
  box(0.2, 2.0, 1.6, deskMat, -0.7, 1.0, -3.9);
  box(0.2, 2.0, 1.6, deskMat, 3.5, 1.0, -3.9);
  // chair
  const chairMat = lambert(0x221a5a);
  box(1.3, 0.2, 1.3, chairMat, 1.2, 1.2, -1.9);
  box(1.3, 1.6, 0.2, chairMat, 1.2, 2.1, -1.25);
  box(0.15, 1.1, 0.15, lambert(0x0a0a20), 1.2, 0.55, -1.9);
  // plant on the floor by the desk
  box(0.6, 0.7, 0.6, lambert(0xb04a2a), 4.2, 0.35, -4.2);
  const leaf = lambert(0x2f8f5a);
  box(0.25, 1.1, 0.25, leaf, 4.1, 1.2, -4.2).rotation.z = 0.3;
  box(0.25, 0.9, 0.25, leaf, 4.35, 1.1, -4.1).rotation.z = -0.4;
  box(0.25, 1.0, 0.25, leaf, 4.2, 1.15, -4.4).rotation.x = 0.4;

  // --- hotspots: each is a group whose meshes are raycast and outlined
  const hotspots = new Map<HotspotKey, { group: THREE.Group; outline: THREE.Group; focusPoint: THREE.Vector3 }>();
  const pickable: THREE.Mesh[] = [];
  const outlineMat = new THREE.MeshBasicMaterial({ color: C.yellow, side: THREE.BackSide });

  const hotspot = (key: HotspotKey, focusPoint: THREE.Vector3) => {
    const group = new THREE.Group();
    group.userData.key = key;
    scene.add(group);
    const outline = new THREE.Group();
    outline.visible = false;
    scene.add(outline);
    hotspots.set(key, { group, outline, focusPoint });
    return group;
  };
  // after a hotspot's meshes exist, give each a slightly larger back-face twin: the outline
  const finishHotspot = (key: HotspotKey) => {
    const h = hotspots.get(key)!;
    h.group.updateMatrixWorld(true);
    h.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.userData.key = key;
      pickable.push(o);
      if (o.userData.noOutline) return; // flat screens sit flush on their body, which already has an outline
      const shell = new THREE.Mesh(o.geometry, outlineMat);
      o.matrixWorld.decompose(shell.position, shell.quaternion, shell.scale);
      const size = new THREE.Vector3();
      (o.geometry.boundingBox ?? (o.geometry.computeBoundingBox(), o.geometry.boundingBox!)).getSize(size);
      // grow by a fixed amount (not a percentage) so thin and big parts get the same outline
      shell.scale.multiply(new THREE.Vector3(1 + 0.16 / Math.max(size.x, 0.01), 1 + 0.16 / Math.max(size.y, 0.01), 1 + 0.16 / Math.max(size.z, 0.01)));
      h.outline.add(shell);
    });
  };

  // PC: monitor, keyboard, tower
  const pc = hotspot("pc", new THREE.Vector3(1.2, 3.2, -3.9));
  const mon = monitorScreen();
  box(2.2, 1.45, 0.2, lambert(0x0d0f2c), 1.1, 3.05, -4.35, pc);
  const screenMesh = box(2.0, 1.25, 0.02, new THREE.MeshBasicMaterial({ map: mon.texture }), 1.1, 3.05, -4.24, pc);
  screenMesh.userData.noOutline = true;
  box(0.25, 0.6, 0.25, lambert(0x0d0f2c), 1.1, 2.3, -4.35, pc);
  box(1.4, 0.08, 0.5, lambert(0x2a2f6a), 1.1, 2.14, -3.5, pc);
  box(0.8, 1.6, 1.4, lambert(0x0d0f2c), 3.0, 0.8, -3.9, pc);
  box(0.04, 1.2, 0.04, new THREE.MeshBasicMaterial({ color: C.blue }), 2.58, 0.9, -3.3, pc); // tower LED
  finishHotspot("pc");

  // phone: a chunky retro phone on the desk
  const phone = hotspot("phone", new THREE.Vector3(-0.1, 2.3, -3.6));
  box(0.7, 0.25, 0.5, lambert(C.pink, { emissive: 0x5a1038 }), -0.15, 2.22, -3.55, phone);
  box(0.8, 0.14, 0.2, lambert(C.pink), -0.15, 2.42, -3.55, phone);
  box(0.08, 0.08, 0.08, new THREE.MeshBasicMaterial({ color: C.yellow }), 0.12, 2.36, -3.32, phone);
  finishHotspot("phone");

  // arcade cabinet in the back-left corner
  const arcade = hotspot("arcade", new THREE.Vector3(-3.8, 3.0, -3.0));
  const arc = arcadeScreen();
  const cabMat = lambert(0x1a1e70);
  box(1.6, 4.4, 1.5, cabMat, -4.1, 2.2, -3.0, arcade);
  box(0.06, 4.4, 0.08, new THREE.MeshBasicMaterial({ color: C.pink }), -3.28, 2.2, -2.22, arcade); // front edge trim
  box(0.06, 4.4, 1.5, new THREE.MeshBasicMaterial({ color: C.blue }), -3.28, 2.2, -3.0, arcade); // side trim
  const marquee = box(0.3, 0.55, 1.5, new THREE.MeshBasicMaterial({ color: C.yellow }), -3.4, 4.15, -3.0, arcade);
  marquee.userData.noOutline = true;
  const arcScreen = box(0.05, 1.3, 1.3, new THREE.MeshBasicMaterial({ map: arc.texture }), -3.28, 3.15, -3.0, arcade);
  arcScreen.rotation.z = -0.12;
  box(0.7, 0.2, 1.5, lambert(0x24288a), -3.0, 2.3, -3.0, arcade); // control panel
  box(0.1, 0.3, 0.1, lambert(C.pink), -2.85, 2.5, -3.25, arcade); // joystick
  box(0.12, 0.06, 0.12, new THREE.MeshBasicMaterial({ color: C.yellow }), -2.85, 2.42, -2.75, arcade);
  finishHotspot("arcade");

  // shelf on the left wall with badges and a trophy
  const shelf = hotspot("shelf", new THREE.Vector3(-4.5, 4.4, 1.0));
  box(0.8, 0.12, 3.0, deskMat, -4.6, 4.0, 1.0, shelf);
  box(0.3, 0.6, 0.45, lambert(C.yellow, { emissive: 0x4a4c00 }), -4.6, 4.36, -0.1, shelf); // trophy cup
  box(0.4, 0.15, 0.4, lambert(0x8a7a20), -4.6, 4.13, -0.1, shelf);
  box(0.12, 0.7, 0.55, lambert(C.blue), -4.75, 4.41, 0.7, shelf); // books
  box(0.12, 0.6, 0.55, lambert(C.pink), -4.75, 4.36, 0.95, shelf);
  box(0.12, 0.75, 0.55, lambert(C.paper), -4.75, 4.43, 1.2, shelf);
  box(0.15, 0.5, 0.5, lambert(0x3dffa8), -4.7, 4.31, 2.0, shelf); // badge
  finishHotspot("shelf");

  // toolbox on the floor
  const toolbox = hotspot("toolbox", new THREE.Vector3(3.4, 0.8, 1.6));
  box(1.6, 0.8, 0.9, lambert(C.yellow, { emissive: 0x6a6e00 }), 3.5, 0.4, 1.6, toolbox);
  box(1.6, 0.08, 0.92, lambert(0x8a8a10), 3.5, 0.62, 1.6, toolbox);
  box(0.7, 0.12, 0.12, lambert(0x0d0f2c), 3.5, 0.92, 1.6, toolbox);
  box(0.12, 0.25, 0.12, lambert(0x0d0f2c), 3.2, 0.82, 1.6, toolbox);
  box(0.12, 0.25, 0.12, lambert(0x0d0f2c), 3.8, 0.82, 1.6, toolbox);
  finishHotspot("toolbox");

  // window on the left wall, with rain over a city skyline
  const win = windowView();
  box(0.1, 2.6, 3.0, new THREE.MeshBasicMaterial({ map: win.texture }), -4.95, 3.7, 3.0);
  const frameMat = lambert(0x0d0f2c);
  box(0.25, 0.18, 3.3, frameMat, -4.9, 5.05, 3.0);
  box(0.25, 0.18, 3.3, frameMat, -4.9, 2.35, 3.0);
  box(0.25, 2.8, 0.18, frameMat, -4.9, 3.7, 1.5);
  box(0.25, 2.8, 0.18, frameMat, -4.9, 3.7, 4.5);
  box(0.25, 2.6, 0.08, frameMat, -4.9, 3.7, 3.0);
  box(0.6, 0.12, 3.3, frameMat, -4.75, 2.3, 3.0); // sill

  // posters on the back wall
  box(1.2, 1.6, 0.04, lambert(0xffffff, { map: posterTexture() }), -1.9, 4.1, -4.97);

  // beanbag in the front-left
  const bean = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), lambert(0x2a2f9a, { flatShading: true }));
  bean.scale.set(1.1, 0.6, 1.1);
  bean.position.set(-2.6, 0.5, 2.6);
  scene.add(bean);

  // fairy lights along the top of the back wall
  const bulbs: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const x = -4.4 + i * 0.66;
    const y = 6.3 - Math.sin((i / 13) * Math.PI) * 0.45;
    const b = box(0.14, 0.14, 0.14, new THREE.MeshBasicMaterial({ color: i % 2 ? C.yellow : C.pink }), x, y, -4.9);
    bulbs.push(b);
  }

  // the neon sign: the page's title, drawn on the back wall
  const sign = neonSign();
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 1.6),
    new THREE.MeshBasicMaterial({ map: sign.texture, transparent: true }),
  );
  signMesh.position.set(1.5, 5.3, -4.96);
  scene.add(signMesh);
  // redraw once the pixel font has loaded, so the sign uses it
  document.fonts?.load('700 50px "Pixelify Sans"').then(() => sign.draw(signOn)).catch(() => {});

  /* ---------------------------------------------------------------- */
  /* sizing                                                            */
  /* ---------------------------------------------------------------- */
  let width = 1, height = 1;
  const resize = () => {
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    // one art pixel = roughly 1/220th of the shorter screen side
    const px = Math.max(2, Math.round(Math.min(width, height * 1.4) / 220));
    const lw = Math.ceil(width / px), lh = Math.ceil(height / px);
    target.setSize(lw, lh);
    post.uniforms.uLowRes.value.set(lw, lh);

    const aspect = width / height;
    const viewH = Math.max(12.6, 14.2 / aspect);
    const viewW = viewH * aspect;
    // on wide screens push the room right so the intro panel has space on the left
    const shift = aspect > 1.2 ? Math.min(0.3, (aspect - 1.2) * 0.35) : 0;
    camera.left = (-viewW / 2) * (1 + shift);
    camera.right = (viewW / 2) * (1 - shift);
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
    requestRender();
  };

  /* ---------------------------------------------------------------- */
  /* camera motion                                                     */
  /* ---------------------------------------------------------------- */
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  const zoom = { value: 1, from: 1, to: 1, start: 0, dur: 1 };
  const focus = { point: lookAt.clone(), from: lookAt.clone(), to: lookAt.clone() };

  const placeCamera = () => {
    const angle = parallax.x * 0.07;
    const pos = camHome.clone().sub(lookAt);
    pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    pos.y += parallax.y * 0.8;
    camera.position.copy(focus.point).add(pos);
    camera.zoom = zoom.value;
    camera.lookAt(focus.point);
    camera.updateProjectionMatrix();
  };

  const ease = (t: number) => 1 - Math.pow(1 - t, 3);

  /* ---------------------------------------------------------------- */
  /* interaction                                                       */
  /* ---------------------------------------------------------------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered: HotspotKey | null = null;
  let forced: HotspotKey | null = null;

  const pick = (clientX: number, clientY: number): HotspotKey | null => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickable, false)[0];
    return (hit?.object.userData.key as HotspotKey) ?? null;
  };

  const showOutline = () => {
    const active = forced ?? hovered;
    hotspots.forEach((h, key) => (h.outline.visible = key === active));
    requestRender();
  };

  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") {
      const r = canvas.getBoundingClientRect();
      parallax.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      parallax.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    }
    const key = pick(e.clientX, e.clientY);
    if (key !== hovered) {
      hovered = key;
      showOutline();
    }
    opts.onHover(key, e.clientX, e.clientY);
  });
  canvas.addEventListener("pointerleave", () => {
    hovered = null;
    parallax.tx = parallax.ty = 0;
    showOutline();
    opts.onHover(null, 0, 0);
  });
  canvas.addEventListener("click", (e) => {
    const key = pick(e.clientX, e.clientY);
    if (key) opts.onActivate(key);
  });

  /* ---------------------------------------------------------------- */
  /* render loop                                                       */
  /* ---------------------------------------------------------------- */
  let running = false;
  let rafId = 0;
  let needsRender = true;
  let lastTick = 0;
  let signOn = 0;
  const boot = performance.now();
  const flicker = [0, 1, 0, 0, 1, 0.3, 1, 0, 1]; // the sign stutters on, like a real tube

  const requestRender = () => {
    needsRender = true;
    if (!rafId) rafId = requestAnimationFrame(frame);
  };

  function frame(now: number) {
    rafId = 0;
    // sign boot sequence: ~1.1s of flicker, then steady
    const since = (now - boot) / 1000;
    const nextSign = reducedMotion ? 1 : since < 1.1 ? flicker[Math.min(flicker.length - 1, Math.floor(since * 8))] : 1;
    if (nextSign !== signOn) {
      signOn = nextSign;
      sign.draw(signOn);
      signLight.intensity = 34 * signOn;
      needsRender = true;
    }

    if (!reducedMotion) {
      // screens and rain tick at ~10 fps: it reads as sprite animation, not video
      if (now - lastTick > 100) {
        lastTick = now;
        win.tick();
        arc.tick();
        if (Math.random() < 0.3) mon.tick();
        bulbs.forEach((b, i) => (b.visible = (Math.floor(now / 600) + i) % 5 !== 0));
        needsRender = true;
      }
      parallax.x += (parallax.tx - parallax.x) * 0.06;
      parallax.y += (parallax.ty - parallax.y) * 0.06;
      if (Math.abs(parallax.tx - parallax.x) > 0.001 || Math.abs(parallax.ty - parallax.y) > 0.001) needsRender = true;
    }

    if (zoom.start) {
      const t = Math.min(1, (now - zoom.start) / zoom.dur);
      const k = ease(t);
      zoom.value = zoom.from + (zoom.to - zoom.from) * k;
      focus.point.lerpVectors(focus.from, focus.to, k);
      if (t >= 1) zoom.start = 0;
      needsRender = true;
    }

    if (needsRender) {
      placeCamera();
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
      needsRender = false;
    }

    const booting = since < 1.3;
    if (running || zoom.start || booting) rafId = requestAnimationFrame(frame);
  }

  const animateTo = (point: THREE.Vector3, z: number, dur: number) =>
    new Promise<void>((resolve) => {
      zoom.from = zoom.value;
      zoom.to = z;
      focus.from.copy(focus.point);
      focus.to.copy(point);
      zoom.dur = reducedMotion ? 1 : dur;
      zoom.start = performance.now();
      requestRender();
      setTimeout(resolve, reducedMotion ? 0 : dur);
    });

  window.addEventListener("resize", resize);
  resize();
  requestRender();

  return {
    highlight(key) {
      forced = key;
      showOutline();
    },
    focus(key) {
      const h = hotspots.get(key)!;
      // move the look-at point most of the way to the object and zoom in
      const p = lookAt.clone().lerp(h.focusPoint, 0.75);
      return animateTo(p, 1.9, 520);
    },
    resetCamera() {
      if (zoom.value !== 1) void animateTo(lookAt, 1, 400);
    },
    setRunning(r) {
      running = r && !reducedMotion;
      if (r) requestRender();
    },
  };
}
