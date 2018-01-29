cities = {
	'paris': {
		'country': 'france',
		'population': "2.2 million",
		'fact': 'Paris was originially a Roman City called Lutetia',
		},
	'london': {
		'country': 'united kingdom',
		'population': '8.7 million',
		'fact': 'The tallest building in London is the Shard London Bridge',
		},
	'seoul': {
		'country': 'republic of korea',
		'population': '9.8 million',
		'fact': 'Seoul is the best city on Earth',
		},
	}

for city, data in cities.items():
	print("\nCity: " + city.title())
	country = data['country']
	population = data['population']
	fact = data['fact']
	
	print("\t" + country.title())
	print("\t" + population.title())
	print("\t" + fact)
