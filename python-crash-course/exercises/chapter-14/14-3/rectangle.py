import pygame

class Rectangle():
    def __init__(self, ai_settings, screen):
        """Initialize the rectangle and set its starting position."""
        self.screen = screen
        self.ai_settings = ai_settings
        
        # Load the rectangle image and get its rect.
        self.image = pygame.image.load('images/rectangle.bmp')
        self.rect = self.image.get_rect()
        self.screen_rect = screen.get_rect()
        
        # Start each rectange at the center right of the screen.
        self.rect.centery = self.screen_rect.centery
        self.rect.right = self.screen_rect.right
    
        # Store a decimal value for the rectangle's center
        #self.center = float(self.rect.centery)
        
        # Store the rectangle's exact position
        self.y = float(self.rect.y)
    
    def check_edges(self):
        """Return True if Rectangle is at edge of screen"""
        screen_rect = self.screen.get_rect()
        if self.rect.bottom >= screen_rect.bottom:
            return True
        elif self.rect.top <= 0:
            return True
        
    def update(self):
        """Move the rectangle up or down."""
        self.y += (self.ai_settings.rectangle_speed_factor *
            self.ai_settings.rectangle_direction)
        self.rect.y = self.y
        
    def blitme(self):
        """Draw the rectangle at its current location."""
        self.screen.blit(self.image, self.rect)
