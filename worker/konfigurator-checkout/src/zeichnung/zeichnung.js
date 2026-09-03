/*
 * Kessler PRO — Zeichnungserzeuger
 *
 * Eine reine Funktion: Parametersatz rein, SVG raus. Keine Abhaengigkeiten,
 * kein Dateisystem, kein Netz. Laeuft unveraendert im Browser und im Worker;
 * das PDF entsteht aus demselben SVG (pdf.js).
 *
 * Alle Masse im Parametersatz sind Millimeter. Die SVG-Nutzereinheit ist
 * ebenfalls 1 mm, Blatt A4 quer = 297 x 210.
 *
 * Parametersatz (siehe adapter.js):
 *   form            'rechteck' | 'rund' | 'lform'
 *   laenge_mm, breite_mm | durchmesser_mm | lform {L,B,aw,ah,pos,schraeg,winkel,innenradius,radien[5]}
 *   material, dekor, staerke_mm      Codes wie im Konfigurator
 *   kante {hinten,rechts,vorne,links} oder {umlaufend}; kante_abs_farbe; kante_lackiert
 *   eckradien_mm {hl,hr,vr,vl}
 *   ausschnitte [ {typ:'rechteck',x,y,b,h,r} | {typ:'kreis',cx,cy,d} | {typ:'kontur',pts,r} | {typ:'kanal',pts,b,tiefe,seite} ]  (+label {de,pl,en})
 *   bohrungen [ {x,y,d} ]
 *   massband {typ,x0,len,rechts}    (mm; nur Naehtischplatte)
 *   hinweise {de:[],pl:[],en:[]}
 *   bestellnummer, sku, kunde, datum, position, positionen, menge, zeichnungsnummer, version,
 *   freigabe null | {name, zeit, auto}, exemplar 'kunde' | 'produktion'
 */

import * as I from './i18n.js';
import { kontur, huelle, verrunden, pfadSVG, rechteck as rechteckEcken } from './geometrie.js';

const BLATT = { b: 297, h: 210, rand: 8 };
const SCHRIFTFELD = { b: 110, h: 62 };
const MASSSTAEBE = [1, 2, 2.5, 5, 10, 20, 50];

const F = {
  linie: '#111111',
  hilfs: '#8a8a8a',
  mass: '#1f4e79',
  kante: '#c2410c',
  flaeche: '#f4f1ec',
  ausschnitt: '#ffffff',
  grau: '#666666',
  nut: '#b45309',
};
export const FONT = 'DejaVu Sans, Liberation Sans, Arial, sans-serif';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v) => Math.round(v * 1000) / 1000;
let SPR = 'de';
const mm = (v) => I.zahl(v, SPR);
const t = (k) => I.T[SPR][k];

/** grobe Textbreite in mm. Reicht fuer Spaltenlogik, kein Font-Metrics noetig. */
const breite = (s, size, bold) => String(s).length * size * (bold ? 0.63 : 0.57);

/** Text auf hoechstens `zeilen` Zeilen umbrechen, die je `wmax` breit sind. */
function umbrechen(s, wmax, size, zeilen = 2) {
  const worte = String(s).split(' ');
  const out = []; let cur = '';
  for (const w of worte) {
    const test = cur ? cur + ' ' + w : w;
    if (breite(test, size) <= wmax || !cur) cur = test;
    else { out.push(cur); cur = w; if (out.length === zeilen) break; }
  }
  if (out.length < zeilen && cur) out.push(cur);
  return out.slice(0, zeilen);
}

/* ---------------------------------------------------------------- Bausteine */

function txt(x, y, s, o = {}) {
  const size = o.size ?? 3.2;
  const anchor = o.anchor ?? 'start';
  const fill = o.fill ?? F.linie;
  const weight = o.bold ? ' font-weight="600"' : '';
  const rot = o.rot ? ` transform="rotate(${o.rot} ${n(x)} ${n(y)})"` : '';
  return `<text x="${n(x)}" y="${n(y)}" font-family="${FONT}" font-size="${size}" `
       + `fill="${fill}" text-anchor="${anchor}"${weight}${rot}>${esc(s)}</text>`;
}

function linie(x1, y1, x2, y2, o = {}) {
  const w = o.w ?? 0.25;
  const c = o.c ?? F.linie;
  const d = o.dash ? ` stroke-dasharray="${o.dash}"` : '';
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" `
       + `stroke="${c}" stroke-width="${w}"${d} stroke-linecap="round"/>`;
}

function pfeil(x, y, richtung) {
  const l = 2.0, b = 0.7;
  return `<path d="M 0 0 L ${l} ${b} L ${l} ${-b} Z" fill="${F.mass}" `
       + `transform="translate(${n(x)} ${n(y)}) rotate(${richtung})"/>`;
}

/** Waagerechte Masskette zwischen x1 und x2, Masslinie auf Hoehe y. */
function massH(x1, x2, y, text, o = {}) {
  if (x2 < x1) [x1, x2] = [x2, x1];
  const von = o.von ?? y;
  const ueber = o.ueber ?? 1.5;
  const r = y > von ? 1 : -1;
  let s = '';
  s += linie(x1, von, x1, y + r * ueber, { c: F.hilfs, w: 0.18 });
  s += linie(x2, von, x2, y + r * ueber, { c: F.hilfs, w: 0.18 });
  s += linie(x1, y, x2, y, { c: F.mass, w: 0.25 });
  const eng = Math.abs(x2 - x1) < 14;
  if (eng) {
    s += pfeil(x1, y, 180) + pfeil(x2, y, 0);
    s += linie(x1 - 4, y, x1, y, { c: F.mass, w: 0.25 });
    s += linie(x2, y, x2 + 4, y, { c: F.mass, w: 0.25 });
  } else {
    s += pfeil(x1, y, 0) + pfeil(x2, y, 180);
  }
  const mx = (x1 + x2) / 2;
  const size = o.size ?? 3.0;
  const w = String(text).length * size * 0.62 + 1.6;
  s += `<rect x="${n(mx - w / 2)}" y="${n(y - size - 0.6)}" width="${n(w)}" height="${n(size + 1.0)}" fill="#ffffff"/>`;
  s += txt(mx, y - 1.1, text, { anchor: 'middle', size, fill: F.mass, bold: true });
  return s;
}

/** Senkrechte Masskette zwischen y1 und y2, Masslinie auf x. */
function massV(y1, y2, x, text, o = {}) {
  if (y2 < y1) [y1, y2] = [y2, y1];
  const von = o.von ?? x;
  const ueber = o.ueber ?? 1.5;
  const r = x > von ? 1 : -1;
  let s = '';
  s += linie(von, y1, x + r * ueber, y1, { c: F.hilfs, w: 0.18 });
  s += linie(von, y2, x + r * ueber, y2, { c: F.hilfs, w: 0.18 });
  s += linie(x, y1, x, y2, { c: F.mass, w: 0.25 });
  const eng = Math.abs(y2 - y1) < 14;
  if (eng) {
    s += pfeil(x, y1, -90) + pfeil(x, y2, 90);
    s += linie(x, y1 - 4, x, y1, { c: F.mass, w: 0.25 });
    s += linie(x, y2, x, y2 + 4, { c: F.mass, w: 0.25 });
  } else {
    s += pfeil(x, y1, 90) + pfeil(x, y2, -90);
  }
  const my = (y1 + y2) / 2;
  const size = o.size ?? 3.0;
  const w = String(text).length * size * 0.62 + 1.6;
  s += `<g transform="rotate(-90 ${n(x)} ${n(my)})">`
     + `<rect x="${n(x - w / 2)}" y="${n(my - size - 0.6)}" width="${n(w)}" height="${n(size + 1.0)}" fill="#ffffff"/>`
     + `<text x="${n(x)}" y="${n(my - 1.1)}" font-family="${FONT}" font-size="${size}" `
     + `fill="${F.mass}" text-anchor="middle" font-weight="600">${esc(text)}</text></g>`;
  return s;
}

/** Nummernmarke fuer eine Bearbeitung. */
function marke(x, y, nr) {
  return `<circle cx="${n(x)}" cy="${n(y)}" r="2.4" fill="#ffffff" stroke="${F.mass}" stroke-width="0.35"/>`
       + txt(x, y + 1.0, String(nr), { size: 2.7, anchor: 'middle', fill: F.mass, bold: true });
}

/* ------------------------------------------------------------- Schriftfeld */

function formName(k) {
  if (k.form === 'rund') return t('f_rund');
  if (k.form === 'lform') return t('f_lform');
  return k.material === 'szwal' ? t('f_naehtisch') : t('f_rechteck');
}

function schriftfeld(k, mst) {
  const x = BLATT.b - BLATT.rand - SCHRIFTFELD.b;
  const y = BLATT.h - BLATT.rand - SCHRIFTFELD.h;
  const b = SCHRIFTFELD.b, h = SCHRIFTFELD.h;
  let s = `<rect x="${n(x)}" y="${n(y)}" width="${n(b)}" height="${n(h)}" fill="#ffffff" stroke="${F.linie}" stroke-width="0.4"/>`;

  s += txt(x + 3, y + 7, 'KESSLER PRO', { size: 5, bold: true });
  s += txt(x + 3, y + 11.3, t('untertitel'), { size: 2.6, fill: F.grau });
  s += linie(x, y + 13.6, x + b, y + 13.6, { w: 0.3 });
  s += linie(x + 55, y + 13.6, x + 55, y + h - 13, { w: 0.25, c: F.hilfs });

  const mat = I.bez(I.MATERIAL, k.material, SPR);
  const dek = I.bez(I.DEKOR, k.dekor, SPR);
  const links = [
    [t('bestellung'), k.bestellnummer],
    [t('artikel'), k.sku || '—'],
    [t('material'), mat],
    [t('dekor'), dek],
    [t('kunde'), k.kunde],
    [t('datum'), I.datum(k.datum, SPR)],
  ];
  const rechts = [
    [t('position'), `${k.position ?? 1} ${t('von')} ${k.positionen ?? k.position ?? 1}`],
    [t('menge'), `${k.menge ?? 1} ${t('stueck')}`],
    [t('staerke'), `${mm(k.staerke_mm)} mm`],
    [t('form'), formName(k)],
    [t('massstab'), `1 : ${mst}`],
    [t('zeichnung'), `${k.zeichnungsnummer} · V${k.version}`],
  ];
  const zeile = (xx, spaltenB, arr) => {
    const off = Math.max(15, ...arr.map(([l]) => breite(l, 2.5, true) + 2.6));
    const wmax = spaltenB - off;
    let yy = y + 18.4, out = '';
    for (const [l, v] of arr) {
      out += txt(xx, yy, l, { size: 2.5, fill: F.grau });
      let sv = String(v ?? '');
      let size = 3.1;
      while (breite(sv, size, true) > wmax && size > 2.1) size = Math.round((size - 0.1) * 10) / 10;
      while (breite(sv, size, true) > wmax && sv.length > 4) sv = sv.slice(0, -2) + '…';
      out += txt(xx + off, yy, sv, { size, bold: true });
      yy += 5.5;
    }
    return out;
  };
  s += zeile(x + 3, 51, links);
  s += zeile(x + 58, 49, rechts);

  s += linie(x, y + h - 13, x + b, y + h - 13, { w: 0.3 });
  const flab = t('freigabe');
  const foff = Math.max(15, breite(flab, 2.5, true) + 2.6);
  s += txt(x + 3, y + h - 8.6, flab, { size: 2.5, fill: F.grau });
  const fg = k.freigabe;
  const ftxt = fg ? `${fg.name || ''}${fg.name && fg.zeit ? ' · ' : ''}${fg.zeit || ''}` : t('freigabe_offen');
  let fsize = 3.0;
  while (breite(ftxt, fsize, true) > b - 6 - foff && fsize > 2.2) fsize = Math.round((fsize - 0.1) * 10) / 10;
  s += txt(x + 3 + foff, y + h - 8.4, ftxt, { size: fsize, bold: true, fill: fg ? '#15803d' : F.kante });
  const hint = fg ? (fg.auto ? t('freigabe_auto') : t('freigabe_erteilt')) : t('freigabe_hinweis');
  const zeilen = umbrechen(hint, b - 6, 2.3, 2);
  zeilen.forEach((z, i) => {
    s += txt(x + 3, y + h - 4.6 + i * 3.0, z, { size: 2.3, fill: F.grau });
  });
  return s;
}

/* -------------------------------------------------------------- Kantenbild */

function kantenLegende(x, y, k) {
  let s = txt(x, y, t('kanten'), { size: 3.2, bold: true });
  const kk = k.kante || {};
  const seiten = kk.umlaufend !== undefined
    ? [[t('umlaufend'), kk.umlaufend]]
    : [[t('hinten'), kk.hinten], [t('vorne'), kk.vorne], [t('links'), kk.links], [t('rechts'), kk.rechts]];
  let yy = y + 5;
  for (const [name, code] of seiten) {
    const bekantet = I.istBekantet(code);
    const wert = I.bez(I.KANTE, code || 'roh', SPR);
    s += linie(x, yy - 1, x + 6, yy - 1, { c: bekantet ? F.kante : F.hilfs, w: bekantet ? 1.1 : 0.35, dash: bekantet ? null : '1 1' });
    s += txt(x + 8, yy, name, { size: 2.8, fill: F.grau });
    s += txt(x + 32, yy, wert, { size: 2.8, bold: bekantet, fill: bekantet ? F.kante : F.linie });
    yy += 4.4;
  }
  if (k.kante_abs_farbe && k.kante_abs_farbe !== 'dekor') {
    s += txt(x + 8, yy, t('abs_farbe'), { size: 2.8, fill: F.grau });
    s += txt(x + 32, yy, I.bez(I.ABS_FARBE, k.kante_abs_farbe, SPR), { size: 2.8, bold: true, fill: F.kante });
    yy += 4.4;
  }
  if (k.kante_lackiert) { s += txt(x + 8, yy, t('lackiert'), { size: 2.8, fill: F.kante, bold: true }); yy += 4.4; }
  return { svg: s, yEnde: yy };
}

/* --------------------------------------------------------------- Hauptteil */

/** Welche Plattenkanten beruehrt ein Rechteckausschnitt? Toleranz 0,5 mm. */
function beruehrt(a, B, H) {
  const tol = 0.5;
  return { hinten: a.y <= tol, vorne: a.y + a.h >= H - tol, links: a.x <= tol, rechts: a.x + a.b >= B - tol };
}

export function zeichnung(k, sprache) {
  SPR = I.SPRACHEN.includes(sprache || k.sprache) ? (sprache || k.sprache) : 'de';
  const rund = k.form === 'rund', lform = k.form === 'lform';
  const { B, H } = huelle(k);
  const ausschnitte = k.ausschnitte || [];
  const bohrungen = k.bohrungen || [];
  const lf = lform ? k.lform : null;
  const notchOben = lf && (lf.pos === 'hr' || lf.pos === 'hl');
  const notchRechts = lf && (lf.pos === 'hr' || lf.pos === 'vr');

  // --- Platzbedarf fuer Massketten je Seite ermitteln, dann massstaeblich einpassen
  const bem = ausschnitte.filter((a) => a.typ !== 'kanal').slice(0, 3);   // bemasste Ausschnitte (Rest in der Tabelle)
  const ebenenOben   = bem.length + (lform && notchOben ? 1 : 0);
  const ebenenUnten  = rund ? 0 : 1 + (bohrungen.length ? 1 : 0) + (lform && !notchOben ? 1 : 0);
  const ebenenLinks  = bem.length + (lform && !notchRechts ? 1 : 0);
  const ebenenRechts = rund ? 0 : 1 + (lform && notchRechts ? 1 : 0);
  const luftO = 6 + ebenenOben * 7;
  const luftU = 6 + ebenenUnten * 8;
  const luftL = 6 + ebenenLinks * 8;
  const luftR = 6 + ebenenRechts * 8;

  const SPALTE = 46;                       // linke Randspalte: Legende, Kantenansicht
  const zx = BLATT.rand + 3, zy = BLATT.rand + 12;
  const zb = BLATT.b - 2 * BLATT.rand - 6;
  const zh = BLATT.h - BLATT.rand - SCHRIFTFELD.h - zy - 4;
  const nutzB = zb - luftL - luftR - SPALTE;
  const nutzH = zh - luftO - luftU;

  const mst = MASSSTAEBE.find((m) => B / m <= nutzB && H / m <= nutzH)
            ?? MASSSTAEBE[MASSSTAEBE.length - 1];
  const S = (v) => v / mst;

  const pb = S(B), ph = S(H);
  const px = zx + SPALTE + luftL + (nutzB - pb) / 2;
  const py = zy + luftO + (nutzH - ph) / 2;
  const X = (v) => px + S(v), Y = (v) => py + S(v);

  let s = '';

  // --- Blatt
  s += `<rect x="0" y="0" width="${BLATT.b}" height="${BLATT.h}" fill="#ffffff"/>`;
  s += `<rect x="${BLATT.rand / 2}" y="${BLATT.rand / 2}" width="${n(BLATT.b - BLATT.rand)}" `
     + `height="${n(BLATT.h - BLATT.rand)}" fill="none" stroke="${F.linie}" stroke-width="0.5"/>`;
  const massText = rund ? `Ø ${mm(B)} mm` : lform ? `${t('f_lform')} ${mm(B)} × ${mm(H)} mm` : `${mm(B)} × ${mm(H)} mm`;
  s += txt(BLATT.rand, BLATT.rand + 3.2,
    `${I.bez(I.MATERIAL, k.material, SPR)} ${mm(k.staerke_mm)} mm · ${massText} · ${I.bez(I.DEKOR, k.dekor, SPR)}`,
    { size: 4.4, bold: true });
  s += txt(BLATT.rand, BLATT.rand + 7.4, t('draufsicht'), { size: 2.8, fill: F.grau });

  const kk = k.kante || {};
  const umlaufendCode = kk.umlaufend !== undefined ? kk.umlaufend : null;

  // --- Plattenkontur
  let eckenV = null;
  if (rund) {
    const cx = X(B / 2), cy = Y(H / 2), r = pb / 2;
    if (I.istBekantet(umlaufendCode ?? kk.vorne)) {
      s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + 0.9)}" fill="none" stroke="${F.kante}" stroke-width="1.2"/>`;
    }
    s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${F.flaeche}" stroke="${F.linie}" stroke-width="0.5"/>`;
    s += linie(cx - r - 5, cy, cx + r + 5, cy, { c: F.hilfs, w: 0.18, dash: '5 1.2 0.8 1.2' });
    s += linie(cx, cy - r - 5, cx, cy + r + 5, { c: F.hilfs, w: 0.18, dash: '5 1.2 0.8 1.2' });
  } else {
    const pts = kontur(k);
    eckenV = verrunden(pts);
    const pfad = pfadSVG(eckenV, S, px, py);
    if (lform) {
      // Bekantung umlaufend: Kontur zuerst dick in Kantenfarbe, dann die Platte darueber
      if (I.istBekantet(umlaufendCode ?? kk.vorne))
        s += `<path d="${pfad}" fill="none" stroke="${F.kante}" stroke-width="2.2" stroke-linejoin="round"/>`;
      s += `<path d="${pfad}" fill="${F.flaeche}" stroke="${F.linie}" stroke-width="0.5"/>`;
    } else {
      s += `<path d="${pfad}" fill="${F.flaeche}" stroke="${F.linie}" stroke-width="0.5"/>`;
    }

    // Rechteckausschnitte, die eine Kante beruehren, als echte Aussparung
    for (const a of ausschnitte) {
      if (a.typ !== 'rechteck') continue;
      const tb = beruehrt(a, B, H);
      if (!tb.vorne && !tb.hinten && !tb.links && !tb.rechts) continue;
      const ax = X(a.x), ay = Y(a.y), ab = S(a.b), ah = S(a.h), rad = S(a.r || 0);
      const ueber = 1.4;
      const rx = tb.links ? ax - ueber : ax, ry = tb.hinten ? ay - ueber : ay;
      const rb = ab + (tb.links ? ueber : 0) + (tb.rechts ? ueber : 0);
      const rh = ah + (tb.hinten ? ueber : 0) + (tb.vorne ? ueber : 0);
      s += `<rect x="${n(rx)}" y="${n(ry)}" width="${n(rb)}" height="${n(rh)}" fill="#ffffff"/>`;
      if (tb.hinten && !tb.links && !tb.rechts) {
        s += `<path d="M ${n(ax)} ${n(ay - ueber)} V ${n(ay + ah - rad)} `
           + (rad ? `A ${n(rad)} ${n(rad)} 0 0 0 ${n(ax + rad)} ${n(ay + ah)} ` : '')
           + `H ${n(ax + ab - rad)} `
           + (rad ? `A ${n(rad)} ${n(rad)} 0 0 0 ${n(ax + ab)} ${n(ay + ah - rad)} ` : '')
           + `V ${n(ay - ueber)}" fill="none" stroke="${F.linie}" stroke-width="0.5"/>`;
      } else if (tb.vorne && !tb.links && !tb.rechts) {
        s += `<path d="M ${n(ax)} ${n(ay + ah + ueber)} V ${n(ay + rad)} `
           + (rad ? `A ${n(rad)} ${n(rad)} 0 0 1 ${n(ax + rad)} ${n(ay)} ` : '')
           + `H ${n(ax + ab - rad)} `
           + (rad ? `A ${n(rad)} ${n(rad)} 0 0 1 ${n(ax + ab)} ${n(ay + rad)} ` : '')
           + `V ${n(ay + ah + ueber)}" fill="none" stroke="${F.linie}" stroke-width="0.5"/>`;
      } else {
        s += `<rect x="${n(ax)}" y="${n(ay)}" width="${n(ab)}" height="${n(ah)}" fill="#ffffff" stroke="${F.linie}" stroke-width="0.5"/>`;
      }
    }

    // bekantete Seiten beim Rechteck dick nachziehen, an Aussparungen unterbrochen
    if (!lform && umlaufendCode === null) {
      const E = k.eckradien_mm || {};
      const luecken = (achse) => ausschnitte
        .filter((a) => a.typ === 'rechteck' && beruehrt(a, B, H)[achse])
        .map((a) => [a.x, a.x + a.b]).sort((p, q) => p[0] - q[0]);
      const segmente = (von, bis, gaps) => {
        const out = []; let cur = von;
        for (const [g1, g2] of gaps) {
          if (g2 <= cur || g1 >= bis) continue;
          if (g1 > cur) out.push([cur, Math.min(g1, bis)]);
          cur = Math.max(cur, g2);
        }
        if (cur < bis) out.push([cur, bis]);
        return out;
      };
      const dick = (x1, y1, x2, y2) => linie(x1, y1, x2, y2, { c: F.kante, w: 1.3 });
      if (I.istBekantet(kk.hinten))
        for (const [a1, a2] of segmente(E.hl || 0, B - (E.hr || 0), luecken('hinten'))) s += dick(X(a1), py - 0.9, X(a2), py - 0.9);
      if (I.istBekantet(kk.vorne))
        for (const [a1, a2] of segmente(E.vl || 0, B - (E.vr || 0), luecken('vorne'))) s += dick(X(a1), py + ph + 0.9, X(a2), py + ph + 0.9);
      if (I.istBekantet(kk.links)) s += dick(px - 0.9, Y(E.hl || 0), px - 0.9, Y(H - (E.vl || 0)));
      if (I.istBekantet(kk.rechts)) s += dick(px + pb + 0.9, Y(E.hr || 0), px + pb + 0.9, Y(H - (E.vr || 0)));
    }
  }

  // Eckradien beschriften — ausserhalb der Platte, diagonal von der Ecke weg;
  // bei der Innenecke des L in die Ausklinkung hinein
  if (eckenV) for (const e of eckenV) {
    if (!(e.r > 0)) continue;
    const cx = e.ecke.x, cy = e.ecke.y;
    let dx = cx < B / 2 ? -1 : 1, dy = cy < H / 2 ? -1 : 1;
    if (e.ord < 0) { dx = notchRechts ? 1 : -1; dy = notchOben ? -1 : 1; }
    const lbl = (e.ord < 0 || e.auto) ? `R ${mm(e.r)}*` : `R ${mm(e.r)}`;   // * = Fertigungsregel
    s += txt(X(cx) + dx * 2.4, Y(cy) + dy * 2.4 + (dy > 0 ? 2.2 : 0),
      lbl, { size: 2.5, fill: F.mass, bold: true, anchor: dx > 0 ? 'start' : 'end' });
  }

  // --- Innenliegende Ausschnitte, Konturen, Kanaele (mit Nummern)
  let nr = 0;
  const marken = [];
  for (const a of ausschnitte) {
    nr++;
    if (a.typ === 'rechteck') {
      const tb = beruehrt(a, B, H);
      const ax = X(a.x), ay = Y(a.y), ab = S(a.b), ah = S(a.h), rad = S(a.r || 0);
      if (!tb.vorne && !tb.hinten && !tb.links && !tb.rechts) {
        const ecken = verrunden(rechteckEcken(a.x, a.y, a.b, a.h, a.r || 0));
        s += `<path d="${pfadSVG(ecken, S, px, py)}" fill="${F.ausschnitt}" stroke="${F.linie}" stroke-width="0.45"/>`;
      }
      const lbl = `${mm(a.b)} × ${mm(a.h)}`;
      if (ab > 22 && ah > 8) s += txt(ax + ab / 2, ay + ah / 2 + 1.1, lbl, { size: 2.6, anchor: 'middle', fill: F.grau });
      else s += txt(ax + ab / 2, ay + (tb.hinten ? ah + 3.6 : -2.2), lbl, { size: 2.4, anchor: 'middle', fill: F.grau });
      marken.push([ax + (ab > 22 ? 3.2 : ab / 2), ay + (ah > 8 ? 3.2 : -5.5), nr]);
    } else if (a.typ === 'kreis') {
      const cx = X(a.cx), cy = Y(a.cy), r = Math.max(S(a.d / 2), 0.9);
      s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${F.ausschnitt}" stroke="${F.linie}" stroke-width="0.45"/>`;
      s += linie(cx - r - 1.8, cy, cx + r + 1.8, cy, { c: F.hilfs, w: 0.18 });
      s += linie(cx, cy - r - 1.8, cx, cy + r + 1.8, { c: F.hilfs, w: 0.18 });
      s += txt(cx + r + 2.2, cy + 1.0, `Ø ${mm(a.d)}`, { size: 2.6, fill: F.grau });
      marken.push([cx + r + 2.2 + breite(`Ø ${mm(a.d)}`, 2.6) + 3.0, cy, nr]);
    } else if (a.typ === 'kontur') {
      const pts = (a.pts || []).map(([x, y]) => ({ x, y, r: a.r || 0 }));
      if (pts.length >= 3) {
        const ecken = verrunden(pts);
        s += `<path d="${pfadSVG(ecken, S, px, py)}" fill="${F.ausschnitt}" stroke="${F.linie}" stroke-width="0.45" stroke-dasharray="1.2 0.6"/>`;
        const cx = pts.reduce((q, p) => q + p.x, 0) / pts.length, cy = pts.reduce((q, p) => q + p.y, 0) / pts.length;
        marken.push([X(cx), Y(cy), nr]);
      }
    } else if (a.typ === 'kanal') {
      const p = a.pts || [];
      if (p.length >= 2) {
        const bw = Math.max(1.2, S(a.b || 60));
        const d = 'M ' + p.map(([x, y]) => `${n(X(x))} ${n(Y(y))}`).join(' L ');
        const oben = a.seite === 'oben';
        s += `<path d="${d}" fill="none" stroke="${F.nut}" stroke-opacity="${oben ? 0.28 : 0.16}" stroke-width="${n(bw)}" stroke-linecap="butt" stroke-linejoin="round"/>`;
        s += `<path d="${d}" fill="none" stroke="${F.nut}" stroke-width="0.35"${oben ? '' : ' stroke-dasharray="2 1.2"'}/>`;
        const mxp = (X(p[0][0]) + X(p[p.length - 1][0])) / 2, myp = (Y(p[0][1]) + Y(p[p.length - 1][1])) / 2;
        marken.push([mxp, myp, nr]);
      }
    }
  }

  // --- Bohrungen
  for (const b of bohrungen) {
    const bx = X(b.x), by = Y(b.y), br = Math.max(S(b.d / 2), 0.8);
    s += `<circle cx="${n(bx)}" cy="${n(by)}" r="${n(br)}" fill="#ffffff" stroke="${F.linie}" stroke-width="0.4"/>`;
    s += linie(bx - br - 1.5, by, bx + br + 1.5, by, { c: F.hilfs, w: 0.18 });
    s += linie(bx, by - br - 1.5, bx, by + br + 1.5, { c: F.hilfs, w: 0.18 });
  }

  // --- Massband (Naehtischplatte): gelasert = Teilstriche auf der Flaeche,
  //     Aufkleber = Linie an der Kante. Beschriftung steht in der Tabelle.
  if (k.massband && k.massband.len > 0) {
    const mb = k.massband, yB = Y(H);
    const xs = (cmv) => X(mb.rechts ? mb.x0 + mb.len - cmv * 10 : mb.x0 + cmv * 10);
    const lenCm = Math.round(mb.len / 10);
    if (mb.typ === 'laser') {
      const yL = yB - Math.max(S(16), 1.6);
      const fein = S(10) >= 1.2;
      for (let cmv = 0; cmv <= lenCm; cmv++) {
        const gross = cmv % 10 === 0, mittel = cmv % 5 === 0;
        if (!gross && !mittel && !fein) continue;
        s += linie(xs(cmv), yL, xs(cmv), yL - (gross ? 2.4 : mittel ? 1.6 : 1.0), { w: gross ? 0.3 : 0.15, c: F.linie });
        if (gross && (cmv === 0 || cmv === lenCm)) {
          s += txt(xs(cmv) + (cmv === 0 ? (mb.rechts ? -0.6 : 0.6) : (mb.rechts ? 0.6 : -0.6)), yL - 3.0, String(cmv),
            { size: 1.9, anchor: cmv === 0 ? (mb.rechts ? 'end' : 'start') : (mb.rechts ? 'start' : 'end'), fill: F.grau });
        }
      }
      s += linie(xs(0), yL, xs(lenCm), yL, { w: 0.2, c: F.linie });
    } else {
      s += linie(X(mb.x0), yB - 1.2, X(mb.x0 + mb.len), yB - 1.2, { w: 0.6, c: F.linie, dash: '1.5 0.8' });
    }
  }

  // --- Nummernmarken zuletzt, damit sie ueber allem liegen
  for (const [mx, my, nn] of marken) s += marke(mx, my, nn);

  // --- Hauptmasse
  if (rund) {
    const cx = X(B / 2), cy = Y(H / 2), r = pb / 2;
    const a = -32 * Math.PI / 180;
    const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    s += linie(cx - dx, cy - dy, cx + dx, cy + dy, { c: F.mass, w: 0.3 });
    s += pfeil(cx - dx, cy - dy, -32) + pfeil(cx + dx, cy + dy, 148);
    const tt = `Ø ${mm(B)}`, size = 3.6, w = tt.length * size * 0.62 + 2;
    const tx = cx + dx * 0.45, ty = cy + dy * 0.45;
    s += `<rect x="${n(tx - w / 2)}" y="${n(ty - size + 0.4)}" width="${n(w)}" height="${n(size + 1.4)}" fill="#ffffff"/>`;
    s += txt(tx, ty + 1.3, tt, { anchor: 'middle', size, fill: F.mass, bold: true });
  } else {
    const ebU = lform && !notchOben ? 2 : 1, ebR = lform && notchRechts ? 2 : 1;
    s += massH(px, px + pb, py + ph + 3 + 8 * ebU, mm(B), { von: py + ph, size: 3.5 });
    s += massV(py, py + ph, px + pb + 3 + 8 * ebR, mm(H), { von: px + pb, size: 3.5 });
  }

  // --- L-Form: Ausklinkung bemassen
  if (lform) {
    const aw = Math.min(lf.aw, B - 1), ah = Math.min(lf.ah, H - 1);
    const xN1 = notchRechts ? B - aw : 0, xN2 = notchRechts ? B : aw;   // x-Bereich der Ausklinkung
    const yN1 = notchOben ? 0 : H - ah, yN2 = notchOben ? ah : H;
    // Breite der Ausklinkung: oben oder unten, erste Ebene
    if (notchOben) s += massH(X(xN1), X(xN2), py - 6, mm(aw), { von: py, size: 2.9 });
    else s += massH(X(xN1), X(xN2), py + ph + 11, mm(aw), { von: py + ph, size: 2.9 });
    // Tiefe der Ausklinkung: rechts oder links, erste Ebene
    if (notchRechts) s += massV(Y(yN1), Y(yN2), px + pb + 11, mm(ah), { von: px + pb, size: 2.9 });
    else s += massV(Y(yN1), Y(yN2), px - 8, mm(ah), { von: px, size: 2.9 });
    // Schraeger Schnitt: Winkel zur hinteren/vorderen Kante
    if (lf.schraeg) {
      const sb = Math.max(0, Math.min(+lf.sb || 0, ah - 1));
      const offx = notchRechts ? 1 : -1, offy = notchOben ? -1 : 1;
      if (!(sb > 0)) {
        const cx = X((xN1 + xN2) / 2), cy = Y((yN1 + yN2) / 2);
        s += txt(cx + offx * S(aw) * 0.22, cy + offy * S(ah) * 0.22 + 1, `${mm(lf.winkel)}°`, { size: 3.0, fill: F.mass, bold: true, anchor: 'middle' });
        s += txt(cx + offx * S(aw) * 0.22, cy + offy * S(ah) * 0.22 + 4.4, t('schraeg'), { size: 2.3, fill: F.grau, anchor: 'middle' });
      } else {
        // Punkt B (v1.17.3): A an der Aussenkante, B auf der Innenkante. Winkel an der
        // Schraege, Mass B -> Plattenkante aussen neben dem Tiefenmass (zweite Ebene).
        const xA = notchRechts ? B : 0, yA = notchOben ? ah : H - ah;
        const xB = notchRechts ? B - aw : aw, yB = notchOben ? sb : H - sb;
        const yK = notchOben ? 0 : H;                                     // Plattenkante der Ausklinkung
        s += `<circle cx="${n(X(xA))}" cy="${n(Y(yA))}" r="0.9" fill="${F.mass}"/><circle cx="${n(X(xB))}" cy="${n(Y(yB))}" r="0.9" fill="${F.mass}"/>`;
        s += txt(X(xA) + (notchRechts ? 2.2 : -2.2), Y(yA) + (notchOben ? -1.6 : 3.4), 'A', { size: 2.8, fill: F.mass, bold: true, anchor: 'middle' });
        s += txt(X(xB) + (notchRechts ? -2.4 : 2.4), Y(yB) + (notchOben ? 3.4 : -1.6), 'B', { size: 2.8, fill: F.mass, bold: true, anchor: 'middle' });
        const mxP = X((xA + xB) / 2) + offx * 6, myP = Y((yA + yB) / 2) + offy * 3.5;
        s += txt(mxP, myP + 1, `${mm(lf.winkel)}°`, { size: 3.0, fill: F.mass, bold: true, anchor: 'middle' });
        s += txt(mxP, myP + 4.2, t('schraeg'), { size: 2.3, fill: F.grau, anchor: 'middle' });
        const xM = notchRechts ? px + pb + 19 : px - 16;
        s += massV(Y(Math.min(yK, yB)), Y(Math.max(yK, yB)), xM, mm(sb), { von: notchRechts ? px + pb : px, size: 2.6 });
      }
    }
  }

  // --- Masse der Ausschnitte: x-Ketten oben, y-Ketten links, je eine Ebene
  const ebeneOben0 = lform && notchOben ? 1 : 0, ebeneLinks0 = lform && !notchRechts ? 1 : 0;
  bem.forEach((a, i) => {
    const yo = py - 6 - (i + ebeneOben0) * 7;
    if (a.typ === 'rechteck') {
      if (a.x > 0.5) s += massH(px, X(a.x), yo, mm(a.x), { von: py, size: 2.6 });
      s += massH(X(a.x), X(a.x + a.b), yo, mm(a.b), { von: py, size: 2.6 });
      if (a.y > 0.5) s += massV(py, Y(a.y), px - 8 - (i + ebeneLinks0) * 7, mm(a.y), { von: px, size: 2.6 });
      s += massV(Y(a.y), Y(a.y + a.h), px - 8 - (i + ebeneLinks0) * 7, mm(a.h), { von: px, size: 2.6 });
    } else if (a.typ === 'kreis') {
      s += massH(px, X(a.cx), yo, mm(a.cx), { von: py, size: 2.6 });
      s += massV(py, Y(a.cy), px - 8 - (i + ebeneLinks0) * 7, mm(a.cy), { von: px, size: 2.6 });
    } else if (a.typ === 'kontur') {
      const xs = a.pts.map((p) => p[0]), ys = a.pts.map((p) => p[1]);
      const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
      if (x1 > 0.5) s += massH(px, X(x1), yo, mm(x1), { von: py, size: 2.6 });
      s += massH(X(x1), X(x2), yo, mm(x2 - x1), { von: py, size: 2.6 });
      if (y1 > 0.5) s += massV(py, Y(y1), px - 8 - (i + ebeneLinks0) * 7, mm(y1), { von: px, size: 2.6 });
      s += massV(Y(y1), Y(y2), px - 8 - (i + ebeneLinks0) * 7, mm(y2 - y1), { von: px, size: 2.6 });
    }
  });

  // --- Bohrbild: x-Kette unten, y-Kette rechts (Ebene 2)
  const mittig = bohrungen.length === 1 && Math.abs(bohrungen[0].x - B / 2) < 0.5 && Math.abs(bohrungen[0].y - H / 2) < 0.5;
  if (bohrungen.length && !mittig && !rund) {
    const ebU = lform && !notchOben ? 2 : 1, ebR = lform && notchRechts ? 2 : 1;
    const yb = py + ph + 3 + 8 * (ebU + 1), xb = px + pb + 3 + 8 * (ebR + 1);
    const xs = [...new Set(bohrungen.map((b) => Math.round(b.x * 10) / 10))].sort((a, b) => a - b);
    let prev = 0;
    for (const x of xs) { if (x - prev > 0.5) s += massH(X(prev), X(x), yb, mm(x - prev), { von: py + ph, size: 2.5 }); prev = x; }
    if (B - prev > 0.5) s += massH(X(prev), px + pb, yb, mm(B - prev), { von: py + ph, size: 2.5 });
    const ys = [...new Set(bohrungen.map((b) => Math.round(b.y * 10) / 10))].sort((a, b) => a - b);
    let pv = 0;
    for (const y of ys) { if (y - pv > 0.5) s += massV(Y(pv), Y(y), xb, mm(y - pv), { von: px + pb, size: 2.5 }); pv = y; }
    if (H - pv > 0.5) s += massV(Y(pv), py + ph, xb, mm(H - pv), { von: px + pb, size: 2.5 });
  }

  // --- Randspalte links: Kantenlegende und Kantenansicht
  const lx = zx + 4;
  const leg = kantenLegende(lx, zy + 4, k);
  s += leg.svg;
  const ky = zy + zh - 20;
  const kb = Math.min(S(B), 34), kh = Math.max(S(k.staerke_mm), 1.6);
  s += `<rect x="${n(lx)}" y="${n(ky)}" width="${n(kb)}" height="${n(kh)}" fill="${F.flaeche}" stroke="${F.linie}" stroke-width="0.4"/>`;
  const kl = umlaufendCode !== null ? umlaufendCode : kk.links, kr = umlaufendCode !== null ? umlaufendCode : kk.rechts;
  if (I.istBekantet(kl)) s += linie(lx - 0.8, ky, lx - 0.8, ky + kh, { c: F.kante, w: 1.3 });
  if (I.istBekantet(kr)) s += linie(lx + kb + 0.8, ky, lx + kb + 0.8, ky + kh, { c: F.kante, w: 1.3 });
  s += massV(ky, ky + kh, lx + kb + 8, mm(k.staerke_mm), { von: lx + kb, size: 2.7 });
  s += txt(lx, ky - 2.5, t('kantenansicht'), { size: 2.8, bold: true });

  // --- Tabelle der Bearbeitungen + Hinweise: unten links neben dem Schriftfeld
  const tx0 = BLATT.rand + 2, ty0 = BLATT.h - BLATT.rand - SCHRIFTFELD.h + 2.5;
  const tb0 = BLATT.b - 2 * BLATT.rand - SCHRIFTFELD.b - 6;
  const zeilenTxt = [];
  ausschnitte.forEach((a, i) => zeilenTxt.push([String(i + 1), bearbeitungText(a, B, H)]));
  const hw = k.hinweise ? (Array.isArray(k.hinweise) ? k.hinweise : (k.hinweise[SPR] || k.hinweise.de || [])) : [];
  if (k.massband && k.massband.len > 0) {
    const mb = k.massband;
    zeilenTxt.push(['', t('massband')(Math.round(mb.len / 10), mb.rechts ? t('rechts') : t('links')) + ` · ${mb.typ === 'laser' ? t('massband_laser') : t('massband_sticker')} · ${t('vorne')}`]);
  }
  for (const h of hw) zeilenTxt.push(['', String(h)]);
  if (zeilenTxt.length) {
    s += linie(tx0, ty0, tx0 + tb0, ty0, { w: 0.3 });
    let yy = ty0 + 4.2;
    const maxY = BLATT.h - BLATT.rand - 1.5;
    for (const [nn, text] of zeilenTxt) {
      if (yy > maxY) break;
      const zeilen = umbrechen(text, tb0 - 8, 2.5, 2);
      if (nn) s += marke(tx0 + 2.6, yy - 0.9, nn);
      zeilen.forEach((z, j) => { if (yy + j * 3.1 <= maxY) s += txt(tx0 + 6.5, yy + j * 3.1, z, { size: 2.5, fill: nn ? F.linie : F.grau }); });
      yy += 3.1 * zeilen.length + 0.9;
    }
  }

  // --- Exemplarkennzeichnung, damit Werkstatt und Kunde nie verwechselt werden
  const prod = k.exemplar === 'produktion';
  const badge = prod ? t('exemplar_produktion') : t('exemplar_kunde');
  const bw = badge.length * 2.9 * 0.62 + 6;
  s += `<rect x="${n(BLATT.b - BLATT.rand - bw)}" y="${n(BLATT.rand + 1.5)}" width="${n(bw)}" height="6" `
     + `rx="1" fill="${prod ? '#1f2937' : '#e8eef5'}"/>`;
  s += txt(BLATT.b - BLATT.rand - bw / 2, BLATT.rand + 5.7, badge,
    { size: 2.9, anchor: 'middle', bold: true, fill: prod ? '#ffffff' : F.mass });
  if (prod && k.zeichnungsnummer) {
    s += txt(BLATT.b - BLATT.rand, BLATT.rand + 10.8, t('entspricht')(k.zeichnungsnummer, k.version),
      { size: 2.4, anchor: 'end', fill: F.grau });
  }

  s += schriftfeld(k, mst);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BLATT.b}mm" height="${BLATT.h}mm" `
       + `viewBox="0 0 ${BLATT.b} ${BLATT.h}">${s}</svg>`;
}

/** Textzeile einer Bearbeitung fuer die Tabelle — Lage in mm ab hinten links. */
function bearbeitungText(a, B, H) {
  const lbl = a.label ? I.text(a.label, SPR) : '';
  const f = mm;
  if (a.typ === 'rechteck') {
    const abst = `${t('links')} ${f(a.x)} · ${t('rechts')} ${f(B - a.x - a.b)} · ${t('hinten').split(' ')[0]} ${f(a.y)} · ${t('vorne').split(' ')[0]} ${f(H - a.y - a.h)}`;
    return `${lbl ? lbl + ' — ' : ''}${f(a.b)} × ${f(a.h)} mm${a.r ? `, R ${f(a.r)}` : ''} · ${abst}`;
  }
  if (a.typ === 'kreis') {
    return `${lbl ? lbl + ' — ' : ''}Ø ${f(a.d)} mm · x ${f(a.cx)} / y ${f(a.cy)} (${t('links')} ${f(a.cx - a.d / 2)} · ${t('hinten').split(' ')[0]} ${f(a.cy - a.d / 2)})`;
  }
  if (a.typ === 'kontur') {
    return `${lbl ? lbl + ' — ' : t('kontur')(a.pts.length)}${lbl ? '' : ''} · R ${f(a.r || 0)} · ` + a.pts.map(([x, y]) => `${f(x)}/${f(y)}`).join('  ');
  }
  if (a.typ === 'kanal') {
    const seite = a.seite === 'oben' ? t('oberseite') : t('unterseite');
    return `${t('kanal')(f(a.b), f(a.tiefe), seite)} · ` + a.pts.map(([x, y]) => `${f(x)}/${f(y)}`).join(' → ');
  }
  return lbl;
}

export { BLATT };
