import asyncio  # WEB: the browser needs the loop to yield every frame
import pygame
import webtimer  # WEB: browser replacement for pygame.time.set_timer
from pygame.image import load
from pygame.display import update
from pygame.mixer import Sound
from pygame.font import Font
from pygame.transform import rotozoom, scale
from pygame.sprite import GroupSingle, Group
from sys import exit
from random import randint


# one object for one static text and one animated for better results (so its not too quick), otherwise create multiple objects for the animations so attributes arent shared resulting in crazy fast texts
class TextAnimations:
    SCALE = 0
    IS_SCALING = 'expand'

    def __init__(self):
        self.scale = TextAnimations.SCALE
        self.is_scaling = TextAnimations.IS_SCALING

    def popping(self, text: str, coordinates, color=(224, 176, 255), animate=False, size=1):
        text_surf = text_font.render(
            text, antialias=False, color=color, bgcolor=None)

        if animate:
            if self.is_scaling == 'expand':
                self.scale += 0.015
                if self.scale >= 0.8:
                    self.is_scaling = 'shrink'

            elif self.is_scaling == 'shrink':

                self.scale -= 0.015
                if self.scale <= 0.6:
                    self.is_scaling = 'expand'

            text_surf = rotozoom(text_surf, 0, self.scale)
            text_rect = text_surf.get_rect(center=coordinates)
        else:
            text_surf = rotozoom(text_surf, 0, scale=size)
            text_rect = text_surf.get_rect(center=coordinates)

        screen.blit(text_surf, text_rect)


text_animations = TextAnimations()


class Player(pygame.sprite.Sprite):

    def __init__(self):
        super().__init__()

        player_walk1_surf = load(
            'graphics/Player/player_walk_1.png').convert_alpha()
        player_walk2_surf = load(
            'graphics/Player/player_walk_2.png').convert_alpha()
        self.player_walk = [player_walk1_surf, player_walk2_surf]
        self.image = self.player_walk[0]
        self.rect = self.image.get_rect(midbottom=(50, 300))
        self.gravity = 0
        self.counter = 0

    # this function resets the gravity to -20, so that the player can jump the second time, third time.. etc
    def player_input(self):
        keys = pygame.key.get_pressed()
        # WEB: a tap or click also jumps, so the game works on phones
        if (keys[pygame.K_SPACE] or pygame.mouse.get_pressed()[0]) and self.rect.bottom == 300:
            self.gravity = -20

    # this function always moves the player towards the ground without falling below it
    def player_falling(self):
        if self.rect.bottom <= 300:
            self.gravity += 1
            self.rect.y += self.gravity
            if self.rect.bottom > 300:
                self.rect.bottom = 300

    # self.counter is a counter variable that moves between 1 and 10 to switch the surface loaded for the player.
    def player_animation(self):
        self.counter += 1
        if self.counter > 10:
            self.counter = 0
        if self.counter in range(0, 5):
            self.image = self.player_walk[0]
        elif self.counter in range(5, 10):
            self.image = self.player_walk[1]

    # def player_animation(self):
    #     # player animation logic, and convert everything to oop

    def update(self):
        self.player_falling()
        self.player_input()
        self.player_animation()


class Obstacle(pygame.sprite.Sprite):
    def __init__(self, type):
        super().__init__()

        self.counter = 0

        if type == "fly":
            image1_surf = load('graphics/Fly/Fly1.png')
            image2_surf = load('graphics/Fly/Fly2.png')
            self.images = [image1_surf, image2_surf]

            self.image = self.images[0]
            self.rect = self.image.get_rect(midbottom=(
                randint(900, 1200), randint(210, 220)))

        elif type == "snail":
            image1_surf = load('graphics/snail/snail1.png')
            image2_surf = load('graphics/snail/snail2.png')
            self.images = [image1_surf, image2_surf]

            self.image = self.images[0]
            self.rect = self.image.get_rect(
                midbottom=(randint(900, 1200), 300))

    def obstacle_animation(self):
        self.counter += 1
        if self.counter > 10:
            self.counter = 0
        if self.counter in range(0, 5):
            self.image = self.images[0]
        elif self.counter in range(5, 10):
            self.image = self.images[1]

    def obstacle_movement(self):
        self.rect.x -= 5

    def delete_obstacle(self):
        if self.rect.x == -100:
            self.kill()

    def update(self):
        self.obstacle_animation()
        self.obstacle_movement()
        self.delete_obstacle()


class Background(pygame.sprite.Sprite):

    def __init__(self, background):
        super().__init__()

        if background == 'sky':
            self.image = load('graphics/Sky/sky00.png').convert_alpha()
            self.image = scale(self.image, (800, 300))
            self.rect = self.image.get_rect(topleft=(0, 0))
            self.images = [scale(load('graphics/Sky/sky00.png').convert_alpha(), (800, 300)),
                           scale(
                               load('graphics/Sky/sky01.png').convert_alpha(), (800, 300)),
                           scale(
                               load('graphics/Sky/sky02.png').convert_alpha(), (800, 300)),
                           scale(
                               load('graphics/Sky/sky03.png').convert_alpha(), (800, 300)),
                           scale(
                               load('graphics/Sky/sky04.png').convert_alpha(), (800, 300)),
                           scale(
                               load('graphics/Sky/sky05.png').convert_alpha(), (800, 300)),
                           scale(
                               load('graphics/Sky/sky06.png').convert_alpha(), (800, 300)),
                           scale(
                               load('graphics/Sky/sky07.png').convert_alpha(), (800, 300)),
                           scale(
                               load('graphics/Sky/sky08.png').convert_alpha(), (800, 300)),
                           scale(
                               load('graphics/Sky/sky09.png').convert_alpha(), (800, 300)),
                           scale(load('graphics/Sky/sky10.png').convert_alpha(), (800, 300))]

        elif background == 'ground':
            self.image = load('graphics/ground/ground0.png').convert_alpha()
            self.rect = self.image.get_rect(topleft=(0, 300))
            self.images = [load('graphics/ground/ground0.png').convert_alpha(),
                           load('graphics/ground/ground1.png').convert_alpha(),
                           load('graphics/ground/ground2.png').convert_alpha(),
                           load('graphics/ground/ground3.png').convert_alpha(),
                           load('graphics/ground/ground4.png').convert_alpha()
                           ]

        self.counter = 0

    def animate_background(self):
        self.counter += 1
        if self.counter > len(self.images)-1:
            self.counter = 0

        self.image = self.images[self.counter]

    def update(self):
        self.animate_background()


pygame.init()
clock = pygame.Clock()

# DISPLAY
screen = pygame.display.set_mode((800, 400))
caption = pygame.display.set_caption('Pixel Runner')

# MUSIC
pygame.mixer.music.load('audio/music.ogg')
pygame.mixer.music.set_volume(0.01)
pygame.mixer.music.play(loops=-1)


player = Player()
player_group = GroupSingle()
player_group.add(player)

obstacle_group = Group()

background_group = Group()
sky = Background('sky')
ground = Background('ground')
background_group.add(sky, ground)

# TEXT
text_font = Font('font/Pixeltype.ttf', size=50)
# WEB: fonts and images used every frame are loaded once here
big_font = Font(filename='font/Pixeltype.ttf', size=80)
player_zoomed_surf = rotozoom(load('graphics/Player/player_stand.png'), 0, 2)
game_time = 0

# VARIABLES/CONSTANTS
game_status = True
start_time = 0
pause_start_time = 0
pause_duration_time = 0

# EVENT
OBSTACLE_SPAWN = pygame.USEREVENT + 1
pygame.time.set_timer(OBSTACLE_SPAWN, 2500)


ANIMATE_BACKGROUND = pygame.USEREVENT + 2
pygame.time.set_timer(ANIMATE_BACKGROUND, 50)


def collision_sprite():
    if pygame.sprite.spritecollide(player_group.sprite, obstacle_group, False):
        return False
    else:
        return True


def display_score():
    if pause_duration_time:
        game_time = pygame.time.get_ticks() - pause_duration_time
    else:
        game_time = pygame.time.get_ticks() - start_time
    time_surf = text_font.render(
        f'{int(game_time/1000)}', antialias=True, color='Black', bgcolor=None, wraplength=0)
    time_rect = time_surf.get_rect(midbottom=(400, 50))
    screen.blit(time_surf, time_rect)
    return game_time


def sound_button():
    button = Sound(r'audio/button.ogg')
    button.set_volume(0.2)
    button.play()



async def main():
    global game_status, start_time, pause_start_time, pause_duration_time, game_time
    while True:
        clock.tick(60)

        if game_status == "Pause":
            screen.fill((20, 70, 120))
            if not pause_start_time:
                pause_start_time = game_time

            player_zoomed_rect = player_zoomed_surf.get_rect(center=(400, 200))
            screen.blit(player_zoomed_surf, player_zoomed_rect)

            text_animations.popping('Press any Button to Start!',
                                    color=(224, 176, 255), coordinates=(400, 350), animate=True)

            text_animations.popping('Pixel Runner', color='White',
                                    coordinates=(410, 80), animate=False)

            for event in pygame.event.get():
                if event.type in (pygame.KEYDOWN, pygame.MOUSEBUTTONDOWN):
                    game_status = True

                    pause_end_time = pygame.time.get_ticks()

                    pause_duration_time = pause_end_time - pause_start_time
                    pause_start_time = 0
                    Sound('audio/exit_pause.ogg').play()

                if event.type == pygame.QUIT:
                    pygame.quit()
                    exit()

            update()

        elif game_status is False:
            pause_duration_time = 0
            start_time = pygame.time.get_ticks()

            screen.fill((20, 70, 120))
            message_surf = big_font.render(
                'Game Over!', antialias=True, color='Black', bgcolor='White', wraplength=0)
            message_rect = message_surf.get_rect(midtop=(400, 50))

            restart_surf = text_font.render(
                'restart', antialias=True, color='Black', bgcolor='White', wraplength=0)
            restart_rect = restart_surf.get_rect(
                midtop=(message_rect.midbottom[0], message_rect.midbottom[1]+50))

            quit_surf = text_font.render(
                'quit', antialias=True, color='Black', bgcolor='White', wraplength=0)
            quit_rect = quit_surf.get_rect(
                midtop=(message_rect.midbottom[0], message_rect.midbottom[1]+100))

            score_surf = text_font.render(
                f'Score:{int(game_time/1000)}', antialias=True, color='Black', bgcolor='White', wraplength=0)
            score_rect = score_surf.get_rect(
                midtop=(message_rect.midbottom[0], message_rect.midbottom[1]+150))

            screen.blit(message_surf, message_rect)
            screen.blit(restart_surf, restart_rect)
            screen.blit(quit_surf, quit_rect)
            screen.blit(score_surf, score_rect)
            update()

            for event in pygame.event.get():

                if event.type == pygame.QUIT:
                    pygame.quit()
                    exit()

                if event.type == pygame.MOUSEBUTTONDOWN and restart_rect.collidepoint(pygame.mouse.get_pos()):

                    sound_button()
                    start_time = pygame.time.get_ticks()

                    game_status = True
                    obstacle_group.empty()

                if event.type == pygame.MOUSEBUTTONDOWN and quit_rect.collidepoint(pygame.mouse.get_pos()):

                    sound_button()
                    # WEB: quitting would kill the page, so quit returns to the title screen
                    game_status = "Pause"
                    pause_start_time = 0
                    obstacle_group.empty()

        elif game_status is True:

            # screen.blit(sky_surf, sky_rect)
            # screen.blit(ground_surf, ground_rect)

            background_group.draw(screen)

            player_group.draw(screen)
            game_status = player_group.update()

            obstacle_group.draw(screen)
            obstacle_group.update()

            game_time = display_score()
            game_status = collision_sprite()
            update()

            for event in pygame.event.get():

                if event.type == pygame.QUIT:
                    pygame.quit()
                    exit()

                if event.type == ANIMATE_BACKGROUND:
                    background_group.update()

                if event.type == OBSTACLE_SPAWN:
                    if randint(0, 2):
                        obstacle_group.add(Obstacle(type="fly"))
                    else:
                        obstacle_group.add(Obstacle(type="snail"))

                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        game_status = "Pause"

        await asyncio.sleep(0)


asyncio.run(main())
