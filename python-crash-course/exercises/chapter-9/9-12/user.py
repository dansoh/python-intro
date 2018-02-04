class User():
    """
    A simple attempt to model a User
    """
    
    def __init__(self, first_name, last_name, age, gender, location):
        """
        Initialize first name, last name, age, gender and location
        for user
        """
        
        self.first_name = first_name
        self.last_name = last_name
        self.age = age
        self.gender = gender
        self.location = location
        
    def describe_user(self):
        """ Prints a summary of the user profile """
        print("Name: " + self.first_name.title() + " "
            + self.last_name.title())
        print("Age: " + str(self.age))
        print("Gender: " + self.gender.title())
        print("Location: " + self.location.title())
    
    def greet_user(self):
        """Prints a personalized greeting to user"""
        print("Hello " + self.first_name.title() + " " +
            self.last_name.title() + ". I hope "
            + self.location.title() + " is treating you well.")
