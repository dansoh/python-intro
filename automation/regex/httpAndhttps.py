#! python3
# httpAndhttps.py - Finds http and https URLs on the clipboard

import pyperclip, re

# Protocol regex.

protocolRegex = re.compile(r'''(
    (http://|https://)      # http or https protocol
    [a-zA-Z0-9._-]+         # rest of the url
    )''', re.VERBOSE)
    
# Find matches in clipboard text.

text = str(pyperclip.paste())
matches = []
for groups in protocolRegex.findall(text):
    matches.append(groups[0])

# Copy results to clipboard.

if len(matches) > 0:
    pyperclip.copy('\n'.join(matches))
    print('Copied to clipboard:')
    print('\n'.join(matches))
else:
    print('No website URLs found that begin with http:// or https://')
