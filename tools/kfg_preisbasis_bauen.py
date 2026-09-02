# -*- coding: utf-8 -*-
"""Baut aus dem neuen Preiswerk die zwei Datendateien fuer den Konfigurator.
   1) kfg-produktmatrix.json  — Lagerartikel, Preis exakt wie im Preiswerk
   2) kfg-preiskurven.json    — Sondermass-Kurven je Material/Staerke/Form/Dekorstufe
"""
import json, collections, math, statistics as st, re

NEU  = json.load(open('/tmp/k29/produkte.json'))
ALT  = json.load(open('/tmp/matrix.json'))

# ---- Schluessel-Uebersetzung aus dem EAN-Join ableiten ---------------------
per_ean = {v['sku']: k for k, v in ALT['produkte'].items() if v.get('sku')}
mat_map, dek_map, form_map = {}, {}, {}
for p in NEU:
    k = per_ean.get(p['ean'])
    if not k: continue
    mat, form, dek, *_ = k.split('|')
    mat_map.setdefault(p['material'], collections.Counter())[mat] += 1
    form_map.setdefault(p['form'],    collections.Counter())[form] += 1
    dek_map.setdefault(p['dekor'],    collections.Counter())[dek] += 1
MAT  = {a: b.most_common(1)[0][0] for a, b in mat_map.items()}
FORM = {a: b.most_common(1)[0][0] for a, b in form_map.items()}
DEK  = {a: b.most_common(1)[0][0] for a, b in dek_map.items()}
print('Material:', MAT); print('Form:', FORM); print('Dekor:', DEK)

def fm1(v): return str(int(v)) if float(v) == int(v) else str(v).replace('.', ',')
def schluessel(p):
    m, f, d, t = MAT[p['material']], FORM[p['form']], DEK[p['dekor']], p['mm']
    mass = f"D{fm1(p['D'])}" if p['form'] == 'rund' else f"{fm1(p['L'])}x{fm1(p['B'])}"
    return f'{m}|{f}|{d}|{t}|{mass}'

# ---- 1) Produktmatrix ------------------------------------------------------
produkte, neu_ohne_shopify = {}, []
for p in NEU:
    k = schluessel(p)
    alt = ALT['produkte'].get(per_ean.get(p['ean'], ''), {})
    e = {'sku': p['ean'],
         'eur': p['web_de'], 'pln': p['web_pl'],
         'eur_amazon': p['amz_de'], 'pln_amazon': p['amz_pl'], 'pln_allegro': p['alg_pl'],
         'einsatz_eur': p['einsatz'],
         'stock': alt.get('stock', 9999), 'available': alt.get('available', True)}
    for f in ('variantId', 'productId', 'handle', 'title'):
        if alt.get(f): e[f] = alt[f]
    if 'variantId' not in e:
        if k in produkte and 'variantId' in produkte[k]: continue   # Doppel-EAN: die Shopify-Variante behalten
        neu_ohne_shopify.append((p['ean'], k))
    produkte[k] = e

matrix = {'_meta': {
    'quelle': 'KesslerPROPreisealleKanaele29082026.xlsx (Stand 29.08.2026), Shopify-IDs uebernommen aus der Matrix vom 30.07.2026',
    'hinweis': 'Lagergroessen sind verbindlich. kfg-preiskurven.json gilt nur fuer Sondermasse.',
    'schluessel': '{material}|{form}|{dekor}|{staerke_mm}|{LxB oder D<Durchmesser>}',
    'anzahl': len(produkte),
    'ohne_shopify_variante': [k for k, e in produkte.items() if 'variantId' not in e],
    'doppelte_ean': ['5908453742155 = 5908453742209 (Moebelplatte rund D100 Grau 25 mm)']},
    'produkte': produkte}
json.dump(matrix, open('/tmp/k29/kfg-produktmatrix.json', 'w'), ensure_ascii=False, indent=1)
print(f'Matrix: {len(produkte)} Artikel, ohne Shopify-Variante: {neu_ohne_shopify}')

# ---- 2) Preiskurven --------------------------------------------------------
STUFEN = {'dekor|18|rect': {'ahorn':'premium','buk':'premium','hikora':'premium','sonoma-eiche':'premium',
                            'szary':'basis','sosna-bielona':'basis','schwarz':'basis'}}
AUSREISSER = {'dekor|18|rect|basis':  ['60x60'],
              'dekor|25|rect|standard': ['70x70','80x70','80x80'],
              'mpx|21|rect|standard': ['60x60']}
KANAL = {'eur':'web_de','pln':'web_pl','eur_amazon':'amz_de','pln_amazon':'amz_pl','pln_allegro':'alg_pl'}

def stufe(m, mm, f, d): return STUFEN.get(f'{m}|{mm}|{f}', {}).get(d, 'standard')
def flaeche(p): return math.pi*(p['D']/200.0)**2 if p['form']=='rund' else p['L']*p['B']/1e4

def isoton(ys, ws):
    bl=[[y,w,1] for y,w in zip(ys,ws)]; i=0
    while i < len(bl)-1:
        if bl[i][0] <= bl[i+1][0]+1e-12: i+=1; continue
        w=bl[i][1]+bl[i+1][1]
        bl[i]=[(bl[i][0]*bl[i][1]+bl[i+1][0]*bl[i+1][1])/w, w, bl[i][2]+bl[i+1][2]]; del bl[i+1]
        if i: i-=1
    out=[]
    for v,w,n in bl: out += [v]*n
    return out

gruppen = collections.defaultdict(list)
for p in NEU:
    m,f,d = MAT[p['material']], FORM[p['form']], DEK[p['dekor']]
    gruppen[f'{m}|{p["mm"]}|{f}|{stufe(m,p["mm"],f,d)}'].append(p)

kurven = {}
for gk, rows in sorted(gruppen.items()):
    aus = set(AUSREISSER.get(gk, []))
    eintrag = {'form': gk.split('|')[2], 'dekore': sorted({DEK[p['dekor']] for p in rows}), 'kanaele': {}}
    for kanal, feld in KANAL.items():
        pro = collections.defaultdict(list)
        for p in rows:
            if p['form']=='rechteck' and f'{fm1(p["L"])}x{fm1(p["B"])}' in aus: continue
            pro[round(flaeche(p), 6)].append(p[feld])
        xs = sorted(pro)
        ys = isoton([st.median(pro[a]) for a in xs], [len(pro[a]) for a in xs])
        n = max(2, len(xs)*2//3); sx, sy = xs[-n:], ys[-n:]
        mx, my = sum(sx)/n, sum(sy)/n
        nen = sum((x-mx)**2 for x in sx)
        b = sum((x-mx)*(y-my) for x,y in zip(sx,sy))/nen if nen else 0
        eintrag['kanaele'][kanal] = {
            'punkte': [[round(x,5), round(y,2)] for x,y in zip(xs,ys)],
            'randsteigung': round(b,2),
            'mindestpreis': round(ys[0]*0.60,2)}
    kurven[gk] = eintrag

json.dump({'_meta': {
    'quelle': 'abgeleitet aus kfg-produktmatrix.json (Preiswerk 29.08.2026)',
    'regel': 'Grundpreis = Katalogtreffer, sonst Kurve: linear zwischen den Stuetzpunkten in m2, '
             'ausserhalb mit randsteigung fortgesetzt, nach unten begrenzt durch mindestpreis, dann auf ,90 aufgerundet.',
    'stufen': STUFEN, 'ausreisser_nicht_in_der_kurve': AUSREISSER},
    'kurven': kurven}, open('/tmp/k29/kfg-preiskurven.json','w'), ensure_ascii=False, indent=1)
print(f'Kurven: {len(kurven)} Gruppen')
