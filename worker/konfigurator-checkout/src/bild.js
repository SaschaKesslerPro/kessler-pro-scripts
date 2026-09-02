/* SVG -> PNG im Worker (resvg als WebAssembly). Wird nur auf Abruf geladen —
   fuer das Zeichnungsbild in der Kundenmail (/z/<token>/<...>-zeichnung.png).
   Schriften: DejaVu Sans aus src/assets, dieselben wie im PDF. */
import wasm from '@resvg/resvg-wasm/index_bg.wasm';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

let bereit = null;
export async function svgZuPng(svg, schriften, breite = 1200){
  if(!bereit) bereit = initWasm(wasm).catch(e => { bereit = null; throw e; });
  await bereit;
  const r = new Resvg(svg, {
    fitTo: { mode:'width', value: breite },
    font: { fontBuffers: [new Uint8Array(schriften.regular), new Uint8Array(schriften.bold)], loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' },
    background: '#ffffff',
  });
  const bild = r.render();
  const png = bild.asPng();
  bild.free(); r.free();
  return png;
}
