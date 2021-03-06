import pygame
from pygame.sprite import Group

from settings import Settings
from game_stats import GameStats
from ship import Ship
from rectangle import Rectangle
from button import Button
import game_functions as gf

def run_game():
    # Initialize game and create a screen object.
    pygame.init()
    ai_settings = Settings()
    screen = pygame.display.set_mode(
        (ai_settings.screen_width, ai_settings.screen_height))
    pygame.display.set_caption("Target Practice")
    
    # Make the Play button
    play_button = Button(ai_settings, screen, "Play")
    
    # Create an instance to store game statistics.
    stats = GameStats(ai_settings)
    
    # Make a ship, a group of bullets, and a rectangle object
    ship = Ship(ai_settings, screen)
    bullets = Group()
    rectangle = Rectangle(ai_settings, screen)
    
    # Start the main loop for the game
    while True:
        gf.check_events(ai_settings, screen, stats, play_button, ship,
        rectangle, bullets)
        if stats.game_active:
            ship.update()
            gf.update_bullets(stats, bullets)
            gf.update_rectangle(ai_settings, stats, rectangle, bullets)
        gf.update_screen(ai_settings, screen, stats, ship, rectangle, 
            bullets, play_button)
        
run_game()
