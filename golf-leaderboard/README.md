# Golf Tournament Live Leaderboard

A Masters-inspired live leaderboard for a friendly golf tournament. Players join
from their phones, post scores hole by hole, and every open leaderboard updates
instantly.

Zero dependencies: just Python 3.8+ and the standard library.

## Run it

```bash
cd golf-leaderboard
GOLF_ADMIN_PIN=4321 python3 server.py
```

Open http://localhost:8000. If you skip `GOLF_ADMIN_PIN`, a PIN is generated
and printed in the console.

Settings (environment variables):

| Variable         | Default   | Purpose                                  |
| ---------------- | --------- | ---------------------------------------- |
| `PORT`           | `8000`    | Port to listen on                        |
| `HOST`           | `0.0.0.0` | Interface to bind                        |
| `GOLF_ADMIN_PIN` | generated | PIN for the Admin page                   |
| `GOLF_DATA_DIR`  | `./data`  | Where `tournament.json` is saved         |

## Getting everyone on it

The server has to be reachable from players' phones:

- **Same Wi-Fi** (clubhouse): run it on a laptop and share `http://<laptop-ip>:8000`.
- **Out on the course** (cell data): expose the laptop with a tunnel such as
  `cloudflared tunnel --url http://localhost:8000` or `ngrok http 8000`, and share
  the https URL it prints.
- **Hosted**: deploy to any Python host (Render, Railway, Fly.io, a VPS). Start
  command `python3 server.py`; the server reads `PORT` from the environment. Use a
  persistent disk for `GOLF_DATA_DIR` if the host wipes files on restart.

### Fly.io (golf.dohduo.gg)

`fly.toml` and `Dockerfile` are included. From this directory:

```bash
fly launch --copy-config --no-deploy        # first time; pick a new app name if dohduo-golf is taken
fly volumes create golf_data --size 1 --region iad   # same region as primary_region in fly.toml
fly secrets set GOLF_ADMIN_PIN=4321
fly deploy --ha=false                       # one machine: scores live in that server
fly certs add golf.dohduo.gg                # prints the DNS records to create
```

Then add the DNS record `fly certs add` shows (usually a CNAME from `golf` to
`<app>.fly.dev`). If the domain is on Cloudflare, leave the record DNS-only
(grey cloud) until the certificate is issued. Check with `fly certs show golf.dohduo.gg`.

The Admin page shows a QR code for the site. Print it or put it on the first tee.

## Features

- **Leaderboard**: positions with ties (T2), to-par in Masters red and green,
  hole-by-hole scores with circles for birdies and squares for bogeys, Out/In
  totals, movement arrows, rows that flash when a score comes in, tap any player
  for a full scorecard. Gross and net views when the host turns on handicap
  scoring (off by default, so stray handicaps are ignored).
- **Highlights**: current leader, players on course, field birdie count, and the
  hole playing toughest.
- **Live feed**: "Jordan birdied No. 7" as it happens.
- **My Round**: big thumb-friendly score entry with + / - and one-tap
  birdie/par/bogey buttons, optional putts, handicap stroke hints per hole,
  running position and to-par. A scorekeeper can add up to 4 players on one
  phone and switch between them; only that phone can post those players' scores.
- **Clubhouse TV mode** (`#/tv`): full-screen board for a TV, pages through
  large fields automatically, with a join QR code.
- **Any length of round**: 9, 18, 27 or 36 holes, set in Admin > Course. For a
  9-hole course played several times, enter the 9 pars once and use "Same 9
  holes each loop" to copy them to every nine.
- **Admin**: add, edit and remove players, fix any score in a spreadsheet-style
  grid, set pars and stroke index, rename the event, lock the board when play
  is over, copy a "phone link" that lets a new device score for a player, and
  reset between rounds.

## How it works

- `server.py` serves the app from `static/`, keeps state in memory, saves it to
  `data/tournament.json` after every change, and streams each new state to
  browsers with Server-Sent Events (`/api/stream`). Browsers fall back to polling
  if the stream drops.
- Each player gets a private token when they join; only that device (or the
  admin) can post their scores.
- Handicap strokes are allocated by stroke index, so net scores are correct
  mid-round, not just at the finish.
