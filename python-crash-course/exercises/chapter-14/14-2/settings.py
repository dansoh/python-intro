class Settings():
    """A class to store all settings for Alien Invasion."""
    
    def __init__(self):
        """Initialize the game's settings."""
        # Screen settings
        self.screen_width = 1200
        self.screen_height = 800
        self.bg_color = (230, 230, 230)
        
        # Ship settings
        self.ship_speed_factor = 1.5
        
        # Bullet settings
        self.bullet_speed_factor = 3
        self.bullet_width = 15
        self.bullet_height = 3
        self.bullet_color = 60, 60, 60
        self.bullets_allowed = 3
        self.missed_shots = 0
        
        # Alien settings
        self.rectangle_speed_factor = 1
        # rectangle_direction of 1 represents down; -1 represents up
        self.rectangle_direction = 1
