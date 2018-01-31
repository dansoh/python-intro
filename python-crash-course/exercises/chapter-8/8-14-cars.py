def car_info(manufacturer, model, **car_details):
    car = {}
    car['manufacturer']= manufacturer
    car['model']= model
    for key, value in car_details.items():
        car[key]= value
    return car
    
daniel_car = car_info('audi', 's4', color='black', transmission='manual')

print(daniel_car)
