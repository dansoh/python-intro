// 2.3s clip of the table with the gold highlight wiping across 5-7%.
// Renders every frame deterministically, then encodes with alpha intact.
//   npm i playwright && node animate.js && ./encode-highlight.sh
const { chromium } = require('playwright');
const fs = require('fs');

const FPS = 60;         // frame rate
const DUR = 2.3;        // clip length, seconds
const START = 0.9;      // when the highlight lands
const SWEEP = 0.38;     // how long the gold takes to wipe across
const OUT = __dirname + '/frames';

// Before START the number is plain white like the other rows; the chip is in the
// DOM the whole time (so nothing reflows) but invisible until the wipe reaches it.
const PATCH = `
  .chip{background-color:transparent;background-image:none;border-color:transparent}
  .num{
    -webkit-background-clip:text;background-clip:text;
    -webkit-text-fill-color:transparent;color:transparent;
    background-repeat:no-repeat;
  }
`;

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT);

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 3, viewport: { width: 1100, height: 600 } });
  await page.goto('file://' + __dirname + '/seller-fees-table.html');
  await page.evaluate(() => (document.body.className = 'solid'));
  await page.addStyleTag({ content: PATCH });

  // wrap the number so the gold can wipe across the glyphs themselves
  await page.evaluate(() => {
    const chip = document.querySelector('.chip');
    chip.innerHTML = `<span class="num">${chip.textContent}</span>`;
  });
  await page.evaluate(() => document.fonts.ready);

  await page.evaluate(([START, SWEEP]) => {
    const chip = document.querySelector('.chip');
    const num = chip.querySelector('.num');
    const PAD = 22;                                    // chip's left padding
    const W = chip.getBoundingClientRect().width;
    window.setT = t => {
      const raw = (t - START) / SWEEP;
      const p = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      const e = 1 - Math.pow(1 - p, 3);                // easeOutCubic
      const x = e * W;                                 // wipe front, px from the chip's left edge
      chip.style.backgroundImage =
        `linear-gradient(90deg, rgba(201,162,78,.13) 0 ${x}px, rgba(201,162,78,0) ${x}px)`;
      chip.style.borderColor = `rgba(201,162,78,${(0.45 * e).toFixed(4)})`;
      num.style.backgroundImage =
        `linear-gradient(90deg, #C9A24E 0 ${x - PAD}px, #FFFFFF ${x - PAD}px)`;
    };
  }, [START, SWEEP]);

  const el = await page.$('#table');
  const total = Math.round(DUR * FPS);
  for (let i = 0; i < total; i++) {
    await page.evaluate(t => window.setT(t), i / FPS);
    await el.screenshot({ path: `${OUT}/f${String(i).padStart(4, '0')}.png`, omitBackground: true });
  }
  console.log('frames:', total);
  await browser.close();
})();
