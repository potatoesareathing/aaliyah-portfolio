import pygame
from settings import *
from pygame.image import load
from os.path import join
from pygame.mixer import Sound
from projectile import Projectile


class Player(pygame.sprite.Sprite):

    def __init__(player, coordinates):
        super().__init__()
        player.image = load(join('graphics', 'player.png'))
        player.rect = player.image.get_rect(midbottom=coordinates)
        player.speed = 7
        # refers to the group tied to one Player object
        player.projectile_group = pygame.sprite.Group()
        player.must_shoot = True
        player.projectile_limit = 20
        player.projectile_counter = 0
        # WEB: load the laser sound once; loading it every frame stutters in the browser
        player.laser = Sound('audio/laser.ogg')

    def input(player):
        # movement
        keys = pygame.key.get_pressed()
        if keys[pygame.K_RIGHT]:
            player.rect.x += player.speed

        if keys[pygame.K_LEFT]:
            player.rect.x -= player.speed

        # WEB: touch / mouse control for phones. Hold a finger down and the
        # ship slides toward it and keeps firing.
        touching = pygame.mouse.get_pressed()[0]
        if touching:
            target_x = pygame.mouse.get_pos()[0]
            if target_x > player.rect.centerx + player.speed:
                player.rect.x += player.speed
            elif target_x < player.rect.centerx - player.speed:
                player.rect.x -= player.speed
        # restrictions
        if player.rect.x >= SCREEN_WIDTH-60:
            player.rect.x = SCREEN_WIDTH-60

        if player.rect.x <= 0:
            player.rect.x = 0
        # shoot
        if keys[pygame.K_SPACE] or touching:
            player.shoot()

    def shoot(player):
        if player.must_shoot is True:
            player.projectile_group.add(Projectile(
                pos=player.rect.center, type='player'))
            player.laser.play()

            player.must_shoot = False

    def projectile_time(player):
        if player.projectile_counter < player.projectile_limit:
            player.projectile_counter += 1
        else:
            player.projectile_counter = 0
            player.must_shoot = True

    def continuous_movement(player):
        player.projectile_group.update()

    def delete_projectile(player):
        for projectile in player.projectile_group.sprites():
            if projectile.rect.y <= 0:
                projectile.kill()

    def update(player):
        player.input()
        player.projectile_time()
        player.continuous_movement()
        player.delete_projectile()
