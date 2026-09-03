#!/usr/bin/env python3
"""kern_extrahieren.py — zieht den Preis-Kern aus dist/konfigurator.js und
schreibt ihn als reines Modul fuer den Checkout-Worker.

Der Konfigurator bleibt die einzige Quelle der Preislogik. Die hier genannten
Funktionen und Konstanten werden wortgleich uebernommen und in eine Fabrik
gepackt, die S, SHOP, KURVEN und KFG_LANG als Parameter bekommt — dieselben
Namen, die der Code als freie Variablen benutzt. tools/kern_parity_test.js
prueft, dass Kern und Konfigurator dieselben Preise liefern.

Aufruf: python3 tools/kern_extrahieren.py
"""
import re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = (ROOT/'dist/konfigurator.js').read_text(encoding='utf-8')
ZIEL = ROOT/'worker/konfigurator-checkout/src/preis-kern.js'

NAMEN = [
  # Daten / Regeln
  'DEKOR_MOEBEL','DEKOR_HPL','DEKOR_SZWAL','MATERIALS','RULES','DEKOR_ALIAS',
  'EDGE_MPX','LACK_LFM','EDGEPROFILES','EDGE_ALIAS','MASSBAND',
  'RADIEN_STAFFEL','FREI_PRICE','KANAL_PRICE','PRESETS','X_PRICE',
  'DEKOR_STUFE_ERSATZ','STAERKE_FAKTOR','HPL_ZUSCHLAG','CORNER_NAMES','LF_POS','MASCHINE_MASSE',
  # Preis-Kern
  'kanal','auf90','kurvenDekor','kurvenSchluessel','kurvenFlaeche','aufDerKurve','deckel','kurvenPreis',
  'hitPreis','fm1','shopKey','shopHit','freierAusschnitt','radienpreis',
  'rules','baseEdge','profileOf','lackAn','isLack','edgeLfm',
  'dims','areaM2','perimM','dekorList','ensureDekor','calc','isStandard','needsOffer',
  'cornerFormOk','cornerPerCorner','cornerR','cornerIdx','cornerCount','cornerMax','cornerName','cornerLabel',
  'clampCorner','setCorner','setAllCorners',
  'lfPos','lfSchraeg','lfMinR','lfSb','lfPts','lfGeo','lfSchnittCm','lfCornerName','lfCornerR','lfNotchCenter','lfInNotch',
  'massbandEintrag','massbandPreis','massbandName','massbandStrecke',
  'cutLen','cutPrice','cutBox','cutMass','cutTypName','presetCount','kanalLfmPreis','kanalPunkte','polyAbs',
  'maschineMass','maxTiefe','cutMinEdge','cutAbstaende','konturAbstand',
  'cornerSum',
]

lines = SRC.split('\n')
def finde(name):
    for i,l in enumerate(lines):
        if re.match(rf'^function {re.escape(name)}\s*\(', l):
            # bis zur ersten Zeile, die genau '}' ist — oder einzeilige Funktion
            if l.rstrip().endswith('}') and l.count('{')==l.count('}'): return [l]
            j=i+1
            while j<len(lines) and lines[j]!='}': j+=1
            return lines[i:j+1]
        if re.match(rf'^(const|let|var) {re.escape(name)}\b', l):
            buf=[l]; j=i
            def fertig(t):
                t=re.sub(r'/\*.*?\*/', '', t, flags=re.S).rstrip()      # Kommentare hinter dem Semikolon
                return t.count('{')==t.count('}') and t.count('[')==t.count(']') and t.count('(')==t.count(')') and t.endswith(';')
            while not fertig('\n'.join(buf)):
                j+=1; buf.append(lines[j])
            return buf
    raise SystemExit(f'nicht gefunden: {name}')

teile=[]
for n in NAMEN:
    teile.append('\n'.join(finde(n)))

kopf = '''/* preis-kern.js — AUTOMATISCH ERZEUGT aus dist/konfigurator.js durch
   tools/kern_extrahieren.py. NICHT VON HAND AENDERN — Aenderungen gehoeren in
   den Konfigurator, danach das Werkzeug erneut laufen lassen.

   preisKern(S, SHOP, KURVEN, KFG_LANG) liefert calc(), isStandard(), shopHit()
   und die Geometrie-Helfer, ohne DOM. Der Worker rechnet damit jeden
   Checkout-Betrag selbst nach. */
'use strict';
function preisKern(S, SHOP, KURVEN, KFG_LANG){
  const document = undefined, window = undefined;   /* kein DOM im Worker */
  const $ = ()=>null;
  const toast = ()=>{};
  const buildCorner = ()=>{};
'''
fuss = '''
  return { calc, isStandard, needsOffer, shopHit, hitPreis, kurvenPreis, kurvenSchluessel,
           areaM2, perimM, dims, lfGeo, lfPts, cornerCount, cornerLabel, cornerName,
           massbandStrecke, massbandName, cutPrice, cutMass, cutTypName, presetCount, cutAbstaende,
           dekorList, ensureDekor, kanal, auf90 };
}
export { preisKern };
'''
body = '\n\n'.join(teile)
# Einrueckung fuer die Fabrik
body = '\n'.join(('  '+l if l else l) for l in body.split('\n'))
ZIEL.parent.mkdir(parents=True, exist_ok=True)
ZIEL.write_text(kopf + body + '\n' + fuss, encoding='utf-8')
print(f'{ZIEL.relative_to(ROOT)}: {len(NAMEN)} Bausteine, {len(body.splitlines())} Zeilen')
