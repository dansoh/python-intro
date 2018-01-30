def city_country(city, country):
    formatted = city + ", " + country.title()
    return formatted.title()

location = city_country('santiago', 'chile')
print(location)

location = city_country('lima', 'peru')
print(location)

location = city_country('rio', 'brazil')
print(location)
