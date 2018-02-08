class Employee():
    """Initializes an Employee object"""
    def __init__(self, first, last, salary):
        """Store employee details"""
        self.first = first
        self.last = last
        self.salary = salary
        
    def give_raise(self, salary_raise = 5000):
        self.salary += salary_raise
        return self.salary

