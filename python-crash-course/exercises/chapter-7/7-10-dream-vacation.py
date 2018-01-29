poll = {}



poll_active = True

while poll_active:
    user = input("\nWhat is your name? ")
    destination = input("\nIf you could visit one place in the world, where would you go? ")

    poll[user] = destination
    
    repeat = input("Would anyone else like to take the poll? (yes/no) ")
    if repeat == 'no':
        poll_active = False
    
print("\n --- Poll Results ---")
for user, destination in poll.items():
    print(user.title() + " would like to go to " + destination.title() + ".")
