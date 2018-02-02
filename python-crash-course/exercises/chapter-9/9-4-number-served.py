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
            self.cuisine_type.title() + " food")
    
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

restaurant = Restaurant('olive garden', 'italian')

print(restaurant.restaurant_name)
print(restaurant.number_served)

restaurant.set_number_served(20)
print(restaurant.number_served)

restaurant.increment_number_served(520)
print(restaurant.number_served)


