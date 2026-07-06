#!/usr/bin/env python3
"""Generiert dist/plp-filterdata.json + dist/search-index.json (voller Katalog)."""
import json, re, datetime, sys, os, time, urllib.request, urllib.error
from collections import Counter

TOKEN = os.environ.get('WEBFLOW_TOKEN', '').strip()
if not TOKEN:
    print('FEHLER: ENV WEBFLOW_TOKEN nicht gesetzt', file=sys.stderr); sys.exit(2)

API = 'https://api.webflow.com/v2'
PRODUCTS_CID = '69a2f0ad6b29b5d497cdb6e0'
KAT_CID      = '69ba6227bbb6f39fea44efe2'
RAUM_CID     = '69f9a681c1db2b0f1a790344'
VF_CID       = '69c2491c68418dd75f0d7753'

OUT = sys.argv[1] if len(sys.argv) > 1 else 'dist/plp-filterdata.json'
SEARCH_OUT = os.path.join(os.path.dirname(OUT) or '.', 'search-index.json')

def api_get(path):
    url = API + path
    for attempt in range(4):
        req = urllib.request.Request(url, headers={'Authorization':'Bearer '+TOKEN,'accept':'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429,500,502,503) and attempt<3:
                time.sleep(2*(attempt+1)); continue
            raise
        except urllib.error.URLError:
            if attempt<3:
                time.sleep(2*(attempt+1)); continue
            raise
    raise RuntimeError('GET fehlgeschlagen: '+path)

def fetch_all_live(cid, loc=None):
    items, offset, limit = [], 0, 100
    locq = ('&cmsLocaleId='+loc) if loc else ''
    while True:
        d = api_get(f'/collections/{cid}/items/live?limit={limit}&offset={offset}{locq}')
        batch = d.get('items', [])
        items.extend(batch)
        pag = d.get('pagination', {})
        total = pag.get('total', len(items))
        offset += limit
        if offset >= total or not batch:
            break
    return items

def fetch_ref_full(cid):
    out, offset, limit = {}, 0, 100
    while True:
        d = api_get(f'/collections/{cid}/items?limit={limit}&offset={offset}')
        batch = d.get('items', [])
        for x in batch:
            fdx = x.get('fieldData', {})
            out[x['id']] = {'name':(fdx.get('name') or '').strip(),'slug':(fdx.get('slug') or '').strip()}
        pag = d.get('pagination', {})
        total = pag.get('total', len(out))
        offset += limit
        if offset >= total or not batch:
            break
    return out

print('Lade Referenzen ...', file=sys.stderr)
KAT_full  = fetch_ref_full(KAT_CID)
RAUM_full = fetch_ref_full(RAUM_CID)
VF_full   = fetch_ref_full(VF_CID)
KAT  = {k:v['name'] for k,v in KAT_full.items()}
RAUM = {k:v['name'] for k,v in RAUM_full.items()}
VF   = {k:v['name'] for k,v in VF_full.items()}
print(f'  Kategorien {len(KAT)} | Raeume {len(RAUM)} | Farben {len(VF)}', file=sys.stderr)

# Locale-Namen (PL/EN) fuer Kategorien + Raeume (Such-Index nL)
PL_LOC='6907a534407b21d560df11e4'; EN_LOC='693d37e00fa97e8096629a1d'
def fetch_ref_locale(cid, loc):
    out, offset, limit = {}, 0, 100
    while True:
        d = api_get(f'/collections/{cid}/items?limit={limit}&offset={offset}&cmsLocaleId={loc}')
        batch = d.get('items', [])
        for x in batch:
            fdx = x.get('fieldData', {})
            out[x['id']] = (fdx.get('name') or '').strip()
        if offset + limit >= d.get('pagination',{}).get('total', len(out)) or not batch: break
        offset += limit
    return out
KAT_PL  = fetch_ref_locale(KAT_CID, PL_LOC);  KAT_EN  = fetch_ref_locale(KAT_CID, EN_LOC)
RAUM_PL = fetch_ref_locale(RAUM_CID, PL_LOC); RAUM_EN = fetch_ref_locale(RAUM_CID, EN_LOC)
print(f'  Locale-Namen: KAT pl {len(KAT_PL)}/en {len(KAT_EN)} | RAUM pl {len(RAUM_PL)}/en {len(RAUM_EN)}', file=sys.stderr)

# --- EIGENFARBE pro Produkt (fuer den PLP-Farbfilter) ---
# Frueher = verfugbare-farben (Familien-Set) -> Filter "Schwarz" zeigte ganze Familien.
# Jetzt = die tatsaechliche Farbe des Einzelprodukts, geparst aus dem Titel
# (Segmente ab Pipe-Index 2; deckt Platten "...|Farbe|Dicke", Sperrholz "...|Dicke|Farbe"
#  und Schreibtisch-Kombis "Platte / Rahmen" ab). Normalisiert auf die Farben-Collection-Labels.
CANON_FARBEN = set(VF.values())
FARBE_TOKEN_MAP = {
    'Birke roh': 'Natur (Birke)', 'Natur': 'Natur (Birke)',
    'Kiefer': 'Kiefer Weiß', 'Gebleichte Kiefer': 'Kiefer Weiß',
    'Silber': 'Silbergrau',
}
def own_colors(title):
    out = []
    parts = [s.strip() for s in (title or '').split('|')]
    for seg in parts[2:]:
        for tok in seg.split('/'):
            tok = tok.strip()
            c = tok if tok in CANON_FARBEN else FARBE_TOKEN_MAP.get(tok)
            if c and c not in out:
                out.append(c)
    return out

print('Lade Produkte (live) ...', file=sys.stderr)
allit = fetch_all_live(PRODUCTS_CID)
print(f'  Produkte geladen: {len(allit)}', file=sys.stderr)

PL_LOC = '6907a534407b21d560df11e4'
EN_LOC = '693d37e00fa97e8096629a1d'
print('Lade Locales PL/EN ...', file=sys.stderr)
PLMAP = {x['id']: x.get('fieldData', {}) for x in fetch_all_live(PRODUCTS_CID, PL_LOC)}
ENMAP = {x['id']: x.get('fieldData', {}) for x in fetch_all_live(PRODUCTS_CID, EN_LOC)}
print(f'  PL {len(PLMAP)} | EN {len(ENMAP)}', file=sys.stderr)

def parse_num(s):
    if not s: return None
    m = re.search(r'\d[\d.\s\u00a0\u202f]*,\d{2}', s) or re.search(r'\d[\d.]*', s)
    if not m: return None
    t = m.group(0).replace('\u00a0','').replace('\u202f','').replace(' ','').replace('.','').replace(',','.')
    try: return round(float(t),2)
    except: return None

def fd(x): return x.get('fieldData', {})
ROOM_ORDER = ['Büro','Werkstatt','Praxis','Gastro']

def parse_price(s):
    if not s: return None, None
    raw = s
    isPLN = ('zł' in s) or ('z\u0142' in s)
    m = re.search(r'\d[\d.\s\u00a0\u202f]*,\d{2}', s)
    if not m: m = re.search(r'\d[\d.]*', s)
    if not m: return None, raw
    t = m.group(0).replace('\u00a0','').replace('\u202f','').replace(' ','').replace('.','').replace(',','.')
    try: v = float(t)
    except: return None, raw
    if isPLN:
        eur = v/4.25
        v = int(eur)+0.90
    return round(v,2), raw

products, skipped, search_products = [], [], []
for x in allit:
    f = fd(x)
    slug = f.get('slug')
    if not slug:
        skipped.append(('no-slug', x.get('id'))); continue
    if slug == 'test-tischplatte':
        skipped.append(('test-item', slug)); continue

    kat_id   = f.get('kategorie')
    kat      = KAT.get(kat_id) if kat_id else None
    kat_slug = KAT_full.get(kat_id, {}).get('slug') if kat_id else None
    raume_ids = f.get('raume') or []
    raume  = [RAUM.get(r) for r in raume_ids if RAUM.get(r)]
    raume  = [r for r in ROOM_ORDER if r in raume]
    raum_slugs = [RAUM_full[r]['slug'] for r in raume_ids if r in RAUM_full and RAUM_full[r].get('slug')]
    fam_farben = [VF.get(c) for c in (f.get('verfugbare-farben') or []) if VF.get(c)]
    farben = own_colors(f.get('product-title') or '')
    price, priceRaw = parse_price(f.get('product-price'))
    img = f.get('product-main-image') or {}
    imgurl = img.get('url') if isinstance(img, dict) else None

    fpl = PLMAP.get(x['id'], {}); fen = ENMAP.get(x['id'], {})
    t_de = f.get('product-title') or ''
    t_pl = fpl.get('product-title') or t_de
    t_en = fen.get('product-title') or t_de
    pr_de = f.get('product-price')
    pr_pl = fpl.get('product-price') or pr_de
    pr_en = fen.get('product-price') or pr_de

    products.append({
        'slug': slug,'pid': f.get('product-id'),'title': t_de,'img': imgurl,
        'price': price,'priceRaw': priceRaw,
        'titleByLoc': {'de':t_de,'pl':t_pl,'en':t_en},
        'priceRawByLoc': {'de':pr_de,'pl':pr_pl,'en':pr_en},
        'priceByLoc': {'de':parse_num(pr_de),'pl':parse_num(pr_pl),'en':parse_num(pr_en)},
        'bestseller': bool(f.get('header-bestseller')),'rating': f.get('bewertung'),
        'reviews': f.get('anzahl-bewertungen'),'kategorie': kat,'raume': raume,'farben': farben,'verfugbarFarben': fam_farben,
        'breite': f.get('breite'),'tiefe': f.get('tiefe'),'dicke': f.get('dicke'),
        'durchmesser': f.get('durchmesser-cm'),'material': f.get('material'),'form': f.get('form'),
    })

    search_products.append({
        'n': t_de,'s': slug,'p': pr_de,'c': kat,'cs': kat_slug,'sp': None,
        'nL': {'de':t_de,'pl':t_pl,'en':t_en},
        'pL': {'de':pr_de,'pl':pr_pl,'en':pr_en},
        'img': imgurl,'bs': 1 if f.get('header-bestseller') else 0,'rm': raum_slugs,'r': f.get('bewertung'),
    })

out = {'source':'Webflow Data API /items/live (Products Feeds %s)'%PRODUCTS_CID,'count':len(products),'products':products}
os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)
with open(OUT,'w') as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(',',':'))

catcount = Counter(p['cs'] for p in search_products if p.get('cs'))
search_cats = [{'n':v['name'],'s':v['slug'],'k':catcount.get(v['slug'],0),
                'nL':{'de':v['name'],'pl':KAT_PL.get(k) or v['name'],'en':KAT_EN.get(k) or v['name']}}
               for k,v in KAT_full.items() if v.get('slug')]
search_rooms = [{'n':v['name'],'s':v['slug'],'icon':None,
                 'nL':{'de':v['name'],'pl':RAUM_PL.get(k) or v['name'],'en':RAUM_EN.get(k) or v['name']}}
                for k,v in RAUM_full.items() if v.get('slug')]
search_out = {'v':1,'products':search_products,'cats':search_cats,'rooms':search_rooms}
with open(SEARCH_OUT,'w') as fh:
    json.dump(search_out, fh, ensure_ascii=False, separators=(',',':'))

print(f'Produkte im Map: {len(products)} | uebersprungen: {len(skipped)}', file=sys.stderr)
print(f'Geschrieben: {OUT} ({os.path.getsize(OUT)} bytes)', file=sys.stderr)
print(f'Geschrieben: {SEARCH_OUT} ({os.path.getsize(SEARCH_OUT)} bytes) | search {len(search_products)} | cats {len(search_cats)} | rooms {len(search_rooms)}', file=sys.stderr)
