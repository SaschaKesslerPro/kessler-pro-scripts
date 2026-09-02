/* SVG-Dateien mit Chromium rendern: node tools/svg_nach_png.js <dir> [breite_px] */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const dir = process.argv[2], W = +(process.argv[3] || 1800);
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: W, height: Math.round(W * 210 / 297) } });
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(dir, f), 'utf8');
    await pg.setContent(`<html><body style="margin:0;background:#888"><div style="width:${W}px">${svg.replace(/width="[^"]*mm" height="[^"]*mm"/, `width="${W}" height="${Math.round(W * 210 / 297)}"`)}</div></body></html>`);
    await pg.screenshot({ path: path.join(dir, f.replace(/\.svg$/, '.png')), fullPage: false });
    console.log('ok', f);
  }
  await b.close();
})();
