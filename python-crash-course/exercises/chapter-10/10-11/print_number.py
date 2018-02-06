import json

filename = 'favorite_number.txt'

with open(filename) as f_obj:
	result = json.load(f_obj)

print("I know your favorite number! It's " + result + ".")
