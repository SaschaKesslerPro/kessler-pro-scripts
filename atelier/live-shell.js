/* Huelle fuer die Webflow-Seite: das Stylesheet der Vorschau lag als eigene Datei
   neben index.html, die Dialoge standen fest im HTML. Auf der Seite bringt das
   Skript beides selbst mit, damit in Webflow nur ein leerer Container noetig ist. */
(function(){
  var css=__ATELIER_CSS__;
  var st=document.createElement('style'); st.id='kfgAtelierCss'; st.textContent=css;
  document.head.appendChild(st);
})();
function atelierShellAufbauen(api){
  var root=document.querySelector('[data-kfg-root]');
  if(root && !root.id) root.id='atelier';
  var bild=function(n){ return ((api&&api.assetBase&&api.assetBase())||'assets/kfg/')+'kante/'+n+'.webp'; };
  if(!document.getElementById('appStatus')){
    var st=document.createElement('div'); st.id='appStatus'; st.className='sr_only';
    st.setAttribute('role','status'); st.setAttribute('aria-live','polite');
    document.body.appendChild(st);
  }
  if(!document.getElementById('materialDialog')){
    var md=document.createElement('dialog');
    md.id='materialDialog'; md.className='atelier_dialog';
    md.setAttribute('aria-labelledby','materialDialogTitle');
    md.innerHTML='<div class="dialog_header"><h2 id="materialDialogTitle">Welches Material passt?</h2>'
      +'<button class="icon_button" data-close aria-label="Materialberatung schließen">×</button></div>'
      +'<div class="material_compare">'
      +'<article><img src="'+bild('buk_28')+'" alt="Möbelplatte mit ABS-Kante" width="300" height="200"><h3>Möbelplatte</h3><p>Eine beschichtete Platte mit umlaufender ABS-Kante. Viele Dekore und drei Stärken für Tisch, Regal oder Theke.</p><dl><dt>Stärken</dt><dd>18, 25 und 36 mm</dd><dt>Kante</dt><dd>ABS 2 mm, auch farbig</dd></dl><button class="secondary_button" data-material-choice="dekor">Möbelplatte wählen</button></article>'
      +'<article><img src="'+bild('mpx_21')+'" alt="Multiplex mit sichtbaren Furnierlagen" width="300" height="200"><h3>Multiplex Birke</h3><p>Die sichtbaren Furnierlagen machen die Kante zum Teil der Gestaltung. Natur oder mit HPL-Oberfläche wählbar.</p><dl><dt>Stärken</dt><dd>21 und 40 mm</dd><dt>Kante</dt><dd>Offen, profiliert oder mit ABS</dd></dl><button class="secondary_button" data-material-choice="mpx">Multiplex wählen</button></article>'
      +'<article><img src="'+bild('compact_12')+'" alt="Dünne Compact-Platte mit dunklem Kern" width="300" height="200"><h3>Compact / HPL</h3><p>Ein schlanker Vollkern mit sichtbarer Schnittkante. Zur Auswahl stehen Uni- und Marmordekore.</p><dl><dt>Stärke</dt><dd>12 mm</dd><dt>Kante</dt><dd>Geschliffen, gefast oder halbrund</dd></dl><button class="secondary_button" data-material-choice="compact">Compact wählen</button></article>'
      +'</div>';
    document.body.appendChild(md);
  }
  if(!document.getElementById('cartDialog')){
    var cd=document.createElement('dialog');
    cd.id='cartDialog'; cd.className='atelier_dialog cart_dialog';
    cd.setAttribute('aria-labelledby','cartDialogTitle');
    cd.innerHTML='<div class="dialog_header"><div><h2 id="cartDialogTitle">Deine Platten</h2>'
      +'<p>Deine konfigurierten Platten. Sie liegen noch nicht im Warenkorb des Shops — das macht der letzte Schritt.</p></div>'
      +'<button class="icon_button" data-close aria-label="Übersicht schließen">×</button></div><div id="cartBody"></div>';
    document.body.appendChild(cd);
  }
  document.querySelectorAll('dialog.atelier_dialog').forEach(function(d){
    d.addEventListener('click',function(e){ if(e.target===d) d.close(); });
  });
}
