/* E-Mail-Versand ueber Resend (https://resend.com) — ein HTTP-Aufruf, Anhaenge
   als Base64. Ohne RESEND_API_KEY wird nichts geschickt, der Rest der Pipeline
   (Dateien, Tags, Notiz) laeuft trotzdem; die Antwort sagt dann "uebersprungen".

   Umgebung:  RESEND_API_KEY (Secret), MAIL_VON  ("Kessler PRO <zeichnung@kessler-pro.com>"),
              SHOP_MAIL (shop@kessler-pro.com), MAIL_KOPIE (optional, BCC intern) */

export async function sendeMail(env, m){
  if(!env.RESEND_API_KEY) return { uebersprungen:true, grund:'kein RESEND_API_KEY' };
  const body = {
    from: env.MAIL_VON || 'Kessler PRO <onboarding@resend.dev>',
    to: Array.isArray(m.an) ? m.an : [m.an],
    subject: m.betreff,
    html: m.html,
    text: m.text || html2text(m.html),
  };
  if(m.antwortAn) body.reply_to = m.antwortAn;
  if(m.bcc) body.bcc = Array.isArray(m.bcc) ? m.bcc : [m.bcc];
  if(m.anhaenge && m.anhaenge.length) body.attachments = m.anhaenge.map(a => ({ filename: a.name, content: b64(a.daten) }));
  const r = await fetch('https://api.resend.com/emails', {
    method:'POST', headers:{ 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type':'application/json' },
    body: JSON.stringify(body) });
  const d = await r.json().catch(()=>null);
  if(!r.ok) return { fehler: (d && (d.message||d.error)) || `HTTP ${r.status}`, status: r.status };
  return { id: d && d.id };
}

function b64(bytes){
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = ''; const CH = 0x8000;
  for(let i=0;i<u.length;i+=CH) s += String.fromCharCode.apply(null, u.subarray(i, i+CH));
  return btoa(s);
}
function html2text(h){ return String(h||'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim(); }
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ── Texte ───────────────────────────────────────────────────────────────── */
export const TEXTE = {
  de: {
    kunde_betreff: (n) => `Deine Zeichnung zur Bestellung ${n} — bitte Maße prüfen`,
    kunde_hallo: (name) => `Hallo${name ? ' ' + name : ''},`,
    kunde_intro: 'vielen Dank für deine Bestellung. Bevor wir mit der Fertigung beginnen, bekommst du von uns die technische Zeichnung deiner Platte zur Prüfung — sie hängt an dieser E-Mail und ist unten verlinkt.',
    kunde_bitte: 'Bitte schau dir Maße, Kanten, Ausschnitte und Radien in Ruhe an.',
    kunde_ok: 'Maße bestätigen',
    kunde_aend: 'Änderung melden',
    kunde_frist: (bis) => `Wenn wir bis <b>${bis}</b> nichts von dir hören, gilt die Zeichnung als bestätigt und wir fertigen genau danach (72-Stunden-Regel). Eine Maßanfertigung ist vom Widerruf ausgenommen — deshalb dieser Zwischenschritt.`,
    kunde_gruss: 'Viele Grüße<br>dein Kessler PRO Team',
    pos: 'Position', zeichnung: 'Zeichnung (PDF)',
    frei_betreff: (n) => `Bestellung ${n}: Maße bestätigt — danke!`,
    frei_text: (zeit) => `Danke, du hast die Zeichnung am ${zeit} bestätigt. Wir fertigen jetzt genau danach. Die bestätigte Zeichnung hängt an.`,
    aend_betreff: (n) => `Bestellung ${n}: Änderungswunsch erhalten`,
    aend_text: 'Danke für deine Rückmeldung. Wir haben deinen Änderungswunsch erhalten, stoppen die Fertigung und melden uns mit einer korrigierten Zeichnung.',
    aend_dein: 'Dein Hinweis:',
  },
  pl: {
    kunde_betreff: (n) => `Rysunek do zamówienia ${n} — prosimy o sprawdzenie wymiarów`,
    kunde_hallo: (name) => `Dzień dobry${name ? ' ' + name : ''},`,
    kunde_intro: 'dziękujemy za zamówienie. Zanim rozpoczniemy produkcję, przesyłamy rysunek techniczny blatu do sprawdzenia — jest w załączniku i pod linkiem poniżej.',
    kunde_bitte: 'Prosimy spokojnie sprawdzić wymiary, krawędzie, wycięcia i promienie.',
    kunde_ok: 'Potwierdzam wymiary',
    kunde_aend: 'Zgłaszam zmianę',
    kunde_frist: (bis) => `Jeśli do <b>${bis}</b> nie otrzymamy odpowiedzi, rysunek uznajemy za zatwierdzony i produkujemy dokładnie według niego (zasada 72 godzin). Produkt na wymiar nie podlega zwrotowi — stąd ten dodatkowy krok.`,
    kunde_gruss: 'Pozdrawiamy<br>zespół Kessler PRO',
    pos: 'Pozycja', zeichnung: 'Rysunek (PDF)',
    frei_betreff: (n) => `Zamówienie ${n}: wymiary potwierdzone — dziękujemy!`,
    frei_text: (zeit) => `Dziękujemy, rysunek został potwierdzony ${zeit}. Produkujemy dokładnie według niego. Potwierdzony rysunek w załączniku.`,
    aend_betreff: (n) => `Zamówienie ${n}: otrzymaliśmy prośbę o zmianę`,
    aend_text: 'Dziękujemy za informację. Otrzymaliśmy prośbę o zmianę, wstrzymujemy produkcję i odezwiemy się z poprawionym rysunkiem.',
    aend_dein: 'Twoja uwaga:',
  },
  en: {
    kunde_betreff: (n) => `Your drawing for order ${n} — please check the dimensions`,
    kunde_hallo: (name) => `Hello${name ? ' ' + name : ''},`,
    kunde_intro: 'thank you for your order. Before we start production you receive the technical drawing of your top for review — attached to this e-mail and linked below.',
    kunde_bitte: 'Please take a moment to check dimensions, edges, cut-outs and radii.',
    kunde_ok: 'Confirm dimensions',
    kunde_aend: 'Request a change',
    kunde_frist: (bis) => `If we do not hear from you by <b>${bis}</b>, the drawing is deemed confirmed and we produce exactly to it (72-hour rule). Made-to-measure items are excluded from withdrawal — hence this step.`,
    kunde_gruss: 'Kind regards<br>your Kessler PRO team',
    pos: 'Item', zeichnung: 'Drawing (PDF)',
    frei_betreff: (n) => `Order ${n}: dimensions confirmed — thank you!`,
    frei_text: (zeit) => `Thank you, you confirmed the drawing on ${zeit}. We now produce exactly to it. The confirmed drawing is attached.`,
    aend_betreff: (n) => `Order ${n}: change request received`,
    aend_text: 'Thank you for your feedback. We have received your change request, paused production and will get back to you with a corrected drawing.',
    aend_dein: 'Your note:',
  },
};

const RAHMEN = (inhalt) => `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1e1e1e;max-width:620px">
<p style="font-size:20px;font-weight:700;margin:0 0 16px">KESSLER PRO</p>${inhalt}</div>`;
const KNOPF = (url, text, dunkel) => `<a href="${url}" style="display:inline-block;padding:12px 20px;margin:4px 8px 4px 0;border-radius:6px;text-decoration:none;font-weight:600;${dunkel ? 'background:#1e1e1e;color:#fff' : 'background:#eee;color:#1e1e1e;border:1px solid #ccc'}">${text}</a>`;

/** Mail an den Kunden mit Zeichnung, Bestaetigen/Aendern-Links. */
export function kundenMail(auftrag, spr, urls){
  const T = TEXTE[spr] || TEXTE.de;
  const bis = fristText(auftrag.frist, spr);
  const liste = auftrag.positionen.map(p => `<li>${T.pos} ${p.idx}: ${esc(p.titel)} — <a href="${urls.datei(p.dateien.kunde_pdf)}">${T.zeichnung}</a></li>`).join('');
  const html = RAHMEN(`<p>${T.kunde_hallo(esc(auftrag.kunde.split(' ')[0]||''))}</p><p>${T.kunde_intro}</p><ul>${liste}</ul><p>${T.kunde_bitte}</p>
<p>${KNOPF(urls.freigabe, T.kunde_ok, true)} ${KNOPF(urls.freigabe + '?a=aenderung', T.kunde_aend, false)}</p>
<p style="color:#555;font-size:13px">${T.kunde_frist(bis)}</p><p>${T.kunde_gruss}</p>`);
  return { betreff: T.kunde_betreff(auftrag.name), html };
}

/** Interne Mail an shop@ mit allen Dateien und Links. */
export function internMail(auftrag, urls, was){
  const st = { neu: 'Neue Konfigurator-Bestellung — Zeichnungen erzeugt', freigegeben: 'Kunde hat die Maße BESTÄTIGT', aenderung: 'Kunde meldet eine ÄNDERUNG — Fertigung stoppen', auto: 'Auto-Freigabe nach 72 h ohne Antwort' }[was] || was;
  const liste = auftrag.positionen.map(p => `<li><b>Position ${p.idx}</b>: ${esc(p.titel)}<br>
<a href="${urls.datei(p.dateien.kunde_pdf)}">Kundenzeichnung (PDF)</a> · <a href="${urls.datei(p.dateien.werkstatt_pdf)}">Werkstattzeichnung PL (PDF)</a> · <a href="${urls.datei(p.dateien.dxf)}">DXF für die Maschine</a> · <a href="${urls.datei(p.dateien.svg)}">SVG</a></li>`).join('');
  const html = RAHMEN(`<p><b>${st}</b></p>
<p>Bestellung <b>${esc(auftrag.name)}</b> · ${esc(auftrag.kunde)} · ${esc(auftrag.email)} · Sprache ${auftrag.sprache}${auftrag.test ? ' · <b>TESTBESTELLUNG</b>' : ''}</p>
<ul>${liste}</ul>
<p>Status: <b>${esc(auftrag.status)}</b>${auftrag.status==='offen' ? ` · Frist ${fristText(auftrag.frist,'de')}` : ''}${auftrag.freigabe ? ` · ${esc(auftrag.freigabe.name||'')} ${esc(auftrag.freigabe.zeit||'')}` : ''}</p>
${auftrag.aenderung ? `<p><b>Änderungswunsch des Kunden:</b><br>${esc(auftrag.aenderung.text).replace(/\n/g,'<br>')}</p>` : ''}
<p>Freigabe-Seite des Kunden: <a href="${urls.freigabe}">${urls.freigabe}</a><br>Bestellung in Shopify: <a href="${urls.shopify}">${urls.shopify}</a></p>
<p style="color:#777;font-size:12px">Alle Dateien hängen an. Die Werkstattzeichnung trägt den Freigabestand; nach Bestätigung kommt sie noch einmal aktualisiert.</p>`);
  return { betreff: `${was==='neu' ? 'Zeichnungen' : was==='aenderung' ? 'ÄNDERUNG' : 'Freigabe'} ${auftrag.name} · ${auftrag.kunde} · ${auftrag.positionen.map(p=>p.kurz).join(' | ')}`, html };
}

export function freigabeMail(auftrag, spr, urls){
  const T = TEXTE[spr] || TEXTE.de;
  const html = RAHMEN(`<p>${T.kunde_hallo(esc(auftrag.kunde.split(' ')[0]||''))}</p><p>${T.frei_text(auftrag.freigabe ? auftrag.freigabe.zeit : '')}</p><p>${T.kunde_gruss}</p>`);
  return { betreff: T.frei_betreff(auftrag.name), html };
}
export function aenderungMail(auftrag, spr){
  const T = TEXTE[spr] || TEXTE.de;
  const html = RAHMEN(`<p>${T.kunde_hallo(esc(auftrag.kunde.split(' ')[0]||''))}</p><p>${T.aend_text}</p>
${auftrag.aenderung && auftrag.aenderung.text ? `<p><b>${T.aend_dein}</b><br>${esc(auftrag.aenderung.text).replace(/\n/g,'<br>')}</p>` : ''}<p>${T.kunde_gruss}</p>`);
  return { betreff: T.aend_betreff(auftrag.name), html };
}

export function fristText(iso, spr){
  const d = new Date(iso);
  if(isNaN(d)) return '';
  const loc = spr === 'pl' ? 'pl-PL' : spr === 'en' ? 'en-GB' : 'de-DE';
  return d.toLocaleString(loc, { timeZone:'Europe/Berlin', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) + (spr==='en' ? ' (CET)' : ' Uhr').replace(' Uhr', spr==='pl' ? '' : ' Uhr');
}
