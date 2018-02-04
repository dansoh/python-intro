from collections import OrderedDict

"""Create an ordered dictionary."""
glossary = OrderedDict()

glossary['loop'] = 'repeat'
glossary['index'] = 'location'
glossary['string'] = 'characters'
glossary['dictionary'] = 'key, value pair'

for key, value in glossary.items():
    print(key.title() + ": " + value.title())
