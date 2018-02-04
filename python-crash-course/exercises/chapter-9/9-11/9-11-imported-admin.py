from user import User, Privileges, Admin

superuser = Admin('Daniel', 'Oh', 25, 'male', 'texas')
superuser.describe_user()
superuser.privileges.show_privileges()

