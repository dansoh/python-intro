favorite_numbers = {
	'daniel' : [28, 69],
	'anthony' : [4, 14, 25],
	'alex' : [9, 24, 35],
	}

for name, numbers in favorite_numbers.items():
	print("\n" + name.title() + "'s favorite number is:")
	for number in numbers:
		print("\t" + str(number))
	
