/* Kessler PRO — Checkout-Worker fuer den Tischplatten-Konfigurator
   ─────────────────────────────────────────────────────────────────
   POST /checkout  { version, kanal, sprache, url, preis, konfig, lager, maschine, skizze }
                  → { checkoutUrl, draftOrderId, preis }

   Der Worker nimmt die Konfiguration aus dem Browser, rechnet den Preis mit
   demselben Kern wie der Konfigurator nach (src/preis-kern.js, erzeugt aus
   dist/konfigurator.js), legt in Shopify eine Draft Order mit einer
   individuellen Position an — Titel, Preis, alle Konfigurationsdaten als
   Attribute — und gibt die Checkout-URL zurueck. Der Kunde bezahlt im
   normalen Shopify-Checkout; die Bestellung landet wie jede andere im Shop
   und damit in BaseLinker.

   Sicherheit: der vom Browser mitgeschickte Preis wird nur verglichen. Weicht
   er vom serverseitig gerechneten Preis ab, gibt es keine Draft Order (409) —
   der Konfigurator faellt dann auf die Mail-Anfrage zurueck.

   Umgebung (wrangler secret / vars):
     SHOPIFY_SHOP             hyf2zr-7x.myshopify.com
     SHOPIFY_CLIENT_ID        Dev-Dashboard-App "Konfigurator-Checkout" (Client-ID)
     SHOPIFY_CLIENT_SECRET    dazu der Schluessel (shpss_…) — Secret!
                              Der Worker holt sich damit per Client-Credentials-Grant einen
                              24-h-Admin-Token; die Scopes kommen aus der App-Version im
                              Dev Dashboard (write_draft_orders, read_products, read_orders).
     SHOPIFY_ADMIN_TOKEN      alternativ ein fester shpat_-Token (Legacy Custom App)
     ALLOWED_ORIGINS          kommagetrennt, z. B. https://www.kessler-pro.com,https://kessler-pro.com,https://kessler-pro-com.webflow.io
     DATEN_BASE               jsDelivr-Basis fuer Matrix und Kurven — leer = aus der Konfigurations-URL ableiten
     VERSAND                  optional JSON, ueberschreibt die Versandstaffel unten
     LIEFERZEIT               optional, Text fuer das Attribut "Lieferzeit"
*/
import { preisKern } from './preis-kern.js';

const API_VERSION = '2024-10';
const REPO = 'SaschaKesslerPro/kessler-pro-scripts';
const MATERIAL = { dekor:'Möbelplatte', mpx:'Multiplex Birke', compact:'Compact / HPL', szwal:'Nähtischplatte' };
const KANTE_NAME = { abs:'ABS-Kante 2 mm', nicht:'nicht gefräst', f45:'gefräst 45°', halbrund:'halbrund', roh:'geschliffen', fase:'gefast 45°' };
const LF_POS = { hr:'hinten rechts', hl:'hinten links', vr:'vorne rechts', vl:'vorne links' };
/* Rohdichte fuer das Versandgewicht, kg je m2 und mm Staerke */
const DICHTE = { dekor:0.00070, mpx:0.00068, compact:0.00140, szwal:0.00072 };
/* Versand fuer Massanfertigungen — Vorschlag 02.09.: bis 110 x 50 cm kostenlos (so
   verspricht es der Konfigurator), darueber die Sperrgut-Staffel aus dem Shopify-
   Profil "Dostawa (przesylka niestandardowa)" nach berechnetem Gewicht.
   Ueberschreibbar per Umgebungsvariable VERSAND (gleiche Struktur als JSON). */
const VERSAND_STANDARD = {
  frei_bis_cm: [110, 50],
  eur: { titel:'Versand Sperrgut', stufen:[[14,6.90],[28,12.90],[42,24.90],[Infinity,59.90]] },
  pln: { titel:'Dostawa (przesyłka niestandardowa)', stufen:[[14,39.90],[28,69.90],[Infinity,119.90]] },
  frei_titel: { eur:'Kostenloser Versand (DHL)', pln:'Darmowa dostawa (DHL)' },
};
function versandZeile(S, K, gewichtKg, kanal, env){
  let V = VERSAND_STANDARD;
  if(env && env.VERSAND){ try{ V = Object.assign({}, VERSAND_STANDARD, JSON.parse(env.VERSAND)); }catch(e){} }
  const d = K.dims(), lang = Math.max(d.w, d.h), kurz = Math.min(d.w, d.h);
  if(lang <= V.frei_bis_cm[0] && kurz <= V.frei_bis_cm[1]) return { title: V.frei_titel[kanal], price: '0.00' };
  const st = V[kanal] || V.eur;
  const stufe = st.stufen.find(([bis]) => gewichtKg <= bis) || st.stufen[st.stufen.length-1];
  return { title: `${st.titel} (${Math.round(gewichtKg)} kg)`, price: stufe[1].toFixed(2) };
}

export default {
  async fetch(req, env, ctx){
    const origin = req.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if(req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    if(req.method === 'GET' && url.pathname === '/health'){
      let shopify = 'nicht geprueft';
      if(url.searchParams.get('shopify')==='1'){ try{ await adminToken(env); shopify = 'ok'; }catch(e){ shopify = e.message + (e.detail?': '+JSON.stringify(e.detail).slice(0,200):''); } }
      return json({ ok:true, version: API_VERSION, shopify }, 200, cors);
    }
    if(req.method !== 'POST' || url.pathname !== '/checkout') return json({ fehler:'nicht gefunden' }, 404, cors);
    if(!cors['Access-Control-Allow-Origin']) return json({ fehler:'Origin nicht erlaubt' }, 403, cors);
    let body;
    try{ body = await req.json(); }catch(e){ return json({ fehler:'kein JSON' }, 400, cors); }
    try{
      const ergebnis = await checkout(body, env, ctx);
      return json(ergebnis, 200, cors);
    }catch(e){
      const status = e.status || 500;
      console.error('checkout', status, e.message, e.detail ? JSON.stringify(e.detail).slice(0,500) : '');
      return json({ fehler: e.message }, status, cors);
    }
  }
};

function corsHeaders(origin, env){
  const erlaubt = String(env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
  const h = { 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Max-Age':'86400', 'Vary':'Origin' };
  if(erlaubt.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function json(obj, status, headers){ return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type':'application/json; charset=utf-8', ...headers } }); }
function fehler(msg, status, detail){ const e = new Error(msg); e.status = status; e.detail = detail; return e; }

/* ── Daten: Matrix und Kurven aus demselben Commit wie das Skript ─────────── */
async function ladeDaten(body, env, ctx){
  let base = env.DATEN_BASE || '';
  if(!base){
    /* der Konfigurator schickt seine eigene Basis mit — nur der bekannte Pfad wird akzeptiert */
    const m = String(body.base || '').match(/^https:\/\/cdn\.jsdelivr\.net\/gh\/SaschaKesslerPro\/kessler-pro-scripts@([0-9a-f]{7,40})$/);
    base = m ? m[0] : `https://cdn.jsdelivr.net/gh/${REPO}@main`;
  }
  const hole = async (name) => {
    const u = `${base}/dist/data/${name}`;
    const cache = typeof caches !== 'undefined' ? caches.default : null;
    let r = cache ? await cache.match(u) : null;
    if(!r){ r = await fetch(u, { cf: { cacheTtl: 3600 } }); if(!r.ok) throw fehler('Preisdaten nicht erreichbar', 502, u);
      if(cache && ctx) ctx.waitUntil(cache.put(u, r.clone())); }
    return r.json();
  };
  const [matrix, kurven] = await Promise.all([hole('kfg-produktmatrix.json'), hole('kfg-preiskurven.json')]);
  const SHOP = {};
  for(const k in (matrix.produkte||{})){ const v = matrix.produkte[k];
    if(v.eur) SHOP[k] = [Math.round(v.eur*100)/100, String(v.variantId||'').split('/').pop(), v.sku, v.pln ? Math.round(v.pln*100)/100 : null]; }
  return { SHOP, KURVEN: kurven.kurven || {}, base };
}

/* ── Konfiguration pruefen und Preis nachrechnen ──────────────────────────── */
function pruefeKonfig(S){
  if(!S || typeof S !== 'object') throw fehler('Konfiguration fehlt', 400);
  if(!MATERIAL[S.mat]) throw fehler('Material unbekannt', 400);
  if(!['rect','round','lform'].includes(S.form)) throw fehler('Form unbekannt', 400);
  const num = (v,min,max)=>{ const n=+v; if(!isFinite(n)||n<min||n>max) throw fehler('Maß außerhalb des Bereichs', 400); return n; };
  if(S.form==='rect'){ S.L=num(S.L,20,300); S.B=num(S.B,20,200); }
  if(S.form==='round'){ S.D=num(S.D,20,160); }
  if(S.form==='lform'){ S.lf=S.lf||{}; S.lf.L=num(S.lf.L,20,300); S.lf.B=num(S.lf.B,20,200); S.lf.aw=num(S.lf.aw,1,S.lf.L-1); S.lf.ah=num(S.lf.ah,1,S.lf.B-1); }
  if(!Array.isArray(S.cuts)) S.cuts=[];
  if(S.cuts.length>20) throw fehler('zu viele Bearbeitungen', 400);
  S.extras = Object.assign({bohr:false,custom:false,lack:false}, S.extras||{});
  if(S.extras.custom) throw fehler('Eigene Skizze geht nur als Anfrage', 400);
  if(!Array.isArray(S.edges)||S.edges.length!==4) S.edges=['abs','abs','abs','abs'];
  if(!Array.isArray(S.cornerR)||S.cornerR.length!==4) S.cornerR=[0,0,0,0];
  if(!Array.isArray(S.lfR)||S.lfR.length!==5) S.lfR=[0,0,0,0,0];
  S.machine = String(S.machine||'').slice(0,120);
  return S;
}

export async function checkout(body, env, ctx){
  const S = pruefeKonfig(JSON.parse(JSON.stringify(body.konfig||null)));
  const kanal = body.kanal === 'pln' ? 'pln' : 'eur';
  const sprache = ['de','pl','en'].includes(body.sprache) ? body.sprache : 'de';
  const { SHOP, KURVEN, base } = await ladeDaten(body, env, ctx);
  const K = preisKern(S, SHOP, KURVEN, kanal==='pln' ? 'pl' : 'de');
  const c = K.calc();
  if(c.quelle==='offen' || !(c.total>0)) throw fehler('Für diese Konfiguration gibt es keinen festen Preis', 409, c);
  if(K.needsOffer()) throw fehler('Eigene Skizze geht nur als Anfrage', 409);
  const clientPreis = +body.preis;
  if(isFinite(clientPreis) && Math.abs(clientPreis - c.total) > 0.011)
    throw fehler(`Preis weicht ab: Konfigurator ${clientPreis}, Server ${c.total}`, 409, { server:c, client:clientPreis });
  const waehrung = kanal==='pln' ? 'PLN' : 'EUR';

  const titel = titelFuer(S, K, c);
  const attribute = attributeFuer(S, K, c, Object.assign({}, body, { __env: env }), waehrung);
  const gewicht = Math.max(1, Math.round(K.areaM2() * (+S.thick||25) * (DICHTE[S.mat]||0.0007) * 1000 * 10) / 10);   /* kg, 1 Nachkommastelle */
  const versand = versandZeile(S, K, gewicht, kanal, env);

  const input = {
    lineItems: [{
      title: titel,
      quantity: 1,
      originalUnitPriceWithCurrency: { amount: c.total.toFixed(2), currencyCode: waehrung },
      requiresShipping: true,
      taxable: true,
      weight: { unit: 'KILOGRAMS', value: gewicht },
      customAttributes: attribute,
    }],
    presentmentCurrencyCode: waehrung,
    shippingLine: versand,
    tags: ['konfigurator', `kfg-${body.version||'?'}`, `sprache-${sprache}`],
    note: `Konfigurator-Bestellung · ${body.url || ''}`,
    customAttributes: [
      { key:'_kfg_config_url', value: String(body.url||'').slice(0,2000) },
      { key:'_kfg_version', value: String(body.version||'') },
      { key:'_kfg_sprache', value: sprache },
      { key:'_kfg_daten', value: base },
    ],
    useCustomerDefaultAddress: false,
  };
  const draft = await draftOrderAnlegen(input, env);
  return { checkoutUrl: draft.invoiceUrl, draftOrderId: draft.id, preis: c.total, waehrung };
}

/* ── Titel und Attribute aus der Konfiguration (nicht aus dem Browser) ────── */
function titelFuer(S, K, c){
  const d = K.dims();
  const mass = S.form==='round' ? `Ø ${S.D} cm` : S.form==='lform' ? `L-Form ${S.lf.L} × ${S.lf.B} cm` : `${d.w} × ${d.h} cm`;
  const hit = K.shopHit();
  return `${hit ? 'Tischplatte' : 'Tischplatte nach Maß'} · ${MATERIAL[S.mat]}${S.mat==='mpx'&&S.mpxSurface==='hpl'?' + HPL':''} · ${c.dekorName} · ${c.thickName} · ${mass}`;
}
function attributeFuer(S, K, c, body, waehrung){
  const f = v => (''+(Math.round(v*10)/10)).replace('.',',');
  const d = K.dims(), a = [];
  const add = (k,v)=>{ if(v!==undefined && v!==null && String(v)!=='') a.push({ key:k, value:String(v).slice(0,250) }); };
  add('Material', MATERIAL[S.mat] + (S.mat==='mpx' ? (S.mpxSurface==='hpl' ? ' + HPL-Laminat' : ' · Birke natur') : ''));
  add('Dekor', c.dekorName);
  add('Stärke', c.thickName);
  if(S.form==='round') add('Form & Maß', `Rund Ø ${S.D} cm`);
  else if(S.form==='lform'){
    const g = K.lfGeo();
    add('Form & Maß', `L-Form ${S.lf.L} × ${S.lf.B} cm · Ausklinkung ${S.lf.aw} × ${S.lf.ah} cm ${LF_POS[S.lf.pos || (S.mat==='szwal'?'vr':'hr')]}${g.schraeg ? ` · schräg ${g.winkel}°` : ' · gerade'}`);
  } else add('Form & Maß', `${S.mat==='szwal'?'Nähtischplatte':'Rechteck'} ${d.w} × ${d.h} cm`);
  const kanten = S.form==='round' ? [S.edges[0]] : S.edges;
  const uniq = [...new Set(kanten)];
  add('Kante', (uniq.length===1 ? (KANTE_NAME[uniq[0]]||uniq[0]) : S.edges.map((e,i)=>'ABCD'[i]+': '+(KANTE_NAME[e]||e)).join(' · '))
    + (S.edges.includes('abs') && S.absColor && S.absColor!=='dekor' ? ` · ABS-Farbe ${S.absColor}` : '')
    + (S.extras.lack ? ' · lackiert' : ''));
  if(K.cornerCount()>0) add('Ecken', K.cornerLabel());
  if(S.mat==='szwal'){
    const st = K.massbandStrecke();
    add('Maßband', K.massbandName() + (st ? ` · ${st.len} cm · Nullpunkt ${S.massbandNull||'links'}` : ''));
    add('Nähmaschine', S.machine || '— nicht angegeben —');
    add('Maschinen-Ausschnitt', S.maschineMass==='auto' ? 'nach Maschine' : String(S.maschineMass||'').replace('x',' × ')+' cm');
  }
  if(S.extras.bohr) add('Montagebohrungen', '4× Ø8');
  S.cuts.forEach((cut, i) => {
    let lage = `Mitte x ${f(cut.cx)} / y ${f(cut.cy)} cm ab hinten links`;
    if(cut.t==='r' || cut.t==='c'){ const ab = K.cutAbstaende(cut);
      lage += ` · Abstände links ${f(ab.l)} · rechts ${f(ab.r)} · hinten ${f(ab.t)} · vorn ${f(ab.b)} cm`; }
    add(`Bearbeitung ${i+1}`, `${K.cutTypName(cut)} ${K.cutMass(cut)} · ${lage}`);
  });
  if(body && body.__env && body.__env.LIEFERZEIT) add('Lieferzeit', body.__env.LIEFERZEIT);
  add('Hinweis', 'Maßanfertigung nach Kundenspezifikation — vom Widerruf ausgenommen (§ 312g Abs. 2 Nr. 1 BGB)');
  const hit = K.shopHit();
  if(hit) add('_kfg_lager_sku', hit[2]);
  add('_kfg_preis', `${c.total.toFixed(2)} ${waehrung} = Platte ${c.basis.toFixed(2)} + Kante ${c.kante.toFixed(2)} + Ecken ${c.ecken.toFixed(2)} + Ausklinkung ${c.lschnitt.toFixed(2)} + Bearbeitung ${c.extras.toFixed(2)}`);
  /* Rohdaten in Stuecken — Shopify begrenzt Attributwerte auf 255 Zeichen */
  const roh = JSON.stringify({ mat:S.mat, dekor:S.dekor, thick:S.thick, form:S.form, L:S.L, B:S.B, D:S.D, lf:S.lf, edges:S.edges, cornerR:S.cornerR, lfR:S.lfR,
    absColor:S.absColor, lack:S.extras.lack, bohr:S.extras.bohr, massband:S.massband, massbandNull:S.massbandNull, maschineMass:S.maschineMass, cuts:S.cuts });
  for(let i=0, n=1; i<roh.length && n<=8; i+=240, n++) add(`_kfg_konfig_${n}`, roh.slice(i, i+240));
  return a;
}

/* ── Shopify Admin API ────────────────────────────────────────────────────── */
/* Admin-Token: fester shpat_-Token oder — Dev-Dashboard-App — Client-Credentials-
   Grant. Der geholte Token lebt 24 h und wird im Isolate zwischengespeichert. */
let _token = { wert:null, bis:0 };
async function adminToken(env){
  if(env.SHOPIFY_ADMIN_TOKEN) return env.SHOPIFY_ADMIN_TOKEN;
  if(!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) throw fehler('Shopify nicht konfiguriert', 503);
  if(_token.wert && Date.now() < _token.bis - 60000) return _token.wert;
  const r = await fetch(`https://${env.SHOPIFY_SHOP}/admin/oauth/access_token`, {
    method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type:'client_credentials', client_id: env.SHOPIFY_CLIENT_ID, client_secret: env.SHOPIFY_CLIENT_SECRET }) });
  const d = await r.json().catch(()=>null);
  if(!r.ok || !d || !d.access_token) throw fehler('Shopify-Anmeldung fehlgeschlagen', 502, d);
  if(d.scope && !/write_draft_orders/.test(d.scope)) throw fehler('App-Version ohne write_draft_orders', 503, d.scope);
  _token = { wert: d.access_token, bis: Date.now() + (d.expires_in||86399)*1000 };
  return _token.wert;
}
async function draftOrderAnlegen(input, env){
  if(!env.SHOPIFY_SHOP) throw fehler('Shopify nicht konfiguriert', 503);
  const token = await adminToken(env);
  const q = `mutation kfg($input: DraftOrderInput!){ draftOrderCreate(input:$input){ draftOrder{ id invoiceUrl totalPriceSet{ presentmentMoney{ amount currencyCode } } } userErrors{ field message } } }`;
  const r = await fetch(`https://${env.SHOPIFY_SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method:'POST', headers:{ 'Content-Type':'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query:q, variables:{ input } }) });
  const d = await r.json().catch(()=>null);
  if(!r.ok || !d || d.errors) throw fehler('Shopify antwortet nicht', 502, d && (d.errors||d));
  const res = d.data && d.data.draftOrderCreate;
  if(!res || (res.userErrors && res.userErrors.length)) throw fehler('Draft Order abgelehnt', 502, res && res.userErrors);
  if(!res.draftOrder || !res.draftOrder.invoiceUrl) throw fehler('keine Checkout-URL', 502, res);
  return res.draftOrder;
}
