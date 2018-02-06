def add_numbers():
	"""
	Prompt for two numbers, add them together, and print the result
	"""
	print("Provide two numerical values and I'll print the sum.")
	print("enter q to exit")
	try:
		number1 = input("Value 1: ")
		number2 = input("Value 2: ")
		result = int(number1) + int(number2)
		print("Sum: " + str(result))
	except ValueError:
		print("Please only enter numerical values!")

add_numbers()
