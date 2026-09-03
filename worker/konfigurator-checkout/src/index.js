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

   Seit 02.09.2026 ausserdem die Zeichnungs-Pipeline (src/zeichnungen.js):
     POST /webhook/orders          Shopify orders/paid -> Zeichnungen (Kunde, Werkstatt PL, DXF),
                                   Ablage in KV, Tag + Notiz in Shopify, Mail an shop@ und Kunde
     GET  /z/<token>/<datei>       Datei ausliefern (PDF/DXF/SVG; …-zeichnung.png wird aus dem SVG gerendert)
     GET|POST /freigabe/<token>    Kunde bestaetigt die Masse oder meldet eine Aenderung
     POST /setup/webhooks?key=     Webhook-Abo in Shopify anlegen (key = SETUP_KEY)
     POST /nachlauf?key=&order=    Bestehende Bestellung (Nummer/Name) durch die Pipeline schicken
     GET  /mailtest?key=[&an=]     Testmail ueber den konfigurierten Weg (SMTP/Resend)
     GET  /auftrag?key=&order=     Status eines Auftrags aus KV
     scheduled (stuendlich)        72-h-Auto-Freigabe

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
     PUBLIC_URL               oeffentliche Basis-URL des Workers (fuer Links in Mails)
     SHOP_MAIL                interne Empfaengeradresse (shop@kessler-pro.com)
     MAIL_VON                 Absender, Domain muss bei Resend verifiziert sein
     SMTP_HOST/PORT/USER      Shop-Postfach (Google Workspace: smtp.gmail.com, 587), SMTP_PASS = App-Passwort (Secret)
     RESEND_API_KEY           Alternative zu SMTP (Secret)
     SETUP_KEY                Secret — schuetzt /setup, /nachlauf, /auftrag
     FREIGABE_STUNDEN         Frist fuer die automatische Freigabe (72)
     ZEICHNUNGEN              KV-Namespace (Bindung)
*/
import { preisKern } from './preis-kern.js';
/* Preisdaten fest im Bundle — dieselben Dateien wie das Skript aus demselben Commit.
   Vorher holte der Worker sie von einer vom Browser benannten jsDelivr-Adresse
   (irgendein Commit des Repos): damit haette ein Aufrufer alte, guenstigere Kurven
   waehlen koennen (Sicherheitscheck 03.09.). */
import PRODUKTMATRIX from '../../../dist/data/kfg-produktmatrix.json' with { type: 'json' };
import PREISKURVEN from '../../../dist/data/kfg-preiskurven.json' with { type: 'json' };
import * as SH from './shopify.js';
import { adminToken, draftOrderAnlegen, fehler, API_VERSION } from './shopify.js';
import { bestellungVerarbeiten, auftragLaden, dateiLaden, freigabeSetzen, autoFreigabeLauf, urlsFuer, TYP, zufallToken, tokenStatus } from './zeichnungen.js';
import { freigabeSeite } from './freigabe.js';
import { fristText, sendeMail } from './mail.js';

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
/* Versand fuer Massanfertigungen: Pauschale (Sascha 03.09.: 19,99 EUR). Lagerartikel
   laufen nicht hier, sondern als Cart-Permalink mit Shopifys eigenen Versandregeln.
   PLN-Betrag vorlaeufig (≈ 19,99 EUR), von Sascha zu bestaetigen. Ueberschreibbar
   per Variable VERSAND, z. B. {"pauschal":{"eur":19.99,"pln":84.90}}. Der Konfigurator
   zeigt denselben Betrag (VERSAND_MASS) unter dem Preis. */
const VERSAND_STANDARD = {
  pauschal: { eur: 19.99, pln: 84.90 },
  titel: { eur: 'Versand Maßanfertigung (pauschal)', pln: 'Dostawa produktu na wymiar (ryczałt)' },
};
function versandZeile(S, K, gewichtKg, kanal, env){
  let V = VERSAND_STANDARD;
  if(env && env.VERSAND){ try{ const o = JSON.parse(env.VERSAND); V = { pauschal: Object.assign({}, VERSAND_STANDARD.pauschal, o.pauschal||{}), titel: Object.assign({}, VERSAND_STANDARD.titel, o.titel||{}) }; }catch(e){} }
  const betrag = V.pauschal[kanal] ?? V.pauschal.eur;
  return { title: V.titel[kanal] || V.titel.eur, price: (+betrag).toFixed(2) };
}

export default {
  async fetch(req, env, ctx){
    const origin = req.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if(req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    const pfad = url.pathname;
    try{
      if(req.method === 'GET' && pfad === '/health'){
        let shopify = 'nicht geprueft';
        if(url.searchParams.get('shopify')==='1'){ try{ await adminToken(env); shopify = 'ok · ' + SH.tokenScope(); }catch(e){ shopify = e.message + (e.detail?': '+JSON.stringify(e.detail).slice(0,200):''); } }
        return json({ ok:true, version: API_VERSION, shopify, kv: !!env.ZEICHNUNGEN, mail: env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS ? `smtp ${env.SMTP_HOST}` : env.RESEND_API_KEY ? 'resend' : 'keiner', publicUrl: env.PUBLIC_URL||'' }, 200, cors);
      }
      if(req.method === 'POST' && pfad === '/checkout'){
        if(!cors['Access-Control-Allow-Origin']) return json({ fehler:'Origin nicht erlaubt' }, 403, cors);
        if(!(await rateOk(req, env, 'checkout', 12))) return json({ fehler:'Zu viele Anfragen — bitte kurz warten' }, 429, cors);
        let body;
        try{ body = await req.json(); }catch(e){ return json({ fehler:'kein JSON' }, 400, cors); }
        return json(await checkout(body, env, ctx), 200, cors);
      }
      if(req.method === 'POST' && pfad === '/webhook/orders') return webhookOrders(req, env, ctx);
      let m;
      if(req.method === 'GET' && (m = pfad.match(/^\/z\/([A-Za-z0-9_-]{10,})\/([A-Za-z0-9._-]+)$/))) return datei(env, m[1], m[2]);
      if((m = pfad.match(/^\/freigabe\/([A-Za-z0-9_-]{10,})$/))) return freigabe(req, env, m[1], url);
      if(pfad === '/setup/webhooks' || pfad === '/nachlauf' || pfad === '/auftrag' || pfad === '/cron' || pfad === '/mailtest'){
        if(!env.SETUP_KEY || url.searchParams.get('key') !== env.SETUP_KEY) return json({ fehler:'kein Zugriff' }, 403);
        if(pfad === '/setup/webhooks'){
          const ziel = `${String(env.PUBLIC_URL||'').replace(/\/$/,'')}/webhook/orders`;
          const r = await SH.webhookAnlegen(env, 'ORDERS_PAID', ziel);
          return json({ ok:true, ...r, alle: await SH.webhooksAuflisten(env) });
        }
        if(pfad === '/nachlauf'){
          const best = await SH.bestellungHolen(env, url.searchParams.get('order')||'');
          if(!best) return json({ fehler:'Bestellung nicht gefunden' }, 404);
          const a = await bestellungVerarbeiten(best, env, { erneut: url.searchParams.get('erneut')==='1' });
          return json(a);
        }
        if(pfad === '/auftrag') return json((await auftragLaden(env, url.searchParams.get('order')||'')) || { fehler:'kein Auftrag' });
        if(pfad === '/cron') return json(await autoFreigabeLauf(env));
        if(pfad === '/mailtest'){
          const an = url.searchParams.get('an') || env.SHOP_MAIL || 'shop@kessler-pro.com';
          const r = await sendeMail(env, { an, betreff: 'Kessler PRO · Testmail aus dem Konfigurator-Worker', html: '<p>Der Mailversand aus dem Worker funktioniert.</p><p>Weg: ' + (env.SMTP_HOST && env.SMTP_PASS ? 'SMTP ' + env.SMTP_HOST : env.RESEND_API_KEY ? 'Resend' : 'keiner') + '</p>', anhaenge: [{ name:'test.txt', daten: new TextEncoder().encode('Kessler PRO Testanhang') }] });
          return json({ an, ...r });
        }
      }
      return json({ fehler:'nicht gefunden' }, 404, cors);
    }catch(e){
      const status = e.status || 500;
      console.error('worker', pfad, status, e.message, e.detail ? JSON.stringify(e.detail).slice(0,500) : '');
      const intern = env.SETUP_KEY && url.searchParams.get('key') === env.SETUP_KEY;   /* Details nur fuer uns */
      return json(intern ? { fehler: e.message, detail: e.detail } : { fehler: e.message }, status, cors);
    }
  },
  async scheduled(ev, env, ctx){ ctx.waitUntil(autoFreigabeLauf(env).then(r => console.log('auto-freigabe', JSON.stringify(r)))); }
};

/* ── Webhook: bezahlte Bestellung ─────────────────────────────────────────── */
async function webhookOrders(req, env, ctx){
  const roh = await req.arrayBuffer();
  const ok = await SH.webhookHmacOk(env, roh, req.headers.get('X-Shopify-Hmac-Sha256'));
  if(!ok) return json({ fehler:'HMAC ungueltig' }, 401);
  let order;
  try{ order = JSON.parse(new TextDecoder().decode(roh)); }catch(e){ return json({ fehler:'kein JSON' }, 400); }
  const topic = req.headers.get('X-Shopify-Topic') || '';
  const best = SH.normBestellung(order);
  const hatKonfig = best.positionen.some(p => p.attribute.some(a => a.key === '_kfg_konfig_1'));
  if(!hatKonfig) return json({ ok:true, uebersprungen:'keine Konfigurator-Position', topic });
  // schnell antworten, Arbeit im Hintergrund — Shopify wartet nur 5 s
  ctx.waitUntil(bestellungVerarbeiten(best, env).then(a => console.log('zeichnungen', best.name, a.status||a.grund, (a.protokoll||[]).join(' | '))).catch(e => console.error('zeichnungen', best.name, e.message)));
  return json({ ok:true, angenommen: best.name, topic });
}

/* ── Dateien und Freigabe ─────────────────────────────────────────────────── */
function sprachAusHeader(req){
  const h = (req.headers.get('Accept-Language')||'').toLowerCase();
  return h.startsWith('pl') ? 'pl' : h.startsWith('en') ? 'en' : 'de';
}
async function datei(env, token, name){
  const a = await auftragLaden(env, token);
  if(!a) return new Response('nicht gefunden', { status:404 });
  const d = await dateiLaden(env, a, name);
  if(!d) return new Response('nicht gefunden', { status:404 });
  const ext = name.split('.').pop();
  return new Response(d, { headers:{ 'Content-Type': TYP[ext] || 'application/octet-stream', 'Content-Disposition': `${ext==='dxf' ? 'attachment' : 'inline'}; filename="${name}"`, 'Cache-Control': ext === 'png' ? 'public, max-age=86400' : 'private, max-age=300', 'X-Robots-Tag':'noindex' } });
}
async function freigabe(req, env, token, url){
  const a = await auftragLaden(env, token);
  const base = String(env.PUBLIC_URL||'').replace(/\/$/,'');
  const seite = (auftrag, opt) => new Response(freigabeSeite(auftrag, opt.svgs||[], { ...opt, base }), { headers:{ 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'X-Robots-Tag':'noindex' } });
  if(!a){
    const st = await tokenStatus(env, token);
    const spr = ['de','pl','en'].includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : sprachAusHeader(req);
    return seite(null, { sprache: spr, wartet: st === 'draft' });
  }
  const svgs = [];
  for(const p of a.positionen){ const d = await dateiLaden(env, a, p.dateien.svg); svgs.push(d ? new TextDecoder().decode(d) : ''); }
  if(req.method === 'POST'){
    const f = await req.formData().catch(()=>null);
    const akt = f && f.get('a');
    if(a.status !== 'offen' || !['ok','aenderung'].includes(akt)) return seite(a, { svgs, fristText: fristText(a.frist, a.sprache) });
    const neu = await freigabeSetzen(env, a, akt, { name: f.get('name')||'', text: f.get('text')||'' });
    return seite(neu, { svgs, gerade: akt });
  }
  return seite(a, { svgs, a: url.searchParams.get('a')||'', fristText: fristText(a.frist, a.sprache) });
}

/* Grobe Bremse je IP und Minute ueber KV (eventual consistent — reicht gegen
   Skripte, die Draft Orders im Sekundentakt anlegen). Ohne KV: durchlassen. */
async function rateOk(req, env, was, limit){
  const KV = env.ZEICHNUNGEN; if(!KV) return true;
  const ip = req.headers.get('CF-Connecting-IP') || 'x';
  const key = `rl:${was}:${ip}:${Math.floor(Date.now()/60000)}`;
  const n = +(await KV.get(key)) || 0;
  if(n >= limit) return false;
  await KV.put(key, String(n+1), { expirationTtl: 120 });
  return true;
}
function corsHeaders(origin, env){
  const erlaubt = String(env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
  const h = { 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Max-Age':'86400', 'Vary':'Origin' };
  if(erlaubt.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function json(obj, status, headers){ return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type':'application/json; charset=utf-8', ...headers } }); }

/* ── Daten: Matrix und Kurven aus demselben Commit wie das Skript ─────────── */
let _daten = null;
async function ladeDaten(body, env, ctx){
  if(_daten) return _daten;
  const matrix = PRODUKTMATRIX, kurven = PREISKURVEN;
  const SHOP = {};
  for(const k in (matrix.produkte||{})){ const v = matrix.produkte[k];
    if(v.eur) SHOP[k] = [Math.round(v.eur*100)/100, String(v.variantId||'').split('/').pop(), v.sku, v.pln ? Math.round(v.pln*100)/100 : null]; }
  const stand = (matrix._meta && (matrix._meta.stand || matrix._meta.erzeugt)) || '';
  _daten = { SHOP, KURVEN: kurven.kurven || {}, base: `bundle ${API_VERSION}${stand ? ' · ' + stand : ''}` };
  return _daten;
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
  if(S.form==='lform'){ S.lf.sb = S.lf.sb == null ? 0 : num(S.lf.sb, 0, Math.max(0, S.lf.ah-1)); S.lf.schnitt = S.lf.schnitt==='schraeg' ? 'schraeg' : 'gerade'; if(S.lf.pos!=null && !['hr','hl','vr','vl'].includes(S.lf.pos)) S.lf.pos=null; }
  /* Bearbeitungen: nur bekannte Typen und Vorlagen, alle Zahlen endlich, nicht negativ,
     im Plattenmass — sonst liessen sich ueber negative Masse Preise druecken. */
  if(!Array.isArray(S.cuts)) S.cuts=[];
  if(S.cuts.length>20) throw fehler('zu viele Bearbeitungen', 400);
  const PRESET_OK = ['kabel','kabel80','armatur','usb','spuele','induktion','maschine'];
  const z = (v, max=400) => { const x=+v; if(!isFinite(x)||x<0||x>max) throw fehler('Bearbeitung außerhalb des Bereichs', 400); return x; };
  S.cuts = S.cuts.map(c => {
    if(!c || typeof c!=='object' || !['r','c','p','k'].includes(c.t)) throw fehler('Bearbeitung unbekannt', 400);
    const o = { t:c.t, cx:z(c.cx), cy:z(c.cy) };
    if(c.preset!=null){ if(!PRESET_OK.includes(c.preset)) throw fehler('Vorlage unbekannt', 400); o.preset=c.preset; }
    if(c.t==='c'){ o.d=z(c.d); o.w=o.h=o.d; }
    else if(c.t==='r'){ o.w=z(c.w); o.h=z(c.h); if(c.r!=null) o.r=z(c.r,100); }
    else if(c.t==='p'){ if(!Array.isArray(c.pts)||c.pts.length<3||c.pts.length>60) throw fehler('Kontur ungültig', 400);
      o.pts=c.pts.map(pt=>{ if(!Array.isArray(pt)||pt.length<2) throw fehler('Kontur ungültig', 400); const a=+pt[0], b=+pt[1]; if(!isFinite(a)||!isFinite(b)||Math.abs(a)>400||Math.abs(b)>400) throw fehler('Kontur ungültig', 400); return [a,b]; });
      if(c.r!=null) o.r=z(c.r,100); if(c.w!=null) o.w=z(c.w); if(c.h!=null) o.h=z(c.h); }
    else { o.w=z(c.w,300); o.dp=z(c.dp,40); o.len=z(c.len); o.dir=c.dir==='quer'?'quer':'laengs'; o.seite=c.seite==='oben'?'oben':'unten'; o.enden=['zu','offen','links','rechts'].includes(c.enden)?c.enden:'zu'; }
    return o;
  });
  S.extras = Object.assign({bohr:false,custom:false,lack:false}, S.extras||{});
  S.extras.bohr=!!S.extras.bohr; S.extras.lack=!!S.extras.lack;
  if(S.extras.custom) throw fehler('Eigene Skizze geht nur als Anfrage', 400);
  const EDGE_OK = ['abs','nicht','f45','fase','halbrund','roh','rund'];
  if(!Array.isArray(S.edges)||S.edges.length!==4||!S.edges.every(e=>EDGE_OK.includes(e))) S.edges=['abs','abs','abs','abs'];
  const rad = (a,n) => Array.isArray(a)&&a.length===n ? a.map(v=>{ const x=Math.round(+v||0); return isFinite(x)&&x>=0&&x<=300 ? x : 0; }) : new Array(n).fill(0);
  S.cornerR = rad(S.cornerR,4); S.lfR = rad(S.lfR,5);
  S.edgeR = [3,6,9].includes(+S.edgeR) ? +S.edgeR : 3;
  S.mpxSurface = S.mpxSurface==='hpl' ? 'hpl' : 'natur';
  S.absColor = String(S.absColor||'dekor').slice(0,20);
  S.dekor = String(S.dekor||'').slice(0,40); S.thick = String(S.thick||'').slice(0,4);
  if(!['none','laser','sticker'].includes(S.massband)) S.massband='none';
  S.massbandNull = S.massbandNull==='rechts' ? 'rechts' : 'links';
  if(!['48x18.1','52x18.1','61.7x18.1','auto'].includes(S.maschineMass)) S.maschineMass='52x18.1';
  S.machine = String(S.machine||'').replace(/[\r\n]+/g,' ').slice(0,120);
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

  /* Freigabe-Link schon jetzt festlegen: er steht als sichtbare Zeile an der Position
     und damit in Shopifys eigener Bestellbestaetigung — auch ohne unsere Mail. */
  const token = zufallToken();
  const freigabeUrl = env.PUBLIC_URL ? `${String(env.PUBLIC_URL).replace(/\/$/,'')}/freigabe/${token}` : '';
  const titel = titelFuer(S, K, c);
  const attribute = attributeFuer(S, K, c, Object.assign({}, body, { __env: env, __freigabeUrl: freigabeUrl }), waehrung);
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
    tags: ['konfigurator', `kfg-${versionSauber(body.version)}`, `sprache-${sprache}`],
    note: `Konfigurator-Bestellung · ${konfigUrl(body.url)}`,
    customAttributes: [
      { key:'_kfg_config_url', value: konfigUrl(body.url) },
      { key:'_kfg_version', value: versionSauber(body.version) },
      { key:'_kfg_sprache', value: sprache },
      { key:'_kfg_daten', value: base },
      ...(freigabeUrl ? [{ key:'_kfg_token', value: token }] : []),
    ],
    useCustomerDefaultAddress: false,
  };
  const draft = await draftOrderAnlegen(input, env);
  /* Merker, damit /freigabe/<token> vor der Zahlung "wird erstellt" zeigt statt "ungueltig" */
  if(freigabeUrl && env.ZEICHNUNGEN){
    const merk = env.ZEICHNUNGEN.put(`token:${token}`, `draft:${draft.id}`, { expirationTtl: 30*86400 }).catch(()=>{});
    if(ctx && ctx.waitUntil) ctx.waitUntil(merk); else await merk;
  }
  return { checkoutUrl: draft.invoiceUrl, draftOrderId: draft.id, preis: c.total, waehrung };
}

/* Nur Links auf die eigenen Seiten landen in Notiz und Attributen — der Browser
   koennte sonst beliebige Adressen in den Shopify-Auftrag schreiben. */
function konfigUrl(u){
  try{ const x = new URL(String(u||'')); if(x.protocol==='https:' && /^(www\.)?kessler-pro\.com$|^kessler-pro-com\.webflow\.io$/.test(x.hostname)) return x.href.slice(0,2000); }catch(e){}
  return '';
}
function versionSauber(v){ return String(v||'?').replace(/[^0-9A-Za-z.\-]/g,'').slice(0,20) || '?'; }

const ABLAUF_TEXT = {
  de: 'Nach dem Zahlungseingang bekommst du per E-Mail die technische Zeichnung deiner Platte. Bitte prüfe die Maße und bestätige sie über den Link — ohne Rückmeldung gilt die Zeichnung nach 72 Stunden als freigegeben, dann fertigen wir.',
  pl: 'Po zaksięgowaniu płatności otrzymasz e-mailem rysunek techniczny blatu. Sprawdź wymiary i potwierdź je linkiem — bez odpowiedzi rysunek uznajemy po 72 godzinach za zatwierdzony i rozpoczynamy produkcję.',
  en: 'After payment you receive the technical drawing of your top by e-mail. Please check the dimensions and confirm via the link — without a reply the drawing is deemed released after 72 hours and we start production.',
};

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
    add('Form & Maß', `L-Form ${S.lf.L} × ${S.lf.B} cm · Ausklinkung ${S.lf.aw} × ${S.lf.ah} cm ${LF_POS[S.lf.pos || 'vr']}${g.schraeg ? ` · schräg ${g.winkel}°${g.sb > 0 ? ` · Punkt B ${g.sb} cm von der Kante` : ''}` : ' · gerade'}`);
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
  /* Sichtbar fuer den Kunden (Bestellbestaetigung, Bestellstatus): der Zeichnungs-
     und Freigabeschritt, den die Pipeline nach der Zahlung anstoesst. */
  const spr = body && ['de','pl','en'].includes(body.sprache) ? body.sprache : 'de';
  add('Ablauf', ABLAUF_TEXT[spr]);
  if(body && body.__freigabeUrl) add({ de:'Zeichnung prüfen', pl:'Sprawdź rysunek', en:'Check the drawing' }[spr], body.__freigabeUrl);
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
