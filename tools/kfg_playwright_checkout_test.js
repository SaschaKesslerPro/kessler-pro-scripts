const { chromium } = require('playwright');
let ok=0, bad=[]; const check=(n,c,i)=>{ if(c) ok++; else bad.push(n+(i?' → '+JSON.stringify(i).slice(0,400):'')); };
(async()=>{
  const browser=await chromium.launch(); const page=await browser.newPage({viewport:{width:1300,height:1000}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  let post=null;
  await page.route('**/*', r=>{ const u=r.request().url();
    if(u.endsWith('/checkout') && r.request().method()==='POST'){ post=JSON.parse(r.request().postData()); return r.fulfill({status:200, contentType:'application/json', headers:{'Access-Control-Allow-Origin':'*'}, body:JSON.stringify({checkoutUrl:'http://127.0.0.1:8765/_spiegel/bezahlt.html', preis:post.preis})}); }
    if(u.endsWith('/checkout') && r.request().method()==='OPTIONS') return r.fulfill({status:204, headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST'}});
    if(/127\.0\.0\.1/.test(u)) return r.continue(); return r.abort(); });
  /* ① Akkordeon: Dekore durchprobieren klappt Schritt 1 nicht zu */
  await page.goto('http://127.0.0.1:8765/_spiegel/de.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—',null,{timeout:20000});
  const offen=n=>page.evaluate(n=>document.getElementById('kfgStep'+n).classList.contains('is-open'),n);
  for(let i=0;i<4;i++){ await page.locator('#dekorGrid .kfg_dekor').nth(i).click(); await page.waitForTimeout(800); }   /* Raster wird nach jedem Klick neu gebaut */
  check('Schritt 1 nach 4 Dekor-Klicks noch offen', await offen(1));
  check('Schritt 2 dabei geoeffnet', await offen(2));
  await page.click('#formChips .kfg_chip[data-form="round"]'); await page.waitForTimeout(900);
  check('Nach Formwahl: Schritt 1 zu, Schritt 2 offen, Schritt 3 offen', !(await offen(1)) && (await offen(2)) && (await offen(3)), [await offen(1),await offen(2),await offen(3)]);
  await page.click('#formChips .kfg_chip[data-form="rect"]'); await page.waitForTimeout(900);
  check('Formen durchprobieren laesst Schritt 2 offen', await offen(2));
  /* ② Ohne Attribut: seit v1.17.2 steckt der Endpunkt im Skript — Sondermass ist bezahlbar.
     Nur data-kfg-checkout="off" schaltet auf die Mail-Anfrage. */
  await page.evaluate(()=>window.KFG.setConfig({mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:99,B:59,cuts:[],extras:{bohr:false,custom:false,lack:false},cornerR:[0,0,0,0],edges:['abs','abs','abs','abs']}));
  check('Ohne Attribut (Skript-Vorgabe): Jetzt bezahlen', (await page.textContent('#cta')).trim()==='Jetzt bezahlen', await page.textContent('#cta'));
  /* L-Form: nur vorne rechts (Vorgabe) und vorne links; Naehtisch behaelt alle vier */
  await page.evaluate(()=>window.KFG.setConfig({mat:'dekor',dekor:'buk',thick:'25',form:'lform',lf:{L:180,B:120,aw:90,ah:60,pos:null,schnitt:'gerade'},cuts:[],extras:{bohr:false,custom:false,lack:false}}));
  const chips=await page.evaluate(()=>[...document.querySelectorAll('#lfPosChips .kfg_chip')].map(b=>b.dataset.lp+(b.classList.contains('is-active')?'*':'')));
  check('L-Form Moebelplatte: Chips vr* und vl', chips.join(',')==='vr*,vl', chips);
  await page.evaluate(()=>window.KFG.setConfig({mat:'szwal',dekor:'sz-weiss',thick:'21',form:'lform',lf:{L:180,B:120,aw:90,ah:60,pos:null,schnitt:'gerade'},cuts:[],extras:{bohr:false,custom:false,lack:false}}));
  const chips2=await page.evaluate(()=>[...document.querySelectorAll('#lfPosChips .kfg_chip')].map(b=>b.dataset.lp));
  check('L-Form Naehtisch: vier Lagen', chips2.join(',')==='vr,vl,hr,hl', chips2);
  await page.goto('http://127.0.0.1:8765/_spiegel/de-off.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—',null,{timeout:20000});
  await page.evaluate(()=>window.KFG.setConfig({mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:99,B:59,cuts:[],extras:{bohr:false,custom:false,lack:false},cornerR:[0,0,0,0],edges:['abs','abs','abs','abs']}));
  check('data-kfg-checkout="off": Unverbindlich anfragen', (await page.textContent('#cta')).trim()==='Unverbindlich anfragen', await page.textContent('#cta'));
  /* ③ Mit Endpunkt */
  await page.goto('http://127.0.0.1:8765/_spiegel/de-checkout.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—',null,{timeout:20000});
  check('Lagerartikel: In den Warenkorb', (await page.textContent('#cta')).trim()==='In den Warenkorb');
  await page.evaluate(()=>window.KFG.setConfig({mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:120,B:60,cuts:[{t:'c',preset:'kabel',cx:20,cy:15,d:6,w:6,h:6}],extras:{bohr:false,custom:false,lack:false},cornerR:[0,0,0,0]}));
  check('Lager + Kabeldurchlass: Jetzt bezahlen, Preis 79,80', (await page.textContent('#cta')).trim()==='Jetzt bezahlen' && (await page.textContent('#price'))==='79,80 €', [await page.textContent('#cta'), await page.textContent('#price')]);
  check('Badge nicht mehr "Ab Lager"', !/Ab Lager/.test(await page.textContent('#badgeText')), await page.textContent('#badgeText'));
  await page.evaluate(()=>window.KFG.setConfig({mat:'dekor',dekor:'buk',thick:'25',form:'lform',lf:{L:200,B:90,aw:80,ah:50,pos:'vr',schnitt:'schraeg'},cuts:[],lfR:[50,0,0,0,0]}));
  check('L-Form: Jetzt bezahlen, Fertigung nach Mass', (await page.textContent('#cta')).trim()==='Jetzt bezahlen' && (await page.textContent('#delivDate'))==='Fertigung nach Maß', [await page.textContent('#cta'), await page.textContent('#delivDate')]);
  await page.click('#cta'); await page.waitForTimeout(1500);
  check('POST an /checkout mit Konfiguration und Preis', post && post.konfig && post.konfig.form==='lform' && post.kanal==='eur' && Math.abs(post.preis-229.7)<0.005 && /kessler-pro-scripts|127\.0\.0\.1/.test(post.base||'x'), post && {preis:post.preis, base:post.base, form:post.konfig.form, lfR:post.konfig.lfR});
  check('Weiterleitung zur checkoutUrl', /bezahlt\.html$/.test(page.url()), page.url());
  /* ④ Endpunkt kaputt → Rueckfall */
  await page.route('**/checkout', async r=>{ if(r.request().method()==='OPTIONS') return r.fulfill({status:204, headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST'}}); await new Promise(f=>setTimeout(f,1200)); r.fulfill({status:500, contentType:'application/json', headers:{'Access-Control-Allow-Origin':'*'}, body:'{"fehler":"kaputt"}'}); });
  await page.goto('http://127.0.0.1:8765/_spiegel/de-checkout.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—',null,{timeout:20000});
  await page.evaluate(()=>{ window.KFG.setConfig({mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:99,B:59,cuts:[],extras:{bohr:false,custom:false,lack:false}}); });
  await page.evaluate(()=>{ window.__mail=null; const d=Object.getOwnPropertyDescriptor(window.Location.prototype,'href'); });
  const vor=await page.textContent('#cta');
  await page.click('#cta'); await page.waitForTimeout(600);
  const zwischen=await page.evaluate(()=>document.getElementById('cta').disabled+'|'+document.getElementById('cta').textContent);
  await page.waitForTimeout(1600);
  const toast=await page.evaluate(()=>document.getElementById('toast').textContent);
  check('Fehler: Taste war gesperrt und ist wieder frei', /true\|Warenkorb wird vorbereitet/.test(zwischen) && !(await page.evaluate(()=>document.getElementById('cta').disabled)), zwischen);
  check('Fehler: Hinweis-Toast', /Bezahlen gerade nicht möglich/.test(toast), toast);
  console.log(`${ok} gruen, ${bad.length} rot`); bad.forEach(b=>console.log('  ✗',b));
  console.log('JS-Fehler:', errors.length?errors:'keine');
  await browser.close(); process.exit(bad.length?1:0);
})();
