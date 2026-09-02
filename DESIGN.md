---
name: Kessler PRO
description: Werkstatt-Präzision als Designsystem. Warme Neutraltöne, keine Akzentfarbe, eine Schrift. Hierarchie entsteht durch Kontrast und Gewicht, nie durch Farbe.

colors:
  ink: "#1E1E1E"           # Fließtext, Überschriften, primäre Flächen
  tile-dark: "#17191B"     # Kacheln auf Fotos, dunkle Sektion, Hover-Zustand
  paper: "#F2F0EB"         # Sand — ruhige Flächen ohne Foto
  surface-soft: "#F4F3F2"  # Produktfeld in Karten
  white: "#FFFFFF"
  hairline: "#E5E5E5"      # Trennlinie auf Weiß, 1px
  rule: "#D8D4CC"          # Rand von Karten und Kacheln
  text-2: "#4A4A46"        # beschreibender Text, Sekundärzeile   8,90:1 auf Weiß
  text-3: "#6D6A63"        # Meta, Datum, Bildunterschrift        5,40:1 auf Weiß
  text-disabled: "#9A978F" # NUR deaktiviert und Platzhalter, nie Fließtext
  paper-deep: "#E9E6E0"    # abgesetzte Fläche auf paper

  # Auf Dunkel (tile-dark) — freigegeben 02.09.2026 mit Mail-Layout B
  rule-on-dark: "#3A3D41"  # Trennlinie auf #17191B, 1px
  text-on-dark: "#CFCBC3"  # Sekundärtext auf #17191B     10,9:1

typography:
  family: "Onest"
  weights: [300, 400, 500, 700]
  scale:
    12: "0.75rem"
    14: "0.875rem"
    16: "1rem"
    20: "1.25rem"
    26: "1.625rem"
    34: "2.125rem"
    44: "2.75rem"
  roles:
    display: "clamp(2.125rem, 5vw, 2.75rem)"
    h2: "2.125rem"
    h3: "1.625rem"
    lead: "1.25rem"
    body: "1rem"
    caption: "0.875rem"
    label: "0.75rem"

rounded:
  none: "0"
  sm: "4px"
  lg: "8px"
  xl: "16px"
  pill: "999px"

spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "16": "64px"
  "24": "96px"
  "32": "128px"

section-rhythm:
  quiet: "clamp(32px, 4vw, 48px)"
  standard: "clamp(48px, 7vw, 80px)"
  emphasis: "clamp(80px, 10vw, 120px)"

layout:
  container: "1184px"
  gutter: "24px"
  tile-gap: "16px"
  tile-inset: "24px"
  breakpoints: [640, 768, 1024]

components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "0 24px"
    height: "48px"
    typography: "{typography.roles.body}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    borderColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 24px"
    height: "48px"
  input-text:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
    fontSize: "1rem"
  card:
    backgroundColor: "{colors.white}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Designsystem Kessler PRO

Kopie des Projektdokuments `claude/DESIGN.md` (Stand 02.09.2026) für die Werkzeuge im Repo. Führend bleibt das Projektdokument.

## 1. Grundhaltung

Kessler PRO fertigt Arbeitsflächen aus Holz. Das Designsystem soll wirken wie das Produkt: maßhaltig, ruhig, ohne Zierat. Präzision statt Ausdruck. Drei Wörter: **maßhaltig, ruhig, warm.**

## 2. Farbe: keine Akzentfarbe

Die Palette ist vollständig neutral, mit warmer Tendenz. Hierarchie entsteht ausschließlich über Kontrast, Gewicht und Fläche. Ein Button ist wichtig, weil er dunkel auf hell steht — nicht weil er blau ist.

- Keine Akzentfarbe einführen. Kein Markenblau, kein Signalorange, kein Grün für „verfügbar".
- Statusfarben nur dort, wo sie Funktion tragen (Fehlermeldung im Formular). Nie dekorativ.
- Warm und kühl nicht mischen. Höchstens **eine** dunkle Sektion je Seite.
- Keine Verläufe. Keine farbigen Schatten.
- Benannte Ausnahme `link-blue #1A5FD0` (freigegeben 20.08.2026): nur Textlinks innerhalb einer Karte, die deren Inhalt umschalten. Nie für Buttons, Navigation, Flächen.
- Auf der dunklen Sektion (`tile-dark`) gilt: Überschrift Weiß, Sekundärtext `text-on-dark #CFCBC3`, Linien `rule-on-dark #3A3D41`. Freigegeben 02.09.2026 mit dem Mail-Kopf B (Ink block); gilt für Mails und Website gleichermaßen.

## 3. Typografie: eine Familie, sieben Stufen

Onest in 300/400/500/700. Jede `font-size` landet auf einer Stufe der Skala. Fließtext 16px. Zeilenhöhe Überschriften 1.05, Fließtext 1.5. Tracking große Headlines ~-0.02em. Kein Uppercase-Letterspacing als Dauerornament (einmal je Seite als Label). Gewicht 700 nur für H1/H2, Karten-Überschriften 500.

## 4. Rhythmus

Drei Sektionsstufen (quiet / standard / emphasis), bewusst vergeben. 4px Basis, 8px-Schritte bevorzugt; 4er-Zwischenschritte nur komponentenintern.

## 5. Material und Erhebung

Schatten sparsam, Karten liegen flach. Verboten: Glas-Karten, backdrop-blur, Innenschatten als Dekor, `border-left`-Akzente über 1px. Trennlinien 1px.

## 6. Bewegung

Nur transform/opacity. Button 100–160ms, UI unter 300ms. Ease-out `cubic-bezier(0.23, 1, 0.32, 1)`. Nie ease-in. `prefers-reduced-motion` respektieren. Crisp, schnell, präzise — nie verspielt.

## 7. Do und Do Not

**Do:** Zahlen zeigen. Maße, Materialstärken und Kanten sichtbar machen. Weißraum als Hierarchie. Bei Unsicherheit weglassen.

**Do Not:** Emoji als Icons. Zwei Karten-Ebenen ineinander. Grauer Text auf farbiger Fläche. Icon-Kachel über jeder Überschrift. Glow, Partikel, Verläufe. SaaS-Formensprache (Metrik-Reihen, identische Feature-Karten). Platzhalterflächen.
