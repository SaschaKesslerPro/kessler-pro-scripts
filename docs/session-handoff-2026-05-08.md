# Session-Handoff — 08. Mai 2026

**Site:** kessler-pro.com (`67fea16d9758f16a33bef722`)
**Page:** PLP Shop 2.0 (`69f9bf6ae2ef38325a678823`)
**Bundle-Version live:** v1.0.4
**Bootstrap-Version live:** 1.0.2 (zeigt auf `@v1.0.4`)

## Was heute erledigt wurde

### Phase 1 — H1-Font ✅
- `plp-page-h1` font-weight 500 → 300
- Bundle-Override `!important` (v1.0.1) gegen Webflow `default-h1` Tag-Style mit weight 600
- **PENDING (Designer-side):** Onest-Light(300) Variante in Site-Settings → Fonts aktivieren prüfen — fallback auf 400 wenn nicht enabled

### Phase 2 — Breadcrumb ✅
- 4 neue Styles erstellt: `plp-breadcrumb`, `plp-breadcrumb-sep`, `plp-breadcrumb-current`, `plp-breadcrumb-link`
- Inserted vor plp-page-head Section (id `deaf77ad-22c4-469e-c176-fde6705c69db`)
- HTML: Home → / → Alle Produkte (current)
- **PENDING (Designer-side):** Polnische Locale-Übersetzungen für „Home" und „Alle Produkte"

### Phase 3 — Active Filter Tag-Pills ✅
- Container `plp-tags-row` (id=`tags-row`) bestand schon
- Styles: `plp-tag` (border-radius 8px), `plp-tag-x`, `plp-tags-row` (flex 6px gap)
- `plptags`-Logic ins Bundle integriert
- **3 Follow-Ups erledigt:**
  - Pill border-radius 99px → 8px (Brand-Manifest universal)
  - Filter-btn active-state CSS in Bundle
  - Clear-all click handler in Bundle

### GitHub + jsDelivr Migration ✅
- Repo: `https://github.com/SaschaKesslerPro/kessler-pro-scripts` (public)
- Struktur:
  ```
  dist/
    globals.js   — Header, judge.me, recently-viewed, scrollbar, rating-fallback
    plp.js       — komplette PLP-Logic (drawer, sort, filter, tags, cards, finsweet-loaders)
    home.js      — Homepage product carousel
    pdp.js       — placeholder
  docs/
    phase4-color-dots-architecture.md   ← neu, Phase 4 Planung
    session-handoff-2026-05-08.md       ← diese Datei
  README.md
  ```
- jsDelivr CDN: `https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@VERSION/dist/{file}.js`
- Bootstrap-Pattern in Webflow Site-Level: lädt globals.js immer + plp.js/home.js per DOM-Detection

### Bundle Versionen Timeline
| Version | Was |
|---|---|
| v1.0.0 | Initial Bundle (alle PLP + Globals + Home Logic) |
| v1.0.1 | Drawer-Scrollbar verstecken + H1 weight 300 `!important` |
| v1.0.2 | Header_scrolled Default-Hide-Regel (Doppel-Header-Issue gefixt) |
| v1.0.3 | Hysterese-basierte Header-Scroll-Detection (statt IntersectionObserver) |
| **v1.0.4** | **Lock + breitere Hysterese (100/40) + rAF-Throttling — Header-Flicker behoben** |

### Webflow-Style Diffs (außerhalb Bundle) ✅
- `plp-sort-select` border + background-color → none/transparent (Sort-Dropdown ohne Border)
- `plp-tag` border-radius 99px → 8px

## Bundle-Architektur — wichtige Mechaniken

- **Webflow `add_inline_site_script`** wendet Script automatisch site-level an (kein separater Apply-Step)
- **DisplayName-Constraint:** alphanumerisch only, KEINE Bindestriche
- **`delete_all_site_scripts`** kaskadiert auch Page-Mappings → Page-level cleanup nicht extra nötig
- **jsDelivr Cache:** `@main` hat 12h Cache mit Cloudflare-Edge-Servern, Purge propagiert nicht immer vollständig
- **Workaround:** Bootstrap zeigt auf konkrete `@v1.0.x` Tag-URLs (immutable Cache) — keine Purge-Probleme
- **jsDelivr Tag-Indexing:** ~5-10 min Verzögerung nach `git push` eines neuen Tags
- **Bundle-Update Workflow:** git push → tag → optional jsDelivr purge → Bootstrap-Bump in Webflow + Republish (nur wenn Bootstrap-Variable `KESSLER_VERSION` geändert wird)

## Status PLP — was steht, was fehlt

### Stand laut letzter Diff-Sicht
**Header & Page-Head:**
- ✅ H1 in Light 300
- ✅ Counter daneben
- ✅ Breadcrumb
- ✅ Header_scrolled mit Default-Hide
- ✅ Header-Scroll Hysterese ohne Flicker

**Toolbar:**
- ✅ Filter-Button mit Active-State
- ✅ Active-Tag-Pills mit Clear-All
- ✅ Sort-Dropdown ohne Border

**Filter-Sidebar/Drawer:**
- ✅ Drawer-Toggle funktioniert
- ✅ Scrollbar versteckt
- ✅ Filter-Section-Toggle mit Closed-State für Sections 4/5/6

**Cards-Grid (~95% mockup-treu):**
- ✅ 4-Spalten-Grid
- ✅ Image-Wrap mit aspect-ratio 1
- ✅ Bestseller-Badge
- ✅ Wishlist-Heart Icon
- ✅ Hover-State „+ Schnell in den Warenkorb"
- ✅ Sterne + Review-Anzahl
- ✅ Title, Sub, Preis
- ❌ **Color-Dots fehlen** ← Phase 4 (siehe `phase4-color-dots-architecture.md`)
- ❌ `plp-card-bottom` Flex-Container fehlt (hängt an Color-Dots-Implementierung)

**Pagination & Filter-Funktion:**
- ✅ Finsweet CMS Load + Filter + Sort funktionieren

## Offene Punkte für nächste Session(s)

### Hoch-priorisiert
- **Phase 4 — Color-Dots:** Architektur-Entscheidung (B1/B2/B3) → siehe `phase4-color-dots-architecture.md`
- **„This is some text inside of a div block."** Default-Webflow-Placeholder im `header_scrolled` Element — Designer-side fixen (vermutlich war dort eine Suchbar geplant; Text noch im DOM auch wenn versteckt → SEO-Issue)

### Mittel-priorisiert
- **Polnische Locale-Translations:** Multi-Locale-Pflege im Webflow Designer:
  - Breadcrumb: „Home", „Alle Produkte"
  - Filter-Section-Headers: „Kategorie", „Räume", „Farbe", „Breite", „Tiefe", „Dicke", „Preis"
  - Tag-Pills (entstehen automatisch aus Filter-Werten — keine extra Übersetzung nötig)
- **Onest-Light(300) Font-Variante:** in Site Settings → Fonts → Onest enabled prüfen, sonst fallback auf 400

### Niedrig-priorisiert / Architektur
- **Webflow-CDN-Orphans:** akkumulieren von jedem `add_inline_site_script` Call — akzeptabel, nicht kritisch
- **Build-Pipeline-Aufrüstung (esbuild + minify + sourcemaps + TypeScript)** — diskutiert als Future-Improvement, nicht gestartet
- **GitHub Actions / @claude Integration** — diskutiert als alternative Workflow, nicht implementiert
- **Claude Code Installation** für agentische Coding-Sessions — empfohlen für zukünftige Sessions, vermeidet Token-Tanz

## Token-Status

- **Repo:** `kessler-pro-scripts` (public, einziges Repo mit Token-Scope)
- **Token-Typ:** Fine-Grained PAT
- **Scope:** nur `kessler-pro-scripts`, Contents Read+Write, Metadata Read-only (auto)
- **Expiry:** 14. Mai 2026 (6 Tage ab heute)
- **Token-Wert:** im Chat-Verlauf der heutigen Session (nicht in dieser Datei oder im Memory gespeichert)
- **Status:** aktiv, nicht revoked — Sascha behält ihn während Build-Phase
- **Hinweis für nächste Session:** Token kann aus Chat-Verlauf wiederverwendet werden für git-push, ODER neuer Token wird generiert (alter wird dann automatisch ungültig nach Expiry)

## Bootstrap-Code im Webflow Site-Level (zur Referenz)

```javascript
(function(){
  var KESSLER_VERSION='@v1.0.4';
  var base='https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts'+KESSLER_VERSION+'/dist/';
  function load(f){
    var s=document.createElement('script');
    s.src=base+f;
    s.async=true;
    document.head.appendChild(s);
  }
  load('globals.js');
  if(document.getElementById('plp-grid'))load('plp.js');
  if(document.querySelector('.product-grid_wrapper')&&document.querySelector('.product-card_wrapper'))load('home.js');
})();
```

Bei Bundle-Update: nur `KESSLER_VERSION` auf neue Tag-URL bumpen + Webflow republishen.
