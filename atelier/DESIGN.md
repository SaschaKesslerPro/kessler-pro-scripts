Aktueller Gesamtstand: Alle sieben Holztexturen, überarbeitete Bauchbemaßung ohne weiße Kästchen und separate nummerierte Eckenlegende sind im Code umgesetzt. Maßgeblich für diese Änderungen ist UEBERGABE-AN-CLAUDE.md. Die folgenden Abschnitte dokumentieren teilweise frühere Entwurfsstände.

---
name: Kessler PRO Konfigurator
description: Ruhige Arbeitsfläche für die individuelle Tischplatte; lokale Designvorschau.
colors:
  paper: "#fff"
  surface: "#f4f4f5"
  alt: "#fafafa"
  ink: "#0a0a0a"
  body: "#5c5c5e"
  line: "#dcdcdd"
  green: "#0a7c47"
  error: "#a72d27"
  error-surface: "#fff4f2"
  field-border: "#a5a5a8"
  choice-border: "#b7b7b9"
  primary-hover: "#333"
  secondary-hover: "#f5f5f5"
typography:
  display:
    fontFamily: "Onest, sans-serif"
    fontSize: "40px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-1.3px"
  headline:
    fontFamily: "Onest, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-.65px"
  body:
    fontFamily: "Onest, sans-serif"
    fontSize: "15px"
    lineHeight: 1.5
  title:
    fontFamily: "Onest, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.5
  label:
    fontFamily: "Onest, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  price:
    fontFamily: "Onest, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-.7px"
rounded:
  image: "6px"
  control: "8px"
  compact-surface: "12px"
  surface: "16px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  section: "32px"
  wide: "48px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "14px 20px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px 22px"
  button-text:
    textColor: "{colors.ink}"
    padding: "0"
  input-dimension:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "13px 16px"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  chip-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  preview-surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "16px 20px 24px"
  validation-message:
    backgroundColor: "{colors.error-surface}"
    textColor: "{colors.error}"
    rounded: "{rounded.control}"
    padding: "16px"
---

# Design System: Kessler PRO Konfigurator

## Overview

**Creative North Star: "Die ruhige Werkbank"**

Die konfigurierte Platte steht im Mittelpunkt einer hellen Arbeitsfläche. Echte Material- und Kantenaufnahmen, präzise Maßzeichnungen und eine zurückhaltende Typografie vermitteln die Fertigungsperspektive von Kessler PRO. Auswahl und Prüfung bleiben in vier klaren Schritten erreichbar.

Diese Dokumentation erfasst die implementierte lokale Vorschau vom 10.09.2026. Sie aktualisiert den vorläufigen Entwurfsvertrag und gilt nur für diesen Konfigurator, nicht als Ersatz für das markenweite Design. Quellen: atelier.css, atelier.js, index.html und lokale Onest-Fonts. Eingebettete Originalsteuerungen und Zeichnungen stammen weiterhin aus engine.js; dokumentiert sind hier ihre sichtbaren Atelier-Overrides. Produktdaten und Rechenkern sind übernommen, der Warenkorb ist ein lokaler Sitzungsentwurf. Die kreative Richtung ist im Auftrag des Nutzers delegiert.

**Key Characteristics:**

- Helle, überwiegend flache Arbeitsflächen mit feinen Trennlinien.
- Produktansicht und Maßzeichnung als aufgabenbezogene Ansichten desselben Werkstücks.
- Schwarze Auswahl- und Aktionszustände; Grün für abgeschlossene Schritte und Tastaturfokus.
- Dauerhaft erreichbarer Preis mit nächster Aktion.

## Colors

Die neutrale Palette lässt Dekore und Kantenfotos die Materialwirkung tragen. Die Frontmatter enthält tatsächliche wiederkehrende Werte, keine zusätzliche Markenpalette. Ink prägt Text, Auswahlkonturen und Hauptaktion. Paper ist die weiße Seitenfläche; Surface hebt Vorschau und gewählte Chips ab. Alt kennzeichnet dezente Zeilen- und Bearbeitungsflächen. Body trägt Erläuterungen, Line trennt Abschnitte. Felder und Auswahlsteuerungen haben dunklere Konturen als die allgemeinen Trennlinien.

Green markiert abgeschlossene Schrittnummern, Tastaturfokus und Eingabecaret. Error zusammen mit Error Surface kennzeichnet ungültige Maße oder Bearbeitungen; die Meldung beschreibt den Fehler zusätzlich in Text.

## Typography

Onest wird lokal mit font-display: swap geladen; verfügbar sind 300, 400, 500, 600 und 700. Die Oberfläche arbeitet überwiegend mit 400 bis 600; 300 kommt beim Plus/Minus der aufklappbaren Bereiche vor. Fallback ist sans-serif.

Die Display- und Headline-Rollen beschreiben H1 und Schrittüberschrift auf großen Ansichten. Unter 1200 px wird H1 34 px; bis 767 px ist der endgültige Wert **26 px** mit −.8 px Laufweite, die Schrittüberschrift 23 px mit −.6 px Laufweite. Dialogtitel verwenden 28 px, mobil 24 px.

Grundtext im Konfigurator ist 15 px. Erklärende Absätze verwenden meist 13–14 px und 1.6 Zeilenhöhe. Dimensionseingaben verwenden 17 px, mobil 16 px; Bearbeitungsfelder und Freitext verwenden 16 px. Preise und Maße nutzen tabellarische Ziffern. Der Preis in der festen Leiste wird mobil 23 px groß.

Kompakte Dekor-, Vorschau-, Navigations- und Preisnebeninformationen sind tatsächlich **10–12 px** groß. Eine allgemeine Mindestschriftgröße von 13 px beschreibt den aktuellen Stand nicht. Kleine Metadaten sind keine Vorlage für neue Fließtexte.

## Layout

Die Arbeitsfläche hat maximal 1440 px Breite. Unter 1520 px erhält sie 48 px Seitenabstand, unter 1200 px 32 px, bis 767 px 20 px. Die Kopfzeile ist maximal 1520 px breit und 88 px hoch; mobil 66 px. Eine schmale Vorschaukennzeichnung steht darüber.

Vier Schritte bilden ein gleichmäßiges Raster. Desktop teilt die Werkbank im Verhältnis 1.15:1 mit 64 px Abstand; ab 1600 px wächst der Abstand auf 80 px. Unter 1520 px sind es 48 px; unter 1200 px stehen zwei gleiche Spalten mit 32 px Abstand. Die Produktvorschau haftet 24 px unter dem oberen Fensterrand.

Die Zeichenfläche ist regulär 430 px hoch, ab 1600 px 480 px, unter 1520 px 390 px und unter 1200 px 320 px. Bis 767 px stapeln sich Vorschau und Formular mit 20 px Abstand und normal scrollender Vorschau. Die endgültige mobile Zeichenhöhe ist **100 px**. Intro-Untertext, separates Kantenfoto und Vorschauhinweis sind mobil verborgen. Die Vorschau bleibt vergrößerbar.

Materialoptionen sind Bildzeilen, Dekore ein Raster aus sechs Spalten beziehungsweise fünf unter 1200 px. Formoptionen haben vier Spalten, mobil zwei. Maßfelder bleiben zweispaltig. Extras öffnen sich als native Details-Bereiche. Die Prüfung nutzt beschriftete Zeilen und direkte Änderungsaktionen.

Die Preisleiste ist auf **allen Bildschirmgrößen fest positioniert**. Ab 768 px steht sie 16 px über dem unteren Rand, zentriert, maximal 1440 px breit und mit calc(100% - 64px) Breite. Innenabstand: 16 px 24 px; Hauptaktion mindestens 240 px breit. Mobil liegt sie über die gesamte Breite am unteren Rand, mit 12 px 20 px und zusätzlichem Safe-Area-Abstand. Die Hauptaktion belegt bis zu 47 %. Der Footer reserviert unten 144 px, desktop 160 px Platz.

Die vergrößerte Vorschau füllt das Fenster mit 24 px Außenabstand; mobil 8 px und calc(100dvh - 16px) Höhe. Dialoge sind maximal 940 px breit und 90 vh hoch, der Warenkorb 660 px; mobil maximal calc(100% - 24px) breit und 90 dvh hoch.

## Elevation & Depth

Die Grundfläche ist flach. Tonwerte, Konturen und Trennlinien strukturieren die Bedienung. Schatten existieren bei Überlagerungen und der festen Preisleiste; die frühere pauschale Aussage „kein Schatten im Ruhezustand“ ist überholt.

- Preisleiste desktop: `0 5px 30px #0000000d`.
- Preisleiste mobil: `0 -5px 22px rgba(0,0,0,.04)`.
- Vergrößerte Vorschau: `0 24px 80px rgba(0,0,0,.25)` mit Hintergrundabdeckung `#0006`.
- Gewählte Chips und Formen: `inset 0 0 0 1px var(--ink)` verstärkt die Auswahlkontur.
- Native Dialoge: Hintergrundabdeckung `rgba(10,10,10,.4)`.

## Shapes

Steuerungen verwenden 8 px Radien; Dekorfotos und kompakte Bearbeitungsfelder 6 px. Die große Vorschau und Desktopdialoge verwenden 16 px, mobile Flächen und Desktoppreisleiste 12 px. Materialzeilen sind ungerundet und durch Linien getrennt. Runde Auswahlmarken ergänzen die Beschriftung.

Die Plattenkontur kommt aus dem vorhandenen Rechenkern. Rechteck, Rund, L-Form und Bauchausschnitt werden als SVG-Silhouetten angeboten. Echte Produktbilder und berechnete Geometrie ersetzen dekorative Illustrationen.

## Components

**Tasten.** Die Hauptaktion im Konfigurator ist schwarz, mit 13 px/500 Schrift, 52 px Mindesthöhe und weißem Text. Mobil hat die Preisaktion 48 px Mindesthöhe und 12 px Schrift. Sekundärtasten sind weiß mit schwarzer Kontur; Textaktionen sind unterstrichen. Globale Primärtasten außerhalb des Konfigurators verwenden 14 px/600 und 14 px 22 px Innenabstand. Ihr Hoverwert ist Primary Hover; die spezifischere Hauptaktion innerhalb des Konfigurators behält ihren schwarzen Hintergrund.

**Auswahl.** Materialzeilen zeigen Foto, Namen, Beschreibung und gefüllte Auswahlmarke. Dekore nutzen eine Außenkontur mit 3 px Abstand; ausgewählte Chips und Formen haben die verstärkte Innenkontur und graue Fläche. Status wird über aria-pressed, aria-current beziehungsweise die vorhandenen Core-Steuerungen vermittelt.

**Felder und Fehler.** Dimensionen stehen mit Einheit in einer umrandeten Gruppe, Mindesthöhe 54 px. Grenzen und Fehlertext stehen darunter. Ungültige Bearbeitungszeilen erhalten rote Kontur, helle Fehlerfläche und aria-invalid. Eine gemeinsame Meldung ist als Alert ausgezeichnet. Ergänzende Kontur- und Kollisionsprüfung sperrt ungültige Bearbeitungen; absolute Polygonpunkte werden im Geometriepfad berücksichtigt.

**Navigation und Vorschau.** Ein Schrittwechsel setzt den Fokus auf die neue Überschrift. Material startet in 3D; folgende Schritte starten in der Maßzeichnung. Beide Ansichten bleiben wählbar. Die vergrößerte Vorschau sperrt den Hintergrund mit inert, hält den Tastaturfokus und schließt mit Escape; beim Schließen kehrt der Fokus zurück. Ansichtsschalter, Vergrößerung und Mengentaster sind nach den finalen Overrides 44 px hoch, Mengentaster und Vergrößerung auch 44 px breit.

**Preis, Prüfung und Warenkorb.** Die feste Leiste zeigt Preis, Steuer-/Versandhinweis und nächsten Schritt. Ungültige Konfigurationen zeigen einen Strich; individuelle Angebote „Preis auf Anfrage“. Im Prüfschritt werden Anfragen als „Auf Anfrage“ beziehungsweise „Angebot erforderlich“ zusammengefasst und führen über eine separate Aktion zum Live-Konfigurator. Der Entwurfswarenkorb zeigt die tatsächliche SVG-Vorschau und speichert nur in der Browsersitzung; er löst keine Bestellung aus.

**Fokus und Bewegung.** Interaktive Elemente erhalten einen grünen 2-px-Fokusrahmen mit 4 px Abstand. Deaktivierte Tasten verwenden .45 Deckkraft. Es gibt keine eigene dekorative Transitionsskala in atelier.css; Schritte scrollen unmittelbar. prefers-reduced-motion reduziert Animationen und Transitionen auf .01 ms und setzt automatisches Scrollverhalten.

## Do's and Don'ts

- **Do** echte Kantenfotos, lokale Onest-Fonts und die vorhandene Plattengeometrie verwenden.
- **Do** den festen Preis mit nächster Aktion auf Desktop und Mobil berücksichtigen und Inhalte darunter erreichbar halten.
- **Do** Auswahl, Fehler und Fokus zusätzlich zur Farbe durch Kontur, Text oder zugänglichen Zustand vermitteln.
- **Do** neue Fließtexte an den vorhandenen 13–15-px-Rollen ausrichten; kompakte Metadaten bewusst getrennt behandeln.
- **Don't** die kleine mobile Vorschau wieder als großen festen Block über das Formular setzen.
- **Don't** Grün als flächige Kaufaktionsfarbe oder zusätzliche dekorative Kartenverschachtelung einführen.
- **Don't** offene Angebotspreise oder fehlerhafte Geometrie als kaufbaren Endpreis darstellen.
- **Don't** diese lokale Dokumentation als Neudefinition der gesamten Kessler-Marke verwenden.

## Verbindlicher Nachtrag: Saschas Screenshot-Review, 10.09.2026

Die folgenden Anpassungen präzisieren die oben dokumentierte Erstfassung:

- Schritt4 heißt **Übersicht**. Berechenbare Konfigurationen: „In den Warenkorb“. Beim Bearbeiten „Änderungen speichern“, bei eigenen Bohrbildern „Anfrage vorbereiten“. Keine vorgeschaltete technische Prüfung als Kaufhürde.
- Eine Originalaufnahme pro Platte, proportional beschnitten; keine Spiegelkacheln in 2D oder3D. Die Maserung ist eine Materialvisualisierung, kein verbindlicher Dekormaßstab.
- Bildschirmbemaßung in `drawing-adapter.js`: weiße Labels mit17px/500,26px Höhe,5px Radius, dunkler Schrift#171717 und heller Kontur#D6D6D6. L-Breite und Tiefe getrennt; Bauchausschnitt A/B/C, Tiefe und Winkel getrennt. Die Tiefe liegt über dem Ausschnitt im Material.
- Mobile Produktansicht100px, **Maßzeichnung230px**, weiterhin vergrößerbar. Der Formularbereich scrollt normal.
- Die freie Polygonkontur ist in der Oberfläche verborgen und deaktiviert. Rechteckige/runde Ausschnitte, Kabelkanäle und eigenes Bohrbild bleiben.
- Warenkorb mit44px Mengentasten und52px breitem Zahlenfeld. Positionssumme, Einzelpreis und Plattengesamtsumme getrennt. Versand für den Gesamtwarenkorb erst durch Shopify. „Weitere Platte konfigurieren“, „Kopie anpassen“ und „Zur Kasse“ folgen nach den Positionen.
- Bearbeiten erhält Position und Menge; Kopieren erzeugt einen unabhängigen Entwurf. Konfigurationen werden tief kopiert. Lokale Speicherung weiterhin in sessionStorage; keine echte Zahlung oder Anfrageübermittlung.
- Live-Anbindung und bestehende Kunden-/Maschinendateien werden von Claude übernommen; siehe `UEBERGABE-AN-CLAUDE.md`.

Erneuter unabhängiger Review: „Ship for local design handoff“, keine wesentlichen Regressionen im geprüften Änderungsumfang.16 Regressionstests bestanden;3 davon prüfen den unverbundenen Shopify-Vertrag ausschließlich mit Mocks.

## Texturmaßstab – laufender Hickory-Versuch

Eine auf die ganze Platte vergrößerte Probe ist für Holzmuster nicht ausreichend. Nach Saschas erneuter Rückmeldung erhält nur Hickory einen KI-erweiterten Atlas mit zugewiesener Fläche300×200cm. 2D und3D zeigen einen zentrierten Ausschnitt in konstantem Weltmaßstab, ohne Spiegeln/Wiederholen und ohne Randbeschnitt des Atlanten. `texture-atlases.json` beschreibt Quelle, Fläche und Prototypstatus. Das Original bleibt als Swatch und Kantenfoto sichtbar; unter der Vorschau steht ein12px-Hinweis auf den Texturtest. Keine weiteren Dekore umgestellt. Für den endgültigen Shop bevorzugt reale Dekor-Scans mit bekannter Abmessung.
