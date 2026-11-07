"""Build the three games for the browser and copy them into public/games/.

    pip install pygbag
    python games/build_web.py

For each game this runs pygbag, then copies index.html and the game bundle.
The bundle is renamed from <game>.tar.gz to <game>.bundle: some servers
(including Vite's dev server) see ".gz", send the file with
"Content-Encoding: gzip", and the browser unzips it before Python can read it,
which leaves the game stuck on "Loading".
"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES = ["flappy-plane", "pixel-runner", "alien-shooters"]

for game in GAMES:
    src = ROOT / "games" / game
    subprocess.run([sys.executable, "-m", "pygbag", "--build", "--ume_block", "0", "--title", game, str(src)], check=True)
    web = src / "build" / "web"
    out = ROOT / "public" / "games" / game
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    shutil.copy(web / "favicon.png", out)
    shutil.copy(web / f"{game}.tar.gz", out / f"{game}.bundle")
    html = (web / "index.html").read_text(encoding="utf-8").replace(f'"{game}.tar.gz"', f'"{game}.bundle"')
    (out / "index.html").write_text(html, encoding="utf-8")
    print(f"built {game}")
