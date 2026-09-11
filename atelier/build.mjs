/* Baut aus dem unveraenderten Kern (dist/konfigurator.js) zwei Fassungen:
 *   node build.mjs            -> engine.js fuer die lokale Designvorschau (index.html)
 *   node build.mjs --live     -> ../dist/konfigurator-atelier.js, eine einzelne
 *                                klassische Datei fuer Webflow: Kern + Atelier-UI + CSS.
 * Der Kern selbst wird nie editiert, nur an klar benannten Ankern gepatcht. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scopeCss} from './scope-css.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const LIVE=process.argv.includes('--live');
/* Eine einzige Quelle: der Kern im Repo. Die Vorschau bekommt dieselbe Datei,
   nur mit lokalen Pfaden - so koennen die beiden Fassungen nie auseinanderlaufen. */
const QUELLE=path.join(dir,'..','dist','konfigurator.js');
const source=fs.readFileSync(QUELLE,'utf8');
let core=LIVE?source:source.replace(/var FALLBACK_BASE = '[^']+';/,"var FALLBACK_BASE = '.';");
const replaceOnce=(before,after)=>{if(!core.includes(before))throw new Error('Missing original adapter anchor: '+before.slice(0,70));core=core.replace(before,after);};
replaceOnce('const $=id=>document.getElementById(id);','const ATELIER_DEFAULT=JSON.parse(JSON.stringify(S));\nconst $=id=>document.getElementById(id);');
/* Der Codex-Entwurf setzte texCm() hart auf null. Fuer die KI-Atlanten ist das
   richtig - sie zeigen 300 x 200 cm und laufen ueber die ganze Platte. Fuer alle
   anderen Dekore ist es falsch: deren Foto zeigt 40 cm Oberflaeche und wird
   gekachelt. Ueber die ganze Platte gezogen wurde aus der feinen Struktur von
   Weiss ein grobes, glaenzendes Muster (Sascha, 11.09.). */
replaceOnce("function texCm(){ const v=TEX_CM[texKey()]; return v===undefined ? 40 : v; }",
  "function texCm(){ if(ATELIER_ATLASES[texKey()]) return null; const v=TEX_CM[texKey()]; return v===undefined ? 40 : v; }");
const atlases=JSON.parse(fs.readFileSync(path.join(dir,'texture-atlases.json'),'utf8'));
/* Live kommen die Atlanten aus demselben Commit wie das Skript, nicht vom Webflow-Host. */
const atlasJs=LIVE
  ? 'Object.fromEntries(Object.entries('+JSON.stringify(atlases)+').map(([k,v])=>[k,Object.assign({},v,{src:ASSET+v.src.replace(/^\\.\\/assets\\/kfg\\//,\'\')})]))'
  : JSON.stringify(atlases);
replaceOnce("const TEX_THUMB = Object.fromEntries(Object.entries(TEX).map(([k,u])=>[k,u.replace('/top/','/thumb/')]));", "const TEX_THUMB = Object.fromEntries(Object.entries(TEX).map(([k,u])=>[k,u.replace('/top/','/thumb/')]));\nconst ATELIER_ATLASES="+atlasJs+';');
replaceOnce("function stageTex(k){ return _texOk[k] ? TEX[k] : (TEX_THUMB[k] || TEX[k]); }", "function stageTex(k){ return ATELIER_ATLASES[k]?.src || (_texOk[k] ? TEX[k] : (TEX_THUMB[k] || TEX[k])); }");
replaceOnce('function texPattern(x,y,T,href,pw,ph){',`function texPattern(x,y,T,href,pw,ph){
  const atlas=ATELIER_ATLASES[texKey()];
  if(atlas){
    const d=dims(), sc=pw/d.w, tw=atlas.widthCm*sc, th=atlas.heightCm*sc;
    const ox=x-(tw-pw)/2, oy=y-(th-ph)/2;
    return '<pattern id="texPat" patternUnits="userSpaceOnUse" x="'+ox+'" y="'+oy+'" width="'+tw+'" height="'+th+'"><image href="'+atlas.src+'" width="'+tw+'" height="'+th+'" preserveAspectRatio="xMidYMid slice"/></pattern>';
  }`);
replaceOnce('const w=im.naturalWidth, h=im.naturalHeight, ix=Math.round(w*TEX_RAND), iy=Math.round(h*TEX_RAND);','const w=im.naturalWidth, h=im.naturalHeight, border=ATELIER_ATLASES[key]?0:TEX_RAND, ix=Math.round(w*border), iy=Math.round(h*border);');
replaceOnce('  im.src=TEX[key];','  im.src=ATELIER_ATLASES[key]?.src||TEX[key];');
replaceOnce('for(let i=0;i<uv.count;i++) uv.setXY(i, pos.getX(i)/M+0.5, pos.getY(i)/M+0.5);','const atlas=ATELIER_ATLASES[texKey()], uw=atlas?atlas.widthCm/10:M, uh=atlas?atlas.heightCm/10:M;\n      for(let i=0;i<uv.count;i++) uv.setXY(i, pos.getX(i)/uw+0.5, pos.getY(i)/uh+0.5);');
const drawing=fs.readFileSync(path.join(dir,'drawing-adapter.js'),'utf8');
replaceOnce("const PADL=S.form==='lform'?rand:16, PADR=rand, PADB=rand;", "const PADL=S.form==='lform'?rand:16, PADR=rand, PADB=rand+(S.form==='bauch'?42:0);");
replaceOnce("inner+=dimH(x,x+pw,y+ph+30,bg.L+' cm')+dimV(x+pw+30,y,y+ph,bg.BR+' cm');", "inner+=`<path d=\"${pd}\" fill=\"none\" stroke=\"#343434\" stroke-width=\"1.8\" stroke-linejoin=\"round\" pointer-events=\"none\"/>`;\n    inner+=dimH(x,x+pw,y+ph+72,bg.L+' cm')+dimV(x+pw+30,y,y+ph,bg.BR+' cm');");
replaceOnce('function drawStage(){',drawing+'\nfunction drawStage(){');
const notchStart=core.indexOf('    /* in der aeusseren Ecke der Ausklinkung');
const notchEnd=core.indexOf('    if(cornerCount()>0)',notchStart);
if(notchStart<0||notchEnd<0)throw new Error('Missing notch annotation anchors');
core=core.slice(0,notchStart)+'    inner+=atelierNotchDimensions(x,y,sc,pw,ph,lg);\n'+core.slice(notchEnd);
const bauchStart=core.indexOf("    const zz=v=>(''+(Math.round(v*10)/10)).replace('.',',');",core.indexOf('function drawStage(){'));
const bauchEnd=core.indexOf('    if(cornerCount()>0)',bauchStart);
if(bauchStart<0||bauchEnd<0)throw new Error('Missing belly annotation anchors');
core=core.slice(0,bauchStart)+'    inner+=atelierBauchDimensions(x,y,sc,pw,ph,bg);\n'+core.slice(bauchEnd);
const cornerSummary='    if(cornerCount()>0) inner+=`<text class="dim-text" x="${x+8}" y="${y-10}">Ecken: ${cornerLabel()}</text>`;';
if(core.split(cornerSummary).length!==4)throw new Error('Expected three drawing corner summaries');
core=core.split(cornerSummary).join('    inner+=atelierCornerMarkers(x,y,sc,pw,ph);');
/* Layout gehoert der neuen Oberflaeche - in beiden Fassungen. */
for(const name of ['updateSticky','updateBottomBar','placeSummary']) core=core.replace(`function ${name}(){`,`function ${name}(){ return; // Layout owned by atelier UI\n`);
core=core.replace('function kopfleisteZeigen(zeigen){','function kopfleisteZeigen(zeigen){ return;\n');
core=core.replace('function weiterZu(n){','function weiterZu(n){ return;\n');
core=core.replace('Object.assign(S, patch||{}); buildAll(); render();','Object.assign(S, patch||{}); [["inL",S.L],["inB",S.B],["inD",S.D]].forEach(([id,v])=>{if($(id))$(id).value=v;}); buildAll(); render();');
if(!LIVE){
  core=core.replace("const CHECKOUT_DEFAULT='https://kessler-konfigurator-checkout.kessler-konfigurator-checkout.workers.dev/checkout';","const CHECKOUT_DEFAULT='';");
  core=core.replace('function ga(ev, p){','function ga(ev, p){ return;\n');
  for(const name of ['checkoutStarten','warenkorbStarten','sofortkaufStarten']) core=core.replace(`function ${name}(){`,`function ${name}(){ toast('Diese Designvorschau löst keine Bestellung aus.'); return;\n`);
  core=core.replace("s.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';","s.src='./vendor/three.min.js';");
}
core=core.replace('function render(){','function render(){ try { renderAtelierCore(); } finally { window.dispatchEvent(new CustomEvent("kfg:change")); } }\nfunction renderAtelierCore(){');
/* Nur der Live-Build braucht den Weg in den echten Warenkorb. Der Worker legt je
   Konfiguration eine Variante mit dem Stueckpreis an; die Stueckzahl geht getrennt
   als quantity an Shopyflow, der Versand danach ueber den gesamten Warenkorb. */
const LIVE_API=`,
      assetBase:function(){ return ASSET; },
      orderIntent:function(){
        const hit=nurLager()&&shopHit();
        return { body: bodyFuerWorker(), lager: hit?{variantId:'gid://shopify/ProductVariant/'+hit[1], sku:hit[2]}:null, anfrage: !kannBezahlen() && !hit };
      },
      checkout:async function(intent, menge){
        const m=Number.isSafeInteger(menge)&&menge>0?menge:1;
        if(!shopyflow()) throw new Error('Der Warenkorb des Shops ist gerade nicht erreichbar');
        if(intent && intent.lager) return inWarenkorbLegen(intent.lager.variantId, [], m);
        if(!WARENKORB_URL) throw new Error('Kein Warenkorb-Endpunkt hinterlegt');
        const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),20000);
        try{
          const r=await fetch(WARENKORB_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(intent.body),signal:ctl.signal});
          const d=await r.json().catch(()=>null);
          if(!(r.ok && d && d.variantId)) throw new Error((d&&d.fehler)||'Der Shop hat keine Variante geliefert');
          /* Der Server rechnet selbst nach: weicht sein Preis ab, wird nichts gelegt. */
          if(isFinite(+intent.body.preis) && isFinite(+d.preis) && Math.abs(+d.preis - +intent.body.preis) > 0.011)
            throw new Error('Der Preis hat sich geändert - bitte die Platte neu prüfen');
          return await inWarenkorbLegen(d.variantId, d.attribute||[], m);
        } finally { clearTimeout(tm); }
      },
      openCart:function(){ const sf=shopyflow(); try{ if(sf && typeof sf.openCart==='function') sf.openCart(); }catch(_){} },
      inquiry:anfrageMail,
      /* Die neue Oberflaeche schreibt Text nach dem Render des Kerns - die
         Wortliste laeuft danach noch einmal darueber. Dialoge liegen an <body>
         und muessen einzeln uebergeben werden. */
      translate:function(el){ try{ uebersetze(el||undefined); }catch(_){} },
      lang:function(){ return KFG_LANG; },
      /* Erst wenn die Wortliste da ist, lohnt ein zweiter Lauf ueber die Dialoge. */
      wortlisteDa:function(){ return !!_kfgWB; },
      money:fmt,
      shipping:function(){ return { betrag: kanal()==='pln' ? 84.90 : 19.99, text: VERSAND_MASS[kanal()] }; }`;
core=core.replace('version: VERSION,',`version: VERSION,
    atelier: {
      snapshot: function(){ return { config:JSON.parse(JSON.stringify(S)), price:calc(), standard:isStandard(), offer:needsOffer(), valid:validate(), dims:dims(), material:MATERIALS[S.mat], dekore:dekorList(), texture:TEX[texKey()], edgePhoto:edgePhoto(), edgeNames:[...new Set(S.edges.map(edgeLabel))], cornerLabel:cornerLabel(), rules:rules(), cuts:S.cuts.map(c=>({label:cutTypName(c),mass:cutMass(c),price:cutPrice(c),warning:cutWarn(c)})), minEdge:cutMinEdge(), shape:S.form==='lform'?lfPts():S.form==='bauch'?bsPts():null }; },
      setView:setView, frame:frame3D, render:render, syncLink:_syncURLnow,
      workerBody:bodyFuerWorker,
      defaultConfig:function(){return JSON.parse(JSON.stringify(ATELIER_DEFAULT));},
      textureInfo:function(){return ATELIER_ATLASES[texKey()]||null;},
      cornerDetails:atelierCornerDetails,
      outline:function(){ if(S.form==='round')return null; const g=S.form==='lform'?lfPts():S.form==='bauch'?bsPts():null; return g?roundPoly(g.pts,g.rad):roundPath(0,0,+S.L,+S.B,S.cornerR.map(r=>r/10)); },
      material:function(k){ const b=document.querySelector('#matGrid [data-m="'+k+'"]'); if(b)b.click(); },
      shape:function(k){ const b=document.querySelector('#formChips [data-form="'+k+'"]'); if(b)b.click(); },
      preset:addPreset,
      cutLabel:cutTypName${LIVE?LIVE_API:''}
    },`);
if(LIVE){
  /* Die Datei heisst anders als der Kern - sonst faende sie ihre eigene Basis nicht
     und haenge fuer immer an FALLBACK_BASE. */
  core=core.replace("var i = me.indexOf('/dist/konfigurator.js');","var i = me.indexOf('/dist/konfigurator-atelier.js'); if(i<0) i = me.indexOf('/dist/konfigurator.js');");
  core=core.replace('script[src*="konfigurator.js"]','script[src*="konfigurator"]');
  /* Bei mehreren Platten wuerde die Schublade nach jeder Position aufspringen -
     die neue Oberflaeche oeffnet sie einmal, wenn alles uebergeben ist. */
  core=core.replace("  try{ if(typeof sf.openCart==='function') sf.openCart(); }catch(_){}\n","  /* openCart: die Atelier-Oberflaeche oeffnet den Warenkorb selbst, erst am Ende */\n");
  /* Die Stueckzahl muss bis zu Shopyflow durchgereicht werden - vorher fest 1. */
  const alt="await Promise.race([Promise.resolve(sf.addToCart({ lineItems:[{ merchandiseId: variantId, quantity:1, attributes: attribute||[] }], useShopifyId:true })), frist]);";
  if(!core.includes(alt))throw new Error('Missing inWarenkorbLegen anchor');
  core=core.replace('async function inWarenkorbLegen(variantId, attribute){','async function inWarenkorbLegen(variantId, attribute, menge){');
  core=core.replace(alt,"await Promise.race([Promise.resolve(sf.addToCart({ lineItems:[{ merchandiseId: variantId, quantity:(Number.isSafeInteger(menge)&&menge>0?menge:1), attributes: attribute||[] }], useShopifyId:true })), frist]);");
}

if(!LIVE){
  fs.writeFileSync(path.join(dir,'engine.js'),core);
  const assets=[];
  for(const [folder,name] of [['top','TEX'],['kante','KANTE']]){
   const m=source.match(new RegExp('const '+name+' = Object.fromEntries\\((\\[[^\\n]+?\\])\\.map'));
   if(!m)throw new Error('Missing asset list '+name);
   for(const key of JSON.parse(m[1])){
    assets.push(`assets/kfg/${folder}/${key}.webp`);
    if(folder==='top')assets.push(`assets/kfg/thumb/${key}.webp`);
   }
  }
  assets.push('dist/data/kfg-produktmatrix.json','dist/data/kfg-preiskurven.json');
  fs.writeFileSync(path.join(dir,'asset-manifest.json'),JSON.stringify({source:'https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@de6f324',date:'2026-09-10',files:assets},null,2));
  console.log('Vorschau gebaut: engine.js, '+assets.length+' Quellbilder.');
}else{
  /* Ein einziges klassisches Skript: Webflow kennt keine Module in registrierten Skripten. */
  const ohneExport=t=>t.replace(/^export\s+/gm,'');
  const geometry=ohneExport(fs.readFileSync(path.join(dir,'geometry.mjs'),'utf8'));
  const warenkorb=ohneExport(fs.readFileSync(path.join(dir,'shopify-cart.mjs'),'utf8'))
    .replace(/async function addConfiguredPlate[\s\S]*?\n}\n/,'');   /* Vorlage: der Live-Weg liegt im Kern */
  let ui=fs.readFileSync(path.join(dir,'atelier.js'),'utf8').replace(/^import .*$/gm,'');
  /* Die Huelle kennt die Bild-Basis erst, wenn der Kern lebt - darum hier eingehaengt. */
  ui=ui.replace('started=true;api=window.KFG.atelier;','started=true;api=window.KFG.atelier;atelierShellAufbauen(api);');
  /* Der Entwurfskorb braucht auf der Seite einen eigenen Einstieg (der Kopf gehoert Webflow). */
  const cartKnopf='<div class="atelier_actions"><button class="text_button" id="atelierCart" data-dialog="cartDialog">'+String.fromCharCode(36)+'{svg(\'<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>\')}Deine Platten<span id="cartCount">0</span></button>';
  if(!ui.includes('<button class="text_button" id="shareConfig">'))throw new Error('Missing shareConfig anchor');
  ui=ui.replace('<button class="text_button" id="shareConfig">',cartKnopf+'<button class="text_button" id="shareConfig">');
  ui=ui.replace('Konfiguration teilen</button>','Konfiguration teilen</button></div>');
  /* Webflow liefert Ueberschrift und Einleitung der Seite schon. Der Konfigurator
     wiederholte sie („Deine Tischplatte nach Maß") und schob sich selbst nach
     unten (Codex, 11.09.). Live bleibt nur die Knopfzeile stehen. */
  const introAnker='<div class="page_intro"><div><h1>Deine Tischplatte nach Maß</h1><p>Du bestimmst die Details. Wir fertigen deine Platte.</p></div>';
  if(!ui.includes(introAnker))throw new Error('Missing page_intro anchor');
  ui=ui.replace(introAnker,'<div class="page_intro is_bare">');
  const css=scopeCss(fs.readFileSync(path.join(dir,'atelier.css'),'utf8'));
  const shell=fs.readFileSync(path.join(dir,'live-shell.js'),'utf8')
    .replace('__ATELIER_CSS__',JSON.stringify(css));
  const out=core+'\n\n/* ── Atelier-Oberflaeche (Codex-Entwurf 10.09.2026, fuer Webflow gescopt) ── */\n(function(){\n'
    +'if(window.__KFG_ATELIER)return; window.__KFG_ATELIER=true;\n'
    +shell+'\n'+geometry+'\n'+warenkorb+'\n'+ui+'\n})();\n';
  fs.writeFileSync(path.join(dir,'..','dist','konfigurator-atelier.js'),out);
  console.log('Live gebaut: dist/konfigurator-atelier.js ('+Math.round(out.length/1024)+' KB, CSS '+Math.round(css.length/1024)+' KB)');
}
