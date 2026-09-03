/* E-Mail-Versand — zwei Wege, der erste konfigurierte gewinnt:

   1. SMTP aus dem eigenen Postfach (shop@kessler-pro.com bei Google Workspace,
      IONOS, Strato …). Kein Drittanbieter, Mails kommen wirklich vom Shop,
      Antworten landen im Postfach. Laeuft ueber worker-mailer (TCP-Sockets der
      Workers, braucht compatibility_flags = ["nodejs_compat"]).
        SMTP_HOST   z. B. smtp.gmail.com / smtp.ionos.de / smtp.strato.de
        SMTP_PORT   587 (STARTTLS, Vorgabe) oder 465 (TLS)
        SMTP_USER   Postfach, z. B. shop@kessler-pro.com
        SMTP_PASS   App-Passwort (Secret)
   2. Resend (https://resend.com) — ein HTTP-Aufruf, RESEND_API_KEY (Secret).

   Ohne beides wird nichts geschickt; Dateien, Tags und Notiz laufen trotzdem
   und die Antwort sagt "uebersprungen".

   Gemeinsam: MAIL_VON ("Kessler PRO <shop@kessler-pro.com>"), SHOP_MAIL,
   MAIL_KOPIE (optional, BCC intern). */

export async function sendeMail(env, m){
  m = Object.assign({}, m, { betreff: String(m.betreff||'').replace(/[\r\n]+/g,' ').slice(0,200) });   /* keine Header-Injektion ueber Namen */
  if(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) return sendeSmtp(env, m);
  if(env.RESEND_API_KEY) return sendeResend(env, m);
  return { uebersprungen:true, grund:'kein SMTP_HOST/SMTP_USER/SMTP_PASS und kein RESEND_API_KEY' };
}

/** "Name <adresse>" oder "adresse" -> { name, email } */
function adresse(s){
  const m = String(s||'').match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  return m ? { name: (m[1]||'').trim() || undefined, email: m[2].trim() } : { email: String(s||'').trim() };
}
const liste = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean).map(adresse);

async function sendeSmtp(env, m){
  const { WorkerMailer } = await import('worker-mailer');
  const port = +(env.SMTP_PORT || 587);
  const von = adresse(env.MAIL_VON || env.SMTP_USER);
  if(!von.email || von.email.split('@')[1] !== String(env.SMTP_USER).split('@')[1]) von.email = env.SMTP_USER;   /* Absender muss zum Postfach passen */
  try{
    await WorkerMailer.send(
      { host: env.SMTP_HOST, port, secure: port === 465, startTls: port !== 465,
        credentials: { username: env.SMTP_USER, password: env.SMTP_PASS }, authType: ['plain','login'],
        socketTimeoutMs: 30000, responseTimeoutMs: 30000 },
      { from: von, to: liste(m.an), bcc: m.bcc ? liste(m.bcc) : undefined, reply: m.antwortAn ? adresse(m.antwortAn) : undefined,
        subject: m.betreff, html: m.html, text: m.text || html2text(m.html),
        attachments: (m.anhaenge||[]).map(a => ({ filename: a.name, content: b64(a.daten), mimeType: mime(a.name) })) });
    return { ok:true, weg:'smtp' };
  }catch(e){ return { fehler: String(e && e.message || e).slice(0,300), weg:'smtp' }; }
}

async function sendeResend(env, m){
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
  if(!r.ok) return { fehler: (d && (d.message||d.error)) || `HTTP ${r.status}`, status: r.status, weg:'resend' };
  return { id: d && d.id, weg:'resend' };
}

const mime = (name) => ({ pdf:'application/pdf', dxf:'application/dxf', svg:'image/svg+xml' })[String(name).split('.').pop()] || 'application/octet-stream';

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
    kunde_intro: 'vielen Dank für deine Bestellung. Bevor wir mit der Fertigung beginnen, bekommst du von uns die technische Zeichnung deiner Platte zur Prüfung — unten als Bild, als PDF im Anhang.',
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
    kunde_intro: 'dziękujemy za zamówienie. Zanim rozpoczniemy produkcję, przesyłamy rysunek techniczny blatu do sprawdzenia — poniżej jako obraz, w załączniku jako PDF.',
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
    kunde_intro: 'thank you for your order. Before we start production you receive the technical drawing of your top for review — shown below, attached as a PDF.',
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

/* ── Layout „B · Ink block" (Designrunde 02.09.2026) ─────────────────────────
   600 px, Tabellen + Inline-Stile, Onest mit Systemfallback. Dunkler Kopf
   #17191B mit weissem Logo, Brief auf Weiss, Fuss mit Rechtszeile. Farben aus
   DESIGN.md; auf Dunkel: Linie #3A3D41, Text #CFCBC3. */
const LOGO_WEISS  = 'https://cdn.prod.website-files.com/67fea16d9758f16a33bef722/6a9881f22718bfe956c27554_kp-logo-email-white.png';
const SCHRIFT = "Onest,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const RECHT = 'Kessler-Polska Sp. z o.o. · ul. Okrężna 14B · 57-100 Strzelin · Poland · +48 74 810 24 80 · <a href="https://kessler-pro.com" style="color:#6D6A63">kessler-pro.com</a>';
const FUSS = {
  de: 'Antworte einfach auf diese E-Mail — sie erreicht uns unter shop@kessler-pro.com.',
  pl: 'Wystarczy odpowiedzieć na tę wiadomość — trafi do nas na shop@kessler-pro.com.',
  en: 'Reply to this e-mail — it reaches us at shop@kessler-pro.com.',
};
const KOPF = {
  de: { zeichnung:'Technische Zeichnung', bestellung:'Bestellung', intern:'Intern' },
  pl: { zeichnung:'Rysunek techniczny',   bestellung:'Zamówienie', intern:'Wewnętrznie' },
  en: { zeichnung:'Technical drawing',    bestellung:'Order',      intern:'Internal' },
};

/** Ganze Mail: Kopf (dunkel) + Inhalt (weiss) + Fuss. `kopf` = Zeile unter dem Logo. */
function RAHMEN(inhalt, opt = {}){
  const spr = opt.sprache || 'de';
  const K = KOPF[spr] || KOPF.de;
  const zeile = opt.kopf || `${K.zeichnung} &nbsp;·&nbsp; ${K.bestellung} <span style="color:#FFFFFF;font-weight:500">${esc(opt.nummer||'')}</span>`;
  return `<!doctype html><html lang="${spr}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(opt.titel||'Kessler PRO')}</title></head>
<body style="margin:0;padding:0;background:#F2F0EB;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F0EB"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;font-family:${SCHRIFT};color:#1E1E1E">
  <tr><td align="center" style="background:#17191B;padding:32px 32px 24px;border-radius:8px 8px 0 0">
    <img src="${LOGO_WEISS}" width="150" height="50" alt="Kessler PRO" style="display:block;width:150px;height:50px;border:0;margin:0 auto 20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #3A3D41;padding-top:12px;font-size:14px;line-height:1.5;color:#CFCBC3;text-align:center">${zeile}</td></tr></table>
  </td></tr>
  <tr><td style="background:#FFFFFF;padding:40px 32px 8px;font-size:16px;line-height:1.5">${inhalt}</td></tr>
  <tr><td style="background:#FFFFFF;padding:24px 32px 32px;border-radius:0 0 8px 8px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #E5E5E5;padding-top:16px;font-size:12px;line-height:1.6;color:#6D6A63">
      ${opt.fuss === false ? '' : (FUSS[spr] || FUSS.de) + '<br>'}${RECHT}
    </td></tr></table>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}
const H1 = (t) => `<p style="margin:0 0 8px;font-size:26px;line-height:1.05;letter-spacing:-.02em;font-weight:700">${t}</p>`;
const P  = (t, farbe = '#4A4A46', rand = '0 0 24px') => `<p style="margin:${rand};font-size:16px;line-height:1.5;color:${farbe}">${t}</p>`;
const KLEIN = (t, rand = '16px 0 0') => `<p style="margin:${rand};font-size:14px;line-height:1.5;color:#6D6A63">${t}</p>`;
const KNOPF = (url, text, dunkel) => dunkel
  ? `<a href="${url}" style="display:inline-block;background:#1E1E1E;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:500;line-height:48px;padding:0 24px;border-radius:8px">${text}</a>`
  : `<a href="${url}" style="display:inline-block;border:1px solid #1E1E1E;color:#1E1E1E;text-decoration:none;font-size:16px;font-weight:500;line-height:46px;padding:0 24px;border-radius:8px">${text}</a>`;
/* Knoepfe untereinander: nebeneinander passen zwei nicht in 320 px Handybreite. */
const KNOEPFE = (...k) => `<table role="presentation" cellpadding="0" cellspacing="0">${k.filter(Boolean).map(x => `<tr><td style="padding:0 0 8px">${x}</td></tr>`).join('')}</table>`;
const ZEILE = (k, v, letzte) => `<tr><td style="padding:8px 12px 8px 0;border-top:1px solid #E5E5E5;${letzte?'border-bottom:1px solid #E5E5E5;':''}color:#6D6A63;width:34%;vertical-align:top">${k}</td><td style="padding:8px 0;border-top:1px solid #E5E5E5;${letzte?'border-bottom:1px solid #E5E5E5;':''}vertical-align:top">${v}</td></tr>`;
const TABELLE = (zeilen) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 24px;font-size:14px;line-height:1.5">${zeilen}</table>`;
const BILD = (urlBild, urlPdf, alt) => `<a href="${urlPdf}" style="display:block;border:1px solid #D8D4CC;border-radius:8px;overflow:hidden;background:#FFFFFF"><img src="${urlBild}" width="534" alt="${esc(alt)}" style="display:block;width:100%;height:auto;border:0"></a>`;
const bildName = (dateien) => dateien.png || String(dateien.svg||'').replace(/\.svg$/, '.png');
const vorname = (auftrag) => esc(String(auftrag.kunde||'').split(' ')[0] || '');

const TITEL = {
  de: { kunde:'Bitte prüfe deine Zeichnung.', zeichnung:'Zeichnung', pdf:'PDF öffnen', frei:'Maße bestätigt — danke.', aend:'Änderungswunsch erhalten.', hinweis:'Zeichnung prüfen und freigeben' },
  pl: { kunde:'Prosimy o sprawdzenie rysunku.', zeichnung:'Rysunek', pdf:'Otwórz PDF', frei:'Wymiary potwierdzone — dziękujemy.', aend:'Otrzymaliśmy prośbę o zmianę.', hinweis:'Sprawdź i zatwierdź rysunek' },
  en: { kunde:'Please check your drawing.', zeichnung:'Drawing', pdf:'Open PDF', frei:'Dimensions confirmed — thank you.', aend:'Change request received.', hinweis:'Check and release the drawing' },
};

/** Mail an den Kunden mit Zeichnung, Bestaetigen/Aendern-Links. */
export function kundenMail(auftrag, spr, urls){
  const T = TEXTE[spr] || TEXTE.de, U = TITEL[spr] || TITEL.de;
  const bis = fristText(auftrag.frist, spr);
  const nummerKurz = String(auftrag.name||'').replace(/^[^0-9]*/, '');
  const positionen = auftrag.positionen.map(p => {
    const pdf = urls.datei(p.dateien.kunde_pdf);
    return BILD(urls.datei(bildName(p.dateien)), pdf, `${U.zeichnung} ${T.pos} ${p.idx} · ${auftrag.name}`)
      + TABELLE(ZEILE(`${T.pos} ${p.idx}`, esc(p.titel)) + ZEILE(U.zeichnung, `Z-${esc(nummerKurz)}-${p.idx} · V1 &nbsp;·&nbsp; <a href="${pdf}" style="color:#1E1E1E">${U.pdf}</a>`, true));
  }).join('');
  const html = RAHMEN(
    H1(U.kunde)
    + P(`${T.kunde_hallo(vorname(auftrag))} ${T.kunde_intro} ${T.kunde_bitte}`)
    + positionen
    + KNOEPFE(KNOPF(urls.freigabe, T.kunde_ok, true), KNOPF(urls.freigabe + '?a=aenderung', T.kunde_aend, false))
    + KLEIN(T.kunde_frist(bis))
    + P(T.kunde_gruss, '#1E1E1E', '24px 0 0'),
    { sprache: spr, nummer: auftrag.name, titel: `${U.hinweis} · ${auftrag.name}` });
  return { betreff: T.kunde_betreff(auftrag.name), html };
}

/** Interne Mail an shop@ mit allen Dateien und Links. */
export function internMail(auftrag, urls, was){
  const st = { neu: 'Neue Konfigurator-Bestellung — Zeichnungen erzeugt', freigegeben: 'Kunde hat die Maße BESTÄTIGT', aenderung: 'Kunde meldet eine ÄNDERUNG — Fertigung stoppen', auto: 'Auto-Freigabe nach 72 h ohne Antwort' }[was] || was;
  /* Interne Links mit dem internen Token — der Kundenlink liefert Werkstatt-PDF und DXF nicht */
  const zeilen = auftrag.positionen.map(p => ZEILE(`Position ${p.idx}`, `${esc(p.titel)}<br><a href="${urls.intern(p.dateien.kunde_pdf)}" style="color:#1E1E1E">Kundenzeichnung (PDF)</a> · <a href="${urls.intern(p.dateien.werkstatt_pdf)}" style="color:#1E1E1E">Werkstatt PL (PDF)</a> · <a href="${urls.intern(p.dateien.dxf)}" style="color:#1E1E1E">DXF</a> · <a href="${urls.intern(p.dateien.svg)}" style="color:#1E1E1E">SVG</a>`)).join('')
    + ZEILE('Status', `<b>${esc(auftrag.status)}</b>${auftrag.status==='offen' ? ` · Frist ${fristText(auftrag.frist,'de')}` : ''}${auftrag.freigabe ? ` · ${esc(auftrag.freigabe.name||'')} ${esc(auftrag.freigabe.zeit||'')}` : ''}`, true);
  const html = RAHMEN(
    H1(st)
    + P(`Bestellung <b>${esc(auftrag.name)}</b> · ${esc(auftrag.kunde)} · ${esc(auftrag.email)} · Sprache ${auftrag.sprache}${auftrag.test ? ' · <b>TESTBESTELLUNG</b>' : ''}`, '#1E1E1E', '0')
    + TABELLE(zeilen)
    + (auftrag.aenderung ? P(`<b>Änderungswunsch des Kunden:</b><br>${esc(auftrag.aenderung.text).replace(/\n/g,'<br>')}`, '#1E1E1E') : '')
    + KNOEPFE(KNOPF(urls.shopify, 'Bestellung in Shopify', true), KNOPF(urls.uebersicht, 'Alle Dateien (intern)', false), KNOPF(urls.freigabe, 'Freigabe-Seite des Kunden', false))
    + KLEIN('Alle Dateien hängen an. Die Werkstattzeichnung trägt den Freigabestand; nach Bestätigung kommt sie noch einmal aktualisiert. Die Links in dieser Mail sind intern — bitte nicht an Kunden weitergeben.'),
    { sprache:'de', kopf: `Intern &nbsp;·&nbsp; ${was === 'neu' ? 'Zeichnungen' : was === 'aenderung' ? 'Änderung' : 'Freigabe'} &nbsp;·&nbsp; <span style="color:#FFFFFF;font-weight:500">${esc(auftrag.name)}</span>`, titel: `Intern · ${auftrag.name}`, fuss:false });
  return { betreff: `${was==='neu' ? 'Zeichnungen' : was==='aenderung' ? 'ÄNDERUNG' : 'Freigabe'} ${auftrag.name} · ${auftrag.kunde} · ${auftrag.positionen.map(p=>p.kurz).join(' | ')}`, html };
}

export function freigabeMail(auftrag, spr, urls){
  const T = TEXTE[spr] || TEXTE.de, U = TITEL[spr] || TITEL.de;
  const html = RAHMEN(H1(U.frei) + P(`${T.kunde_hallo(vorname(auftrag))} ${T.frei_text(auftrag.freigabe ? auftrag.freigabe.zeit : '')}`) + P(T.kunde_gruss, '#1E1E1E', '0'),
    { sprache: spr, nummer: auftrag.name, titel: `${U.frei} · ${auftrag.name}` });
  return { betreff: T.frei_betreff(auftrag.name), html };
}
export function aenderungMail(auftrag, spr){
  const T = TEXTE[spr] || TEXTE.de, U = TITEL[spr] || TITEL.de;
  const html = RAHMEN(H1(U.aend) + P(`${T.kunde_hallo(vorname(auftrag))} ${T.aend_text}`)
    + (auftrag.aenderung && auftrag.aenderung.text ? P(`<b>${T.aend_dein}</b><br>${esc(auftrag.aenderung.text).replace(/\n/g,'<br>')}`, '#1E1E1E') : '')
    + P(T.kunde_gruss, '#1E1E1E', '0'),
    { sprache: spr, nummer: auftrag.name, titel: `${U.aend} · ${auftrag.name}` });
  return { betreff: T.aend_betreff(auftrag.name), html };
}

export function fristText(iso, spr){
  const d = new Date(iso);
  if(isNaN(d)) return '';
  const loc = spr === 'pl' ? 'pl-PL' : spr === 'en' ? 'en-GB' : 'de-DE';
  return d.toLocaleString(loc, { timeZone:'Europe/Berlin', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) + (spr==='en' ? ' (CET)' : ' Uhr').replace(' Uhr', spr==='pl' ? '' : ' Uhr');
}
