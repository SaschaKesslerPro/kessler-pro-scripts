/* ═══════════════════════════════════════════════════════════════════════════
   Kessler PRO — Preisberechnung Konfigurator
   Stand 02.09.2026 · Preiswerk vom 29.08.2026

   Ersetzt das bisherige Modell (flacher zl/m2-Satz je Material/Staerke,
   RATE + eur()) durch:

     ① Katalogtreffer  — jede Groesse, die es im Shop gibt, liefert exakt den
                         Katalogpreis. Auch mit vertauschtem L/B.
     ② Kurve           — Sondermasse werden zwischen den Katalogpunkten
                         interpoliert, je Material, Staerke, Form UND
                         Dekorstufe. Der m2-Preis ist damit groessenabhaengig.
     ③ Aufpreise       — feste Betraege laut PREISREGEL vom 26.08.2026.

   Reine Funktionen, keine DOM-Abhaengigkeit, kein Zustand.
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

/* ─── Aufpreise (PREISREGEL-Bearbeitungen-Konfigurator-26-08-2026) ───────── */
const AUFPREIS = {
  kabeldurchlass: 9.90,          // jede Groesse
  armaturenbohrung: 9.90,        // jede Groesse
  steckdose: 14.90,
  spuele: 39.90,
  induktionsfeld: 39.90,
  naehmaschine: 40.00,           // pauschal, jede Groesse
  montagebohrungen: 9.90,        // 4x D8
};
/* Freie Ausschnitte: kalibriert auf Steckdose 100x50 mm = 14,90 und
   Spuele 560x480 mm = 39,90. Schnittlaenge = Umfang, nicht Flaeche. */
const FREI = { basis: 10.70, lfm: 13.90, minimum: 14.90 };
/* Eckradien: gestaffelt nach Anzahl gerundeter Ecken, nicht je Ecke. */
const RADIEN = [0, 19.90, 29.90, 34.90, 39.90];   // Index = Anzahl Ecken, ab 4 gedeckelt
/* Kantenprofile je lfm. Unveraendert aus v1.16.1 uebernommen. */
const KANTE = {
  dekor:   { abs: 0 },                                   // ABS 2 mm R2 = inklusive
  mpx:     { nicht: 0, f45: 5, halbrund: 8, abs: 0 },
  szwal:   { nicht: 0, f45: 5, halbrund: 8, abs: 0 },
  compact: { roh: 0, fase: 7, halbrund: 8 },
};
const KANTE_LACK = { nicht: 5, f45: 10, halbrund: 16 }; // ersetzt den Grundpreis
const MASSBAND = { none: 0, laser: 15, sticker: 10 };   // nur Naehtischplatte

/* Naehmaschine — Standardmasse in mm (Senior 26.08.2026) */
const NAEHMASCHINE_MASSE = [[480,181],[520,181],[617,181]];

/* Fertigungsgrenzen, aus RULES des Konfigurators */
const GRENZEN = {
  dekor:   { maxL:270, maxB:200, maxD:160, minRadius:30 },
  compact: { maxL:238, maxB:120, maxD:120, minRadius:0 },
  mpx:     { maxL:238, maxB:120, maxD:120, minRadius:0 },
  szwal:   { maxL:240, maxB:120, maxD:120, minRadius:0 },
};

/* ─── Rundung ────────────────────────────────────────────────────────────── */
/* Alle Preise enden auf ,90 — aufgerundet, nie abgerundet. */
function auf90(v){
  return Math.ceil(v - 0.90 - 1e-9) + 0.90;
}

/* ─── Geometrie ──────────────────────────────────────────────────────────── */
/* Alle Eingaben in cm. Rueckgabe: Flaeche in m2, Umfang und Schnittlaenge in m. */
function geometrie(k){
  const f = k.form;
  if (f === 'round'){
    const d = +k.D;
    return { flaeche: Math.PI*Math.pow(d/200,2), umfang: Math.PI*d/100, schnitt: 0, ecken: 0 };
  }
  if (f === 'lform'){
    const L = +k.lf.L, B = +k.lf.B, aw = +k.lf.aw, ah = +k.lf.ah;
    const winkel = (k.lf.winkel === undefined || k.lf.winkel === null) ? 90 : +k.lf.winkel;
    const schraeg = Math.abs(winkel - 90) > 0.5;
    /* Flaeche = umschliessendes Rechteck. Die Rohplatte wird in dieser Groesse
       eingekauft; das Weggenommene ist Verschnitt, kein Rabatt. */
    const flaeche = L*B/1e4;
    let schnitt, umfang;
    if (schraeg){
      schnitt = Math.sqrt(aw*aw + ah*ah)/100;          // eine Diagonale
      umfang  = (2*(L+B) - aw - ah)/100 + schnitt;
    } else {
      schnitt = (aw + ah)/100;                          // zwei Innenkanten
      umfang  = 2*(L+B)/100;                            // identisch zum Rechteck
    }
    return { flaeche, umfang, schnitt, ecken: 5, schraeg };
  }
  const L = +k.L, B = +k.B;
  return { flaeche: L*B/1e4, umfang: 2*(L+B)/100, schnitt: 0, ecken: 4 };
}

/* ─── Grundpreis ─────────────────────────────────────────────────────────── */
function fm1(v){ v = +v; return v === Math.trunc(v) ? String(v) : String(v).replace('.', ','); }

function katalogSchluessel(mat, form, dekor, thick, a, b){
  return mat+'|'+form+'|'+dekor+'|'+thick+'|'+(form === 'round' ? 'D'+fm1(a) : fm1(a)+'x'+fm1(b));
}

/* Trifft die Konfiguration eine Lagergroesse? L und B duerfen vertauscht sein. */
function katalogtreffer(k, matrix){
  if (k.form !== 'rect' && k.form !== 'round') return null;   // L-Form nie ab Lager
  if (k.mat === 'mpx' && k.mpxSurface && k.mpxSurface !== 'natur') return null;
  const dek = k.mat === 'mpx' ? 'sperrholz-natur' : k.dekor;
  if (k.form === 'round'){
    return matrix[katalogSchluessel(k.mat,'round',dek,k.thick,+k.D)] || null;
  }
  const a = Math.max(+k.L,+k.B), b = Math.min(+k.L,+k.B);
  return matrix[katalogSchluessel(k.mat,'rect',dek,k.thick,a,b)]
      || matrix[katalogSchluessel(k.mat,'rect',dek,k.thick,b,a)] || null;
}

/* Welche Kurve gilt fuer diese Konfiguration? */
function kurvenSchluessel(k, kurven){
  const roh = k.mat+'|'+k.thick+'|'+(k.form === 'round' ? 'round' : 'rect');
  const dek = k.mat === 'mpx' ? 'sperrholz-natur' : k.dekor;
  for (const stufe of ['premium','basis','standard']){
    const kk = roh+'|'+stufe;
    if (kurven[kk] && kurven[kk].dekore.indexOf(dek) >= 0) return kk;
  }
  return kurven[roh+'|standard'] ? roh+'|standard' : null;
}

/* Preis auf der Kurve. Innerhalb der Stuetzpunkte linear, ausserhalb mit der
   Randsteigung weiter, nach unten begrenzt. */
function aufDerKurve(kurve, flaeche){
  const p = kurve.punkte;
  if (!p.length) return null;
  const A = flaeche;
  let roh;
  if (A <= p[0][0])                    roh = p[0][0] === A ? p[0][1] : p[0][1] - kurve.randsteigung*(p[0][0]-A);
  else if (A >= p[p.length-1][0])      roh = p[p.length-1][1] + kurve.randsteigung*(A - p[p.length-1][0]);
  else {
    let i = 0; while (p[i+1][0] < A) i++;
    const [x0,y0] = p[i], [x1,y1] = p[i+1];
    roh = y0 + (y1-y0)*(A-x0)/(x1-x0);
  }
  return auf90(Math.max(roh, kurve.mindestpreis));
}

/* Deckel: ein Sondermass darf nie mehr kosten als die kleinste Lagerplatte,
   aus der es sich schneiden liesse. Faengt Unstimmigkeiten im Katalog ab —
   z. B. steht 18 mm premium 90x60 bei 54,90 und 80x60 bei 59,90, ohne Deckel
   kaeme 99x59 auf 60,90 und damit ueber die 59,90 der 100x60. */
const _index = new WeakMap();
function katalogIndex(matrix){
  let ix = _index.get(matrix);
  if (ix) return ix;
  ix = {};
  for (const key in matrix){
    const t = key.split('|');
    const pre = t[0]+'|'+t[1]+'|'+t[2]+'|'+t[3];
    const mass = t[4];
    let e;
    if (t[1] === 'round') e = { d: +mass.slice(1).replace(',','.') };
    else { const ab = mass.split('x').map(x => +x.replace(',','.')); e = { L: ab[0], B: ab[1] }; }
    e.preise = matrix[key];
    (ix[pre] || (ix[pre] = [])).push(e);
  }
  _index.set(matrix, ix);
  return ix;
}
function deckel(k, matrix, kanal){
  const dek = k.mat === 'mpx' ? 'sperrholz-natur' : k.dekor;
  const liste = katalogIndex(matrix)[k.mat+'|'+k.form+'|'+dek+'|'+k.thick];
  if (!liste) return null;
  let best = null;
  for (const e of liste){
    let passt;
    if (k.form === 'round') passt = e.d >= +k.D - 1e-9;
    else {
      const a = Math.max(+k.L,+k.B), b = Math.min(+k.L,+k.B);
      const ea = Math.max(e.L,e.B), eb = Math.min(e.L,e.B);
      passt = ea >= a - 1e-9 && eb >= b - 1e-9;
    }
    const v = e.preise[kanal];
    if (passt && v != null && (best === null || v < best)) best = v;
  }
  return best;
}

/* Grundpreis: Katalog schlaegt Kurve. */
function grundpreis(k, daten, kanal){
  kanal = kanal || 'eur';
  const treffer = katalogtreffer(k, daten.matrix);
  if (treffer && treffer[kanal] != null){
    return { betrag: treffer[kanal], quelle: 'katalog', artikel: treffer };
  }
  const ks = kurvenSchluessel(k, daten.kurven);
  if (!ks) return { betrag: null, quelle: 'unbekannt', artikel: null };
  const kurve = daten.kurven[ks].kanaele[kanal];
  const g = geometrie(k);
  let betrag = aufDerKurve(kurve, g.flaeche);
  const kappe = deckel(k, daten.matrix, kanal);
  const gedeckelt = kappe != null && betrag > kappe;
  if (gedeckelt) betrag = kappe;
  return { betrag, quelle: 'kurve', kurve: ks, flaeche: g.flaeche, gedeckelt, artikel: null };
}

/* ─── Kante ──────────────────────────────────────────────────────────────── */
function kantenLfm(k, profil){
  if (k.lack && (k.mat === 'mpx' || k.mat === 'szwal') && KANTE_LACK[profil] !== undefined)
    return KANTE_LACK[profil];
  const tab = KANTE[k.mat] || {};
  return tab[profil] || 0;
}
function kantenpreis(k){
  const g = geometrie(k);
  if (k.form === 'rect' && Array.isArray(k.edges) && k.edges.length === 4){
    const len = [+k.L, +k.B, +k.L, +k.B];
    return k.edges.reduce((s,e,i) => s + kantenLfm(k,e)*len[i]/100, 0);
  }
  const e = (Array.isArray(k.edges) ? k.edges[0] : k.edges) || Object.keys(KANTE[k.mat]||{})[0];
  return kantenLfm(k, e) * g.umfang;
}

/* ─── Bearbeitungen ──────────────────────────────────────────────────────── */
/* Freier Ausschnitt: nach Schnittlaenge, nie unter dem Steckdosenpreis. */
function freierAusschnitt(schnittMeter){
  return Math.max(FREI.minimum, auf90(FREI.basis + FREI.lfm*schnittMeter));
}
function schnittlaenge(c){
  if (c.t === 'c') return Math.PI*(+c.d)/100;                 // Kreis, d in cm
  return 2*((+c.w) + (+c.h))/100;                             // Rechteck, cm
}
function bearbeitungspreis(c){
  if (c.preset && AUFPREIS[c.preset] !== undefined) return AUFPREIS[c.preset];
  return freierAusschnitt(schnittlaenge(c));
}
/* Eckradien: Staffel nach Anzahl, nicht je Ecke. */
function radienpreis(anzahl){
  if (anzahl <= 0) return 0;
  return RADIEN[Math.min(anzahl, RADIEN.length-1)];
}

/* ─── Gesamtpreis ────────────────────────────────────────────────────────── */
function preis(k, daten, opt){
  opt = opt || {};
  const kanal = opt.kanal || 'eur';
  const g = geometrie(k);
  const gp = grundpreis(k, daten, kanal);
  const zeilen = [];

  zeilen.push({ code:'grund', text:'Platte', betrag: gp.betrag, quelle: gp.quelle });

  const kante = kantenpreis(k);
  if (kante > 0) zeilen.push({ code:'kante', text:'Kantenbearbeitung'+(k.lack?', lackiert':''), betrag: Math.round(kante*100)/100 });

  const ecken = radienpreis(k.eckenAnzahl || 0);
  if (ecken > 0) zeilen.push({ code:'radien', text:(k.eckenAnzahl)+' Ecke'+(k.eckenAnzahl>1?'n':'')+' gerundet', betrag: ecken });

  /* Der Schnitt, der das L erzeugt — nach der Formel fuer freie Ausschnitte,
     gerechnet auf die innere Schnittlaenge. */
  if (k.form === 'lform' && g.schnitt > 0){
    zeilen.push({ code:'lform', text:'Ausklinkung'+(g.schraeg?' (schraeg)':''), betrag: freierAusschnitt(g.schnitt) });
  }

  (k.cuts || []).forEach(c => {
    zeilen.push({ code:'cut', text: c.label || 'Ausschnitt', betrag: bearbeitungspreis(c) * (c.anzahl || 1) });
  });

  if (k.montagebohrungen) zeilen.push({ code:'bohr', text:'Montagebohrungen 4x D8', betrag: AUFPREIS.montagebohrungen });
  if (k.mat === 'szwal' && k.massband && MASSBAND[k.massband])
    zeilen.push({ code:'massband', text:'Massband', betrag: MASSBAND[k.massband] });

  const summe = zeilen.reduce((s,z) => s + (z.betrag || 0), 0);
  return {
    kanal, geometrie: g, grundpreis: gp, zeilen,
    summe: Math.round(summe*100)/100,
    m2preis: gp.betrag != null && g.flaeche > 0 ? Math.round(gp.betrag/g.flaeche*100)/100 : null,
  };
}

module.exports = { preis, grundpreis, geometrie, katalogtreffer, kurvenSchluessel, deckel,
                   aufDerKurve, auf90, freierAusschnitt, radienpreis, kantenpreis,
                   AUFPREIS, FREI, RADIEN, KANTE, KANTE_LACK, GRENZEN, NAEHMASCHINE_MASSE };
