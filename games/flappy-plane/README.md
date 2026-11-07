# Flappy Plane

A Flappy Bird-style arcade game built in Python with pygame-ce, flown with a propeller plane
instead of a bird.

Tap to climb, release and gravity takes over. Rock formations rise from the ground and hang from
the ceiling, and the plane tilts nose-up as it climbs and nose-down as it dives. Collision is
checked against the actual shape of the plane rather than a box around it, so clipping the tip of
a rock counts and empty space never does.

The game **speeds up after ten seconds** — the run is designed to eventually beat you.

<img src="screenshots/gameplay.png" alt="Flappy Plane gameplay" width="330">

---

## Gameplay

| Action | Key |
| --- | --- |
| Fly up | `Space` |

- Your score is **how many seconds you have survived**.
- Touching a rock or the ground ends the run.
- Obstacles spawn once per second from either the floor or the ceiling, chosen at random.

## Running it

Requires Python 3.11 or newer.

```bash
pip install -r requirements.txt
```

```bash
python main.py
```

Run from the project root — assets are loaded from paths relative to the working directory.

## Project structure

| File | Responsibility |
| --- | --- |
| `main.py` | `Game` class: the main loop, delta time, collision, difficulty ramp, score display |
| `sprites.py` | The four sprite classes — `BG`, `Ground`, `Plane`, `Obstacle` |
| `settings.py` | Window dimensions and frame rate |
| `test.py` | A standalone scratch file for experimenting with surface rotation |

## How it is built

**Movement is time-based, not frame-based.** Every `update()` takes a `dt` (delta time — the real
number of seconds since the last frame) and multiplies speed by it. This is the single most
important idea in the project: it means the plane falls at the same real-world rate whether the
machine renders 30 or 300 frames per second.

```python
def movement(self, dt):
    self.rect.x -= self.speed * dt
```

**The background scrolls by cheating.** The background image is drawn twice, side by side, onto
one double-width surface. That surface slides left, and the moment it has moved exactly one image
width it snaps back to the start. The seam lands where the two copies meet, so the jump is
invisible and the scroll looks infinite.

**Collision uses pixel masks.** `pygame.sprite.collide_mask` compares the actual opaque pixels of
the plane against the rock, instead of the rectangles around them. Rotated sprites make
rectangle collision feel unfair — this fixes that.

**The plane's tilt is driven by the same value as its thrust.** Pressing space sets a negative
gravity (a push upward) and increases `direction`, which is also the rotation angle. `direction`
constantly decays, so the nose gradually drops when you stop flying. One variable produces both
the physics and the visual.

**Obstacles clean up after themselves.** Each obstacle checks its own position every frame and
calls `self.kill()` once it is well off the left edge, removing itself from every group it
belongs to. Nothing accumulates in memory.

## Built with

- Python 3.11
- [pygame-ce](https://pyga.me/) 2.5.5

## Credits

The graphics, fonts and sounds in this repository come from the asset pack of a public
YouTube pygame tutorial. They are **not my work**, and they remain the property of their
original creators under whatever terms those creators set.

The code is my own, written following that tutorial.

## License

The **source code** is released under the [MIT License](LICENSE) — use it, change it,
build on it, just keep the copyright notice.

The **assets** in `graphics/` and `sounds/` are not covered by that licence. If you fork
this project, replace them or obtain your own permission to use them.
