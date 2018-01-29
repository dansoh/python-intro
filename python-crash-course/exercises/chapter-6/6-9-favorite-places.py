favorite_places = {
	'david' : ['paris'],
	'anthony' : ['korea', 'japan', 'hamland'],
	'pedro' : ['china', 'jamaica', 'russia'],
	}

for name, places in favorite_places.items():
	print("\n" + name.title() + "'s favorite places are") 
	for place in places:
		print("\t" + place.title())



