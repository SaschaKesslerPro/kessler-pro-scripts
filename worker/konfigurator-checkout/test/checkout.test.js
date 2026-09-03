/* Lokaler Test ohne Cloudflare und ohne Shopify: fetch wird ersetzt.
   Prueft Preisnachrechnung, Preisabgleich, Attribute und den Shopify-Aufruf.
   Aufruf: cd worker/konfigurator-checkout && npm test */
import { checkout } from '../src/index.js';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const hier = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(hier, '../../..');
const matrix = fs.readFileSync(path.join(root,'dist/data/kfg-produktmatrix.json'));
const kurven = fs.readFileSync(path.join(root,'dist/data/kfg-preiskurven.json'));
let letzterAufruf = null, tokenAufrufe = 0, varianteAblehnen = false, aufrufe = [];
globalThis.fetch = async (u, opt) => {
  u = String(u);
  if(u.endsWith('kfg-produktmatrix.json')) return new Response(matrix, { status:200 });
  if(u.endsWith('kfg-preiskurven.json')) return new Response(kurven, { status:200 });
  if(u.endsWith('/admin/oauth/access_token')){ tokenAufrufe++; return new Response(JSON.stringify({ access_token:'shpca_test', scope:'write_draft_orders,read_products', expires_in:86399 }), { status:200 }); }
  if(u.includes('/admin/api/')){ letzterAufruf = JSON.parse(opt.body); aufrufe.push(letzterAufruf);
    if(opt.headers['X-Shopify-Access-Token']!=='shpca_test') return new Response('{"errors":"kein token"}',{status:401});
    if(varianteAblehnen && letzterAufruf.variables.input.lineItems[0].variantId) return new Response(JSON.stringify({ data:{ draftOrderCreate:{ draftOrder:null, userErrors:[{ field:['input','lineItems','0','variantId'], message:'Variant does not exist' }] } } }), { status:200 });
    return new Response(JSON.stringify({ data:{ draftOrderCreate:{ draftOrder:{ id:'gid://shopify/DraftOrder/1', invoiceUrl:'https://checkout.kessler-pro.com/…/invoices/abc', totalPriceSet:{ presentmentMoney:{ amount:'199.80', currencyCode:'EUR' } } }, userErrors:[] } } }), { status:200 }); }
  throw new Error('unerwarteter fetch '+u);
};
const env = { SHOPIFY_SHOP:'test.myshopify.com', SHOPIFY_CLIENT_ID:'cid', SHOPIFY_CLIENT_SECRET:'geheim', ALLOWED_ORIGINS:'https://www.kessler-pro.com', DATEN_BASE:'', LIEFERZEIT:'Fertigung 10–15 Werktage', PUBLIC_URL:'https://kfg.test' };
let ok=0; const bad=[]; const check=(n,c,i)=>{ if(c) ok++; else bad.push(n+(i?' → '+JSON.stringify(i).slice(0,300):'')); };

const S = { mat:'dekor', dekor:'buk', thick:'25', mpxSurface:'natur', absColor:'dekor', form:'lform', L:120,B:60,D:80,
  lf:{L:200,B:90,aw:80,ah:50,pos:'hr',schnitt:'gerade'}, corner:0, cornerR:[0,0,0,0], lfR:[0,0,0,0,0], edgeR:3, edges:['abs','abs','abs','abs'],
  extras:{bohr:false,custom:false,lack:false}, massband:'none', massbandNull:'links', machine:'', maschineMass:'52x18.1', cuts:[] };

/* ① L-Form aus der PREISREGEL: 199,80 */
let r = await checkout({ version:'1.17.0', kanal:'eur', sprache:'de', url:'https://www.kessler-pro.com/tischplatte-nach-mass#x', base:'', preis:199.8, konfig:S }, env, null);
check('L-Form 199,80 → checkoutUrl', r.checkoutUrl && r.preis===199.8 && r.waehrung==='EUR', r);
const li = letzterAufruf.variables.input.lineItems[0];
check('Position: Basisvariante Buche, Preis ueberschrieben, Titel im Attribut', li.variantId==='gid://shopify/ProductVariant/54697596420442' && li.priceOverride.amount==='199.80' && li.priceOverride.currencyCode==='EUR' && !li.title && !li.originalUnitPriceWithCurrency && li.customAttributes.some(a=>a.key==='_kfg_titel' && /Tischplatte nach Maß · Möbelplatte · Buche · 25 mm · L-Form 200 × 90 cm/.test(a.value)), li);
check('Attribute: Form & Maß mit Lage', li.customAttributes.some(a=>a.key==='Form & Maß' && /Ausklinkung 80 × 50 cm hinten rechts · gerade/.test(a.value)), li.customAttributes);
check('Attribute: _kfg_preis-Aufteilung', li.customAttributes.some(a=>a.key==='_kfg_preis' && /Platte 170.90 .* Ausklinkung 28.90/.test(a.value)), li.customAttributes);
check('Variantenposition ohne Gewicht/Steuer-Felder (Shopify ignoriert sie sonst)', li.weight===undefined && li.taxable===undefined && li.requiresShipping===undefined, li);
check('Versand Massanfertigung pauschal 19,99 fuer 200x90', letzterAufruf.variables.input.shippingLine && letzterAufruf.variables.input.shippingLine.price==='19.99' && /pauschal/.test(letzterAufruf.variables.input.shippingLine.title), letzterAufruf.variables.input.shippingLine);
check('Rohdaten in Stuecken vollstaendig', (()=>{ const t=li.customAttributes.filter(a=>/^_kfg_konfig_\d$/.test(a.key)).sort((x,y)=>x.key.localeCompare(y.key)).map(a=>a.value).join(''); try{ const o=JSON.parse(t); return o.lf && o.lf.L===200; }catch(e){ return false; } })(), li.customAttributes.filter(a=>/_kfg_konfig/.test(a.key)).length);
check('Widerruf + Lieferzeit als Attribut', li.customAttributes.some(a=>a.key==='Hinweis'&&/Widerruf/.test(a.value)) && li.customAttributes.some(a=>a.key==='Lieferzeit'), li.customAttributes.map(a=>a.key));
check('Presentment EUR, Tags, Notiz', letzterAufruf.variables.input.presentmentCurrencyCode==='EUR' && letzterAufruf.variables.input.tags.includes('konfigurator') && /kfg-1\.17\.0/.test(letzterAufruf.variables.input.tags.join()), letzterAufruf.variables.input);

check('Ablauf-Attribut + Freigabe-Link sichtbar, Token an der Bestellung', li.customAttributes.some(a=>a.key==='Ablauf'&&/72 Stunden/.test(a.value)) && li.customAttributes.some(a=>a.key==='Zeichnung prüfen'&&/^https:\/\/kfg\.test\/freigabe\/[A-Za-z0-9_-]{16,}$/.test(a.value)) && letzterAufruf.variables.input.customAttributes.some(a=>a.key==='_kfg_token'&&a.value.length>=16), li.customAttributes.map(a=>a.key));

/* ② Preis manipuliert → 409 */
try{ await checkout({ kanal:'eur', preis:99.9, konfig:S }, env, null); check('Manipulierter Preis abgelehnt', false); }
catch(e){ check('Manipulierter Preis abgelehnt (409)', e.status===409, e.message); }

/* ③ Lagerartikel PL in zl */
const L = { ...S, form:'rect', L:120, B:60, lf:{L:180,B:120,aw:90,ah:60,pos:null,schnitt:'gerade'} };
r = await checkout({ kanal:'pln', sprache:'pl', preis:313.9, konfig:L }, env, null);
check('Lager PL 313,90 zl', r.preis===313.9 && r.waehrung==='PLN' && letzterAufruf.variables.input.lineItems[0].priceOverride.currencyCode==='PLN' && letzterAufruf.variables.input.lineItems[0].priceOverride.amount==='313.90', r);
check('PL: Versand pauschal 84,90 zl', letzterAufruf.variables.input.shippingLine.price==='84.90' && /ryczałt/.test(letzterAufruf.variables.input.shippingLine.title), letzterAufruf.variables.input.shippingLine);
check('Token nur einmal geholt (Cache)', tokenAufrufe===1, tokenAufrufe);
check('Lager-SKU als Attribut', letzterAufruf.variables.input.lineItems[0].customAttributes.some(a=>a.key==='_kfg_lager_sku' && a.value==='5907255093892'));

/* ④ Naehtisch mit Maschine, Massband, Bohrung und Bearbeitung */
const N = { ...S, mat:'szwal', dekor:'sz-weiss', thick:'21', form:'lform', lf:{L:180,B:120,aw:90,ah:60,pos:'vr',schnitt:'schraeg'}, edges:['nicht','nicht','nicht','nicht'],
  massband:'sticker', massbandNull:'rechts', machine:'Bernina 770 QE', maschineMass:'52x18.1', lfR:[30,0,0,30,0], extras:{bohr:true,custom:false,lack:true},
  cuts:[{t:'r',preset:'maschine',w:52,h:18.1,cx:135,cy:46}] };
r = await checkout({ kanal:'eur', konfig:N }, env, null);   /* ohne Client-Preis: nur Server */
const attr = letzterAufruf.variables.input.lineItems[0].customAttributes;
check('Naehtisch: Preis > 0, Variante sz-weiss, Titel im Attribut', r.preis>100 && letzterAufruf.variables.input.lineItems[0].variantId==='gid://shopify/ProductVariant/54697617359194' && attr.some(a=>a.key==='_kfg_titel'&&/Nähtischplatte/.test(a.value)), r);
check('Naehtisch: Maschine, Massband, Ecken, Bearbeitung', attr.some(a=>a.key==='Nähmaschine'&&a.value==='Bernina 770 QE') && attr.some(a=>a.key==='Maßband'&&/Nullpunkt rechts/.test(a.value)) && attr.some(a=>a.key==='Ecken') && attr.some(a=>/^Bearbeitung 1/.test(a.key)&&/Abstände/.test(a.value)) && attr.some(a=>a.key==='Kante'&&/lackiert/.test(a.value)), attr);

/* ④b kleine Platte 100x50: Versand frei */
r = await checkout({ kanal:'eur', konfig:{ ...S, form:'rect', L:100, B:50 } }, env, null);
check('100x50 nach Mass: ebenfalls pauschal 19,99', letzterAufruf.variables.input.shippingLine.price==='19.99', letzterAufruf.variables.input.shippingLine);

/* ④c Multiplex natur / + HPL: eigene Varianten */
r = await checkout({ kanal:'eur', konfig:{ ...S, mat:'mpx', dekor:'sperrholz-natur', thick:'21', mpxSurface:'natur', form:'rect', L:100, B:50 } }, env, null);
check('Multiplex natur → Variante Birke natur', letzterAufruf.variables.input.lineItems[0].variantId==='gid://shopify/ProductVariant/54697617031514', letzterAufruf.variables.input.lineItems[0]);
r = await checkout({ kanal:'eur', konfig:{ ...S, mat:'mpx', dekor:'kaszmir', thick:'21', mpxSurface:'hpl', form:'rect', L:100, B:50 } }, env, null);
check('Multiplex + HPL Kaschmir → Variante mpx_hpl|kaszmir', letzterAufruf.variables.input.lineItems[0].variantId==='gid://shopify/ProductVariant/54697738994010', letzterAufruf.variables.input.lineItems[0]);

/* ④d Shopify lehnt die Variante ab → individuelle Position wie frueher (mit Titel, Preis, Gewicht) */
varianteAblehnen = true; aufrufe = [];
r = await checkout({ kanal:'eur', konfig:{ ...S, form:'rect', L:100, B:50 } }, env, null);
const rueck = letzterAufruf.variables.input.lineItems[0];
check('Fallback: zweiter Aufruf ohne Variante, mit Titel + Preis + Gewicht', aufrufe.length===2 && !rueck.variantId && /^Tischplatte · Möbelplatte · Buche · 25 mm · 100 × 50 cm/.test(rueck.title) && rueck.originalUnitPriceWithCurrency && rueck.weight && rueck.weight.value>0 && r.checkoutUrl, rueck);
varianteAblehnen = false;

/* ⑤ Eigene Skizze → Anfrage */
try{ await checkout({ kanal:'eur', konfig:{ ...S, extras:{bohr:false,custom:true,lack:false} } }, env, null); check('Skizze abgelehnt', false); }
catch(e){ check('Skizze → 400', e.status===400, e.message); }

/* ⑥ Masse ausserhalb */
try{ await checkout({ kanal:'eur', konfig:{ ...S, form:'rect', L:900 } }, env, null); check('Mass abgelehnt', false); }
catch(e){ check('Mass 900 → 400', e.status===400, e.message); }

/* ⑦ Sicherheitscheck 03.09.: Manipulationen am Client duerfen den Preis nicht druecken */
const basis = { ...S, form:'rect', L:150, B:70, cuts:[] };
r = await checkout({ kanal:'eur', konfig: basis }, env, null); const pBasis = r.preis;
try{ await checkout({ kanal:'eur', konfig:{ ...basis, cuts:[{ t:'r', cx:50, cy:30, w:-80, h:-40 }] } }, env, null); check('negativer Ausschnitt abgelehnt', false); }
catch(e){ check('negativer Ausschnitt → 400', e.status===400, e.message); }
try{ await checkout({ kanal:'eur', konfig:{ ...basis, cuts:[{ t:'k', cx:50, cy:30, w:-9000, dp:-50, len:10 }] } }, env, null); check('negativer Kanal abgelehnt', false); }
catch(e){ check('negativer Kanal → 400', e.status===400, e.message); }
try{ await checkout({ kanal:'eur', konfig:{ ...basis, cuts:[{ t:'c', cx:50, cy:30, d:6, preset:'gratis' }] } }, env, null); check('unbekannte Vorlage abgelehnt', false); }
catch(e){ check('unbekannte Vorlage → 400', e.status===400, e.message); }
r = await checkout({ kanal:'eur', konfig:{ ...basis, cornerR:[-50,'x',1e9,30] } }, env, null);
check('kaputte Radien werden bereinigt, Preis nicht kleiner als Basis', r.preis>=pBasis, { p:r.preis, pBasis });
r = await checkout({ kanal:'eur', konfig:{ ...basis, edges:['gratis','abs','abs','abs'] } }, env, null);
check('unbekanntes Kantenprofil → Vorgabe ABS', r.preis===pBasis, { p:r.preis, pBasis });
r = await checkout({ kanal:'eur', version:'1.17.5"><script>', url:'https://boese.example/phish', base:'https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@0000000', konfig: basis }, env, null);
const inp = letzterAufruf.variables.input;
check('fremde URL nicht in Notiz/Attribut', !/boese/.test(inp.note) && !inp.customAttributes.some(a=>/boese/.test(a.value)), inp.note);
check('Version in Tags bereinigt', inp.tags.includes('kfg-1.17.5script'), inp.tags);
check('Preisdaten aus dem Bundle, nicht vom Client', /^bundle /.test(inp.customAttributes.find(a=>a.key==='_kfg_daten').value), inp.customAttributes.find(a=>a.key==='_kfg_daten'));

console.log(`${ok} gruen, ${bad.length} rot`); bad.forEach(b=>console.log('  ✗', b));
process.exit(bad.length?1:0);
