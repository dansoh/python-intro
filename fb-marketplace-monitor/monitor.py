"""Poll Facebook Marketplace searches and push a notification for each new listing.

Architecture:
  - Persistent Playwright session loaded from storage_state.json (see login.py).
  - Listings extracted by matching anchor hrefs against /marketplace/item/{id}/,
    NOT by CSS classes (FB's classes are auto-generated and rotate).
  - State = a JSON file of seen listing IDs. New ID -> notify, then record.
  - First run records what's currently visible but does not notify, to avoid
    flooding with hundreds of "new" items.
"""

import asyncio
import json
import os
import re
import sys
from pathlib import Path

import httpx
import yaml
from dotenv import load_dotenv
from playwright.async_api import async_playwright, BrowserContext

SCRIPT_DIR = Path(__file__).parent
STORAGE_STATE = SCRIPT_DIR / "storage_state.json"
SEEN_FILE = SCRIPT_DIR / "seen.json"
SEARCHES_FILE = SCRIPT_DIR / "searches.yaml"

LISTING_ID_RE = re.compile(r"/marketplace/item/(\d+)")
PRICE_RE = re.compile(r"(?:\$|€|£|¥|kr|CA\$|A\$)\s?[\d.,]+|\bfree\b", re.IGNORECASE)

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def load_seen() -> tuple[set[str], bool]:
    """Return (seen_ids, is_first_run)."""
    if SEEN_FILE.exists():
        return set(json.loads(SEEN_FILE.read_text())), False
    return set(), True


def save_seen(seen: set[str]) -> None:
    SEEN_FILE.write_text(json.dumps(sorted(seen)))


def load_searches() -> list[dict]:
    data = yaml.safe_load(SEARCHES_FILE.read_text())
    if not data:
        raise SystemExit(f"{SEARCHES_FILE} is empty")
    return data


async def scrape_search(context: BrowserContext, url: str) -> list[dict]:
    """Open a search URL, scroll once, return one dict per unique listing."""
    page = await context.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        await page.wait_for_timeout(3_000)
        await page.evaluate("window.scrollBy(0, document.body.scrollHeight)")
        await page.wait_for_timeout(1_500)

        anchors = await page.query_selector_all('a[href*="/marketplace/item/"]')
        listings: dict[str, dict] = {}
        for a in anchors:
            href = await a.get_attribute("href") or ""
            m = LISTING_ID_RE.search(href)
            if not m:
                continue
            listing_id = m.group(1)
            if listing_id in listings:
                continue
            text = (await a.inner_text()).strip()
            listings[listing_id] = {
                "id": listing_id,
                "url": f"https://www.facebook.com/marketplace/item/{listing_id}/",
                "raw_text": text,
            }
        return list(listings.values())
    finally:
        await page.close()


def parse_listing(raw: dict) -> dict:
    """Pull price, title, and location out of the card's text content."""
    lines = [line.strip() for line in raw["raw_text"].split("\n") if line.strip()]

    price = None
    title = None
    location = None
    for line in lines:
        if price is None and PRICE_RE.search(line):
            price = line
        elif title is None:
            title = line
        elif location is None:
            location = line
            break

    return {
        "id": raw["id"],
        "url": raw["url"],
        "price": price or "?",
        "title": title or (lines[0] if lines else "(no title)"),
        "location": location or "",
    }


async def notify(client: httpx.AsyncClient, topic: str, listing: dict, search_name: str) -> None:
    title = f"[{search_name}] {listing['price']} — {listing['title']}"[:250]
    body_parts = []
    if listing["location"]:
        body_parts.append(listing["location"])
    body_parts.append(listing["url"])
    body = "\n".join(body_parts)

    resp = await client.post(
        f"https://ntfy.sh/{topic}",
        content=body.encode("utf-8"),
        headers={
            "Title": title.encode("utf-8"),
            "Click": listing["url"],
            "Tags": "shopping_cart",
        },
        timeout=10.0,
    )
    resp.raise_for_status()


async def main() -> None:
    load_dotenv(SCRIPT_DIR / ".env")
    topic = os.environ.get("NTFY_TOPIC")
    if not topic:
        sys.exit("NTFY_TOPIC not set; copy .env.example to .env and edit it")
    if not STORAGE_STATE.exists():
        sys.exit(f"No session at {STORAGE_STATE}. Run `python login.py` first.")

    searches = load_searches()
    seen, is_first_run = load_seen()
    if is_first_run:
        print("First run: recording current listings without notifying.")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            storage_state=str(STORAGE_STATE),
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 900},
        )
        try:
            async with httpx.AsyncClient() as http:
                for search in searches:
                    name = search.get("name") or search["url"]
                    try:
                        raws = await scrape_search(context, search["url"])
                    except Exception as exc:
                        print(f"[{name}] scrape failed: {exc}")
                        continue

                    new_ids = [r for r in raws if r["id"] not in seen]
                    print(f"[{name}] found {len(raws)} listings, {len(new_ids)} new")

                    for raw in new_ids:
                        seen.add(raw["id"])
                        if is_first_run:
                            continue
                        listing = parse_listing(raw)
                        try:
                            await notify(http, topic, listing, name)
                            print(f"  notified: {listing['price']} {listing['title']}")
                        except Exception as exc:
                            print(f"  notify failed for {listing['id']}: {exc}")
        finally:
            await context.close()
            await browser.close()
            save_seen(seen)


if __name__ == "__main__":
    asyncio.run(main())
