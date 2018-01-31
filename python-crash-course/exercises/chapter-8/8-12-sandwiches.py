def sandwich_order(*ingredients):
    for ingredient in ingredients:
        print("Adding " + ingredient + " to your order.")
    print("\n")

sandwich_order('bologna', 'american cheese', 'wheat bread')

sandwich_order('ham', 'lettuce', 'mayo', 'tomato', 'onion', 'white bread')

sandwich_order('turkey', 'roast beef', 'swiss cheese', 'honey bread')
