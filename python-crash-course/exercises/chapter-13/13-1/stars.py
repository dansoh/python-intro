import pygame
from pygame.sprite import Group

from settings import Settings
import game_functions as gf

def run_game():
    # Initialize game and create a screen object.
    pygame.init()
    ai_settings = Settings()
    screen = pygame.display.set_mode(
        (ai_settings.screen_width, ai_settings.screen_height))
    pygame.display.set_caption("Star Grid")
    
    # Make a group of stars
    stars = Group()
    
    # Create the fleet of aliens
    gf.create_stars(ai_settings, screen, stars)
    
    # Start the main loop for the game
    while True:
        gf.check_events(ai_settings, screen)
        gf.update_screen(ai_settings, screen, stars)   
        
run_game()

