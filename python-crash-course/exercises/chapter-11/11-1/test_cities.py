import unittest
from city_functions import format_city

class CityCountryTestCase(unittest.TestCase):
    """Tests for city_functions.py"""
    
    def test_format_city_country(self):
        """Do cities like Arlington, Texas work"""
        formatted_city = format_city('Arlington', 'Texas')
        self.assertEqual(formatted_city, 'Arlington, Texas')

unittest.main()
