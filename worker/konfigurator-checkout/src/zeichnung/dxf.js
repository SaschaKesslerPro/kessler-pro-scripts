/*
 * DXF fuer die CNC — aus demselben Parametersatz wie die Zeichnung.
 *
 * Ausdruecklich KEINE Umwandlung des Zeichnungsblatts: hier steht nur die
 * Geometrie, 1:1 in Millimetern. Format DXF R12 ASCII — der kleinste gemeinsame
 * Nenner, jedes Nesting- und CAM-Programm liest es.
 *
 * Koordinaten: Nullpunkt vorne links, x nach rechts, y nach hinten.
 * Im Parametersatz wird y von HINTEN gemessen, hier wird gespiegelt.
 *
 * Ebenen
 *   AUSSEN     Aussenkontur (Rechteck, L-Form mit allen Radien, Kreis).
 *   INNEN      geschlossene Ausschnitte und freie Konturen.
 *   BOHRUNG    Bohrungen als Kreis mit Nenndurchmesser.
 *   NUT        Kabelkanal als Mittellinie (Breite/Tiefe im Infotext).
 *   INFO       Klartext, schneidet nicht mit.
 *
 * Werkzeugradius und Aufmass setzt die CAM, nicht diese Datei.
 */

import * as I from './i18n.js';
import { kontur, huelle, verrunden, polylinieDXF, rechteck as rechteckEcken } from './geometrie.js';

const f = (v) => (Math.round(v * 1000) / 1000).toFixed(3);

function paar(code, wert) { return `${code}\n${wert}\n`; }

/** R12 vertraegt keine Umlaute zuverlaessig — Infotexte werden entschaerft. */
function ascii(s) {
  const m = { ä:'ae', ö:'oe', ü:'ue', Ä:'Ae', Ö:'Oe', Ü:'Ue', ß:'ss',
              ą:'a', ć:'c', ę:'e', ł:'l', ń:'n', ó:'o', ś:'s', ź:'z', ż:'z',
              Ą:'A', Ć:'C', Ę:'E', Ł:'L', Ń:'N', Ó:'O', Ś:'S', Ź:'Z', Ż:'Z',
              '·':'-', '×':'x', 'Ø':'D', '—':'-', '–':'-', '„':'"', '“':'"', '”':'"', '°':'deg', '→':'->' };
  return String(s).replace(/[^\x20-\x7E]/g, (c) => m[c] ?? '');
}

function polylinie(layer, punkte, geschlossen = true) {
  let s = paar(0, 'POLYLINE') + paar(8, layer) + paar(66, 1)
        + paar(70, geschlossen ? 1 : 0)
        + paar(10, f(0)) + paar(20, f(0)) + paar(30, f(0));
  for (const p of punkte) {
    s += paar(0, 'VERTEX') + paar(8, layer)
       + paar(10, f(p.x)) + paar(20, f(p.y)) + paar(30, f(0));
    if (p.bulge) s += paar(42, f(p.bulge));
  }
  return s + paar(0, 'SEQEND') + paar(8, layer);
}

function kreis(layer, cx, cy, r) {
  return paar(0, 'CIRCLE') + paar(8, layer)
       + paar(10, f(cx)) + paar(20, f(cy)) + paar(30, f(0)) + paar(40, f(r));
}

function beschriftung(layer, x, y, h, s) {
  return paar(0, 'TEXT') + paar(8, layer)
       + paar(10, f(x)) + paar(20, f(y)) + paar(30, f(0))
       + paar(40, f(h)) + paar(1, ascii(s));
}

/** Gegen den Uhrzeigersinn ordnen (im Bild wie im DXF — die Spiegelung
    aendert das Bild nicht). Bei y nach unten hat ein Umlauf gegen den
    Uhrzeigersinn eine NEGATIVE Schnuerflaeche. */
function gegenUhr(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return a < 0 ? pts : [...pts].reverse();
}

export function dxf(k, opt = {}) {
  const spr = I.SPRACHEN.includes(opt.sprache) ? opt.sprache : 'pl';
  const t = (x) => I.T[spr][x];
  const rund = k.form === 'rund';
  const { B, H } = huelle(k);
  const eine = opt.ebenen === '0';
  const L = eine
    ? { aussen: '0', innen: '0', bohrung: '0', nut: '0', info: '0' }
    : { aussen: 'AUSSEN', innen: 'INNEN', bohrung: 'BOHRUNG', nut: 'NUT', info: 'INFO' };
  const LAYER = eine
    ? [['0', 7]]
    : [['AUSSEN', 7], ['INNEN', 1], ['BOHRUNG', 5], ['NUT', 3], ['INFO', 8]];
  const ox = opt.nullpunkt === 'mitte' ? -B / 2 : 0;
  const oy = opt.nullpunkt === 'mitte' ? -H / 2 : 0;

  let ent = '';
  if (rund) {
    ent += kreis(L.aussen, B / 2 + ox, H / 2 + oy, B / 2);
  } else {
    // Aussenkontur gegen den Uhrzeigersinn — das Werkzeug laeuft aussen
    const pts = gegenUhr(kontur(k));
    ent += polylinie(L.aussen, polylinieDXF(verrunden(pts), H, ox, oy));
  }
  for (const a of k.ausschnitte || []) {
    if (a.typ === 'rechteck') {
      // Innenkontur im Uhrzeigersinn (rechteckEcken liefert sie bereits so)
      const e = rechteckEcken(a.x, a.y, a.b, a.h, a.r || 0);
      ent += polylinie(L.innen, polylinieDXF(verrunden(e), H, ox, oy));
    } else if (a.typ === 'kreis') {
      ent += kreis(L.innen, a.cx + ox, H - a.cy + oy, a.d / 2);
    } else if (a.typ === 'kontur') {
      let p = (a.pts || []).map(([x, y]) => ({ x, y, r: a.r || 0 }));
      if (p.length >= 3) {
        p = gegenUhr(p).reverse();          // Innenkontur im Uhrzeigersinn
        ent += polylinie(L.innen, polylinieDXF(verrunden(p), H, ox, oy));
      }
    } else if (a.typ === 'kanal') {
      const p = (a.pts || []).map(([x, y]) => ({ x: x + ox, y: H - y + oy }));
      if (p.length >= 2) {
        ent += polylinie(L.nut, p, false);
        const seite = a.seite === 'oben' ? t('oberseite') : t('unterseite');
        ent += beschriftung(L.info, p[0].x, p[0].y + (a.b || 60) / 2 + 3, 6, t('kanal')(a.b || 60, a.tiefe || 10, seite));
      }
    }
  }
  for (const b of k.bohrungen || []) {
    ent += kreis(L.bohrung, b.x + ox, H - b.y + oy, b.d / 2);
  }

  // Klartext neben dem Teil, damit an der Maschine klar ist, was das ist
  if (opt.info !== false) {
    const kv = (c) => I.bez(I.KANTE, c || 'roh', spr);
    const kk = k.kante || {};
    const kant = kk.umlaufend !== undefined
      ? `${t('kanten')} ${t('umlaufend')}: ${kv(kk.umlaufend)}`
      : `${t('kanten')} ${t('vorne')} / ${t('hinten')} / ${t('links')} / ${t('rechts')}: `
        + ['vorne', 'hinten', 'links', 'rechts'].map((x) => kv(kk[x])).join(' / ');
    const mass = rund ? `D ${B}` : k.form === 'lform'
      ? `L ${B} x ${H}  ${t('ausklinkung')} ${k.lform.aw} x ${k.lform.ah} ${k.lform.pos}${k.lform.schraeg ? ` ${t('schraeg')} ${k.lform.winkel}deg${k.lform.sb > 0 ? ` B ${k.lform.sb}` : ''}` : ''}`
      : `${B} x ${H}`;
    const zeilen = [
      `${k.zeichnungsnummer || ''} V${k.version || 1}   ${k.bestellnummer || ''}  ${t('position')} ${k.position || 1}`,
      `${I.bez(I.MATERIAL, k.material, spr)} ${k.staerke_mm} mm   ${I.bez(I.DEKOR, k.dekor, spr)}`,
      `${mass} mm  (${t('fertigmass')})`,
      kant + (k.kante_abs_farbe && k.kante_abs_farbe !== 'dekor' ? `  ${t('abs_farbe')}: ${I.bez(I.ABS_FARBE, k.kante_abs_farbe, spr)}` : '') + (k.kante_lackiert ? `  ${t('lackiert')}` : ''),
      `${t('menge')}: ${k.menge ?? 1} ${t('stueck')}`,
      t('cam_hinweis'),
    ];
    const hw = k.hinweise ? (Array.isArray(k.hinweise) ? k.hinweise : (k.hinweise[spr] || k.hinweise.de || [])) : [];
    for (const h of hw) zeilen.push(String(h));
    zeilen.forEach((zz, i) => { ent += beschriftung(L.info, ox, oy - 20 - i * 12, 8, zz); });
  }

  let s = '';
  s += paar(0, 'SECTION') + paar(2, 'HEADER')
     + paar(9, '$ACADVER') + paar(1, 'AC1009')
     + paar(9, '$INSUNITS') + paar(70, 4)
     + paar(9, '$MEASUREMENT') + paar(70, 1)
     + paar(9, '$EXTMIN') + paar(10, f(ox)) + paar(20, f(oy - 120)) + paar(30, f(0))
     + paar(9, '$EXTMAX') + paar(10, f(B + ox)) + paar(20, f(H + oy)) + paar(30, f(0))
     + paar(0, 'ENDSEC');
  s += paar(0, 'SECTION') + paar(2, 'TABLES') + paar(0, 'TABLE') + paar(2, 'LAYER')
     + paar(70, LAYER.length);
  for (const [name, farbe] of LAYER) {
    s += paar(0, 'LAYER') + paar(2, name) + paar(70, 0) + paar(62, farbe) + paar(6, 'CONTINUOUS');
  }
  s += paar(0, 'ENDTAB') + paar(0, 'ENDSEC');
  s += paar(0, 'SECTION') + paar(2, 'ENTITIES') + ent + paar(0, 'ENDSEC');
  s += paar(0, 'EOF');
  return s;
}
