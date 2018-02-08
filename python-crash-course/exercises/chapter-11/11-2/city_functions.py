def format_city(city, country, population = ''):
    """Generate formatted City, Country string"""
    if population:
        formatted_name = city + ", " + country + " - population " + population
    else:
        formatted_name = city + ", " + country
    return formatted_name    
