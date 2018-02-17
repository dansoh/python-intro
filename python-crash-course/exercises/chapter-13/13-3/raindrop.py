import pygame
from pygame.sprite import Sprite

class Raindrop(Sprite):
    """A class to represent a single raindrop in the grid."""
    
    def __init__(self, ai_settings, screen):
        """Initialize the raindrop and set its starting position."""
        super(Raindrop, self).__init__()
        self.screen = screen
        self.ai_settings = ai_settings
        
        # Load the raindrop image and set its rect attribute
        self.image = pygame.image.load('images/raindrop.bmp')
        self.rect = self.image.get_rect()
        
        # Start each new raindrop near the top left of the screne.
        self.rect.x = self.rect.width
        self.rect.y = self.rect.height
        
        # Store each raindrop's exact positon
        self.x = float(self.rect.x)
        
    def blitme(self):
        """Draw the raindrop at its current location."""
        self.screen.blit(self.image, self.rect)
