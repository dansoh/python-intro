toppings = "What toppings would you like on your pizza?"
toppings += "\nPress 'quit' to exit. "

while True:
    message = input(toppings)
    
    if message == 'quit':
        break
    else:
        print(message.title() + " added!")



