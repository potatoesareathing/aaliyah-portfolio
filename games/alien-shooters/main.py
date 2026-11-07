import asyncio  # WEB: the browser needs the loop to yield every frame
import pygame
import webtimer  # WEB: browser replacement for pygame.time.set_timer
from settings import *
import sys
from obstacle import Block
import obstacle
from player import Player
from alien import Alien
from random import choice, randint, choices
from projectile import Projectile
from pygame.mixer import Sound, music


pygame.init()

# EVENTS
ALIEN_SHOOT_EVENT = pygame.USEREVENT + 1
pygame.time.set_timer(ALIEN_SHOOT_EVENT, 1000)


class Game:
    def __init__(game):

        pygame.display.set_caption('Alien Shooters')
        music.load(r'audio/music.ogg')
        music.play()
        game.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        game.clock = pygame.time.Clock()
        game.player_object1 = Player(coordinates=(
            SCREEN_WIDTH - SCREEN_WIDTH/2, SCREEN_HEIGHT-20))

        game.player_group = pygame.sprite.GroupSingle()
        game.player_group.add(game.player_object1)

        game.block_size = 6
        game.shape = obstacle.shape
        game.block_group = pygame.sprite.Group()
        game.create_multiple_obstacles()
        game.alien_group = pygame.sprite.Group()
        game.create_alien()
        game.aliens = game.alien_group.sprites()
        game.alien_is_moving_right = True
        game.alien_speed = 0.5
        game.alien_move_accumulator = 0.0
        game.alien_projectile_group = pygame.sprite.Group()
        game.font = pygame.font.Font(r'font/Pixeled.ttf', 30)
        game.score = 0
        game.player_lives = 3
        game.status = True
        game.explosion = Sound(r'audio/explosion.ogg')
        game.explosion.set_volume(9.9)
        game.shoot = Sound(r'audio/laser.ogg')

    def create_alien(game):
        for x in range(300, 800, 50):
            for y in range(50, 400, 50):
                game.alien = Alien(choice(['yellow', 'red', 'green']), x, y)
                game.alien_group.add(game.alien)

    def create_obstacle(game, x_start, y_start):
        for row_index, row in enumerate(game.shape):
            for col_index, col in enumerate(row):
                if col == 'x':
                    x = x_start+col_index*game.block_size
                    y = y_start+row_index*game.block_size
                    game.block = Block(
                        game.block_size, color='orange', x=x, y=y)
                    game.block_group.add(game.block)

    def create_multiple_obstacles(game, x_start=40, y_start=480):
        # creates obstacle every 150th position starting from x  = 40, y position remains the same for all, as a result, we've hardcoded y position
        for x_start in range(40, SCREEN_WIDTH, 210):
            game.create_obstacle(x_start, y_start)

    def collide_projectile(game):
        if pygame.sprite.groupcollide(
                game.player_group.sprite.projectile_group, game.alien_group, dokilla=True, dokillb=True):
            game.score += 1
            game.explosion.play()

        if pygame.sprite.groupcollide(
                game.player_group.sprite.projectile_group, game.block_group, dokilla=True, dokillb=True):
            game.explosion.play()
        if pygame.sprite.groupcollide(
                game.player_group.sprite.projectile_group, game.alien_projectile_group, dokilla=True, dokillb=True):
            game.explosion.play()

    def alien_drop(game, distance=10):
        for alien in game.alien_group.sprites():
            alien.rect.y += distance

    def alien_movement(game):
        aliens = game.alien_group.sprites()
        if not aliens:
            return

        direction = 1 if game.alien_is_moving_right else -1

        # rect.x is an integer, so a speed below 1 truncates to 0 every frame.
        # accumulate the fraction and move by whole pixels once it adds up.
        game.alien_move_accumulator += game.alien_speed
        step = int(game.alien_move_accumulator)
        game.alien_move_accumulator -= step

        if step:
            for alien in aliens:
                alien.rect.x += step * direction

        # check the edges once, after the whole formation has moved,
        # otherwise every alien past the edge triggers its own drop
        if game.alien_is_moving_right:
            if max(alien.rect.right for alien in aliens) >= SCREEN_WIDTH:
                game.alien_is_moving_right = False
                game.alien_drop()
        else:
            if min(alien.rect.left for alien in aliens) <= 0:
                game.alien_is_moving_right = True
                game.alien_drop()

    def alien_projectile_add(game):
        # assign this to a variable perhaps later if we need powerups
        chosen_aliens = choices(game.aliens, k=2)
        for chosen_alien in chosen_aliens:
            game.alien_projectile_group.add(Projectile(
                chosen_alien.rect.midbottom, type='alien'))
            game.shoot.play()

    # clears the projectiles of aliens inside their group once the projectile either hits the player, the obstacle, or falls to infinity
    def alien_projectile_delete(game):
        for projectile in game.alien_projectile_group.sprites():
            if projectile.rect.y >= SCREEN_HEIGHT:
                projectile.kill()

        if pygame.sprite.groupcollide(game.alien_projectile_group, game.block_group, dokilla=True, dokillb=True):
            game.explosion.play()

        elif pygame.sprite.groupcollide(game.alien_projectile_group, game.player_group, dokilla=True, dokillb=False):
            game.explosion.play()
            if game.player_lives == 1:

                game.screen.blit(game.lose_surf, game.lose_rect)
                game.status = False

            else:
                game.player_lives -= 1

    def lives_score_and_lose(game):
        game.score_surf = game.font.render(
            f'score: {game.score}', antialias=True, color='gray')

        game.score_rect = game.score_surf.get_rect(center=(150, 30))
        game.player_lives_surf = game.font.render(
            f'lives: {game.player_lives}', antialias=True, color='gray')
        game.player_lives_rect = game.player_lives_surf.get_rect(
            center=(150, 80))
        game.lose_surf = game.font.render(
            f'YOU LOSE: {game.score}', antialias=True, color='white')
        game.lose_rect = game.lose_surf.get_rect(center=(SCREEN_WIDTH/2, 120))

    async def run(game):
        running = True

        while running:
            while game.status is False:

                for event in pygame.event.get():
                    if event.type == pygame.QUIT:
                        pygame.quit()
                        exit()

                    if event.type == pygame.KEYDOWN:
                        if event.key == pygame.K_ESCAPE:
                            game.status = True
                            game.player_group.empty()
                            game.alien_group.empty()
                            game.__init__()

                pygame.display.update()
                await asyncio.sleep(0)

            while game.status:

                game.clock.tick(60)
                game.screen.fill('black')

                game.block_group.draw(game.screen)

                game.alien_group.draw(game.screen)
                game.alien_group.update()
                game.collide_projectile()
                game.alien_movement()
                game.alien_projectile_group.draw(game.screen)
                game.alien_projectile_group.update()
                game.alien_projectile_delete()

                game.player_group.draw(game.screen)
                game.player_group.update()
                game.player_group.sprite.projectile_group.draw(game.screen)

                game.lives_score_and_lose()
                game.screen.blit(game.player_lives_surf,
                                 game.player_lives_rect)
                game.screen.blit(game.score_surf, game.score_rect)

                game.events = pygame.event.get()
                for event in game.events:
                    if event.type == pygame.QUIT:
                        pygame.quit()
                        sys.exit()
                    if event.type == ALIEN_SHOOT_EVENT:
                        game.alien_projectile_add()

                pygame.display.update()
                await asyncio.sleep(0)


if __name__ == '__main__':
    game = Game()
    asyncio.run(game.run())
