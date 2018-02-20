import sys

import pygame

from ball import Ball
from basket import Basket

def check_keydown_events(event, ai_settings, baskets):
    """Respond to keypresses."""
    for basket in baskets:
        if event.key == pygame.K_RIGHT:
            basket.moving_right = True
        elif event.key == pygame.K_LEFT:
            basket.moving_left = True
        elif event.key == pygame.K_q:
            sys.exit()
        
def check_keyup_events(event, baskets):
    """Respond to key releases"""
    for basket in baskets:
        if event.key == pygame.K_RIGHT:
            basket.moving_right = False
        elif event.key == pygame.K_LEFT:
            basket.moving_left = False

def check_events(ai_settings, baskets):
    """Respond to keypresses and mouse events."""
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            sys.exit()
        elif event.type == pygame.KEYDOWN:
            check_keydown_events(event, ai_settings, baskets)
        elif event.type == pygame.KEYUP:
            check_keyup_events(event, baskets)

def update_screen(ai_settings, screen, baskets, balls):
    """Update images on the screen and flip to the new screen."""
    # Redraw the screen during each pass through the loop.
    screen.fill(ai_settings.bg_color)
 
    baskets.draw(screen)
    balls.draw(screen)
        
    # Make the most recently drawn screen visible.
    pygame.display.flip()
    
def create_basket(ai_settings, screen, baskets):
    """ Add basket to group """
    basket = Basket(ai_settings, screen)
    baskets.add(basket)
    
def update_basket(baskets):
    for basket in baskets:
        basket.update()

def create_ball(ai_settings, screen, balls):
    """ Add ball to group"""
    ball = Ball(ai_settings, screen)
    balls.add(ball)

def update_ball(ai_settings, screen, baskets, balls):
    """Update position of ball and get rid of balls off the screen."""
    # Update ball positions.
    balls.update()
    
    # Get rid of balls that have disappeared off the map.
    for ball in balls.copy():
        if ball.rect.top >= 800:
            balls.remove(ball)
            
    check_ball_basket_collisions(ai_settings, screen, baskets,
    balls)

def check_ball_basket_collisions(ai_settings, screen, baskets, 
balls):
    """ Respond to basket-ball collisions. """
     # Remove any ball that have collided.
    collisions = pygame.sprite.groupcollide(balls, baskets, True, False)
    
    if len(balls) == 0:
        # Create a new ball.
        create_ball(ai_settings, screen, balls)
        

