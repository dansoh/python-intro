
"""
Prompt for two numbers, add them together, and print the result
"""

print("Provide two numerical values and I'll print the sum.")
print("(enter q to exit)")
while True:
	try:
		number1 = input("Value 1: ")
		if number1 == 'q':
			break
		number2 = input("Value 2: ")
		if number1 == 'q':
			break
		result = int(number1) + int(number2)
		print("Sum: " + str(result))
	except ValueError:
		print("Please only enter numerical values!")
