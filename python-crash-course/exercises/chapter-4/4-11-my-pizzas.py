pizzas = ['cheese', 'pepperoni', 'sausage', 'mushroom']
friend_pizzas = pizzas[:]

pizzas.append('pineapple')
friend_pizzas.append('tuna')

print("My favorite pizzas are: ")
for pizza in pizzas:
	print(pizza)
	
print("My friend' favorite pizzas are: ")
for fpizza in friend_pizzas:
	print(fpizza)
	
