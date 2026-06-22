import os, json, re, sys, time, urllib.request
from urllib.error import HTTPError

SHOP  = os.environ["SHOP_DOMAIN"]
TOKEN = os.environ["SHOPIFY_TOKEN"]
MODE  = os.environ.get("MODE", "dry-run")
API   = "2026-04"
URL   = f"https://{SHOP}/admin/api/{API}/graphql.json"

def gql(query, variables=None):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": TOKEN,
    })
    try:
        with urllib.request.urlopen(req) as r:
            out = json.loads(r.read())
    except HTTPError as e:
        print("HTTP-Fehler", e.code, e.read().decode(errors="replace")[:600]); sys.exit(1)
    if "errors" in out:
        print("GraphQL-Fehler:", json.dumps(out["errors"], ensure_ascii=False)); sys.exit(1)
    return out["data"]

# 1) Verbindungs-/Auth-Test
s = gql("{ shop { name myshopifyDomain currencyCode } }")["shop"]
print(f"Verbunden: {s['name']} ({s['myshopifyDomain']}), Basiswaehrung: {s['currencyCode']}")

# 2) Alle Produkte (klein paginiert wegen Query-Kosten)
Q = """
query($cursor: String) {
  products(first: 20, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title handle productType
      metafields(first: 25) { nodes { namespace key value } }
      variants(first: 3) { nodes { sku barcode price } }
    }
  }
}"""
prods, cursor = [], None
while True:
    d = gql(Q, {"cursor": cursor})["products"]
    prods += d["nodes"]
    if not d["pageInfo"]["hasNextPage"]: break
    cursor = d["pageInfo"]["endCursor"]; time.sleep(0.6)
print(f"\nProdukte gesamt: {len(prods)}")

def kf(p): return {m["key"]: m["value"] for m in p["metafields"]["nodes"] if m["namespace"]=="kessler"}
def v0(p):
    vs = p["variants"]["nodes"]; return vs[0] if vs else {}

arb    = [p for p in prods if re.search(r"\bArbeitsplatte\b", p["title"])]
silber = [p for p in prods if re.search(r"\bSilber\b", p["title"])]
desks  = [p for p in prods if "schreibtisch" in p["title"].lower()]
helles = [p for p in prods if "helles holz" in p["title"].lower()]

print(f"\n== 'Arbeitsplatte' -> 'Tischplatte': {len(arb)} ==")
for p in arb: print("  -", p["title"], "=>", re.sub(r"\bArbeitsplatte\b","Tischplatte",p["title"]))

print(f"\n== ganzes Wort 'Silber' -> 'Silbergrau': {len(silber)} ==")
for p in silber: print("  -", p["title"], "=>", re.sub(r"\bSilber\b","Silbergrau",p["title"]))

print(f"\n== Schreibtische (Masse aus Metafeldern): {len(desks)} ==")
for p in desks:
    k = kf(p); print(f"  - {p['title']} | breite={k.get('breite_cm','?')} tiefe={k.get('tiefe_cm','?')} dicke={k.get('dicke_mm','?')}")

bc = {}
for p in prods:
    b = v0(p).get("barcode")
    if b: bc.setdefault(b, []).append(p["title"])
print(f"\n== 'Helles Holz'-Produkte (EAN-Dubletten): {len(helles)} ==")
for p in helles:
    b = v0(p).get("barcode"); dups=[t for t in bc.get(b,[]) if t!=p["title"]]
    print(f"  - {p['title']}  EAN={b}  Dublette_zu={dups}")

print("\n== Stichprobe (3 Produkte): kessler-Metafelder + EUR(÷4,25) ==")
for p in prods[:3]:
    k=kf(p); pr=v0(p).get("price")
    try: eur=round(float(pr)/4.25,2)
    except (TypeError,ValueError): eur="?"
    print(f"\n  {p['title']}\n   Preis={pr} -> EUR={eur}\n   kessler: {json.dumps(k, ensure_ascii=False)}")

if MODE == "apply":
    print("\nAPPLY ist noch nicht aktiv — erst Dry-Run pruefen. Es wurde nichts geschrieben.")
print("\nDRY-RUN fertig — es wurde nichts veraendert.")
