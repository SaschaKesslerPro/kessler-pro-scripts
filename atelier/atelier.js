import {validateCuts} from './geometry.mjs';
import {lineTotal} from './shopify-cart.mjs';

const $=id=>document.getElementById(id);
/* Live laeuft das Skript ueber jsDelivr: Bilder muessen von dort kommen, nicht vom Webflow-Host. */
const assetUrl=p=>((api&&api.assetBase&&api.assetBase())||'assets/kfg/')+p;
const moneyDe=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
/* Waehrung und Versandpauschale gehoeren dem Kern: auf /pl-pl/ sind es Zloty. */
const money=n=>(api&&api.money?api.money(n):moneyDe(n));
const versand=()=>(api&&api.shipping?api.shipping():{betrag:19.99,text:'19,99 \u20ac'});
const number=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(n);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=(content,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
const chevron=svg('<path d="m9 5 7 7-7 7"/>');
const check=svg('<path d="m5 12 4 4L19 6"/>');
const expand=svg('<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>');
const shapes={rect:['Rechteck','<rect x="3" y="6" width="18" height="12" rx="1"/>'],round:['Rund','<circle cx="12" cy="12" r="9"/>'],lform:['L-Form','<path d="M3 4h18v7H11v9H3Z"/>'],bauch:['Bauchausschnitt','<path d="M3 5h18v14h-4l-2-5H9l-2 5H3Z"/>']};
const materials={dekor:{name:'Möbelplatte',desc:'Beschichtet, mit passender ABS-Kante',image:'buk_28',meta:'18 / 25 / 36 mm'},mpx:{name:'Multiplex Birke',desc:'Sichtbare Furnierlagen, natur oder HPL',image:'mpx_21',meta:'21 / 40 mm'},compact:{name:'Compact / HPL',desc:'Schlanker Vollkern, markante Schnittkante',image:'compact_12',meta:'12 mm'}};
let step=0,api,snapshot,errors=[],timer,started=false,previousKey='',returnFocus=null,editingId=null;
let cart=[];try{cart=JSON.parse(sessionStorage.getItem('kessler-atelier-cart')||'[]');if(!Array.isArray(cart))cart=[];}catch{}
cart=cart.map(item=>({...item,quantity:Number.isSafeInteger(item.quantity)&&item.quantity>0?item.quantity:1}));
function status(text){$('appStatus').textContent=text;}
/* PL/EN: Der Kern bringt die Wortliste mit; nach jedem Schreiben laeuft sie hier drueber. */
function uebersetzen(el){ if(api&&api.translate)api.translate(el); }
/* Die beiden festen Dialoge stehen an <body> und werden vom Kern nicht erfasst.
   Beim Start ist die Wortliste oft noch unterwegs - darum genau einmal nachziehen,
   sobald sie da ist (und beim Oeffnen noch einmal, falls doch etwas fehlt). */
let dialogeUebersetzt=false;
function dialogeNachziehen(){
  if(dialogeUebersetzt||!api||!api.wortlisteDa||!api.wortlisteDa())return;
  dialogeUebersetzt=true;
  ['materialDialog','cartDialog'].forEach(id=>{const d=$(id);if(d)uebersetzen(d);});
}
function sectionTitle(title,body=''){return `<div class="panel_heading"><h2 tabindex="-1">${title}</h2>${body?`<p>${body}</p>`:''}</div>`;}
function group(title,desc,id,open=false){return `<details class="option_group" id="${id}"${open?' open':''}><summary><span><b>${title}</b><small>${desc}</small></span>${chevron}</summary><div class="group_body"></div></details>`;}

function boot(){
  if(started||!window.KFG?.atelier)return;started=true;api=window.KFG.atelier;
  const root=$('atelier');
  const storage=document.createElement('div');storage.id='coreStorage';storage.hidden=true;
  while(root.firstChild)storage.append(root.firstChild);root.append(storage);
  const shell=document.createElement('div');shell.className='atelier_shell';
  shell.innerHTML=`
    <div class="page_intro"><div><h1>Deine Tischplatte nach Maß</h1><p>Du bestimmst die Details. Wir fertigen deine Platte.</p></div><button class="text_button" id="shareConfig">${svg('<path d="M12 16V3m-4 4 4-4 4 4M5 13v7h14v-7"/>')}Konfiguration teilen</button></div>
    <nav class="step_nav" aria-label="Konfigurationsschritte">${['Material & Oberfläche','Form & Maße','Kanten & Extras','Übersicht'].map((label,i)=>`<button type="button" data-step="${i}"${i===0?' aria-current="step"':''}><span class="step_number">${i+1}</span><span>${label}</span>${i<3?chevron:''}</button>`).join('')}</nav>
    <div class="workbench">
      <aside class="work_preview" aria-label="Deine Platte">
        <div class="preview_surface">
          <div class="preview_toolbar"><div class="view_switch" id="viewSwitch"></div><button type="button" class="icon_button" id="expandPreview" aria-label="Vorschau vergrößern">${expand}</button></div>
          <div class="preview_canvas" id="canvasMount"></div>
          <section class="corner_legend" id="cornerLegend" aria-label="Eckenradien" hidden></section>
          <div class="preview_caption"><div><strong id="previewName">Buche</strong><span id="previewDescription">Möbelplatte, 25 mm</span></div><span class="view_hint">${svg('<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 3v5h-5"/>')}<span id="viewHint">Ziehen zum Drehen</span></span></div>
        </div>
        <p class="texture_test_note" id="textureTestNote" hidden>Texturtest: KI-erweiterte Materialvorschau. Das Originaldekor siehst du in der Farbauswahl und im Kantenfoto.</p>
        <div class="preview_facts"><div><span>Dein Maß</span><strong id="factDimensions"></strong></div><div><span>Stärke</span><strong id="factThickness"></strong></div><div><span>Bearbeitungen</span><strong id="factExtras"></strong></div></div>
        <button class="edge_preview" id="edgePreview"><img id="edgeImage" width="160" height="110" alt="Kantenaufnahme des gewählten Materials"><span><b>Die Kante macht den Unterschied.</b><span id="edgeDescription"></span><small>Originalaufnahme ansehen</small></span>${chevron}</button>
        
      </aside>
      <div class="work_controls">
        <section class="flow_panel" id="panel0" aria-label="Material und Oberfläche">
          ${sectionTitle('Was passt zu deiner Platte?')}
          <div class="material_choices" id="materialChoices">${Object.entries(materials).map(([k,m])=>`<button class="material_choice" type="button" data-material="${k}" aria-pressed="false"><img src="${assetUrl('kante/'+m.image+'.webp')}" width="104" height="76" alt=""><span><b>${m.name}</b><small>${m.desc}</small></span><span class="selection_check">${check}</span></button>`).join('')}</div>
          <div class="material_help"><button class="text_button" data-dialog="materialDialog">Materialien vergleichen</button><button class="text_button" id="sewingTemplate">Vorlage für Nähtische</button></div>
          <div id="sewingNotice" class="info_note" hidden>Nähtischplatte gewählt. Maschinen-Ausschnitt und Maßband findest du bei Kanten & Extras. <button type="button" id="leaveSewing">Zur Möbelplatte</button></div>
          <div id="surfaceMount"></div><div class="field_heading"><h3>Oberfläche</h3><span id="selectedDecor"></span></div><div id="dekorMount"></div>
          <div class="thickness_header"><h3>Plattenstärke</h3><button class="text_button" data-dialog="materialDialog">Welche passt?</button></div><div id="thicknessMount"></div>
          <button class="sample_help" id="sampleHelp">${svg('<path d="m4 9 8-5 8 5-8 5-8-5Zm0 5 8 5 8-5"/>')}<span>Du möchtest die Oberfläche erst fühlen?<small>Musterbox mit vier Dekoren im Shop ansehen</small></span>${chevron}</button>
        </section>
        <section class="flow_panel" id="panel1" aria-label="Form und Maße" hidden>
          ${sectionTitle('Welche Form brauchst du?')}
          <div class="shape_choices">${Object.entries(shapes).map(([k,[n,p]])=>`<button type="button" class="shape_choice" data-shape="${k}" aria-pressed="false">${svg(p)}<span>${n}</span></button>`).join('')}</div>
          <div class="field_heading"><h3>Deine Maße</h3><span>Alle Plattenmaße in cm</span></div><div id="dimensionsMount"></div>
        </section>
        <section class="flow_panel" id="panel2" aria-label="Kanten und Extras" hidden>
          ${sectionTitle('Der letzte Schliff.')}
          ${group('Kantenprofil & Farbe','Passend zur Oberfläche oder bewusst anders','edgeGroup',true)}
          ${group('Ecken abrunden','Alle Ecken gemeinsam oder einzeln einstellen','cornerGroup')}
          ${group('Bohrungen & Kabeldurchlässe','Kabel führen und das Gestell befestigen','holesGroup')}
          ${group('Weitere Ausschnitte','Steckdosen, Spüle und Kochfeld','kitchenGroup')}
          ${group('Individuell bearbeiten','Kabelkanal, Ausschnitte oder eigenes Bohrbild','customGroup')}
          ${group('Nähmaschine & Maßband','Ausschnitt, Maschinenmodell und Maßband','sewingGroup')}
          <div id="cutEditorMount"></div><div id="cutErrors" class="validation_errors" role="alert" hidden></div>
          <div class="info_note" id="roundInfo" hidden>Bei runden Platten stehen Ausschnitte in diesem Konfigurator nicht zur Verfügung.</div>
        </section>
        <section class="flow_panel" id="panel3" aria-label="Konfiguration prüfen" hidden>
          ${sectionTitle('Deine Platte auf einen Blick.')}
          <div id="reviewContent"></div>
          <div class="order_process" id="orderProcess"></div>
          <p class="demo_explanation" id="draftNote"></p>
        </section>
        <div class="step_actions"><button id="backStep" class="text_button" type="button" hidden>Zurück</button><span id="stepProgress">Schritt 1 von 4</span></div>
        <div class="purchase_bar"><div class="price_block"><span id="priceContext">Deine Platte</span><strong id="atelierPrice">–</strong><small id="atelierTax">inkl. MwSt., zzgl. Versand</small></div><button type="button" class="primary_button" id="continueStep">Weiter zu Form & Maße ${chevron}</button></div>
        <p id="priceStatus" class="price_status" role="status"></p>
      </div>
    </div>
  `;
  root.append(shell);
  root.append($('toast'));
  function move(id,target){const el=$(id);if(el)$(target).append(el);return el;}
  move('btn3d','viewSwitch').textContent='Produktansicht';move('btn2d','viewSwitch').textContent='Maßzeichnung';
  move('stage','canvasMount');move('stage3d','canvasMount');
  move('dekorGrid','dekorMount');move('thickChips','thicknessMount');
  // Preserve the original linked controls and calculations; only arrange their DOM.
  const surface=$('mpxSurfaceBlock')||$('surfaceBlock');if(surface)$('surfaceMount').append(surface);
  move('kfgStep3','dimensionsMount');
  const edge=$('kfgStep4');$('edgeGroup').querySelector('.group_body').append(edge);
  $('cornerGroup').querySelector('.group_body').append($('cornerBlock'));
  function into(id,groupId){const e=$(id);if(e)$(groupId).querySelector('.group_body').append(e);}
  into('grpDurchlass','holesGroup');const bohr=root.querySelector('[data-x="bohr"]');if(bohr)$('holesGroup').querySelector('.group_body').prepend(bohr.closest('label'));
  into('grpKueche','kitchenGroup');into('grpCustom','customGroup');into('grpFrei','customGroup');
  into('grpMaschine','sewingGroup');into('massbandBlock','sewingGroup');
  move('cutList','cutEditorMount');
  // Always show mounted bodies; the four new steps own disclosure and focus.
  for(const id of ['kfgStep3','kfgStep4'])$(id).classList.add('is-open');
  const quick=$('quickBlock');if(quick){const d=document.createElement('details');d.className='standard_sizes';d.open=true;d.innerHTML='<summary>Standardmaße ab Lager — sofort lieferbar</summary>';quick.before(d);d.append(quick);}
  const individual=$('cornerSelBlock');if(individual){const d=document.createElement('details');d.className='individual_corners';d.innerHTML='<summary>Ecken einzeln einstellen</summary>';individual.before(d);d.append(individual);}
  // Remove native Unicode placeholders; form illustrations and icons are authored SVGs.
  const drawNames={drawRect:'Rechteck zeichnen',drawCircle:'Rund zeichnen',drawPoly:'Freie Kontur zeichnen',addKanal:'Kabelkanal hinzufügen'};
  Object.entries(drawNames).forEach(([id,label])=>{if($(id))$(id).textContent=label;});
  $('drawPoly').hidden=true;$('drawPoly').disabled=true;
  // Precision labels should say what the coordinates refer to.
  $('cutEditorMount').addEventListener('focusin',()=>{if(step!==2)goStep(2);});
  root.addEventListener('click',e=>{
    const st=e.target.closest('[data-step]');if(st){goStep(+st.dataset.step);return;}
    const m=e.target.closest('[data-material]');if(m){api.material(m.dataset.material);status(materials[m.dataset.material].name+' gewählt.');return;}
    const sh=e.target.closest('[data-shape]');if(sh){api.shape(sh.dataset.shape);api.setView('2d');schedule();return;}
    const edit=e.target.closest('[data-edit-step]');if(edit)goStep(+edit.dataset.editStep);
    if(e.target.closest('#drawRect,#drawCircle,#drawPoly')){api.setView('2d');if(matchMedia('(max-width:767px)').matches)setPreviewExpanded(true);}
  });
  root.addEventListener('input',schedule);root.addEventListener('change',schedule);root.addEventListener('click',schedule);
  $('continueStep').addEventListener('click',()=>{sync();if(!snapshot.valid||errors.length){goStep(errors.length?2:1);return;}if(step<3)goStep(step+1);else if(snapshot.offer)quotePreview();else addToCart();});
  $('backStep').addEventListener('click',()=>goStep(step-1));
  $('sewingTemplate').addEventListener('click',()=>{api.material('szwal');schedule();status('Nähtisch-Vorlage geladen.');});
  $('leaveSewing').addEventListener('click',()=>api.material('dekor'));
  $('shareConfig').addEventListener('click',share);
  $('sampleHelp').addEventListener('click',()=>openSampleDialog());
  $('edgePreview').addEventListener('click',()=>openEdgeDialog());
  $('expandPreview').addEventListener('click',()=>setPreviewExpanded(!root.classList.contains('preview_expanded')));
  $('viewSwitch').addEventListener('click',()=>schedule());
  document.addEventListener('keydown',e=>{
    if(!root.classList.contains('preview_expanded'))return;
    if(e.key==='Escape')setPreviewExpanded(false);
    if(e.key==='Tab'){
      const buttons=[...root.querySelectorAll('.work_preview button')].filter(b=>b.getClientRects().length&&!b.disabled);
      if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus();}
      else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}
    }
  });
  window.addEventListener('kfg:change',schedule);
  api.setView('3d');sync();renderCart();
  ['materialDialog','cartDialog'].forEach(id=>{const d=$(id);if(d)uebersetzen(d);});
  root.dataset.ready='true';
}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,50);}
function contour(s){
  if(s.config.form==='round')return Array.from({length:240},(_,i)=>[s.dims.w/2+Math.cos(i*Math.PI/120)*s.dims.w/2,s.dims.h/2+Math.sin(i*Math.PI/120)*s.dims.h/2]);
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',api.outline());
  const length=path.getTotalLength(),count=Math.min(3000,Math.ceil(length/0.3));
  return Array.from({length:count},(_,i)=>{const p=path.getPointAtLength(i*length/count);return[p.x,p.y];});
}
function dimsText(s){return s.config.form==='round'?`Ø ${number(s.dims.w)} cm`:`${number(s.dims.w)} × ${number(s.dims.h)} cm`;}
function setText(id,text){if($(id).textContent!==text)$(id).textContent=text;}
function sync(){
  if(!api)return;
  snapshot=api.snapshot();const s=snapshot,c=s.config,p=s.price;
  $('atelier').dataset.view=c.view;
  setText('draftNote',api.checkout?'Deine Platten sammeln sich hier. Erst der letzte Schritt legt sie in den Warenkorb des Shops.':'Designvorschau: Der Warenkorb speichert deinen Entwurf nur in dieser Browsersitzung.');
  $('textureTestNote').hidden=!api.textureInfo()?.generated;
  const corners=api.cornerDetails();
  $('cornerLegend').hidden=c.view!=='2d'||!corners.length;
  $('atelier').classList.toggle('has_corner_legend',corners.length>0);
  const legend=corners.length?`<div class="corner_legend_heading"><strong>Eckenradien</strong><span>Radius in mm</span></div><ol>${corners.map(k=>`<li><span class="corner_number">${k.number}</span><span class="corner_name">${esc(k.name)}</span><strong>${k.radius?'R'+number(k.radius):'Eckig'}${k.minimum?'<small>Mindestmaß</small>':''}</strong></li>`).join('')}</ol>`:'';
  if($('cornerLegend').innerHTML!==legend)$('cornerLegend').innerHTML=legend;
  errors=s.valid?validateCuts(c.cuts,contour(s),s.minEdge):[];
  const sewing=c.mat==='szwal',extras=c.cuts.length+(c.extras.bohr?1:0)+(c.massband!=='none'?1:0);
  document.querySelectorAll('[data-material]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.material===c.mat)));
  document.querySelectorAll('[data-shape]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.shape===c.form));b.disabled=sewing&&b.dataset.shape==='round';});
  $('sewingNotice').hidden=!sewing;$('materialChoices').hidden=sewing;
  $('sewingGroup').hidden=!sewing;$('holesGroup').hidden=c.form==='round';$('kitchenGroup').hidden=sewing||c.form==='round';$('customGroup').hidden=sewing||c.form==='round';$('cornerGroup').hidden=c.form==='round';$('roundInfo').hidden=c.form!=='round';
  setText('previewName',p.dekorName);setText('previewDescription',`${s.material.name}, ${p.thickName}`);
  setText('viewHint',c.view==='3d'?'Ziehen zum Drehen':'Draufsicht mit Maßen');
  setText('factDimensions',dimsText(s));setText('factThickness',p.thickName);setText('factExtras',extras?`${extras} gewählt`:'Keine');
  setText('selectedDecor',p.dekorName);setText('edgeDescription',s.edgeNames.join(', '));
  if($('edgeImage').getAttribute('src')!==s.edgePhoto.src)$('edgeImage').src=s.edgePhoto.src;
  $('edgeImage').alt=`Kantenaufnahme ${p.dekorName}, ${s.material.name}`;
  const closedPrice=!s.valid||errors.length>0||s.offer;
  setText('atelierPrice',!s.valid||errors.length?'–':s.offer?'Preis auf Anfrage':money(p.total));
  setText('priceContext',s.standard?'Deine Platte ab Lager':'Deine Maßanfertigung');
  setText('atelierTax',s.standard?'inkl. MwSt., Versand kostenfrei':'inkl. MwSt., zzgl. '+versand().text+' Versand');
  $('continueStep').disabled=(!s.valid||errors.length>0)&&step===3;
  if(step===3)$('continueStep').innerHTML=(s.offer?'Anfrage vorbereiten':editingId?'Änderungen speichern':'Platte hinzufügen')+chevron;
  /* Die Zeile meldet sich nur noch, wenn etwas zu tun ist — Fliesstext ohne
   Handlungsbedarf stand sonst unter jedem Schritt (Sascha, 11.09.). */
  setText('priceStatus',!s.valid?'Bitte korrigiere die markierten Maße.':errors.length?'Bitte prüfe die Position deiner Bearbeitungen.':s.offer?'Für diese Ausführung ist ein individuelles Angebot nötig.':'');
  $('cutErrors').hidden=!errors.length;
  const errorHTML=errors.map(e=>`<p><b>Bearbeitung ${e.index+1}:</b> ${esc(e.message)}</p>`).join('');
  if($('cutErrors').innerHTML!==errorHTML)$('cutErrors').innerHTML=errorHTML;
  document.querySelectorAll('#cutList .kfg_cutrow').forEach((row,i)=>{
    row.classList.toggle('geometry_error',errors.some(e=>e.index===i));
    row.querySelectorAll('input').forEach(input=>input.setAttribute('aria-invalid',String(errors.some(e=>e.index===i))));
    row.querySelectorAll('label').forEach(label=>{const t=label.firstChild;if(t?.nodeType===3){if(t.textContent.includes('X ab links'))t.textContent='Mitte ab links';if(t.textContent.includes('Y ab hinten'))t.textContent='Mitte ab hinten';}});
  });
  document.querySelectorAll('.kfg_field input').forEach(input=>{const field=input.closest('.kfg_field'),error=field.querySelector('.err'),range=field.querySelector('.range');input.setAttribute('aria-invalid',String(field.classList.contains('is-error')));const ids=[range?.id,error?.id].filter(Boolean);if(ids.length)input.setAttribute('aria-describedby',ids.join(' '));});
  // Shared core native choices are kept accessible after every rebuild.
  document.querySelectorAll('#thickChips button,#dekorGrid button,#edgeChips button,#absChips button').forEach(b=>{b.type='button';});
  const key=JSON.stringify({c,p,errors,customText:$('customText').value});if(key!==previousKey){renderReview();previousKey=key;}
  uebersetzen();dialogeNachziehen();
}
function goStep(next){
  step=Math.max(0,Math.min(3,next));
  for(let i=0;i<4;i++){ $('panel'+i).hidden=i!==step;const b=document.querySelector(`.step_nav [data-step="${i}"]`);b.toggleAttribute('data-complete',i<step);if(i===step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current'); }
  $('backStep').hidden=step===0;setText('stepProgress',`Schritt ${step+1} von 4`);
  $('continueStep').innerHTML=[`Weiter zu Form & Maße ${chevron}`,`Weiter zu Kanten & Extras ${chevron}`,`Zur Übersicht ${chevron}`,`${editingId?'Änderungen speichern':'Platte hinzufügen'} ${chevron}`][step];
  api.setView(step===0?'3d':'2d');sync();
  const heading=$('panel'+step).querySelector('h2');heading.focus({preventScroll:true});
  const target=matchMedia('(max-width:767px)').matches?$('panel'+step):document.querySelector('.step_nav');target.scrollIntoView({behavior:'instant',block:'start'});
  uebersetzen();
}
function renderReview(){
  const s=snapshot,c=s.config,p=s.price;
  const rows=[['Material & Oberfläche',`${s.material.name} · ${p.dekorName}`,0],['Plattenstärke',p.thickName,0],['Form & Maße',`${shapes[c.form][0]} · ${dimsText(s)}`,1]];
  if(c.form==='lform')rows.push(['Ausklinkung',`${number(c.lf.aw)} × ${number(c.lf.ah)} cm, ${c.lf.pos==='vl'?'vorne links':'vorne rechts'}${c.lf.schnitt==='schraeg'?`, schräg ${c.lf.winkel}°`:''}`,1]);
  if(c.form==='bauch')rows.push(['Bauchausschnitt',`${c.bs.art==='welle'?'Geschwungen':'Trapez'} · Tiefe ${number(c.bs.t)} cm`,1]);
  rows.push(['Kante',s.edgeNames.join(', ')+(c.absColor!=='dekor'?` · ${c.absColor}`:''),2]);
  if(c.form!=='round')rows.push(['Ecken',s.cornerLabel,2]);
  if(c.extras.bohr)rows.push(['Montagebohrungen','4 × Ø8 mm',2]);
  c.cuts.forEach((cut,i)=>rows.push([s.cuts[i].label||'Freier Ausschnitt',`${s.cuts[i].mass}${cut.cx!=null?` · Mitte: ${number(cut.cx*10)} mm ab links, ${number(cut.cy*10)} mm ab hinten`:''}`,2]));
  if(c.massband!=='none')rows.push(['Maßband',`${c.massband==='laser'?'Gelasert':'Aufkleberkante'}, Nullpunkt ${c.massbandNull}`,2]);
  if(c.machine)rows.push(['Nähmaschine',c.machine,2]);
  if(c.extras.custom){rows.push(['Individuelle Anfrage',$('customText').value.trim()||'Eigenes Bohrbild · Details noch ergänzen',2]);if($('uploadInput').files.length)rows.push(['Skizze',$('uploadInput').files[0].name,2]);}
  const costs=[['Platte',p.basis],['Kantenbearbeitung',p.kante],['Eckenrundung',p.ecken],['Formzuschnitt',p.lschnitt],['Weitere Bearbeitungen',p.extras]].filter((r,i)=>i===0||r[1]>0);
  const shipping=s.standard?0:versand().betrag;
  $('reviewContent').innerHTML=`<div class="review_rows">${rows.map(([label,value,index])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong><button type="button" data-edit-step="${index}" aria-label="Ändern \u00b7 ${esc(label)}">Ändern</button></div>`).join('')}</div><details class="review_costs" open><summary>Dein Preis im Detail</summary>${costs.map(([n,v])=>`<div><span>${n}</span><b>${s.offer?'Auf Anfrage':money(v)}</b></div>`).join('')}<div><span>Versand</span><b>${shipping?money(shipping):'Kostenfrei'}</b></div><div class="review_total"><span>Gesamt inkl. MwSt.</span><strong>${!s.valid||errors.length?'Bitte Konfiguration prüfen':s.offer?'Angebot erforderlich':money(p.total+shipping)}</strong></div></details>${errors.length?'<p class="error_note">Bitte korrigiere die Bearbeitungen im vorherigen Schritt.</p>':''}`;
  $('orderProcess').innerHTML=s.standard?'<h3>Deine Platte ab Lager</h3><p>Diese Ausführung liegt bei uns als Lagerartikel. Sie geht ohne Sonderfertigung in den Warenkorb des Shops, der Versand ist kostenfrei.</p>':'<h3>Direkt bestellen und bezahlen</h3><p>Deine Platte sammelt sich zuerst bei deinen Platten. Dort stellst du die Stückzahl ein.</p><ol class="order_steps"><li>Du legst alle Platten in den Warenkorb des Shops und bezahlst.</li><li>Wir schicken dir die technische Zeichnung deiner Platte per E-Mail.</li><li>Du prüfst die Maße und bestätigst sie über den Link. Ohne Rückmeldung gilt die Zeichnung nach 72 Stunden als freigegeben — dann fertigen wir.</li></ol>';
  if(s.offer){api.syncLink();$('orderProcess').innerHTML=api.inquiry
    ?'<h3>Deine individuelle Anfrage</h3><p>Für ein eigenes Bohrbild rechnen wir von Hand. Wir bereiten eine E-Mail mit deiner Konfiguration vor — beschreibe darin, was du brauchst, und hänge deine Skizze an.</p>'
    :'<h3>Deine individuelle Anfrage</h3><p>Öffne diese Auswahl im Live-Konfigurator, um ein Angebot anzufragen.</p><a class="secondary_button" target="_blank" rel="noopener" href="https://www.kessler-pro.com/tischplatte-nach-mass'+esc(location.hash)+'">Auswahl im Live-Konfigurator öffnen</a>';}
}
function setPreviewExpanded(on){
  const root=$('atelier');root.classList.toggle('preview_expanded',on);document.body.classList.toggle('preview_open',on);
  $('expandPreview').setAttribute('aria-label',on?'Vorschau verkleinern':'Vorschau vergrößern');
  document.querySelectorAll('.work_controls,.site_header,.step_nav,.page_intro,.site_footer,.draftbar').forEach(e=>e.inert=on);
  const preview=document.querySelector('.work_preview');
  if(on){preview.setAttribute('role','dialog');preview.setAttribute('aria-modal','true');}
  else{preview.removeAttribute('role');preview.removeAttribute('aria-modal');}
  if(on){returnFocus=document.activeElement;$('expandPreview').focus();}else returnFocus?.focus();
  requestAnimationFrame(()=>api.frame());
}
async function share(){
  api.syncLink();
  const url=location.href;
  try{await navigator.clipboard.writeText(url);$('shareConfig').innerHTML=check+'Link kopiert';status('Link zur Konfiguration kopiert.');}
  catch{showDialog('shareDialog',`<h2>Konfiguration teilen</h2><p>Kopiere diesen Link, um die Auswahl wieder zu öffnen.</p><label>Link<input readonly value="${esc(url)}"></label>`);}
}
function showDialog(id,html){
  let d=$(id);if(!d){d=document.createElement('dialog');d.id=id;d.className='atelier_dialog';document.body.append(d);}
  d.innerHTML=`<div class="dialog_header"><span></span><button class="icon_button" data-close aria-label="Dialog schließen">×</button></div>${html}`;d.querySelector('h2').id=id+'Title';d.setAttribute('aria-labelledby',id+'Title');uebersetzen(d);d.showModal();
}
function openEdgeDialog(){const s=snapshot;showDialog('edgeDialog',`<h2>${esc(s.material.name)} im Detail</h2><img class="large_edge" src="${esc(s.edgePhoto.src)}" alt="Kantenaufnahme ${esc(s.price.dekorName)}"><p>${esc(s.price.dekorName)} · ${esc(s.edgeNames.join(', '))}</p><p class="muted">${s.edgePhoto.ref?`Referenzaufnahme in ${s.edgePhoto.mm||25} mm. Deine gewählte Stärke: ${esc(s.price.thickName)}.`:'Originalaufnahme aus der Fertigung.'}</p>`);}
function openSampleDialog(){
  showDialog('sampleDialog',`<h2>Das Dekor in die Hand nehmen.</h2><p>Die Musterbox enthält vier Dekore und kostet 4,90 € — beim Plattenkauf rechnen wir sie voll an.</p><button class="primary_button" id="sampleMail" type="button">Musterbox anfragen</button>`);
  /* Der Shop hat noch kein Musterbox-Produkt. Der Kern hat den Weg, der heute
     funktioniert: eine vorbereitete E-Mail mit dem gewaehlten Dekor. */
  const m=$('sampleMail'); if(m)m.addEventListener('click',()=>{const b=$('btnMuster'); if(b)b.click();});
}
function capturePreview(){
  const clone=$('stage').cloneNode(true);clone.removeAttribute('id');clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  clone.querySelectorAll('[id]').forEach(e=>{const old=e.id,nu='cart-'+Date.now()+'-'+old;clone.querySelectorAll('*').forEach(n=>{for(const a of [...n.attributes])if(a.value.includes(`url(#${old})`))n.setAttribute(a.name,a.value.replaceAll(`url(#${old})`,`url(#${nu})`));});e.id=nu;});
  clone.querySelectorAll('.kfg_dim,.kfg_cut-handle,.kfg_corner-hit').forEach(e=>e.remove());return clone.outerHTML;
}
function addToCart(){
  if(!snapshot.valid||errors.length||snapshot.offer)return;
  api.syncLink();
  const existing=cart.find(item=>item.id===editingId);
  const item={id:existing?.id||Date.now(),quantity:existing?.quantity||1,config:structuredClone(snapshot.config),name:snapshot.material.name+' · '+snapshot.price.dekorName,dims:dimsText(snapshot),thick:snapshot.price.thickName,price:snapshot.price.total,shipping:snapshot.standard?0:versand().betrag,hash:location.hash,preview:capturePreview(),cuts:structuredClone(snapshot.cuts),workerBody:api.workerBody(),order:api.orderIntent?api.orderIntent():null};
  if(existing)cart=cart.map(row=>row.id===existing.id?item:row);else cart.push(item);
  editingId=null;persistCart();renderCart();$('cartDialog').showModal();
  $('cartDialogTitle').textContent=existing?'Deine Platte wurde aktualisiert.':'Deine Platte ist gespeichert.';
  status('Deine Platte liegt bei deinen Platten. Du kannst die Stückzahl ändern oder eine weitere konfigurieren.');
}
function anotherPlate(){
  editingId=null;window.KFG.setConfig(api.defaultConfig());
  $('customText').value='';$('machineInput').value='';$('uploadInput').value='';
  $('uploadZone').querySelector('b').textContent='Skizze oder Zeichnung hochladen';
  document.querySelectorAll('.option_group').forEach(d=>d.open=d.id==='edgeGroup');
  $('cartDialog').close();goStep(0);status('Neue Platte gestartet. Deine gespeicherten Platten bleiben im Warenkorb.');
}
function quotePreview(){
  api.syncLink();
  if(api.inquiry){api.inquiry();status('Deine Anfrage wird als E-Mail vorbereitet.');return;}
  showDialog('quoteDialog',`<h2>Dein eigenes Bohrbild anfragen</h2><p>${esc(snapshot.material.name)} · ${esc(snapshot.price.dekorName)} · ${esc(dimsText(snapshot))}</p><p>${esc($('customText').value||'Ergänze deine Beschreibung und eine Skizze für das individuelle Bohrbild.')}</p><p>In dieser Vorschau wird keine Anfrage gesendet. Öffne die Auswahl im Live-Shop und ergänze dort Beschreibung und Skizze erneut.</p><a class="primary_button" href="https://www.kessler-pro.com/tischplatte-nach-mass${esc(location.hash)}" target="_blank" rel="noopener">Zum Live-Konfigurator</a>`);
}
/* ── Uebergabe an den bestehenden Worker + Shopyflow ───────────────────────────
   Je Konfiguration ein Aufruf: der Worker legt die Variante mit dem Stueckpreis an
   und liefert die Attribute samt Token zurueck. Die Stueckzahl geht getrennt als
   quantity an Shopyflow — der Versand wird danach von Shopify fuer den gesamten
   Warenkorb berechnet. Lagerplatten gehen ohne Worker direkt auf ihre Variante. */
let checkoutBusy=false;
async function zurKasse(){
  if(!cart.length||checkoutBusy)return;
  if(!api.checkout){showDialog('checkoutPreviewDialog','<h2>Der Warenkorb ist bereit.</h2><p>Im fertigen Shop führt dieser Schritt direkt zum Shopify-Checkout – mit allen Platten und Stückzahlen.</p><p>Diese lokale Designvorschau löst keine Bestellung aus.</p>');return;}
  checkoutBusy=true;
  const button=document.querySelector('[data-preview-checkout]');
  const label=button?button.innerHTML:'';
  if(button){button.disabled=true;button.textContent='Platten gehen in den Warenkorb …';}
  const gesamt=cart.length;let fertig=0,fehler=null;
  for(const item of [...cart]){
    try{
      await api.checkout(item.order||{body:item.workerBody,lager:null},item.quantity);
      cart=cart.filter(row=>row.id!==item.id);fertig++;persistCart();
    }catch(e){fehler=e;break;}
  }
  renderCart();
  if(button){button.disabled=false;button.innerHTML=label;}
  checkoutBusy=false;
  if(!fehler){
    $('cartDialog').close();
    if(api.openCart)api.openCart();
    status('Alle Platten liegen im Warenkorb des Shops.');
    return;
  }
  const rest=gesamt-fertig;
  showDialog('checkoutErrorDialog','<h2>Der Warenkorb ist noch nicht vollständig.</h2>'
    +(fertig?`<p>${fertig} von ${gesamt} Platten liegen bereits im Warenkorb des Shops.</p>`:'')
    +`<p>Bei ${rest===1?'der letzten Platte':'den restlichen '+rest+' Platten'} hat der Shop nicht geantwortet: ${esc(String(fehler&&fehler.message||fehler))}</p>`
    +'<p>Deine noch offenen Platten sind gespeichert. Versuche es gleich noch einmal – es entsteht keine doppelte Position.</p>');
  status('Der Warenkorb konnte nicht vollständig übergeben werden.');
}
function persistCart(){try{sessionStorage.setItem('kessler-atelier-cart',JSON.stringify(cart));}catch{status('Der Entwurf bleibt nur bis zum Neuladen verfügbar.');}}
function renderCart(){
  setText('cartCount',String(cart.reduce((sum,item)=>sum+item.quantity,0)));
  setTimeout(()=>uebersetzen($('cartDialog')),0);
  if(!cart.length){$('cartBody').innerHTML='<div class="empty_cart">'+svg('<path d="M4 7h16v14H4zM8 7V5a4 4 0 0 1 8 0v2"/>')+'<h3>Platz für deine erste Platte.</h3><p>Konfiguriere deine Platte und prüfe sie im letzten Schritt.</p><button class="primary_button" data-close>Weiter konfigurieren</button></div>';return;}
  $('cartBody').innerHTML=cart.map(item=>`<article class="cart_item"><div class="cart_preview">${item.preview}</div><div><h3>${esc(item.name)}</h3><p>${esc(item.dims)} · ${esc(item.thick)}</p>${item.cuts.length?`<p>${item.cuts.length} Bearbeitung${item.cuts.length>1?'en':''}</p>`:''}<div class="cart_quantity"><span>Stückzahl</span><div><button data-quantity-step="-1" data-item="${item.id}" aria-label="Eine Platte weniger"${item.quantity===1?' disabled':''}>−</button><input type="number" inputmode="numeric" min="1" step="1" data-quantity="${item.id}" value="${item.quantity}" aria-label="Stückzahl ${esc(item.name)}"><button data-quantity-step="1" data-item="${item.id}" aria-label="Eine Platte mehr">+</button></div></div><strong>${money(lineTotal(item.price,item.quantity))}</strong><small>${money(item.price)} je Platte · inkl. MwSt.</small><div class="cart_item_actions"><button data-cart-edit="${item.id}">Bearbeiten</button><button data-cart-copy="${item.id}">Kopie anpassen</button><button data-cart-remove="${item.id}">Entfernen</button></div></div></article>`).join('')+`<div class="cart_totals"><span>Platten gesamt <small>${cart.reduce((sum,item)=>sum+item.quantity,0)} Stück · ${cart.length} Konfiguration${cart.length===1?'':'en'}</small></span><strong>${money(cart.reduce((sum,item)=>sum+Math.round(item.price*100)*item.quantity,0)/100)}</strong></div><p class="cart_shipping">Inkl. MwSt. Der Versand wird im Shopify-Checkout für den gesamten Warenkorb berechnet.</p><div class="cart_next"><h3>Möchtest du eine weitere Platte?</h3><button class="secondary_button" data-another-plate>Weitere Platte konfigurieren</button><button class="primary_button" data-preview-checkout>In den Warenkorb des Shops ${chevron}</button></div><p class="demo_explanation">${api.checkout?'Der Versand wird nach der Übergabe an den Shop für den gesamten Warenkorb berechnet.':'Designvorschau: Der Warenkorb bleibt auf diesem Rechner.'}</p>`;
}
document.addEventListener('click',e=>{
  /* Die Wortliste kommt erst nach dem Start an - die festen Dialoge laufen
     deshalb beim Oeffnen noch einmal durch die Uebersetzung. */
  const open=e.target.closest('[data-dialog]');if(open){const d=$(open.dataset.dialog);if(d){uebersetzen(d);d.showModal();}return;}
  if(e.target.closest('[data-close]'))e.target.closest('dialog')?.close();
  const mc=e.target.closest('[data-material-choice]');if(mc&&api){api.material(mc.dataset.materialChoice);mc.closest('dialog').close();goStep(0);}
  const remove=e.target.closest('[data-cart-remove]');if(remove){cart=cart.filter(x=>x.id!==+remove.dataset.cartRemove);persistCart();renderCart();}
  const edit=e.target.closest('[data-cart-edit],[data-cart-copy]');if(edit){const item=cart.find(x=>x.id===+(edit.dataset.cartEdit||edit.dataset.cartCopy));if(item){editingId=edit.hasAttribute('data-cart-edit')?item.id:null;window.KFG.setConfig(structuredClone(item.config));$('cartDialog').close();goStep(0);status(editingId?'Du bearbeitest diese Warenkorbposition.':'Kopie geladen. Das Original bleibt im Warenkorb.');}}
  const qty=e.target.closest('[data-quantity-step]');if(qty){const item=cart.find(x=>x.id===+qty.dataset.item);if(item){item.quantity=Math.max(1,item.quantity+(+qty.dataset.quantityStep));persistCart();renderCart();document.querySelector(`[data-item="${item.id}"][data-quantity-step="${qty.dataset.quantityStep}"]`)?.focus();}}
  if(e.target.closest('[data-another-plate]'))anotherPlate();
  if(e.target.closest('[data-preview-checkout]'))zurKasse();
  if(e.target.closest('[data-start]')){e.preventDefault();if(api)goStep(0);}
});
document.addEventListener('change',e=>{if(!e.target.matches('[data-quantity]'))return;const item=cart.find(x=>x.id===+e.target.dataset.quantity);if(!item)return;const quantity=Number(e.target.value);if(!Number.isSafeInteger(quantity)||quantity<1){e.target.value=item.quantity;status('Bitte eine ganze Stückzahl ab 1 eingeben.');return;}item.quantity=quantity;persistCart();renderCart();document.querySelector(`[data-quantity="${item.id}"]`)?.focus();});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
let attempts=0;const startTimer=setInterval(()=>{boot();if(started||++attempts>200){clearInterval(startTimer);if(!started)$('atelier').innerHTML='<p class="loading">Der Konfigurator konnte nicht geladen werden. Bitte lade diese Seite erneut.</p>';}},50);


