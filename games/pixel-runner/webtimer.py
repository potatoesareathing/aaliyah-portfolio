"""WEB: pygame.time.set_timer is not implemented in the browser (WASM) build yet.

Importing this module replaces it with a small version written in Python:
set_timer() just remembers each timer, and every time the game calls
pygame.event.get() any timers that are due post their event first.
The games themselves don't need to change, they keep calling set_timer as usual.
"""
import pygame

_timers = {}  # event type -> [interval_ms, next_fire_ms]


def set_timer(event, millis, loops=0):
    if millis <= 0:
        _timers.pop(event, None)
    else:
        _timers[event] = [millis, pygame.time.get_ticks() + millis]


def _fire_due_timers():
    now = pygame.time.get_ticks()
    for event, timer in _timers.items():
        if now >= timer[1]:
            pygame.event.post(pygame.event.Event(event))
            timer[1] = now + timer[0]


_original_get = pygame.event.get


def get(*args, **kwargs):
    _fire_due_timers()
    return _original_get(*args, **kwargs)


pygame.time.set_timer = set_timer
pygame.event.get = get
