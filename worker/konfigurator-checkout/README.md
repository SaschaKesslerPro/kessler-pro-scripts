# Checkout-Worker für den Tischplatten-Konfigurator

Macht aus einer Konfiguration eine bezahlbare Shopify-Bestellung. Der
Konfigurator schickt die Konfiguration hierher, der Worker rechnet den Preis
mit demselben Kern nach, legt eine **Draft Order** mit einer individuellen
Position an (Titel, Preis, alle Konfigurationsdaten als Attribute) und gibt
die Checkout-URL zurück. Der Kunde zahlt im normalen Shopify-Checkout, die
Bestellung landet wie jede andere im Shop — und damit in BaseLinker.

    Browser ──POST /checkout──▶ Worker ──draftOrderCreate──▶ Shopify
            ◀── { checkoutUrl } ──┘                          (Draft Order)
    Browser ──▶ checkoutUrl  (Shopify-Checkout, Zahlung, Bestellung)

Lagerartikel **ohne** Aufpreis gehen weiter direkt als Cart-Permalink. Alles
andere — Sondermaß, Bearbeitungen, L-Form, Nähtischplatte, Lagerartikel mit
Bohrung — läuft über den Worker. Ohne konfigurierten Endpunkt bleibt der
Konfigurator bei der Mail-Anfrage.

## Einmalig einrichten (ca. 15 Minuten)

### 1 · Shopify: Custom App mit Draft-Order-Recht

Shopify-Admin → **Einstellungen → Apps und Vertriebskanäle → Apps entwickeln →
App erstellen** („Konfigurator-Checkout"). Unter *Admin-API-Zugriffsbereiche*
genau diese beiden anhaken:

    write_draft_orders
    read_products

**Installieren**, dann den *Admin-API-Zugriffstoken* (`shpat_…`) einmalig
anzeigen lassen und kopieren — er wird nur ein einziges Mal gezeigt.

### 2 · Cloudflare: Worker anlegen

Kostenloses Konto auf cloudflare.com reicht (100 000 Aufrufe am Tag). Dann
auf einem Rechner mit Node:

    cd worker/konfigurator-checkout
    npx wrangler login                 # Browser-Anmeldung bei Cloudflare
    npx wrangler secret put SHOPIFY_ADMIN_TOKEN     # Token aus Schritt 1 einfügen
    npx wrangler deploy

Die Ausgabe nennt die URL, etwa
`https://kessler-konfigurator-checkout.<konto>.workers.dev`. Wer eine eigene
Adresse möchte (`konfigurator.kessler-pro.com`), trägt sie in `wrangler.toml`
unter `routes` ein — das braucht die Domain bei Cloudflare.

Prüfen: `https://…workers.dev/health` muss `{"ok":true}` liefern.

### 3 · Webflow: Endpunkt an den Konfigurator hängen

Auf der Seite *Tischplatte nach Maß* trägt das Element mit `data-kfg-root` ein
weiteres Attribut:

    data-kfg-checkout = https://…workers.dev/checkout

Publizieren. Ab dann steht auf der Taste **„Jetzt bezahlen"** statt
„Unverbindlich anfragen", und der Klick führt in den Checkout. Zum Testen
zuerst nur auf die Webflow-Subdomain publizieren und eine Testbestellung mit
dem Shopify-Testzahlungsanbieter (Bogus Gateway) durchspielen.

## Was der Worker prüft

- Material, Form, Maße im zulässigen Bereich; höchstens 20 Bearbeitungen
- Preis serverseitig nachgerechnet; weicht der Browserpreis ab → **409**, der
  Konfigurator fällt auf die Mail-Anfrage zurück
- Eigene Skizze (`extras.custom`) → **400**, bleibt Anfrage
- Origin muss in `ALLOWED_ORIGINS` stehen (CORS)

Matrix und Kurven lädt der Worker aus **demselben Commit** wie das Skript im
Browser (`base` im Aufruf, nur `cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@<hash>`
wird akzeptiert). Der Preis-Kern (`src/preis-kern.js`) wird aus
`dist/konfigurator.js` erzeugt — nach jeder Preisänderung im Konfigurator:

    python3 tools/kern_extrahieren.py
    node tools/kern_parity_test.js <spiegel-url> 300     # Browser gegen Kern
    cd worker/konfigurator-checkout && npm test          # Worker-Logik
    npx wrangler deploy

## Was in Shopify ankommt

Eine Draft Order mit Tag `konfigurator`, Präsentationswährung EUR (DE/EN) oder
PLN (PL), einer Position „Tischplatte nach Maß · Möbelplatte · Buche · 25 mm ·
L-Form 200 × 90 cm" zum exakten Konfiguratorpreis, Versandgewicht aus Fläche
und Stärke, und als Attribute: Material, Dekor, Stärke, Form & Maß (mit Lage
und Winkel der Ausklinkung), Kante, Ecken, Maßband, Nähmaschine, jede
Bearbeitung mit Lage und Randabständen, dazu `_kfg_preis` (Aufteilung),
`_kfg_konfig` (Rohdaten) und in der Bestellung `_kfg_config_url` — der Link,
der den Konfigurator exakt in diesem Zustand öffnet.

## Offen

- Versandregeln für Maßanfertigungen in Shopify prüfen (Gewicht kommt mit)
- Lieferzeit-Text im Konfigurator („Fertigung nach Maß") mit echter Zeit füllen
- Technische Zeichnung: Webhook `orders/paid` → Zeichnung aus `_kfg_konfig`
  erzeugen, an Kunde und BaseLinker (VORSCHLAG-Technische-Zeichnung vom 26.08.)
