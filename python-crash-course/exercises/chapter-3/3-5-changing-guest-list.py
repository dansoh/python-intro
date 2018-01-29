guests = ['tom', 'fred', 'abe']

print(guests)

guests[1] = 'frank'

message = "Welcome " + guests[1].title() + "!"

print(message)

message = "We found a bigger dinner table. I will invite 3 more guests"

guests.insert(3, 'joe')
guests.insert(2, 'eddy')
guests.append('harry')

print(guests)
