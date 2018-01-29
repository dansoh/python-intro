guests = input("How many people are in your dinner group? ")

guests = int(guests)

if guests > 8:
    print("You'll have to wait for a table.")
else:
    print("Your table is ready now")
