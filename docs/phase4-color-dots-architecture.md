# Phase 4 — Color-Dots auf PLP-Cards: Architektur-Planung

**Status:** Verschoben auf nächste Session — Architektur-Entscheidung nötig bevor Implementierung startet.

## Kontext

Mockup zeigt Color-Dots unter dem Preis jeder Card (z.B. Werkbank-Card → 3 Dots: schwarz, weiß, grau). Heißt: die PLP soll **eine Card pro Produkt-Familie** zeigen, mit allen verfügbaren Farben als Dots.

## Ist-Zustand der Datenstruktur

### Products Feeds Collection (`69a2f0ad6b29b5d497cdb6e0`, slug `products`)
Aktuell **SKU-pro-Item** Modell — jede Werkbank-Variante ist ein eigenes Item:
- "Werkbank Weiß" → Item 1
- "Werkbank Schwarz" → Item 2
- "Werkbank Grau" → Item 3

Relevante Felder:
| Slug | Type | Werte |
|---|---|---|
| `produkttyp` | **Option** (Single-Select) | Werkbank, Tischplatte Sperrholz, Spannplatte, Tischgestell, Tisch auf Metallbasis, Regalzubehör, Medizinschrank |
| `farbe` | **Option** (Single-Select) | Weiß, Schwarz, Grau, Ahorn, Buche, Eiche, Esche, Kiefer, Helles Holz |
| `breite-cm` | Option | 60, 90, 100, 120, 150, 180 |
| `tiefe-cm` | Option | 22, 24, 40, 45, 49, 50, 54, 59, 60, 68, 70, 80, 90, 100, 120, 139, 160 |
| `dicke-mm` | Option | 18, 21, 25, 28, 40 |
| `kategorie` | Reference → Produktkategorien | |
| `raume` | MultiReference → Räume | |
| `name`, `slug`, `product-id`, `product-price`, `preis-numerisch` | PlainText/Number | |

**Gesamt-Items:** ~148 Produkte (laut Memory)

### Farben Collection (`69c2491c68418dd75f0d7753`, slug `farben`)
Existiert bereits — 1 Item pro Farbe:
| Slug | Type |
|---|---|
| `name` | PlainText |
| `slug` | PlainText |
| `hex-cod` | **Color** ← bereits da, aber Slug-Tippfehler (sollte `hex-code` heißen) |
| `sort-order` | Number |

**Wichtig:** keine Verbindung zwischen Products Feeds und Farben Collection — `farbe` auf Products Feeds ist Option-Field, kein Reference.

## Soll-Zustand für Color-Dots

PLP-Card zeigt:
1. **EINE Card pro Produkt-Familie** (z.B. nur eine "Werkbank"-Card statt drei)
2. Card-Bottom Container mit Preis links + Color-Dots rechts
3. Dots zeigen alle verfügbaren Farben dieser Familie
4. Klick auf Dot → PDP der gewählten Variante (oder Inline-State-Change)

## 3 Architektur-Optionen

### Weg B1 — Master-Produkte-Collection (sauberster Weg)

Neue **Master-Collection** „Produkte" anlegen:
- 1 Item pro Produkt-Familie (z.B. „Werkbank")
- Felder:
  - `name`, `slug`, `description`, `gallery`
  - `produkttyp` (Option)
  - `verfügbare-farben` (**MultiReference → Farben**)
  - `default-variant` (Reference → Products Feeds — für Default-Display)
  - `variants` (MultiReference → Products Feeds — alle SKUs dieser Familie)
  - `kategorie`, `raume` (von Variant-Items aggregiert)

**PLP-Quelle:** neue Master-Collection (nicht mehr Products Feeds)
**PDP:** zeigt Default-Variant, mit Variant-Switcher (Color-Dots + Größe-Dots)
**Bundle-Anpassung:** Card-Template auf Master-Items binden

**Aufwand:**
- ~30 min Schema anlegen
- ~2-3h Master-Items für ~30-50 Familien manuell erstellen (oder Backfill-Script)
- ~1-2h Card-Template + PDP umbauen
- Polnische Locale parallel pflegen
- **Total: ~4-6h**

**Vorteile:**
- Sauberes Datenmodell, branchenüblich
- Klare Trennung: Master = Familie, Variants = SKUs
- Skaliert für zukünftige Features (Größen-Dots, Material-Switcher etc.)

**Nachteile:**
- Größter Refactor
- Master + Variants müssen synchron gehalten werden bei neuen Produkten
- Polnische Locale doppelt pflegen (Master + Variants)

### Weg B2 — SKU bleibt + MultiReference auf Farben + JS-Grouping

Auf bestehender Products Feeds Collection:
- Neues Feld `verfügbare-farben` (**MultiReference → Farben**)
- Pro SKU werden ALLE Farben dieser Familie referenziert (redundant)

**PLP-Quelle:** Products Feeds (unverändert)
**JS-Logic:** filtert nach Render — nur EIN SKU pro `produkttyp` wird angezeigt (z.B. der erste oder ein Default)
**Bundle-Anpassung:** plp.js bekommt Grouping-Logic

**Aufwand:**
- ~10 min Schema-Erweiterung
- ~30 min für 148 Items die `verfügbare-farben` setzen (Bulk-Update via API möglich)
- ~1h JS-Grouping in plp.js + Card-Template
- **Total: ~2-3h**

**Vorteile:**
- Kein Schema-Refactor
- Schnell umsetzbar

**Nachteile:**
- Daten-Redundanz: 3 Werkbank-SKUs haben alle dieselbe `verfügbare-farben`-Liste
- JS-Grouping-Logic ist anfällig (Finsweet CMS Filter macht eigene Render-Order — Grouping-Logic muss DOM-Manipulation nach Filter-Update machen)
- Pagination wird kompliziert (3 SKUs zählen als 3 Items, nicht 1)
- Sortierung („Beliebteste") wird verzerrt

### Weg B3 — Primary-Variant Flag (pragmatischer Mittelweg)

Auf bestehender Products Feeds Collection:
- Neues **Switch-Feld** `is-primary-variant` (Boolean)
- Neues Feld `verfügbare-farben` (MultiReference → Farben)
- Pro Produkt-Familie wird genau EIN SKU als `is-primary-variant: true` gesetzt
- Bei dem Primary-SKU werden die `verfügbare-farben` gepflegt

**PLP-Quelle:** Products Feeds gefiltert per Finsweet auf `is-primary-variant = true`
**PDP:** zeigt aktuelle Variant + Variant-Switcher (Color-Dots → andere SKUs)
**Bundle-Anpassung:** Card-Template bindet `verfügbare-farben` auf Dots

**Aufwand:**
- ~10 min Schema-Erweiterung (2 neue Felder)
- ~30 min Primary-Flag setzen + Farben-Refs pflegen für ~30 Familien (per CMS oder Bulk-API)
- ~1h Card-Template + Finsweet-Filter
- **Total: ~3-4h**

**Vorteile:**
- CMS-driven Filter (Finsweet `[fs-cmsfilter-field='is-primary-variant'][fs-cmsfilter-value='true']`) — kein JS-Hack
- Sortierung + Pagination funktionieren korrekt
- Schema bleibt überschaubar
- Erweiterbar auf Größen-Switcher später

**Nachteile:**
- Datenintegrität: Was wenn 2 Items als primary markiert sind? (Validierung manuell)
- Wenn Primary-SKU gelöscht/ausverkauft wird, muss neue Primary gesetzt werden
- PDP-Logic muss zwischen SKUs navigieren können

## Empfehlung

**Weg B3** als pragmatischer Mittelweg — Schnellster ROI ohne dauerhafte Architektur-Schuld. **Weg B1** wenn das Projekt langfristig wachsen soll und du die Refactor-Zeit hast.

Weg B2 nicht empfohlen — JS-Grouping bricht zu viele Standard-Mechaniken (Filter, Sort, Pagination).

## Was nächste Session vorbereitet sein sollte

1. **Architektur-Entscheidung:** B1, B2 oder B3
2. **Master-Mapping** (falls B1) oder **Primary-Flag-Liste** (falls B3): welche Produktfamilien gibt's, welcher SKU pro Familie ist der Primary?
3. **Farben-Hex-Codes:** alle 9 Farben in der Farben-Collection mit korrekten Hex-Werten gepflegt? (Slug-Typo `hex-cod` ggf. fixen)
4. **Mockup-Verhalten klären:** Was passiert beim Klick auf einen Color-Dot? PDP der Variante? Inline-Image-Wechsel?

## Bereits vorbereitet im Bundle

`plp.js` Variant-Dot-Logic ist schon implementiert (von vorigen Sessions):
```javascript
document.querySelectorAll('.plp-variant-dot').forEach(function (d) {
  if (d.dataset.bg) d.style.background = d.dataset.bg;
});
```

Erwartet im DOM:
```html
<div class="plp-card-bottom">
  <span class="plp-card-price">€ 30,00</span>
  <div class="plp-card-variants">
    <span class="plp-variant-dot is-active" data-bg="#0a0a0a"></span>
    <span class="plp-variant-dot" data-bg="#ffffff"></span>
    <span class="plp-variant-dot" data-bg="#7a7a7a"></span>
  </div>
</div>
```

CSS für Dots ist im Mockup spezifiziert:
```css
.plp-variant-dot {
  width: 14px; height: 14px;
  border-radius: 50%;
  border: 1.5px solid transparent;
  cursor: pointer;
  position: relative;
}
.plp-variant-dot::after {
  content: ""; position: absolute; inset: 1px;
  border-radius: 50%;
}
.plp-variant-dot.is-active {
  border-color: var(--deep);
}
```
