# fb-marketplace-monitor

Polls Facebook Marketplace searches and pushes a notification (via [ntfy.sh](https://ntfy.sh/)) for every new listing.

## How it works

- A persistent Playwright Chromium session reuses a real login captured once in `login.py`. No scripted FB login — those trip anti-bot every time.
- Each search URL in `searches.yaml` is opened headless. Listings are extracted by matching anchor hrefs against `/marketplace/item/{id}/` rather than CSS classes (FB's classes rotate).
- IDs are kept in `seen.json`. New ID → push notification → record.
- First run records what's currently visible without notifying (so you don't get a flood).

## Setup

```bash
cd fb-marketplace-monitor
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

Pick a random, hard-to-guess ntfy topic name. ntfy is public-by-obscurity: anyone who knows the topic can read your notifications.

```bash
cp .env.example .env
# edit .env and set NTFY_TOPIC=<your-random-topic>
```

Install the ntfy app on your phone and subscribe to that topic.

Log into Facebook once (use a burner account):

```bash
python login.py
```

A browser window opens — log in normally, then return to the terminal and press Enter. This writes `storage_state.json`.

Edit `searches.yaml` with the searches you want to watch. Always include `sortBy=creation_time_descend` in the URL so newest listings come first. Useful query params: `query`, `minPrice`, `maxPrice`, `radius`, `daysSinceListed`.

Run it:

```bash
python monitor.py
```

## Cron

Run every 15 minutes:

```cron
*/15 * * * * cd /path/to/fb-marketplace-monitor && /path/to/fb-marketplace-monitor/.venv/bin/python monitor.py >> monitor.log 2>&1
```

## Files

| File | Purpose | Committed? |
|---|---|---|
| `monitor.py` | Main script | yes |
| `login.py` | One-time session capture | yes |
| `searches.yaml` | Search URLs | yes |
| `requirements.txt` | Python deps | yes |
| `.env.example` | Template for `.env` | yes |
| `.env` | `NTFY_TOPIC=...` | **no** (gitignored) |
| `storage_state.json` | FB session cookies | **no** (gitignored) |
| `seen.json` | Set of listing IDs already notified | **no** (gitignored) |

## Notes

- If Facebook logs you out, run `login.py` again to refresh `storage_state.json`.
- The tap-to-open behavior on notifications is wired via ntfy's `Click` header pointing at the listing URL.
- Selectors are deliberately minimal (just the href pattern). If FB changes the URL scheme this script breaks; if they just shuffle CSS classes again, it keeps working.
