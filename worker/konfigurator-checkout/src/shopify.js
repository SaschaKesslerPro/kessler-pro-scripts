/* Shopify Admin API — Anmeldung, GraphQL, Draft Orders, Bestellungen, Webhooks.
   Alles, was mit dem Shop spricht, steht hier; index.js kennt nur die Routen. */

export const API_VERSION = '2024-10';

export function fehler(msg, status, detail){ const e = new Error(msg); e.status = status; e.detail = detail; return e; }

/* Admin-Token: fester shpat_-Token oder — Dev-Dashboard-App — Client-Credentials-
   Grant. Der geholte Token lebt 24 h und wird im Isolate zwischengespeichert. */
let _token = { wert:null, bis:0, scope:'' };
export async function adminToken(env){
  if(env.SHOPIFY_ADMIN_TOKEN) return env.SHOPIFY_ADMIN_TOKEN;
  if(!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) throw fehler('Shopify nicht konfiguriert', 503);
  if(_token.wert && Date.now() < _token.bis - 60000) return _token.wert;
  const r = await fetch(`https://${env.SHOPIFY_SHOP}/admin/oauth/access_token`, {
    method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type:'client_credentials', client_id: env.SHOPIFY_CLIENT_ID, client_secret: env.SHOPIFY_CLIENT_SECRET }) });
  const d = await r.json().catch(()=>null);
  if(!r.ok || !d || !d.access_token) throw fehler('Shopify-Anmeldung fehlgeschlagen', 502, d);
  if(d.scope && !/write_draft_orders/.test(d.scope)) throw fehler('App-Version ohne write_draft_orders', 503, d.scope);
  _token = { wert: d.access_token, bis: Date.now() + (d.expires_in||86399)*1000, scope: d.scope||'' };
  return _token.wert;
}
export function tokenScope(){ return _token.scope; }

export async function graphql(env, query, variables){
  if(!env.SHOPIFY_SHOP) throw fehler('Shopify nicht konfiguriert', 503);
  const token = await adminToken(env);
  const r = await fetch(`https://${env.SHOPIFY_SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method:'POST', headers:{ 'Content-Type':'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }) });
  const text = await r.text();
  let d = null; try{ d = JSON.parse(text); }catch(e){}
  if(!r.ok || !d || d.errors) throw fehler('Shopify antwortet nicht', 502, { status: r.status, antwort: d ? (d.errors||d) : text.slice(0,600) });
  return d.data;
}

export async function draftOrderAnlegen(input, env){
  const q = `mutation kfg($input: DraftOrderInput!){ draftOrderCreate(input:$input){ draftOrder{ id invoiceUrl totalPriceSet{ presentmentMoney{ amount currencyCode } } } userErrors{ field message } } }`;
  const d = await graphql(env, q, { input });
  const res = d && d.draftOrderCreate;
  if(!res || (res.userErrors && res.userErrors.length)) throw fehler('Draft Order abgelehnt', 502, res && res.userErrors);
  if(!res.draftOrder || !res.draftOrder.invoiceUrl) throw fehler('keine Checkout-URL', 502, res);
  return res.draftOrder;
}

/* ── Bestellungen ────────────────────────────────────────────────────────── */
/* Ohne read_customers: Name aus der Rechnungs-/Lieferadresse statt aus dem Kundenobjekt */
const ORDER_FELDER = `id name email createdAt customerLocale tags note test
  billingAddress{ firstName lastName } shippingAddress{ firstName lastName }
  customAttributes{ key value }
  lineItems(first:25){ nodes{ id title quantity customAttributes{ key value } } }`;

/** Bestellung per GraphQL holen — Nummer (1034), Name (KP-2026-1034) oder GID. */
export async function bestellungHolen(env, ref){
  ref = String(ref||'').trim();
  if(/^gid:\/\//.test(ref) || /^\d{8,}$/.test(ref)){
    const id = ref.startsWith('gid://') ? ref : `gid://shopify/Order/${ref}`;
    const d = await graphql(env, `query($id:ID!){ order(id:$id){ ${ORDER_FELDER} } }`, { id });
    return d.order ? normBestellung(d.order) : null;
  }
  const d = await graphql(env, `query($q:String!){ orders(first:1, query:$q){ nodes{ ${ORDER_FELDER} } } }`, { q: `name:${ref.replace(/^#/,'')}` });
  const o = d.orders && d.orders.nodes && d.orders.nodes[0];
  return o ? normBestellung(o) : null;
}

/** Offene Bestellungen mit einem Tag (fuer den 72-h-Lauf). */
export async function bestellungenMitTag(env, tag){
  const d = await graphql(env, `query($q:String!){ orders(first:50, query:$q, sortKey:CREATED_AT){ nodes{ ${ORDER_FELDER} } } }`, { q: `tag:${tag}` });
  return ((d.orders && d.orders.nodes) || []).map(normBestellung);
}

const nameAus = (o) => o ? `${o.firstName ?? o.first_name ?? ''} ${o.lastName ?? o.last_name ?? ''}`.trim() : '';
/** GraphQL-Bestellung und REST-Webhook-Payload auf dieselbe Form bringen. */
export function normBestellung(o){
  const paare = (arr) => (arr||[]).map(a => ({ key: a.key ?? a.name, value: a.value }));
  if(o.admin_graphql_api_id || o.line_items){           // REST (Webhook)
    return {
      id: o.admin_graphql_api_id || `gid://shopify/Order/${o.id}`,
      nummer: String(o.id), name: o.name, email: o.email || (o.customer && o.customer.email) || '',
      erstellt: o.created_at, locale: o.customer_locale || '', tags: String(o.tags||'').split(',').map(s=>s.trim()).filter(Boolean),
      note: o.note || '', test: !!o.test,
      kunde: nameAus(o.customer) || nameAus(o.billing_address) || nameAus(o.shipping_address) || '',
      attribute: paare(o.note_attributes),
      positionen: (o.line_items||[]).map(li => ({ id: li.admin_graphql_api_id || `gid://shopify/LineItem/${li.id}`, titel: li.title, menge: li.quantity, attribute: paare(li.properties) })),
    };
  }
  return {                                                // GraphQL
    id: o.id, nummer: String(o.id).split('/').pop(), name: o.name, email: o.email || (o.customer && o.customer.email) || '',
    erstellt: o.createdAt, locale: o.customerLocale || '', tags: o.tags || [], note: o.note || '', test: !!o.test,
    kunde: nameAus(o.customer) || nameAus(o.billingAddress) || nameAus(o.shippingAddress) || '',
    attribute: paare(o.customAttributes),
    positionen: ((o.lineItems && o.lineItems.nodes) || []).map(li => ({ id: li.id, titel: li.title, menge: li.quantity, attribute: paare(li.customAttributes) })),
  };
}

export async function tagsHinzufuegen(env, id, tags){
  const d = await graphql(env, `mutation($id:ID!,$tags:[String!]!){ tagsAdd(id:$id, tags:$tags){ userErrors{ field message } } }`, { id, tags });
  const ue = d.tagsAdd && d.tagsAdd.userErrors;
  if(ue && ue.length) throw fehler('tagsAdd abgelehnt', 502, ue);
}
export async function tagsEntfernen(env, id, tags){
  const d = await graphql(env, `mutation($id:ID!,$tags:[String!]!){ tagsRemove(id:$id, tags:$tags){ userErrors{ field message } } }`, { id, tags });
  const ue = d.tagsRemove && d.tagsRemove.userErrors;
  if(ue && ue.length) throw fehler('tagsRemove abgelehnt', 502, ue);
}
/** Notiz der Bestellung ergaenzen (bestehender Text bleibt). */
export async function notizAnhaengen(env, id, zeile){
  const q = await graphql(env, `query($id:ID!){ order(id:$id){ note } }`, { id });
  const alt = (q.order && q.order.note) || '';
  if(alt.includes(zeile)) return;
  const note = (alt ? alt.trimEnd() + '\n' : '') + zeile;
  const d = await graphql(env, `mutation($input:OrderInput!){ orderUpdate(input:$input){ userErrors{ field message } } }`, { input: { id, note } });
  const ue = d.orderUpdate && d.orderUpdate.userErrors;
  if(ue && ue.length) throw fehler('orderUpdate abgelehnt', 502, ue);
}

/* ── Webhooks ────────────────────────────────────────────────────────────── */
export async function webhookAnlegen(env, topic, url){
  const vorhandene = await graphql(env, `{ webhookSubscriptions(first:50){ nodes{ id topic endpoint{ __typename ... on WebhookHttpEndpoint{ callbackUrl } } } } }`);
  const list = (vorhandene.webhookSubscriptions && vorhandene.webhookSubscriptions.nodes) || [];
  const da = list.find(w => w.topic===topic && w.endpoint && w.endpoint.callbackUrl===url);
  if(da) return { id: da.id, neu:false };
  const d = await graphql(env, `mutation($topic:WebhookSubscriptionTopic!,$sub:WebhookSubscriptionInput!){ webhookSubscriptionCreate(topic:$topic, webhookSubscription:$sub){ webhookSubscription{ id } userErrors{ field message } } }`,
    { topic, sub: { callbackUrl: url, format: 'JSON' } });
  const res = d.webhookSubscriptionCreate;
  if(!res || (res.userErrors && res.userErrors.length)) throw fehler('Webhook abgelehnt', 502, res && res.userErrors);
  return { id: res.webhookSubscription.id, neu:true };
}
export async function webhooksAuflisten(env){
  const d = await graphql(env, `{ webhookSubscriptions(first:50){ nodes{ id topic endpoint{ __typename ... on WebhookHttpEndpoint{ callbackUrl } } } } }`);
  return (d.webhookSubscriptions && d.webhookSubscriptions.nodes) || [];
}

/** HMAC des Webhooks pruefen (Base64 von HMAC-SHA256 ueber den Rohkoerper, Schluessel = Client Secret). */
export async function webhookHmacOk(env, rohkoerper, hmacHeader){
  const secret = env.SHOPIFY_WEBHOOK_SECRET || env.SHOPIFY_CLIENT_SECRET;
  if(!secret || !hmacHeader) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, rohkoerper);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  if(b64.length !== hmacHeader.length) return false;
  let diff = 0; for(let i=0;i<b64.length;i++) diff |= b64.charCodeAt(i) ^ hmacHeader.charCodeAt(i);
  return diff === 0;
}
