/*!
 * kessler-pro-scripts / plp.js
 *
 * v2.6.0 — GA4-Events: view_item_list (dedupe je Grundmenge), select_item, add_to_cart Quick-Add (11.07.2026)
 * v2.6.1 — Perf: Filterdaten commit-gepinnt + cachebar (kein no-store mehr) (13.07.2026)
 * v2.6.2 — i18n: Sortier-Optionen, Preis-Slider Von/Bis + aria, localeCompare je Locale (14.07.2026)
 * v2.6.3 — Fix: Compact-Tischplatten in CATSLUG + LOCMAP (Kategorieseite zeigte alle Produkte) (18.07.2026)
 * v2.6.4 — Perf: stündlicher Cache-Buster an @main-JSON-URLs (20.07.2026)
 * v2.6.5 — Nachttische: Kategorie Medizinschränke→Nachttische in CATSLUG (+nachttische-Alias) & LOCMAP (Szafki nocne/Bedside Tables) (24.07.2026)
 * Product Listing Page — client-rendered grid + faceted filtering.
 *
 * v2.5.0 — Facetten-Bridge für alle Filteroptionen (03.07.2026)
 *   - Suchanfragen mappen jetzt auf ALLE Facetten, nicht nur Maße:
 *     „AxB" → Breite+Tiefe, „N mm" → Dicke, Wort-Tokens → Farbe/Form/
 *     Kategorie/Räume (exakt, Präfix ab 6 Zeichen, Tippfehler lev≤1 ab 6).
 *   - Mischanfragen: „tischplatte 50x50 schwarz" → Facetten Breite 50 +
 *     Tiefe 50 + Farbe Schwarz, Rest („tischplatte") bleibt Titelsuche.
 *   - Mehrere Options-Treffer je Sektion = OR („eiche" → beide Eiche-Dekore).
 *   - Gelockte Sektion (Kategorie-/Raum-Template) wird übersprungen.
 * v2.4.0 — Maß-Suche → Facetten-Bridge (03.07.2026)
 *   - Suchanfragen wie „50x50" / „50 x 50" / „50×50" (optional mit cm/mm)
 *     werden nicht mehr als loser Titel-Textfilter angewandt (matchte jede
 *     „50" im Titel → 130×50-Tische), sondern setzen die Facetten
 *     Breite (cm) + Tiefe (cm) auf die passenden Werte. „50x50" wählt jetzt
 *     Breite=50 & Tiefe=50 (21 echte Treffer inkl. runde Ø50) statt 107.
 *   - Swap-Fallback für asymmetrische Maße (z. B. „50x130" → 130×50), wenn
 *     die direkte Orientierung keine Option hat. Existiert keine passende
 *     Facette, bleibt es bei der bisherigen Textsuche. q wird aus der URL
 *     entfernt, sobald es in Facetten übersetzt wurde (Chips = Facetten).
 *
 * v2.3.2 — Fix Empty-State-Layout (03.07.2026)
 *   - „Bald verfügbar"-State: Drawer wird NICHT mehr display:none gesetzt
 *     (nahm das aside aus dem Grid-Flow → #plp-grid rutschte in die
 *     0px-Drawer-Spalte und wurde zerquetscht). Drawer ist bei geschlossenem
 *     Zustand ohnehin unsichtbar; nur die Toolbar wird versteckt.
 *
 * v2.3.1 — Leere Sektionen aus, Empty-States (03.07.2026)
 *   - Filter-Sektionen, deren Optionen in der Grundmenge alle 0 Produkte haben
 *     (z. B. Form/Maße bei Tischgestellen), werden komplett ausgeblendet.
 *   - Empty-State „Bald verfügbar" wenn die Kategorie 0 Produkte hat
 *     (Medizinschränke/Regalzubehör); Toolbar+Drawer werden versteckt,
 *     Hero-Count zeigt „Bald verfügbar". CTA → /produkte.
 *   - Empty-State „Keine Produkte gefunden" wenn Filter 0 Treffer liefern,
 *     mit „Filter zurücksetzen"-Button. Beide lokalisiert DE/PL/EN.
 *
 * v2.3.0 — Lock-Modus für Kategorie-/Raum-Templates (03.07.2026)
 *   - Auf /produktkategorien/{slug} bzw. /raume/{slug} wird die Kategorie/der
 *     Raum HART gelockt: Grundmenge = nur diese Produkte (Counts, Preis-Slider,
 *     tote Optionen alles kategorie-scoped), die zugehörige Filter-Sektion im
 *     Drawer wird ausgeblendet (keine Checkbox, keine Pill, zählt nicht in
 *     den Filter-Button). Löst zugleich den Webflow-100-Karten-Cap auf den
 *     Kategorieseiten (Möbelplatten: 246 statt 85).
 *   - Hero-Count (.cat-hero-count / .raum-hero-count) wird live auf die echte
 *     Produktzahl gesetzt.
 *   - Produkt-Counter lokalisiert (Produkte / produkty·produktów / products,
 *     inkl. polnischer Pluralregeln; "von"/"z"/"of").
 *
 * v2.2.3 — Suche-Handoff, Form-Filter, Maß-tolerante Suche (02.07.2026)
 *   - URL-Parameter werden gelesen: ?q= (Textfilter), ?kategorie=, ?raume=,
 *     ?farbe=, ?form= — Checkboxen werden vorbelegt, q filtert Titel.
 *   - Neue Filter-Sektion "Form" (Rechteckig/Rund), client-seitig injiziert,
 *     lokalisiert DE/PL/EN. Daten kommen aus p.form (rechteckig|rund).
 *   - LOCMAP-Kategorien aktualisiert (Möbelplatten/Multiplex — Umbenennung 30.06.).
 *   - Maß-Normalisierung: "100x50", "100 x50", "100×50" matchen alle "100 × 50".
 *   - Kategorie-/Raum-Template-Support: /produktkategorien/{slug} bzw.
 *     /raume/{slug} (auch PL/EN-Pfade) belegen den passenden Filter vor.
 *
 * v2.1.0 — robuste Cart-Verdrahtung (21.06.2026)
 *   - Add-to-Cart deterministisch via fetchProduct(pid)->Variant->addToCart
 *     (kein sf-product/refetch mehr -> keine Race-Condition, keine Shopyflow-Warnungen).
 *
 * v2.0.0 — FULL REWRITE (21.06.2026)
 *   - Finsweet entfernt (cmsload/cmsfilter/cmssort raus).
 *   - Grid wird komplett client-seitig aus dist/plp-filterdata.json gerendert
 *     (loest Webflow-100-Karten-Cap; voller Katalog, skaliert).
 *     JSON wird FRISCH von @main geladen (stuendlich per GitHub Action regeneriert),
 *     NICHT vom commit-gepinnten Bootstrap-Pfad -> neue CMS-Produkte erscheinen
 *     automatisch.
 *   - Add-to-Cart: Karten tragen sf-product + sf-add-to-cart="1"; nach dem Render
 *     EIN Shopyflow.refetch() -> Shopyflow verdrahtet alle Karten nativ.
 *   - Wunschliste: kp-wl-toggle + data-*; bindet per Delegation, kpw:change nach Render.
 *   - Faceted Filter-Engine (OR innerhalb Sektion, AND ueber Sektionen):
 *     Kategorie, Raeume, Farbe, Breite/Tiefe/Dicke (rund -> Durchmesser), Preis.
 *   - Tote Optionen (0 Produkte global) ausgeblendet; Live-Counts je Option.
 *   - Pills, Counter, Clear-All, Sort an echte Filterung gehaengt.
 */
(function () {
  'use strict';

  var DATA_URL = (function(){
    // Commit-gepinnte URL aus eigener Script-src ableiten (immutable → voll cachebar);
    // Fallback @main nur, wenn plp.js nicht via jsDelivr-Pin geladen wurde.
    var self = (document.querySelector('script[src*="/dist/plp.js"]')||{}).src||'';
    return self ? self.replace(/plp\.js(?:\?.*)?$/,'plp-filterdata.json')
                : 'https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@main/dist/plp-filterdata.json'+'?v='+Math.floor(Date.now()/3600000);
  })();

  function injectStyle(css, id) {
    var s = document.createElement('style');
    s.id = id || 'plpcss';
    s.textContent = css;
    document.head.appendChild(s);
  }

  injectStyle(
    '#sort-select{background:#FAFAFA url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236A6A66\' stroke-width=\'1.6\'><path d=\'M6 9l6 6 6-6\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>") no-repeat right 10px center/14px}' +
      '@media(min-width:992px){' +
        'body:not(.is-drawer-open) .plp-shop-inner{grid-template-columns:0 1fr!important;gap:0!important}' +
        'body:not(.is-drawer-open) .plp-drawer{opacity:0;pointer-events:none;visibility:hidden}' +
        'body.is-drawer-open .plp-shop-inner{grid-template-columns:360px 1fr!important;gap:32px!important}' +
        'body.is-drawer-open .plp-grid{grid-template-columns:repeat(3,1fr)!important}' +
        'body:not(.is-drawer-open) .plp-grid{grid-template-columns:repeat(4,1fr)!important}' +
        '.product-card_wrapper{width:auto!important;max-width:none!important;min-width:0!important;flex-shrink:1!important;flex-basis:auto!important}' +
      '}' +
      '.product-card_content{padding-bottom:4px!important}' +
      '.product-card_wrapper.is-hidden{display:none!important}' +
      '.plp-filter-option.is-hidden,.w-dyn-item.is-hidden{display:none!important}' +
      '.plp-filter-count{font-feature-settings:"tnum";color:#9a9a96}' +
      '.plp-tags-row:empty{display:none}' +
      '.plp-clear-all.is-hidden,.plp-filter-btn-num:empty,.plp-filter-btn-num.is-zero{display:none}' +
      '.plp-drawer-close:hover{background:#F2F2F2;color:#0A0A0A}' +
      '.plp-drawer-apply:hover{background:#1a1a1a}' +
      '.plp-drawer-clear:hover{border-color:#0A0A0A;color:#0A0A0A}' +
      '.plp-filter-btn:hover{background:#1a1a1a}' +
      '.plp-clear-all:hover{color:#0A0A0A}' +
      '.plp-tag-x:hover{color:#0A0A0A}' +
      'body.is-drawer-open .plp-filter-btn{background:#FFFFFF;color:#0A0A0A;border:1px solid #0A0A0A}' +
      'body.is-drawer-open .plp-filter-btn-num{background:#0A0A0A;color:#F2F0EB}' +
      '@media(max-width:991px){' +
        '.plp-shop-inner{display:block!important;grid-template-columns:none!important;gap:0!important}' +
        '.product-card_wrapper{width:100%!important;max-width:none!important;min-width:0!important;flex-shrink:1!important;flex-basis:auto!important}' +
        '.plp-drawer{position:fixed!important;top:0!important;left:0;right:0;bottom:0;width:100%;max-height:100vh;background:#fff;z-index:9999;transform:translateX(-100%);transition:transform .3s;border-radius:0;display:block!important}' +
        'body.is-drawer-open .plp-drawer{transform:translateX(0)}' +
        'body.is-drawer-open{overflow:hidden}' +
        '.plp-drawer-inner{border:0;border-radius:0;height:100%;display:flex;flex-direction:column}' +
        '.plp-grid{grid-template-columns:1fr!important;gap:24px!important}' +
      '}' +
      '@media(max-width:479px){.plp-grid{grid-template-columns:1fr!important;gap:20px!important}}'
  );

  injectStyle(
    '.plp-drawer-inner{scrollbar-width:none;-ms-overflow-style:none}' +
      '.plp-drawer-inner::-webkit-scrollbar{display:none;width:0;height:0;background:transparent}' +
      '.plp-drawer,.plp-drawer-body,.plp-filter-list{scrollbar-width:none;-ms-overflow-style:none}' +
      '.plp-drawer::-webkit-scrollbar,.plp-drawer-body::-webkit-scrollbar,.plp-filter-list::-webkit-scrollbar{display:none;width:0;height:0;background:transparent}' +
      '.plp-filter-price-input,.plp-filter-price-sep{display:none!important}' +
      '.plp-price-slider{padding:8px 0;width:100%;box-sizing:border-box}' +
      '.plp-price-labels{display:flex;justify-content:space-between;margin-bottom:14px}' +
      '.plp-price-label-group--right{text-align:right}' +
      '.plp-price-label-tag{display:block;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#999;font-weight:500}' +
      '.plp-price-label-val{display:block;font-size:14px;font-weight:500;color:#0A0A0A;margin-top:2px;font-feature-settings:"tnum"}' +
      '.plp-price-track{position:relative;height:4px;background:#E5E3DD;border-radius:2px;margin:12px 8px}' +
      '.plp-price-fill{position:absolute;top:0;bottom:0;background:#0A0A0A;border-radius:2px}' +
      '.plp-price-knob{position:absolute;top:50%;width:18px;height:18px;background:#fff;border:2px solid #0A0A0A;border-radius:50%;transform:translate(-50%,-50%);cursor:grab;touch-action:none;outline:none;transition:box-shadow .12s;box-sizing:border-box}' +
      '.plp-price-knob:hover,.plp-price-knob:focus-visible{box-shadow:0 0 0 6px rgba(10,10,10,0.08)}' +
      '.plp-price-knob.is-dragging{cursor:grabbing;box-shadow:0 0 0 8px rgba(10,10,10,0.12)}' +
      '.plp-page-h1{font-weight:300!important}'
  );

  injectStyle(
    '.plp-filter-section.is-closed .plp-filter-body{display:none}' +
      '.plp-filter-checkbox{appearance:none;-webkit-appearance:none;width:16px;height:16px;border:1.5px solid #999;border-radius:3px;background-color:#fff;cursor:pointer;flex-shrink:0;margin:0}' +
      '.plp-filter-checkbox:checked{background-color:#0a0a0a;border-color:#0a0a0a}'
  );

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var LOC = (function () {
    var l = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (l.indexOf('pl') === 0) return 'pl';
    if (l.indexOf('en') === 0) return 'en';
    var pth = location.pathname.toLowerCase();
    if (pth.indexOf('/pl-pl') === 0 || pth.indexOf('/pl/') === 0) return 'pl';
    if (pth.indexOf('/en') === 0) return 'en';
    return 'de';
  })();
  var LP = LOC === 'pl' ? '/pl-pl' : (LOC === 'en' ? '/en' : '');
  // Audit 8b: PL/EN filter labels -> DE canonical (filterdata.json stores DE values)
  var LOCMAP = {"pl": {"cats": {"Blaty Compact": "Compact-Tischplatten", "Szafki nocne": "Nachttische", "Szafki medyczne": "Nachttische", "Akcesoria do rega\u0142\u00f3w": "Regalzubeh\u00f6r", "Sto\u0142y kompletne": "Komplett-Tische", "Stela\u017ce do sto\u0142\u00f3w": "Tischgestelle", "P\u0142yty meblowe": "M\u00f6belplatten", "Multiplex": "Multiplex", "Sto\u0142y warsztatowe": "Werkb\u00e4nke", "Blaty z p\u0142yty wi\u00f3rowej": "M\u00f6belplatten", "Blaty ze sklejki": "Multiplex"}, "rooms": {"Gastronomia": "Gastro", "Gabinet": "Praxis", "Warsztat": "Werkstatt", "Biuro": "B\u00fcro"}, "colors": {"Jasne drewno": "Helles Holz", "Sosna bia\u0142a": "Kiefer Wei\u00df", "Jesion": "Esche", "Natura (brzoza)": "Natur (Birke)", "Klon": "Ahorn", "Buk": "Buche", "D\u0105b Hickory": "Eiche Hickory", "D\u0105b Sonoma": "Eiche Sonoma", "Bia\u0142y": "Wei\u00df", "Srebrnoszary": "Silbergrau", "Szary": "Grau", "Antracyt": "Anthrazit", "Czarny": "Schwarz"}, "form": {"Prostok\u0105tne": "rechteckig", "Okr\u0105g\u0142e": "rund"}}, "en": {"cats": {"Compact Table Tops": "Compact-Tischplatten", "Bedside Tables": "Nachttische", "Medical cabinets": "Nachttische", "Shelving accessories": "Regalzubeh\u00f6r", "Complete desks": "Komplett-Tische", "Table frames": "Tischgestelle", "Furniture boards": "M\u00f6belplatten", "Multiplex": "Multiplex", "Workbenches": "Werkb\u00e4nke", "Chipboard tabletops": "M\u00f6belplatten", "Plywood tabletops": "Multiplex"}, "rooms": {"Hospitality": "Gastro", "Practice": "Praxis", "Workshop": "Werkstatt", "Office": "B\u00fcro"}, "colors": {"Light wood": "Helles Holz", "White pine": "Kiefer Wei\u00df", "Ash": "Esche", "Natural (birch)": "Natur (Birke)", "Maple": "Ahorn", "Beech": "Buche", "Hickory oak": "Eiche Hickory", "Sonoma oak": "Eiche Sonoma", "White": "Wei\u00df", "Silver grey": "Silbergrau", "Grey": "Grau", "Anthracite": "Anthrazit", "Black": "Schwarz"}, "form": {"Rectangular": "rechteckig", "Round": "rund"}}, "de": {"form": {"Rechteckig": "rechteckig", "Rund": "rund"}}};
  function money(n) { if (n == null) return ''; var s = n.toFixed(2).replace('.', ','); return LOC === 'pl' ? s + '\u00a0z\u0142' : s + '\u00a0\u20ac'; }
  function eur(n) { return money(n); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function effW(p) { return p.breite != null ? p.breite : p.durchmesser; }
  function effD(p) { return p.tiefe != null ? p.tiefe : p.durchmesser; }

  // Maß-tolerante Normalisierung: lowercase, Diakritika weg,
  // "100x50" / "100 x50" / "100×50" / "100*50" -> "100 x 50"
  function normQ(s) {
    s = String(s == null ? '' : s).toLowerCase().replace(/\u00df/g, 'ss').replace(/\u0142/g, 'l');
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    s = s.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
    s = s.replace(/(\d)\s*[x\u00d7*]\s*(\d)/g, '$1 x $2');
    s = s.replace(/(\d)(cm|mm|m)\b/g, '$1 $2');
    return s.replace(/\s+/g, ' ').trim();
  }
  function levQ(a, b){
    if (a === b) return 0;
    var m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    var prev = [], i, j; for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++){ var cur = [i]; for (j = 1; j <= n; j++){ var c = a.charCodeAt(i-1) === b.charCodeAt(j-1) ? 0 : 1; cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+c); } prev = cur; }
    return prev[n];
  }
  function tokenMatchQ(hay, q){
    var toks = q.split(' '), i, j, t, hw;
    for (i = 0; i < toks.length; i++){
      t = toks[i]; if (!t) continue;
      if (hay.indexOf(t) > -1) continue;
      if (t.length >= 4){
        hw = hay.split(' ');
        var ok = false;
        for (j = 0; j < hw.length; j++){
          if (hw[j].length >= 3 && Math.abs(hw[j].length - t.length) <= 2 && levQ(t, hw[j]) <= 1){ ok = true; break; }
        }
        if (ok) continue;
      }
      return false;
    }
    return true;
  }
  // Option-Label (beliebige Locale) -> kanonischer DE-Datenwert
  function canonical(field, value) {
    var maps = LOCMAP[LOC] || {};
    var m = field === 'kategorie' ? maps.cats : field === 'raume' ? maps.rooms : field === 'farbe' ? maps.colors : field === 'form' ? maps.form : null;
    if (m && m[value] != null) return m[value];
    if (field === 'form') {
      var all = { 'rechteckig': 'rechteckig', 'rund': 'rund' };
      var f;
      for (f in LOCMAP) { if (LOCMAP[f].form && LOCMAP[f].form[value] != null) return LOCMAP[f].form[value]; }
      if (all[String(value).toLowerCase()]) return all[String(value).toLowerCase()];
    }
    // Fremd-Locale-Werte (z. B. DE-Kategoriename aus der Suche auf PL-Seite)
    var l;
    for (l in LOCMAP) {
      var mm = field === 'kategorie' ? LOCMAP[l].cats : field === 'raume' ? LOCMAP[l].rooms : field === 'farbe' ? LOCMAP[l].colors : null;
      if (mm && mm[value] != null) return mm[value];
    }
    return value;
  }
  var QUERY = '';
  var PRESETS = { kategorie: [], raume: [], farbe: [], form: [] };
  var CATSLUG = { 'compact-tischplatten': 'Compact-Tischplatten', 'moebelplatten': 'M\u00f6belplatten', 'tischplatte-spannplatte': 'M\u00f6belplatten', 'multiplex': 'Multiplex', 'tischplatte-sperrholz': 'Multiplex', 'komplett-tische': 'Komplett-Tische', 'tischgestelle': 'Tischgestelle', 'werkbaenke': 'Werkb\u00e4nke', 'regalzubehoer': 'Regalzubeh\u00f6r', 'medizinschraenke': 'Nachttische', 'nachttische': 'Nachttische' };
  var ROOMSLUG = { 'buero': 'B\u00fcro', 'werkstatt': 'Werkstatt', 'praxis': 'Praxis', 'gastro': 'Gastro' };
  // Lock-Modus: auf Kategorie-/Raum-Templates ist das Facet fest, Sektion versteckt.
  var LOCK = (function () {
    var m = location.pathname.match(/\/produktkategorien\/([^\/?#]+)/);
    if (m && CATSLUG[m[1]]) return { field: 'kategorie', value: CATSLUG[m[1]] };
    m = location.pathname.match(/\/raume\/([^\/?#]+)/);
    if (m && ROOMSLUG[m[1]]) return { field: 'raume', value: ROOMSLUG[m[1]] };
    return null;
  })();
  function readParams() {
    try {
      var sp = new URLSearchParams(location.search);
      QUERY = (sp.get('q') || '').trim();
      ['kategorie', 'raume', 'farbe', 'form'].forEach(function (f) {
        sp.getAll(f).forEach(function (v) {
          v.split(',').forEach(function (x) { x = x.trim(); if (x) PRESETS[f].push(canonical(f, x)); });
        });
      });
    } catch (e) {}
    // Kategorie-/Raum-Template ohne Filter-UI (Alt-Verhalten): Filter vorbelegen.
    // Mit Lock-Modus (Filter-UI vorhanden) übernimmt LOCK die Grundmenge.
    if (!LOCK) {
      var m = location.pathname.match(/\/produktkategorien\/([^\/?#]+)/);
      if (m && CATSLUG[m[1]]) PRESETS.kategorie.push(CATSLUG[m[1]]);
      m = location.pathname.match(/\/raume\/([^\/?#]+)/);
      if (m && ROOMSLUG[m[1]]) PRESETS.raume.push(ROOMSLUG[m[1]]);
    }
    if (LOCK) PRESETS[LOCK.field] = [];
  }
  function applyPresets() {
    var any = false;
    SECTIONS.forEach(function (s) {
      var wanted = PRESETS[s.field] || [];
      if (!wanted.length) return;
      s.options.forEach(function (o) {
        if (!o.checkbox) return;
        if (wanted.indexOf(canonical(s.field, o.value)) >= 0) { o.checkbox.checked = true; any = true; }
      });
    });
    return any;
  }

  var HEART_SVG =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block" class="inline-svg-0"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
  var CART_SVG =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="product-card_cart-overlay-icon inline-svg-0" style="display:block"><path d="M2 3h2.5l3.5 14h11l3.5-11H6.5"></path><circle cx="9" cy="20" r="1.5"></circle><circle cx="18" cy="20" r="1.5"></circle></svg>';

  var PRODUCTS = [];
  var EMPTY_I18N = {
    de: { soonH: 'Bald verf\u00fcgbar', soonP: 'Die Produkte dieser Kategorie sind noch nicht verf\u00fcgbar. Schau bald wieder vorbei.', soonBtn: 'Alle Produkte ansehen', noneH: 'Keine Produkte gefunden', noneP: 'F\u00fcr diese Filterauswahl gibt es keine Produkte.', noneBtn: 'Filter zur\u00fccksetzen', soonCount: 'Bald verf\u00fcgbar' },
    pl: { soonH: 'Wkr\u00f3tce dost\u0119pne', soonP: 'Produkty z tej kategorii nie s\u0105 jeszcze dost\u0119pne. Zajrzyj wkr\u00f3tce ponownie.', soonBtn: 'Zobacz wszystkie produkty', noneH: 'Nie znaleziono produkt\u00f3w', noneP: 'Brak produkt\u00f3w dla wybranych filtr\u00f3w.', noneBtn: 'Wyczy\u015b\u0107 filtry', soonCount: 'Wkr\u00f3tce dost\u0119pne' },
    en: { soonH: 'Coming soon', soonP: 'Products in this category are not yet available. Check back soon.', soonBtn: 'View all products', noneH: 'No products found', noneP: 'No products match your filter selection.', noneBtn: 'Reset filters', soonCount: 'Coming soon' }
  };
  var SORT_I18N = {
    de: { def: 'Empfohlen', pa: 'Preis aufsteigend', pd: 'Preis absteigend', na: 'Name A\u2013Z', nd: 'Name Z\u2013A', von: 'Von', bis: 'Bis', amin: 'Mindestpreis', amax: 'H\u00f6chstpreis' },
    pl: { def: 'Polecane', pa: 'Cena rosn\u0105co', pd: 'Cena malej\u0105co', na: 'Nazwa A\u2013Z', nd: 'Nazwa Z\u2013A', von: 'Od', bis: 'Do', amin: 'Cena minimalna', amax: 'Cena maksymalna' },
    en: { def: 'Recommended', pa: 'Price: low to high', pd: 'Price: high to low', na: 'Name A\u2013Z', nd: 'Name Z\u2013A', von: 'From', bis: 'To', amin: 'Minimum price', amax: 'Maximum price' }
  };
  injectStyle(
    '.plp-empty{grid-column:1/-1;text-align:center;padding:80px 24px;border:1px solid #E5E5E5;border-radius:8px;background:#FAFAFA}' +
    '.plp-empty-h{font-size:22px;font-weight:500;color:#0A0A0A;margin:0 0 8px}' +
    '.plp-empty-p{color:#6A6A66;margin:0 0 24px;font-size:15px;line-height:1.5}' +
    '.plp-empty-btn{display:inline-block;background:#0A0A0A;color:#F2F0EB;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:15px;cursor:pointer;border:0}' +
    '.plp-empty-btn:hover{background:#1a1a1a}',
    'plpemptycss'
  );
  var NODE_BY_SLUG = {};
  var SECTIONS = [];
  var PRICE = { min: 0, max: 500, from: 0, to: 500, reset: null };
  var SORT = 'default';

  function cardHTML(p) {
    var price = p.priceRaw || money(p.price);
    var badge = p.bestseller ? 'Bestseller' : '';
    return (
      '<div role="listitem" class="product-card_wrapper w-dyn-item" data-kp-card="1" data-slug="' + esc(p.slug) + '" data-pid="' + esc(p.pid) + '">' +
        '<div class="product-card_root">' +
          '<div class="product-card_image-wrapper">' +
            '<img src="' + esc(p.img) + '" loading="lazy" alt="" class="product-card_image"/>' +
            '<div class="product-card_badge badge-sm">' + esc(badge) + '</div>' +
            '<a data-rating="" class="kp-wl-toggle w-button" data-price="' + esc(price) + '" data-handle="' + esc(p.slug) + '" href="#" data-kp-wl-add="1" data-name="' + esc(p.title) + '" aria-label="Zur Wunschliste hinzuf\u00fcgen" data-specs="">' + HEART_SVG + '</a>' +
            '<div class="product-card_price"><p class="paragraph-4">' + esc(price) + '</p></div>' +
          '</div>' +
          '<div class="product-card_content card-d-pad">' +
            '<h3 class="product-card_title">' + esc(p.title) + '</h3>' +
            '<div class="product-card_rating-wrapper"><div class="w-embed"></div></div>' +
            '<a href="#" class="product-card_cart-overlay w-inline-block">' + CART_SVG + '<div>Warenkorb</div></a>' +
          '</div>' +
          '<a href="' + LP + '/products/' + esc(p.slug) + '" class="product-card_overlay-link w-inline-block"></a>' +
        '</div>' +
      '</div>'
    );
  }

  function renderGrid() {
    var items = $('#plp-grid .w-dyn-items') || $('#plp-grid .plp-grid') || $('#plp-grid');
    if (!items) return;
    if (!PRODUCTS.length) {
      var t = EMPTY_I18N[LOC] || EMPTY_I18N.de;
      items.innerHTML =
        '<div class="plp-empty"><div class="plp-empty-h">' + t.soonH + '</div>' +
        '<p class="plp-empty-p">' + t.soonP + '</p>' +
        '<a class="plp-empty-btn" href="' + LP + '/produkte">' + t.soonBtn + '</a></div>';
      var tb = $('.plp-toolbar'); if (tb) tb.style.display = 'none';
      NODE_BY_SLUG = {};
      return;
    }
    var html = '';
    for (var i = 0; i < PRODUCTS.length; i++) html += cardHTML(PRODUCTS[i]);
    items.innerHTML = html;
    NODE_BY_SLUG = {};
    $all('[data-kp-card]', items).forEach(function (n) { NODE_BY_SLUG[n.getAttribute('data-slug')] = n; });
    try { document.dispatchEvent(new Event('kpw:change')); } catch (e) {}
    // GA4: view_item_list (nur bei geaenderter Grundmenge, nicht je Re-Render)
    try {
      if (window.kpDL) {
        var lm = location.pathname.match(/\/(produktkategorien|raume)\/([^\/?#]+)/);
        var listId = lm ? lm[1] + ':' + lm[2] : 'produkte';
        var sig = listId + '|' + PRODUCTS.length + '|' + (PRODUCTS[0] ? PRODUCTS[0].slug : '');
        if (window.__kpListSig !== sig) {
          window.__kpListSig = sig;
          window.kpDL('view_item_list', {
            item_list_id: listId,
            items: PRODUCTS.slice(0, 12).map(function (p, i) {
              return { item_id: String(p.pid || p.slug), item_name: p.title, price: p.price, index: i, quantity: 1 };
            })
          });
        }
      }
    } catch (eTrack) {}
  }

  // -----------------------------------------------------------------
  // Cart: deterministisch via fetchProduct(pid) -> Variant -> addToCart
  // (Shopyflow verdrahtet client-injizierte sf-product-Karten nicht zuverlaessig
  //  -> wir umgehen den DOM-Scan/refetch komplett.)
  // -----------------------------------------------------------------
  var VARIANT_CACHE = {}; // pid -> numerische Variant-id | null (nicht im Storefront)

  function variantFor(pid) {
    if (Object.prototype.hasOwnProperty.call(VARIANT_CACHE, pid)) {
      return Promise.resolve(VARIANT_CACHE[pid]);
    }
    if (!window.Shopyflow || typeof window.Shopyflow.fetchProduct !== 'function') {
      return Promise.resolve(null);
    }
    return window.Shopyflow.fetchProduct(pid).then(function (fp) {
      var v = fp && fp.variants && fp.variants[0];
      var num = (v && v.id) ? String(v.id).split('/').pop() : null;
      VARIANT_CACHE[pid] = num;
      return num;
    }).catch(function () { VARIANT_CACHE[pid] = null; return null; });
  }

  function setupTracking() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('.product-card_overlay-link');
      if (!a || !window.kpDL) return;
      var card = a.closest('[data-kp-card]');
      if (!card) return;
      try {
        var t = (card.querySelector('.product-card_title') || {}).textContent || '';
        var pr = window.kpParsePrice ? window.kpParsePrice((card.querySelector('.product-card_price') || {}).textContent || '') : 0;
        window.kpDL('select_item', { items: [{ item_id: String(card.getAttribute('data-pid') || card.getAttribute('data-slug')), item_name: t.trim(), price: pr, quantity: 1 }] });
      } catch (eT) {}
    }, true);
  }

  function setupCart() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.product-card_cart-overlay');
      if (!btn) return;
      var card = btn.closest('[data-kp-card]');
      if (!card) return;
      e.preventDefault();
      e.stopPropagation();
      if (btn.getAttribute('data-busy') === '1') return;
      var pid = card.getAttribute('data-pid');
      if (!pid) return;
      btn.setAttribute('data-busy', '1');
      variantFor(pid).then(function (num) {
        if (!num) { btn.removeAttribute('data-busy'); return; } // nicht im Storefront -> no-op
        return window.Shopyflow.addToCart({ lineItems: [{ merchandiseId: num, quantity: 1 }] })
          .then(function () {
            try { window.Shopyflow.openCart(); } catch (e2) {}
            // GA4: add_to_cart (Karten-Quick-Add)
            try {
              if (window.kpDL) {
                var t = (card.querySelector('.product-card_title') || {}).textContent || '';
                var pr = window.kpParsePrice ? window.kpParsePrice((card.querySelector('.product-card_price') || {}).textContent || '') : 0;
                window.kpDL('add_to_cart', { currency: window.kpCurrency ? window.kpCurrency() : 'EUR', value: pr, items: [{ item_id: String(pid), item_name: t.trim(), price: pr, quantity: 1 }] });
              }
            } catch (e3) {}
          });
      }).then(function () { btn.removeAttribute('data-busy'); })
        .catch(function () { btn.removeAttribute('data-busy'); });
    });
  }

  var FORM_I18N = {
    de: { head: 'Form', opts: [['Rechteckig', 'rechteckig'], ['Rund', 'rund']] },
    pl: { head: 'Kszta\u0142t', opts: [['Prostok\u0105tne', 'rechteckig'], ['Okr\u0105g\u0142e', 'rund']] },
    en: { head: 'Shape', opts: [['Rectangular', 'rechteckig'], ['Round', 'rund']] }
  };
  function injectFormSection() {
    if ($('[fs-cmsfilter-field=form]')) return; // schon vorhanden
    var anchor = null;
    $all('.plp-filter-section').forEach(function (sec) {
      if (!anchor && $('[fs-cmsfilter-field=kategorie]', sec)) anchor = sec;
    });
    if (!anchor) return;
    var t = FORM_I18N[LOC] || FORM_I18N.de;
    var sec = document.createElement('div');
    sec.className = 'plp-filter-section is-closed';
    var optHTML = t.opts.map(function (o) {
      return '<div role="listitem" class="w-dyn-item"><label fs-cmsfilter-field="form" class="plp-filter-option">' +
        '<input type="checkbox" class="plp-filter-checkbox"/>' +
        '<div class="plp-filter-label">' + o[0] + '</div>' +
        '<div class="plp-filter-count"> </div></label></div>';
    }).join('');
    sec.innerHTML =
      '<div class="plp-filter-head"><div class="plp-filter-head-label">' + t.head + '</div>' +
      '<div class="plp-filter-head-meta"><div class="plp-filter-head-counter"> </div><div class="plp-filter-head-icon">+</div></div></div>' +
      '<div class="plp-filter-body"><div class="w-dyn-list"><div role="list" class="w-dyn-items">' + optHTML + '</div></div></div>';
    anchor.parentNode.insertBefore(sec, anchor.nextSibling);
  }

  function buildIndex() {
    SECTIONS = [];
    $all('.plp-filter-section').forEach(function (sec) {
      var opts = $all('.plp-filter-option', sec);
      var field = null;
      opts.forEach(function (o) { var f = o.getAttribute('fs-cmsfilter-field'); if (f && !field) field = f; });
      if (!field || !opts.length) return;
      if (LOCK && field === LOCK.field) { sec.style.display = 'none'; return; }
      var optionEls = opts.map(function (o) {
        var labelEl = $('.plp-filter-label', o);
        return {
          el: o,
          checkbox: $('input[type=checkbox]', o),
          countEl: $('.plp-filter-count', o),
          labelEl: labelEl,
          value: labelEl ? labelEl.textContent.trim() : '',
          _global: 0
        };
      });
      SECTIONS.push({ field: field, options: optionEls, headCounter: $('.plp-filter-head-counter', sec), el: sec });
    });
  }

  // Facetten-Bridge (v2.5.0): Suchanfrage in Facetten übersetzen — für ALLE Sektionen.
  //   1) „AxB" (irgendwo in der Anfrage, optional Einheit) → Breite (cm) + Tiefe (cm)
  //   2) „N mm" → Dicke (mm)
  //   3) Wort-Tokens → Optionen von Farbe/Form/Kategorie/Räume (exakt, Präfix ≥6, Tippfehler lev≤1 ≥6)
  // Konsumierte Teile verschwinden aus der Titel-Textsuche; der Rest bleibt QUERY.
  // Läuft nach buildIndex (SECTIONS vorhanden), bevor gefiltert wird.
  function resolveFacetQuery() {
    if (!QUERY) return;
    var q = normQ(QUERY), consumed = false;
    var secBy = {}, i;
    for (i = 0; i < SECTIONS.length; i++) secBy[SECTIONS[i].field] = SECTIONS[i];
    function findOpt(sec, num) {
      for (var j = 0; j < sec.options.length; j++) {
        var o = sec.options[j];
        if (o.checkbox && parseFloat(o.value) === num) return o;
      }
      return null;
    }
    function check(list) {
      for (var j = 0; j < list.length; j++) if (list[j].checkbox) list[j].checkbox.checked = true;
      if (list.length) consumed = true;
    }
    // 1) Maß „A x B" (normQ hat bereits zu "A x B" normalisiert und Einheiten abgetrennt)
    var dm = q.match(/(\d+(?:[.,]\d+)?) x (\d+(?:[.,]\d+)?)( (?:cm|mm|m)\b)?/);
    if (dm && secBy['breite-cm'] && secBy['tiefe-cm']) {
      var a = parseFloat(dm[1].replace(',', '.')), b = parseFloat(dm[2].replace(',', '.'));
      var wa = findOpt(secBy['breite-cm'], a), db = findOpt(secBy['tiefe-cm'], b);
      // Asymmetrisches Maß in umgekehrter Orientierung versuchen (z. B. „50x130" → 130×50)
      if ((!wa || !db) && a !== b) {
        var wb = findOpt(secBy['breite-cm'], b), da = findOpt(secBy['tiefe-cm'], a);
        if (wb && da) { wa = wb; db = da; }
      }
      if (wa && db) { check([wa, db]); q = q.replace(dm[0], ' '); }
    }
    // 2) Stärke „N mm"
    var sm = q.match(/(\d+(?:[.,]\d+)?) mm\b/);
    if (sm && secBy['dicke-mm']) {
      var so = findOpt(secBy['dicke-mm'], parseFloat(sm[1].replace(',', '.')));
      if (so) { check([so]); q = q.replace(sm[0], ' '); }
    }
    // 3) Wort-Tokens gegen Optionen der übrigen Sektionen (erste Sektion mit Treffern gewinnt;
    //    mehrere Treffer innerhalb der Sektion = OR, z. B. „eiche" → Eiche Hickory + Eiche Sonoma)
    var toks = q.replace(/\s+/g, ' ').trim();
    toks = toks ? toks.split(' ') : [];
    var left = [], t, k;
    for (k = 0; k < toks.length; k++) {
      t = toks[k];
      if (!t) continue;
      if (/^\d/.test(t) || t === 'x' || t === 'cm' || t === 'mm' || t === 'm') { left.push(t); continue; }
      var hits = null;
      for (i = 0; i < SECTIONS.length && !hits; i++) {
        var s = SECTIONS[i];
        if (s.field === 'breite-cm' || s.field === 'tiefe-cm' || s.field === 'dicke-mm') continue;
        if (LOCK && s.field === LOCK.field) continue;
        var matched = [];
        for (var oj = 0; oj < s.options.length; oj++) {
          var o = s.options[oj];
          if (!o.checkbox) continue;
          var ot = normQ(o.value).split(' ');
          for (var tj = 0; tj < ot.length; tj++) {
            var w = ot[tj];
            if (w === t ||
                (t.length >= 6 && w.indexOf(t) === 0) ||
                (t.length >= 6 && Math.abs(w.length - t.length) <= 2 && levQ(t, w) <= 1)) {
              matched.push(o); break;
            }
          }
        }
        if (matched.length) hits = matched;
      }
      if (hits) check(hits); else left.push(t);
    }
    QUERY = left.join(' ');
    if (consumed && !QUERY) {
      try { // q komplett zu Facetten geworden → aus URL entfernen, Chips repräsentieren die Filter
        var sp = new URLSearchParams(location.search);
        sp.delete('q');
        var qs = sp.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
      } catch (e) {}
    }
  }

  function optMatch(field, value, p) {
    value = canonical(field, value);
    switch (field) {
      case 'form':      return (p.form || '') === value;
      case 'kategorie': return p.kategorie === value;
      case 'raume':     return p.raume.indexOf(value) >= 0;
      case 'farbe':     return p.farben.indexOf(value) >= 0;
      case 'breite-cm': return effW(p) === parseFloat(value);
      case 'tiefe-cm':  return effD(p) === parseFloat(value);
      case 'dicke-mm':  return p.dicke === parseFloat(value);
      default:          return false;
    }
  }

  function activeOf(section) {
    var vals = [];
    section.options.forEach(function (o) { if (o.checkbox && o.checkbox.checked) vals.push(o.value); });
    return vals;
  }

  function passes(p, excludeSection, includePrice) {
    for (var i = 0; i < SECTIONS.length; i++) {
      var s = SECTIONS[i];
      if (s === excludeSection) continue;
      var act = activeOf(s);
      if (!act.length) continue;
      var ok = false;
      for (var j = 0; j < act.length; j++) { if (optMatch(s.field, act[j], p)) { ok = true; break; } }
      if (!ok) return false;
    }
    if (includePrice && (PRICE.from > PRICE.min || PRICE.to < PRICE.max)) {
      if (p.price == null || p.price < PRICE.from || p.price > PRICE.to) return false;
    }
    if (QUERY) {
      if (!tokenMatchQ(normQ(p.title), normQ(QUERY))) return false;
    }
    return true;
  }
  function clearQuery() {
    QUERY = '';
    try {
      var sp = new URLSearchParams(location.search);
      sp.delete('q');
      var qs = sp.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    } catch (e) {}
    apply();
  }

  function toggleFilterEmpty(show) {
    var items = $('#plp-grid .w-dyn-items') || $('#plp-grid .plp-grid') || $('#plp-grid');
    if (!items) return;
    var node = $('#plp-filter-empty', items);
    if (show && !node) {
      var t = EMPTY_I18N[LOC] || EMPTY_I18N.de;
      node = document.createElement('div');
      node.id = 'plp-filter-empty';
      node.className = 'plp-empty';
      node.innerHTML =
        '<div class="plp-empty-h">' + t.noneH + '</div>' +
        '<p class="plp-empty-p">' + t.noneP + '</p>' +
        '<button type="button" class="plp-empty-btn" data-plp-empty-clear>' + t.noneBtn + '</button>';
      node.querySelector('[data-plp-empty-clear]').addEventListener('click', function () { clearAll(); });
      items.insertBefore(node, items.firstChild);
    }
    if (node) node.style.display = show ? '' : 'none';
  }

  function apply() {
    var shown = 0;
    for (var i = 0; i < PRODUCTS.length; i++) {
      var p = PRODUCTS[i];
      var node = NODE_BY_SLUG[p.slug];
      if (!node) continue;
      var vis = passes(p, null, true);
      node.classList.toggle('is-hidden', !vis);
      if (vis) shown++;
    }
    SECTIONS.forEach(function (s) {
      s.options.forEach(function (o) {
        var c = 0;
        for (var k = 0; k < PRODUCTS.length; k++) {
          var p = PRODUCTS[k];
          if (optMatch(s.field, o.value, p) && passes(p, s, true)) c++;
        }
        if (o.countEl) o.countEl.textContent = c ? '(' + c + ')' : '';
        o.el.classList.toggle('is-hidden', o._global === 0);
        o.el.style.opacity = (c === 0 && o._global > 0) ? '0.4' : '';
      });
      var checked = s.options.filter(function (o) { return o.checkbox && o.checkbox.checked; }).length;
      if (s.headCounter) s.headCounter.textContent = checked ? '(' + checked + ')' : '';
    });
    toggleFilterEmpty(shown === 0 && PRODUCTS.length > 0);
    renderPills();
    updateCounter(shown);
    updateFilterBtnNum();
    applySort();
  }

  function computeGlobalCounts() {
    SECTIONS.forEach(function (s) {
      s.options.forEach(function (o) {
        var c = 0;
        for (var k = 0; k < PRODUCTS.length; k++) { if (optMatch(s.field, o.value, PRODUCTS[k])) c++; }
        o._global = c;
      });
      // Sektion komplett ausblenden, wenn keine Option in der Grundmenge Produkte hat
      if (s.el) {
        var alive = false;
        for (var i = 0; i < s.options.length; i++) { if (s.options[i]._global > 0) { alive = true; break; } }
        s.el.style.display = alive ? '' : 'none';
      }
    });
  }

  function prodWord(n) {
    if (LOC === 'pl') {
      if (n === 1) return 'produkt';
      var d = n % 10, h = n % 100;
      if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 'produkty';
      return 'produkt\u00f3w';
    }
    if (LOC === 'en') return n === 1 ? 'product' : 'products';
    return n === 1 ? 'Produkt' : 'Produkte';
  }
  function updateCounter(shown) {
    var el = $('.plp-page-counter');
    if (!el) return;
    var total = PRODUCTS.length;
    var of = LOC === 'pl' ? ' z ' : (LOC === 'en' ? ' of ' : ' von ');
    var w = prodWord(total);
    if (LOC === 'de' && shown !== total && total !== 1) w = 'Produkten';
    el.textContent = (shown === total)
      ? total + ' ' + w
      : shown + of + total + ' ' + w;
  }
  function updateHeroCount() {
    var el = $('.cat-hero-count') || $('.raum-hero-count');
    if (!el) return;
    if (!PRODUCTS.length) { var t = EMPTY_I18N[LOC] || EMPTY_I18N.de; el.textContent = t.soonCount; return; }
    el.textContent = PRODUCTS.length + ' ' + prodWord(PRODUCTS.length);
  }

  function updateFilterBtnNum() {
    var num = $('#filter-btn-num');
    if (!num) return;
    var active = 0;
    SECTIONS.forEach(function (s) { active += activeOf(s).length; });
    if (PRICE.from > PRICE.min || PRICE.to < PRICE.max) active++;
    if (QUERY) active++;
    num.textContent = active ? active : '';
    num.classList.toggle('is-zero', active === 0);
  }

  function renderPills() {
    var row = $('#tags-row');
    if (!row) return;
    row.innerHTML = '';
    SECTIONS.forEach(function (s) {
      s.options.forEach(function (o) {
        if (!(o.checkbox && o.checkbox.checked)) return;
        row.appendChild(pill(o.value, function () { o.checkbox.checked = false; apply(); }));
      });
    });
    if (QUERY) {
      row.appendChild(pill('\u201e' + QUERY + '\u201c', clearQuery));
    }
    if (PRICE.from > PRICE.min || PRICE.to < PRICE.max) {
      row.appendChild(pill(eur(PRICE.from) + '\u2013' + eur(PRICE.to), function () { if (PRICE.reset) PRICE.reset(); }));
    }
    var clear = $('#clear-all');
    if (clear) clear.classList.toggle('is-hidden', row.children.length === 0);
  }
  function pill(text, onX) {
    var tag = document.createElement('span');
    tag.className = 'plp-tag';
    tag.textContent = text;
    var x = document.createElement('span');
    x.className = 'plp-tag-x';
    x.textContent = '\u00d7';
    x.style.cursor = 'pointer';
    x.addEventListener('click', function (e) { e.stopPropagation(); onX(); });
    tag.appendChild(x);
    return tag;
  }

  function clearAll() {
    SECTIONS.forEach(function (s) {
      s.options.forEach(function (o) { if (o.checkbox) o.checkbox.checked = false; });
    });
    if (PRICE.reset) PRICE.reset(true);
    if (QUERY) { clearQuery(); return; }
    apply();
  }

  function applySort() {
    if (SORT === 'default') return;
    var items = $('#plp-grid .w-dyn-items') || $('#plp-grid .plp-grid');
    if (!items) return;
    var order = PRODUCTS.slice();
    order.sort(function (a, b) {
      if (SORT === 'price-asc') return (a.price || 0) - (b.price || 0);
      if (SORT === 'price-desc') return (b.price || 0) - (a.price || 0);
      if (SORT === 'name-asc') return a.title.localeCompare(b.title, LOC);
      if (SORT === 'name-desc') return b.title.localeCompare(a.title, LOC);
      return 0;
    });
    order.forEach(function (p) { var n = NODE_BY_SLUG[p.slug]; if (n) items.appendChild(n); });
  }

  function setupSort() {
    var sel = $('#sort-select');
    if (!sel) return;
    var ts = SORT_I18N[LOC] || SORT_I18N.de;
    var opts = [
      ['default', ts.def],
      ['price-asc', ts.pa],
      ['price-desc', ts.pd],
      ['name-asc', ts.na],
      ['name-desc', ts.nd]
    ];
    sel.innerHTML = '';
    opts.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o[0]; op.textContent = o[1];
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () { SORT = sel.value; apply(); });
  }

  function setupPriceSlider() {
    var row = $('.plp-filter-price-row');
    if (!row || row.getAttribute('data-k-slider') === '1') return;
    row.setAttribute('data-k-slider', '1');
    var prices = PRODUCTS.map(function (p) { return p.price; }).filter(function (v) { return v != null; });
    if (!prices.length) return;
    PRICE.min = Math.floor(Math.min.apply(null, prices) / 10) * 10;
    PRICE.max = Math.ceil(Math.max.apply(null, prices) / 10) * 10;
    PRICE.from = PRICE.min; PRICE.to = PRICE.max;
    var step = 5;

    var slider = document.createElement('div');
    slider.className = 'plp-price-slider';
    slider.innerHTML =
      '<div class="plp-price-labels">' +
        '<div class="plp-price-label-group"><span class="plp-price-label-tag">' + esc((SORT_I18N[LOC] || SORT_I18N.de).von) + '</span><span class="plp-price-label-val" data-from-val></span></div>' +
        '<div class="plp-price-label-group plp-price-label-group--right"><span class="plp-price-label-tag">' + esc((SORT_I18N[LOC] || SORT_I18N.de).bis) + '</span><span class="plp-price-label-val" data-to-val></span></div>' +
      '</div>' +
      '<div class="plp-price-track" data-track>' +
        '<div class="plp-price-fill" data-fill></div>' +
        '<div class="plp-price-knob" data-knob="from" tabindex="0" role="slider" aria-label="Mindestpreis"></div>' +
        '<div class="plp-price-knob" data-knob="to" tabindex="0" role="slider" aria-label="H\u00f6chstpreis"></div>' +
      '</div>';
    row.parentNode.insertBefore(slider, row.nextSibling);

    var track = $('[data-track]', slider), fill = $('[data-fill]', slider);
    var knobFrom = $('[data-knob="from"]', slider), knobTo = $('[data-knob="to"]', slider);
    var fromVal = $('[data-from-val]', slider), toVal = $('[data-to-val]', slider);

    function pct(v) { return ((v - PRICE.min) / (PRICE.max - PRICE.min)) * 100; }
    function valFromX(x, rect) {
      var pp = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      var v = PRICE.min + pp * (PRICE.max - PRICE.min);
      return Math.round(v / step) * step;
    }
    function render() {
      var pf = pct(PRICE.from), pt = pct(PRICE.to);
      knobFrom.style.left = pf + '%'; knobTo.style.left = pt + '%';
      fill.style.left = pf + '%'; fill.style.width = (pt - pf) + '%';
      fromVal.textContent = eur(PRICE.from); toVal.textContent = eur(PRICE.to);
    }
    function startDrag(which) {
      return function (e) {
        e.preventDefault();
        var knob = which === 'from' ? knobFrom : knobTo;
        knob.classList.add('is-dragging');
        var rect = track.getBoundingClientRect();
        function move(ev) {
          var x = ev.touches ? ev.touches[0].clientX : ev.clientX;
          var v = valFromX(x, rect);
          if (which === 'from') PRICE.from = Math.min(v, PRICE.to - step);
          else PRICE.to = Math.max(v, PRICE.from + step);
          if (PRICE.from < PRICE.min) PRICE.from = PRICE.min;
          if (PRICE.to > PRICE.max) PRICE.to = PRICE.max;
          render();
        }
        function end() {
          knob.classList.remove('is-dragging');
          document.removeEventListener('mousemove', move);
          document.removeEventListener('touchmove', move);
          document.removeEventListener('mouseup', end);
          document.removeEventListener('touchend', end);
          apply();
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('mouseup', end);
        document.addEventListener('touchend', end);
      };
    }
    function arrowKeys(which) {
      return function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        var dir = e.key === 'ArrowLeft' ? -1 : 1;
        var amt = e.shiftKey ? step * 10 : step;
        if (which === 'from') PRICE.from = Math.max(PRICE.min, Math.min(PRICE.to - step, PRICE.from + dir * amt));
        else PRICE.to = Math.min(PRICE.max, Math.max(PRICE.from + step, PRICE.to + dir * amt));
        render(); apply();
      };
    }
    knobFrom.addEventListener('mousedown', startDrag('from'));
    knobFrom.addEventListener('touchstart', startDrag('from'), { passive: false });
    knobTo.addEventListener('mousedown', startDrag('to'));
    knobTo.addEventListener('touchstart', startDrag('to'), { passive: false });
    knobFrom.addEventListener('keydown', arrowKeys('from'));
    knobTo.addEventListener('keydown', arrowKeys('to'));

    PRICE.reset = function (silent) { PRICE.from = PRICE.min; PRICE.to = PRICE.max; render(); if (!silent) apply(); };
    render();
  }

  function setupDrawer() {
    var btn = $('#filter-btn'), x = $('#drawer-close'), apl = $('#drawer-apply'), clr = $('#drawer-clear');
    function close() { document.body.classList.remove('is-drawer-open'); }
    function toggle() { document.body.classList.toggle('is-drawer-open'); }
    if (btn) btn.addEventListener('click', function (e) { e.preventDefault(); toggle(); });
    if (x) x.addEventListener('click', function (e) { e.preventDefault(); close(); });
    if (apl) apl.addEventListener('click', function (e) { e.preventDefault(); close(); });
    if (clr) clr.addEventListener('click', function (e) { e.preventDefault(); clearAll(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function setupSections() {
    $all('.plp-filter-section').forEach(function (sec, idx) {
      if (idx > 0 && !sec.querySelector('.plp-filter-price-row')) sec.classList.add('is-closed');
    });
    document.addEventListener('click', function (e) {
      var head = e.target.closest('.plp-filter-head');
      if (!head) return;
      var sec = head.closest('.plp-filter-section');
      if (!sec) return;
      sec.classList.toggle('is-closed');
      var icon = head.querySelector('.plp-filter-head-icon');
      if (icon) icon.textContent = sec.classList.contains('is-closed') ? '+' : '\u2212';
    });
  }

  function wireEvents() {
    document.addEventListener('change', function (e) {
      if (e.target.matches && e.target.matches('.plp-filter-section input[type=checkbox]')) apply();
    });
    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'clear-all') { e.preventDefault(); clearAll(); }
    });
    document.addEventListener('click', function (e) {
      var wl = e.target.closest && e.target.closest('.kp-wl-toggle');
      if (wl) e.preventDefault();
    });
  }

  function boot() {
    setupDrawer();
    setupSections();
    setupSort();
    fetch(DATA_URL, { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        PRODUCTS = (data && data.products) || [];
        PRODUCTS.forEach(function (p) {
          if (p.titleByLoc) p.title = p.titleByLoc[LOC] || p.titleByLoc.de || p.title;
          if (p.priceRawByLoc) p.priceRaw = p.priceRawByLoc[LOC] || p.priceRawByLoc.de || p.priceRaw;
          if (p.priceByLoc) { var pv = p.priceByLoc[LOC]; p.price = (pv == null ? p.priceByLoc.de : pv); }
        });
        if (LOCK) {
          PRODUCTS = PRODUCTS.filter(function (p) { return optMatch(LOCK.field, LOCK.value, p); });
        }
        updateHeroCount();
        renderGrid();
        readParams();
        injectFormSection();
        buildIndex();
        resolveFacetQuery();
        computeGlobalCounts();
        setupPriceSlider();
        wireEvents();
        setupCart();
        setupTracking();
        applyPresets();
        apply();
      })
      .catch(function (err) {
        if (window.console) console.warn('[plp] Filterdaten konnten nicht geladen werden:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
