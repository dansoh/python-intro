sandwich_orders = ['pb&j', 'reuben', 'ham and cheese', 'turkey', 'tuna']
finished_sandwiches = []

while sandwich_orders:
    order = sandwich_orders.pop()
    
    print("I made your " + order.title() + " sandwich")
    finished_sandwiches.append(order)

print("\nThe following sandwiches are now complete: ")
for finished in finished_sandwiches:
    print(finished.title())

