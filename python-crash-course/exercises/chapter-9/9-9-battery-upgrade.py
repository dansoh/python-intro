class Car():
    """A simple attempt to represent a car"""
    
    def __init__(self, make, model, year):
        """Initialize attriutes to describe a car."""
        self.make = make
        self.model = model
        self.year = year
        self.odometer_reading = 0
        
    def get_descriptive_name(self):
        """Return a neatly formatted descriptive name."""
        long_name = str(self.year) + ' ' + self.make + ' ' + self.model
        return long_name.title()
    
    def read_odometer(self):
        """Print a statement showing the car's mileage."""
        print("This car has " + str(self.odometer_reading) + 
            " miles on it.")
            
    def update_odometer(self, mileage):
        """
        Set the odometer reading to the given value.
        Reject the change if it attempts to roll the odometer back.
        """
        if mileage >= self.odometer_reading:
            self.odometer_reading = mileage
        else:
            print("You can't roll back an odometer!")
    
    def increment_odometer(self, miles):
        """Add the given amount to the odometer reading."""
        self.odometer_reading += miles
    
    def fill_gas_tank(self):
        """Fill the Gas Tank the given amount)"""
        print("Filling up gas tank for " + self.get_descriptive_name() + ".")
        
class Battery():
        """A simple attempt to model a battery for an electric car."""
        
        def __init__(self, battery_size=70):
            """Initialize the battery's attributets."""
            self.battery_size = battery_size
            
        def describe_battery(self):
            """Print a statement describing the battery size."""
            print("This car has a " + str(self.battery_size) + "-kWh battery.")
        
        def get_range(self):
            """Print a statement about the range this battery provides."""
            if self.battery_size == 70:
                range = 240
            elif self.battery_size == 85:
                range = 270
            message = "This car can go approximately " + str(range)
            message += " miles on a full charge."
            print(message)
    
        def update_battery(self):
            """Update battery size to 85-Kwh battery"""
            if self.battery_size != 85:
                self.battery_size = 85
    
class ElectricCar(Car):
    """Represents aspects of a car, specific to electric vehicles."""
    def __init__(self, make, model, year):
        """
        Initialize attributes of the parent class.
        Then initialize attributes specific to an electric car.
        """
        super().__init__(make, model, year)
        self.battery = Battery()
    
    def fill_gas_tank(self):
        """Prompt message when trying to fill up gas tank of electric car"""
        print("The " + self.get_descriptive_name() + " doesn't have a gas tank!")
        
volt = ElectricCar('chevrolet', 'volt', '2015')
volt.battery.describe_battery()
volt.battery.get_range()
volt.battery.update_battery()
volt.battery.describe_battery()
volt.battery.get_range()