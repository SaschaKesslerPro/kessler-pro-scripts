#!/usr/bin/env python3
"""sync_prices.py — Recompute product-price aus preis-pln (zł-Quelle) pro Locale.

Datenfluss (nach Storesynk-Retarget): Shopify zł -> Storesynk -> CMS-Feld `preis-pln`.
Dieses Skript leitet daraus das Anzeigefeld `product-price` ab:
  PL  -> zł (1:1 aus preis-pln)
  DE  -> EUR = zł / 4,25, gerundet auf ,90
  EN  -> = DE
Items OHNE preis-pln (z.B. €-Linie / nicht in Shopify) werden UEBERSPRUNGEN
(deren product-price bleibt CMS-verwaltet).

ENV: WEBFLOW_TOKEN (Pflicht). Nur stdlib. Aufruf: python3 sync_prices.py [--dry-run]
"""
import os, sys, json, time, urllib.request, urllib.error

TOKEN=os.environ.get("WEBFLOW_TOKEN","").strip()
if not TOKEN: print("FEHLER: WEBFLOW_TOKEN fehlt",file=sys.stderr); sys.exit(2)
DRY="--dry-run" in sys.argv
CID="69a2f0ad6b29b5d497cdb6e0"
SKIP_SLUGS={"test-tischplatte"}  # Test-Item: kein PL-Locale
LOC={"DE":"67fea16e9758f16a33bef7a8","PL":"6907a534407b21d560df11e4","EN":"693d37e00fa97e8096629a1d"}
PRIMARY=LOC["DE"]

def api(m,u,b=None,tries=8):
    for t in range(tries):
        data=json.dumps(b).encode() if b else None
        r=urllib.request.Request(u,data=data,method=m,headers={"Authorization":"Bearer "+TOKEN,"accept":"application/json","content-type":"application/json"})
        try: return json.load(urllib.request.urlopen(r)),None
        except urllib.error.HTTPError as e:
            if e.code in (429,502,503): time.sleep(2*(t+1)); continue
            return None,str(e.code)
    return None,"err"

def num(s):
    if not s: return None
    s=str(s).replace("zł","").replace("€","").strip().replace(".","").replace(",",".")
    try: return float(s)
    except: return None

def eur(zl_value):
    x=zl_value/4.25; k=round(x-0.90); return "{:.2f}".format(k+0.90).replace(".",",")+" €"
def zl_fmt(zl_value): return "{:.2f}".format(zl_value).replace(".",",")+" zł"

def fetch_staged_primary():
    """preis-pln lebt staged (neues Feld) -> Staged-Liste lesen."""
    out={};off=0
    while True:
        d,_=api("GET","https://api.webflow.com/v2/collections/%s/items?cmsLocaleId=%s&limit=100&offset=%d"%(CID,PRIMARY,off))
        for it in d["items"]:
            fd=it["fieldData"]; out[it["id"]]={"slug":fd["slug"],"preis_pln":fd.get("preis-pln")}
        off+=100
        if off>=d["pagination"]["total"]: break
    return out

def fetch_live(loc):
    out={};off=0
    while True:
        d,_=api("GET","https://api.webflow.com/v2/collections/%s/items/live?cmsLocaleId=%s&limit=100&offset=%d"%(CID,loc,off))
        for it in d["items"]: out[it["id"]]=it["fieldData"].get("product-price")
        off+=100
        if off>=d["pagination"]["total"]: break
    return out

def main():
    items=fetch_staged_primary()
    cur={n:fetch_live(l) for n,l in LOC.items()}
    plan={"DE":[],"PL":[],"EN":[]}
    skipped=0
    for iid,info in items.items():
        z=num(info["preis_pln"])
        if z is None: skipped+=1; continue
        want={"PL":zl_fmt(z),"DE":eur(z),"EN":eur(z)}
        for loc in ("DE","PL","EN"):
            if (cur[loc].get(iid) or "")!=want[loc]:
                plan[loc].append((iid,want[loc]))
    total=sum(len(v) for v in plan.values())
    print("Items mit preis-pln: %d | uebersprungen (keine zł-Quelle): %d"%(len(items)-skipped,skipped))
    print("Aenderungen: DE %d, PL %d, EN %d (gesamt %d)"%(len(plan["DE"]),len(plan["PL"]),len(plan["EN"]),total))
    if DRY:
        for loc in ("DE","PL","EN"):
            for iid,val in plan[loc][:3]: print("  [DRY] %s %s -> %s"%(loc,iid,val))
        return
    for loc in ("DE","PL","EN"):
        for iid,val in plan[loc]:
            _,e=api("PATCH","https://api.webflow.com/v2/collections/%s/items/%s/live"%(CID,iid),{"cmsLocaleId":LOC[loc],"fieldData":{"product-price":val}})
            if e: print("  Fehler %s %s: %s"%(loc,iid,e))
            time.sleep(0.15)
    print("Fertig: %d product-price-Werte aktualisiert."%total)

if __name__=="__main__": main()
