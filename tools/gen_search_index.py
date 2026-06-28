#!/usr/bin/env python3
"""
gen_search_index.py — regenerate dist/search-index.json from the LIVE Webflow catalog.
CMS = source of truth. Rebuilds the products[] array fully; keeps v/cats/rooms from the
current published index (those rarely change). Run:  WF_TOKEN=... python3 gen_search_index.py <out.json>
"""
import json, os, sys, urllib.request

WF = os.environ["WF_TOKEN"]
COL_PRODUCTS = "69a2f0ad6b29b5d497cdb6e0"
COL_CATS     = "69ba6227bbb6f39fea44efe2"
COL_ROOMS    = "69f9a681c1db2b0f1a790344"
INDEX_MAIN   = "https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@main/dist/search-index.json"

def wf_all(col):
    out, off = [], 0
    while True:
        req = urllib.request.Request(
            f"https://api.webflow.com/v2/collections/{col}/items/live?limit=100&offset={off}",
            headers={"Authorization": "Bearer " + WF, "accept": "application/json"})
        d = json.load(urllib.request.urlopen(req))
        out += d["items"]; tot = d["pagination"]["total"]; off += 100
        if off >= tot: break
    return out

def img_url(fd):
    mi = fd.get("product-main-image")
    return mi.get("url") if isinstance(mi, dict) else None

def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "search-index.json"
    cats  = {it["id"]: it["fieldData"] for it in wf_all(COL_CATS)}
    rooms = {it["id"]: it["fieldData"] for it in wf_all(COL_ROOMS)}
    base = json.load(urllib.request.urlopen(INDEX_MAIN))  # keep v / cats / rooms
    products = []
    for it in wf_all(COL_PRODUCTS):
        fd = it["fieldData"]
        if not fd.get("slug"): continue
        cat = cats.get(fd.get("kategorie"), {})
        rms = [rooms[r]["slug"] for r in (fd.get("raume") or []) if r in rooms and rooms[r].get("slug")]
        bw = fd.get("bewertung")
        products.append({
            "n": fd.get("name"), "s": fd.get("slug"), "p": fd.get("product-price"),
            "c": cat.get("name"), "cs": cat.get("slug"), "sp": None,
            "img": img_url(fd), "bs": 1 if fd.get("header-bestseller") else 0,
            "rm": rms, "r": bw if (bw is not None and bw != "") else None,
        })
    base["products"] = products
    json.dump(base, open(out_path, "w"), ensure_ascii=False, separators=(",", ":"))
    miss = sum(1 for p in products if not p["img"])
    print(f"wrote {out_path}: {len(products)} products, {miss} without image")

if __name__ == "__main__":
    main()
