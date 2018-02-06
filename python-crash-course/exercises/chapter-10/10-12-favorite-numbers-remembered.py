import json

def number_check():
	"""Check if favorite number already exists."""
	filename = 'favorite_number.json'
	try:
		with open(filename) as f_obj:
			favorite_number = json.load(f_obj)
	except FileNotFoundError:
		return None
	else:
		return favorite_number
		
def record_number():
	"""Prompt for favorite number and record it."""
	favorite_number = input("What's your favorite number? ")
	filename = 'favorite_number.json'
	with open(filename, 'w') as f_obj:
		json.dump(favorite_number, f_obj)
		return favorite_number

def favorite_number():
	favorite_number = number_check()
	if favorite_number:
		print("Your favorite number is " + favorite_number + ".")
	else:
		favorite_number = record_number()
		print("Favorite number recorded!")
		
favorite_number()
