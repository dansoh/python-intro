sandwich_orders = ['pb&j', 'pastrami', 'reuben', 'pastrami', 'ham and cheese',
 'turkey', 'pastrami', 'tuna']

print("The deli has run out of pastrami!")

while 'pastrami' in sandwich_orders:
    sandwich_orders.remove('pastrami')

print(sandwich_orders)
