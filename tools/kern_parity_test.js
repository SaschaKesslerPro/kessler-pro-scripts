/* kern_parity_test.js — Konfigurator (Browser) gegen preis-kern.js (Worker):
   zufaellige Konfigurationen, beide muessen denselben Gesamtpreis liefern.
   Aufruf: node tools/kern_parity_test.js <spiegel-url>   (z. B. http://127.0.0.1:8765/_spiegel/de.html) */
const { chromium } = require('playwright'); const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');

const m=JSON.parse(fs.readFileSync(path.join(ROOT,'dist/data/kfg-produktmatrix.json'))).produkte;
const SHOP={}; for(const k in m){ const v=m[k]; if(v.eur) SHOP[k]=[Math.round(v.eur*100)/100, String(v.variantId||'').split('/').pop(), v.sku, v.pln?Math.round(v.pln*100)/100:null]; }
const KURVEN=JSON.parse(fs.readFileSync(path.join(ROOT,'dist/data/kfg-preiskurven.json'))).kurven;
const URL=process.argv[2]||'http://127.0.0.1:8765/_spiegel/de.html';
let seed=20260902; const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
const pick=a=>a[Math.floor(rnd()*a.length)];
const MATS={dekor:{thick:['18','25','36'],dek:['ahorn','buk','hikora','sonoma-eiche','szary','sosna-bielona','schwarz','weiss','eiche-artison'],edges:['abs']},
  mpx:{thick:['21','40'],dek:['sperrholz-natur'],edges:['nicht','f45','halbrund','abs']},
  compact:{thick:['12'],dek:['weiss','szary','marmor-weiss','marmor-schwarz','czarny'],edges:['roh','fase','halbrund']},
  szwal:{thick:['21'],dek:['sz-weiss','sz-gewebe','sz-grau','sz-schwarz'],edges:['nicht','f45','halbrund','abs']}};
function zufall(){
  const mat=pick(Object.keys(MATS)), M=MATS[mat];
  const form=mat==='szwal'?pick(['rect','lform']):pick(['rect','rect','round','lform']);
  const e=pick(M.edges);
  const S={mat, dekor:pick(M.dek), thick:pick(M.thick), mpxSurface:mat==='mpx'?pick(['natur','hpl']):'natur', absColor:'dekor',
    form, L:20+Math.floor(rnd()*200), B:20+Math.floor(rnd()*100), D:20+Math.floor(rnd()*110),
    lf:{L:60+Math.floor(rnd()*150),B:40+Math.floor(rnd()*80),aw:0,ah:0,pos:pick(['hr','hl','vr','vl',null]),schnitt:pick(['gerade','schraeg'])},
    corner:0, cornerR:[0,1,2,3].map(()=>rnd()<0.3?pick([30,50,100]):0), lfR:[0,1,2,3,4].map(()=>rnd()<0.3?pick([30,50,100]):0), edgeR:3,
    edges:rnd()<0.7?[e,e,e,e]:[pick(M.edges),pick(M.edges),pick(M.edges),pick(M.edges)],
    extras:{bohr:rnd()<0.3,custom:false,lack:(mat==='mpx'||mat==='szwal')&&rnd()<0.3},
    massband:mat==='szwal'?pick(['none','laser','sticker']):'none', massbandNull:pick(['links','rechts']), machine:'', maschineMass:pick(['52x18.1','48x18.1','auto']), cuts:[]};
  if(S.mpxSurface==='hpl') S.dekor=pick(['ahorn','buk','hikora','weiss']);
  S.lf.aw=10+Math.floor(rnd()*(S.lf.L-20)); S.lf.ah=10+Math.floor(rnd()*(S.lf.B-20));
  /* Lagergroesse mit 35 % Wahrscheinlichkeit */
  if(rnd()<0.35 && (form==='rect'||form==='round')){ const keys=Object.keys(SHOP).filter(k=>k.startsWith(`${mat}|${form}|${mat==='mpx'?'sperrholz-natur':S.dekor}|${S.thick}|`));
    if(keys.length){ const k=pick(keys), mass=k.split('|')[4]; if(form==='round') S.D=+mass.slice(1).replace(',','.'); else { const [a,b]=mass.split('x').map(x=>+x.replace(',','.')); S.L=a; S.B=b; } if(S.mpxSurface==='hpl') S.mpxSurface='natur'; } }
  const d=form==='round'?{w:S.D,h:S.D}:form==='lform'?{w:S.lf.L,h:S.lf.B}:{w:S.L,h:S.B};
  if(form!=='round'){ const n=Math.floor(rnd()*3);
    for(let i=0;i<n;i++){ const t=rnd();
      if(mat==='szwal'){ S.cuts.push({t:'r',preset:'maschine',w:52,h:18.1,cx:d.w/2,cy:Math.max(10,d.h-15)}); break; }
      if(t<0.4) S.cuts.push({t:'c',preset:pick(['kabel','kabel80','armatur']),cx:10+rnd()*(d.w-20),cy:10+rnd()*(d.h-20),d:6,w:6,h:6});
      else if(t<0.7) S.cuts.push({t:'r',preset:pick(['usb','spuele','induktion']),cx:d.w/2,cy:d.h/2,w:26.5,h:10});
      else if(t<0.9) S.cuts.push({t:'r',cx:d.w/2,cy:d.h/2,w:5+rnd()*40,h:5+rnd()*25});
      else S.cuts.push({t:'c',cx:d.w/2,cy:d.h/2,d:5+rnd()*30,w:10,h:10}); } }
  return S;
}
(async()=>{
  const { preisKern } = await import(path.join(ROOT,'worker/konfigurator-checkout/src/preis-kern.js'));
  const browser=await chromium.launch(); const page=await browser.newPage();
  await page.route('**/*', r=>/127\.0\.0\.1/.test(r.request().url())?r.continue():r.abort());
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—',null,{timeout:20000});
  const N=+process.argv[3]||200; let ok=0; const bad=[];
  for(let i=0;i<N;i++){
    const S=zufall();
    const r=await page.evaluate(p=>{ window.KFG.setConfig(p); const S2=window.KFG.getConfig();
      return {price:document.getElementById('price').textContent, S2, ungueltig:!!document.querySelector('[data-kfg-root] .is-error')}; }, S);
    if(r.ungueltig) continue;                     /* validate() hat abgebrochen — Anzeige ist alt */
    /* der Browser normalisiert (clampCuts, ensureDekor, Radiusregel) — den Kern mit DEMSELBEN Zustand rechnen */
    const K=preisKern(r.S2,SHOP,KURVEN,'de'); const c=K.calc();
    const ist=+r.price.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.');
    if(Math.abs(ist-c.total)<0.005) ok++; else bad.push({i, browser:r.price, kern:c.total, quelle:c.quelle, mat:S.mat, form:S.form, dekor:S.dekor, thick:S.thick});
  }
  console.log(`${ok}/${N} gleich`); bad.slice(0,10).forEach(b=>console.log('  ✗',JSON.stringify(b)));
  await browser.close(); process.exit(bad.length?1:0);
})();
