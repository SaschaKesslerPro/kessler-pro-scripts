#!/usr/bin/env python3
"""Generiert dist/plp-filterdata.json: voller Katalog, Referenzen aufgeloest.
Keyed by slug (Join-Key = WL-Button data-handle). Render- + Filterdaten.

STANDALONE: holt alle Daten selbst ueber die Webflow Data API.
  Token aus ENV  WEBFLOW_TOKEN  (Pflicht).
  Nur stdlib (urllib) -> kein pip noetig (GitHub Action).
  Ausgabe-Pfad: argv[1] oder 'dist/plp-filterdata.json'.
"""
import json, re, datetime, sys, os, time, urllib.request, urllib.error

TOKEN = os.environ.get('WEBFLOW_TOKEN', '').strip()
if not TOKEN:
    print('FEHLER: ENV WEBFLOW_TOKEN nicht gesetzt', file=sys.stderr); sys.exit(2)

API = 'https://api.webflow.com/v2'
PRODUCTS_CID = '69a2f0ad6b29b5d497cdb6e0'   # Products Feeds
KAT_CID      = '69ba6227bbb6f39fea44efe2'   # Produktkategorien
RAUM_CID     = '69f9a681c1db2b0f1a790344'   # Raeume
VF_CID       = '69c2491c68418dd75f0d7753'   # verfuegbare-farben

OUT = sys.argv[1] if len(sys.argv) > 1 else 'dist/plp-filterdata.json'

def api_get(path):
    url = API + path
    for attempt in range(4):
        req = urllib.request.Request(url, headers={
            'Authorization': 'Bearer ' + TOKEN,
            'accept': 'application/json',
        })
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(2 * (attempt + 1)); continue
            raise
        except urllib.error.URLError:
            if attempt < 3:
                time.sleep(2 * (attempt + 1)); continue
            raise
    raise RuntimeError('GET fehlgeschlagen: ' + path)

def fetch_all_live(cid):
    """Alle veroeffentlichten Items paginiert holen."""
    items, offset, limit = [], 0, 100
    while True:
        d = api_get(f'/collections/{cid}/items/live?limit={limit}&offset={offset}')
        batch = d.get('items', [])
        items.extend(batch)
        pag = d.get('pagination', {})
        total = pag.get('total', len(items))
        offset += limit
        if offset >= total or not batch:
            break
    return items

def fetch_ref(cid):
    d = api_get(f'/collections/{cid}/items?limit=100')
    out = {}
    for x in d.get('items', []):
        fdx = x.get('fieldData', {})
        out[x['id']] = (fdx.get('name') or '').strip()
    return out

print('Lade Referenzen ...', file=sys.stderr)
KAT  = fetch_ref(KAT_CID)
RAUM = fetch_ref(RAUM_CID)
VF   = fetch_ref(VF_CID)
print(f'  Kategorien {len(KAT)} | Raeume {len(RAUM)} | Farben {len(VF)}', file=sys.stderr)

print('Lade Produkte (live) ...', file=sys.stderr)
allit = fetch_all_live(PRODUCTS_CID)
print(f'  Produkte geladen: {len(allit)}', file=sys.stderr)

def fd(x): return x.get('fieldData', {})
ROOM_ORDER = ['Büro', 'Werkstatt', 'Praxis', 'Gastro']

def parse_price(s):
    if not s: return None, None
    raw = s
    isPLN = ('zł' in s) or ('z\u0142' in s)
    m = re.search(r'\d[\d.\s\u00a0\u202f]*,\d{2}', s)
    if not m:
        m = re.search(r'\d[\d.]*', s)
    if not m: return None, raw
    t = m.group(0).replace('\u00a0', '').replace('\u202f', '').replace(' ', '').replace('.', '').replace(',', '.')
    try: v = float(t)
    except: return None, raw
    if isPLN:
        eur = v / 4.25            # PLN->EUR: dokumentierte Architektur /4.25, auf ,90 normiert
        v = int(eur) + 0.90
    return round(v, 2), raw

products, skipped = [], []
for x in allit:
    f = fd(x)
    slug = f.get('slug')
    if not slug:
        skipped.append(('no-slug', x.get('id'))); continue
    if slug == 'test-tischplatte':
        skipped.append(('test-item', slug)); continue

    kat    = KAT.get(f.get('kategorie')) if f.get('kategorie') else None
    raume  = [RAUM.get(r) for r in (f.get('raume') or []) if RAUM.get(r)]
    raume  = [r for r in ROOM_ORDER if r in raume]
    farben = [VF.get(c) for c in (f.get('verfugbare-farben') or []) if VF.get(c)]
    price, priceRaw = parse_price(f.get('product-price'))
    img = f.get('product-main-image') or {}
    imgurl = img.get('url') if isinstance(img, dict) else None

    products.append({
        'slug': slug,
        'pid': f.get('product-id'),
        'title': f.get('product-title') or '',
        'img': imgurl,
        'price': price,
        'priceRaw': priceRaw,
        'bestseller': bool(f.get('header-bestseller')),
        'rating': f.get('bewertung'),
        'reviews': f.get('anzahl-bewertungen'),
        'kategorie': kat,
        'raume': raume,
        'farben': farben,
        'breite': f.get('breite'),
        'tiefe': f.get('tiefe'),
        'dicke': f.get('dicke'),
        'durchmesser': f.get('durchmesser-cm'),
        'material': f.get('material'),
        'form': f.get('form'),
    })

# Kein 'generated'-Zeitstempel im File: sonst aendert sich die JSON bei JEDEM Lauf
# und die Action committet stuendlich ohne echte Katalog-Aenderung.
out = {
    'source': 'Webflow Data API /items/live (Products Feeds %s)' % PRODUCTS_CID,
    'count': len(products),
    'products': products,
}
os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)
with open(OUT, 'w') as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))

print(f'Produkte im Map: {len(products)} | uebersprungen: {skipped}', file=sys.stderr)
print(f'Geschrieben: {OUT} ({os.path.getsize(OUT)} bytes)', file=sys.stderr)
from collections import Counter
print('Kategorie-Counts:', dict(Counter(p['kategorie'] for p in products)), file=sys.stderr)
