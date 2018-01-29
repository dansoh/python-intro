guests = ['tom', 'fred', 'abe']

print(guests)

guests[1] = 'frank'

message = "Welcome " + guests[1].title() + "!"

print(message)

message = "We found a bigger dinner table. I will invite 3 more guests"

print(message)

guests.insert(3, 'joe')
guests.insert(2, 'eddy')
guests.append('harry')

print(guests)

message = "Welcome " + guests[-1].title() + ", come to dinner!"
print(message)

message = "Actually, we have to remove people because we got too many heads"
print(message)

removed = guests.pop(0)

message = "Sorry " + removed.title() + ", you got cut. Next time."

print(message)

removed = guests.pop(0)

message = "Sorry " + removed.title() + ", you got cut. Next time."

print(message)

removed = guests.pop(0)

message = "Sorry " + removed.title() + ", you got cut. Next time."

print(message)

removed = guests.pop(0)

message = "Sorry " + removed.title() + ", you got cut. Next time."

print(message)

print(guests)

message = "Hello " + guests[0].title() + " and " + guests[1].title() + ", you guys are the last ones remaining."

print(message)

del guests[0]
del guests[0]

print(guests)

len(guests)

