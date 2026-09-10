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
  /* v1.18.2 (Senior 08.09.): Schraege B→A, A–C gerade, Winkel bei B (Vorgabe 120°):
     u = 50·tan30° = 28,9 cm, Schnitt = hypot(28,9, 50) + 51,1 = 108,9 → 109 cm */
  check('L schraeg Summe 226,70 (170,90 + Schnitt 25,90 + A/B-Radien 29,90)', Math.abs(parseP(r.price)-226.7)<0.005, r.price);
  check('L schraeg: Eckenzeile nennt Schräge R50 (A und B)', r.rows.some(x=>/Eckenrundung Schräge R50 \(Fertigungsregel\) \(2 Ecken\)/.test(x[0]) && parseP(x[1])===29.9), JSON.stringify(r.rows));
  check('L schraeg Zeile 109 cm 25,90', r.rows.some(x=>/Ausklinkung schräg \(109 cm Schnitt\)/.test(x[0]) && parseP(x[1])===25.9), JSON.stringify(r.rows));
  const winkel=await page.evaluate(()=>document.getElementById('inLW').value+'|'+document.getElementById('fLW').style.display+'|'+document.getElementById('lfInnerNote').textContent+'|'+document.getElementById('rangeLW').textContent);
  check('Winkelfeld sichtbar, 120° bei B, Hinweis A/B R50 (ABS), Bereich bis 144° und A–C 51 cm', /^120\|\|Die Schräge läuft von B \(Plattenkante\) nach A; A und B werden automatisch verrundet: R50 — ABS-Kante geklebt.*\|91 bis 144° — bei Punkt B zwischen Plattenkante und Schräge · 90° = gerade · A–C bleibt 51 cm gerade$/.test(winkel), winkel);
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'lform', lf:{L:200,B:90,aw:80,ah:50,pos:'vl',schnitt:'schraeg'}}, true);
  check('L schraeg Hash lw=120', /ls=s/.test(r.hash)&&/lw=120/.test(r.hash)&&!/lsb/.test(r.hash), r.hash);
  { const g=await page.evaluate(()=>{ const st=document.getElementById('stage').innerHTML; return {A:/>A<\/text>/.test(st),B:/>B<\/text>/.test(st),C:/>C<\/text>/.test(st),w:/>120°<\/text>/.test(st)}; });
    check('Vorschau: Punkte A, B, C und Winkel 120° beschriftet', g.A&&g.B&&g.C&&g.w, JSON.stringify(g)); }
  /* Winkel ueber dem Maximum wird still auf das Maximum geklemmt (A–C bleibt 10 cm) */
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'lform', lf:{L:200,B:90,aw:80,ah:50,pos:'vr',schnitt:'schraeg',winkel:170}});
  { const w=await page.evaluate(()=>document.getElementById('inLW').value+'|'+document.getElementById('rangeLW').textContent+'|'+document.getElementById('errLW').textContent);
    check('Winkel 170° → 144° geklemmt (ganze Grad, A–C 11 cm), kein Fehler', /^144\|91 bis 144°.*A–C bleibt 11 cm gerade\|$/.test(w), w);
    check('Geklemmte Schraege: Schnitt hypot(68,8, 50)+11,2 = 96 cm', r.rows.some(x=>/Ausklinkung schräg \(96 cm Schnitt\)/.test(x[0])), JSON.stringify(r.rows)); }
  /* Kundenradius an B (Ecke 1) ersetzt den Fertigungsradius dort: nur noch A als Regel-Ecke */
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'lform', lf:{L:200,B:90,aw:80,ah:50,pos:'vr',schnitt:'schraeg'}, lfR:[0,100,0,0,0]});
  check('B vom Kunden R100: Zeile "R100 + Schräge R50 (Fertigungsregel) (2 Ecken)" — Regel nur noch an A', r.rows.some(x=>/^Eckenrundung R100 · vorne · Ausklinkung \+ Schräge R50 \(Fertigungsregel\) \(2 Ecken\)$/.test(x[0])), JSON.stringify(r.rows.filter(x=>/Ecken/.test(x[0]))));
  r=await set({...clean, mat:'mpx',dekor:'sperrholz-natur',thick:'40',form:'lform', edges:['f45','f45','f45','f45'], lf:{L:200,B:90,aw:80,ah:50,pos:'vl',schnitt:'gerade'}});
  check('Multiplex ohne ABS: Innenecke R10', /Innenecke wird automatisch verrundet: R10 — Kante ohne ABS/.test(await page.evaluate(()=>document.getElementById('lfInnerNote').textContent)), await page.evaluate(()=>document.getElementById('lfInnerNote').textContent));
  r=await set({...clean, mat:'mpx',dekor:'sperrholz-natur',thick:'40',form:'lform', edges:['abs','abs','abs','abs'], lf:{L:200,B:90,aw:80,ah:50,pos:'vl',schnitt:'gerade'}});
  check('Multiplex mit ABS: Innenecke R50', /R50 — ABS-Kante geklebt/.test(await page.evaluate(()=>document.getElementById('lfInnerNote').textContent)));
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
  /* v1.19.0: vierter Chip Bauchausschnitt — bei der Naehtischplatte bewusst AN
     (Bauchausschnitt ist gerade dort der Normalfall), nur Rund bleibt aus. */
  check('Naehtisch Form-Chips: rect an, round aus, lform an, bauch an', formChips==='rect:an,round:aus,lform:an,bauch:an', formChips);
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
  check('PL: Schnitt-Chips + Winkel', plTexte.cut.join(',')==='Proste,Skośne' && plTexte.lbl==='Kąt w punkcie B', JSON.stringify([plTexte.cut,plTexte.lbl]));
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

  /* ⑨ Review 08.09.2026 (v1.17.9): Luecken geschlossen */
  await open('de');
  const alleOffen=async(pg)=>pg.evaluate(()=>document.querySelectorAll('[data-kfg-root] .kfg_step').forEach(s=>{ s.classList.add('is-open'); s.dataset.manual='1'; }));
  await alleOffen(page);
  r=await set({...clean, mat:'mpx',dekor:'buk',thick:'21',mpxSurface:'hpl',form:'rect',L:119,B:60, edges:['nicht','nicht','nicht','nicht']});
  check('A3: HPL auf Multiplex 119x60 nicht auf den Lagerpreis der rohen Platte gedeckelt (95,90 statt 69,90)', parseP(r.price)===95.9, r.price);
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:300,B:60});
  const sperre=await page.evaluate(()=>({price:document.getElementById('price').textContent, cta:document.getElementById('cta').disabled, buy:document.getElementById('ctaBuy').disabled, label:document.getElementById('priceLabel').textContent}));
  check('A5: ungueltiges Mass → Preis "—", Knoepfe gesperrt', sperre.price==='—' && sperre.cta && sperre.buy && /Maße prüfen/.test(sperre.label), JSON.stringify(sperre));
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:120,B:60});
  const frei=await page.evaluate(()=>({price:document.getElementById('price').textContent, cta:document.getElementById('cta').disabled}));
  check('A5: gueltiges Mass → Preis zurueck, Knoepfe frei', frei.price==='69,90 €' && !frei.cta, JSON.stringify(frei));
  r=await set({...clean, mat:'compact',dekor:'weiss',thick:'12',form:'rect',L:120,B:60,cornerR:[300,300,300,300], edges:['roh','roh','roh','roh']});
  r=await set({B:30});
  check('A9: Radius wird nach Massaenderung neu begrenzt (R300 an 30-cm-Kante → R150)', r.S.cornerR.every(v=>v<=150) && r.S.cornerR[0]===150, JSON.stringify(r.S.cornerR));
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'lform', lf:{L:180,B:120,aw:150,ah:100,pos:'hr',schnitt:'gerade',sb:0}, lfR:[0,300,300,300,0]});
  check('A9: L-Form-Radien gegen die Schenkel begrenzt (30/20 cm → R150/R100)', r.S.lfR.every(v=>v<=150) && r.S.lfR.some(v=>v>0 && v<=100), JSON.stringify(r.S.lfR));
  await set({...clean, mat:'mpx',dekor:'sperrholz-natur',thick:'21',form:'rect',L:120,B:60, edges:['abs','halbrund','halbrund','halbrund'], cuts:[{t:'c',preset:'kabel',cx:60,cy:30,d:6,w:6,h:6}]});
  await alleOffen(page); await page.click('#formChips .kfg_chip[data-form="round"]'); await page.waitForTimeout(300);
  r=await page.evaluate(()=>{ const S=window.KFG.getConfig(); return {edges:S.edges, cuts:S.cuts.length, form:S.form}; });
  check('A10: Formwechsel auf Rund vereinheitlicht Kanten und entfernt Ausschnitte', r.form==='round' && new Set(r.edges).size===1 && r.cuts===0, JSON.stringify(r));
  /* B2: Tippen in der Bearbeitungsliste verliert den Fokus nicht mehr */
  await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:120,B:60, cuts:[{t:'c',preset:'kabel',cx:60,cy:30,d:6,w:6,h:6}]});
  await alleOffen(page); await page.click('#cutList input[data-f="cx"]'); await page.fill('#cutList input[data-f="cx"]',''); await page.type('#cutList input[data-f="cx"]','1'); await page.waitForTimeout(600); await page.type('#cutList input[data-f="cx"]','50'); await page.waitForTimeout(600);
  r=await page.evaluate(()=>({ae:document.activeElement && document.activeElement.dataset.f, val:document.querySelector('#cutList input[data-f="cx"]').value, cx:window.KFG.getConfig().cuts[0].cx}));
  check('B2: Feld behaelt beim Tippen den Fokus, Wert 150 mm uebernommen', r.ae==='cx' && r.val==='150' && r.cx===15, JSON.stringify(r));
  /* B4: kaputter Link toetet den Konfigurator nicht */
  await page.goto('http://127.0.0.1:8765/_spiegel/de.html#m=constructor&mm=__proto__&d=constructor&e=constructor,abs,abs,abs', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—', null, {timeout:20000}).catch(()=>{});
  r=await page.evaluate(()=>({kfg:!!window.KFG, price:document.getElementById('price').textContent, mat:window.KFG&&window.KFG.getConfig().mat}));
  check('B4: #m=constructor → Konfigurator startet (Material Standard, Dekor auf gueltigen Wert)', r.kfg && /€/.test(r.price) && r.mat==='dekor', JSON.stringify(r));
  /* B1: Datenausfall sichtbar, "Erneut laden" holt die Preise nach */
  { const p2=await ctx.newPage(); let sperren=true;
    await p2.route('**/*', rt=>{ const u=rt.request().url(); if(/kfg-(produktmatrix|preiskurven)\.json/.test(u)&&sperren) return rt.fulfill({status:503, body:'weg'}); if(/127\.0\.0\.1/.test(u)) return rt.continue(); return rt.abort(); });
    await p2.goto('http://127.0.0.1:8765/_spiegel/de.html',{waitUntil:'domcontentloaded'});
    await p2.waitForFunction(()=>window.KFG, null, {timeout:20000});
    const ausfall=await p2.evaluate(()=>({price:document.getElementById('price').textContent, hinweis:!document.getElementById('datenHinweis').hidden, badge:document.getElementById('badgeText').textContent, cta:document.getElementById('cta').textContent}));
    check('B1: Datenausfall → Preis "—", Hinweis sichtbar, Anfrage-Knopf', ausfall.price==='—' && ausfall.hinweis && /nicht verfügbar/.test(ausfall.badge) && /anfragen/.test(ausfall.cta), JSON.stringify(ausfall));
    sperren=false; await p2.click('#datenNeu'); await p2.waitForFunction(()=>document.getElementById('price').textContent==='69,90 €', null, {timeout:10000}).catch(()=>{});
    const nachher=await p2.evaluate(()=>({price:document.getElementById('price').textContent, hinweis:!document.getElementById('datenHinweis').hidden}));
    check('B1: "Erneut laden" holt die Preise nach', nachher.price==='69,90 €' && !nachher.hinweis, JSON.stringify(nachher));
    await p2.close(); }
  /* B3: Zeichnen auf dem Handy trifft die Platte (Letterboxing) */
  { const mctx=await browser.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
    const mp=await mctx.newPage(); await mp.route('**/*', rt=>/127\.0\.0\.1/.test(rt.request().url())?rt.continue():rt.abort());
    await mp.goto('http://127.0.0.1:8765/_spiegel/de.html',{waitUntil:'domcontentloaded'});
    await mp.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—', null, {timeout:20000});
    await mp.evaluate(()=>window.KFG.setConfig({L:120,B:60,cuts:[]})); await mp.waitForTimeout(400);
    await mp.evaluate(()=>window.scrollTo(0, document.querySelector('[data-kfg-root]').getBoundingClientRect().top+window.scrollY)); await mp.waitForTimeout(400);
    await alleOffen(mp); await mp.evaluate(()=>document.querySelector('[data-draw="r"]').click()); await mp.waitForTimeout(400);
    await mp.evaluate(()=>window.scrollTo(0, document.querySelector('[data-kfg-root]').getBoundingClientRect().top+window.scrollY)); await mp.waitForTimeout(400);
    const pl=await mp.evaluate(()=>{ const e=document.querySelector('#stage .kfg_edge[data-i="0"]').getBoundingClientRect(), l=document.querySelector('#stage .kfg_edge[data-i="3"]').getBoundingClientRect(); return {x:e.left, w:e.width, y:l.top, h:l.height}; });
    await mp.mouse.move(pl.x+pl.w*0.25, pl.y+pl.h*0.3); await mp.mouse.down(); await mp.mouse.move(pl.x+pl.w*0.5, pl.y+pl.h*0.5, {steps:4}); await mp.mouse.move(pl.x+pl.w*0.75, pl.y+pl.h*0.7, {steps:4}); await mp.mouse.up(); await mp.waitForTimeout(400);
    const cut=await mp.evaluate(()=>{ const c=window.KFG.getConfig().cuts[0]; return c?{w:c.w,h:c.h,cx:c.cx,cy:c.cy}:null; });
    check('B3: mobil aufgezogener Ausschnitt 60 x 24 cm (halbe Plattenbreite, 40 % Tiefe)', cut && Math.abs(cut.w-60)<=1.5 && Math.abs(cut.h-24)<=1.5 && Math.abs(cut.cx-60)<=1.5, JSON.stringify(cut));
    await mctx.close(); }
  console.log('⑨ Review-Fixes geprueft');

  /* ⑩ v1.18.0: Texturmassstab, PL-Aufschlaege, ABS-Farbe, Vorlagenmass, Link mit Bearbeitungen, mobile Preiszeile */
  await open('de'); await alleOffen(page);
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:120,B:60});
  let tx=await page.evaluate(()=>({pat:!!document.querySelector('#stage pattern#texPat'), bilder:document.querySelectorAll('#stage pattern image').length, fill:(document.querySelector('#stage path[fill^="url"]')||{}).getAttribute&&document.querySelector('#stage path[fill^="url"]').getAttribute('fill')}));
  check('Textur: Buche als 2x2-Muster (4 gespiegelte Kacheln) gefuellt', tx.pat && tx.bilder===4 && tx.fill==='url(#texPat)', JSON.stringify(tx));
  r=await set({...clean, mat:'compact',dekor:'marmor-weiss',thick:'12',form:'rect',L:200,B:90, edges:['roh','roh','roh','roh']});
  tx=await page.evaluate(()=>({bilder:document.querySelectorAll('#stage pattern image').length}));
  check('Textur: Marmor nicht gekachelt (ein Foto)', tx.bilder===1, JSON.stringify(tx));
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:120,B:60, absColor:'gruen'});
  check('ABS Gruen: kein Lagerartikel, Preis bleibt 69,90 (kein Aufpreis)', !/Ab Lager/.test(r.badge) && parseP(r.price)===69.9, r.badge+' '+r.price);
  await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:120,B:60, cuts:[{t:'r',preset:'spuele',cx:60,cy:30,w:78,h:43}]});
  await page.fill('#cutList input[data-f="w"]','900'); await page.press('#cutList input[data-f="w"]','Enter'); await page.waitForTimeout(500);
  r=await page.evaluate(()=>{ const c=window.KFG.getConfig().cuts[0]; return {preset:c.preset||null, w:c.w, rows:[...document.querySelectorAll('#breakdown tr')].map(tr=>tr.children[0].textContent)}; });
  check('Vorlage mit geaendertem Mass wird freier Ausschnitt nach Formel', r.preset===null && r.w===90 && r.rows.some(t=>/^Ausschnitt 90 × 43 cm/.test(t)), JSON.stringify(r));
  r=await set({...clean, mat:'szwal',dekor:'sz-weiss',thick:'21',form:'rect',L:120,B:60, edges:['nicht','nicht','nicht','nicht'], machine:'Bernina 770', extras:{bohr:true,custom:false,lack:false}, cuts:[{t:'r',preset:'maschine',w:52,h:18.1,cx:60,cy:45},{t:'c',preset:'kabel',cx:30,cy:20,d:6,w:6,h:6},{t:'k',cx:60,cy:30,len:50,dir:'laengs',w:60,dp:10,seite:'unten',enden:'a'}]}, true);
  const hash10=r.hash, preis10=r.price;
  await page.goto('http://127.0.0.1:8765/_spiegel/de.html'+hash10, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—', null, {timeout:20000});
  r=await page.evaluate(()=>{ const S=window.KFG.getConfig(); return {price:document.getElementById('price').textContent, cuts:S.cuts.map(c=>c.preset||c.t), bohr:S.extras.bohr, machine:S.machine, enden:(S.cuts.find(c=>c.t==='k')||{}).enden}; });
  check('Geteilter Link bringt Ausschnitte, Bohrung, Maschine und Kanal-Enden mit — Preis identisch', r.price===preis10 && r.cuts.join(',')==='maschine,kabel,k' && r.bohr===true && r.machine==='Bernina 770' && r.enden==='a', JSON.stringify({r,preis10}));
  await open('pl'); await alleOffen(page);
  r=await set({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'rect',L:120,B:60, cornerR:[30,30,30,30]});
  check('PL: 4 Ecken = 169,90 zł (39,90 € x 4,24 auf ,90), Summe 483,80 zł', parseP(r.price)===483.8 && r.rows.some(x=>/Ecken|narożnik|Zaokrąglenie|rogi/i.test(x[0]) && parseP(x[1])===169.9), JSON.stringify({price:r.price, rows:r.rows}));
  const plTexte10=await page.evaluate(()=>({preset:document.querySelector('.kfg_preset[data-preset="kabel"] .pr').textContent, bohr:document.querySelector('.kfg_check input[data-x="bohr"]').closest('.kfg_check').querySelector('.pr').textContent, mat:document.querySelector('.kfg_mat[data-m="dekor"] small').textContent}));
  check('PL: statische Preistexte in zł (Durchlass 42,90 zł / szt., Bohrung 42,90 zł, Material od … zł)', /42,90 zł \/ szt\./.test(plTexte10.preset) && /42,90 zł/.test(plTexte10.bohr) && /^od [\d,.]+ zł · /.test(plTexte10.mat), JSON.stringify(plTexte10));
  { const mctx=await browser.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
    const mp=await mctx.newPage(); await mp.route('**/*', rt=>/127\.0\.0\.1/.test(rt.request().url())?rt.continue():rt.abort());
    await mp.goto('http://127.0.0.1:8765/_spiegel/de.html',{waitUntil:'domcontentloaded'});
    await mp.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—', null, {timeout:20000}); await mp.waitForTimeout(500);
    await mp.evaluate(()=>window.scrollTo(0, document.getElementById('kfgStep1').getBoundingClientRect().top+window.scrollY-300)); await mp.waitForTimeout(400);
    const mk=await mp.evaluate(()=>{ const e=document.getElementById('previewKauf'), r=e.getBoundingClientRect(), cs=getComputedStyle(e); return {display:cs.display, sichtbar:r.height>30&&r.width>200, preis:document.getElementById('priceMini').textContent, cta:document.getElementById('ctaMini').textContent}; });
    check('Mobil: Preiszeile mit Preis und Knopf in der mitwandernden Karte sichtbar', mk.display==='flex' && mk.sichtbar && mk.preis==='69,90 €' && /Warenkorb/.test(mk.cta), JSON.stringify(mk));
    await mctx.close(); }
  console.log('⑩ v1.18.0 geprueft');

  /* ⑪ Bauchausschnitt (v1.19.0, Zeichnung des Seniors 10.09.) — Geometrie, Preis,
     Zweiwegbindung, Grenzen, Bestellweg, Link und die polnischen Texte. */
  await open('de');
  const bsBasis=(bs)=>({...clean, mat:'dekor',dekor:'buk',thick:'25',form:'bauch', bsR:[0,0,0,0,0,0],
    bs:{L:200,BR:90,a:55,b:55,c:60,t:15,w1:135,w2:135,mittig:false,treiber:'b',art:'trapez', ...bs}});
  const bsFeld=async(id)=>page.evaluate(i=>document.getElementById(i).value, id);
  r=await set(bsBasis({}));
  check('Bauch Vorgabe = Zeichnung des Vaters: 236,70 (170,90 + 25,90 + 39,90)', Math.abs(parseP(r.price)-236.7)<0.005, r.price);
  check('Bauch Zeile 102 cm Schnitt 25,90', r.rows.some(x=>/^Bauchausschnitt \(102 cm Schnitt\)$/.test(x[0]) && parseP(x[1])===25.9), JSON.stringify(r.rows));
  check('Bauch: vier Schraegen-Ecken nach Fertigungsregel 39,90', r.rows.some(x=>/Schräge R50 \(Fertigungsregel\) \(4 Ecken\)/.test(x[0]) && parseP(x[1])===39.9), JSON.stringify(r.rows));
  check('Bauch Tiefe errechnet: (200-55-55-60)/2 = 15', (await bsFeld('inBsT'))==='15', await bsFeld('inBsT'));
  /* Zweiwegbindung: Tiefe treibt, B folgt */
  r=await set(bsBasis({t:25, treiber:'t'}));
  check('Bauch Zweiwegbindung: Tiefe 25 → B = 200-55-60-50 = 35', (await bsFeld('inBsB'))==='35', await bsFeld('inBsB'));
  /* Mittig: A und B laufen gleich */
  r=await set(bsBasis({t:25, treiber:'t', mittig:true}));
  check('Bauch mittig: A = B = (200-60-50)/2 = 45', (await bsFeld('inBsA'))==='45' && (await bsFeld('inBsB'))==='45', (await bsFeld('inBsA'))+'/'+(await bsFeld('inBsB')));
  /* Zwei senkrechte Schnitte: rechteckiger Ausschnitt, keine Schraege, keine Regel-Ecken */
  r=await set(bsBasis({w1:90,w2:90,a:50,c:100,t:20,treiber:'t'}));
  check('Bauch 90/90: Schnitt 2x20 + 100 = 140 cm, keine Eckenzeile', r.rows.some(x=>/^Bauchausschnitt \(140 cm Schnitt\)$/.test(x[0])) && !r.rows.some(x=>/Eckenrundung/.test(x[0])), JSON.stringify(r.rows));
  /* Grenzen */
  for(const [name,bs] of [['C unter 10',{c:5}], ['Tiefe groesser als Breite-10',{t:85,treiber:'t'}],
                          ['A+B+C laenger als die Platte',{a:90,b:90}], ['B wird negativ',{t:45,treiber:'t'}],
                          ['Winkel unter 90',{w1:89}]]){
    r=await set(bsBasis(bs));
    const gesperrt=await page.evaluate(()=>document.getElementById('cta').disabled);
    check('Bauch Grenze greift: '+name, r.price==='—' && gesperrt, name+' → '+r.price+' / gesperrt '+gesperrt);
  }
  /* Bestellweg: seit v1.20.1 kennt der Worker die Form — direkt bestellbar */
  r=await set(bsBasis({}));
  const bsKauf=await page.evaluate(()=>({cta:document.getElementById('cta').textContent.trim(),
    buy:getComputedStyle(document.getElementById('ctaBuy')).display}));
  check('Bauch ist direkt bestellbar (Warenkorb und Sofortkauf)', /Warenkorb/.test(bsKauf.cta) && bsKauf.buy!=='none', JSON.stringify(bsKauf));
  /* Link teilen und wiederherstellen */
  r=await set(bsBasis({a:42,b:38,c:55,w1:120,w2:150}), true);
  const bsHash=r.hash, bsPreis=r.price;
  check('Bauch Hash traegt bs und bsr', /bs=/.test(bsHash) && /bsr=/.test(bsHash), bsHash);
  await page.goto('http://127.0.0.1:8765/_spiegel/de.html'+bsHash, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—', null, {timeout:20000});
  const bsS=await page.evaluate(()=>({f:window.KFG.getConfig().form, bs:window.KFG.getConfig().bs, p:document.getElementById('price').textContent}));
  check('Bauch Link 1:1 wiederhergestellt', bsS.f==='bauch' && bsS.p===bsPreis && +bsS.bs.a===42 && +bsS.bs.b===38 && +bsS.bs.w2===150, JSON.stringify(bsS));
  /* Polnisch: die neuen Woerter liegen seit v1.19.1 in der Sprachdatei, nicht mehr im Skript */
  await open('pl');
  r=await set(bsBasis({}));
  const bsPl=await page.evaluate(()=>({rows:[...document.querySelectorAll('#breakdown tr td:first-child')].map(e=>e.textContent),
    label:(document.querySelector('label[for=inBsC]')||{}).textContent||'', chip:[...document.querySelectorAll('#formChips .kfg_chip')].map(b=>b.textContent).join(',')}));
  check('PL: Bauch-Zeile und Feldnamen uebersetzt', bsPl.rows.some(t=>/Wycięcie brzuszne/.test(t)) && !bsPl.rows.some(t=>/Bauchausschnitt|Eckenrundung/.test(t)), JSON.stringify(bsPl.rows));
  check('PL: Formchip uebersetzt', /Wycięcie brzuszne/.test(bsPl.chip), bsPl.chip);
  await open('de');
  /* v1.20.0: zweite Schnittart Welle — Kosinusmulde, tangential, ohne Ecken.
     Bogenlaenge unabhaengig nachgerechnet (feine Summation, 20 000 Schritte). */
  const welleRef=(L,a2,b2,T)=>{ const O=L-a2-b2, k=Math.PI*T/O, n=20000; let sum=0;
    for(let i=0;i<n;i++){ const u=(i+0.5)/n; sum+=Math.hypot(1,k*Math.sin(2*Math.PI*u)); }
    return {O, bogen:O*sum/n}; };
  r=await set(bsBasis({L:130,BR:90,a:20,b:21,t:11,art:'welle'}));
  { const R=welleRef(130,20,21,11);
    check('Welle: Bogenlaenge stimmt mit der Referenz (Zeichnung 130x90)',
      r.rows.some(x=>new RegExp('^Bauchausschnitt \\('+Math.round(R.bogen)+' cm Schnitt\\)$').test(x[0])),
      JSON.stringify(r.rows)+' soll '+Math.round(R.bogen));
    check('Welle: keine Eckenzeile — tangential, nichts zu verrunden', !r.rows.some(x=>/Eckenrundung/.test(x[0])), JSON.stringify(r.rows));
    check('Welle: Oeffnung im Hinweis', /Öffnung an der Vorderkante 89 cm/.test(await page.evaluate(()=>document.getElementById('bsNote').textContent)), await page.evaluate(()=>document.getElementById('bsNote').textContent)); }
  { const ui=await page.evaluate(()=>({c:getComputedStyle(document.getElementById('fBsC')).display,
      w:getComputedStyle(document.getElementById('fBsW1')).display,
      chips:[...document.querySelectorAll('#bsArtChips .kfg_chip')].map(x=>x.dataset.ba+(x.classList.contains('is-active')?'*':'')).join(','),
      ecken:[...document.querySelectorAll('#cornerSel .nm')].map(e=>e.textContent)}));
    check('Welle: C und Winkel ausgeblendet, Chip aktiv', ui.c==='none' && ui.w==='none' && ui.chips==='trapez,welle*', JSON.stringify(ui));
    check('Welle: nur die vier Plattenecken sind rundbar', ui.ecken.length===4 && !ui.ecken.some(t=>/Ausschnitt/.test(t)), JSON.stringify(ui.ecken)); }
  /* mittig laesst B mit A mitlaufen */
  r=await set(bsBasis({L:130,BR:90,a:25,b:5,t:14,art:'welle',mittig:true}));
  check('Welle mittig: B laeuft mit A mit', (await bsFeld('inBsB'))==='25', await bsFeld('inBsB'));
  /* Grenzen der Welle */
  for(const [name,bs] of [['Mulde unter 20 cm',{L:130,a:60,b:60,art:'welle'}],
                          ['Tiefe groesser als Breite-10',{L:130,BR:90,t:85,art:'welle'}]]){
    r=await set(bsBasis(bs));
    const gesperrt=await page.evaluate(()=>document.getElementById('cta').disabled);
    check('Welle Grenze greift: '+name, r.price==='—' && gesperrt, name+' → '+r.price+' / gesperrt '+gesperrt);
  }
  /* Umschalten haelt die Mulde: Trapez -> Welle -> Trapez fuehrt zurueck */
  r=await set(bsBasis({}));
  const trapezPreis=r.price;
  await page.evaluate(()=>document.querySelector('#bsArtChips .kfg_chip[data-ba=welle]').click());
  await page.waitForTimeout(500);
  const wellePreis=await page.evaluate(()=>document.getElementById('price').textContent);
  await page.evaluate(()=>document.querySelector('#bsArtChips .kfg_chip[data-ba=trapez]').click());
  await page.waitForTimeout(500);
  const zurueck=await page.evaluate(()=>document.getElementById('price').textContent);
  check('Welle: Umschalten hin und zurueck landet wieder beim Trapezpreis', zurueck===trapezPreis && wellePreis!==trapezPreis, [trapezPreis,wellePreis,zurueck].join(' → '));
  /* Link mit Schnittart */
  r=await set(bsBasis({L:130,BR:90,a:18,b:24,t:13,art:'welle'}), true);
  { const h=r.hash, pr=r.price;
    check('Welle: Hash traegt die Schnittart', /bs=[^&]*(,|%2C)w(&|$)/i.test(h), h);   /* der Hash ist URL-kodiert */
    await page.goto('http://127.0.0.1:8765/_spiegel/de.html'+h, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.KFG && document.getElementById('price').textContent!=='—', null, {timeout:20000});
    const w=await page.evaluate(()=>({art:window.KFG.getConfig().bs.art, p:document.getElementById('price').textContent}));
    check('Welle: Link 1:1 wiederhergestellt', w.art==='welle' && w.p===pr, JSON.stringify(w)+' vorher '+pr); }
  /* 3D mit der gesampelten Kontur */
  r=await set(bsBasis({L:130,BR:90,a:20,b:21,t:11,art:'welle'}));
  await page.click('#btn3d'); await page.waitForTimeout(3500);
  { const d=await page.evaluate(()=>{ const x=window.KFG._debug().drei; return {ready:x.ready, failed:x.failed, mesh:!!x.mesh}; });
    check('Welle: 3D baut die Kontur', d.ready && !d.failed && d.mesh, JSON.stringify(d)); }
  await page.click('#btn2d'); await page.waitForTimeout(300);
  /* Polnisch */
  await open('pl');
  r=await set(bsBasis({L:130,BR:90,a:20,b:21,t:11,art:'welle'}));
  { const pl=await page.evaluate(()=>({chips:[...document.querySelectorAll('#bsArtChips .kfg_chip')].map(x=>x.textContent).join(','),
      note:document.getElementById('bsNote').textContent}));
    check('PL: Schnittart-Chips und Wellenhinweis uebersetzt', /Fala/.test(pl.chips) && /stycznie/.test(pl.note), JSON.stringify(pl).slice(0,200)); }
  await open('de');
  console.log('⑪ Bauchausschnitt geprueft');

  console.log(`\n${ok} Zusicherungen gruen, ${bad.length} rot`);
  bad.forEach(b=>console.log('  ✗', b));
  console.log('JS-Fehler:', errors.length?errors:'keine');
  await browser.close();
  process.exit(bad.length||errors.length?1:0);
})().catch(e=>{ console.error('TESTFEHLER', e); process.exit(1); });
