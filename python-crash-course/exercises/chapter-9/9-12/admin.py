"""A set of classes that is used to represent an Admin user"""

from user import User

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
