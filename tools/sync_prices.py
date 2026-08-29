#!/usr/bin/env python3
"""sync_prices.py — Preise aus SHOPIFY in die Webflow-CMS-Felder schreiben.

Datenfluss (Stand 29.08.2026):
    Shopify (Quelle der Wahrheit)
      -> Storefront-API @inContext(country: DE)  = EUR   (Markt Europaeische Union)
      -> Storefront-API @inContext(country: PL)  = PLN   (Markt Polen, Basiswaehrung)
      -> Webflow-CMS je Locale: product-price, schema-preis, preis-pln

Gesetzte Felder je Locale:
    DE / EN : product-price = "119,90 EUR-Zeichen"   schema-preis = "119.90"
    PL      : product-price = "816,90 zl"            schema-preis = "816.90"
    alle    : preis-pln     = "816,90 zl"   (Roh-zl, nicht fuer die Anzeige)

WICHTIG — was hier NICHT mehr passiert:
    Die fruehere Ableitung EUR = zl / 4,25 ist am 29.08.2026 ersatzlos entfernt
    worden. DE- und PL-Preise sind seit der Marktpreis-Runde eigenstaendig
    festgelegt und stehen in keinem festen Wechselkursverhaeltnis mehr
    zueinander (Beispiel Compact 110x60: 119,90 EUR und 816,90 zl). Jede
    Wiedereinfuehrung einer Umrechnung wuerde die entschiedenen Preise
    zerstoeren.

Artikel ohne Shopify-Treffer (Slug == Shopify-Handle) werden uebersprungen;
deren product-price bleibt CMS-verwaltet.

ENV: WEBFLOW_TOKEN (Pflicht), SHOPIFY_STOREFRONT_TOKEN (optional, Default unten).
Nur stdlib. Aufruf: python3 sync_prices.py [--dry-run]
"""
import os, sys, json, time, urllib.request, urllib.error

TOKEN = os.environ.get("WEBFLOW_TOKEN", "").strip()
if not TOKEN:
    print("FEHLER: WEBFLOW_TOKEN fehlt", file=sys.stderr); sys.exit(2)

DRY = "--dry-run" in sys.argv
CID = "69a2f0ad6b29b5d497cdb6e0"
SKIP_SLUGS = {"test-tischplatte"}
LOC = {"DE": "67fea16e9758f16a33bef7a8",
       "PL": "6907a534407b21d560df11e4",
       "EN": "693d37e00fa97e8096629a1d"}
PRIMARY = LOC["DE"]

SHOP = "hyf2zr-7x.myshopify.com"
SF_VERSION = "2024-10"
# Storefront-Token ist per Definition oeffentlich (laeuft im Browser des Kunden).
SF_TOKEN = os.environ.get("SHOPIFY_STOREFRONT_TOKEN", "412ec64ed0b4546aa69f2ed2ee574441").strip()

EURO = "\u20ac"
ZLOTY = "z\u0142"
FIELDS = ("product-price", "schema-preis", "preis-pln")


# ---------------------------------------------------------------- Webflow ---
def api(m, u, b=None, tries=8):
    for t in range(tries):
        data = json.dumps(b).encode() if b else None
        r = urllib.request.Request(u, data=data, method=m, headers={
            "Authorization": "Bearer " + TOKEN,
            "accept": "application/json",
            "content-type": "application/json"})
        try:
            return json.load(urllib.request.urlopen(r, timeout=60)), None
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 * (t + 1)); continue
            return None, str(e.code)
        except urllib.error.URLError:
            time.sleep(2 * (t + 1)); continue
    return None, "err"


def fetch_staged_primary():
    """Slug + Item-ID aus der Primaerlocale (staged)."""
    out = {}; off = 0
    while True:
        d, err = api("GET", "https://api.webflow.com/v2/collections/%s/items"
                            "?cmsLocaleId=%s&limit=100&offset=%d" % (CID, PRIMARY, off))
        if d is None:
            raise RuntimeError("Webflow GET (staged) fehlgeschlagen: %s" % err)
        for it in d["items"]:
            slug = it["fieldData"].get("slug")
            if not slug or slug in SKIP_SLUGS:
                continue
            out[it["id"]] = slug
        off += 100
        if off >= d["pagination"]["total"]:
            break
    return out


def fetch_live(loc):
    """Ist-Werte der drei Preisfelder je Item in einer Locale."""
    out = {}; off = 0
    while True:
        d, err = api("GET", "https://api.webflow.com/v2/collections/%s/items/live"
                            "?cmsLocaleId=%s&limit=100&offset=%d" % (CID, loc, off))
        if d is None:
            raise RuntimeError("Webflow GET (live) fehlgeschlagen: %s" % err)
        for it in d["items"]:
            fd = it["fieldData"]
            out[it["id"]] = {k: fd.get(k) for k in FIELDS}
        off += 100
        if off >= d["pagination"]["total"]:
            break
    return out


# ---------------------------------------------------------------- Shopify ---
def shopify_prices(country):
    """handle -> Preis (float) im Markt des angegebenen Landes."""
    out = {}; cursor = None
    q = ("query($n:Int!,$a:String) @inContext(country: %s) {"
         "  products(first:$n, after:$a) {"
         "    pageInfo { hasNextPage endCursor }"
         "    edges { node { handle variants(first:1) { edges { node {"
         "      price { amount currencyCode } } } } } } } }" % country)
    while True:
        body = json.dumps({"query": q, "variables": {"n": 250, "a": cursor}}).encode()
        d = None
        for t in range(6):
            r = urllib.request.Request(
                "https://%s/api/%s/graphql.json" % (SHOP, SF_VERSION), data=body,
                headers={"X-Shopify-Storefront-Access-Token": SF_TOKEN,
                         "Content-Type": "application/json"})
            try:
                d = json.load(urllib.request.urlopen(r, timeout=60)); break
            except (urllib.error.HTTPError, urllib.error.URLError):
                time.sleep(2 * (t + 1))
        if d is None:
            raise RuntimeError("Shopify Storefront (%s) nicht erreichbar" % country)
        if "errors" in d:
            raise RuntimeError("Shopify Storefront (%s): %s" % (country, d["errors"]))
        conn = d["data"]["products"]
        for e in conn["edges"]:
            n = e["node"]
            v = n["variants"]["edges"]
            if not v:
                continue
            out[n["handle"]] = float(v[0]["node"]["price"]["amount"])
        if not conn["pageInfo"]["hasNextPage"]:
            break
        cursor = conn["pageInfo"]["endCursor"]
    return out


# ------------------------------------------------------------ Formatierung ---
def fmt(v, cur):
    s = "{:.2f}".format(v).replace(".", ",")
    return s + (" " + EURO if cur == "EUR" else " " + ZLOTY)


def schema(v):
    return "{:.2f}".format(v)


# ------------------------------------------------------------------- Lauf ---
def main():
    eur = shopify_prices("DE")
    pln = shopify_prices("PL")
    print("Shopify: %d Handles mit EUR, %d mit PLN" % (len(eur), len(pln)))

    items = fetch_staged_primary()
    cur = {n: fetch_live(l) for n, l in LOC.items()}

    plan = {"DE": [], "PL": [], "EN": []}
    skipped = []
    for iid, slug in items.items():
        e, p = eur.get(slug), pln.get(slug)
        if e is None or p is None:
            skipped.append(slug); continue
        raw_pln = fmt(p, "PLN")
        want = {
            "DE": {"product-price": fmt(e, "EUR"), "schema-preis": schema(e), "preis-pln": raw_pln},
            "EN": {"product-price": fmt(e, "EUR"), "schema-preis": schema(e), "preis-pln": raw_pln},
            "PL": {"product-price": raw_pln,       "schema-preis": schema(p), "preis-pln": raw_pln},
        }
        for loc in ("DE", "PL", "EN"):
            have = cur[loc].get(iid) or {}
            if any((have.get(k) or "") != want[loc][k] for k in FIELDS):
                plan[loc].append((iid, want[loc]))

    total = sum(len(v) for v in plan.values())
    print("Webflow-Items: %d | mit Shopify-Treffer: %d | uebersprungen: %d"
          % (len(items), len(items) - len(skipped), len(skipped)))
    if skipped:
        print("  ohne Shopify-Treffer (bleiben CMS-verwaltet): %s%s"
              % (", ".join(sorted(skipped)[:8]), " ..." if len(skipped) > 8 else ""))
    print("Aenderungen: DE %d, PL %d, EN %d (gesamt %d)"
          % (len(plan["DE"]), len(plan["PL"]), len(plan["EN"]), total))

    if DRY:
        for loc in ("DE", "PL", "EN"):
            for iid, val in plan[loc][:3]:
                print("  [DRY] %s %s -> %s" % (loc, iid, val))
        return

    fehler = 0
    for loc in ("DE", "PL", "EN"):
        for iid, val in plan[loc]:
            _, e = api("PATCH", "https://api.webflow.com/v2/collections/%s/items/%s/live"
                                % (CID, iid), {"cmsLocaleId": LOC[loc], "fieldData": val})
            if e:
                fehler += 1
                print("  Fehler %s %s: %s" % (loc, iid, e))
            time.sleep(1.05)  # Webflow Data API: 60 Anfragen/Minute
    print("Fertig: %d Locale-Eintraege geschrieben, %d Fehler." % (total - fehler, fehler))
    if fehler:
        sys.exit(1)


if __name__ == "__main__":
    main()
