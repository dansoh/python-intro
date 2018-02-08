import unittest

from employee import Employee

class TestEmployee(unittest.TestCase):
    """Create an employee to use for all test methods"""
    
    def setUp(self):
        """Initialize an employee"""
        self.daniel = Employee('daniel', 'miller', 300000)
        
    def test_give_default_raise(self):
        """Test default raise amount"""
        salary = self.daniel.give_raise()
        self.assertEqual(salary, 305000)
    
    def test_give_custom_raise(self):
        """Test custom raise amount"""
        salary = self.daniel.give_raise(50000)
        self.assertEqual(salary, 350000)

unittest.main()
