// Re-render the overlay PNGs from seller-fees-table.html
//   npm i playwright  (or use a global install)
//   node render.js
const { chromium } = require('playwright');

const VARIANTS = { clear: 'transparent', solid: 'dark', glass: 'glass' };
const SCALE = 3; // 1200px CSS width -> 3600px PNG

(async () => {
  const browser = await chromium.launch();
  for (const [cls, name] of Object.entries(VARIANTS)) {
    const page = await browser.newPage({ deviceScaleFactor: SCALE, viewport: { width: 1400, height: 600 } });
    await page.goto('file://' + __dirname + '/seller-fees-table.html');
    await page.evaluate(c => (document.body.className = c), cls);
    await page.evaluate(() => document.fonts.ready);
    await (await page.$('#table')).screenshot({
      path: `${__dirname}/seller-fees-${name}.png`,
      omitBackground: true, // keeps the alpha channel for the transparent/glass cuts
    });
    await page.close();
  }
  await browser.close();
})();
