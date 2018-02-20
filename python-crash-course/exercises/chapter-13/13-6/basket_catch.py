import pygame
from pygame.sprite import Group

from settings import Settings
from game_stats import GameStats
from basket import Basket
import game_functions as gf

def run_game():
    # Initialize game and create a screen object.
    pygame.init()
    ai_settings = Settings()
    screen = pygame.display.set_mode(
        (ai_settings.screen_width, ai_settings.screen_height))
    pygame.display.set_caption("Basket Catch")
    
    # Create an instance to store game statistics.
    stats = GameStats(ai_settings)
    
    # Make a basket and a ball groups and create them
    
    baskets = Group()
    balls = Group()

    gf.create_basket(ai_settings, screen, baskets)
    gf.create_ball(ai_settings, screen, balls)
    
    # Start the main loop for the game
    while True:
        gf.check_events(ai_settings, baskets)
        if stats.game_active:
            gf.update_basket(baskets)
            gf.update_ball(ai_settings, screen, stats, baskets, balls)
        gf.update_screen(ai_settings, screen, baskets, balls)   
             
run_game()
