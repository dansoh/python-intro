def make_album(artist_name, album_title, track_count=''):
    album_details = {'artist_name' : artist_name, 'album_title': album_title}
    if track_count:
        album_details['track_count'] = track_count
    return album_details
    
album1 = make_album('pink floyd', 'the wall', '7')
album2 = make_album('michael jackson', 'thriller')
album3 = make_album('fleetwood mac', 'rumors')

print(album1)
print(album2)
print(album3)
