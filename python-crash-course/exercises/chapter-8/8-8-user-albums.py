def make_album(artist_name, album_title, track_count=''):
    album_details = {'artist_name' : artist_name, 'album_title': album_title}
    if track_count:
        album_details['track_count'] = track_count
    return album_details
    
while True:
    print("\nEnter album information: ")
    print("(press 'q' to quit at anytime.)")

    artist = input("\nArtist: ")
    if artist == 'q':
        break
    album = input("Album: ")
    if album == 'q':
        break
    
    music = make_album(artist, album)
    print(music)

