current_users = ['dsoh', 'ysoh', 'apaek', 'jkim', 'amun']
new_users = ['epark', 'skwon', 'asohn', 'dsoh', 'ysoh']

for new_user in new_users:
    if new_user in current_users:
        print(new_user + " is taken. Please enter a new username.")
    else:
        print(new_user + " is available!")


