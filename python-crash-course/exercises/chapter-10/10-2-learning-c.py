filename = 'learning_python.txt'

with open(filename) as file_object:
    lines = file_object.readlines()

string = ''

for line in lines:
    line = line.replace('Python', 'C')
    string += line

print(string)
