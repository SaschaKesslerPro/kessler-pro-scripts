/*
 * Adapter: Konfigurator-Zustand (S, cm, wie in dist/konfigurator.js) ->
 * Zeichnungsparameter (k, mm) fuer zeichnung.js und dxf.js.
 *
 * Der Zustand kommt aus der Bestellung: die Attribute _kfg_konfig_1..n einer
 * Position ergeben zusammen das JSON, das der Checkout-Worker beim Anlegen der
 * Draft Order abgelegt hat (attributeFuer in index.js).
 */

import { preisKern } from '../preis-kern.js';

const PRESET_LABEL = {
  kabel:     { de: 'Kabeldurchlass Ø60',            pl: 'Przepust kablowy Ø60',          en: 'Cable grommet Ø60' },
  kabel80:   { de: 'Kabeldurchlass Ø80',            pl: 'Przepust kablowy Ø80',          en: 'Cable grommet Ø80' },
  armatur:   { de: 'Armaturenbohrung Ø35',          pl: 'Otwór pod baterię Ø35',         en: 'Tap hole Ø35' },
  usb:       { de: 'Steckdosen-Ausschnitt',         pl: 'Wycięcie pod gniazdko',         en: 'Socket cut-out' },
  spuele:    { de: 'Spülen-Ausschnitt',             pl: 'Wycięcie pod zlew',             en: 'Sink cut-out' },
  induktion: { de: 'Induktionsfeld-Ausschnitt',     pl: 'Wycięcie pod płytę indukcyjną', en: 'Induction hob cut-out' },
  maschine:  { de: 'Ausschnitt für die Nähmaschine', pl: 'Wycięcie pod maszynę',         en: 'Sewing machine cut-out' },
};
const FREI_LABEL = {
  r: { de: 'Ausschnitt', pl: 'Wycięcie', en: 'Cut-out' },
  c: { de: 'Runder Ausschnitt', pl: 'Wycięcie okrągłe', en: 'Round cut-out' },
};

const BOHR_D = 8, BOHR_ABSTAND = 60;      // Montagebohrungen 4 x D8, 60 mm von den Kanten

/** Attribute einer Bestellposition ({key,value}[] oder Objekt) -> Konfiguration S. */
export function konfigAusAttributen(attribute) {
  const map = {};
  if (Array.isArray(attribute)) for (const a of attribute) map[a.key || a.name] = a.value;
  else Object.assign(map, attribute || {});
  let roh = '';
  for (let i = 1; i <= 12; i++) { const v = map[`_kfg_konfig_${i}`]; if (v == null) break; roh += v; }
  if (!roh) return null;
  let j;
  try { j = JSON.parse(roh); } catch (e) { return null; }
  return konfigAusRoh(j);
}

/** Das flache Roh-JSON aus den Attributen wieder in die S-Form bringen. */
export function konfigAusRoh(j) {
  const S = {
    mat: j.mat, dekor: j.dekor, mpxSurface: j.mpxSurface || (j.mat === 'mpx' && j.dekor && j.dekor !== 'sperrholz-natur' ? 'hpl' : 'natur'),
    absColor: j.absColor || 'dekor',
    form: j.form, L: +j.L || 120, B: +j.B || 60, D: +j.D || 80,
    lf: Object.assign({ L: 180, B: 120, aw: 90, ah: 60, pos: null, schnitt: 'gerade' }, j.lf || {}),
    thick: String(j.thick || '25'),
    corner: 0, cornerR: Array.isArray(j.cornerR) && j.cornerR.length === 4 ? j.cornerR.map(Number) : [0, 0, 0, 0],
    lfR: Array.isArray(j.lfR) && j.lfR.length === 5 ? j.lfR.map(Number) : [0, 0, 0, 0, 0],
    edgeR: 3, edges: Array.isArray(j.edges) && j.edges.length === 4 ? j.edges : ['abs', 'abs', 'abs', 'abs'],
    extras: { bohr: !!j.bohr, custom: false, lack: !!j.lack },
    massband: j.massband || 'none', massbandNull: j.massbandNull || 'links',
    machine: j.machine || '', maschineMass: j.maschineMass || '52x18.1',
    cuts: Array.isArray(j.cuts) ? j.cuts : [], draw: null, view: '2d',
  };
  S.corner = Math.max(0, ...(S.form === 'lform' ? S.lfR : S.cornerR));
  return S;
}

/**
 * S -> k. meta: { bestellnummer, kunde, datum, position, positionen, menge, sku,
 *                 zeichnungsnummer, version, freigabe, exemplar, maschine (Name) }
 */
export function konfigZuZeichnung(S, meta = {}) {
  const K = preisKern(S, {}, {}, 'de');
  const cm = (v) => Math.round((+v || 0) * 10 * 10) / 10;     // cm -> mm, 0,1 mm
  const d = K.dims();
  const k = {
    material: S.mat === 'mpx' && S.mpxSurface === 'hpl' ? 'mpx_hpl' : S.mat,
    dekor: S.mat === 'mpx' && S.mpxSurface !== 'hpl' ? 'sperrholz-natur' : S.dekor,
    staerke_mm: +S.thick,
    form: S.form === 'round' ? 'rund' : S.form === 'lform' ? 'lform' : 'rechteck',
    laenge_mm: cm(d.w), breite_mm: cm(d.h), durchmesser_mm: cm(S.D),
    ausschnitte: [], bohrungen: [],
    hinweise: { de: [], pl: [], en: [] },
    ...meta,
  };
  const hw = (de, pl, en) => { k.hinweise.de.push(de); k.hinweise.pl.push(pl); k.hinweise.en.push(en); };

  // Kanten: A=hinten, B=rechts, C=vorne, D=links; Rund und L-Form tragen eine Kante umlaufend
  if (S.form === 'rect') k.kante = { hinten: S.edges[0], rechts: S.edges[1], vorne: S.edges[2], links: S.edges[3] };
  else k.kante = { umlaufend: S.edges[0] };
  if (S.edges.includes('abs')) k.kante_abs_farbe = S.absColor || 'dekor';
  k.kante_lackiert = !!S.extras.lack && S.edges.some((e) => e !== 'abs');

  // Ecken
  if (S.form === 'rect') {
    k.eckradien_mm = { hl: +S.cornerR[0] || 0, hr: +S.cornerR[1] || 0, vr: +S.cornerR[2] || 0, vl: +S.cornerR[3] || 0 };
  }
  if (S.form === 'lform') {
    const g = K.lfGeo();
    const innen = S.mat === 'dekor' ? 50 : 10;
    k.lform = {
      L: cm(S.lf.L), B: cm(S.lf.B), aw: cm(S.lf.aw), ah: cm(S.lf.ah),
      pos: S.lf.pos || (S.mat === 'szwal' ? 'vr' : 'hr'),
      schraeg: !!g.schraeg, winkel: g.winkel,
      innenradius: g.schraeg ? 0 : innen,
      radien: (S.lfR || [0, 0, 0, 0, 0]).map((v) => +v || 0),
    };
    if (!g.schraeg) hw(`Innenecke der Ausklinkung R ${innen} mm (Fertigungsregel)`, `Narożnik wewnętrzny wycięcia R ${innen} mm (zasada produkcji)`, `Inner corner of the notch R ${innen} mm (production rule)`);
  }

  // Bearbeitungen (cm -> mm). Rechteck: x/y = Ecke hinten links des Ausschnitts.
  for (const c of S.cuts || []) {
    const label = c.preset ? PRESET_LABEL[c.preset] : FREI_LABEL[c.t];
    if (c.t === 'r') {
      k.ausschnitte.push({ typ: 'rechteck', x: cm(c.cx - c.w / 2), y: cm(c.cy - c.h / 2), b: cm(c.w), h: cm(c.h), r: +c.r || 0, label });
    } else if (c.t === 'c') {
      k.ausschnitte.push({ typ: 'kreis', cx: cm(c.cx), cy: cm(c.cy), d: cm(c.d), label });
    } else if (c.t === 'p') {
      const pts = (c.pts || []).map((p) => [cm(c.cx + p[0]), cm(c.cy + p[1])]);
      if (pts.length >= 3) k.ausschnitte.push({ typ: 'kontur', pts, r: +c.r || 0 });
    } else if (c.t === 'k') {
      const pts = kanalPunkte(c, d).map((p) => [cm(p[0]), cm(p[1])]);
      k.ausschnitte.push({ typ: 'kanal', pts, b: +c.w || 60, tiefe: +c.dp || 10, seite: c.seite === 'oben' ? 'oben' : 'unten', enden: c.enden || 'zu' });
    }
  }

  // Montagebohrungen 4 x D8 — wie in der Vorschau 60 mm von den Kanten, bei
  // grossen Eckradien nach innen geschoben (halber Radius dazu).
  if (S.extras.bohr) {
    const maxR = Math.max(0, ...(S.form === 'lform' ? S.lfR : S.cornerR).map(Number));
    const off = BOHR_ABSTAND + (maxR > 10 ? maxR * 0.5 : 0);
    const B = k.laenge_mm, H = k.breite_mm;
    let p;
    if (S.form === 'round') {
      const r = (B / 2 - off) / Math.SQRT2;
      p = [[B / 2 - r, H / 2 - r], [B / 2 + r, H / 2 - r], [B / 2 - r, H / 2 + r], [B / 2 + r, H / 2 + r]];
    } else if (S.form === 'lform') {
      const lf = k.lform, mx = lf.pos === 'hl' || lf.pos === 'vl', my = lf.pos === 'vr' || lf.pos === 'vl';
      // Ecke in der Ausklinkung auf den Schenkel neben der Ausklinkung setzen
      const inNotch = (x, y) => (mx ? x < lf.aw : x > B - lf.aw) && (my ? y > H - lf.ah : y < lf.ah);
      p = [[off, off], [B - off, off], [off, H - off], [B - off, H - off]].map(([x, y]) => {
        if (!inNotch(x, y)) return [x, y];
        const yy = my ? H - lf.ah - off : lf.ah + off;          // unter/ueber die Ausklinkung
        return [x, yy];
      });
    } else {
      p = [[off, off], [B - off, off], [off, H - off], [B - off, H - off]];
    }
    for (const [x, y] of p) k.bohrungen.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, d: BOHR_D });
    hw(`Montagebohrungen 4 × Ø ${BOHR_D} mm durchgehend, ${Math.round(off)} mm von den Kanten`,
       `Otwory montażowe 4 × Ø ${BOHR_D} mm przelotowe, ${Math.round(off)} mm od krawędzi`,
       `Mounting holes 4 × Ø ${BOHR_D} mm through, ${Math.round(off)} mm from the edges`);
  }

  // Massband der Naehtischplatte
  if (S.mat === 'szwal') {
    const st = K.massbandStrecke();
    if (st && S.massband !== 'none') k.massband = { typ: S.massband, x0: cm(st.x0), len: cm(st.len), rechts: !!st.rechts };
    const name = (meta.maschine || S.machine || '').trim();
    const mass = S.maschineMass === 'auto' ? null : String(S.maschineMass || '').replace('x', ' × ');
    hw(`Nähmaschine: ${name || '— nicht angegeben —'} · Ausschnitt ${mass ? mass + ' cm' : 'nach Maschine (wird von uns gemessen)'}`,
       `Maszyna: ${name || '— nie podano —'} · wycięcie ${mass ? mass + ' cm' : 'według maszyny (mierzymy sami)'}`,
       `Sewing machine: ${name || '— not specified —'} · cut-out ${mass ? mass + ' cm' : 'to the machine (measured by us)'}`);
  }

  return k;
}

/** Kabelkanal: gerader Zug, offene Enden bis an die naechste Kante (wie im Konfigurator). */
function kanalPunkte(c, d) {
  const L = Math.max(1, c.len || 10);
  const p = c.dir === 'quer' ? [[c.cx, c.cy - L / 2], [c.cx, c.cy + L / 2]] : [[c.cx - L / 2, c.cy], [c.cx + L / 2, c.cy]];
  const bisKante = (a, b) => {
    const vx = a[0] - b[0], vy = a[1] - b[1];
    if (!vx && !vy) return a;
    const kand = [];
    if (vx < 0) kand.push((0 - a[0]) / vx); if (vx > 0) kand.push((d.w - a[0]) / vx);
    if (vy < 0) kand.push((0 - a[1]) / vy); if (vy > 0) kand.push((d.h - a[1]) / vy);
    const t = Math.min(...kand.filter((v) => v >= 0));
    return isFinite(t) ? [a[0] + vx * t, a[1] + vy * t] : a;
  };
  const en = c.enden || 'zu';
  if (en.indexOf('a') >= 0) p[0] = bisKante(p[0], p[1]);
  if (en.indexOf('e') >= 0) p[p.length - 1] = bisKante(p[p.length - 1], p[p.length - 2]);
  return p;
}
