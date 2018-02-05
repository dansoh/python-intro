filename = 'learning_python.txt'

with open('learning_python.txt') as file_object:
    contents = file_object.read()
    print(contents)

with open(filename) as file_object:
    for line in file_object:
        print(line.strip())

with open(filename) as file_object:
    lines = file_object.readlines()

string = ''

for line in lines:
    string += line.rstrip()

print(string)
