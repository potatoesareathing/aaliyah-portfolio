# How this portfolio works

A plain-English guide to every part of the site, so you can explain it to judges.

## The one-line pitch

> My portfolio is my room. It's a real 3D scene, rendered as pixel art. Each object in the room opens a section, and the arcade cabinet runs my actual Python games in the browser.

## Files

| File | What it does |
| --- | --- |
| `index.html` | All the content: intro, projects, arcade, about, skills, contact. Plain HTML, so it's readable without JavaScript and good for search engines. |
| `src/styles.css` | All the styling. Colours and fonts are variables at the top (`--yellow`, `--night`, ...). |
| `src/main.ts` | Starts everything. Connects the room's buttons to the 3D objects, highlights the nav link for the section on screen, and loads the 3D code only after the page is readable. |
| `src/room.ts` | The 3D room (Three.js) and the pixel-art effect. |
| `src/arcade.ts` | Opens a game in a popup (`<dialog>`) when you press Play. |
| `games/` | The web-ready copies of the three pygame games, plus the script that prepared them. |
| `public/games/` | The built games (made by pygbag). |
| `public/shots/` | Screenshots used on the page. |

## The 3D room (`src/room.ts`)

1. **Building the room.** Everything is made of boxes (`THREE.BoxGeometry`): floor, walls, desk, PC, arcade cabinet, shelf, toolbox and phone. Small textures (floor planks, wallpaper, the rainy city outside the window, the screens) are drawn in code onto tiny `<canvas>` elements. That's why no image files are needed.
2. **Lighting.** There's a dim blue ambient light, a "moonlight" directional light from the window, and point lights at the monitor, the neon sign and the arcade. The light pools are what make it feel like night.
3. **The pixel-art effect, the key trick.**
   - The scene is rendered into a **low-resolution image**, about 1/4 of the screen size. That image is a `WebGLRenderTarget`.
   - A small **fragment shader** (GPU code, in `PIXEL_SHADER`) stretches that image over the whole screen. It samples with *nearest neighbour*, so each low-res pixel becomes a sharp square.
   - The same shader **limits each colour channel to 14 levels** and adds a **Bayer ordered dither**. That's how old consoles faked more colours, and it gives the retro texture.
   - Result: smooth 3D geometry comes out looking like hand-made pixel art, and the camera can still move in 3D.
4. **Clickable objects.** A `Raycaster` shoots a line from the mouse into the scene to find which object is under the cursor. Each clickable object has a slightly bigger yellow copy rendered from the inside (`BackSide`). That copy only shows on hover, which creates the pixel outline.
5. **Clicking.** The camera zooms toward the object (an orthographic camera's `zoom`, eased with a cubic curve), then the page scrolls to that section.
6. **Performance.**
   - The scene only re-renders when something changes.
   - Animations stop when the room is scrolled off screen (`IntersectionObserver`) or the tab is hidden.
   - The screens and the rain update at about 10 fps on purpose: it reads as sprite animation and saves battery.
   - Three.js is loaded as a separate chunk (`import("./room")`) after the text has appeared.

## UX decisions

- **The room is a bonus, not a maze.** The same links are always in the top nav bar and in the buttons under the intro. Every section is normal scrolling content below the room.
- **The buttons and the 3D objects are linked.** Hovering a button outlines its object, and hovering an object highlights its button. Keyboard users can tab through the buttons and see the outlines too.
- **Readable type.** Pixelify Sans is used only for headings and labels. Body text is Atkinson Hyperlegible, a typeface designed by the Braille Institute for maximum legibility.
- **Reduced motion.** If the visitor's system asks for reduced motion, the rain, flicker, parallax and zooms are turned off.
- **No WebGL?** The intro panel becomes a normal hero and the site still works.
- **Phones.** The room shrinks to the top of the screen with the intro panel below. Taps work on the objects, and two of the games have touch controls.

## The games

They are the original pygame games, running in the browser through **pygbag**, which compiles Python and pygame to **WebAssembly**. Changes made for the web (all marked `# WEB:` in the code):

1. **`async` game loop.** A browser can't run a `while True` loop forever, because the page would freeze. Each loop now ends with `await asyncio.sleep(0)`, which hands control back to the browser once per frame.
2. **Paths.** `graphics\Player\a.png` became `graphics/Player/a.png`, because browsers only understand forward slashes.
3. **Audio** was converted to `.ogg`, the format pygbag supports in every browser.
4. **No quitting.** `sys.exit()` would kill the page, so dying restarts the run instead.
5. **Touch.** A tap jumps in Pixel Runner and Flappy Plane. In Alien Shooters, holding a finger moves the ship toward it and fires.
6. **Performance.** Fonts, images and sounds that were loaded every frame are now loaded once.

The popup creates the game's `<iframe>` when you press Play and deletes it when you close the popup, so the game stops running.

## Tech stack (for the form)

| Category | Tool | Where |
| --- | --- | --- |
| Language | TypeScript 5.9, HTML, CSS, Python 3 | site, games |
| Build tool | Vite 8 | dev server and production bundle |
| 3D | Three.js 0.187 | the room |
| GPU shader | GLSL | pixelation and dither |
| Games | pygame-ce, pygbag 0.9.3 (WebAssembly) | arcade |
| Fonts | Pixelify Sans, Atkinson Hyperlegible (self-hosted via Fontsource) | headings, body |
| Audio tools | ffmpeg | converted game audio to ogg |
| Testing | Playwright, Lighthouse | layout checks at phone and desktop sizes |
| AI | Claude (Claude Code) | pair-programmed the build. Say this honestly if asked. |

## Questions judges might ask

- **"Why not just use a 2D image for the room?"** A 3D scene can move: the camera reacts to the mouse and zooms into objects. The shader keeps the pixel-art look, so you get both.
- **"How do the games run in a browser?"** pygbag compiles CPython and pygame to WebAssembly. The browser downloads the Python runtime once, then runs my original `.py` files.
- **"How is it accessible?"** Real HTML content, a skip link, visible focus outlines, keyboard-reachable room buttons, a description on the canvas for screen readers, reduced-motion support and a readable body font.
- **"How is it fast?"**
  - Render-on-demand.
  - The animation loop pauses off screen.
  - A low-res render target, so the GPU does far less work.
  - Three.js is split into its own chunk.
  - Games load only when you press Play.
