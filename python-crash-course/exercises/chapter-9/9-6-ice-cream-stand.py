class Restaurant():
    """A simple attempt to model a restaurant"""
    
    def __init__(self, restaurant_name, cuisine_type):
        """Initialize restaurant name and cuisine type attributes"""
        
        self.restaurant_name = restaurant_name
        self.cuisine_type = cuisine_type
        self.number_served = 0
    
    def describe_restaurant(self):
        """
        Describe the name of the restaurant and what kind of cuisine
        it serves.
        """
        print(self.restaurant_name.title() + " serves " + 
            self.cuisine_type.title() + ".")
    
    def open_restaurant(self):
        """
        Display a message stating that the restaurant is open.
        """
        print("The " + self.restaurant_name.title() + " is open!")
    
    def set_number_served(self, number_served):
        """
        Set the number of customers served.
        """
        if number_served >= 0:
            self.number_served = number_served
        else:
            print("Must be a value greater than 0.")
            
    def increment_number_served(self, number_served):
        """
        Increment the number of customers served.
        """
        if number_served >= 0:
            self.number_served += number_served
        else:
            print("Must be a value greater than 0.")
        
class IceCreamStand(Restaurant):
    """Represents an ice cream stand, a subset of restaurant"""
    def __init__(self, restaurant_name, cuisine_type):
        """
        Initialize attributes of the parent class.
        Then initialize attributes of an Ice Cream Stand
        Set 3 default flavors in a list
        """
        super().__init__(restaurant_name, cuisine_type)
        self.flavors = []
                    
    def display_flavors(self):
        """Display the flavors offered by the restaurant."""
        print(self.restaurant_name.title() + " serves: ")
        for flavor in self.flavors:
            print("\t-" + flavor.title())

ben_and_jerrys = IceCreamStand('ben and jerrys', 'dessert')
ben_and_jerrys.flavors = ['chocolate', 'vanilla', 'strawberry']
ben_and_jerrys.display_flavors()

        
    
    
    
