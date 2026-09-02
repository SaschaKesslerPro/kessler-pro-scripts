/* Zeichnungs-Pipeline ohne Cloudflare, Shopify und Resend: KV und fetch werden
   nachgebaut. Prueft Webhook-HMAC, Dateien, Tags/Notiz, Mails, Freigabe,
   Aenderung, Auto-Freigabe und die Freigabe-Seite.
   Aufruf: cd worker/konfigurator-checkout && node test/zeichnungen.test.js */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import worker from '../src/index.js';
import { bestellungVerarbeiten, freigabeSetzen, autoFreigabeLauf, setSchriften, auftragLaden, TAG } from '../src/zeichnungen.js';
import { normBestellung, webhookHmacOk } from '../src/shopify.js';
import { freigabeSeite } from '../src/freigabe.js';

const hier = path.dirname(fileURLToPath(import.meta.url));
setSchriften({ regular: fs.readFileSync(path.join(hier, '../src/assets/DejaVuSans.ttf')), bold: fs.readFileSync(path.join(hier, '../src/assets/DejaVuSans-Bold.ttf')) });

let ok = 0; const bad = []; const check = (n, c, i) => { if (c) ok++; else bad.push(n + (i ? ' → ' + JSON.stringify(i).slice(0, 300) : '')); };

/* ── Nachbau: KV ── */
function kvMock(){
  const m = new Map(), meta = new Map();
  return {
    _m: m,
    async get(k, typ){ const v = m.get(k); if (v == null) return null; if (typ === 'json') return JSON.parse(v); if (typ === 'arrayBuffer') return v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : new TextEncoder().encode(v).buffer; return v; },
    async put(k, v, o){ m.set(k, v); meta.set(k, o); },
    async delete(k){ m.delete(k); meta.delete(k); },
    async list({ prefix, cursor }){ return { keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; },
  };
}
/* ── Nachbau: Shopify + Resend ── */
const gql = [], mails = [];
let orderNote = 'Konfigurator-Bestellung · https://www.kessler-pro.com/…';
const ORDER_GQL = { id:'gid://shopify/Order/8372871594330', name:'KP-2026-1034', email:'sobkow.alexander@gmail.com', createdAt:'2026-09-02T10:41:00Z', customerLocale:'de-DE', tags:['konfigurator'], note: orderNote, test:true,
  customer:{ firstName:'Alexander', lastName:'Sobkow', email:'sobkow.alexander@gmail.com' }, customAttributes:[{ key:'_kfg_sprache', value:'de' }],
  lineItems:{ nodes:[{ id:'gid://shopify/LineItem/20494488600922', title:'Tischplatte nach Maß · Möbelplatte · Eiche Sonoma · 25 mm · 40 × 40 cm', quantity:1, customAttributes:[
    { key:'Nähmaschine', value:'— nicht angegeben —' },
    { key:'_kfg_konfig_1', value:'{"mat":"dekor","dekor":"sonoma-eiche","thick":"25","form":"rect","L":40,"B":40,"D":"80","lf":{"L":180,"B":120,"aw":90,"ah":60,"pos":null,"schnitt":"gerade"},"edges":["abs","abs","abs","abs"],"cornerR":[0,0,30,30],"lfR":[0,0,0,0,0],"absColor":"schwarz","lack":false,' },
    { key:'_kfg_konfig_2', value:'"bohr":true,"massband":"none","massbandNull":"links","maschineMass":"52x18.1","cuts":[{"t":"c","cx":20,"cy":9,"d":8.5,"w":8.5,"h":8.5}]}' } ] }] } };
globalThis.fetch = async (u, opt) => {
  u = String(u);
  if (u.endsWith('/admin/oauth/access_token')) return new Response(JSON.stringify({ access_token:'shpca_test', scope:'write_draft_orders,read_orders,write_orders', expires_in:86399 }), { status:200 });
  if (u.includes('/admin/api/')) {
    const b = JSON.parse(opt.body); gql.push(b);
    const q = b.query;
    if (/order\(id:\$id\)\{ note/.test(q)) return new Response(JSON.stringify({ data:{ order:{ note: orderNote } } }));
    if (/orderUpdate/.test(q)) { orderNote = b.variables.input.note; return new Response(JSON.stringify({ data:{ orderUpdate:{ userErrors:[] } } })); }
    if (/tagsAdd/.test(q)) return new Response(JSON.stringify({ data:{ tagsAdd:{ userErrors:[] } } }));
    if (/tagsRemove/.test(q)) return new Response(JSON.stringify({ data:{ tagsRemove:{ userErrors:[] } } }));
    if (/order\(id:\$id\)/.test(q)) return new Response(JSON.stringify({ data:{ order: ORDER_GQL } }));
    if (/orders\(first:1, query:\$q\)/.test(q)) return new Response(JSON.stringify({ data:{ orders:{ nodes:[ORDER_GQL] } } }));
    if (/webhookSubscriptions/.test(q)) return new Response(JSON.stringify({ data:{ webhookSubscriptions:{ nodes:[] } } }));
    throw new Error('unerwartete GraphQL ' + q.slice(0, 60));
  }
  if (u === 'https://api.resend.com/emails') { const b = JSON.parse(opt.body); mails.push(b); return new Response(JSON.stringify({ id:'m_' + mails.length }), { status:200 }); }
  throw new Error('unerwarteter fetch ' + u);
};
const env = { SHOPIFY_SHOP:'hyf2zr-7x.myshopify.com', SHOPIFY_CLIENT_ID:'cid', SHOPIFY_CLIENT_SECRET:'geheim', ALLOWED_ORIGINS:'https://www.kessler-pro.com', PUBLIC_URL:'https://kfg.example.workers.dev',
  SHOP_MAIL:'shop@kessler-pro.com', MAIL_VON:'Kessler PRO <zeichnung@kessler-pro.com>', RESEND_API_KEY:'re_test', SETUP_KEY:'s3tup', FREIGABE_STUNDEN:'72', ZEICHNUNGEN: kvMock() };

/* ① Webhook-Payload (REST) wie von Shopify */
const restOrder = { id: 8372871594330, admin_graphql_api_id:'gid://shopify/Order/8372871594330', name:'KP-2026-1034', email:'sobkow.alexander@gmail.com', created_at:'2026-09-02T12:41:00+02:00', customer_locale:'de-DE', tags:'konfigurator, kfg-1.17.1', note: orderNote, test:true,
  customer:{ first_name:'Alexander', last_name:'Sobkow' }, note_attributes:[{ name:'_kfg_sprache', value:'de' }],
  line_items:[{ id: 20494488600922, admin_graphql_api_id:'gid://shopify/LineItem/20494488600922', title: ORDER_GQL.lineItems.nodes[0].title, quantity:1, properties: ORDER_GQL.lineItems.nodes[0].customAttributes.map(a => ({ name:a.key, value:a.value })) }] };
const roh = new TextEncoder().encode(JSON.stringify(restOrder));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('geheim'), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
const hmac = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, roh))));
check('HMAC korrekt → ok', await webhookHmacOk(env, roh, hmac));
check('HMAC falsch → abgelehnt', !(await webhookHmacOk(env, roh, hmac.slice(0, -2) + 'AA')));
const ctxWait = []; const ctx = { waitUntil: (p) => ctxWait.push(p) };
let r = await worker.fetch(new Request('https://x/webhook/orders', { method:'POST', body: roh, headers:{ 'X-Shopify-Hmac-Sha256': hmac, 'X-Shopify-Topic':'orders/paid' } }), env, ctx);
check('Webhook antwortet 200 sofort', r.status === 200 && (await r.json()).angenommen === 'KP-2026-1034');
await Promise.all(ctxWait);
r = await worker.fetch(new Request('https://x/webhook/orders', { method:'POST', body: roh, headers:{ 'X-Shopify-Hmac-Sha256': 'falsch' } }), env, ctx);
check('Webhook ohne gueltigen HMAC → 401', r.status === 401);

/* ② Ergebnis im KV */
const a = await auftragLaden(env, '8372871594330');
check('Auftrag angelegt, Status offen, 1 Position', a && a.status === 'offen' && a.positionen.length === 1 && a.token.length >= 20, a && { status:a.status, n:a.positionen.length });
const d = a.positionen[0].dateien;
check('Dateinamen', d.kunde_pdf === 'KP-2026-1034-P1-zeichnung.pdf' && d.werkstatt_pdf === 'KP-2026-1034-P1-werkstatt.pdf' && d.dxf === 'KP-2026-1034-P1-teil.dxf', d);
const pdf = await env.ZEICHNUNGEN.get(`datei:8372871594330:${d.kunde_pdf}`, 'arrayBuffer');
check('Kunden-PDF im KV, echtes PDF', pdf && new TextDecoder().decode(new Uint8Array(pdf).slice(0, 5)) === '%PDF-', pdf && pdf.byteLength);
const dxfTxt = new TextDecoder().decode(await env.ZEICHNUNGEN.get(`datei:8372871594330:${d.dxf}`, 'arrayBuffer'));
check('DXF mit Aussenkontur, Bohrungen, Innenkreis', /AUSSEN/.test(dxfTxt) && (dxfTxt.match(/BOHRUNG/g) || []).length >= 4 && /INNEN/.test(dxfTxt), dxfTxt.length);
check('Frist ≈ 72 h', Math.abs(new Date(a.frist) - new Date(a.angelegt) - 72 * 3600e3) < 5000, [a.angelegt, a.frist]);
check('Shopify: Tag zeichnung-offen + Notiz mit Link', gql.some(g => /tagsAdd/.test(g.query) && g.variables.tags.includes(TAG.offen)) && /Freigabe des Kunden offen bis .* https:\/\/kfg\.example\.workers\.dev\/freigabe\//.test(orderNote), orderNote);
check('Mail intern an shop@ mit 3 Anhaengen + Testhinweis', mails[0] && mails[0].to[0] === 'shop@kessler-pro.com' && mails[0].attachments.length === 3 && /TESTBESTELLUNG/.test(mails[0].html) && /werkstatt\.pdf/.test(mails[0].attachments[1].filename), mails[0] && { to: mails[0].to, n: mails[0].attachments.length });
check('Mail Kunde mit Zeichnung, Bestaetigen-Link, 72-h-Hinweis', mails[1] && mails[1].to[0] === 'sobkow.alexander@gmail.com' && mails[1].attachments.length === 1 && /\/freigabe\/[A-Za-z0-9_-]+"/.test(mails[1].html) && /72-Stunden/.test(mails[1].html) && /Hallo Alexander/.test(mails[1].html), mails[1] && mails[1].subject);

/* ③ Zweiter Webhook (Wiederholung) aendert nichts */
const nMails = mails.length;
const a2 = await bestellungVerarbeiten(normBestellung(restOrder), env);
check('Wiederholung idempotent', a2.unveraendert && mails.length === nMails);

/* ④ Freigabe-Seite und Datei-Auslieferung */
r = await worker.fetch(new Request(`https://x/freigabe/${a.token}`), env, ctx);
let html = await r.text();
check('Freigabe-Seite: SVG eingebettet, Buttons, Frist', r.status === 200 && /<svg/.test(html) && /Maße bestätigen/.test(html) && /Änderung melden/.test(html) && /72-Stunden/.test(html));
r = await worker.fetch(new Request(`https://x/z/${a.token}/${d.kunde_pdf}`), env, ctx);
check('PDF-Auslieferung inline', r.status === 200 && r.headers.get('Content-Type') === 'application/pdf' && /inline/.test(r.headers.get('Content-Disposition')));
r = await worker.fetch(new Request(`https://x/z/${a.token}/../etc/passwd`), env, ctx);
check('Fremde Datei → 404', r.status === 404);
r = await worker.fetch(new Request(`https://x/z/falschertoken12345/${d.kunde_pdf}`), env, ctx);
check('Falscher Token → 404', r.status === 404);
r = await worker.fetch(new Request(`https://x/freigabe/${a.token}?a=aenderung`), env, ctx);
html = await r.text();
check('Aenderungsformular', /<textarea name="text"/.test(html));

/* ⑤ Kunde bestaetigt */
const fd = new FormData(); fd.set('a', 'ok'); fd.set('name', 'Alexander Sobkow');
r = await worker.fetch(new Request(`https://x/freigabe/${a.token}`, { method:'POST', body: fd }), env, ctx);
html = await r.text();
const a3 = await auftragLaden(env, a.token);
check('Freigabe gesetzt', a3.status === 'freigegeben' && a3.freigabe.name === 'Alexander Sobkow' && /Danke — die Maße sind bestätigt/.test(html), a3.freigabe);
check('Tags: freigegeben gesetzt, offen entfernt', gql.some(g => /tagsAdd/.test(g.query) && g.variables.tags.includes(TAG.frei)) && gql.some(g => /tagsRemove/.test(g.query) && g.variables.tags.includes(TAG.offen)));
check('Notiz ergaenzt', /vom Kunden bestätigt/.test(orderNote), orderNote);
const svgNeu = new TextDecoder().decode(await env.ZEICHNUNGEN.get(`datei:8372871594330:${d.svg}`, 'arrayBuffer'));
check('Zeichnung neu mit Freigabestand', /Alexander Sobkow · /.test(svgNeu) && /Fertigungsgrundlage/.test(svgNeu));
check('Mails: intern + Kunde (Bestaetigung mit PDF)', mails.length === nMails + 2 && /BESTÄTIGT/.test(mails[nMails].html) && mails[nMails + 1].attachments.length === 1, mails.slice(nMails).map(m => m.subject));
r = await worker.fetch(new Request(`https://x/freigabe/${a.token}`, { method:'POST', body: fd }), env, ctx);
check('Zweite Bestaetigung aendert nichts', (await auftragLaden(env, a.token)).freigabe.iso === a3.freigabe.iso);

/* ⑥ Aenderung bei einem zweiten Auftrag + Auto-Freigabe bei einem dritten */
const rest2 = JSON.parse(JSON.stringify(restOrder)); rest2.id = 9000000000001; rest2.admin_graphql_api_id = 'gid://shopify/Order/9000000000001'; rest2.name = 'KP-2026-1035';
const b2 = await bestellungVerarbeiten(normBestellung(rest2), env);
const fd2 = new FormData(); fd2.set('a', 'aenderung'); fd2.set('name', 'A. S.'); fd2.set('text', 'Bitte Bohrungen 70 mm vom Rand');
r = await worker.fetch(new Request(`https://x/freigabe/${b2.token}`, { method:'POST', body: fd2 }), env, ctx);
const b2n = await auftragLaden(env, b2.token);
check('Aenderung: Status, Text, Tag, Mail intern mit ÄNDERUNG', b2n.status === 'aenderung' && /70 mm/.test(b2n.aenderung.text) && gql.some(g => /tagsAdd/.test(g.query) && g.variables.tags.includes(TAG.aenderung)) && mails.some(m => /ÄNDERUNG KP-2026-1035/.test(m.subject) && /70 mm/.test(m.html)), b2n.aenderung);
const rest3 = JSON.parse(JSON.stringify(restOrder)); rest3.id = 9000000000002; rest3.admin_graphql_api_id = 'gid://shopify/Order/9000000000002'; rest3.name = 'KP-2026-1036'; rest3.email = '';
const b3 = await bestellungVerarbeiten(normBestellung(rest3), env);
b3.frist = new Date(Date.now() - 3600e3).toISOString(); await env.ZEICHNUNGEN.put(`auftrag:${b3.nummer}`, JSON.stringify(b3));
const lauf = await autoFreigabeLauf(env);
const b3n = await auftragLaden(env, b3.token);
check('Auto-Freigabe nach Frist', lauf.freigegeben.includes('KP-2026-1036') && b3n.status === 'auto' && b3n.freigabe.auto && gql.some(g => /tagsAdd/.test(g.query) && g.variables.tags.includes(TAG.auto)), lauf);
check('Auto-Freigabe: nur der ueberfaellige', !lauf.freigegeben.includes('KP-2026-1034') && !lauf.freigegeben.includes('KP-2026-1035'), lauf);

/* ⑦ geschuetzte Routen */
r = await worker.fetch(new Request('https://x/auftrag?order=8372871594330'), env, ctx);
check('/auftrag ohne key → 403', r.status === 403);
r = await worker.fetch(new Request('https://x/auftrag?key=s3tup&order=8372871594330'), env, ctx);
check('/auftrag mit key', r.status === 200 && (await r.json()).name === 'KP-2026-1034');
r = await worker.fetch(new Request('https://x/nachlauf?key=s3tup&order=KP-2026-1034&erneut=1', { method:'POST' }), env, ctx);
check('/nachlauf erneut → Auftrag neu (Status offen)', r.status === 200 && (await r.json()).status === 'offen');
check('Freigabe-Seite ohne Auftrag', /ungültig/.test(freigabeSeite(null, [], { sprache:'de', base:'' })));

/* Sichtprobe */
fs.mkdirSync('/tmp/zprobe', { recursive:true });
fs.writeFileSync('/tmp/zprobe/freigabe_seite.html', html);
fs.writeFileSync('/tmp/zprobe/mail_kunde.html', mails[1].html);
fs.writeFileSync('/tmp/zprobe/mail_intern.html', mails[0].html);

console.log(`${ok} gruen, ${bad.length} rot`); bad.forEach(b => console.log('  ✗', b));
process.exit(bad.length ? 1 : 0);
