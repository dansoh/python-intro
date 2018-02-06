def count_word(filename, word):
	"""Count how many times a word appears in a file"""
	try:
		with open(filename) as f_obj:
			result = f_obj.read()
	except FileNotFoundError:
		print(filename + " not found!")
	else:
		count = result.lower().count(word)
		print("There are " + str(count) + " occurences of the word "
			+ "\"" + word + "\" in " + filename + ".")
	
count_word('memorie.txt', 'the')
count_word('littlewomen.txt', 'the')
count_word('beyond_good_and_evil.txt', 'the')
