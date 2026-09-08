/* Lokaler Test ohne Cloudflare und ohne Shopify: fetch wird ersetzt.
   Prueft Preisnachrechnung, Preisabgleich, Attribute und den Shopify-Aufruf.
   Aufruf: cd worker/konfigurator-checkout && npm test */
import { checkout, warenkorb } from '../src/index.js';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const hier = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(hier, '../../..');
const matrix = fs.readFileSync(path.join(root,'dist/data/kfg-produktmatrix.json'));
const kurven = fs.readFileSync(path.join(root,'dist/data/kfg-preiskurven.json'));
let letzterAufruf = null, tokenAufrufe = 0, varianteAblehnen = false, profilAblehnen = false, aufrufe = [], storefront = [];
/* Vorrat-Attrappe: Reserven im Basisprodukt; leer → der Worker legt frisch an. skuNachher: was die Nachkontrolle liest (null = wie umgeschrieben) */
let reserven = [], skuNachher = null, warenkorbLeerBis = 0;
globalThis.fetch = async (u, opt) => {
  u = String(u);
  if(u.endsWith('kfg-produktmatrix.json')) return new Response(matrix, { status:200 });
  if(u.endsWith('kfg-preiskurven.json')) return new Response(kurven, { status:200 });
  if(u.endsWith('/admin/oauth/access_token')){ tokenAufrufe++; return new Response(JSON.stringify({ access_token:'shpca_test', scope:'write_draft_orders,read_products', expires_in:86399 }), { status:200 }); }
  if(u.includes('/api/2024-10/graphql.json') && !u.includes('/admin/')){ const b = JSON.parse(opt.body);
    storefront.push({ b, headers: opt.headers });
    const leer = storefront.length <= warenkorbLeerBis;   /* die ersten n Proben: "ausverkauft" wie bei einer frischen Variante */
    return new Response(JSON.stringify({ data:{ cartCreate:{ cart:{ id:'gid://shopify/Cart/abc', checkoutUrl:'https://checkout.kessler-pro.com/cn/abc', lines:{ nodes:[{ quantity: leer ? 0 : 1 }] } }, warnings: leer ? [{ code:'MERCHANDISE_OUT_OF_STOCK' }] : [], userErrors:[] } } }), { status:200 }); }
  if(u.includes('/admin/api/')){ letzterAufruf = JSON.parse(opt.body); aufrufe.push(letzterAufruf);
    if(opt.headers['X-Shopify-Access-Token']!=='shpca_test') return new Response('{"errors":"kein token"}',{status:401});
    const q = letzterAufruf.query || '';
    if(/productVariants\(first/.test(q) && /KFG-RESERVE-/.test(letzterAufruf.variables.q)) return new Response(JSON.stringify({ data:{ productVariants:{ nodes: reserven.map(id => ({ id, sku:'KFG-RESERVE-'+id.split('/').pop(), createdAt:'2026-09-08T06:00:00Z' })) } } }), { status:200 });
    if(/productVariants\(first/.test(q)) return new Response(JSON.stringify({ data:{ productVariants:{ nodes:[] } } }), { status:200 });
    if(/productVariantsBulkUpdate/.test(q)){ const v = letzterAufruf.variables.v[0]; return new Response(JSON.stringify({ data:{ productVariantsBulkUpdate:{ productVariants:[{ id:v.id, title:v.optionValues[0].name, sku:v.inventoryItem.sku }], userErrors:[] } } }), { status:200 }); }
    if(/productVariant\(id/.test(q)){ const um = aufrufe.filter(a=>/productVariantsBulkUpdate/.test(a.query)).pop(); return new Response(JSON.stringify({ data:{ productVariant:{ sku: skuNachher || (um && um.variables.v[0].inventoryItem.sku) } } }), { status:200 }); }
    if(/productVariantsBulkCreate/.test(q)){ const vs = letzterAufruf.variables.v; return new Response(JSON.stringify({ data:{ productVariantsBulkCreate:{ productVariants: vs.map((v,i) => ({ id: vs.length>1 ? 'gid://shopify/ProductVariant/7770000'+i : 'gid://shopify/ProductVariant/999000111', title: v.optionValues[0].name, sku: v.inventoryItem.sku })), userErrors:[] } } }), { status:200 }); }
    if(/priceListFixedPricesAdd/.test(q)) return new Response(JSON.stringify({ data:{ priceListFixedPricesAdd:{ prices:[{ variant:{ id:'gid://shopify/ProductVariant/999000111' }, price: letzterAufruf.variables.p[0].price }], userErrors:[] } } }), { status:200 });
    if(/deliveryProfileUpdate/.test(q)) return new Response(JSON.stringify(profilAblehnen ? { data:{ deliveryProfileUpdate:{ profile:null, userErrors:[{ field:['profile'], message:'Access denied for deliveryProfileUpdate' }] } } } : { data:{ deliveryProfileUpdate:{ profile:{ id:'gid://shopify/DeliveryProfile/1' }, userErrors:[] } } }), { status:200 });
    if(/productVariantsBulkDelete/.test(q)) return new Response(JSON.stringify({ data:{ productVariantsBulkDelete:{ userErrors:[] } } }), { status:200 });
    if(varianteAblehnen && letzterAufruf.variables.input && letzterAufruf.variables.input.lineItems[0].variantId) return new Response(JSON.stringify({ data:{ draftOrderCreate:{ draftOrder:null, userErrors:[{ field:['input','lineItems','0','variantId'], message:'Variant does not exist' }] } } }), { status:200 });
    return new Response(JSON.stringify({ data:{ draftOrderCreate:{ draftOrder:{ id:'gid://shopify/DraftOrder/1', invoiceUrl:'https://checkout.kessler-pro.com/…/invoices/abc', totalPriceSet:{ presentmentMoney:{ amount:'199.80', currencyCode:'EUR' } } }, userErrors:[] } } }), { status:200 }); }
  throw new Error('unerwarteter fetch '+u);
};
const env = { STOREFRONT_TOKEN:'sf_test', SHOPIFY_SHOP:'test.myshopify.com', SHOPIFY_CLIENT_ID:'cid', SHOPIFY_CLIENT_SECRET:'geheim', ALLOWED_ORIGINS:'https://www.kessler-pro.com', DATEN_BASE:'', LIEFERZEIT:'Fertigung 10–15 Werktage', PUBLIC_URL:'https://kfg.test' };
let ok=0; const bad=[]; const check=(n,c,i)=>{ if(c) ok++; else bad.push(n+(i?' → '+JSON.stringify(i).slice(0,300):'')); };

const S = { mat:'dekor', dekor:'buk', thick:'25', mpxSurface:'natur', absColor:'dekor', form:'lform', L:120,B:60,D:80,
  lf:{L:200,B:90,aw:80,ah:50,pos:'hr',schnitt:'gerade'}, corner:0, cornerR:[0,0,0,0], lfR:[0,0,0,0,0], edgeR:3, edges:['abs','abs','abs','abs'],
  extras:{bohr:false,custom:false,lack:false}, massband:'none', massbandNull:'links', machine:'', maschineMass:'52x18.1', cuts:[] };

/* ① L-Form aus der PREISREGEL: 199,80 */
let r = await checkout({ version:'1.17.0', kanal:'eur', sprache:'de', url:'https://www.kessler-pro.com/tischplatte-nach-mass#x', base:'', preis:199.8, konfig:S }, env, null);
check('L-Form 199,80 → checkoutUrl', r.checkoutUrl && r.preis===199.8 && r.waehrung==='EUR', r);
const li = letzterAufruf.variables.input.lineItems[0];
check('Position (Rueckfall Draft Order): individuelle Position mit Titel, Preis, Waehrung', !li.variantId && /Tischplatte nach Maß · Möbelplatte · Buche · 25 mm · L-Form 200 × 90 cm/.test(li.title) && li.originalUnitPriceWithCurrency.amount==='199.80' && li.originalUnitPriceWithCurrency.currencyCode==='EUR', li);
check('Attribute: Form & Maß mit Lage', li.customAttributes.some(a=>a.key==='Form & Maß' && /Ausklinkung 80 × 50 cm hinten rechts · gerade/.test(a.value)), li.customAttributes);
check('Attribute: _kfg_preis-Aufteilung', li.customAttributes.some(a=>a.key==='_kfg_preis' && /Platte 170.90 .* Ausklinkung 28.90/.test(a.value)), li.customAttributes);
check('Gewicht plausibel (1,8 m2 x 25 mm ≈ 31,5 kg)', li.weight.value>25 && li.weight.value<40, li.weight);
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
check('Lager PL 313,90 zl', r.preis===313.9 && r.waehrung==='PLN' && letzterAufruf.variables.input.lineItems[0].originalUnitPriceWithCurrency.currencyCode==='PLN' && letzterAufruf.variables.input.lineItems[0].originalUnitPriceWithCurrency.amount==='313.90', r);
check('PL: Versand pauschal 84,90 zl', letzterAufruf.variables.input.shippingLine.price==='84.90' && /ryczałt/.test(letzterAufruf.variables.input.shippingLine.title), letzterAufruf.variables.input.shippingLine);
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
check('100x50 nach Mass: ebenfalls pauschal 19,99', letzterAufruf.variables.input.shippingLine.price==='19.99', letzterAufruf.variables.input.shippingLine);

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

/* ⑧ Warenkorb-Weg (07.09.): eigene Variante mit echtem Preis, PLN + EUR-Festpreis, Versandprofil */
aufrufe = [];
r = await warenkorb({ version:'1.17.8', kanal:'eur', sprache:'de', url:'https://www.kessler-pro.com/tischplatte-nach-mass', preis:199.8, konfig:S }, env, null);
const qs = aufrufe.map(a=>a.query);
const varCall = aufrufe.find(a=>/productVariantsBulkCreate/.test(a.query)), preisCall = aufrufe.find(a=>/priceListFixedPricesAdd/.test(a.query)), profilCall = aufrufe.find(a=>/deliveryProfileUpdate/.test(a.query));
check('Warenkorb: Variante angelegt, Festpreis EUR, Versandprofil zugeordnet', varCall && preisCall && profilCall, qs.map(q=>q.slice(0,40)));
check('Warenkorb: Antwort mit variantId, Token, Titel, Preis EUR', r.variantId==='gid://shopify/ProductVariant/999000111' && /^[A-Za-z0-9_-]{16,}$/.test(r.token) && /Tischplatte nach Maß · Möbelplatte · Buche · 25 mm · L-Form 200 × 90 cm/.test(r.titel) && r.preis===199.8 && r.waehrung==='EUR', r);
const v0 = varCall.variables.v[0];
check('Variante: Option Ausführung mit Kurztitel + #Token, SKU KFG-, PLN-Preis, Gewicht, Dekorbild Buche', v0.optionValues[0].optionName==='Ausführung' && /^Möbelplatte · Buche · 25 mm · L-Form 200 × 90 cm · #/.test(v0.optionValues[0].name) && v0.inventoryItem.sku==='KFG-'+r.token && +v0.price>500 && v0.inventoryItem.measurement.weight.value>25 && v0.mediaId==='gid://shopify/MediaImage/62075442561370', v0);
check('Festpreis 199,80 EUR in der EU-Preisliste', preisCall.variables.p[0].price.amount==='199.80' && preisCall.variables.p[0].price.currencyCode==='EUR' && preisCall.variables.l==='gid://shopify/PriceList/31843025242', preisCall.variables);
check('Versandprofil Massanfertigung', profilCall.variables.id==='gid://shopify/DeliveryProfile/138342564186' && profilCall.variables.p.variantsToAssociate[0]===r.variantId, profilCall.variables);
check('Attribute: sichtbare Zeilen + Zeichnung-pruefen-Link + versteckte _kfg_token/_kfg_titel/_kfg_konfig', r.attribute.some(a=>a.key==='Form & Maß') && r.attribute.some(a=>a.key==='Zeichnung prüfen'&&a.value.endsWith('/freigabe/'+r.token)) && r.attribute.some(a=>a.key==='_kfg_token'&&a.value===r.token) && r.attribute.some(a=>a.key==='_kfg_titel') && r.attribute.some(a=>a.key==='_kfg_konfig_1'), r.attribute.map(a=>a.key));
check('Kein checkoutUrl ohne sofort', !r.checkoutUrl);

/* ⑧b Sofortkauf: eigener Storefront-Warenkorb → Checkout-URL */
storefront = [];
r = await warenkorb({ kanal:'pln', sprache:'pl', preis:null, konfig:S, sofort:true }, env, null);
check('Sofortkauf: Storefront cartCreate mit Variante, Attributen, Land PL', storefront.length===1 && /cartCreate/.test(storefront[0].b.query) && storefront[0].b.variables.in.lines[0].merchandiseId===r.variantId && storefront[0].b.variables.in.buyerIdentity.countryCode==='PL' && storefront[0].b.variables.in.lines[0].attributes.some(a=>a.key==='_kfg_token') && storefront[0].headers['X-Shopify-Storefront-Access-Token']==='sf_test', storefront[0] && storefront[0].b.variables);
check('Sofortkauf: checkoutUrl, Preis in PLN', r.checkoutUrl==='https://checkout.kessler-pro.com/cn/abc' && r.waehrung==='PLN' && r.preis>500, r);

/* ⑧c Lagerartikel: echte Shop-Variante, keine eigene */
aufrufe = [];
r = await warenkorb({ kanal:'eur', konfig:L }, env, null);
check('Lager: lager:true, echte Variante, keine Anlage', r.lager===true && r.variantId==='gid://shopify/ProductVariant/54306775990618' && !aufrufe.some(a=>/productVariantsBulkCreate/.test(a.query)), r);

/* ⑧c2 Review 08.09. A2: Lagergroesse MIT Bearbeitung ist kein Lagerartikel → eigene Variante mit vollem Preis */
aufrufe = [];
r = await warenkorb({ kanal:'eur', konfig:{ ...L, cornerR:[30,30,30,30] } }, env, null);
check('Lager + 4 Ecken: keine Lagervariante, eigene Variante mit 69,90 + 39,90', !r.lager && r.variantId!=='gid://shopify/ProductVariant/54306775990618' && Math.abs(r.preis-109.8)<0.001 && aufrufe.some(a=>/productVariantsBulkCreate|productVariantsBulkUpdate/.test(a.query)), r);

/* ⑧c3 Review 08.09. A4: Kabelkanal mit Kantenanschluss rechnet wie der Konfigurator (Enden a/e/ae) */
const kanalS = { ...L, cuts:[{ t:'k', cx:60, cy:30, len:72, dir:'laengs', w:60, dp:10, seite:'unten', enden:'ae' }] };
r = await warenkorb({ kanal:'eur', konfig:kanalS }, env, null);
check('Kanal enden=ae: Preis ueber die volle Plattenlaenge (120 cm), kein 409', r.preis>69.9+30 && r.attribute.some(a=>/Kabelkanal 120 cm/.test(a.value)), { preis:r.preis, attr:r.attribute.filter(a=>/Kanal/i.test(a.value)).map(a=>a.value) });

/* ⑧c4 Review 08.09. A5: Fertigungsgrenzen je Material sind verbindlich */
for(const [name, konfig] of [['Compact 250x60', { ...L, mat:'compact', thick:'12', dekor:'weiss', edges:['roh','roh','roh','roh'], L:250, B:60 }], ['Multiplex 200x150', { ...L, mat:'mpx', thick:'21', dekor:'sperrholz-natur', edges:['nicht','nicht','nicht','nicht'], L:200, B:150 }], ['Compact rund 150', { ...L, mat:'compact', thick:'12', dekor:'weiss', edges:['roh','roh','roh','roh'], form:'round', D:150 }], ['L-Form Ausklinkung zu breit', { ...S, lf:{ ...S.lf, aw:195 } }]]){
  try{ await warenkorb({ kanal:'eur', konfig }, env, null); check(name+' abgelehnt', false); }
  catch(e){ check(name+' → 400 Fertigungsbereich', e.status===400 && /Fertigungsbereich/.test(e.message), e.message); }
}
try{ await checkout({ kanal:'eur', konfig:{ ...L, mat:'compact', thick:'12', dekor:'weiss', edges:['roh','roh','roh','roh'], L:250, B:60 } }, env, null); check('checkout Compact 250 abgelehnt', false); }
catch(e){ check('checkout: Compact 250x60 → 400', e.status===400, e.message); }

/* ⑧d Versandprofil abgelehnt (fehlender Scope) → Variante wieder geloescht, Fehler → Browser faellt auf Sofortkauf/Draft zurueck */
profilAblehnen = true; aufrufe = [];
try{ await warenkorb({ kanal:'eur', konfig:S }, env, null); check('Profil abgelehnt → Fehler', false); }
catch(e){ check('Profil abgelehnt → Fehler 502 und Variante geloescht', e.status===502 && aufrufe.some(a=>/productVariantsBulkDelete/.test(a.query)), e.message); }
profilAblehnen = false;

/* ⑧e Manipulation: Preis abweichend → 409, keine Variante */
aufrufe = [];
try{ await warenkorb({ kanal:'eur', preis:99.9, konfig:S }, env, null); check('Warenkorb: manipulierter Preis abgelehnt', false); }
catch(e){ check('Warenkorb: manipulierter Preis abgelehnt (409), keine Variante', e.status===409 && !aufrufe.some(a=>/productVariantsBulkCreate/.test(a.query)), e.message); }

/* ⑧f Vorrat (08.09.): vorgewaermte Reserve wird umgeschrieben statt frisch angelegt; Vorrat wird im Hintergrund aufgefuellt */
reserven = ['gid://shopify/ProductVariant/5001', 'gid://shopify/ProductVariant/5002']; aufrufe = []; storefront = [];
r = await warenkorb({ version:'1.17.8', kanal:'eur', sprache:'de', preis:199.8, konfig:S }, env, null);
const umCall = aufrufe.find(a=>/productVariantsBulkUpdate/.test(a.query)), anlegeCalls = aufrufe.filter(a=>/productVariantsBulkCreate/.test(a.query)), profilCalls = aufrufe.filter(a=>/deliveryProfileUpdate/.test(a.query));
check('Vorrat: Reserve umgeschrieben, keine Konfig-Variante frisch angelegt', umCall && reserven.includes(umCall.variables.v[0].id) && r.variantId===umCall.variables.v[0].id && r.vorrat===true, { r: r.variantId, um: umCall && umCall.variables.v[0].id });
const u0 = umCall && umCall.variables.v[0];
check('Vorrat: Umschreiben setzt Name, PLN-Preis, SKU KFG-Token, kaufbar (tracked false, CONTINUE), Gewicht, Dekorbild', u0 && /^Möbelplatte · Buche · 25 mm · L-Form 200 × 90 cm · #/.test(u0.optionValues[0].name) && +u0.price>500 && u0.inventoryItem.sku==='KFG-'+r.token && u0.inventoryItem.tracked===false && u0.inventoryPolicy==='CONTINUE' && u0.inventoryItem.measurement.weight.value>25 && u0.mediaId==='gid://shopify/MediaImage/62075442561370', u0);
check('Vorrat: EUR-Festpreis gesetzt, Versandprofil nicht erneut (Reserve hat es schon)', aufrufe.some(a=>/priceListFixedPricesAdd/.test(a.query)) && !profilCalls.some(p=>p.variables.p.variantsToAssociate.includes(r.variantId)), profilCalls.map(p=>p.variables.p));
check('Vorrat: Kaufbarkeits-Probe per cartCreate auch ohne sofort, Nachkontrolle der SKU', storefront.length===1 && storefront[0].b.variables.in.lines[0].merchandiseId===r.variantId && aufrufe.some(a=>/productVariant\(id/.test(a.query)), storefront.length);
const nach = anlegeCalls.find(a=>a.variables.v.length>1);
check('Vorrat: 10 Reserven nachgelegt (Ziel 12, 2 vorhanden) — SKU KFG-RESERVE-, nicht kaufbar (tracked, DENY, 0,00), Versandprofil zugeordnet', nach && nach.variables.v.length===10 && nach.variables.v.every(v=>/^KFG-RESERVE-[A-Za-z0-9]{8}$/.test(v.inventoryItem.sku) && v.inventoryItem.tracked===true && v.inventoryPolicy==='DENY' && v.price==='0.00' && /^Reserviert · /.test(v.optionValues[0].name)) && profilCalls.some(p=>p.variables.p.variantsToAssociate.length===10), nach && nach.variables.v.length);

/* ⑧g Zwei Klicks auf dieselbe Reserve: Nachkontrolle sieht fremde SKU → 409, Variante bleibt (gehoert dem anderen) */
skuNachher = 'KFG-anderer-Klick'; aufrufe = [];
try{ await warenkorb({ kanal:'eur', konfig:S }, env, null); check('Reserve doppelt → Fehler', false); }
catch(e){ check('Reserve doppelt vergeben → 409, nicht geloescht', e.status===409 && !aufrufe.some(a=>/productVariantsBulkDelete/.test(a.query)), e.message); }
skuNachher = null;

/* ⑧h Vorrat leer, frische Variante: Warenkorb-Backend meldet 2× "ausverkauft", dann kaufbar → trotzdem Erfolg */
reserven = []; storefront = []; warenkorbLeerBis = 2; aufrufe = [];
r = await warenkorb({ kanal:'pln', sprache:'pl', konfig:S, sofort:true }, env, null);
check('Frisch angelegt: Probe wiederholt bis Menge 1, dann checkoutUrl', storefront.length===3 && r.checkoutUrl && r.vorrat===false && aufrufe.some(a=>/productVariantsBulkCreate/.test(a.query) && a.variables.v.length===1), storefront.length);
warenkorbLeerBis = 0;

console.log(`${ok} gruen, ${bad.length} rot`); bad.forEach(b=>console.log('  ✗', b));
process.exit(bad.length?1:0);
