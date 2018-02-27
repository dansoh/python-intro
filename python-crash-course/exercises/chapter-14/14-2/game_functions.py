import sys
from time import sleep

import pygame

from bullet import Bullet
from rectangle import Rectangle

def check_keydown_events(event, ai_settings, screen, stats, ship, rectangle, bullets):
    """Respond to keypresses."""
    if event.key == pygame.K_DOWN:
        ship.moving_down = True
    elif event.key == pygame.K_UP:
        ship.moving_up = True
    elif event.key == pygame.K_SPACE:
        fire_bullet(ai_settings, screen, ship, bullets)
    elif event.key == pygame.K_q:
        sys.exit()
    elif event.key == pygame.K_p:
        start_game(ai_settings, screen, stats, ship, rectangle, bullets)

def check_keyup_events(event, ship):
    """Respond to key releases"""
    if event.key == pygame.K_DOWN:
        ship.moving_down = False
    elif event.key == pygame.K_UP:
        ship.moving_up = False

def check_events(ai_settings, screen, stats, play_button, ship, rectangle, 
    bullets):
    """Respond to keypresses and mouse events."""
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            sys.exit()
        elif event.type == pygame.MOUSEBUTTONDOWN:
            mouse_x, mouse_y = pygame.mouse.get_pos()
            check_play_button(ai_settings, screen, stats, play_button, 
            ship, rectangle, bullets, mouse_x, mouse_y)
        elif event.type == pygame.KEYDOWN:
            check_keydown_events(event, ai_settings, screen, stats, ship, rectangle, bullets)
        elif event.type == pygame.KEYUP:
            check_keyup_events(event, ship)
            
def update_screen(ai_settings, screen, stats, ship, rectangle, bullets, play_button):
    """Update images on the screen and flip to the new screen."""
    # Redraw the screen during each pass through the loop.
    screen.fill(ai_settings.bg_color)
    
    # Redraw all bullets behind ship and rectangle
    for bullet in bullets.sprites():
        bullet.draw_bullet()
    
    ship.blitme()
    rectangle.blitme()
        
    # Draw the play button if the game is inactive.
    if not stats.game_active:
        play_button.draw_button()
    
    # Make the most recently drawn screen visible.
    pygame.display.flip()
    
def start_game(ai_settings, screen, stats, ship, rectangle, bullets):
    # Hide the mouse cursor.
        pygame.mouse.set_visible(False)
        # Reset the game statistics
        stats.reset_stats()
        stats.game_active = True
        
        # Empty the list of bullets
        bullets.empty()
            
def check_play_button(ai_settings, screen, stats, play_button, ship,
    rectangle, bullets, mouse_x, mouse_y):
    """Start a new game when a player hits Play."""
    button_clicked = play_button.rect.collidepoint(mouse_x, mouse_y)
    if button_clicked and not stats.game_active:
        start_game(ai_settings, screen, stats, ship, rectangle, bullets)

def fire_bullet(ai_settings, screen, ship, bullets):
    """ Fire a bullet if limit not reached yet."""
    # Create a new bullet and add it to the bullets group.
    if len(bullets) < ai_settings.bullets_allowed:
            new_bullet = Bullet(ai_settings, screen, ship)
            bullets.add(new_bullet)

def update_bullets(stats, bullets):
    """Update position of bullets and get rid of old bullets."""
    # Update bullet positions.
    bullets.update()
    
    # Get rid of bullets that have disappeared.
    for bullet in bullets.copy():
        if bullet.rect.right >= 1200:
            missed_shot(stats)
            bullets.remove(bullet)
            
def missed_shot(stats):
    """ Respond to shot being missed. """
    if stats.missed_shots < 3:
        # Decrement missed_shots.
        stats.missed_shots += 1
        
    else:
        stats.game_active = False
        pygame.mouse.set_visible(True)

            
def update_rectangle(ai_settings, stats, rectangle, bullets):
    """
    Check if the rectangle is at an edge,
    and then update its position.
    """
    check_rectangle_edge(ai_settings, rectangle)
    rectangle.update()
    
    # Look for bullets hitting the rectangle
    pygame.sprite.spritecollide(rectangle, bullets, True)

def check_rectangle_edge(ai_settings, rectangle):
        """Respond appropriately if the rectangle has reached an edge."""
        if rectangle.check_edges():
            change_rectangle_direction(ai_settings, rectangle)
            
def change_rectangle_direction(ai_settings, rectangle):
    """Change the rectangle's direction."""
    ai_settings.rectangle_direction *= -1

