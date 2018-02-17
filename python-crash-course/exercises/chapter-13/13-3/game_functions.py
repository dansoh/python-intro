import sys

import pygame

from raindrop import Raindrop

def check_events(ai_settings, screen):
    """Respond to keypresses and mouse events."""
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            sys.exit()

def update_screen(ai_settings, screen, raindrops):
    """Update images on the screen and flip to the new screen."""
    # Redraw the screen during each pass through the loop.
    screen.fill(ai_settings.bg_color)
    
    raindrops.draw(screen)
    
    # Make the most recently drawn screen visible
    pygame.display.flip()
    
def get_number_raindrops_x(ai_settings, raindrop_width):
    """Determine the number of raindrops that can fit in a row."""
    available_space_x = ai_settings.screen_width - 2 * raindrop_width
    number_raindrops_x = int(available_space_x / (2 * raindrop_width))
    return number_raindrops_x
    
def get_number_rows(ai_settings, raindrop_height):
    """Determine the number of raindrops that can fit on the screen."""
    available_space_y = ai_settings.screen_height -2 * raindrop_height
    number_rows = int(available_space_y / (2 * raindrop_height))
    return number_rows

def create_raindrop(ai_settings, screen, raindrops, raindrop_number, row_number):
    """Create a raindrop and place it in the row."""
    raindrop = Raindrop(ai_settings, screen)
    raindrop_width = raindrop.rect.width
    raindrop.x = raindrop_width + 2 * raindrop_width * raindrop_number
    raindrop.rect.x = raindrop.x
    raindrop.rect.y = raindrop.rect.height + 2 * raindrop.rect.height * row_number
    raindrops.add(raindrop)

def remove_raindrops(ai_settings, raindrops):
     for raindrop in raindrops.copy():
        if raindrop.rect.top >= ai_settings.screen_height:
            raindrops.remove(raindrop)

def create_grid(ai_settings, screen, raindrops):
    """Create the full grid of raindrops,"""
    # Create a raindrop and find the number of raindrops in a row
    # Spacing between each raindrop is equal to one raindrop width
    raindrop = Raindrop(ai_settings, screen)
    number_raindrops_x = get_number_raindrops_x(
        ai_settings, raindrop.rect.width)
    number_rows = get_number_rows(ai_settings, raindrop.rect.height)
    
    # Create the grid of raindrops
    for row_number in range(number_rows):
        for raindrop_number in range(number_raindrops_x):
            create_raindrop(ai_settings, screen, raindrops, raindrop_number, row_number)

def falling_raindrops(ai_settings, raindrops):
    """Drop the raindrops down the screen."""
    for raindrop in raindrops.sprites():
        raindrop.rect.y += ai_settings.raindrop_drop_speed
    
   


    
