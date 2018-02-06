import json

def get_stored_username():
    """Get stored username if available."""
    filename = 'username.json'
    try:
        with open(filename) as f_obj:
            username = json.load(f_obj)
    except FileNotFoundError:
        return None
    else:
        return username

def get_new_username():
    """Prompt for new username."""
    username = input("What's your name? ")
    filename = 'username.json'
    with open(filename, 'w') as f_obj:
        json.dump(username, f_obj)
        return username

def greet_user():
    """Greet user by name."""
    username = get_stored_username()
    if username:
        user_check = input("Are you " + username + "? (y/n) ")
        if user_check == 'y':
            print("Welcome back, " + username + "!")
        elif user_check == 'n':
            username = get_new_username()
            print("We'll remember you when you come back, " + username + "!")
        else:
            print("Please enter either 'y' or 'n' ")
            greet_user()
    else:
        username = get_new_username()
        print("We'll remember you when you come back, " + username + "!")

greet_user()
