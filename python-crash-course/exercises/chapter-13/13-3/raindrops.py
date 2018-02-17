import pygame
from pygame.sprite import Group

from settings import Settings
import game_functions as gf

def run_game():
    # Initialize game and create screen object.
    pygame.init()
    ai_settings = Settings()
    screen = pygame.display.set_mode(
        (ai_settings.screen_width, ai_settings.screen_height))
    pygame.display.set_caption("Raindrop")
    
    # Make a group of raindrops
    raindrops = Group()
    
    # Create the grid of raindrops
    gf.create_grid(ai_settings, screen, raindrops)
    
    # Start the main loop for the program
    
    while True:
        gf.check_events(ai_settings, screen)
        gf.remove_raindrops(ai_settings, raindrops)
        gf.falling_raindrops(ai_settings, raindrops)
        gf.update_screen(ai_settings, screen, raindrops)

run_game()

