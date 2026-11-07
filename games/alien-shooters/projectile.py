import pygame
from settings import *
from random import randint


class Projectile(pygame.sprite.Sprite):

    def __init__(projectile, pos, type):

        super().__init__()
        projectile.type = type
        projectile.image = pygame.Surface((3, 15))
        if projectile.type == 'player':
            projectile.image.fill('white')
        else:
            projectile.image.fill('purple')
        projectile.rect = projectile.image.get_rect(midbottom=pos)

    def player_projectile_movement(projectile):
        if projectile.type == 'player':
            projectile.rect.y -= 7

    def alien_projectile_movement(projectile):
        if projectile.type == 'alien':
            projectile.rect.y += 7

    def update(projectile):
        projectile.player_projectile_movement()
        projectile.alien_projectile_movement()
