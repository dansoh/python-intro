def read_file(filename):
	"""
	Read file and print contents
	"""
	try:
		with open(filename) as f_obj:
			contents = f_obj.read()
	except FileNotFoundError:
		pass
	else:
		# Print file output
		print(contents)

filenames = ['cats.txt', 'dogs.txt']

for filename in filenames:
	read_file(filename)


