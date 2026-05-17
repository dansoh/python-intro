"""One-time setup: open a headed browser, let the user log into Facebook,
then save the session to storage_state.json for monitor.py to reuse.

Run this once (and again whenever Facebook logs you out)."""

import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

STORAGE_STATE = Path(__file__).parent / "storage_state.json"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto("https://www.facebook.com/login")

        print()
        print("A browser window has opened.")
        print("Log into Facebook (use a burner account).")
        print("Once you can see your news feed, come back here and press Enter.")
        print()
        input("Press Enter when you are logged in... ")

        await context.storage_state(path=str(STORAGE_STATE))
        print(f"Saved session to {STORAGE_STATE}")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
