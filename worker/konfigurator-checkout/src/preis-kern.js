/* preis-kern.js — AUTOMATISCH ERZEUGT aus dist/konfigurator.js durch
   tools/kern_extrahieren.py. NICHT VON HAND AENDERN — Aenderungen gehoeren in
   den Konfigurator, danach das Werkzeug erneut laufen lassen.

   preisKern(S, SHOP, KURVEN, KFG_LANG) liefert calc(), isStandard(), shopHit()
   und die Geometrie-Helfer, ohne DOM. Der Worker rechnet damit jeden
   Checkout-Betrag selbst nach. */
'use strict';
function preisKern(S, SHOP, KURVEN, KFG_LANG){
  const document = undefined, window = undefined;   /* kein DOM im Worker */
  const $ = ()=>null;
  const toast = ()=>{};
  const buildCorner = ()=>{};
  const DEKOR_MOEBEL = [
    ['weiss','Weiß'],['alaska-weiss','Alaska Weiß'],['sosna-bielona','Kiefer Weiß'],['kaszmir','Kaschmir'],
    /* "Asche Grau" (Popiel) und "Grau" (Szary) sind dasselbe Dekor — die Draufsicht
       im Archiv ist byte-identisch. Geführt wird der Shop-Name Grau (36 Lagerartikel). */
    ['szary','Grau'],['schwarz','Schwarz'],
    ['ahorn','Ahorn'],['buk','Buche'],['sonoma-eiche','Eiche Sonoma'],['eiche-artison','Eiche Artison'],
    /* Eiche Kamienny und Eiche Hickory sind dasselbe Dekor unter zwei Namen
       (Senior: „to samo co dąb kamienny"; Draufsicht UND Kantenfoto sind identisch).
       Geführt wird der Shop-Name Eiche Hickory — dort liegen auch die 39 Lagerartikel.
       Alt-Schlüssel 'eiche-kamienny' wird in ensureDekor() umgebogen. */
    ['hikora','Eiche Hickory']
  ];

  const DEKOR_HPL = DEKOR_MOEBEL;

  const DEKOR_SZWAL = [['sz-weiss','Weiß'],['sz-gewebe','Gewebestruktur Weiß'],
                       ['sz-grau','Grau'],['sz-schwarz','Schwarz']];

  const MATERIALS = {
    dekor:   { name:'Möbelplatte', sub:'ab 19,90 € · 18/25/36 mm',
               thick:[['18','18 mm'],['25','25 mm'],['36','36 mm']], def:'25', dekore:DEKOR_MOEBEL, hasABS:true },
    compact: { name:'Compact / HPL', sub:'ab 69 € · 12 mm',
               thick:[['12','12 mm Vollkern']], def:'12',
               dekore:[['weiss','Weiß'],['czarny','Schwarz'],['szary','Grau'],['marmor-weiss','Weißer Marmor'],['marmor-schwarz','Schwarzer Marmor']], hasABS:false },
    mpx:     { name:'Multiplex Birke', sub:'ab 29,90 € · 21/40 mm · alle Dekore',
               thick:[['21','21 mm'],['40','40 mm']], def:'21', dekore:[['sperrholz-natur','Birke natur']], hasABS:true },
    /* Bis v1.15.0 war die Naehtischplatte eine FORM. Seit v1.16.0 ist sie eine
       eigene Kategorie neben Moebelplatte/Compact/Multiplex (Senior 30.07.). */
    szwal:   { name:'Nähtischplatte', sub:'ab 89 € · 21 mm · 4 Farben',
               thick:[['21','21 mm']], def:'21', dekore:DEKOR_SZWAL, hasABS:true }
  };

  const RULES = {
    dekor:   {maxL:270, maxB:200, maxD:160, minCorner:30, cornerNote:'Möbelplatte (ABS-Kante): Außenradien mind. R30. Kleinere Radien sind fertigungstechnisch nicht möglich.'},
    compact: {maxL:238, maxB:120, maxD:130, minCorner:0, cornerNote:''},   /* Katalog: rund bis 130 */
    mpx:     {maxL:238, maxB:120, maxD:120, minCorner:0, cornerNote:''},
    /* Naehtischplatten kommen aus der 240x120-Rohplatte (Senior 30.07.). */
    szwal:   {maxL:240, maxB:120, maxD:120, minCorner:0, cornerNote:''}
  };

  const DEKOR_ALIAS = { 'eiche-kamienny':'hikora', 'asche-grau':'szary' };   /* zusammengefuehrte Dekore */

  const EDGE_MPX = [['nicht','Nicht gefräst',0,'serienmäßig','#1E1E1E'],
                    ['f45','Gefräst 45°',5,'+ 5 €/lfm','#8a6844'],
                    ['halbrund','Halbrund',8,'+ 8 €/lfm','#4a7a9b'],
                    ['abs','ABS-Kante 2 mm',0,'inklusive','#2f6b4f']];

  const LACK_LFM = { nicht:5, f45:10, halbrund:16 };

  const EDGEPROFILES = {
    dekor:   [['abs','ABS-Kante 2 mm · R2',0,'inklusive','#1E1E1E']],
    mpx:     EDGE_MPX,
    szwal:   EDGE_MPX,
    compact: [['roh','Geschliffen',0,'serienmäßig','#1E1E1E'],['fase','Gefast 45°',7,'+ 7 €/lfm','#8a6844'],['halbrund','Halbrund',8,'+ 8 €/lfm','#4a7a9b']]
  };

  const EDGE_ALIAS = { mpx:{fase:'nicht'}, szwal:{fase:'nicht'} };

  const MASSBAND = [['none','Kein Maßband','',0],
                    ['laser','Maßband gelasert','+ 15 €',15],
                    ['sticker','Aufkleberkante','+ 10 €',10]];

  const RADIEN_STAFFEL = [0, 19.9, 29.9, 34.9, 39.9];

  const FREI_PRICE  = {basis:10.7, lfm:13.9, minimum:14.9};

  const KANAL_PRICE = {basis:14.9, lfm:12.9, breiteStufe:30, breitePlus:3.9,
                       tiefeStufe:5, tiefePlus:2.9, wBasis:60, tBasis:10};

  const PRESETS = {
    kabel:    {label:'Kabeldurchlass Ø60', short:'Ø60',       t:'c', d:6,          price:9.9,  pos:(L,B,n)=>[L/2+n*10, 0.15*B]},
    kabel80:  {label:'Kabeldurchlass Ø80', short:'Ø80',       t:'c', d:8,          price:9.9,  pos:(L,B,n)=>[L/2+n*12, 0.15*B]},
    armatur:  {label:'Armaturenbohrung Ø35', short:'Ø35',     t:'c', d:3.5,        price:9.9,  pos:(L,B,n)=>[L/2+n*8, 0.12*B]},
    usb:      {label:'Steckdosen-Ausschnitt', short:'Steckdose',       t:'r', w:26.5, h:10, price:14.9, pos:(L,B,n)=>[L-21.25-n*30, 0.10*B+5]},
    spuele:   {label:'Spülen-Ausschnitt',  short:'Spüle',     t:'r', w:78,  h:43,  price:39.9, pos:(L,B,n)=>[0.08*L+39+n*10, B/2]},
    induktion:{label:'Induktionsfeld',     short:'Induktion', t:'r', w:56,  h:49,  price:39.9, pos:(L,B,n)=>[L-34-n*10, B/2]},
    /* Naehtischplatte: pauschal 40,00 fuer den Ausschnitt, jede Groesse (Senior
       26.08.). Drei Standardmasse (48 / 52 / 61,7 x 18,1 cm) oder "nach Maschine";
       Hersteller und Modell gibt der Kunde immer mit an. */
    maschine: {label:'Ausschnitt für die Maschine', short:'Maschine', t:'r', w:52, h:18.1, price:40,
               pos:(L,B,n)=>[L/2, Math.max(9.05, B-15)]}
  };

  const X_PRICE = { bohr:9.9 };

  const DEKOR_STUFE_ERSATZ = { weiss:'basis', 'alaska-weiss':'basis', kaszmir:'basis', 'eiche-artison':'premium' };

  const STAERKE_FAKTOR = { 'dekor|36': 1.466 };

  const HPL_ZUSCHLAG = { eur: {std:36, hikora:47}, pln: {std:155, hikora:200} };

  const CORNER_NAMES = ['hinten links','hinten rechts','vorne rechts','vorne links'];

  const LF_POS = [['vr','vorne rechts'],['vl','vorne links'],['hr','hinten rechts'],['hl','hinten links']];

  const MASCHINE_MASSE = {'48x18.1':[48,18.1], '52x18.1':[52,18.1], '61.7x18.1':[61.7,18.1], 'auto':[52,18.1]};

  function kanal(){ return KFG_LANG==='pl' ? 'pln' : 'eur'; }

  function auf90(v){ return Math.ceil(v - 0.90 - 1e-9) + 0.90; }

  function kurvenDekor(){ return S.mat==='mpx' ? 'sperrholz-natur' : S.dekor; }

  function kurvenSchluessel(){
    const form = S.form==='round' ? 'round' : 'rect';       /* L-Form rechnet wie Rechteck */
    const mat = S.mat==='szwal' ? 'mpx' : S.mat;
    let thick = S.thick;
    if(!KURVEN[`${mat}|${thick}|${form}|standard`] && !KURVEN[`${mat}|${thick}|${form}|premium`] && STAERKE_FAKTOR[`${mat}|${thick}`]) thick = '25';
    const dek=kurvenDekor();
    const suche=(roh)=>{
      for(const st of ['premium','basis','standard']){ const k=roh+'|'+st;
        if(KURVEN[k] && (KURVEN[k].dekore||[]).indexOf(dek)>=0) return k; }
      const ersatz=DEKOR_STUFE_ERSATZ[dek];
      if(ersatz && KURVEN[roh+'|'+ersatz]) return roh+'|'+ersatz;
      for(const st of ['standard','premium','basis']) if(KURVEN[roh+'|'+st]) return roh+'|'+st;
      return null;
    };
    /* Runde Platten ohne eigene Kurve (Multiplex, 18er Moebelplatte) laufen
       ueber die Rechteck-Kurve mit dem umschliessenden Quadrat — das ist der
       Zuschnitt, aus dem die Scheibe gefraest wird. */
    return suche(`${mat}|${thick}|${form}`) || (form==='round' ? suche(`${mat}|${thick}|rect`) : null);
  }

  function kurvenFlaeche(ks){
    if(S.form==='round' && ks && ks.indexOf('|rect|')>=0) return Math.pow(S.D/100,2);
    return areaM2();
  }

  function aufDerKurve(kv, A){
    const p=kv.punkte||[]; if(!p.length) return null;
    let roh;
    if(A<=p[0][0]) roh = p[0][1] - kv.randsteigung*(p[0][0]-A);
    else if(A>=p[p.length-1][0]) roh = p[p.length-1][1] + kv.randsteigung*(A-p[p.length-1][0]);
    else { let i=0; while(p[i+1][0]<A) i++;
      const [x0,y0]=p[i], [x1,y1]=p[i+1]; roh = y0 + (y1-y0)*(A-x0)/(x1-x0); }
    return auf90(Math.max(roh, kv.mindestpreis||0));
  }

  function deckel(){
    if(S.form!=='rect'&&S.form!=='round') return null;
    const pre=`${S.mat}|${S.form}|${kurvenDekor()}|${S.thick}|`, d=dims();
    const a=Math.max(d.w,d.h), b=Math.min(d.w,d.h); let best=null;
    for(const k in SHOP){ if(!k.startsWith(pre)) continue;
      const m=k.slice(pre.length); let passt;
      if(S.form==='round') passt = +m.slice(1).replace(',','.') >= a-1e-9;
      else { const [p,q]=m.split('x').map(x=>+x.replace(',','.')); passt = Math.max(p,q)>=a-1e-9 && Math.min(p,q)>=b-1e-9; }
      const v=hitPreis(SHOP[k]);
      if(passt && v!=null && (best===null||v<best)) best=v;
    }
    return best;
  }

  function kurvenPreis(){
    const ks=kurvenSchluessel(); if(!ks) return null;
    const kv=(KURVEN[ks].kanaele||{})[kanal()]; if(!kv) return null;
    const A=kurvenFlaeche(ks);
    let p=aufDerKurve(kv, A); if(p===null) return null;
    const fak=STAERKE_FAKTOR[`${S.mat}|${S.thick}`];
    if(fak && ks.indexOf(`|${S.thick}|`)<0) p=auf90(p*fak);
    if(S.mat==='szwal' || (S.mat==='mpx'&&S.mpxSurface==='hpl')){
      const z=HPL_ZUSCHLAG[kanal()]; p=auf90(p + A*((S.dekor==='hikora')?z.hikora:z.std));
    }
    const cap=deckel(); if(cap!=null && p>cap) p=cap;
    return p;
  }

  function hitPreis(hit){ return kanal()==='pln' ? (hit[3]!=null?hit[3]:null) : hit[0]; }

  const fm1=v=>(''+(+v)).replace('.',',');

  function shopKey(mat,form,dekor,thick,a,b){
    return `${mat}|${form}|${dekor}|${thick}|`+(form==='round'?`D${fm1(a)}`:`${fm1(a)}x${fm1(b)}`);
  }

  function shopHit(){
    if(S.form!=='rect'&&S.form!=='round') return null;
    if(S.mat==='mpx'&&S.mpxSurface!=='natur') return null;
    const d=dims(), dek=S.mat==='mpx'?'sperrholz-natur':S.dekor;
    return SHOP[shopKey(S.mat,S.form,dek,S.thick,S.form==='round'?d.w:Math.max(d.w,d.h),Math.min(d.w,d.h))]
        || SHOP[shopKey(S.mat,S.form,dek,S.thick,S.form==='round'?d.w:Math.min(d.w,d.h),Math.max(d.w,d.h))] || null;
  }

  function freierAusschnitt(lfm){ return Math.max(FREI_PRICE.minimum, auf90(FREI_PRICE.basis + FREI_PRICE.lfm*lfm)); }

  function radienpreis(n){ return n<=0 ? 0 : RADIEN_STAFFEL[Math.min(n, RADIEN_STAFFEL.length-1)]; }

  function rules(){ return RULES[S.mat]; }

  function baseEdge(){ return EDGEPROFILES[S.mat][0][0]; }

  function profileOf(id){ return EDGEPROFILES[S.mat].find(p=>p[0]===id)||EDGEPROFILES[S.mat][0]; }

  function lackAn(){ return !!S.extras.lack && (S.mat==='mpx'||S.mat==='szwal'); }

  function isLack(){ return lackAn() && S.edges.some(e=>e!=='abs'); }

  function edgeLfm(e){
    if(lackAn() && LACK_LFM[e]!==undefined) return LACK_LFM[e];
    return profileOf(e)[2]||0;
  }

  function dims(){
    if(S.form==='round') return {w:+S.D,h:+S.D};
    if(S.form==='lform') return {w:+S.lf.L,h:+S.lf.B};
    return {w:+S.L,h:+S.B};
  }

  function areaM2(){
    if(S.form==='round') return Math.PI*Math.pow(S.D/200,2);
    if(S.form==='lform') return S.lf.L*S.lf.B/1e4;
    return S.L*S.B/1e4;
  }

  function perimM(){
    if(S.form==='round') return Math.PI*S.D/100;
    if(S.form==='lform') return lfGeo().umfang;
    const d=dims(); return 2*(d.w+d.h)/100;
  }

  function dekorList(){
    if(S.mat!=='mpx') return MATERIALS[S.mat].dekore;
    return S.mpxSurface==='hpl'?DEKOR_HPL:[['sperrholz-natur','Birke natur']];
  }

  function ensureDekor(){
    /* Schutz: haelt S.dekor immer innerhalb der aktuell gueltigen Liste.
       Vorher konnte der angezeigte Dekorname vom markierten Swatch abweichen. */
    if(DEKOR_ALIAS[S.dekor]) S.dekor=DEKOR_ALIAS[S.dekor];
    const l=dekorList(); if(!l.length) return;
    if(!l.some(x=>x[0]===S.dekor)) S.dekor=l[0][0];
  }

  function calc(){
    const hit=shopHit();
    const hp=hit?hitPreis(hit):null;
    const kp=(hp===null)?kurvenPreis():null;
    const basis=hp!==null?hp:(kp!==null?kp:0);   /* Lagerartikel: verbindlicher Shop-Preis */
    const quelle=hp!==null?'katalog':(kp!==null?'kurve':'offen');
    let kante=0;
    if(S.form==='rect'){ const len=[+S.L,+S.B,+S.L,+S.B];
      S.edges.forEach((e,i)=>kante+=edgeLfm(e)*len[i]/100);
    } else kante=edgeLfm(S.edges[0])*perimM();
    const ecken=cornerSum();
    /* Der Schnitt, der das L erzeugt: Formel der freien Ausschnitte auf die
       INNERE Schnittlaenge — zwei Innenkanten beim geraden, eine Diagonale beim
       schraegen L. */
    const lschnitt=S.form==='lform'?freierAusschnitt(lfGeo().schnitt):0;
    let extras=0; if(S.extras.bohr) extras+=X_PRICE.bohr;
    extras+=massbandPreis();
    S.cuts.forEach(c2=>{ extras+=cutPrice(c2); });   /* freie Bearbeitungen jetzt mit Sofortpreis */
    ensureDekor();
    const dk=(dekorList().find(x=>x[0]===S.dekor))||dekorList()[0]||['','—'];
    const tt=MATERIALS[S.mat].thick.find(t=>t[0]===S.thick)||MATERIALS[S.mat].thick[0];
    const total=Math.round((basis+kante+ecken+lschnitt+extras)*100)/100;
    return {basis,quelle,kante,ecken,lschnitt,extras,total,
      dekorName:dk[1],thickName:tt[1]};
  }

  function isStandard(){
    /* "Ab Lager" heisst: die Platte geht so aus dem Regal. Jede Bearbeitung —
       auch ein Kabeldurchlass oder die Montagebohrung — macht daraus einen
       Fertigungsauftrag mit Aufpreis (vorher lief der Permalink ohne den Aufpreis). */
    if(S.extras.custom||isLack()||S.mat==='szwal'||S.form==='lform'||cornerCount()>0||S.cuts.length>0||S.extras.bohr) return false;
    if(S.mat!=='dekor'&&S.mat!=='compact') { /* mpx Festmaße? aktuell keine → nur 18er Liste für dekor */ }
    return !!shopHit();
  }

  function needsOffer(){ return S.extras.custom || calc().quelle==='offen'; }

  function cornerFormOk(){ return S.form==='rect'||S.form==='lform'; }

  function cornerPerCorner(){ return cornerFormOk(); }

  function cornerR(i){
    if(!cornerFormOk()) return 0;
    if(S.form==='lform') return lfCornerR(i);
    return Math.max(0, +S.cornerR[i]||0);
  }

  function cornerIdx(){ return S.form==='lform' ? [0,1,2,3,4] : [0,1,2,3]; }

  function cornerCount(){ return cornerIdx().filter(i=>cornerR(i)>0).length; }

  function cornerMax(){ return Math.max(0,...cornerIdx().map(cornerR)); }

  function cornerName(i){ return S.form==='lform' ? lfCornerName(i) : CORNER_NAMES[i]; }

  function cornerLabel(){
    const idx=cornerIdx(), on=idx.filter(i=>cornerR(i)>0);
    if(!on.length) return 'eckig';
    const uniq=[...new Set(on.map(cornerR))];
    if(uniq.length===1) return `R${uniq[0]} · ${on.length===idx.length?(idx.length===5?'alle fünf':'alle vier'):on.map(cornerName).join(', ')}`;
    return on.map(i=>`${cornerName(i)} R${cornerR(i)}`).join(' · ');
  }

  function clampCorner(r){
    const d=dims(), lim=Math.min(d.w,d.h)*10/2, mn=rules().minCorner;
    r=Math.max(0,Math.min(300,Math.round(r||0)));
    if(r>0&&mn>0&&r<mn) r=mn;
    return Math.min(r,Math.floor(lim));
  }

  function setCorner(i,r){
    if(S.form==='lform'){ if(!Array.isArray(S.lfR)||S.lfR.length!==5) S.lfR=[0,0,0,0,0]; S.lfR[i]=clampCorner(r); }
    else S.cornerR[i]=clampCorner(r);
    S.corner=cornerMax();
  }

  function setAllCorners(r){
    const v=clampCorner(r);
    if(S.form==='lform') S.lfR=[0,1,2,3,4].map(()=>v); else S.cornerR=[0,1,2,3].map(()=>v);
    S.corner=cornerMax();
  }

  function lfPos(){ return S.lf.pos || 'vr'; }

  function lfSchraeg(){ return S.lf.schnitt==='schraeg'; }

  function lfSb(){ const ah=Math.max(1,Math.min(+S.lf.ah, +S.lf.B-1)); return lfSchraeg() ? Math.max(0, Math.min(Math.round(+S.lf.sb||0), ah-1)) : 0; }

  function lfPts(){
    const L=+S.lf.L, B=+S.lf.B, pos=lfPos();
    const aw=Math.max(1,Math.min(+S.lf.aw, L-1)), ah=Math.max(1,Math.min(+S.lf.ah, B-1));
    let pts, ord;
    const sb=lfSb();
    if(lfSchraeg()&&sb>0){ pts=[[0,0],[L-aw,0],[L-aw,sb],[L,ah],[L,B],[0,B]]; ord=[0,1,-1,2,3,4]; }   /* A=(L,ah), B=(L-aw,sb) */
    else if(lfSchraeg()){ pts=[[0,0],[L-aw,0],[L,ah],[L,B],[0,B]]; ord=[0,1,2,3,4]; }
    else { pts=[[0,0],[L-aw,0],[L-aw,ah],[L,ah],[L,B],[0,B]]; ord=[0,1,-1,2,3,4]; }
    const mx=(pos==='hl'||pos==='vl'), my=(pos==='vr'||pos==='vl');
    pts=pts.map(([x,y])=>[mx?L-x:x, my?B-y:y]);
    if(mx!==my){ pts.reverse(); ord.reverse(); }
    return {pts, ord, L, B, aw, ah, pos, sb};
  }

  function lfGeo(){
    const g=lfPts(), L=g.L/100, B=g.B/100, aw=g.aw/100, ah=g.ah/100;
    if(lfSchraeg()){ const sb=g.sb/100, t=ah-sb, s=Math.hypot(aw,t)+sb;      /* Schraege A-B plus gerades Stueck B-Kante */
      return {schnitt:s, umfang:2*(L+B)-aw-ah+s, schraeg:true, winkel:Math.round(Math.atan2(t,aw)*180/Math.PI), sb:g.sb}; }
    return {schnitt:aw+ah, umfang:2*(L+B), schraeg:false, winkel:90, sb:0};
  }

  function lfSchnittCm(){ return Math.round(lfGeo().schnitt*100); }

  function lfCornerName(o){
    const g=lfPts(), i=g.ord.indexOf(o); if(i<0) return '';
    const [x,y]=g.pts[i], e=1e-6;
    const yy=y<e?'hinten':(y>g.B-e?'vorne':null), xx=x<e?'links':(x>g.L-e?'rechts':null);
    if(yy&&xx) return `${yy} ${xx}`;
    return `${yy||xx} · Ausklinkung`;
  }

  function lfCornerR(o){ return Math.max(0, +((S.lfR||[])[o])||0); }

  function lfNotchCenter(){
    const g=lfPts(), mx=(g.pos==='hl'||g.pos==='vl'), my=(g.pos==='vr'||g.pos==='vl');
    return [mx?g.aw/2:g.L-g.aw/2, my?g.B-g.ah/2:g.ah/2];
  }

  function lfInNotch(px,py){
    const g=lfPts(), mx=(g.pos==='hl'||g.pos==='vl'), my=(g.pos==='vr'||g.pos==='vl');
    const u=mx?px:g.L-px, v=my?g.B-py:py;          /* auf "hinten rechts" normiert: u vom Notch-Rand, v von hinten */
    if(u>g.aw||v>g.ah) return false;
    if(!lfSchraeg()) return true;
    return v < g.sb + (g.ah-g.sb)*(1-u/g.aw);      /* zwischen Ecke und Schraege A-B (B bei Tiefe sb) */
  }

  function massbandEintrag(){ return MASSBAND.find(m=>m[0]===S.massband)||MASSBAND[0]; }

  function massbandPreis(){ return S.mat==='szwal' ? massbandEintrag()[3] : 0; }

  function massbandName(){ return massbandEintrag()[1]; }

  function massbandStrecke(){
    if(S.mat!=='szwal'||S.massband==='none'||S.form==='round') return null;
    const d=dims(); let pts, rad;
    if(S.form==='lform'){ const g=lfPts(); pts=g.pts; rad=g.ord.map(o=>o<0?0:lfCornerR(o)/10); }
    else { pts=[[0,0],[d.w,0],[d.w,d.h],[0,d.h]]; rad=[0,1,2,3].map(i=>cornerR(i)/10); }
    const n=pts.length, e=1e-6; let best=null;
    for(let i=0;i<n;i++){ const j=(i+1)%n, a=pts[i], b=pts[j];
      if(Math.abs(a[1]-d.h)>e||Math.abs(b[1]-d.h)>e) continue;
      const li=a[0]<b[0]?i:j, re=a[0]<b[0]?j:i;
      const s=pts[li][0]+rad[li]+1, t=pts[re][0]-rad[re]-1;
      if(!best||t-s>best.t-best.s) best={s,t};
    }
    if(!best||best.t-best.s<10) return null;
    const len=Math.min(100, Math.floor(best.t-best.s));
    const rechts=(S.massbandNull||'links')==='rechts';
    return {x0: rechts?best.t-len:best.s, len, rechts, y:d.h};
  }

  function cutLen(c){
    if(c.t==='c') return Math.PI*(c.d||0);
    if(c.t==='r') return 2*((c.w||0)+(c.h||0));
    if(c.t==='k'){                               /* offener Zug, nicht geschlossen */
      const q=kanalPunkte(c);                    /* mit den bis zur Kante verlaengerten Enden */
      let L=0; for(let i=0;i<q.length-1;i++) L+=Math.hypot(q[i+1][0]-q[i][0], q[i+1][1]-q[i][1]);
      return L;
    }
    if(c.t==='p'&&c.pts&&c.pts.length>1){
      let L=0; for(let i=0;i<c.pts.length;i++){
        const a=c.pts[i], b=c.pts[(i+1)%c.pts.length];
        L+=Math.hypot(b[0]-a[0], b[1]-a[1]);
      } return L;
    }
    return 0;
  }

  function cutPrice(c){
    if(c.preset) return PRESETS[c.preset].price;
    if(c.t==='k') return Math.round((KANAL_PRICE.basis + kanalLfmPreis(c.w,c.dp)*cutLen(c)/100)*10)/10;
    return freierAusschnitt(cutLen(c)/100);
  }

  function cutBox(c){
    if(c.t==='c') return {w:c.d,h:c.d};
    if(c.t==='k'){
      const z=(c.w||60)/10, L=Math.max(1,c.len||10);
      return c.dir==='quer' ? {w:z, h:L} : {w:L, h:z};
    }
    if(c.t==='p'){
      const q=(c.pts||[[0,0]]);
      return {w:Math.max(...q.map(p=>p[0]))-Math.min(...q.map(p=>p[0])),
              h:Math.max(...q.map(p=>p[1]))-Math.min(...q.map(p=>p[1]))};
    }
    return {w:c.w||0, h:c.h||0};
  }

  function cutMass(c){
    const z=v=>(''+(Math.round(v*10)/10)).replace('.',',');
    if(c.t==='k') return z(Math.round(cutLen(c)))+' cm · '+c.w+' × '+c.dp+' mm · '+(c.seite==='oben'?'Oberseite':'Unterseite');
    if(c.t==='p') return (c.pts||[]).length+' Punkte';
    if(c.t==='c') return 'Ø '+z(c.d)+' cm';
    return z(c.w)+' × '+z(c.h)+' cm';
  }

  function cutTypName(c){
    if(c.preset) return PRESETS[c.preset].label;
    return {r:'Ausschnitt', c:'Runder Ausschnitt', p:'Freie Kontur', k:'Kabelkanal'}[c.t]||'Bearbeitung';
  }

  function presetCount(k){ return S.cuts.filter(c=>c.preset===k).length; }

  function kanalLfmPreis(w,t){
    const bStufen=Math.max(0,Math.ceil(((w||60)-KANAL_PRICE.wBasis)/KANAL_PRICE.breiteStufe));
    const tStufen=Math.max(0,Math.ceil(((t||10)-KANAL_PRICE.tBasis)/KANAL_PRICE.tiefeStufe));
    return KANAL_PRICE.lfm + bStufen*KANAL_PRICE.breitePlus + tStufen*KANAL_PRICE.tiefePlus;
  }

  function kanalPunkte(c){
    const d=dims(), L=Math.max(1,c.len||10);
    const p = c.dir==='quer'
      ? [[c.cx, c.cy-L/2],[c.cx, c.cy+L/2]]
      : [[c.cx-L/2, c.cy],[c.cx+L/2, c.cy]];
    const bisKante=(a,b)=>{                       /* a wird ueber b hinaus verlaengert */
      const vx=a[0]-b[0], vy=a[1]-b[1];
      if(!vx&&!vy) return a;
      const kand=[];
      if(vx<0) kand.push((0-a[0])/vx); if(vx>0) kand.push((d.w-a[0])/vx);
      if(vy<0) kand.push((0-a[1])/vy); if(vy>0) kand.push((d.h-a[1])/vy);
      const t=Math.min(...kand.filter(v=>v>=0));
      return isFinite(t)?[a[0]+vx*t, a[1]+vy*t]:a;
    };
    const en=c.enden||'zu';
    if(en.indexOf('a')>=0) p[0]=bisKante(p[0],p[1]);
    if(en.indexOf('e')>=0) p[p.length-1]=bisKante(p[p.length-1],p[p.length-2]);
    return p;
  }

  function polyAbs(c){ return (c.pts||[]).map(p=>[c.cx+p[0], c.cy+p[1]]); }

  function maschineMass(){ return MASCHINE_MASSE[S.maschineMass]||MASCHINE_MASSE['52x18.1']; }

  function maxTiefe(){ return Math.max(3, Math.round((+S.thick||25)*0.6)); }

  function cutMinEdge(){ return S.mat==='compact' ? 3 : 5; }

  function cutAbstaende(c){
    const w=c.t==='c'?c.d:c.w, h=c.t==='c'?c.d:c.h;
    return { l:konturAbstand(c.cx-w/2,c.cy,-1,0), r:konturAbstand(c.cx+w/2,c.cy,1,0),
             t:konturAbstand(c.cx,c.cy-h/2,0,-1), b:konturAbstand(c.cx,c.cy+h/2,0,1) };
  }

  function konturAbstand(px,py,dx,dy){
    const d=dims();
    if(S.form!=='lform'){ return dx>0?d.w-px:dx<0?px:dy>0?d.h-py:py; }
    const g=lfPts(), n=g.pts.length; let best=Infinity;
    for(let i=0;i<n;i++){ const a=g.pts[i], b=g.pts[(i+1)%n];
      const ex=b[0]-a[0], ey=b[1]-a[1], den=dx*ey-dy*ex; if(Math.abs(den)<1e-9) continue;
      const t=((a[0]-px)*ey-(a[1]-py)*ex)/den, u=((a[0]-px)*dy-(a[1]-py)*dx)/den;
      if(t>1e-6&&u>=-1e-6&&u<=1+1e-6) best=Math.min(best,t); }
    return isFinite(best)?best:(dx>0?d.w-px:dx<0?px:dy>0?d.h-py:py);
  }

  function cornerSum(){ return radienpreis(cornerCount()); }

  return { calc, isStandard, needsOffer, shopHit, hitPreis, kurvenPreis, kurvenSchluessel,
           areaM2, perimM, dims, lfGeo, lfPts, cornerCount, cornerLabel, cornerName,
           massbandStrecke, massbandName, cutPrice, cutMass, cutTypName, presetCount, cutAbstaende,
           dekorList, ensureDekor, kanal, auf90 };
}
export { preisKern };
