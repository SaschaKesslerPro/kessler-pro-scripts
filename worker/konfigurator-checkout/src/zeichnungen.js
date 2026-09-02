/* Zeichnungs-Pipeline: bezahlte Bestellung -> Zeichnungen (Kunde, Werkstatt, DXF)
   -> Ablage in KV -> Tag + Notiz in Shopify -> Mail an shop@ und Kunde ->
   Freigabe durch den Kunden (Link) oder nach 72 h automatisch.

   Ablage (KV ZEICHNUNGEN):
     auftrag:<nummer>            JSON: Status, Positionen, Dateinamen, Token, Frist
     token:<token>               -> nummer      (Link des Kunden)
     datei:<nummer>:<dateiname>  Binaerdaten (PDF/DXF/SVG) */

import { konfigAusAttributen, konfigZuZeichnung } from './zeichnung/adapter.js';
import { zeichnung } from './zeichnung/zeichnung.js';
import { dxf } from './zeichnung/dxf.js';
import { svgZuPdf } from './zeichnung/pdf.js';
import * as SH from './shopify.js';
import { sendeMail, kundenMail, internMail, freigabeMail, aenderungMail, fristText } from './mail.js';

export const TAG = { offen:'zeichnung-offen', frei:'zeichnung-freigegeben', auto:'zeichnung-auto-freigegeben', aenderung:'zeichnung-aenderung' };

let _schriften = null;
export function setSchriften(f){ _schriften = f; }
async function schriften(){
  if(_schriften) return _schriften;
  const m = await import('./schriften.js');
  _schriften = m.SCHRIFTEN;
  return _schriften;
}

const nummerAus = (best) => String(best.nummer || String(best.id).split('/').pop());
export const auftragKey = (nummer) => `auftrag:${nummer}`;
const dateiKey = (nummer, name) => `datei:${nummer}:${name}`;

export function spracheAus(best){
  const a = (best.attribute||[]).find(x => x.key === '_kfg_sprache');
  const s = (a && a.value) || String(best.locale||'').slice(0,2).toLowerCase();
  return ['de','pl','en'].includes(s) ? s : 'de';
}
export function urlsFuer(env, auftrag){
  const base = String(env.PUBLIC_URL || '').replace(/\/$/, '');
  return {
    freigabe: `${base}/freigabe/${auftrag.token}`,
    datei: (name) => `${base}/z/${auftrag.token}/${name}`,
    shopify: `https://admin.shopify.com/store/${String(env.SHOPIFY_SHOP||'').replace('.myshopify.com','')}/orders/${auftrag.nummer}`,
  };
}
function zufallToken(){
  const b = new Uint8Array(18); crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function jetztText(spr){ return fristText(new Date().toISOString(), spr); }

/** Eine Position zeichnen: SVG (Kunde), PDF (Kunde), PDF (Werkstatt PL), DXF. */
export async function dateienFuerPosition(best, pos, idx, n, spr, freigabe){
  const S = konfigAusAttributen(pos.attribute);
  if(!S) return null;
  const at = (k) => { const a = pos.attribute.find(x => x.key === k); return a ? a.value : ''; };
  const nummerKurz = String(best.name||'').replace(/^[^0-9]*/, '') || nummerAus(best);
  const maschine = at('Nähmaschine');
  const meta = {
    bestellnummer: best.name || `#${nummerAus(best)}`, kunde: best.kunde || '', datum: String(best.erstellt||'').slice(0,10),
    position: idx, positionen: n, menge: pos.menge || 1, sku: at('_kfg_lager_sku') || 'nach Maß',
    zeichnungsnummer: `Z-${nummerKurz}-${idx}`, version: 1, freigabe: freigabe || null,
    maschine: /nicht angegeben|nie podano|not specified/.test(maschine) ? '' : maschine,
  };
  const k = konfigZuZeichnung(S, meta);
  const kKunde = { ...k, exemplar:'kunde' }, kWerk = { ...k, exemplar:'produktion' };
  const svgKunde = zeichnung(kKunde, spr);
  const svgWerk = zeichnung(kWerk, 'pl');
  const F = await schriften();
  const titel = `${meta.bestellnummer} · ${meta.zeichnungsnummer}`;
  const [pdfKunde, pdfWerk] = await Promise.all([
    svgZuPdf(svgKunde, F, { titel: `${titel} · Kundenzeichnung` }),
    svgZuPdf(svgWerk, F, { titel: `${titel} · Werkstatt` }),
  ]);
  const stamm = `${String(best.name||nummerAus(best)).replace(/[^A-Za-z0-9-]/g,'')}-P${idx}`;
  const dateien = {
    kunde_pdf: `${stamm}-zeichnung.pdf`, werkstatt_pdf: `${stamm}-werkstatt.pdf`, dxf: `${stamm}-teil.dxf`, svg: `${stamm}-zeichnung.svg`,
  };
  const inhalte = {
    [dateien.kunde_pdf]: pdfKunde, [dateien.werkstatt_pdf]: pdfWerk,
    [dateien.dxf]: new TextEncoder().encode(dxf(kWerk, { sprache:'pl' })),
    [dateien.svg]: new TextEncoder().encode(svgKunde),
  };
  const kurz = kurzTitel(S, k);
  return { S, k, dateien, inhalte, kurz, titel: pos.titel, lineItemId: pos.id };
}
function kurzTitel(S, k){
  const m = k.form === 'rund' ? `Ø ${k.durchmesser_mm}` : k.form === 'lform' ? `L ${k.lform.L}×${k.lform.B}` : `${k.laenge_mm}×${k.breite_mm}`;
  return `${S.mat} ${S.thick} ${m}`;
}

export const TYP = { pdf:'application/pdf', dxf:'application/dxf', svg:'image/svg+xml' };

/** Bestellung komplett verarbeiten. Idempotent: ein zweiter Aufruf (Webhook-
    Wiederholung) liefert den vorhandenen Auftrag, ausser opt.erneut. */
export async function bestellungVerarbeiten(best, env, opt = {}){
  const KV = env.ZEICHNUNGEN;
  const nummer = nummerAus(best);
  const alt = KV ? await KV.get(auftragKey(nummer), 'json') : null;
  if(alt && !opt.erneut) return { ...alt, unveraendert:true };
  const mitKonfig = (best.positionen||[]).filter(p => (p.attribute||[]).some(a => a.key === '_kfg_konfig_1'));
  if(!mitKonfig.length) return { uebersprungen:true, grund:'keine Konfigurator-Position', nummer };

  const spr = spracheAus(best);
  const jetzt = new Date();
  const stunden = +(env.FREIGABE_STUNDEN || 72);
  const auftrag = {
    nummer, id: best.id, name: best.name, email: best.email || '', kunde: best.kunde || '', sprache: spr, test: !!best.test,
    token: (alt && alt.token) || zufallToken(),
    erstellt: best.erstellt, angelegt: jetzt.toISOString(), frist: new Date(jetzt.getTime() + stunden*3600e3).toISOString(),
    status: 'offen', freigabe: null, aenderung: null, positionen: [], protokoll: [],
  };
  const erzeugt = [];
  let idx = 0;
  for(const pos of mitKonfig){
    idx++;
    let e;
    try{ e = await dateienFuerPosition(best, pos, idx, mitKonfig.length, spr, null); }
    catch(err){ auftrag.protokoll.push(`Position ${idx}: Zeichnung fehlgeschlagen — ${err.message}`); continue; }
    if(!e) continue;
    erzeugt.push(e);
    auftrag.positionen.push({ idx, lineItemId: e.lineItemId, titel: e.titel, kurz: e.kurz, dateien: e.dateien });
    if(KV) for(const [name, daten] of Object.entries(e.inhalte)) await KV.put(dateiKey(nummer, name), daten, { metadata:{ typ: name.split('.').pop() } });
  }
  if(!auftrag.positionen.length) return { uebersprungen:true, grund:'keine Zeichnung erzeugbar', nummer, protokoll: auftrag.protokoll };
  if(KV){ await KV.put(auftragKey(nummer), JSON.stringify(auftrag)); await KV.put(`token:${auftrag.token}`, nummer); }

  const urls = urlsFuer(env, auftrag);
  // Shopify: Tag + Notiz (braucht write_orders — ohne den Scope nur Protokoll, kein Abbruch)
  try{
    await SH.tagsHinzufuegen(env, best.id, [TAG.offen]);
    await SH.notizAnhaengen(env, best.id, `Zeichnungen erzeugt ${jetztText('de')} · Freigabe des Kunden offen bis ${fristText(auftrag.frist,'de')} · ${urls.freigabe}`);
    auftrag.protokoll.push('Shopify: Tag und Notiz gesetzt');
  }catch(err){ auftrag.protokoll.push(`Shopify-Tag/Notiz fehlgeschlagen: ${err.message} ${err.detail ? JSON.stringify(err.detail).slice(0,200) : ''}`); }

  // Mails
  const anhaenge = erzeugt.flatMap(e => Object.entries(e.inhalte).filter(([n]) => !n.endsWith('.svg')).map(([name, daten]) => ({ name, daten })));
  const intern = internMail(auftrag, urls, 'neu');
  const ri = await sendeMail(env, { an: env.SHOP_MAIL || 'shop@kessler-pro.com', betreff: intern.betreff, html: intern.html, anhaenge, antwortAn: auftrag.email || undefined });
  auftrag.protokoll.push(`Mail intern: ${JSON.stringify(ri)}`);
  if(auftrag.email){
    const km = kundenMail(auftrag, spr, urls);
    const rk = await sendeMail(env, { an: auftrag.email, bcc: env.MAIL_KOPIE || undefined, betreff: km.betreff, html: km.html, antwortAn: env.SHOP_MAIL || 'shop@kessler-pro.com',
      anhaenge: erzeugt.map(e => ({ name: e.dateien.kunde_pdf, daten: e.inhalte[e.dateien.kunde_pdf] })) });
    auftrag.protokoll.push(`Mail Kunde: ${JSON.stringify(rk)}`);
  } else auftrag.protokoll.push('Mail Kunde: keine E-Mail-Adresse');
  if(KV) await KV.put(auftragKey(nummer), JSON.stringify(auftrag));
  return auftrag;
}

export async function auftragLaden(env, nummerOderToken){
  const KV = env.ZEICHNUNGEN; if(!KV) return null;
  let nummer = nummerOderToken;
  if(!/^\d+$/.test(String(nummer))) nummer = await KV.get(`token:${nummerOderToken}`);
  if(!nummer) return null;
  return KV.get(auftragKey(nummer), 'json');
}
export async function dateiLaden(env, auftrag, name){
  if(!auftrag.positionen.some(p => Object.values(p.dateien).includes(name))) return null;
  return env.ZEICHNUNGEN.get(dateiKey(auftrag.nummer, name), 'arrayBuffer');
}

/** Freigabe durch den Kunden ('ok' | 'aenderung') oder automatisch ('auto'). */
export async function freigabeSetzen(env, auftrag, aktion, daten = {}){
  const KV = env.ZEICHNUNGEN;
  const spr = auftrag.sprache || 'de';
  const zeit = jetztText(spr);
  if(aktion === 'aenderung'){
    auftrag.status = 'aenderung';
    auftrag.aenderung = { zeit: new Date().toISOString(), text: String(daten.text||'').slice(0, 2000), name: String(daten.name||'').slice(0,120) };
  } else {
    auftrag.status = aktion === 'auto' ? 'auto' : 'freigegeben';
    auftrag.freigabe = { name: aktion === 'auto' ? '' : (String(daten.name||'').slice(0,120) || auftrag.kunde), zeit, auto: aktion === 'auto', iso: new Date().toISOString() };
  }
  // Zeichnungen mit Freigabestand neu erzeugen (Werkstatt + Kunde)
  const erzeugt = [];
  if(auftrag.status !== 'aenderung'){
    try{
      const best = await SH.bestellungHolen(env, auftrag.id);
      const mitKonfig = (best.positionen||[]).filter(p => (p.attribute||[]).some(a => a.key === '_kfg_konfig_1'));
      let idx = 0;
      for(const pos of mitKonfig){
        idx++;
        const e = await dateienFuerPosition(best, pos, idx, mitKonfig.length, spr, auftrag.freigabe);
        if(!e) continue;
        erzeugt.push(e);
        if(KV) for(const [name, d] of Object.entries(e.inhalte)) await KV.put(dateiKey(auftrag.nummer, name), d, { metadata:{ typ: name.split('.').pop() } });
      }
      auftrag.protokoll.push(`Zeichnungen mit Freigabestand neu erzeugt (${aktion})`);
    }catch(err){ auftrag.protokoll.push(`Neu-Erzeugung fehlgeschlagen: ${err.message}`); }
  }
  if(KV) await KV.put(auftragKey(auftrag.nummer), JSON.stringify(auftrag));

  const urls = urlsFuer(env, auftrag);
  try{
    const neu = aktion === 'aenderung' ? TAG.aenderung : aktion === 'auto' ? TAG.auto : TAG.frei;
    await SH.tagsHinzufuegen(env, auftrag.id, [neu]);
    await SH.tagsEntfernen(env, auftrag.id, [TAG.offen]);
    const zeile = aktion === 'aenderung'
      ? `ÄNDERUNGSWUNSCH des Kunden ${zeit}: ${auftrag.aenderung.text || '(ohne Text)'} — Fertigung stoppen`
      : aktion === 'auto' ? `Zeichnung nach ${env.FREIGABE_STUNDEN||72} h ohne Widerspruch automatisch freigegeben (${zeit})`
      : `Zeichnung vom Kunden bestätigt ${zeit}${auftrag.freigabe.name ? ' · ' + auftrag.freigabe.name : ''}`;
    await SH.notizAnhaengen(env, auftrag.id, zeile);
  }catch(err){ auftrag.protokoll.push(`Shopify-Update fehlgeschlagen: ${err.message}`); }

  const anhaenge = erzeugt.flatMap(e => Object.entries(e.inhalte).filter(([n]) => !n.endsWith('.svg')).map(([name, d]) => ({ name, daten: d })));
  const im = internMail(auftrag, urls, aktion === 'ok' ? 'freigegeben' : aktion);
  auftrag.protokoll.push(`Mail intern (${aktion}): ${JSON.stringify(await sendeMail(env, { an: env.SHOP_MAIL || 'shop@kessler-pro.com', betreff: im.betreff, html: im.html, anhaenge, antwortAn: auftrag.email || undefined }))}`);
  if(auftrag.email && aktion !== 'auto'){
    const km = aktion === 'aenderung' ? aenderungMail(auftrag, spr) : freigabeMail(auftrag, spr, urls);
    const kundenAnh = aktion === 'aenderung' ? [] : erzeugt.map(e => ({ name: e.dateien.kunde_pdf, daten: e.inhalte[e.dateien.kunde_pdf] }));
    auftrag.protokoll.push(`Mail Kunde (${aktion}): ${JSON.stringify(await sendeMail(env, { an: auftrag.email, betreff: km.betreff, html: km.html, anhaenge: kundenAnh, antwortAn: env.SHOP_MAIL || 'shop@kessler-pro.com' }))}`);
  }
  if(KV) await KV.put(auftragKey(auftrag.nummer), JSON.stringify(auftrag));
  return auftrag;
}

/** Stuendlicher Lauf: alles, was offen und ueber der Frist ist, automatisch freigeben. */
export async function autoFreigabeLauf(env){
  const KV = env.ZEICHNUNGEN; if(!KV) return { fehler:'kein KV' };
  const out = { geprueft:0, freigegeben:[] };
  let cursor;
  do{
    const l = await KV.list({ prefix:'auftrag:', cursor });
    for(const k of l.keys){
      const a = await KV.get(k.name, 'json'); if(!a) continue;
      out.geprueft++;
      if(a.status === 'offen' && a.frist && new Date(a.frist).getTime() < Date.now()){
        try{ await freigabeSetzen(env, a, 'auto'); out.freigegeben.push(a.name); }
        catch(err){ out[a.name] = err.message; }
      }
    }
    cursor = l.list_complete ? null : l.cursor;
  }while(cursor);
  return out;
}
