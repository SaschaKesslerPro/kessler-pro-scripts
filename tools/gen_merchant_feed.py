#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kessler PRO — Google-Merchant-Center-Feed-Generator.

Liest die Products-Feeds-Collection live aus der Webflow Data API und
schreibt zwei Google-Shopping-XML-Feeds (RSS 2.0 + g:-Namespace):
  dist/merchant-feed-de.xml  (EUR, kessler-pro.com/products/…)
  dist/merchant-feed-pl.xml  (PLN, kessler-pro.com/pl-pl/products/…)

Damit zeigt Merchant Center IMMER auf kessler-pro.com-URLs (nie myshopify).
Neue Produkte erscheinen automatisch beim naechsten Lauf.

Aufruf:  WEBFLOW_TOKEN=… python3 tools/gen_merchant_feed.py [out_dir]
Nur stdlib. Vorbild: tools/gen_filtermap.py.
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from xml.sax.saxutils import escape

SITE = 'https://www.kessler-pro.com'
COLL_PRODUCTS = '69a2f0ad6b29b5d497cdb6e0'
LOCALE_PL = '6907a534407b21d560df11e4'  # CMS-Locale-ID (nicht Pages-API!)
BRAND = 'Kessler PRO'

# Webflow-Kategorie-Item-ID (letzte 4) -> product_type je Sprache
CATS = {
    '3d58': {'de': 'Möbelplatten', 'pl': 'Płyty meblowe'},
    '3d56': {'de': 'Multiplex', 'pl': 'Multiplex'},
    '3d5c': {'de': 'Komplett-Tische', 'pl': 'Stoły kompletne'},
    '3d5a': {'de': 'Tischgestelle', 'pl': 'Stelaże do stołów'},
    '3d54': {'de': 'Werkbänke', 'pl': 'Stoły warsztatowe'},
    '3d5e': {'de': 'Regalzubehör', 'pl': 'Akcesoria do regałów'},
    '3d60': {'de': 'Medizinschränke', 'pl': 'Szafki medyczne'},
    'b734': {'de': 'Compact-Tischplatten', 'pl': 'Blaty Compact'},
}


def api(path):
    tok = os.environ.get('WEBFLOW_TOKEN', '').strip()
    if not tok:
        sys.exit('WEBFLOW_TOKEN fehlt')
    req = urllib.request.Request(
        'https://api.webflow.com/v2' + path,
        headers={'Authorization': 'Bearer ' + tok})
    return json.load(urllib.request.urlopen(req, timeout=60))


def fetch_items(locale_id=None):
    items, off = [], 0
    while True:
        p = '/collections/%s/items/live?limit=100&offset=%d' % (COLL_PRODUCTS, off)
        if locale_id:
            p += '&cmsLocaleId=' + locale_id
        d = api(p)
        items += d.get('items', [])
        off += 100
        if off >= d.get('pagination', {}).get('total', 0):
            return items


def price(raw, cur):
    """'80,90 €' / '345,00 zł' -> '80.90 EUR' / '345.00 PLN'."""
    s = re.sub(r'[^\d,\.]', '', str(raw or ''))
    if ',' in s and '.' in s:
        s = s.replace('.', '').replace(',', '.')
    else:
        s = s.replace(',', '.')
    try:
        v = float(s)
    except ValueError:
        return None
    if v <= 0:
        return None
    return '%.2f %s' % (v, cur)


def item_xml(f, loc, cur, prefix, price_field):
    slug = f.get('slug')
    pid = f.get('product-id') or slug
    title = (f.get('name') or '').strip()
    desc = (f.get('kurzbeschreibung') or f.get('meta-description') or title).strip()
    img = f.get('product-main-image') or {}
    img_url = img.get('url') if isinstance(img, dict) else img
    pr = price(f.get(price_field), cur)
    if not (slug and title and img_url and pr):
        return None
    kat = (f.get('kategorie') or '')[-4:]
    ptype = CATS.get(kat, {}).get(loc, '')
    ean = re.sub(r'\D', '', str(f.get('ean') or ''))
    lines = [
        '  <item>',
        '    <g:id>%s</g:id>' % escape(str(pid)),
        '    <g:title>%s</g:title>' % escape(title[:150]),
        '    <g:description>%s</g:description>' % escape(desc[:5000]),
        '    <g:link>%s%s/products/%s</g:link>' % (SITE, prefix, escape(slug)),
        '    <g:image_link>%s</g:image_link>' % escape(img_url),
        '    <g:price>%s</g:price>' % pr,
        '    <g:availability>in_stock</g:availability>',
        '    <g:condition>new</g:condition>',
        '    <g:brand>%s</g:brand>' % BRAND,
    ]
    if len(ean) in (8, 12, 13, 14):
        lines.append('    <g:gtin>%s</g:gtin>' % ean)
    else:
        lines.append('    <g:identifier_exists>no</g:identifier_exists>')
    if ptype:
        lines.append('    <g:product_type>%s</g:product_type>' % escape(ptype))
    lines.append('  </item>')
    return '\n'.join(lines)


def build(items, loc, cur, prefix, price_field, title, out_path):
    body, skipped = [], 0
    for it in items:
        x = item_xml(it.get('fieldData', {}), loc, cur, prefix, price_field)
        if x:
            body.append(x)
        else:
            skipped += 1
    xml = '\n'.join([
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
        '<channel>',
        '  <title>%s</title>' % escape(title),
        '  <link>%s</link>' % SITE,
        '  <description>Kessler PRO Produktfeed (generiert %s)</description>'
        % datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
        '\n'.join(body),
        '</channel>',
        '</rss>',
        '',
    ])
    with open(out_path, 'w', encoding='utf-8') as fh:
        fh.write(xml)
    print('%s: %d Produkte, %d uebersprungen' % (out_path, len(body), skipped))


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else 'dist'
    de = fetch_items()
    pl = fetch_items(LOCALE_PL)
    build(de, 'de', 'EUR', '', 'product-price',
          'Kessler PRO — Produkte (DE/EUR)',
          os.path.join(out, 'merchant-feed-de.xml'))
    build(pl, 'pl', 'PLN', '/pl-pl', 'preis-pln',
          'Kessler PRO — Produkty (PL/PLN)',
          os.path.join(out, 'merchant-feed-pl.xml'))


if __name__ == '__main__':
    main()
