/* Lokaler Test ohne Cloudflare und ohne Shopify: fetch wird ersetzt.
   Prueft Preisnachrechnung, Preisabgleich, Attribute und den Shopify-Aufruf.
   Aufruf: cd worker/konfigurator-checkout && npm test */
import { checkout } from '../src/index.js';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const hier = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(hier, '../../..');
const matrix = fs.readFileSync(path.join(root,'dist/data/kfg-produktmatrix.json'));
const kurven = fs.readFileSync(path.join(root,'dist/data/kfg-preiskurven.json'));
let letzterAufruf = null, tokenAufrufe = 0;
globalThis.fetch = async (u, opt) => {
  u = String(u);
  if(u.endsWith('kfg-produktmatrix.json')) return new Response(matrix, { status:200 });
  if(u.endsWith('kfg-preiskurven.json')) return new Response(kurven, { status:200 });
  if(u.endsWith('/admin/oauth/access_token')){ tokenAufrufe++; return new Response(JSON.stringify({ access_token:'shpca_test', scope:'write_draft_orders,read_products', expires_in:86399 }), { status:200 }); }
  if(u.includes('/admin/api/')){ letzterAufruf = JSON.parse(opt.body);
    if(opt.headers['X-Shopify-Access-Token']!=='shpca_test') return new Response('{"errors":"kein token"}',{status:401});
    return new Response(JSON.stringify({ data:{ draftOrderCreate:{ draftOrder:{ id:'gid://shopify/DraftOrder/1', invoiceUrl:'https://checkout.kessler-pro.com/…/invoices/abc', totalPriceSet:{ presentmentMoney:{ amount:'199.80', currencyCode:'EUR' } } }, userErrors:[] } } }), { status:200 }); }
  throw new Error('unerwarteter fetch '+u);
};
const env = { SHOPIFY_SHOP:'test.myshopify.com', SHOPIFY_CLIENT_ID:'cid', SHOPIFY_CLIENT_SECRET:'geheim', ALLOWED_ORIGINS:'https://www.kessler-pro.com', DATEN_BASE:'', LIEFERZEIT:'Fertigung 10–15 Werktage' };
let ok=0; const bad=[]; const check=(n,c,i)=>{ if(c) ok++; else bad.push(n+(i?' → '+JSON.stringify(i).slice(0,300):'')); };

const S = { mat:'dekor', dekor:'buk', thick:'25', mpxSurface:'natur', absColor:'dekor', form:'lform', L:120,B:60,D:80,
  lf:{L:200,B:90,aw:80,ah:50,pos:'hr',schnitt:'gerade'}, corner:0, cornerR:[0,0,0,0], lfR:[0,0,0,0,0], edgeR:3, edges:['abs','abs','abs','abs'],
  extras:{bohr:false,custom:false,lack:false}, massband:'none', massbandNull:'links', machine:'', maschineMass:'52x18.1', cuts:[] };

/* ① L-Form aus der PREISREGEL: 199,80 */
let r = await checkout({ version:'1.17.0', kanal:'eur', sprache:'de', url:'https://www.kessler-pro.com/tischplatte-nach-mass#x', base:'', preis:199.8, konfig:S }, env, null);
check('L-Form 199,80 → checkoutUrl', r.checkoutUrl && r.preis===199.8 && r.waehrung==='EUR', r);
const li = letzterAufruf.variables.input.lineItems[0];
check('Position: Titel, Preis, Waehrung', /Tischplatte nach Maß · Möbelplatte · Buche · 25 mm · L-Form 200 × 90 cm/.test(li.title) && li.originalUnitPriceWithCurrency.amount==='199.80' && li.originalUnitPriceWithCurrency.currencyCode==='EUR', li);
check('Attribute: Form & Maß mit Lage', li.customAttributes.some(a=>a.key==='Form & Maß' && /Ausklinkung 80 × 50 cm hinten rechts · gerade/.test(a.value)), li.customAttributes);
check('Attribute: _kfg_preis-Aufteilung', li.customAttributes.some(a=>a.key==='_kfg_preis' && /Platte 170.90 .* Ausklinkung 28.90/.test(a.value)), li.customAttributes);
check('Gewicht plausibel (1,8 m2 x 25 mm ≈ 31,5 kg)', li.weight.value>25 && li.weight.value<40, li.weight);
check('Versand Sperrgut 24,90 (bis 42 kg) fuer 200x90', letzterAufruf.variables.input.shippingLine && letzterAufruf.variables.input.shippingLine.price==='24.90', letzterAufruf.variables.input.shippingLine);
check('Rohdaten in Stuecken vollstaendig', (()=>{ const t=li.customAttributes.filter(a=>/^_kfg_konfig_\d$/.test(a.key)).sort((x,y)=>x.key.localeCompare(y.key)).map(a=>a.value).join(''); try{ const o=JSON.parse(t); return o.lf && o.lf.L===200; }catch(e){ return false; } })(), li.customAttributes.filter(a=>/_kfg_konfig/.test(a.key)).length);
check('Widerruf + Lieferzeit als Attribut', li.customAttributes.some(a=>a.key==='Hinweis'&&/Widerruf/.test(a.value)) && li.customAttributes.some(a=>a.key==='Lieferzeit'), li.customAttributes.map(a=>a.key));
check('Presentment EUR, Tags, Notiz', letzterAufruf.variables.input.presentmentCurrencyCode==='EUR' && letzterAufruf.variables.input.tags.includes('konfigurator') && /kfg-1\.17\.0/.test(letzterAufruf.variables.input.tags.join()), letzterAufruf.variables.input);

/* ② Preis manipuliert → 409 */
try{ await checkout({ kanal:'eur', preis:99.9, konfig:S }, env, null); check('Manipulierter Preis abgelehnt', false); }
catch(e){ check('Manipulierter Preis abgelehnt (409)', e.status===409, e.message); }

/* ③ Lagerartikel PL in zl */
const L = { ...S, form:'rect', L:120, B:60, lf:{L:180,B:120,aw:90,ah:60,pos:null,schnitt:'gerade'} };
r = await checkout({ kanal:'pln', sprache:'pl', preis:313.9, konfig:L }, env, null);
check('Lager PL 313,90 zl', r.preis===313.9 && r.waehrung==='PLN' && letzterAufruf.variables.input.lineItems[0].originalUnitPriceWithCurrency.currencyCode==='PLN', r);
check('Lager 120x60: Versand frei (bis 110x50? nein → Sperrgut PL 39,90)', letzterAufruf.variables.input.shippingLine.price==='39.90', letzterAufruf.variables.input.shippingLine);
check('Token nur einmal geholt (Cache)', tokenAufrufe===1, tokenAufrufe);
check('Lager-SKU als Attribut', letzterAufruf.variables.input.lineItems[0].customAttributes.some(a=>a.key==='_kfg_lager_sku' && a.value==='5907255093892'));

/* ④ Naehtisch mit Maschine, Massband, Bohrung und Bearbeitung */
const N = { ...S, mat:'szwal', dekor:'sz-weiss', thick:'21', form:'lform', lf:{L:180,B:120,aw:90,ah:60,pos:'vr',schnitt:'schraeg'}, edges:['nicht','nicht','nicht','nicht'],
  massband:'sticker', massbandNull:'rechts', machine:'Bernina 770 QE', maschineMass:'52x18.1', lfR:[30,0,0,30,0], extras:{bohr:true,custom:false,lack:true},
  cuts:[{t:'r',preset:'maschine',w:52,h:18.1,cx:135,cy:46}] };
r = await checkout({ kanal:'eur', konfig:N }, env, null);   /* ohne Client-Preis: nur Server */
const attr = letzterAufruf.variables.input.lineItems[0].customAttributes;
check('Naehtisch: Preis > 0, Titel', r.preis>100 && /Nähtischplatte/.test(letzterAufruf.variables.input.lineItems[0].title), r);
check('Naehtisch: Maschine, Massband, Ecken, Bearbeitung', attr.some(a=>a.key==='Nähmaschine'&&a.value==='Bernina 770 QE') && attr.some(a=>a.key==='Maßband'&&/Nullpunkt rechts/.test(a.value)) && attr.some(a=>a.key==='Ecken') && attr.some(a=>/^Bearbeitung 1/.test(a.key)&&/Abstände/.test(a.value)) && attr.some(a=>a.key==='Kante'&&/lackiert/.test(a.value)), attr);

/* ④b kleine Platte 100x50: Versand frei */
r = await checkout({ kanal:'eur', konfig:{ ...S, form:'rect', L:100, B:50 } }, env, null);
check('100x50: kostenloser Versand', letzterAufruf.variables.input.shippingLine.price==='0.00' && /Kostenloser/.test(letzterAufruf.variables.input.shippingLine.title), letzterAufruf.variables.input.shippingLine);

/* ⑤ Eigene Skizze → Anfrage */
try{ await checkout({ kanal:'eur', konfig:{ ...S, extras:{bohr:false,custom:true,lack:false} } }, env, null); check('Skizze abgelehnt', false); }
catch(e){ check('Skizze → 400', e.status===400, e.message); }

/* ⑥ Masse ausserhalb */
try{ await checkout({ kanal:'eur', konfig:{ ...S, form:'rect', L:900 } }, env, null); check('Mass abgelehnt', false); }
catch(e){ check('Mass 900 → 400', e.status===400, e.message); }

console.log(`${ok} gruen, ${bad.length} rot`); bad.forEach(b=>console.log('  ✗', b));
process.exit(bad.length?1:0);
