prompt = "How old are you?"
prompt += "\nType 'quit' to exit at anytime. "

while True:
    message = input(prompt)
    if message == 'quit':
        break
    
    message = int(message)
    
    if message < 3:
        print("Your movie ticket is free!")
    elif message <= 12:
        print("Your movie ticket is $10.")
    else:
        print("Your movie ticket is $15.")

