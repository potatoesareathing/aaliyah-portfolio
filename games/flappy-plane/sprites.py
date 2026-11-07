import pygame
from settings import *
from pygame.image import load
from random import choice, randint


class BG(pygame.sprite.Sprite):
    def __init__(self, *groups):
        super().__init__(*groups)
        self.image = load(
            r'graphics/environment/background.png').convert_alpha()
        self.image = pygame.transform.scale(
            self.image, (self.image.get_width(), WINDOW_HEIGHT))

        height = self.image.get_height()
        width = self.image.get_width()

        self.canvas = pygame.Surface((width*2, height))
        self.canvas.blit(self.image, (0, 0))
        self.canvas.blit(self.image, (width, 0))

        self.image = self.canvas
        self.rect = self.canvas.get_rect(topleft=(0, 0))
        self.speed = 200

    def movement(self, dt):
        self.rect.x -= self.speed * dt
        if self.rect.x <= -800:
            self.rect.x = 0

    def update(self, dt):
        self.movement(dt)


class Ground(pygame.sprite.Sprite):
    def __init__(self, *groups):
        super().__init__(*groups)
        self.image = load(r'graphics/environment/ground.png').convert_alpha()
        self.rect = self.image.get_rect(bottomleft=(0, WINDOW_HEIGHT))
        width, height = self.image.get_width(), self.image.get_height()
        self.speed = 400
        self.mask = pygame.mask.from_surface(self.image)

    def movement(self, dt):
        self.rect.x -= self.speed * dt
        if self.rect.x <= -800:
            self.rect.x = 0

    def update(self, dt):
        self.movement(dt)


class Plane(pygame.sprite.Sprite):
    def __init__(self, *groups):
        super().__init__(*groups)
        self.frames = []
        self.gravity = 0
        for number in range(3):
            image = load(rf'graphics/plane/red{number}.png').convert_alpha()
            self.frames.append(image)

        self.frame_index = 0
        self.image = self.frames[self.frame_index]
        self.rect = self.image.get_rect(topleft=(0, 0))
        self.direction = 0
        self.mask = pygame.mask.from_surface(self.image)

    def animation(self, dt):
        self.frame_index += 6 * dt
        if self.frame_index >= len(self.frames):
            self.frame_index = 0
        self.image = self.frames[int(self.frame_index)]

    def fall(self, dt):
        self.gravity += 40 * dt
        self.rect.y += self.gravity

    def apply_gravity(self, dt):
        self.gravity = -400 * dt
        self.direction += 50
        pygame.mixer.Sound(r'sounds/jump.ogg').play()

    def rotation(self):
        self.direction -= 0.7
        if self.direction <= -50:
            self.direction = -50
        if self.direction >= 50:
            self.direction = 50
        self.image = pygame.transform.rotozoom(self.image, self.direction, 0.7)
        self.mask = pygame.mask.from_surface(self.image)

    def update(self, dt):
        self.animation(dt)
        self.fall(dt)
        self.rotation()


class Obstacle(pygame.sprite.Sprite):
    def __init__(self, *groups):
        super().__init__(*groups)
        image = load(r'graphics/obstacles/0.png').convert_alpha()
        height = image.get_height()
        width = image.get_width()
        self.obstacles = [pygame.transform.scale(load(r'graphics/obstacles/0.png').convert_alpha(), (width, height*1.5)),
                          pygame.transform.scale(load(r'graphics/obstacles/1.png').convert_alpha(), (width, height*1.5))]
        self.orientation = ['upwards', 'downwards']
        self.orientation = choice(self.orientation)

        self.image = choice(self.obstacles)
        self.speed = 400

        if self.orientation == 'upwards':
            self.rect = self.image.get_rect(midbottom=(
                randint(WINDOW_WIDTH, WINDOW_WIDTH+200), WINDOW_HEIGHT))
        else:  # downwards
            self.image = pygame.transform.rotate(self.image, angle=180)
            self.rect = self.image.get_rect(midtop=(
                randint(WINDOW_WIDTH, WINDOW_WIDTH+200), 0))

    def movement(self, dt):
        self.rect.x -= self.speed * dt

    def delete_obstacle(self):

        if self.rect.x <= -200:
            self.kill()

    def update(self, dt):
        self.movement(dt)
        self.delete_obstacle()
