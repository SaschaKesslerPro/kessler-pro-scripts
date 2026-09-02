/*
 * SVG (aus zeichnung.js) -> PDF, vektoriell, mit eingebetteter Schrift.
 *
 * Kein allgemeiner SVG-Renderer: verstanden wird genau das Vokabular, das
 * zeichnung.js erzeugt — rect, line, circle, path (M/L/H/V/A/Z, optional mit
 * translate+rotate), text (anchor, bold, rotate) und ein <g transform=rotate>
 * um die senkrechten Massketten. Blatt = A4 quer, 1 SVG-Einheit = 1 mm.
 *
 * Schrift: DejaVu Sans (regular + bold) — deckt Deutsch, Polnisch, Englisch
 * inklusive ą ę ł ż und Ø × · ab. Wird als Subset eingebettet.
 */

import { PDFDocument, rgb, degrees, LineCapStyle } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const PT = 72 / 25.4;
const BLATT = { b: 297, h: 210 };

const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? m[1] : null; };
const num = (v, d = 0) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
const farbe = (hex) => {
  if (!hex || hex === 'none') return null;
  const m = String(hex).match(/^#([0-9a-f]{6})$/i);
  if (!m) return rgb(0, 0, 0);
  const v = parseInt(m[1], 16);
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
};
const unesc = (s) => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/**
 * @param {string} svg              SVG-Text aus zeichnung()
 * @param {{regular:ArrayBuffer|Uint8Array, bold:ArrayBuffer|Uint8Array}} fonts
 * @param {{titel?:string, autor?:string}} meta
 * @returns {Promise<Uint8Array>}
 */
export async function svgZuPdf(svg, fonts, meta = {}) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fReg = await doc.embedFont(fonts.regular, { subset: true });
  const fBold = fonts.bold ? await doc.embedFont(fonts.bold, { subset: true }) : fReg;
  doc.setTitle(meta.titel || 'Kessler PRO — Zeichnung');
  doc.setAuthor(meta.autor || 'Kessler PRO');
  doc.setProducer('kessler-pro konfigurator');
  doc.setCreationDate(new Date());

  const page = doc.addPage([BLATT.b * PT, BLATT.h * PT]);
  const X = (x) => x * PT, Y = (y) => (BLATT.h - y) * PT;

  // Tokenizer: Elemente in Reihenfolge, <g rotate> als Kontext
  const re = /<(rect|line|circle|path|text|g)\b([^>]*?)(\/>|>)|<\/(text|g)>/g;
  let m, rot = null;              // rot = {a, cx, cy} innerhalb eines <g transform="rotate(a cx cy)">
  const inhalt = svg.replace(/^[\s\S]*?<svg[^>]*>/, '');
  const rotPunkt = (x, y) => {
    if (!rot) return [x, y];
    const a = rot.a * Math.PI / 180, dx = x - rot.cx, dy = y - rot.cy;
    return [rot.cx + dx * Math.cos(a) - dy * Math.sin(a), rot.cy + dx * Math.sin(a) + dy * Math.cos(a)];
  };
  let i = 0;
  while ((m = re.exec(inhalt))) {
    const [ganz, tagName, attrs, ende, schluss] = m;
    if (schluss === 'g') { rot = null; continue; }
    if (schluss === 'text') continue;
    const tag = ' ' + attrs;
    if (tagName === 'g') {
      const t = attr(tag, 'transform') || '';
      const r = t.match(/rotate\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)/);
      rot = r ? { a: +r[1], cx: +r[2], cy: +r[3] } : null;
      continue;
    }
    const fill = farbe(attr(tag, 'fill') ?? '#000000');
    const stroke = farbe(attr(tag, 'stroke'));
    const sw = num(attr(tag, 'stroke-width'), 1) * PT;
    const dash = attr(tag, 'stroke-dasharray');
    const dashArray = dash ? dash.trim().split(/[\s,]+/).map((v) => num(v) * PT) : undefined;
    const sOpacity = attr(tag, 'stroke-opacity'), fOpacity = attr(tag, 'fill-opacity');

    if (tagName === 'rect') {
      let x = num(attr(tag, 'x')), y = num(attr(tag, 'y')), w = num(attr(tag, 'width')), h = num(attr(tag, 'height'));
      if (rot) {                 // nur ±90° kommt vor: gedrehtes Rechteck bleibt achsparallel
        const p = [rotPunkt(x, y), rotPunkt(x + w, y), rotPunkt(x, y + h), rotPunkt(x + w, y + h)];
        const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
        x = Math.min(...xs); y = Math.min(...ys); w = Math.max(...xs) - x; h = Math.max(...ys) - y;
      }
      const o = { x: X(x), y: Y(y + h), width: w * PT, height: h * PT };
      if (fill) o.color = fill;
      if (stroke) { o.borderColor = stroke; o.borderWidth = sw; }
      if (fOpacity != null) o.opacity = num(fOpacity, 1);
      page.drawRectangle(o);
    } else if (tagName === 'line') {
      const [x1, y1] = rotPunkt(num(attr(tag, 'x1')), num(attr(tag, 'y1')));
      const [x2, y2] = rotPunkt(num(attr(tag, 'x2')), num(attr(tag, 'y2')));
      const o = { start: { x: X(x1), y: Y(y1) }, end: { x: X(x2), y: Y(y2) }, thickness: sw, color: stroke || rgb(0, 0, 0), lineCap: LineCapStyle.Round };
      if (dashArray) o.dashArray = dashArray;
      if (sOpacity != null) o.opacity = num(sOpacity, 1);
      page.drawLine(o);
    } else if (tagName === 'circle') {
      const [cx, cy] = rotPunkt(num(attr(tag, 'cx')), num(attr(tag, 'cy')));
      const o = { x: X(cx), y: Y(cy), size: num(attr(tag, 'r')) * PT };
      if (fill) o.color = fill;
      if (stroke) { o.borderColor = stroke; o.borderWidth = sw; }
      page.drawCircle(o);
    } else if (tagName === 'path') {
      let d = attr(tag, 'd') || '';
      const t = attr(tag, 'transform');
      if (t) {                   // Pfeile: translate(x y) rotate(r) auf ein kleines Dreieck
        const tr = t.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/), ro = t.match(/rotate\(([-\d.]+)\)/);
        const tx = tr ? +tr[1] : 0, ty = tr ? +tr[2] : 0, a = ro ? +ro[1] * Math.PI / 180 : 0;
        const pts = [...d.matchAll(/([ML])\s*([-\d.]+)\s+([-\d.]+)/g)].map((q) => {
          const x = +q[2], y = +q[3];
          return [tx + x * Math.cos(a) - y * Math.sin(a), ty + x * Math.sin(a) + y * Math.cos(a)];
        });
        d = pts.map((p, j) => `${j ? 'L' : 'M'} ${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join(' ') + ' Z';
      }
      // drawSvgPath setzt Linienbreite und Strichmuster INNERHALB der Skalierung — also in mm angeben
      const o = { x: 0, y: BLATT.h * PT, scale: PT, borderWidth: stroke ? sw / PT : 0 };
      if (fill) o.color = fill;
      if (stroke) o.borderColor = stroke;
      if (dashArray) o.borderDashArray = dashArray.map((v) => v / PT);
      if (sOpacity != null) o.borderOpacity = num(sOpacity, 1);
      if (fOpacity != null) o.opacity = num(fOpacity, 1);
      page.drawSvgPath(d, o);
    } else if (tagName === 'text') {
      // Inhalt bis zum schliessenden Tag lesen
      const rest = inhalt.slice(re.lastIndex);
      const endIdx = rest.indexOf('</text>');
      const text = unesc(rest.slice(0, endIdx)).trim();
      re.lastIndex += endIdx + '</text>'.length;
      if (!text) continue;
      const size = num(attr(tag, 'font-size'), 3.2) * PT;
      const bold = /font-weight="(600|700|bold)"/.test(tag);
      const font = bold ? fBold : fReg;
      const anchor = attr(tag, 'text-anchor') || 'start';
      const w = font.widthOfTextAtSize(text, size);
      let x = num(attr(tag, 'x')), y = num(attr(tag, 'y'));
      let winkel = 0;
      const t = attr(tag, 'transform');
      const r = t && t.match(/rotate\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)/);
      if (r) winkel = -(+r[1]);
      if (rot) { [x, y] = rotPunkt(x, y); winkel = -rot.a; }
      // Verschiebung des Ankers entlang der Textrichtung
      const off = anchor === 'middle' ? -w / 2 : anchor === 'end' ? -w : 0;
      const a = winkel * Math.PI / 180;
      const px = X(x) + off * Math.cos(a), py = Y(y) + off * Math.sin(a);
      page.drawText(text, { x: px, y: py, size, font, color: fill || rgb(0, 0, 0), rotate: degrees(winkel) });
    }
    if (++i > 20000) break;
  }
  return doc.save({ useObjectStreams: true });
}
