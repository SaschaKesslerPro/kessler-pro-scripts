# Mail und Signatur — Kessler PRO

Quelle für die Zeichnungsmails des Konfigurator-Workers, die E-Mail-Signatur der Mitarbeiter und die erste Kampagnenmail.

- `mail-design-varianten.html` — Entscheidungsseite 02.09.2026: vier Köpfe der Zeichnungsmail (A Paper band, B Ink block, C Title block, D Showcase), drei Signaturen (1 Rule, 2 Stack, 3 Tile) und der Newsletter „N · Launch", englisch, Designsystem der Website (DESIGN.md im Repo-Wurzelverzeichnis). Enthält die Auswertung der fünf Beispielmails (Homesick, Grüns, Kylie, Magic Spoon, Olipop).
- `bilder/showcase-draufsicht.svg` / `.png` — beschriftete Draufsicht der Platte für Variante D (KP-2026-1034: 400 × 400, Sonoma, ABS 2 mm, Ø 85, 4 × Ø 8, R 30). Vorlage für den Worker-Schritt, der dieses Bild später aus den Bestelldaten erzeugt (536 × 450 px, 2×).
- `bilder/newsletter-*.jpg` — Produktfotos aus dem Shopify-CDN, zugeschnitten (Held 1072 × 680, Reihen 560 × 560; transparente PNGs auf Papier #F2F0EB gelegt).
- `kp-logo-email-dark.png` / `kp-logo-email-white.png` — Logo 300 × 99 px (Anzeige 150 × 50), gehostet auf dem Webflow-CDN:
  - dunkel: https://cdn.prod.website-files.com/67fea16d9758f16a33bef722/6a9881f2f6aec0b7ed7095f2_kp-logo-email-dark.png
  - weiß:   https://cdn.prod.website-files.com/67fea16d9758f16a33bef722/6a9881f22718bfe956c27554_kp-logo-email-white.png

Regeln: 600 px Mails, 400 px Signaturen, Tabellen + Inline-Stile, Bilder extern vom CDN, genau ein Hauptknopf, Rechtszeile und Antwortadresse im Fuß; Kampagnen zusätzlich mit Empfangsgrund und Abmeldelink. Der Worker verschickt nur Transaktionsmails — Kampagnen laufen über Shopify Email oder Klaviyo. Nach der Auswahl wandert die gewählte Mail in `worker/konfigurator-checkout/src/mail.js` und die Signatur in einen Generator (`mail/signatur/`).

Farben außerhalb von DESIGN.md (dunkle Sektion in B und N): Linie `#3A3D41`, Text `#CFCBC3` auf `#17191B` — bei Freigabe in DESIGN.md nachtragen.
