import os, json, re, sys, time, urllib.request
from urllib.error import HTTPError

SHOP  = os.environ["SHOP_DOMAIN"].strip()
TOKEN = os.environ["SHOPIFY_TOKEN"].strip()
MODE  = os.environ.get("MODE", "dry-run")
API   = "2026-04"
URL   = f"https://{SHOP}/admin/api/{API}/graphql.json"

print("Shop-Domain:", SHOP)
print("API-Version:", API)
print("Token-Laenge:", len(TOKEN))
known = ["shpat_", "shpss_", "shpca_", "atkn_", "shppa_", "shpua_"]
prefix = next((p for p in known if TOKEN.startswith(p)), None)
print("Token-Prefix:", prefix if prefix else "(unbekannt) erste 4 Zeichen: " + TOKEN[:4])

AUTH_SCHEME = None

def _request(scheme, query, variables):
    headers = {"Content-Type": "application/json"}
    if scheme == "x-token":
        headers["X-Shopify-Access-Token"] = TOKEN
    else:
        headers["Authorization"] = "Bearer " + TOKEN
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(URL, data=body, headers=headers)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def gql(query, variables=None):
    global AUTH_SCHEME
    schemes = [AUTH_SCHEME] if AUTH_SCHEME else ["x-token", "bearer"]
    last = None
    for sch in schemes:
        try:
            out = _request(sch, query, variables)
            if out.get("errors"):
                print("GraphQL-Fehler:", json.dumps(out["errors"], ensure_ascii=False)[:600]); sys.exit(1)
            AUTH_SCHEME = sch
            return out["data"]
        except HTTPError as e:
            last = e.read().decode(errors="replace")
            if e.code == 401:
                continue
            print("HTTP-Fehler", e.code, last[:400]); sys.exit(1)
    print("\nAUTH fehlgeschlagen: 401 mit BEIDEN Methoden (X-Shopify-Access-Token und Bearer).")
    print("Letzte Antwort:", (last or "")[:400])
    print("=> Token wird nicht akzeptiert. Haeufigste Ursachen:")
    print("   1) Es ist NICHT der Automatisierungs-Token (Prefix oben: 'shpss_' = falsch, das ist der Client-Secret).")
    print("   2) Die App ist nicht auf dem Shop installiert.")
    sys.exit(1)

s = gql("{ shop { name myshopifyDomain currencyCode } }")["shop"]
print(f"\nVerbunden: {s['name']} ({s['myshopifyDomain']}), Waehrung: {s['currencyCode']}, Auth-Methode: {AUTH_SCHEME}")

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
print(f"\n== 'Helles Holz' (EAN-Dubletten): {len(helles)} ==")
for p in helles:
    b = v0(p).get("barcode"); dups=[t for t in bc.get(b,[]) if t!=p["title"]]
    print(f"  - {p['title']}  EAN={b}  Dublette_zu={dups}")
print("\n== Stichprobe (3): kessler-Metafelder + EUR(÷4,25) ==")
for p in prods[:3]:
    k=kf(p); pr=v0(p).get("price")
    try: eur=round(float(pr)/4.25,2)
    except (TypeError,ValueError): eur="?"
    print(f"\n  {p['title']}\n   Preis={pr} -> EUR={eur}\n   kessler: {json.dumps(k, ensure_ascii=False)}")
print("\nDRY-RUN fertig — nichts veraendert.")
