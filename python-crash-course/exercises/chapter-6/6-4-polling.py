favorite_languages = {
	'jen': 'python',
	'sarah': 'c',
	'edward': 'ruby',
	'phil': 'python',
	}
	
friends = ['jordan', 'sarah', 'edward', 'henry', 'derek', 'phil']

for friend in friends:
	if friend in favorite_languages:
		print("Thanks " + friend.title() + " for taking the poll!")
	else:
		print(friend.title() + ",please take the poll.")


