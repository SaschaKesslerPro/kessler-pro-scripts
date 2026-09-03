/* Zeichnungs-Pipeline: bezahlte Bestellung -> Zeichnungen (Kunde, Werkstatt, DXF)
   -> Ablage in KV -> Tag + Notiz in Shopify -> Mail an shop@ und Kunde ->
   Freigabe durch den Kunden (Link) oder nach 72 h automatisch.

   Ablage (KV ZEICHNUNGEN):
     auftrag:<nummer>            JSON: Status, Positionen, Dateinamen, Token, Frist
     token:<token>               -> nummer          (Link des Kunden: Freigabe-Seite, Kunden-PDF, Bild)
     token:<tokenIntern>         -> intern:<nummer> (Link fuer shop@ / BaseLinker: alle Dateien, Uebersicht /i/)
     datei:<nummer>:<dateiname>  Binaerdaten (PDF/DXF/SVG)

   Link-Schutz (Sascha 03.09.): Die Links sind der Schluessel — 18 Zufallsbytes
   (144 Bit), nicht erratbar, nur ueber HTTPS. Der Kundenlink oeffnet nur, was der
   Kunde ohnehin per Mail bekommt (seine Zeichnung); Werkstatt-PDF und DXF gibt es
   nur ueber den internen Link. Beide Tokens laufen ab (LINK_TAGE, Standard 180 Tage
   Kunde / 365 Tage intern); der Auftrag selbst bleibt gespeichert. */

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

function tokenAus(best){
  const a = (best.attribute||[]).find(x => x.key === '_kfg_token');
  return a && /^[A-Za-z0-9_-]{16,64}$/.test(a.value) ? a.value : null;
}
/** 'auftrag' (Zeichnungen da) | 'draft' (Checkout angelegt, Zahlung/Zeichnung noch offen) | null */
export async function tokenStatus(env, token){
  const KV = env.ZEICHNUNGEN; if(!KV) return null;
  const v = await KV.get(`token:${token}`);
  if(!v) return null;
  return v.startsWith('draft:') ? 'draft' : 'auftrag';
}
/** Ablauf der Links in Tagen: LINK_TAGE = "180" oder "180,365" (Kunde, intern). */
export function linkTage(env){
  const t = String(env.LINK_TAGE || '').split(',').map(s => +s.trim()).filter(n => n > 0);
  return { kunde: t[0] || 180, intern: t[1] || t[0] || 365 };
}
/* Was der jeweilige Link liefern darf */
const KUNDE_DATEIEN = ['kunde_pdf', 'svg', 'png'];
export function dateiErlaubt(auftrag, rolle, name){
  for(const p of auftrag.positionen || []){
    for(const [art, n] of Object.entries(p.dateien || {})){
      if(n !== name) continue;
      return rolle === 'intern' || rolle === 'nummer' || KUNDE_DATEIEN.includes(art);
    }
  }
  /* png-Name kann fehlen (aeltere Auftraege): vom svg abgeleitet, fuer alle erlaubt */
  return /\.png$/.test(name) && (auftrag.positionen || []).some(p => p.dateien && p.dateien.svg === name.replace(/\.png$/, '.svg'));
}
export function spracheAus(best){
  const a = (best.attribute||[]).find(x => x.key === '_kfg_sprache');
  const s = (a && a.value) || String(best.locale||'').slice(0,2).toLowerCase();
  return ['de','pl','en'].includes(s) ? s : 'de';
}
export function urlsFuer(env, auftrag){
  const base = String(env.PUBLIC_URL || '').replace(/\/$/, '');
  const ti = auftrag.tokenIntern || auftrag.token;   /* aeltere Auftraege ohne internen Token */
  return {
    freigabe: `${base}/freigabe/${auftrag.token}`,
    datei: (name) => `${base}/z/${auftrag.token}/${name}`,
    intern: (name) => `${base}/z/${ti}/${name}`,
    uebersicht: `${base}/i/${ti}`,
    shopify: `https://admin.shopify.com/store/${String(env.SHOPIFY_SHOP||'').replace('.myshopify.com','')}/orders/${auftrag.nummer}`,
  };
}
export function zufallToken(){
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
    png: `${stamm}-zeichnung.png`,   /* wird erst auf Abruf aus dem SVG gerendert (pngLaden) */
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

export const TYP = { pdf:'application/pdf', dxf:'application/dxf', svg:'image/svg+xml', png:'image/png' };

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
    /* Token kommt bevorzugt aus dem Checkout (_kfg_token an der Bestellung): der
       Freigabe-Link steht dann schon in Shopifys Bestellbestaetigung. */
    token: (alt && alt.token) || tokenAus(best) || zufallToken(),
    tokenIntern: (alt && alt.tokenIntern) || zufallToken(),
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
    if(KV){
      for(const [name, daten] of Object.entries(e.inhalte)) await KV.put(dateiKey(nummer, name), daten, { metadata:{ typ: name.split('.').pop() } });
      await KV.delete(dateiKey(nummer, e.dateien.png));   /* altes Bild (erneut) verwerfen */
    }
  }
  if(!auftrag.positionen.length) return { uebersprungen:true, grund:'keine Zeichnung erzeugbar', nummer, protokoll: auftrag.protokoll };
  if(KV){
    const tage = linkTage(env);
    await KV.put(auftragKey(nummer), JSON.stringify(auftrag));
    await KV.put(`token:${auftrag.token}`, nummer, { expirationTtl: tage.kunde * 86400 });
    await KV.put(`token:${auftrag.tokenIntern}`, `intern:${nummer}`, { expirationTtl: tage.intern * 86400 });
  }

  const urls = urlsFuer(env, auftrag);
  // Shopify: Tag + Notiz (braucht write_orders — ohne den Scope nur Protokoll, kein Abbruch)
  try{
    await SH.tagsHinzufuegen(env, best.id, [TAG.offen]);
    await SH.notizAnhaengen(env, best.id, `Zeichnungen erzeugt ${jetztText('de')} · Freigabe des Kunden offen bis ${fristText(auftrag.frist,'de')} · Dateien intern: ${urls.uebersicht}`);
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
  const r = await auftragMitRolle(env, nummerOderToken);
  return r ? r.auftrag : null;
}
/** Auftrag plus Rolle des Aufrufers: 'nummer' (interne Route mit Schluessel),
    'kunde' (Kundentoken), 'intern' (interner Token). Abgelaufene Tokens: null. */
export async function auftragMitRolle(env, nummerOderToken){
  const KV = env.ZEICHNUNGEN; if(!KV) return null;
  let nummer = String(nummerOderToken), rolle = 'nummer';
  if(!/^\d+$/.test(nummer)){
    const v = await KV.get(`token:${nummerOderToken}`);
    if(!v || v.startsWith('draft:')) return null;
    if(v.startsWith('intern:')){ nummer = v.slice(7); rolle = 'intern'; } else { nummer = v; rolle = 'kunde'; }
  }
  const auftrag = await KV.get(auftragKey(nummer), 'json');
  if(!auftrag) return null;
  /* Sicherheitsnetz gegen vertauschte KV-Eintraege: der Token muss zum Auftrag gehoeren */
  if(rolle === 'kunde' && auftrag.token !== nummerOderToken) return null;
  if(rolle === 'intern' && auftrag.tokenIntern !== nummerOderToken) return null;
  return { auftrag, rolle };
}
export async function dateiLaden(env, auftrag, name, rolle = 'intern'){
  if(!dateiErlaubt(auftrag, rolle, name)) return null;
  if(/\.png$/.test(name)) return pngLaden(env, auftrag, name);
  return env.ZEICHNUNGEN.get(dateiKey(auftrag.nummer, name), 'arrayBuffer');
}
/** Zeichnungsbild fuer die Mail: aus dem gespeicherten SVG gerendert, danach in KV
    zwischengespeichert. Der Name leitet sich vom SVG ab (…-zeichnung.png), damit
    auch aeltere Auftraege ohne png-Eintrag ein Bild bekommen. */
export async function pngLaden(env, auftrag, name){
  const svgName = name.replace(/\.png$/, '.svg');
  if(!auftrag.positionen.some(p => p.dateien.svg === svgName)) return null;
  const KV = env.ZEICHNUNGEN;
  const alt = await KV.get(dateiKey(auftrag.nummer, name), 'arrayBuffer');
  if(alt) return alt;
  const svg = await KV.get(dateiKey(auftrag.nummer, svgName), 'text');
  if(!svg) return null;
  const { svgZuPng } = await import('./bild.js');
  const png = await svgZuPng(svg, await schriften(), +(env.BILD_BREITE || 1200));
  await KV.put(dateiKey(auftrag.nummer, name), png, { metadata:{ typ:'png' } });
  return png;
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
        if(KV){
          for(const [name, d] of Object.entries(e.inhalte)) await KV.put(dateiKey(auftrag.nummer, name), d, { metadata:{ typ: name.split('.').pop() } });
          await KV.delete(dateiKey(auftrag.nummer, e.dateien.png));   /* Bild traegt den Freigabestand -> neu rendern */
        }
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
