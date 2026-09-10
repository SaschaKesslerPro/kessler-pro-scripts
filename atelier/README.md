# Atelier — die vierschrittige Oberfläche des Konfigurators

Aus einem Codex-Entwurf vom 10.09.2026 übernommen und für die Webflow-Seite umgebaut.

## Grundsatz

Der Rechenkern bleibt unberührt. `dist/konfigurator.js` ist und bleibt die einzige
Quelle für Preise, Geometrie, Zeichnung und Worker-Anbindung. `build.mjs` patcht ihn
nur an klar benannten Ankern und legt die neue Oberfläche darüber. Bricht ein Anker,
bricht der Build laut — nicht die Seite still.

## Bauen

    node atelier/build.mjs --live     → dist/konfigurator-atelier.js   (eine Datei für Webflow)
    node atelier/build.mjs            → atelier/engine.js              (lokale Designvorschau)

Der Live-Build enthält alles: den gepatchten Kern, die Oberfläche, das gescopte CSS
und die Dialoge. Webflow braucht nur einen leeren Container:

    <div data-kfg-root></div>

## Dateien

| Datei | Zweck |
|---|---|
| `build.mjs` | patcht den Kern, baut beide Fassungen |
| `atelier.js` | die vierschrittige Oberfläche |
| `atelier.css` | ihr Stylesheet (Vorschau-Fassung, global) |
| `scope-css.mjs` | schneidet Vorschau-Hülle heraus, hängt den Rest unter `#atelier` |
| `live-shell.js` | baut Dialoge und Statusknoten auf der Webflow-Seite |
| `drawing-adapter.js` | nummerierte Ecken, neue Bemaßung für L-Form und Bauchausschnitt |
| `geometry.mjs` | Lageprüfung der Bearbeitungen (Vorschau-Wächter) |
| `shopify-cart.mjs` | `lineTotal`; der echte Warenkorbweg liegt im Kern |
| `texture-atlases.json` | KI-erweiterte Holztexturen, 300 × 200 cm, konstanter Maßstab |
| `DESIGN.md` | Designsystem des Entwurfs |

## Warenkorb

Die Oberfläche sammelt Platten in einem Entwurfskorb (`sessionStorage`). Erst
„Zur Kasse" übergibt sie: **je Konfiguration ein Aufruf** an `/warenkorb` des Workers,
der die Variante mit dem **Stückpreis** anlegt; die **Stückzahl** geht getrennt als
`quantity` an Shopyflow. Der Versand wird danach von Shopify für den gesamten
Warenkorb berechnet. Lagerplatten gehen ohne Worker direkt auf ihre Variante.
Eigenes Bohrbild bleibt eine Anfrage per Mail (`anfrageMail` des Kerns).

Bricht die Übergabe mittendrin ab, bleiben nur die noch nicht übergebenen Platten im
Entwurfskorb — ein zweiter Versuch erzeugt keine doppelte Position.

## Sprachen

Die Oberfläche schreibt deutsch und läuft danach durch `uebersetze()` des Kerns
(`api.translate`). Neue Wörter stehen in `dist/data/kfg-i18n.json`.
Preisformat und Versandpauschale kommen aus dem Kern — auf `/pl-pl/` also Złoty.

## Test

    python3 -m http.server 8765 &
    node tools/kfg_atelier_test.js       # 36 Zusicherungen
