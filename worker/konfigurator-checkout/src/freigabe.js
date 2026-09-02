/* Freigabe-Seite des Kunden: Zeichnung ansehen, Masse bestaetigen oder eine
   Aenderung melden. Eine Seite, drei Sprachen, keine Abhaengigkeiten. */

const T = {
  de: { titel:'Zeichnung prüfen', hallo:'Bitte prüfe die technische Zeichnung deiner Bestellung', bestellung:'Bestellung', pos:'Position',
        pdf:'PDF öffnen', ok:'Maße bestätigen', okHint:'Mit der Bestätigung fertigen wir genau nach dieser Zeichnung.',
        aend:'Änderung melden', aendHint:'Beschreibe kurz, was anders sein soll — wir melden uns mit einer korrigierten Zeichnung.',
        name:'Dein Name', text:'Was soll geändert werden?', senden:'Absenden', abbrechen:'Zurück',
        frist:(bis)=>`Ohne Rückmeldung bis ${bis} gilt die Zeichnung als bestätigt (72-Stunden-Regel).`,
        dankeOk:'Danke — die Maße sind bestätigt. Wir fertigen jetzt genau nach dieser Zeichnung.',
        dankeAend:'Danke — wir haben deinen Änderungswunsch erhalten, stoppen die Fertigung und melden uns.',
        schonOk:(z)=>`Diese Zeichnung wurde am ${z} bestätigt.`, schonAuto:'Diese Zeichnung wurde nach 72 Stunden ohne Widerspruch freigegeben.',
        schonAend:'Für diese Bestellung liegt ein Änderungswunsch vor — wir melden uns.', nicht:'Dieser Link ist ungültig oder abgelaufen.',
        hinweisWiderruf:'Maßanfertigungen sind vom Widerruf ausgenommen — deshalb dieser Zwischenschritt.' },
  pl: { titel:'Sprawdź rysunek', hallo:'Prosimy o sprawdzenie rysunku technicznego do zamówienia', bestellung:'Zamówienie', pos:'Pozycja',
        pdf:'Otwórz PDF', ok:'Potwierdzam wymiary', okHint:'Po potwierdzeniu produkujemy dokładnie według tego rysunku.',
        aend:'Zgłaszam zmianę', aendHint:'Opisz krótko, co ma być inaczej — odezwiemy się z poprawionym rysunkiem.',
        name:'Imię i nazwisko', text:'Co należy zmienić?', senden:'Wyślij', abbrechen:'Wróć',
        frist:(bis)=>`Bez odpowiedzi do ${bis} rysunek uznajemy za zatwierdzony (zasada 72 godzin).`,
        dankeOk:'Dziękujemy — wymiary potwierdzone. Produkujemy dokładnie według tego rysunku.',
        dankeAend:'Dziękujemy — otrzymaliśmy prośbę o zmianę, wstrzymujemy produkcję i odezwiemy się.',
        schonOk:(z)=>`Rysunek został potwierdzony ${z}.`, schonAuto:'Rysunek został zatwierdzony po 72 godzinach bez sprzeciwu.',
        schonAend:'Do tego zamówienia zgłoszono zmianę — odezwiemy się.', nicht:'Ten link jest nieprawidłowy lub wygasł.',
        hinweisWiderruf:'Produkty na wymiar nie podlegają zwrotowi — stąd ten dodatkowy krok.' },
  en: { titel:'Check the drawing', hallo:'Please check the technical drawing for your order', bestellung:'Order', pos:'Item',
        pdf:'Open PDF', ok:'Confirm dimensions', okHint:'Once confirmed, we produce exactly to this drawing.',
        aend:'Request a change', aendHint:'Briefly describe what should be different — we will get back to you with a corrected drawing.',
        name:'Your name', text:'What should be changed?', senden:'Send', abbrechen:'Back',
        frist:(bis)=>`Without a reply by ${bis} the drawing is deemed confirmed (72-hour rule).`,
        dankeOk:'Thank you — the dimensions are confirmed. We now produce exactly to this drawing.',
        dankeAend:'Thank you — we have received your change request, paused production and will get back to you.',
        schonOk:(z)=>`This drawing was confirmed on ${z}.`, schonAuto:'This drawing was released after 72 hours without objection.',
        schonAend:'A change request exists for this order — we will get back to you.', nicht:'This link is invalid or has expired.',
        hinweisWiderruf:'Made-to-measure items are excluded from withdrawal — hence this step.' },
};
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const CSS = `body{margin:0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#f4f2ee;color:#1e1e1e}
.w{max-width:960px;margin:0 auto;padding:24px 16px 48px}h1{font-size:22px;margin:0 0 4px}.m{color:#666;font-size:14px;margin:0 0 20px}
.k{background:#fff;border:1px solid #e3e0da;border-radius:10px;padding:16px;margin:0 0 16px}.k h2{font-size:16px;margin:0 0 10px}
.z{border:1px solid #ddd;background:#fff;width:100%;height:auto;border-radius:6px}.z svg{width:100%;height:auto;display:block}
.b{display:inline-block;padding:12px 20px;border-radius:8px;font-weight:600;text-decoration:none;border:0;cursor:pointer;font-size:15px;margin:4px 8px 4px 0}
.b.p{background:#1e1e1e;color:#fff}.b.s{background:#fff;color:#1e1e1e;border:1px solid #bbb}.hint{color:#666;font-size:13px;margin:8px 0 0}
.ok{background:#e8f5e9;border-color:#a5d6a7}.warn{background:#fff7e6;border-color:#f1d59a}textarea,input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #bbb;border-radius:6px;font:inherit;margin:6px 0 12px}
a.l{color:#1f4e79}`;

export function freigabeSeite(auftrag, svgs, opt = {}){
  const spr = (auftrag && auftrag.sprache) || opt.sprache || 'de';
  const t = T[spr] || T.de;
  if(!auftrag) return html(t.titel, `<div class="k warn">${t.nicht}</div>`);
  const kopf = `<h1>${t.titel}</h1><p class="m">${t.bestellung} <b>${esc(auftrag.name)}</b>${auftrag.kunde ? ' · ' + esc(auftrag.kunde) : ''}</p>`;
  let status = '';
  if(opt.gerade === 'ok') status = `<div class="k ok">${t.dankeOk}</div>`;
  else if(opt.gerade === 'aenderung') status = `<div class="k ok">${t.dankeAend}</div>`;
  else if(auftrag.status === 'freigegeben') status = `<div class="k ok">${t.schonOk(esc(auftrag.freigabe && auftrag.freigabe.zeit))}</div>`;
  else if(auftrag.status === 'auto') status = `<div class="k ok">${t.schonAuto}</div>`;
  else if(auftrag.status === 'aenderung') status = `<div class="k warn">${t.schonAend}</div>`;
  const bilder = auftrag.positionen.map((p, i) => `<div class="k"><h2>${t.pos} ${p.idx}: ${esc(p.titel)}</h2>
<div class="z">${svgs[i] || ''}</div><p class="hint"><a class="l" href="${opt.base}/z/${auftrag.token}/${p.dateien.kunde_pdf}" target="_blank">${t.pdf}</a></p></div>`).join('');
  let aktion = '';
  if(auftrag.status === 'offen' && !opt.gerade){
    if(opt.a === 'aenderung'){
      aktion = `<div class="k"><h2>${t.aend}</h2><p class="hint" style="margin:0 0 8px">${t.aendHint}</p>
<form method="post"><input type="hidden" name="a" value="aenderung"><label>${t.name}<input name="name" value="${esc(auftrag.kunde)}"></label>
<label>${t.text}<textarea name="text" rows="5" required></textarea></label>
<button class="b p" type="submit">${t.senden}</button> <a class="b s" href="${opt.base}/freigabe/${auftrag.token}">${t.abbrechen}</a></form></div>`;
    } else {
      aktion = `<div class="k"><p style="margin:0 0 6px">${t.hallo}.</p><p class="hint" style="margin:0 0 14px">${t.okHint} ${t.hinweisWiderruf}</p>
<form method="post" style="display:inline"><input type="hidden" name="a" value="ok"><input type="hidden" name="name" value="${esc(auftrag.kunde)}"><button class="b p" type="submit">${t.ok}</button></form>
<a class="b s" href="${opt.base}/freigabe/${auftrag.token}?a=aenderung">${t.aend}</a>
<p class="hint">${t.frist(esc(opt.fristText||''))}</p></div>`;
    }
  }
  return html(`${t.titel} · ${auftrag.name}`, kopf + status + aktion + bilder);
}

function html(titel, body){
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(titel)} · Kessler PRO</title><style>${CSS}</style></head><body><div class="w"><p style="font-weight:800;letter-spacing:.04em;margin:0 0 18px">KESSLER PRO</p>${body}</div></body></html>`;
}
