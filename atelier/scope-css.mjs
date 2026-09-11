/* atelier.css stammt aus der eigenstaendigen Vorschau: sie bringt globale Resets und
   einen eigenen Header/Footer mit. Auf der Webflow-Seite wuerde beides die Seite
   uebernehmen. Diese Datei schneidet die Vorschau-Huelle heraus und haengt alles
   Uebrige unter #atelier bzw. .atelier_dialog. */
const SCOPE=':is(#atelier,.atelier_dialog)';
/* Kopf und Fuss der Vorschau - auf der echten Seite kommen sie von Webflow. */
const DROP=[/^\.draftbar/,/^\.site_header/,/^\.brand/,/^\.header_cart/,/^\.site_footer/,/^\.nav_current/,/^::selection$/,/^body$/];
/* Diese Selektoren stehen bereits fuer sich - nicht anfassen. */
const KEEP=[/^#atelier/,/^\.atelier_dialog/,/^body\.preview_open/,/^html/];

function regeln(text){
  const out=[];let i=0,tiefe=0,puffer='',sel='',start=0;
  while(i<text.length){
    const ch=text[i];
    if(ch==='{'){ if(++tiefe===1){ sel=puffer.trim(); puffer=''; start=i+1; i++; continue; } }
    else if(ch==='}'){ if(--tiefe===0){ out.push({sel,body:text.slice(start,i),vor:''}); puffer=''; i++; continue; } }
    puffer+=ch;i++;
  }
  if(puffer.trim())out.push({sel:null,body:puffer,vor:''});
  return out;
}
function selektor(one){
  const s=one.trim();
  if(!s)return null;
  if(KEEP.some(r=>r.test(s)))return s;
  if(DROP.some(r=>r.test(s)))return null;
  if(s==='dialog::backdrop')return '.atelier_dialog::backdrop';
  if(s==='*')return SCOPE+' *';
  return SCOPE+' '+s;
}
function block(text){
  return regeln(text).map(r=>{
    if(r.sel===null)return '';                                   /* Kommentare zwischen Regeln */
    /* Ein Kommentar direkt vor einer At-Regel gehoert beim Zerlegen zum
       Selektortext. Ohne ihn herauszurechnen begann der Text nicht mit '@media',
       die Regel galt als Selektor und bekam den Scope davorgesetzt — der Browser
       warf den ganzen Block weg (gefunden 11.09., Spaltenmasse wirkten nicht). */
    const kommentar=(r.sel.match(/\/\*[\s\S]*?\*\//g)||[]).join('');
    const rein=r.sel.replace(/\/\*[\s\S]*?\*\//g,'').trim();
    if(rein.startsWith('@media')||rein.startsWith('@supports'))return kommentar+rein+'{'+block(r.body)+'}';
    if(/^@(font-face|keyframes|-webkit-keyframes|page|property)/.test(rein))return kommentar+rein+'{'+r.body+'}';
    if(rein===':root'){
      /* Nur die Farbtokens bleiben global; Schrift und Hintergrund gehoeren der Seite. */
      const vars=r.body.split(';').filter(d=>d.trim().startsWith('--')).join(';');
      return vars?':root{'+vars+'}':'';
    }
    const sel=rein.split(',').map(selektor).filter(Boolean).join(',');
    return sel?kommentar+sel+'{'+r.body+'}':'';
  }).join('');
}
/* Die Seite stylt ihre eigenen h1-h6, p, li direkt. Eine direkt gesetzte Regel
   schlaegt jede Vererbung — ohne diesen Riegel faerbt die Webflow-Seite die
   Ueberschriften im Konfigurator und in seinen Dialogen mit. Er steht ganz vorn,
   damit die eigenen Regeln des Ateliers ihn danach ueberschreiben koennen. */
const RIEGEL=SCOPE+" :is(h1,h2,h3,h4,h5,h6,p,li,dt,dd,summary,label,small,strong,b,em,figcaption)"
  +"{font-family:inherit;color:inherit;letter-spacing:normal;text-transform:none}";
export function scopeCss(css){
  return SCOPE+"{font-family:Onest,system-ui,-apple-system,'Segoe UI',sans-serif;font-synthesis:none;color:var(--ink);-webkit-font-smoothing:antialiased}"
    +RIEGEL+block(css);
}
