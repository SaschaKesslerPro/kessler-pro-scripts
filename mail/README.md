# Mail und Signatur — Kessler PRO

Quelle für die Zeichnungsmails des Konfigurator-Workers und die E-Mail-Signatur der Mitarbeiter.

- `mail-design-varianten.html` — Entscheidungsseite 02.09.2026: drei Köpfe der Zeichnungsmail (A Paper band, B Ink block, C Title block) und drei Signaturen (1 Rule, 2 Stack, 3 Tile), englisch, Designsystem der Website (DESIGN.md im Repo-Wurzelverzeichnis).
- `kp-logo-email-dark.png` / `kp-logo-email-white.png` — Logo 300 × 99 px (Anzeige 150 × 50), gehostet auf dem Webflow-CDN:
  - dunkel: https://cdn.prod.website-files.com/67fea16d9758f16a33bef722/6a9881f2f6aec0b7ed7095f2_kp-logo-email-dark.png
  - weiß:   https://cdn.prod.website-files.com/67fea16d9758f16a33bef722/6a9881f22718bfe956c27554_kp-logo-email-white.png

Regeln: 600 px Mails, 400 px Signaturen, Tabellen + Inline-Stile, Bilder extern vom CDN, genau ein Hauptknopf, Rechtszeile und Antwortadresse im Fuß. Nach der Auswahl wandert die gewählte Mail in `worker/konfigurator-checkout/src/mail.js` und die Signatur in einen Generator (`mail/signatur/`).
