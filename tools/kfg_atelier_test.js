/* Prueft die Atelier-Oberflaeche (dist/konfigurator-atelier.js) auf einer Seite, die
   sich bewusst wie Webflow verhaelt: eigene Schrift, eigene Farben, eigene Knoepfe.
   Geprueft werden Abschottung, alle vier Formen, Eckenradien, der Anfragefall,
   PL/EN und der Weg von mehreren Platten in Worker + Shopyflow.
   Start:  cd <repo> && python3 -m http.server 8765 &   dann  node tools/kfg_atelier_test.js */
const {chromium}=require(process.env.PW||'/home/claude/.npm-global/lib/node_modules/playwright');
const HOST=process.env.KFG_HOST||'http://127.0.0.1:8765';
const fs=require('fs'), path=require('path');

/* Die Spiegelseiten liegen bewusst nicht im Repo (_spiegel/ ist ausgenommen).
   Sie verhalten sich absichtlich wie Webflow: eigene Schrift, eigene Farben,
   eigene Knoepfe - und bringen einen Stub-Worker samt Stub-Shopyflow mit. */
function spiegelSchreiben(){
  const dir=path.join(__dirname,'..','_spiegel');
  fs.mkdirSync(dir,{recursive:true});
  const html=lang=>`<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Atelier auf einer Webflow-aehnlichen Seite</title>
<style>*{box-sizing:content-box}body{margin:0;font-family:Georgia,serif;background:#fffdf8;color:#333}
h1,h2,h3{font-family:Georgia,serif;color:#7a2020;margin:0 0 12px}
button{font-family:Georgia,serif;background:#7a2020;color:#fff;border:2px solid #000;padding:12px;border-radius:0}
a{color:#7a2020}p{line-height:2.2;margin:0 0 24px}
.wf-header{background:#7a2020;color:#fff;padding:20px 40px;display:flex;gap:24px;align-items:center}
.wf-footer{background:#222;color:#fff;padding:40px;margin-top:60px}
.wf-wrap{max-width:1440px;margin:0 auto;padding:0 40px}</style></head><body>
<header class="wf-header"><strong>KESSLER PRO</strong><a href="#">Shop</a><button id="wfCart">Warenkorb (0)</button></header>
<div class="wf-wrap"><h2>Webflow-\u00dcberschrift oberhalb</h2><p>Ein Absatz der Seite.</p></div>
<div class="wf-wrap"><main data-kfg-root></main></div>
<footer class="wf-footer"><h3>Webflow-Fu\u00dfzeile</h3><p>Bleibt in Georgia und dunkelrot.</p></footer>
<script>
window.__CALLS={worker:[],cart:[]};
window.Shopyflow={addToCart:function(o){window.__CALLS.cart.push(JSON.parse(JSON.stringify(o)));
  var n=window.__CALLS.cart.reduce(function(s,c){return s+c.lineItems.reduce(function(a,l){return a+l.quantity;},0);},0);
  document.getElementById('wfCart').textContent='Warenkorb ('+n+')';return Promise.resolve({ok:true});},
  openCart:function(){window.__CALLS.opened=(window.__CALLS.opened||0)+1;}};
var echt=window.fetch.bind(window);
window.fetch=function(u,o){var s=String(u&&u.url||u);
  if(s.indexOf('/warenkorb')>-1){var body=JSON.parse(o.body);window.__CALLS.worker.push(body);
    var i=window.__CALLS.worker.length;
    return Promise.resolve(new Response(JSON.stringify({variantId:'gid://shopify/ProductVariant/900000000'+i,
      preis:body.preis,attribute:[{key:'_kfg_token',value:'tok'+i},{key:'Ma\u00dfe',value:body.konfig.L+' x '+body.konfig.B+' cm'},
      {key:'Form',value:body.konfig.form}]}),{status:200,headers:{'Content-Type':'application/json'}}));}
  return echt(u,o);};
<\/script>
<script src="/dist/konfigurator-atelier.js"><\/script></body></html>`;
  for(const [lang,datei] of [['de','atelier.html'],['pl','atelier-pl.html'],['en','atelier-en.html']])
    fs.writeFileSync(path.join(dir,datei),html(lang));
}
spiegelSchreiben();
let gruen=0; const rot=[];
const pruef=(name,ok,detail)=>{ if(ok)gruen++; else rot.push(name+(detail?' — '+detail:'')); };

(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium',
    args:['--no-sandbox','--disable-gpu','--use-gl=swiftshader']});
  const seite=async(vp,lang,mobil)=>{
    const ctx=await b.newContext({viewport:vp,isMobile:!!mobil,hasTouch:!!mobil,deviceScaleFactor:mobil?2:1});
    const p=await ctx.newPage();
    p.on('pageerror',e=>rot.push('JS-Fehler: '+e.message));
    await p.goto(`${HOST}/_spiegel/atelier${lang==='de'?'':'-'+lang}.html`,{waitUntil:'load'});
    await p.waitForFunction(()=>document.querySelector('[data-kfg-root]')?.dataset.ready==='true',{timeout:40000});
    await p.waitForTimeout(2200);
    p.klick=async s=>{await p.evaluate(x=>document.querySelector(x).click(),s);await p.waitForTimeout(450);};
    p.feld=async(s,v)=>{await p.evaluate(([x,val])=>{const e=document.querySelector(x);e.value=val;
      e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},[s,v]);await p.waitForTimeout(650);};
    return {ctx,p};
  };

  /* ① Abschottung gegen die Seite ------------------------------------------------ */
  {
    const {ctx,p}=await seite({width:1440,height:1000},'de');
    const r=await p.evaluate(()=>{
      const a=getComputedStyle(document.querySelector('#atelier h1'));
      const s=getComputedStyle(document.querySelector('.wf-wrap h2'));
      const k=getComputedStyle(document.getElementById('wfCart'));
      return {atelier:a.fontFamily,seite:s.fontFamily,seiteFarbe:s.color,knopf:k.backgroundColor,knopfRadius:k.borderRadius};
    });
    pruef('① Atelier nutzt Onest',/Onest/.test(r.atelier),r.atelier);
    pruef('① Seite behaelt ihre Schrift',/Georgia/.test(r.seite),r.seite);
    pruef('① Seite behaelt ihre Farbe',r.seiteFarbe==='rgb(122, 32, 32)',r.seiteFarbe);
    pruef('① Seitenknopf unveraendert',r.knopf==='rgb(122, 32, 32)'&&r.knopfRadius==='0px',r.knopf+' / '+r.knopfRadius);
    await ctx.close();
  }

  /* ② Formen, Radien, Anfrage — Desktop und Mobil -------------------------------- */
  for(const [name,vp,mobil] of [['Desktop',{width:1440,height:1000},false],['Mobil',{width:390,height:844},true]]){
    const {ctx,p}=await seite(vp,'de',mobil);
    await p.klick('[data-step="1"]');
    for(const [form,a,bb] of [['rect','140','70'],['round','110',null],['lform','180','90'],['bauch','200','90']]){
      await p.klick(`[data-shape="${form}"]`);
      if(form==='round') await p.feld('#inD',a); else { await p.feld('#inL',a); await p.feld('#inB',bb); }
      const r=await p.evaluate(()=>({form:window.KFG.getConfig().form,
        preis:document.getElementById('atelierPrice').textContent,
        zeichnung:(document.getElementById('stage')?.innerHTML||'').length}));
      pruef(`② ${name} Form ${form}`, r.form===form && /\d/.test(r.preis) && r.zeichnung>500, JSON.stringify(r));
    }
    await p.klick('[data-shape="lform"]');
    await p.evaluate(()=>document.getElementById('cornerGroup').open=true);
    for(const [wert,erwartet] of [[0,0],[30,5],[50,5]]){
      await p.evaluate(v=>{const i=document.querySelector('#cornerBlock input');i.value=v;
        i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));},wert);
      await p.waitForTimeout(650);
      const e=await p.evaluate(()=>window.KFG.atelier.cornerDetails());
      pruef(`② ${name} L-Form R${wert}`, e.length===erwartet && e.every(c=>c.number&&c.name), JSON.stringify(e.map(c=>c.number+':R'+c.radius)));
    }
    await p.klick('[data-step="2"]');
    await p.evaluate(()=>{document.getElementById('customGroup').open=true;
      const cb=document.querySelector('#grpCustom input[type=checkbox]'); if(cb&&!cb.checked)cb.click();});
    await p.waitForTimeout(900);
    await p.klick('[data-step="3"]');
    const an=await p.evaluate(()=>({offer:window.KFG.atelier.snapshot().offer,
      knopf:document.getElementById('continueStep').textContent.trim(),
      preis:document.getElementById('atelierPrice').textContent}));
    pruef(`② ${name} Anfragefall bleibt Anfrage`, an.offer===true && /Anfrage|zapytanie|enquiry/i.test(an.knopf) && /Anfrage|request/i.test(an.preis), JSON.stringify(an));
    await ctx.close();
  }

  /* ③ Sprachen: Preis, Waehrung, keine deutschen Reste --------------------------- */
  for(const [lang,waehrung,versand] of [['de','€','19,99'],['pl','zł','84,90'],['en','€','19.99']]){
    const {ctx,p}=await seite({width:1440,height:1000},lang);
    await p.klick('[data-step="1"]'); await p.feld('#inL','163');
    await p.klick('[data-step="3"]');
    const r=await p.evaluate(()=>({preis:document.getElementById('atelierPrice').textContent,
      steuer:document.getElementById('atelierTax').textContent}));
    pruef(`③ ${lang}: Waehrung`, r.preis.includes(waehrung), r.preis);
    pruef(`③ ${lang}: Versandpauschale`, r.steuer.includes(versand), r.steuer);
    await p.klick('[data-dialog="materialDialog"]');
    const deutsch=await p.evaluate(()=>{
      const raus=[]; const de=/[äöüßÄÖÜ]|\b(der|die|das|und|oder|dein|deine|nicht|für|wählen|ändern)\b/i;
      for(const root of [document.querySelector('[data-kfg-root]'),...document.querySelectorAll('dialog.atelier_dialog')]){
        if(!root)continue;
        const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null);
        let n; while((n=w.nextNode())){const t=(n.nodeValue||'').trim(); if(t&&de.test(t))raus.push(t);}
      } return [...new Set(raus)];});
    if(lang!=='de') pruef(`③ ${lang}: keine deutschen Reste`, deutsch.length===0, deutsch.slice(0,5).join(' | '));
    await ctx.close();
  }

  /* ④ Vier gleiche + eine abweichende Platte in Worker und Shopyflow ------------- */
  {
    const {ctx,p}=await seite({width:1440,height:1000},'de');
    await p.klick('[data-step="1"]'); await p.feld('#inL','160'); await p.feld('#inB','80');
    await p.klick('[data-step="3"]'); await p.klick('#continueStep');
    await p.waitForTimeout(600);
    await p.evaluate(()=>{const i=document.querySelector('[data-quantity]');i.value=4;i.dispatchEvent(new Event('change',{bubbles:true}));});
    await p.waitForTimeout(500);
    await p.klick('[data-another-plate]');
    await p.klick('[data-step="1"]'); await p.klick('[data-shape="bauch"]');
    await p.feld('#inL','200'); await p.feld('#inB','90');
    await p.klick('[data-step="3"]'); await p.klick('#continueStep');
    await p.waitForTimeout(600);
    const vor=await p.evaluate(()=>({stueck:document.getElementById('cartCount').textContent,
      positionen:document.querySelectorAll('.cart_item').length}));
    pruef('④ Entwurfskorb: 5 Stueck in 2 Konfigurationen', vor.stueck==='5'&&vor.positionen===2, JSON.stringify(vor));
    await p.klick('[data-preview-checkout]');
    await p.waitForTimeout(2500);
    const r=await p.evaluate(()=>({
      worker:window.__CALLS.worker.map(x=>({preis:x.preis,form:x.konfig.form,L:x.konfig.L,B:x.konfig.B,version:x.version})),
      cart:window.__CALLS.cart.flatMap(c=>c.lineItems).map(l=>({id:l.merchandiseId,menge:l.quantity,
        token:(l.attributes.find(a=>a.key==='_kfg_token')||{}).value,attrs:l.attributes.length})),
      offen:window.__CALLS.opened||0, rest:document.getElementById('cartCount').textContent}));
    pruef('④ ein Worker-Aufruf je Konfiguration', r.worker.length===2, JSON.stringify(r.worker));
    pruef('④ Stueckpreis je Platte, nicht mal Menge', r.worker[0]&&r.worker[0].preis<300, JSON.stringify(r.worker.map(w=>w.preis)));
    pruef('④ Mengen getrennt uebertragen', r.cart.length===2&&r.cart[0].menge===4&&r.cart[1].menge===1, JSON.stringify(r.cart.map(c=>c.menge)));
    pruef('④ eigener Token je Konfiguration', r.cart[0]&&r.cart[1]&&r.cart[0].token&&r.cart[1].token&&r.cart[0].token!==r.cart[1].token, JSON.stringify(r.cart.map(c=>c.token)));
    pruef('④ Attribute vollstaendig uebernommen', r.cart.every(c=>c.attrs>=3), JSON.stringify(r.cart.map(c=>c.attrs)));
    pruef('④ Warenkorb genau einmal geoeffnet', r.offen===1, String(r.offen));
    pruef('④ Entwurfskorb danach leer', r.rest==='0', r.rest);
    await ctx.close();
  }

  await b.close();
  console.log(`\n${gruen} Zusicherungen gruen, ${rot.length} rot`);
  if(rot.length){ rot.forEach(r=>console.log('  ✗ '+r)); process.exit(1); }
})().catch(e=>{console.error('ABBRUCH',e);process.exit(1);});
