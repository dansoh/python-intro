import json

number = input("What's your favorite number? ")

filename = 'favorite_number.txt'

with open(filename, 'w') as f_obj:
	json.dump(number, f_obj)
