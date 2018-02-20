import pygame
from pygame.sprite import Sprite
from random import randint

class Ball(Sprite):
    def __init__(self, ai_settings, screen):
        """Initialize the ball and set its starting position."""
        super(Ball, self).__init__()
        
        self.screen = screen
        self.ai_settings = ai_settings
        
        # Load the ship image and get its rect.
        self.image = pygame.image.load('images/ball.bmp')
        self.rect = self.image.get_rect()
        self.screen_rect = screen.get_rect()
        
        # Start each new ball at a random position at the top of the screen.
        
        self.rect.centerx = randint(0, 1200)
        self.rect.top = self.screen_rect.top
    
        # Store a decimal value for the ball's center
        #self.center = float(self.rect.centerx)
        self.y = float(self.rect.y)
        
        self.drop_speed = ai_settings.ball_drop_speed
        
    def blitme(self):
        """Draw the ball at its current location."""
        self.screen.blit(self.image, self.rect)
        
    def update(self):
        """Move the ball down the screen."""
        # Update the decimal position of the ball.
        self.y += self.drop_speed
        # Update the rect position.
        self.rect.y = self.y
    
