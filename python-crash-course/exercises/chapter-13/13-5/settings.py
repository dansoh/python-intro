class Settings():
    """A class to store all settings for Basket Catch."""
    
    def __init__(self):
        """Initialize the game's settings."""
        # Screen settings
        self.screen_width = 1200
        self.screen_height = 800
        self.bg_color = (230, 230, 230)
        
        # Basket settings
        self.basket_speed_factor = 3
        
        # Ball settings
        self.ball_drop_speed = 2

