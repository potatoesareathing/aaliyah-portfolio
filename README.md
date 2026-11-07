# Aaliyah's portfolio

A pixel-art bedroom at night that is also a website. The room is a real 3D scene (Three.js) rendered at low resolution with an ordered-dither shader. Each object opens a section, and the arcade cabinet runs my first pygame games in the browser through WebAssembly.

See [HOW-IT-WORKS.md](HOW-IT-WORKS.md) for how every part is built.

## Run it

Needs Node.js 20 or newer.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check, then build the site into dist/
npm run preview   # serve the built site
```

## Rebuilding the games (only if you change their Python)

The playable builds are already in `public/games/`. After editing anything in `games/<name>/`:

```bash
pip install pygbag
python games/build_web.py
```

That runs pygbag for each game and copies the result into `public/games/`. The script explains why the bundle is renamed to `.bundle`.

## Deploying

The site is static. Any static host works, for example Vercel, Netlify or GitHub Pages. Build command: `npm run build`. Output folder: `dist`.

## Credits

- Games built following [Clear Code](https://www.youtube.com/@ClearCode)'s pygame tutorials.
- Alien Shooters music by wyver9 and sound effects by SubspaceAudio (OpenGameArt).
- Fonts: Pixelify Sans and Atkinson Hyperlegible (SIL Open Font License).
