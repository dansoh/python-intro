class Restaurant():
    """A simple attempt to model a restaurant"""
    
    def __init__(self, restaurant_name, cuisine_type):
        """Initialize restaurant name and cuisine type attributes"""
        
        self.restaurant_name = restaurant_name
        self.cuisine_type = cuisine_type
    
    def describe_restaurant(self):
        """
        Describe the name of the restaurant and what kind of cuisine
        it serves.
        """
        print(self.restaurant_name.title() + " serves " + 
            self.cuisine_type.title() + " food")
    
    def open_restaurant(self):
        """
        Display a message stating that the restaurant is open.
        """
        print("The " + self.restaurant_name.title() + " is open!")
    

my_favorite = Restaurant('olive garden', 'italian')

stacey_favorite = Restaurant('mcdonalds', 'american')

jenny_favorite= Restaurant('china garden', 'chinese')

my_favorite.describe_restaurant()

stacey_favorite.describe_restaurant()

jenny_favorite.describe_restaurant()
