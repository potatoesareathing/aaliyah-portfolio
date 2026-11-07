import pygame


class Block(pygame.sprite.Sprite):
    def __init__(block, size, color, x, y):
        super().__init__()
        block.image = pygame.Surface((size, size))
        block.image.fill(color)
        block.rect = block.image.get_rect(topleft=(x, y))


shape = [
    '  xxxxxxxx  ',
    ' xxxxxxxxxx ',
    'xxxxxxxxxxxx',
    'xxxxxxxxxxxx',
    'xxxxxxxxxxxx',
    'xxx      xxx',
    'xx        xx'
]
