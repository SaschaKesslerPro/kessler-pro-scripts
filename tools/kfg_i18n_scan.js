/* Sucht auf den PL/EN-Spiegelseiten nach deutsch gebliebenen Texten — ueber alle Zustaende (L-Form, Multiplex mit Lack und Kanal, Naehtisch, Compact rund, ungueltiges Mass, Zeichnen). Aufruf: python3 -m http.server 8765 im Repo, dann node tools/kfg_i18n_scan.js */
const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch({  });
  const DE=/\b(und|oder|der|die|das|mit|nach|bei|für|zur|zum|von|bis|nicht|wird|werden|kann|Platte|Kante|Kanten|Ecke|Ecken|Ausschnitt|Ausschnitte|Bohrung|Maß|Maße|Preis|Versand|Lager|Fertigung|Stärke|Dekor|Fläche|Länge|Breite|Tiefe|Radius|Schnitt|hinzufügen|entfernen|wählen|Bitte|gerade|schräg|vorne|hinten|links|rechts|Tage|Werktage|Stück|pauschal|Angebot|Anfrage|Warenkorb|Kasse|Sofortkauf)\b/;
  const out={};
  for(const lang of ['pl','en']){
    const ctx=await browser.newContext({ viewport:{width:1400,height:1100} }); const page=await ctx.newPage();
    await page.route('**/*', r=>/127\.0\.0\.1/.test(r.request().url())?r.continue():r.abort());
    await page.goto(`http://127.0.0.1:8765/_spiegel/${lang}.html`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—', null, {timeout:20000}); await page.waitForTimeout(2000);
    const found=new Map();
    const sammeln=async(label)=>{ const t=await page.evaluate(()=>{ const root=document.querySelector('[data-kfg-root]'); const w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const a=[]; let n; while((n=w.nextNode())){ const v=n.nodeValue.trim(); if(v && n.parentNode.nodeName!=='SCRIPT' && n.parentNode.nodeName!=='STYLE') a.push(v); }
        root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(e=>['placeholder','aria-label','title'].forEach(k=>{ const v=e.getAttribute(k); if(v) a.push('@'+k+': '+v); }));
        return a; });
      t.forEach(v=>{ if(DE.test(v) && !found.has(v)) found.set(v,label); }); };
    const alle=()=>page.evaluate(()=>document.querySelectorAll('[data-kfg-root] .kfg_step').forEach(s=>{ s.classList.add('is-open'); s.dataset.manual='1'; }));
    await alle(); await sammeln('start');
    const configs=[
      ['lform',{mat:'dekor',dekor:'buk',thick:'25',form:'lform',lf:{L:200,B:90,aw:80,ah:50,pos:'vr',schnitt:'schraeg',sb:20},lfR:[50,0,0,50,0],cuts:[],extras:{bohr:true,custom:false,lack:false}}],
      ['mpx lack kanal',{mat:'mpx',dekor:'sperrholz-natur',thick:'21',form:'rect',L:150,B:70,edges:['halbrund','halbrund','halbrund','halbrund'],extras:{bohr:false,custom:true,lack:true},cornerR:[30,30,0,0],cuts:[{t:'k',cx:75,cy:35,len:60,dir:'laengs',w:60,dp:10,seite:'unten',enden:'ae'},{t:'c',preset:'kabel',cx:30,cy:20,d:6,w:6,h:6},{t:'r',cx:100,cy:40,w:20,h:15},{t:'p',cx:50,cy:50,w:10,h:10,r:10,pts:[[-5,-5],[5,-5],[5,5],[-5,5]]}]}],
      ['szwal',{mat:'szwal',dekor:'sz-weiss',thick:'21',form:'rect',L:120,B:60,edges:['nicht','nicht','nicht','nicht'],massband:'laser',massbandNull:'rechts',machine:'Juki',extras:{bohr:false,custom:false,lack:false},cuts:[{t:'r',preset:'maschine',w:52,h:18.1,cx:60,cy:45}]}],
      ['compact rund',{mat:'compact',dekor:'marmor-weiss',thick:'12',form:'round',D:90,edges:['fase','fase','fase','fase'],cuts:[],extras:{bohr:false,custom:false,lack:false}}],
      ['ungueltig',{mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:300,B:60,cuts:[],extras:{bohr:false,custom:false,lack:false}}],
    ];
    for(const [label,cfg] of configs){ await page.evaluate(c=>window.KFG.setConfig(c), cfg); await page.waitForTimeout(500); await alle(); await sammeln(label); }
    /* 3D + Zeichnen-Modus + Detailkarte offen */
    await page.evaluate(()=>window.KFG.setConfig({mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:120,B:60,cuts:[],extras:{bohr:false,custom:false,lack:false}})); await page.waitForTimeout(300);
    await page.evaluate(()=>{ document.getElementById('detailCard').open=true; document.querySelector('[data-draw="r"]').click(); }); await page.waitForTimeout(400); await sammeln('zeichnen');
    out[lang]=[...found.entries()];
    await ctx.close();
  }
  await browser.close();
  for(const lang of ['pl','en']){ console.log(`\n=== ${lang}: ${out[lang].length} deutsch wirkende Texte`); out[lang].slice(0,80).forEach(([v,l])=>console.log(`  [${l}] ${v.slice(0,140)}`)); }
})().catch(e=>{ console.error(e.message); process.exit(1); });
