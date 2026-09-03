const { chromium } = require('playwright');
const fs=require('fs');
const matrix=JSON.parse(fs.readFileSync('/tmp/kps/dist/data/kfg-produktmatrix.json')).produkte;
let ok=0, bad=[];
const check=(name,cond,info)=>{ if(cond) ok++; else bad.push(name+(info?' → '+info:'')); };
const parseP=t=>+t.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:1400,height:1100} });
  const page = await ctx.newPage();
  const errors=[]; page.on('pageerror', e=>errors.push('PAGEERROR '+e.message));
  await page.route('**/*', r=>{ const u=r.request().url();
    if(/three\.min\.js/.test(u)) return r.fulfill({status:200, contentType:'application/javascript', body:fs.readFileSync('/tmp/spiegel/three.min.js')});
    if(/127\.0\.0\.1/.test(u)) return r.continue(); return r.abort(); });
  const open=async(lang)=>{ await page.goto(`http://127.0.0.1:8765/_spiegel/${lang}.html`, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—', null, {timeout:20000});
    if(lang!=='de') await page.waitForTimeout(1500); };
  const set=async(patch,hash)=>{ await page.evaluate(p=>window.KFG.setConfig(p), patch); if(hash) await page.waitForTimeout(320); return page.evaluate(()=>{ return {price:document.getElementById('price').textContent,
      badge:document.getElementById('badgeText').textContent, rows:[...document.querySelectorAll('#breakdown tr')].map(tr=>[...tr.children].map(td=>td.textContent)),
      hash:location.hash, S:window.KFG.getConfig()}; }); };
  const clean={cuts:[], extras:{bohr:false,custom:false,lack:false}, cornerR:[0,0,0,0], lfR:[0,0,0,0,0], corner:0, edges:['abs','abs','abs','abs'], mpxSurface:'natur', massband:'none', machine:''};

  /* ① Katalog DE: jeder Lagerartikel exakt */
  await open('de');
  let n=0;
  for(const key in matrix){
    const [mat,form,dekor,thick,mass]=key.split('|'); const p={...clean, mat, form, dekor, thick};
    if(form==='round') p.D=+mass.slice(1).replace(',','.'); else { const [a,b]=mass.split('x').map(x=>+x.replace(',','.')); p.L=a; p.B=b; }
    if(mat==='mpx') p.edges=['nicht','nicht','nicht','nicht']; if(mat==='compact') p.edges=['roh','roh','roh','roh'];
    const r=await set(p); n++;
    const soll=matrix[key].eur, ist=parseP(r.price);
    if(Math.abs(ist-soll)>0.005) bad.push(`Katalog ${key}: ${ist} statt ${soll} (${r.badge})`); else ok++;
    if(n===1) console.log('Beispiel', key, r.price, r.badge, JSON.stringify(r.rows[0]));
  }
  console.log(`① Katalog DE: ${n} Artikel geprueft`);

  /* ② Sondermasse gegen das Node-Modul */
  const P=require('/tmp/kfg/preis.js'), daten={matrix, kurven:require('/tmp/kps/dist/data/kfg-preiskurven.json').kurven};
  const proben=[
    {mat:'dekor',dekor:'ahorn',thick:'18',form:'rect',L:140,B:70}, {mat:'dekor',dekor:'szary',thick:'18',form:'rect',L:200,B:100},
    {mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:99,B:59}, {mat:'dekor',dekor:'ahorn',thick:'18',form:'rect',L:99,B:59},
    {mat:'mpx',dekor:'sperrholz-natur',thick:'40',form:'rect',L:180,B:90,edges:['nicht','nicht','nicht','nicht']},
    {mat:'compact',dekor:'weiss',thick:'12',form:'rect',L:230,B:100,edges:['roh','roh','roh','roh']},
    {mat:'dekor',dekor:'buk',thick:'25',form:'round',D:140}, {mat:'compact',dekor:'szary',thick:'12',form:'round',D:60,edges:['roh','roh','roh','roh']},
  ];
  for(const pr of proben){
    const r=await set({...clean,...pr});
    const k={mat:pr.mat,dekor:pr.dekor,thick:pr.thick,form:pr.form,L:pr.L,B:pr.B,D:pr.D,mpxSurface:'natur'};
    const soll=P.grundpreis(k,daten,'eur').betrag, ist=parseP(r.price);
    check(`Sondermass ${pr.mat} ${pr.dekor} ${pr.thick} ${pr.form} ${pr.L||pr.D}x${pr.B||''}`, soll!==null && Math.abs(ist-soll)<0.005, `${ist} statt ${soll}`);
  }
  /* Ersatz-Stufen: Weiss wie Grau, Artison wie Ahorn */
  { const w=await set({...clean,mat:'dekor',dekor:'weiss',thick:'18',form:'rect',L:100,B:60});
    const g=await set({...clean,mat:'dekor',dekor:'szary',thick:'18',form:'rect',L:100,B:60});
    check('Weiss 18 = Grau 18 (Katalog 39,90)', w.price===g.price && parseP(g.price)===39.9, w.price+' / '+g.price);
    const a=await set({...clean,mat:'dekor',dekor:'eiche-artison',thick:'18',form:'rect',L:100,B:60});
    check('Artison 18 100x60 = Premium-Kurve 61,90', parseP(a.price)===61.9, a.price); }
  /* 36 mm ueber Faktor */
  { const r=await set({...clean,mat:'dekor',dekor:'buk',thick:'36',form:'rect',L:120,B:60});
    check('36 mm 120x60 > 25 mm (69,90) und < 130', parseP(r.price)>69.9 && parseP(r.price)<130, r.price); }
  console.log('② Sondermasse geprueft');

  /* ③ L-Form Buche 25, 200x90, Ausklinkung 80x50 */
  let r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'lform', lf:{L:200,B:90,aw:80,ah:50,pos:'hr',schnitt:'gerade'}}, true);
  check('L gerade Summe 199,80', Math.abs(parseP(r.price)-199.8)<0.005, r.price);
  check('L gerade Zeile Ausklinkung 130 cm 28,90', r.rows.some(x=>/Ausklinkung \(130 cm Schnitt\)/.test(x[0]) && parseP(x[1])===28.9), JSON.stringify(r.rows));
  check('L Hash lp/ls/lr', /lp=hr/.test(r.hash)&&/ls=g/.test(r.hash)&&/lr=0-0-0-0-0/.test(r.hash), r.hash);
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'lform', lf:{L:200,B:90,aw:80,ah:50,pos:'vl',schnitt:'schraeg'}});
  check('L schraeg Summe 194,80', Math.abs(parseP(r.price)-194.8)<0.005, r.price);
  check('L schraeg Zeile 94 cm 23,90', r.rows.some(x=>/Ausklinkung schräg \(94 cm Schnitt\)/.test(x[0]) && parseP(x[1])===23.9), JSON.stringify(r.rows));
  const winkel=await page.evaluate(()=>document.getElementById('inLW').value+'|'+document.getElementById('fLW').style.display+'|'+document.getElementById('lfInnerNote').style.display);
  check('Winkelfeld sichtbar, 32°, Innenecken-Hinweis weg', winkel==='32||none', winkel);
  const posChips=await page.evaluate(()=>[...document.querySelectorAll('#lfPosChips .kfg_chip')].map(b=>b.textContent+(b.classList.contains('is-active')?'*':'')).join(','));
  check('Lage-Chips: nur vorne, vorne links aktiv (v1.17.2)', posChips==='vorne rechts,vorne links*', posChips);
  /* Ecken je Ecke bei der L-Form */
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'lform', lf:{L:200,B:90,aw:80,ah:50,pos:'vr',schnitt:'gerade'}, lfR:[50,0,0,50,0]});
  check('L 2 Ecken 29,90', r.rows.some(x=>/Eckenrundung/.test(x[0]) && parseP(x[1])===29.9), JSON.stringify(r.rows.filter(x=>/Ecken/.test(x[0]))));
  const namen=await page.evaluate(()=>[...document.querySelectorAll('#cornerSel .kfg_radcell .nm')].map(e=>e.textContent));
  check('5 benannte Eckfelder', namen.length===5 && namen.includes('hinten links') && namen.some(s=>/Ausklinkung/.test(s)), JSON.stringify(namen));
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'lform', lf:{L:200,B:90,aw:80,ah:50,pos:'vr',schnitt:'gerade'}, lfR:[50,50,50,50,50]});
  check('L 5 Ecken gedeckelt 39,90', r.rows.some(x=>/Eckenrundung/.test(x[0]) && parseP(x[1])===39.9));
  /* Rechteck-Staffel */
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:120,B:60, cornerR:[50,0,0,0]});
  check('Rechteck 1 Ecke 19,90 → 89,80', Math.abs(parseP(r.price)-89.8)<0.005, r.price);
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:120,B:60, cornerR:[50,50,50,50]});
  check('Rechteck 4 Ecken 39,90 → 109,80', Math.abs(parseP(r.price)-109.8)<0.005, r.price);
  await page.screenshot({path:'/tmp/spiegel/s2-lform.png', clip:{x:0,y:0,width:1400,height:1100}, timeout:8000}).catch(()=>{});
  console.log('③ L-Form geprueft');

  /* ④ Presets und Freie Ausschnitte */
  const pr=await page.evaluate(()=>[...document.querySelectorAll('.kfg_preset')].map(e=>e.dataset.preset+':'+e.querySelector('.pr').textContent.replace(/\s+/g,' ').trim()));
  check('Preset-Labels', pr.join('|')==='kabel:+ 9,90 € / Stück|kabel80:+ 9,90 € / Stück|armatur:+ 9,90 € / Stück|usb:+ 14,90 € / Stück|spuele:+ 39,90 € / Stück|induktion:+ 39,90 € / Stück', pr.join('|'));
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:120,B:60, cuts:[{t:'r',preset:'spuele',cx:60,cy:30,w:78,h:43},{t:'c',preset:'kabel',cx:20,cy:15,d:6,w:6,h:6}]});
  check('Spuele+Kabel = 69,90+39,90+9,90', Math.abs(parseP(r.price)-119.7)<0.005, r.price);
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:120,B:60, cuts:[{t:'r',cx:60,cy:30,w:30,h:20}]});
  check('Freier Ausschnitt 300x200 = 24,90', r.rows.some(x=>/Ausschnitt/.test(x[0]) && parseP(x[1])===24.9), JSON.stringify(r.rows));
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:120,B:60, cuts:[{t:'r',cx:60,cy:30,w:5,h:5}]});
  check('Freier Ausschnitt klein = Untergrenze 14,90', r.rows.some(x=>/Ausschnitt/.test(x[0]) && parseP(x[1])===14.9));
  console.log('④ Bearbeitungen geprueft');

  /* ⑤ Naehtischplatte: L-Form, Massband, Maschine */
  r=await set({...clean, mat:'szwal',dekor:'sz-weiss',thick:'21',form:'rect',L:120,B:60, edges:['nicht','nicht','nicht','nicht'], massband:'laser', cornerR:[0,0,50,50]});
  const formChips=await page.evaluate(()=>[...document.querySelectorAll('#formChips .kfg_chip')].map(b=>b.dataset.form+':'+(b.style.display==='none'?'aus':'an')).join(','));
  check('Naehtisch Form-Chips: rect an, round aus, lform an', formChips==='rect:an,round:aus,lform:an', formChips);
  let band=await page.evaluate(()=>{ const t=[...document.querySelectorAll('#stage text')].map(e=>e.textContent); const nums=t.filter(x=>/^\d+$/.test(x)).map(Number); return {max:Math.max(...nums), note:document.getElementById('massbandNote').textContent, anz:document.querySelectorAll('#stage line[stroke="#1E1E1E"]').length}; });
  check('Laser-Band 120x60 R50 vorn: endet bei 100', band.max===100 && /Länge hier: 100 cm/.test(band.note), JSON.stringify(band));
  r=await set({...clean, mat:'szwal',dekor:'sz-weiss',thick:'21',form:'rect',L:90,B:60, edges:['nicht','nicht','nicht','nicht'], massband:'laser'});
  band=await page.evaluate(()=>document.getElementById('massbandNote').textContent);
  check('Laser-Band 90x60 ohne Radien: 88 cm', /Länge hier: 88 cm/.test(band), band);
  r=await set({...clean, mat:'szwal',dekor:'sz-weiss',thick:'21',form:'rect',L:120,B:60, edges:['nicht','nicht','nicht','nicht'], massband:'laser', cornerR:[0,0,100,100]});
  band=await page.evaluate(()=>document.getElementById('massbandNote').textContent);
  check('Laser-Band 120x60 R100 vorn: 98 cm', /Länge hier: 98 cm/.test(band), band);
  r=await set({...clean, mat:'szwal',dekor:'sz-weiss',thick:'21',form:'rect',L:120,B:60, edges:['nicht','nicht','nicht','nicht'], massband:'sticker'});
  const st=await page.evaluate(()=>{ const t=[...document.querySelectorAll('#stage text')].map(e=>e.textContent); return {hatLabel:t.some(x=>/Maßband auf der Kante · 100 cm/.test(x)), zahlen:t.filter(x=>/^\d+$/.test(x)).length}; });
  check('Aufkleber 2D: nur Linie + Label, keine Striche-Zahlen', st.hatLabel && st.zahlen===0, JSON.stringify(st));
  check('Massband-Preis 10 € in Summe', r.rows.some(x=>/Aufkleber/.test(x[0]) && parseP(x[1])===10), JSON.stringify(r.rows));
  await page.screenshot({path:'/tmp/spiegel/s3-szwal-sticker.png', clip:{x:0,y:0,width:1400,height:1100}, timeout:8000}).catch(()=>{});
  /* Naehtisch als L-Form vorne rechts mit Maschine */
  r=await set({...clean, mat:'szwal',dekor:'sz-weiss',thick:'21',form:'lform', lf:{L:180,B:120,aw:90,ah:60,pos:null,schnitt:'gerade'}, edges:['nicht','nicht','nicht','nicht'], massband:'laser'});
  await page.evaluate(()=>{ /* Maschine anlegen wie ueber den Knopf */ document.getElementById('btnMaschine').click(); });
  await page.waitForTimeout(320);
  r=await page.evaluate(()=>({price:document.getElementById('price').textContent, rows:[...document.querySelectorAll('#breakdown tr')].map(tr=>[...tr.children].map(td=>td.textContent)), S:window.KFG.getConfig(), hash:location.hash, note:document.getElementById('massbandNote').textContent}));
  check('Naehtisch L: Lage-Vorgabe vorne rechts', /lp=vr/.test(r.hash), r.hash);
  const m=r.S.cuts.find(c=>c.preset==='maschine');
  check('Maschinen-Ausschnitt 52x18,1 angelegt, 40 € in Zeile', m && m.w===52 && Math.abs(m.h-18.1)<1e-9 && r.rows.some(x=>/Maschine/.test(x[0]) && parseP(x[1])===40), JSON.stringify({m,rows:r.rows}));
  check('Maschine hinter der Ausklinkung (nicht in ihr)', m && !(m.cx>90 && m.cy>60), JSON.stringify(m));
  check('Band L-Form vorn: 180-90=90 → 88 cm', /Länge hier: 88 cm/.test(r.note), r.note);
  await page.screenshot({path:'/tmp/spiegel/s4-szwal-lform.png', clip:{x:0,y:0,width:1400,height:1100}, timeout:8000}).catch(()=>{});
  /* Hash-Rundreise */
  const hash=r.hash;
  await page.goto('about:blank');
  await page.goto('http://127.0.0.1:8765/_spiegel/de.html'+hash, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—', null, {timeout:20000});
  const S2=await page.evaluate(()=>window.KFG.getConfig());
  check('Hash-Rundreise: szwal lform vr', S2.mat==='szwal'&&S2.form==='lform'&&S2.lf.pos==='vr'&&S2.massband==='laser', JSON.stringify({mat:S2.mat,form:S2.form,lf:S2.lf,mb:S2.massband}));
  console.log('⑤ Naehtischplatte geprueft');

  /* ⑥ 3D */
  await set({...clean, mat:'szwal',dekor:'sz-weiss',thick:'21',form:'lform', lf:{L:180,B:120,aw:90,ah:60,pos:'vr',schnitt:'schraeg'}, edges:['nicht','nicht','nicht','nicht'], massband:'sticker', lfR:[30,0,0,30,30]});
  await page.click('#btn3d'); await page.waitForTimeout(4000);
  const d3=await page.evaluate(()=>{ const d=window.KFG._debug().drei; return {ready:d.ready, failed:d.failed, mesh:!!d.mesh, band:!!d.band}; });
  check('3D bereit mit Mesh und Band', d3.ready && !d3.failed && d3.mesh && d3.band, JSON.stringify(d3));
  await page.screenshot({path:'/tmp/spiegel/s5-3d.png', clip:{x:0,y:0,width:1400,height:1100}, timeout:8000}).catch(()=>{});
  await page.click('#btn2d');
  console.log('⑥ 3D geprueft');

  /* ⑦ PL: zl und PLN-Katalogpreis */
  await open('pl');
  let cnt=0, plbad=0;
  for(const key of Object.keys(matrix).filter((_,i)=>i%9===0)){
    const [mat,form,dekor,thick,mass]=key.split('|'); const p={...clean, mat, form, dekor, thick};
    if(form==='round') p.D=+mass.slice(1).replace(',','.'); else { const [a,b]=mass.split('x').map(x=>+x.replace(',','.')); p.L=a; p.B=b; }
    if(mat==='mpx') p.edges=['nicht','nicht','nicht','nicht']; if(mat==='compact') p.edges=['roh','roh','roh','roh'];
    const rr=await set(p); cnt++;
    if(!/zł/.test(rr.price) || Math.abs(parseP(rr.price)-matrix[key].pln)>0.005){ plbad++; if(plbad<4) bad.push(`PL ${key}: ${rr.price} statt ${matrix[key].pln}`); }
  }
  check(`PL Katalog (${cnt} Stichproben) in zl`, plbad===0);
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'lform', lf:{L:200,B:90,aw:80,ah:50,pos:'vr',schnitt:'schraeg'}, lfR:[50,0,0,0,0]});
  const plTexte=await page.evaluate(()=>({pos:[...document.querySelectorAll('#lfPosChips .kfg_chip')].map(b=>b.textContent), cut:[...document.querySelectorAll('#lfCutChips .kfg_chip')].map(b=>b.textContent), lbl:document.querySelector('label[for=inLW]').textContent, rows:[...document.querySelectorAll('#breakdown tr td:first-child')].map(e=>e.textContent), namen:[...document.querySelectorAll('#cornerSel .nm')].map(e=>e.textContent)}));
  check('PL: Lage-Chips uebersetzt', plTexte.pos.join(',')==='z przodu po prawej,z przodu po lewej', plTexte.pos.join(','));
  check('PL: Schnitt-Chips + Winkel', plTexte.cut.join(',')==='Proste,Skośne' && plTexte.lbl==='Kąt skosu', JSON.stringify([plTexte.cut,plTexte.lbl]));
  check('PL: Aufschluesselung ohne deutsche Reste', !plTexte.rows.some(t=>/Ausklinkung|Eckenrundung|Sondermaß|Kantenbearbeitung/.test(t)), JSON.stringify(plTexte.rows));
  check('PL: Eckennamen uebersetzt', plTexte.namen.length===5 && !plTexte.namen.some(t=>/hinten|vorne|links|rechts|Ausklinkung/.test(t)), JSON.stringify(plTexte.namen));
  console.log('⑦ PL geprueft');

  /* ⑧ EN */
  await open('en');
  r=await set({...clean, mat:'szwal',dekor:'sz-weiss',thick:'21',form:'rect',L:120,B:60, edges:['nicht','nicht','nicht','nicht'], massband:'sticker'});
  const en=await page.evaluate(()=>({note:document.getElementById('massbandNote').textContent, nz:[...document.querySelectorAll('#massbandNullChips .kfg_chip')].map(b=>b.textContent), mm:[...document.querySelectorAll('#maschineMassChips .kfg_chip')].map(b=>b.textContent.trim()), price:document.getElementById('price').textContent}));
  check('EN: Massband-Hinweis + Nullpunkt + Maschinenmass uebersetzt', /adhesive tape/.test(en.note) && /Length here: 100 cm/.test(en.note) && en.nz.join(',')==='Zero at the left,Zero at the right' && /To the machine/.test(en.mm.join(',')), JSON.stringify(en));
  check('EN: Preis in €', /€/.test(en.price), en.price);
  console.log('⑧ EN geprueft');

  console.log(`\n${ok} Zusicherungen gruen, ${bad.length} rot`);
  bad.forEach(b=>console.log('  ✗', b));
  console.log('JS-Fehler:', errors.length?errors:'keine');
  await browser.close();
  process.exit(bad.length||errors.length?1:0);
})().catch(e=>{ console.error('TESTFEHLER', e); process.exit(1); });
