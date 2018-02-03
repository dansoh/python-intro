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

class Privileges():
    """
    A separate class for different user privileges
    """
    def __init__(self):
        """Initialize privilege atributes"""
        self.privileges = ['can add post', 'can delete post'
            , 'can ban user']
            
    def show_privileges(self):
        """
        Show the list of privileges a user has
        """
        print('The user has the following privileges: ')
        for privilege in self.privileges:
            print('\t' + str(privilege))

class Admin(User):
    """Represents an Admin, a subset of User"""
    def __init__(self, first_name, last_name, age, gender, location):
        """
        Initialize attributes of the parent class. 
        Then initalize attributes of an Admin user
        """
        super().__init__(first_name, last_name, age, gender, location)
        self.privileges = Privileges()

superuser = Admin('Dennis', 'Sheck', 42, 'male', 'California')
superuser.describe_user()
superuser.privileges.show_privileges()
