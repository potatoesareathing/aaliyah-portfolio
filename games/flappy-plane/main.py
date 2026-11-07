import asyncio  # WEB: the browser needs the loop to yield every frame
import pygame
import webtimer  # WEB: browser replacement for pygame.time.set_timer
from settings import *
import time
import sys
from pygame.image import load
from sprites import BG, Ground, Plane, Obstacle


class Game:
    def __init__(self):
        # setup
        pygame.init()

        pygame.mixer.music.load(r'sounds/music.ogg')
        pygame.mixer.music.play(loops=-1)

        self.display_surface = pygame.display.set_mode(
            (WINDOW_WIDTH, WINDOW_HEIGHT))
        pygame.display.set_caption('Flappy Plane')
        self.clock = pygame.time.Clock()
        # WEB: load the font once instead of every frame
        self.text_font = pygame.font.Font(
            r'graphics/font/BD_Cartoon_Shout.ttf', 50)
        self.reset()

    def reset(self):
        # WEB: a crash restarts the run, because quitting would kill the page
        self.start_ticks = pygame.time.get_ticks()
        self.sprites_group = pygame.sprite.Group()  # for animations and movement
        # for collision with obstacle_group
        self.player_group = pygame.sprite.GroupSingle()
        self.obstacle_group = pygame.sprite.Group()  # for collision with player_group
        BG(self.sprites_group)
        Ground(self.sprites_group, self.obstacle_group)
        self.plane = Plane(self.sprites_group, self.player_group)

        # events
        self.CREATE_OBSTACLE_EVENT = pygame.USEREVENT+1
        pygame.time.set_timer(self.CREATE_OBSTACLE_EVENT, 1000)

    def all_collisions(self):
        if pygame.sprite.groupcollide(self.player_group, self.obstacle_group, dokilla=False, dokillb=False, collided=pygame.sprite.collide_mask):
            self.reset()

    def speed_up_game(self):
        if self.time > 10:
            for obstacle in self.obstacle_group.sprites():
                obstacle.speed = 50

    async def run(self):
        last_time = time.time()
        while True:
            self.clock.tick(60)
            self.time = int((pygame.time.get_ticks() - self.start_ticks)/1000)
            self.score_surf = self.text_font.render(
                f'{self.time}', antialias=True, color='brown', bgcolor=None)
            self.score_rect = self.score_surf.get_rect(topleft=(50, 5))
            self.speed_up_game()

            # delta time
            dt = time.time() - last_time
            last_time = time.time()
            self.sprites_group.draw(self.display_surface)
            self.display_surface.blit(self.score_surf, self.score_rect)

            self.sprites_group.update(dt=dt)
            self.all_collisions()

            # event loop
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    pygame.quit()
                    sys.exit()

                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_SPACE:
                        self.plane.apply_gravity(dt)

                # WEB: a tap or click flies too, so the game works on phones
                if event.type == pygame.MOUSEBUTTONDOWN:
                    self.plane.apply_gravity(dt)

                if event.type == self.CREATE_OBSTACLE_EVENT:
                    Obstacle(self.sprites_group, self.obstacle_group)

            # game logic
            pygame.display.update()
            self.clock.tick(FRAMERATE)
            await asyncio.sleep(0)


if __name__ == '__main__':
    game = Game()
    asyncio.run(game.run())
