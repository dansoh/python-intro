prompt = "How old are you?"
prompt += "\nType 'quit' to exit at anytime. "

active = True

while active:
    message = input(prompt)
    
    if message == 'quit':
        active = False
    
    else:
        message = int(message)
    
        if message < 3:
            print("Your movie ticket is free!")
        elif message <= 12:
            print("Your movie ticket is $10.")
        else:
            print("Your movie ticket is $15.")


