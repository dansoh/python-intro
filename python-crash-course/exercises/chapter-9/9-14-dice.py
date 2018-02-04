from random import randint

class Die():
    """Initalize Die object with a sides attribute"""
    def __init__(self, sides=6):
        self.sides = sides
    
    def roll_die(self):
        """Roll the die and print the result."""
        print(str(randint(1, self.sides)))
        
die1 = Die()
print("6-sided Die: ")
for i in range(1,10):
    die1.roll_die()

die2 = Die(10)
print("10-sided Die: ")
for i in range(1,10):
    die2.roll_die()

die3 = Die(20)
print("20-sided Die: ")
for i in range(1,10):
    die3.roll_die()

