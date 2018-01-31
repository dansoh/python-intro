def make_great(original, changed):
    while original:
        transform = original.pop() + " the Great"
        changed.append(transform)

def show_magicians(changed):
    print("\n")
    for change in changed:
        print(change.title())
    
original = ['gary', 'ben', 'harry']
changed = []

make_great(original[:], changed)
show_magicians(original)

show_magicians(changed)


