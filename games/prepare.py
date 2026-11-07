"""Copy the original pygame projects and apply the mechanical web fixes.

Run once from the repo root:  python games/prepare.py <folder with the cloned repos>

What it changes (everything else stays exactly as written):
  * Windows paths like 'graphics\\Player\\a.png' become 'graphics/Player/a.png'.
    Browsers only understand forward slashes.
  * Debug print() lines are removed. In the browser every print goes to a
    console, and printing every frame makes the game stutter.
  * .wav / .mp3 audio is converted to .ogg, the format pygbag supports
    in every browser, and the file names in the code are updated.

The async game-loop changes are done by hand afterwards, see games/README.md.
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

GAMES = {"flappyplane": "flappy-plane", "pixelrunner": "pixel-runner", "spaceinvaders": "alien-shooters"}
SKIP = {".git", "screenshots", "test.py", "gametest.py", "requirements.txt"}


def fix_python(text: str) -> str:
    # backslashes inside string literals that look like paths
    def slash(match: re.Match) -> str:
        return match.group(0).replace("\\", "/")

    text = re.sub(r"(?:rf|fr|r|f)?'[^'\n]*\\[^'\n]*'", slash, text)
    text = re.sub(r'(?:rf|fr|r|f)?"[^"\n]*\\[^"\n]*"', slash, text)

    # single-line debug prints
    lines = [ln for ln in text.splitlines() if not re.match(r"^\s*print\(.*\)\s*(#.*)?$", ln)]
    text = "\n".join(lines) + "\n"

    # audio file names
    return re.sub(r"\.(wav|mp3)(['\"])", r".ogg\2", text)


def main(src_root: Path, ffmpeg: str) -> None:
    out_root = Path(__file__).parent
    for repo, slug in GAMES.items():
        src, dst = src_root / repo, out_root / slug
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst, ignore=lambda d, names: [n for n in names if n in SKIP])
        for py in dst.glob("*.py"):
            py.write_text(fix_python(py.read_text(encoding="utf-8")), encoding="utf-8")
        for audio in list(dst.rglob("*.wav")) + list(dst.rglob("*.mp3")):
            ogg = audio.with_suffix(".ogg")
            subprocess.run([ffmpeg, "-loglevel", "error", "-y", "-i", str(audio), "-c:a", "libvorbis", "-q:a", "4", str(ogg)], check=True)
            audio.unlink()
        print(f"prepared {slug}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else "ffmpeg")
