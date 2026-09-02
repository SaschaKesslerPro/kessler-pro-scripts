/*
 * Sprachen der Zeichnung. de | pl | en
 *
 * Material, Dekor und Kantenart kommen als CODE aus dem Konfigurator (dieselben
 * Schluessel wie in dist/konfigurator.js), nicht als fertiger Text. Nur so
 * laesst sich dieselbe Bestellung in jeder Sprache zeichnen: Kundenexemplar in
 * der Sprache des Shops, Werkstattexemplar immer auf Polnisch.
 */

export const T = {
  de: {
    untertitel: 'Technische Zeichnung zur Fertigungsfreigabe',
    draufsicht: 'Draufsicht · alle Maße in mm',
    kanten: 'Kanten',
    hinten: 'hinten (oben)', vorne: 'vorne (unten)', links: 'links', rechts: 'rechts',
    umlaufend: 'umlaufend',
    kantenansicht: 'Kantenansicht',
    bestellung: 'Bestellung', artikel: 'Artikel', material: 'Material',
    dekor: 'Dekor', form: 'Form', f_rechteck: 'Rechteck', f_rund: 'Rund', f_lform: 'L-Form',
    f_naehtisch: 'Nähtischplatte',
    zuschnitt: 'Zuschnittmaß', fertigmass: 'Fertigmaß',
    cam_hinweis: 'Kontur ohne Werkzeugkorrektur. Radius und Aufmaß setzt die CAM.',
    kunde: 'Kunde', datum: 'Datum',
    position: 'Position', menge: 'Menge', staerke: 'Stärke',
    massstab: 'Maßstab', zeichnung: 'Zeichnung',
    stueck: 'Stück', von: 'von',
    freigabe: 'Freigabe',
    freigabe_offen: 'offen — bitte per E-Mail-Link bestätigen',
    freigabe_hinweis: 'Ohne Freigabe keine Fertigung. Ohne Widerspruch gilt sie nach 72 Stunden als erteilt.',
    freigabe_erteilt: 'Maße vom Kunden bestätigt. Diese Zeichnung ist die Fertigungsgrundlage.',
    freigabe_auto: 'Nach 72 Stunden ohne Widerspruch freigegeben. Diese Zeichnung ist die Fertigungsgrundlage.',
    bohrungen: (na, d) => `Bohrungen: ${na} × Ø ${d} mm, durchgehend`,
    bohrung_mittig: (d) => `Bohrung mittig, Ø ${d} mm, durchgehend`,
    montagebohrungen: (d, ab) => `Montagebohrungen 4 × Ø ${d} mm, je ${ab} mm von den Kanten`,
    exemplar_kunde: 'Kundenexemplar',
    exemplar_produktion: 'Werkstattexemplar',
    entspricht: (nr, v) => `entspricht Kundenzeichnung ${nr} V${v}`,
    ausklinkung: 'Ausklinkung', schraeg: 'schräg', gerade: 'gerade', winkel: 'Winkel',
    innenecke: (r) => `Innenecke R ${r} (Fertigungsregel)`,
    kanal: (w, tf, seite) => `Kabelkanal, Nut ${w} × ${tf} mm tief, ${seite}`,
    oberseite: 'Oberseite', unterseite: 'Unterseite',
    kontur: (np) => `Freie Kontur, ${np} Punkte`,
    massband: (len, null_) => `Maßband ${len} cm, Nullpunkt ${null_}`,
    massband_laser: 'gelasert', massband_sticker: 'Aufkleber',
    maschine: (name) => `Nähmaschine: ${name}`,
    lackiert: 'lackiert (seidenmatt)',
    abs_farbe: 'ABS-Farbe',
  },
  pl: {
    untertitel: 'Rysunek techniczny — zwolnienie do produkcji',
    draufsicht: 'Widok z góry · wszystkie wymiary w mm',
    kanten: 'Krawędzie',
    hinten: 'tył (góra)', vorne: 'przód (dół)', links: 'lewa', rechts: 'prawa',
    umlaufend: 'dookoła',
    kantenansicht: 'Widok krawędzi',
    bestellung: 'Zamówienie', artikel: 'Artykuł', material: 'Materiał',
    dekor: 'Dekor', form: 'Kształt', f_rechteck: 'Prostokąt', f_rund: 'Okrągły', f_lform: 'Kształt L',
    f_naehtisch: 'Blat do maszyny',
    zuschnitt: 'wymiar cięcia', fertigmass: 'wymiar gotowy',
    cam_hinweis: 'Kontur bez korekcji narzędzia. Promień i naddatek ustawia CAM.',
    kunde: 'Klient', datum: 'Data',
    position: 'Pozycja', menge: 'Ilość', staerke: 'Grubość',
    massstab: 'Skala', zeichnung: 'Rysunek',
    stueck: 'szt.', von: 'z',
    freigabe: 'Zatwierdzenie',
    freigabe_offen: 'oczekuje — potwierdź linkiem z e-maila',
    freigabe_hinweis: 'Bez zatwierdzenia nie ruszamy z produkcją. Brak sprzeciwu w ciągu 72 godzin oznacza zatwierdzenie.',
    freigabe_erteilt: 'Wymiary potwierdzone przez klienta. Ten rysunek jest podstawą produkcji.',
    freigabe_auto: 'Zatwierdzone po 72 godzinach bez sprzeciwu. Ten rysunek jest podstawą produkcji.',
    bohrungen: (na, d) => `Otwory: ${na} × Ø ${d} mm, przelotowe`,
    bohrung_mittig: (d) => `Otwór centralnie, Ø ${d} mm, przelotowy`,
    montagebohrungen: (d, ab) => `Otwory montażowe 4 × Ø ${d} mm, po ${ab} mm od krawędzi`,
    exemplar_kunde: 'Egzemplarz klienta',
    exemplar_produktion: 'Egzemplarz produkcyjny',
    entspricht: (nr, v) => `zgodny z rysunkiem klienta ${nr} V${v}`,
    ausklinkung: 'Wycięcie', schraeg: 'ukośne', gerade: 'proste', winkel: 'Kąt',
    innenecke: (r) => `Narożnik wewnętrzny R ${r} (zasada produkcji)`,
    kanal: (w, tf, seite) => `Kanał kablowy, rowek ${w} × ${tf} mm głęb., ${seite}`,
    oberseite: 'góra', unterseite: 'spód',
    kontur: (np) => `Kontur dowolny, ${np} punktów`,
    massband: (len, null_) => `Miarka ${len} cm, zero ${null_}`,
    massband_laser: 'laserowana', massband_sticker: 'naklejka',
    maschine: (name) => `Maszyna: ${name}`,
    lackiert: 'lakierowana (półmat)',
    abs_farbe: 'Kolor ABS',
  },
  en: {
    untertitel: 'Technical drawing for production release',
    draufsicht: 'Top view · all dimensions in mm',
    kanten: 'Edges',
    hinten: 'back (top)', vorne: 'front (bottom)', links: 'left', rechts: 'right',
    umlaufend: 'all round',
    kantenansicht: 'Edge view',
    bestellung: 'Order', artikel: 'Item', material: 'Material',
    dekor: 'Finish', form: 'Shape', f_rechteck: 'Rectangular', f_rund: 'Round', f_lform: 'L-shape',
    f_naehtisch: 'Sewing table top',
    zuschnitt: 'cut size', fertigmass: 'finished size',
    cam_hinweis: 'Contour without tool compensation. Radius and allowance set by CAM.',
    kunde: 'Customer', datum: 'Date',
    position: 'Item no.', menge: 'Quantity', staerke: 'Thickness',
    massstab: 'Scale', zeichnung: 'Drawing',
    stueck: 'pcs', von: 'of',
    freigabe: 'Release',
    freigabe_offen: 'pending — confirm via the e-mail link',
    freigabe_hinweis: 'No production without release. Without objection within 72 hours it is deemed granted.',
    freigabe_erteilt: 'Dimensions confirmed by the customer. This drawing is the basis for production.',
    freigabe_auto: 'Released after 72 hours without objection. This drawing is the basis for production.',
    bohrungen: (na, d) => `Holes: ${na} × Ø ${d} mm, through`,
    bohrung_mittig: (d) => `Hole centred, Ø ${d} mm, through`,
    montagebohrungen: (d, ab) => `Mounting holes 4 × Ø ${d} mm, ${ab} mm from the edges`,
    exemplar_kunde: 'Customer copy',
    exemplar_produktion: 'Workshop copy',
    entspricht: (nr, v) => `matches customer drawing ${nr} V${v}`,
    ausklinkung: 'Notch', schraeg: 'angled', gerade: 'straight', winkel: 'Angle',
    innenecke: (r) => `Inner corner R ${r} (production rule)`,
    kanal: (w, tf, seite) => `Cable channel, groove ${w} × ${tf} mm deep, ${seite}`,
    oberseite: 'top side', unterseite: 'underside',
    kontur: (np) => `Free contour, ${np} points`,
    massband: (len, null_) => `Measuring tape ${len} cm, zero ${null_}`,
    massband_laser: 'lasered', massband_sticker: 'sticker',
    maschine: (name) => `Sewing machine: ${name}`,
    lackiert: 'lacquered (satin)',
    abs_farbe: 'ABS colour',
  },
};

/* Codes wie in dist/konfigurator.js (MATERIALS, DEKOR_*, EDGEPROFILES) */
export const MATERIAL = {
  dekor:   { de: 'Möbelplatte',      pl: 'Płyta meblowa',        en: 'Furniture board' },
  mpx:     { de: 'Multiplex Birke',  pl: 'Sklejka brzozowa',     en: 'Birch plywood' },
  mpx_hpl: { de: 'Multiplex + HPL',  pl: 'Sklejka + HPL',        en: 'Plywood + HPL' },
  compact: { de: 'Compact / HPL',    pl: 'Płyta kompaktowa HPL', en: 'Compact HPL' },
  szwal:   { de: 'Nähtischplatte',   pl: 'Blat do maszyny',      en: 'Sewing table top' },
};

export const DEKOR = {
  'weiss':          { de: 'Weiß',                 pl: 'Biały',              en: 'White' },
  'alaska-weiss':   { de: 'Alaska Weiß',          pl: 'Biały Alaska',       en: 'Alaska white' },
  'sosna-bielona':  { de: 'Kiefer Weiß',          pl: 'Sosna bielona',      en: 'Bleached pine' },
  'kaszmir':        { de: 'Kaschmir',             pl: 'Kaszmir',            en: 'Cashmere' },
  'szary':          { de: 'Grau',                 pl: 'Szary',              en: 'Grey' },
  'schwarz':        { de: 'Schwarz',              pl: 'Czarny',             en: 'Black' },
  'czarny':         { de: 'Schwarz',              pl: 'Czarny',             en: 'Black' },
  'ahorn':          { de: 'Ahorn',                pl: 'Klon',               en: 'Maple' },
  'buk':            { de: 'Buche',                pl: 'Buk',                en: 'Beech' },
  'sonoma-eiche':   { de: 'Eiche Sonoma',         pl: 'Dąb sonoma',         en: 'Sonoma oak' },
  'eiche-artison':  { de: 'Eiche Artison',        pl: 'Dąb artisan',        en: 'Artisan oak' },
  'hikora':         { de: 'Eiche Hickory',        pl: 'Dąb hickory',        en: 'Hickory oak' },
  'sperrholz-natur':{ de: 'Birke natur',          pl: 'Brzoza naturalna',   en: 'Natural birch' },
  'marmor-weiss':   { de: 'Weißer Marmor',        pl: 'Marmur biały',       en: 'White marble' },
  'marmor-schwarz': { de: 'Schwarzer Marmor',     pl: 'Marmur czarny',      en: 'Black marble' },
  'sz-weiss':       { de: 'Weiß',                 pl: 'Biały',              en: 'White' },
  'sz-gewebe':      { de: 'Gewebestruktur Weiß',  pl: 'Biały, struktura tkaniny', en: 'White, fabric texture' },
  'sz-grau':        { de: 'Grau',                 pl: 'Szary',              en: 'Grey' },
  'sz-schwarz':     { de: 'Schwarz',              pl: 'Czarny',             en: 'Black' },
};

export const KANTE = {
  abs:      { de: 'ABS 2 mm',       pl: 'ABS 2 mm',          en: 'ABS 2 mm' },
  nicht:    { de: 'nicht gefräst',  pl: 'niefrezowana',      en: 'not milled' },
  f45:      { de: 'gefräst 45°',    pl: 'frezowana 45°',     en: 'milled 45°' },
  fase:     { de: 'gefast 45°',     pl: 'fazowana 45°',      en: 'chamfered 45°' },
  halbrund: { de: 'halbrund',       pl: 'półokrągła',        en: 'half round' },
  roh:      { de: 'geschliffen',    pl: 'szlifowana',        en: 'sanded' },
};

export const ABS_FARBE = {
  dekor: { de: 'dekorgleich', pl: 'w kolorze dekoru', en: 'matching decor' },
  weiss: { de: 'Weiß', pl: 'Biały', en: 'White' }, popiel: { de: 'Asche Grau', pl: 'Popiel', en: 'Ash grey' },
  dunkelgrau: { de: 'Dunkelgrau', pl: 'Ciemnoszary', en: 'Dark grey' }, schwarz: { de: 'Schwarz', pl: 'Czarny', en: 'Black' },
  gruen: { de: 'Grün', pl: 'Zielony', en: 'Green' }, rot: { de: 'Rot', pl: 'Czerwony', en: 'Red' },
  gelb: { de: 'Gelb', pl: 'Żółty', en: 'Yellow' }, blau: { de: 'Blau', pl: 'Niebieski', en: 'Blue' },
};

/** Code nachschlagen; unbekannte Werte unveraendert durchreichen. */
export function bez(tabelle, code, spr) {
  if (code == null) return '';
  const e = tabelle[code];
  return e ? (e[spr] ?? e.de) : String(code);
}

/** Zahl mit dem Trennzeichen der Sprache. */
export function zahl(v, spr) {
  const s = Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
  return spr === 'en' ? s : s.replace('.', ',');
}

/** Datum aus ISO (2026-08-26) in die Schreibweise der Sprache. */
export function datum(iso, spr) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
  const [j, m, t] = iso.slice(0, 10).split('-');
  if (spr === 'en') return `${j}-${m}-${t}`;
  return `${t}.${m}.${j}`;
}

/** Freitext je Sprache. Nimmt {de,pl,en} oder einen einzelnen String. */
export function text(feld, spr) {
  if (!feld) return '';
  if (typeof feld === 'string') return feld;
  return feld[spr] ?? feld.de ?? Object.values(feld)[0] ?? '';
}

/** Nur die ABS-Kante ist ein Umleimer und wird in der Zeichnung farbig markiert.
    Gefraeste, gefaste, halbrunde und geschliffene Kanten sind Bearbeitungen der
    Schichtkante selbst. */
const BEKANTET = new Set(['abs', 'abs1', 'abs2']);
export const istBekantet = (code) => BEKANTET.has(code);

export const SPRACHEN = ['de', 'pl', 'en'];
