from user import User
from admin import Admin

superuser = Admin('daniel', 'oh', 25, 'male', 'texas')
superuser.privileges.show_privileges()
