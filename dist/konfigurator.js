/*! Kessler PRO — Tischplatten-Konfigurator  v1.1.0
 *  Rendert die komplette Konfigurator-UI in jeden Container mit [data-kfg-root].
 *  Daten: kfg-produktmatrix.json (Lagerartikel) · Bilder: assets/kfg/ — beide via jsDelivr.
 *  Public API: window.KFG = { version, getConfig(), setConfig(), reload(), _debug() }
 */
(function(){
  if (window.__KFG_LOADED) return;                      /* Idempotenz-Guard (Bootstrap-Quirk) */
  window.__KFG_LOADED = true;

  var VERSION = '1.11.8';
  /* Basis-URL aus dem eigenen <script src> ableiten — so zeigen Daten und Bilder
     IMMER auf denselben Commit wie das Script (vorher liefen sie auseinander). */
  var FALLBACK_BASE = 'https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@e39f969405f6a1adc0f10ea5b6a7957711631f55';
  var BASE = (function(){
    try{
      var me = document.currentScript && document.currentScript.src;
      if(!me){
        var all = document.querySelectorAll('script[src*="konfigurator.js"]');
        me = all.length ? all[all.length-1].src : '';
      }
      var i = me.indexOf('/dist/konfigurator.js');
      return i > 0 ? me.slice(0, i) : FALLBACK_BASE;
    }catch(e){ return FALLBACK_BASE; }
  })();
  var ROOT_SEL= '[data-kfg-root]';

  function boot(){
    var root = document.querySelector(ROOT_SEL);
    /* Fallback: Container selbst anlegen, solange die Webflow-Seite noch keinen hat */
    if (!root && /\/konfigurator(\/|$)/.test(location.pathname)) {
      root = document.createElement('div');
      root.setAttribute('data-kfg-root','');
      /* Vor dem Footer einhaengen — sonst landet der Konfigurator unter dem Footer.
         Reihenfolge: Main-Container → sonst vor dem ersten Footer-Element im Body. */
      var main = document.querySelector('main, [role="main"], .main-wrapper');
      if (main) {
        main.appendChild(root);
      } else {
        var foot = null, kids = document.body.children;
        for (var i=0;i<kids.length;i++){
          var el = kids[i], cn = (el.className||'')+'';
          if (el.tagName === 'FOOTER' || /(^|[\s_-])footer/i.test(cn)) { foot = el; break; }
        }
        if (foot) document.body.insertBefore(root, foot);
        else document.body.appendChild(root);
      }
    }
    if (!root) return;

    /* ── Styles einmalig injizieren (Webflow-Designer kann keine Pseudo-Elemente) ── */
    if (!document.getElementById('kfg-css')) {
      var st = document.createElement('style');
      st.id = 'kfg-css';
      st.textContent = KFG_CSS;
      document.head.appendChild(st);
    }

    /* ── Markup einsetzen ── */
    root.innerHTML = KFG_MARKUP;
    root.setAttribute('data-kfg-version', VERSION);

    /* ── Produktmatrix laden, dann UI starten (mit Timeout — UI startet nie später als 4 s) ── */
    var base = root.getAttribute('data-kfg-base') || BASE;
    window.__KFG_BASE = base;
    var done = false, ctl = ('AbortController' in window) ? new AbortController() : null;
    setTimeout(function(){ if(!done){ done = true; if(ctl) ctl.abort(); start({}); } }, 4000);
    fetch(base + '/dist/data/kfg-produktmatrix.json', {cache:'default', signal: ctl && ctl.signal})
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        var out = {};
        if (d && d.produkte) {
          for (var k in d.produkte) {
            var v = d.produkte[k];
            if (v.eur) out[k] = [Math.round(v.eur*100)/100, String(v.variantId).split('/').pop(), v.sku];
          }
        }
        if(!done){ done = true; start(out); }
      })
      .catch(function(){ if(!done){ done = true; start({}); } });   /* ohne Matrix: alles läuft über den Anfrage-Flow */
  }

  function start(shopData){
    KFG_APP(shopData);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

/* ═══════════════════════ CSS ═══════════════════════ */
var KFG_CSS = "\n  [data-kfg-root]{\n    --ink:#1E1E1E; --deep:#0A0A0A; --card:#F2F0EB; --alt:#FAFAFA; --hair:#E5E5E5;\n    --ok:#1c7a3d; --ok-bg:#e8f4ec; --warn:#9a6b12; --warn-bg:#faf3e2;\n    --s-3xs:4px; --s-2xs:8px; --s-xs:12px; --s-s:16px; --s-m:24px; --s-l:32px; --s-xl:48px; --s-2xl:64px;\n    --r:8px;\n  }\n  [data-kfg-root] *{box-sizing:border-box;margin:0;padding:0}\n  [data-kfg-root] button, [data-kfg-root] select, [data-kfg-root] input, [data-kfg-root] textarea{font-family:inherit}\n  \n\n  \n  \n  \n  \n  \n  \n  \n  \n  @media(min-width:768px){}\n\n  [data-kfg-root] .kfg_hero{max-width:1280px;margin-inline:auto;padding:var(--s-l) clamp(16px,4vw,80px) var(--s-s)}\n  [data-kfg-root] .kfg_hero h1{font-size:clamp(24px,3.4vw,36px);font-weight:500;letter-spacing:-.01em}\n  [data-kfg-root] .kfg_hero p{margin-top:var(--s-2xs);color:#555;font-size:15px;max-width:680px}\n  [data-kfg-root] .kfg_hero .anchor{color:var(--ink);font-weight:600}\n\n  [data-kfg-root] .kfg_layout{max-width:1280px;margin-inline:auto;padding:var(--s-s) clamp(16px,4vw,80px) 140px;\n    display:grid;grid-template-columns:1fr;gap:var(--s-m)}\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_layout{grid-template-columns:55fr 45fr;gap:var(--s-xl);padding-bottom:var(--s-2xl)}\n  }\n\n  /* \u2500\u2500 Preview \u2500\u2500 */\n  [data-kfg-root] .kfg_preview{background:var(--card);border-radius:16px;padding:var(--s-s);position:relative}\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_preview{padding:var(--s-m)}\n    /* Eigene Compositing-Ebene: die grosse Draufsicht muss beim Scrollen\n       sonst in jedem Frame neu gezeichnet werden, das ruckelt sichtbar.\n       (Im Block liegen keine fixed-Elemente, die Ebene stoert also nichts.) */\n    [data-kfg-root] .kfg_stickycol{position:sticky;top:84px;align-self:start;will-change:transform;\n      transition:top .16s ease}\n  }\n  [data-kfg-root] .kfg_preview-badge{position:absolute;top:var(--s-s);left:var(--s-s);z-index:2;display:inline-flex;align-items:center;gap:6px;\n    font-size:12px;font-weight:500;padding:6px 12px;border-radius:var(--r);background:var(--ok-bg);color:var(--ok)}\n  [data-kfg-root] .kfg_preview-badge.is-sonder{background:var(--warn-bg);color:var(--warn)}\n  [data-kfg-root] .kfg_preview-badge .dot{width:7px;height:7px;border-radius:50%;background:currentColor}\n  [data-kfg-root] .kfg_viewtoggle{position:absolute;top:var(--s-s);right:var(--s-s);z-index:2;display:flex;gap:2px;background:#fff;\n    border:1px solid var(--hair);border-radius:var(--r);padding:2px}\n  [data-kfg-root] .kfg_viewtoggle button{border:0;background:transparent;font-size:12px;font-weight:500;padding:6px 14px;\n    cursor:pointer;border-radius:6px;min-height:32px;color:#5F5F5F}\n  [data-kfg-root] .kfg_viewtoggle button.is-active{background:var(--ink);color:#fff}\n  [data-kfg-root] .kfg_preview-stage{width:100%;aspect-ratio:10/7.4;display:block}\n  [data-kfg-root] #stage3d{width:100%;aspect-ratio:10/7.4;display:none;border-radius:var(--r);cursor:grab;touch-action:none}\n  [data-kfg-root] .kfg_preview-hint{text-align:center;font-size:12px;color:#8a877f;padding-top:var(--s-2xs)}\n  [data-kfg-root] .ic-svg{width:14px;height:14px;flex:0 0 auto}\n  [data-kfg-root] .kfg_edge{cursor:pointer;transition:opacity .15s}\n  [data-kfg-root] .kfg_edge:hover{opacity:.75}\n  [data-kfg-root] .dim-line{stroke:#9b978c;stroke-width:1}\n  [data-kfg-root] .dim-text{font-family:'Onest',sans-serif;font-weight:600;font-size:var(--dim-fs,15px);fill:var(--ink);letter-spacing:.02em;\n    paint-order:stroke;stroke:var(--card);stroke-width:var(--dim-halo,3px);stroke-linejoin:round}\n\n  /* Detail */\n  /* Aufklapp-Zeile in JEDER Breite sichtbar: das Vorschaubild soll sich\n     jederzeit wegklicken lassen, so wie auf Mobil (Wunsch Sascha, 27.07.). */\n  /* Bearbeitungsliste: je Eintrag eine Zeile mit mm-Feldern */\n  /* Aufklappbare Schritte: zugeklappt bleibt die Kopfzeile mit Nummer,\n     Titel und der Zusammenfassung stehen. */\n  /* Kopfleiste ausblenden, solange im Konfigurator nach unten gescrollt\n     wird. Die Klasse sitzt auf den Kopfleisten selbst, nicht im Root —\n     deshalb ohne [data-kfg-root] davor. */\n  .kfg-headaway{transform:translateY(-100%) !important;transition:transform .22s ease !important}\n  [data-kfg-root] .kfg_step-head{cursor:pointer;-webkit-user-select:none;user-select:none}\n  [data-kfg-root] .kfg_step-head:hover .kfg_step-title{color:#000}\n  [data-kfg-root] .kfg_chev,\n  [data-kfg-root] .kfg_detail summary::after,\n  [data-kfg-root] .kfg_breakdown summary::after,\n  [data-kfg-root] .kfg_step-chev{content:'';flex:0 0 auto;display:inline-block;\n    width:8px;height:8px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;\n    transform:rotate(45deg);transform-origin:60% 60%;margin-left:10px;margin-bottom:3px;\n    opacity:.55;transition:transform .2s ease,opacity .2s ease}\n  [data-kfg-root] .kfg_step-head:hover .kfg_step-chev,\n  [data-kfg-root] .kfg_detail summary:hover::after{opacity:1}\n  [data-kfg-root] .kfg_step.is-open .kfg_step-chev,\n  [data-kfg-root] .kfg_detail[open] summary::after,\n  [data-kfg-root] .kfg_breakdown[open] summary::after{transform:rotate(225deg);margin-bottom:-2px}\n  [data-kfg-root] .kfg_step-body{display:none}\n  [data-kfg-root] .kfg_step.is-open .kfg_step-body{display:block}\n  [data-kfg-root] .kfg_step:not(.is-open) .kfg_step-head{margin-bottom:0}\n  /* Zugeklappt kompakter, sonst steht viel Luft um eine einzige Zeile */\n  [data-kfg-root] .kfg_step:not(.is-open){padding-top:var(--s-s);padding-bottom:var(--s-s)}\n  [data-kfg-root] .kfg_step.is-flash{outline:2px solid var(--ink);outline-offset:2px}\n  [data-kfg-root] .kfg_cutrow{border:1px solid var(--hair);border-radius:var(--r);\n    padding:var(--s-2xs) var(--s-xs) var(--s-xs);margin-top:var(--s-2xs);background:#fff}\n  [data-kfg-root] .kfg_cutrow-head{display:flex;align-items:center;gap:8px;font-size:13.5px;min-height:34px}\n  [data-kfg-root] .kfg_cutrow-head .ic{opacity:.55}\n  [data-kfg-root] .kfg_cutrow-head .pr{margin-left:auto;font-size:12.5px;color:#5F5F5F;white-space:nowrap}\n  [data-kfg-root] .kfg_cutrow-head .del{border:0;background:transparent;cursor:pointer;font-size:18px;\n    line-height:1;color:#b5b1a8;padding:0 2px;min-height:30px;min-width:30px}\n  [data-kfg-root] .kfg_cutrow-head .del:hover{color:var(--ink)}\n  [data-kfg-root] .kfg_cutrow-fields{display:flex;flex-wrap:wrap;gap:var(--s-2xs)}\n  [data-kfg-root] .kfg_cutrow-fields label{flex:1 1 96px;min-width:88px;max-width:160px;font-size:10.5px;color:#8a877f}\n  [data-kfg-root] .kfg_cutrow-fields .in{display:flex;align-items:center;border:1px solid var(--hair);\n    border-radius:6px;background:var(--alt);margin-top:3px}\n  [data-kfg-root] .kfg_cutrow-fields .in:focus-within{border-color:var(--ink)}\n  [data-kfg-root] .kfg_cutrow-fields input{width:100%;min-width:0;border:0;background:transparent;\n    padding:7px 0 7px 8px;font-size:13px;color:var(--ink);min-height:34px}\n  [data-kfg-root] .kfg_cutrow-fields select{width:100%;border:0;background:transparent;\n    padding:7px 6px;font-size:13px;color:var(--ink);min-height:34px;cursor:pointer}\n  [data-kfg-root] .kfg_cutrow-fields i{font-style:normal;font-size:10.5px;color:#9b978c;padding:0 8px}\n  [data-kfg-root] .kfg_cutrow-fields label.breit{flex:2 1 200px;max-width:340px}\n  [data-kfg-root] .kfg_cutlen{flex:1 0 100%;font-size:11.5px;color:#5F5F5F;margin-bottom:2px}\n  [data-kfg-root] .kfg_cutrow.is-warn{border-color:#e3c98f;background:var(--warn-bg)}\n  [data-kfg-root] .kfg_cutwarn{font-size:11px;color:var(--warn);margin-top:6px;display:block}\n  [data-kfg-root] .kfg_cutrow.is-sel{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}\n  [data-kfg-root] .kfg_detail{margin-top:var(--s-xs);background:transparent;border-radius:var(--r);padding:0}\n  [data-kfg-root] .kfg_detail summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:6px;\n    font-size:12.5px;color:#555;font-weight:500;background:#fff;border-radius:var(--r);padding:10px var(--s-xs);min-height:44px}\n  [data-kfg-root] .kfg_detail summary::-webkit-details-marker{display:none}\n  [data-kfg-root] .kfg_detail summary::after{margin-left:auto}\n  [data-kfg-root] .kfg_detail summary:hover{color:var(--ink)}\n  [data-kfg-root] .kfg_detail-inner{display:flex;align-items:center;gap:var(--s-s);position:relative;\n    background:#fff;border-radius:var(--r);padding:var(--s-xs);margin-top:var(--s-3xs)}\n  [data-kfg-root] .kfg_detail-badge{position:absolute;top:var(--s-2xs);left:var(--s-2xs);z-index:2;font-size:10px;font-weight:500;\n    letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:var(--r);\n    background:#ffffffd9;color:#5F5F5F;border:1px solid var(--hair)}\n  /* Vorschaubild bewusst klein: die Draufsicht ist das Produktbild und soll\n     dominieren (Wunsch Sascha, 27.07. - Groessen getauscht). */\n  [data-kfg-root] .kfg_detail img{width:38%;min-width:150px;max-width:220px;flex:0 0 auto;display:block;border-radius:6px;background:var(--alt)}\n  [data-kfg-root] .kfg_detail-label{font-size:12.5px;color:#5F5F5F;line-height:1.5;min-width:0}\n  [data-kfg-root] .kfg_detail-label b{display:block;font-weight:600;color:var(--ink);font-size:15px;margin-bottom:var(--s-3xs)}\n  [data-kfg-root] .kfg_detail-label span{display:block}\n  [data-kfg-root] .kfg_detail-label em{display:block;font-style:normal;font-size:10.5px;color:#9b978c;margin-top:var(--s-2xs)}\n  @media(max-width:560px){\n    [data-kfg-root] .kfg_detail{flex-direction:column;align-items:stretch;gap:var(--s-2xs)}\n    [data-kfg-root] .kfg_detail img{width:100%;max-width:none}\n    [data-kfg-root] .kfg_detail-label{text-align:center}\n  }\n\n  /* \u2500\u2500 Panel \u2500\u2500 */\n  [data-kfg-root] .kfg_panel{display:flex;flex-direction:column;gap:var(--s-m)}\n  [data-kfg-root] .kfg_step{border:1px solid var(--hair);border-radius:var(--r);padding:var(--s-s)}\n  @media(min-width:980px){[data-kfg-root] .kfg_step{padding:var(--s-m)}}\n  [data-kfg-root] .kfg_step-head{display:flex;align-items:baseline;gap:var(--s-xs);margin-bottom:var(--s-s)}\n  [data-kfg-root] .kfg_step-num{font-weight:500;font-size:12px;color:var(--ink);letter-spacing:.06em}\n  [data-kfg-root] .kfg_step-title{font-size:16px;font-weight:500}\n  [data-kfg-root] .kfg_step-sub{font-size:12.5px;color:#5F5F5F;margin-left:auto;text-align:right}\n  [data-kfg-root] .kfg_sublabel{font-size:12px;color:#5F5F5F;margin:var(--s-s) 0 var(--s-2xs)}\n\n  [data-kfg-root] .kfg_mat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s-2xs)}\n  [data-kfg-root] .kfg_mat{border:1.5px solid var(--hair);border-radius:var(--r);padding:var(--s-xs);cursor:pointer;background:#fff;\n    text-align:left;transition:border-color .15s}\n  [data-kfg-root] .kfg_mat.is-active{border-color:var(--ink)}\n  [data-kfg-root] .kfg_mat b{display:block;font-size:13.5px;font-weight:500;line-height:1.25}\n  [data-kfg-root] .kfg_mat small{font-weight:300;font-size:11px;color:#888;display:block;margin-top:var(--s-3xs);letter-spacing:.02em}\n\n  [data-kfg-root] .kfg_dekor-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--s-2xs);margin-top:var(--s-s)}\n  @media(min-width:560px){[data-kfg-root] .kfg_dekor-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}\n  [data-kfg-root] .kfg_dekor{border:1.5px solid var(--hair);border-radius:var(--r);cursor:pointer;padding:var(--s-3xs);background:#fff;\n    transition:border-color .15s;display:flex;flex-direction:column}\n  [data-kfg-root] .kfg_dekor.is-active{border-color:var(--ink)}\n  [data-kfg-root] .kfg_dekor .sw{aspect-ratio:1/1;width:100%;border-radius:5px;display:block;background-size:165%;background-position:center}\n  [data-kfg-root] .kfg_dekor span:last-child{display:block;font-size:10px;text-align:center;padding-top:var(--s-3xs);color:#5F5F5F;line-height:1.2;height:auto}\n  [data-kfg-root] .kfg_dekor-note{font-size:11px;color:#9b978c;margin-top:var(--s-2xs)}\n\n  [data-kfg-root] .kfg_chips{display:flex;flex-wrap:wrap;gap:var(--s-2xs)}\n  [data-kfg-root] .kfg_chip{border:1.5px solid var(--hair);border-radius:var(--r);background:#fff;padding:10px 16px;font-size:13.5px;\n    cursor:pointer;min-height:44px;display:inline-flex;align-items:center;gap:var(--s-2xs);transition:border-color .15s}\n  [data-kfg-root] .kfg_chip.is-active{border-color:var(--ink);font-weight:500}\n  [data-kfg-root] .kfg_chip small{font-size:11px;color:#888;font-weight:400}\n  [data-kfg-root] .kfg_chip:disabled{opacity:.4;cursor:not-allowed}\n\n  [data-kfg-root] .kfg_dims{display:grid;grid-template-columns:1fr 1fr;gap:var(--s-xs)}\n  [data-kfg-root] .kfg_field label{font-size:12px;color:#5F5F5F;display:block;margin-bottom:var(--s-3xs)}\n  [data-kfg-root] .kfg_field .in{display:flex;align-items:center;border:1.5px solid var(--hair);border-radius:var(--r);overflow:hidden}\n  [data-kfg-root] .kfg_field input{border:0;outline:0;width:100%;padding:var(--s-xs);font-size:16px;font-weight:500;min-height:44px}\n  [data-kfg-root] .kfg_field .unit{padding-right:var(--s-xs);color:#999;font-size:13px}\n  [data-kfg-root] .kfg_field .range{font-weight:300;font-size:11px;color:#9b978c;margin-top:var(--s-3xs);display:block;letter-spacing:.03em}\n  [data-kfg-root] .kfg_field.is-error .in{border-color:#c0392b}\n  [data-kfg-root] .kfg_field .err{display:none;font-size:11.5px;color:#c0392b;margin-top:var(--s-3xs)}\n  [data-kfg-root] .kfg_field.is-error .err{display:block}\n  [data-kfg-root] .kfg_quick{margin-top:var(--s-s)}\n  [data-kfg-root] .kfg_quick p{font-size:12px;color:#5F5F5F;margin-bottom:var(--s-2xs)}\n  [data-kfg-root] .kfg_quick-chips{display:flex;flex-wrap:wrap;gap:6px}\n  [data-kfg-root] .kfg_quick-chip{font-weight:300;font-size:12px;letter-spacing:.03em;padding:7px 10px;border:1px solid var(--hair);\n    border-radius:var(--r);background:var(--alt);cursor:pointer;transition:all .15s}\n  [data-kfg-root] .kfg_quick-chip:hover{border-color:var(--ink)}\n  [data-kfg-root] .kfg_quick-chip.is-active{background:var(--ink);color:#fff;border-color:var(--ink);font-weight:400}\n  [data-kfg-root] .kfg_measure{margin-top:var(--s-s);font-size:13px}\n  [data-kfg-root] .kfg_measure summary{cursor:pointer;color:#555;font-weight:500;list-style:none;display:inline-flex;align-items:center;gap:6px}\n  [data-kfg-root] .kfg_share button{display:inline-flex;align-items:center;justify-content:center;gap:7px}\n  [data-kfg-root] .kfg_measure p{margin-top:var(--s-2xs);color:#5F5F5F;font-size:12.5px;line-height:1.55;background:var(--alt);\n    border-radius:var(--r);padding:var(--s-xs)}\n\n  [data-kfg-root] .kfg_radius{display:flex;align-items:flex-end;gap:var(--s-xs);flex-wrap:wrap}\n  [data-kfg-root] .kfg_radius .kfg_field{width:120px}\n  [data-kfg-root] .kfg_radius .kfg_field input{padding:9px var(--s-xs);font-size:14px;min-height:40px}\n  [data-kfg-root] .kfg_rule-note{margin-top:var(--s-2xs);font-size:12px;color:#9a6b12;background:var(--warn-bg);border-radius:var(--r);padding:var(--s-xs)}\n\n  [data-kfg-root] .kfg_edge-note{margin-top:var(--s-s);font-size:12.5px;color:#5F5F5F;background:var(--alt);border-radius:var(--r);\n    padding:var(--s-xs);display:flex;gap:var(--s-2xs);align-items:flex-start}\n  [data-kfg-root] .kfg_trust span .ic-svg{width:13px;height:13px}\n  [data-kfg-root] .kfg_mpx-note{margin-top:var(--s-2xs);font-size:12px;color:#9a6b12;background:var(--warn-bg);border-radius:var(--r);padding:var(--s-xs);display:none}\n\n  [data-kfg-root] .kfg_check{display:flex;align-items:flex-start;gap:var(--s-xs);padding:var(--s-xs);border:1.5px solid var(--hair);\n    border-radius:var(--r);cursor:pointer;transition:border-color .15s}\n  [data-kfg-root] .kfg_check + .kfg_check{margin-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_check.is-active{border-color:var(--ink)}\n  [data-kfg-root] .kfg_check input{margin-top:3px;accent-color:var(--ink);width:16px;height:16px}\n  [data-kfg-root] .kfg_check b{font-size:13.5px;font-weight:500;display:block}\n  [data-kfg-root] .kfg_check small{font-size:12px;color:#5F5F5F}\n  [data-kfg-root] .kfg_check .pr{margin-left:auto;font-weight:300;font-size:12px;color:#555;white-space:nowrap;letter-spacing:.02em}\n  [data-kfg-root] .kfg_custom{display:none;margin-top:var(--s-2xs);border:1.5px dashed var(--hair);border-radius:var(--r);padding:var(--s-s)}\n  [data-kfg-root] .kfg_custom.is-open{display:block}\n  [data-kfg-root] .kfg_custom textarea{width:100%;border:1.5px solid var(--hair);border-radius:var(--r);padding:var(--s-xs);\n    font-size:13px;min-height:64px;resize:vertical;outline:none}\n  [data-kfg-root] .kfg_custom textarea:focus{border-color:var(--ink)}\n  [data-kfg-root] .kfg_upload{margin-top:var(--s-2xs);border:1.5px dashed #c9c6bd;border-radius:var(--r);background:var(--alt);\n    padding:var(--s-s);text-align:center;font-size:12.5px;color:#5F5F5F;cursor:pointer;transition:border-color .15s}\n  [data-kfg-root] .kfg_upload:hover{border-color:var(--ink)}\n  [data-kfg-root] .kfg_upload b{display:block;font-weight:500;color:var(--ink);margin-bottom:2px}\n  [data-kfg-root] .kfg_custom-hint{font-size:11.5px;color:#9a6b12;margin-top:var(--s-2xs)}\n\n  [data-kfg-root] .kfg_preset{display:flex;align-items:center;gap:var(--s-xs);padding:var(--s-xs);border:1.5px solid var(--hair);\n    border-radius:var(--r);transition:border-color .15s}\n  [data-kfg-root] .kfg_preset + .kfg_preset{margin-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_preset.is-active{border-color:var(--ink)}\n  [data-kfg-root] .kfg_preset b{font-size:13.5px;font-weight:500;display:block}\n  [data-kfg-root] .kfg_preset small{font-size:12px;color:#5F5F5F}\n  [data-kfg-root] .kfg_preset .pr{margin-left:auto;font-weight:300;font-size:12px;color:#555;white-space:nowrap;letter-spacing:.02em}\n  [data-kfg-root] .kfg_stepper{display:inline-flex;align-items:stretch;gap:0;\n    border:1.5px solid var(--hair);border-radius:var(--r);overflow:hidden}\n  [data-kfg-root] .kfg_stepper button{border:0;background:#fff;width:36px;height:36px;font-size:17px;\n    cursor:pointer;color:var(--ink);display:grid;place-items:center;line-height:1;padding:0}\n  [data-kfg-root] .kfg_stepper button:hover{background:var(--alt)}\n  [data-kfg-root] .kfg_stepper [data-count]{min-width:28px;text-align:center;font-weight:500;font-size:14px;\n    font-variant-numeric:tabular-nums;display:grid;place-items:center;line-height:1}\n  [data-kfg-root] .kfg_cutlist{display:flex;flex-wrap:wrap;gap:var(--s-2xs);margin-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_cutitem{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--hair);border-radius:var(--r);\n    padding:6px 10px;font-size:12px;background:var(--alt)}\n  [data-kfg-root] .kfg_cutitem button{border:0;background:none;cursor:pointer;font-size:14px;color:#999;padding:0 2px;line-height:1}\n  [data-kfg-root] .kfg_cutitem button:hover{color:#c0392b}\n  [data-kfg-root] #stage.is-drawing{cursor:crosshair;touch-action:none}\n  [data-kfg-root] #stage.is-dragging{touch-action:none}\n  [data-kfg-root] .kfg_muster{background:var(--card);border-radius:var(--r);padding:var(--s-s);display:flex;gap:var(--s-xs);align-items:center}\n  [data-kfg-root] .kfg_muster .ic .ic-svg{width:22px;height:22px}\n  [data-kfg-root] .kfg_muster b{font-size:13.5px;font-weight:500;display:block}\n  [data-kfg-root] .kfg_muster small{font-size:12px;color:#5F5F5F}\n  [data-kfg-root] .kfg_muster button{margin-left:auto;border:1px solid var(--ink);background:#fff;border-radius:var(--r);\n    padding:9px 14px;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;min-height:40px}\n\n  /* Summary */\n  [data-kfg-root] .kfg_summary{border:1px solid var(--hair);border-radius:var(--r);padding:var(--s-s);margin-top:var(--s-s);background:#fff}\n  [data-kfg-root] .kfg_sum-row{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--s-s)}\n  [data-kfg-root] .kfg_sum-price small{display:block;font-size:12px;color:#5F5F5F}\n  [data-kfg-root] .kfg_sum-price .val{font-size:30px;font-weight:600;letter-spacing:-.01em;line-height:1.1}\n  [data-kfg-root] .kfg_sum-price .vat{font-size:11px;color:#999}\n  [data-kfg-root] .kfg_delivery{font-size:12.5px;text-align:right}\n  [data-kfg-root] .kfg_delivery b{display:block;font-weight:500}\n  [data-kfg-root] .kfg_delivery span{color:#5F5F5F}\n  [data-kfg-root] .kfg_breakdown{margin-top:var(--s-xs);font-size:12.5px}\n  [data-kfg-root] .kfg_breakdown summary{cursor:pointer;color:#555;list-style:none;display:inline-flex;gap:6px;align-items:center}\n  [data-kfg-root] .kfg_breakdown summary::after{margin-left:2px}\n  [data-kfg-root] .kfg_breakdown table{width:100%;margin-top:var(--s-2xs);border-collapse:collapse}\n  [data-kfg-root] .kfg_breakdown td{padding:var(--s-3xs) 0;color:#5F5F5F;font-size:12px}\n  [data-kfg-root] .kfg_breakdown td:last-child{text-align:right;font-weight:300;letter-spacing:.02em}\n  [data-kfg-root] .kfg_breakdown tr.total td{border-top:1px solid var(--hair);padding-top:var(--s-2xs);color:var(--ink);font-weight:500}\n  [data-kfg-root] .kfg_cta{margin-top:var(--s-s);width:100%;border:0;border-radius:var(--r);background:var(--ink);color:#fff;\n    font-size:15px;font-weight:500;padding:var(--s-s);cursor:pointer;min-height:52px;transition:background .15s}\n  [data-kfg-root] .kfg_cta:hover{background:var(--deep)}\n  [data-kfg-root] .kfg_cta.is-sonder{background:#fff;color:var(--ink);border:1.5px solid var(--ink)}\n  [data-kfg-root] .kfg_bar .kfg_cta.is-sonder{border-width:1.5px}\n  [data-kfg-root] .kfg_trust{display:flex;justify-content:center;gap:var(--s-s);margin-top:var(--s-xs);font-size:11px;color:#888;flex-wrap:wrap}\n  [data-kfg-root] .kfg_trust span{display:inline-flex;align-items:center;gap:5px}\n  [data-kfg-root] .kfg_share{display:flex;gap:var(--s-2xs);margin-top:var(--s-s)}\n  [data-kfg-root] .kfg_share button{flex:1;border:1px solid var(--hair);background:var(--alt);border-radius:var(--r);\n    padding:10px;font-size:12.5px;cursor:pointer;min-height:44px}\n  [data-kfg-root] .kfg_share button:hover{border-color:var(--ink)}\n\n  /* \u2550\u2550 MOBILE \u2550\u2550 */\n  /* Sticky Mini-Vorschau: erscheint, sobald die gro\u00dfe Vorschau aus dem Bild scrollt */\n  [data-kfg-root] .kfg_mini{position:fixed;left:0;right:0;z-index:45;background:#fff;border-bottom:1px solid var(--hair);\n    display:flex;align-items:center;gap:var(--s-xs);padding:var(--s-2xs) var(--s-s);\n    box-shadow:0 6px 18px rgba(0,0,0,.06);transform:translateY(-110%);transition:transform .22s ease}\n  [data-kfg-root] .kfg_mini.is-on{transform:translateY(0)}\n  [data-kfg-root] .kfg_mini-plate{flex:0 0 auto;height:34px;max-width:64px;border-radius:4px;background-size:cover;background-position:center;\n    border:1px solid #00000018}\n  [data-kfg-root] .kfg_mini-plate.is-round{border-radius:50%}\n  [data-kfg-root] .kfg_mini-txt{min-width:0;line-height:1.25}\n  [data-kfg-root] .kfg_mini-txt b{display:block;font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  [data-kfg-root] .kfg_mini-txt span{display:block;font-size:11px;color:#5F5F5F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  [data-kfg-root] .kfg_mini button{margin-left:auto;flex:0 0 auto;border:1px solid var(--hair);background:var(--alt);border-radius:var(--r);\n    padding:7px 12px;font-size:12px;cursor:pointer;min-height:36px}\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_mini{padding-inline:clamp(16px,4vw,80px)}\n    [data-kfg-root] .kfg_mini-plate{height:42px;max-width:84px}\n  }\n\n  @media(max-width:979px){\n    [data-kfg-root] .kfg_hero{padding-top:var(--s-m)}\n    [data-kfg-root] .kfg_hero h1{font-size:26px}\n    [data-kfg-root] .kfg_hero p{font-size:14px}\n    [data-kfg-root] .kfg_layout{padding-top:var(--s-2xs);gap:var(--s-s)}\n    [data-kfg-root] .kfg_preview{padding:var(--s-xs)}\n    [data-kfg-root] .kfg_preview-stage, [data-kfg-root] #stage3d{aspect-ratio:10/7}\n    [data-kfg-root] .kfg_preview{margin-inline:calc(clamp(16px,4vw,80px) * -1);border-radius:0}\n    [data-kfg-root] .kfg_preview-hint{display:none}\n    /* Detailansicht einklappbar, spart ~300px vor dem ersten Schritt */\n    [data-kfg-root] .kfg_detail{display:block;padding:0;background:transparent}\n    [data-kfg-root] .kfg_detail summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:6px;\n      font-size:12.5px;color:#555;font-weight:500;background:#fff;border-radius:var(--r);padding:10px var(--s-xs);min-height:44px}\n    [data-kfg-root] .kfg_detail summary::after{margin-left:auto}\n    [data-kfg-root] .kfg_detail-inner{display:flex;flex-direction:column;gap:var(--s-2xs);background:#fff;border-radius:var(--r);\n      padding:var(--s-xs);margin-top:var(--s-3xs)}\n    [data-kfg-root] .kfg_detail img{width:100%;max-width:none;min-width:0}\n    [data-kfg-root] .kfg_detail-badge{top:var(--s-m);left:var(--s-m)}\n    [data-kfg-root] .kfg_detail-label{text-align:left}\n    /* Preset-Zeilen: Stepper unter den Text statt gequetscht daneben */\n    [data-kfg-root] .kfg_preset{flex-wrap:wrap}\n    [data-kfg-root] .kfg_preset .pr{margin-left:0;order:3}\n    [data-kfg-root] .kfg_preset .kfg_stepper{margin-left:auto;order:4}\n    [data-kfg-root] .kfg_muster{flex-wrap:wrap}\n    [data-kfg-root] .kfg_muster button{margin-left:0;width:100%}\n    [data-kfg-root] .kfg_modal-box{padding:var(--s-s);border-radius:12px;max-height:94vh}\n    [data-kfg-root] .kfg_step{padding:var(--s-s) var(--s-xs)}\n  }\n  /* Die Leiste ist grundsaetzlich aus und kommt erst, wenn der Konfigurator\n     nach oben aus dem Bild gescrollt ist — auch mobil (Wunsch Sascha\n     29.07.). Solange man konfiguriert, steht der Preis in der Karte. */\n  /* Schwebende Karte statt randloser Platte: 8 px Ecken, umlaufender\n     Haarstrich, und die Hoehe folgt der Beschriftung statt fest zu sein\n     (Wunsch Sascha 29.07.). */\n  [data-kfg-root] .kfg_bar{position:fixed;bottom:0;left:0;right:0;background:#fff;\n    border:1px solid var(--hair);border-radius:var(--r);\n    margin:0 var(--s-xs) calc(var(--s-xs) + env(safe-area-inset-bottom));\n    display:none;transform:translateY(140%);transition:transform .22s ease;\n    padding:var(--s-xs) var(--s-xs) var(--s-xs) var(--s-s);z-index:60;\n    align-items:center;gap:var(--s-xs);box-shadow:0 10px 30px -12px rgba(0,0,0,.22)}\n  [data-kfg-root] .kfg_bar.is-on{display:flex;transform:translateY(0)}\n  /* Was gekauft wird, steht jetzt in der Leiste: kleine Platte, Material\n     und Dekor, darunter Form, Mass und Staerke (Befund Sascha 29.07.). */\n  [data-kfg-root] .kfg_bar-thumb{flex:0 0 auto;width:48px;height:36px;border-radius:4px;\n    background:var(--card);background-size:cover;background-position:center;border:1px solid #00000018}\n  [data-kfg-root] .kfg_bar-thumb.is-round{border-radius:50%;width:36px}\n  [data-kfg-root] .kfg_bar-what{min-width:0;line-height:1.25;flex:1 1 auto}\n  [data-kfg-root] .kfg_bar-what b{display:block;font-size:12.5px;font-weight:500;\n    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  [data-kfg-root] .kfg_bar-what small{display:block;font-size:11px;color:#5F5F5F;\n    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  [data-kfg-root] .kfg_bar .p{line-height:1.15;flex:0 0 auto;text-align:right}\n  [data-kfg-root] .kfg_bar .p .val{font-size:19px;font-weight:600;display:block}\n  [data-kfg-root] .kfg_bar .p small{font-size:10.5px;color:#5F5F5F;white-space:nowrap}\n  /* Gleiche Optik wie der Knopf in der Preiskarte (Wunsch Sascha 29.07.):\n     Rundung, Schriftgroesse und Hoehe unveraendert, nur die Breite ist\n     begrenzt statt ueber die halbe Seite zu laufen. */\n  [data-kfg-root] .kfg_bar .kfg_cta{margin:0;flex:0 0 auto;padding:14px var(--s-l);\n    min-height:50px;font-size:15px;width:auto;min-width:230px;border-radius:var(--r)}\n  /* Schmale Schirme: Bezeichnung und Miniatur weichen, damit Preis und\n     Knopf nicht aus der Leiste laufen (Befund Sascha 29.07.). */\n  @media(max-width:560px){\n    [data-kfg-root] .kfg_bar{gap:var(--s-2xs);padding-inline:var(--s-xs)}\n    [data-kfg-root] .kfg_bar-what{display:none}\n    [data-kfg-root] .kfg_bar-thumb{display:none}\n    [data-kfg-root] .kfg_bar .p{margin-right:auto;text-align:left}\n    [data-kfg-root] .kfg_bar .kfg_cta{flex:1 1 auto;min-width:0;max-width:62%;\n      padding-inline:var(--s-xs);font-size:14px;white-space:nowrap;\n      overflow:hidden;text-overflow:ellipsis}\n  }\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_bar.is-on{max-width:1180px;margin-inline:auto;\n      padding:var(--s-xs) var(--s-xs) var(--s-xs) var(--s-m)}\n    [data-kfg-root] .kfg_bar.is-on .p{margin-left:auto}\n    [data-kfg-root] .kfg_bar.is-on .p .val{font-size:21px}\n    [data-kfg-root] .kfg_bar.is-on .kfg_cta{flex:0 0 auto;min-width:260px}\n    [data-kfg-root] .kfg_bar.is-on .kfg_bar-thumb{width:62px;height:47px}\n    [data-kfg-root] .kfg_bar.is-on .kfg_bar-what b{font-size:14px}\n    [data-kfg-root] .kfg_bar.is-on .kfg_bar-what small{font-size:12px}\n  }\n\n  [data-kfg-root] .kfg_modal{position:fixed;inset:0;background:rgba(10,10,10,.45);z-index:100;display:flex;align-items:center;justify-content:center;padding:var(--s-s)}\n  [data-kfg-root] .kfg_modal[hidden]{display:none}\n  [data-kfg-root] .kfg_modal-box{background:#fff;border-radius:16px;max-width:960px;width:100%;max-height:90vh;overflow:auto;padding:var(--s-m)}\n  [data-kfg-root] .kfg_modal-head{display:flex;align-items:center;gap:var(--s-xs);margin-bottom:var(--s-s)}\n  [data-kfg-root] .kfg_modal-head b{font-size:18px;font-weight:600}\n  [data-kfg-root] .kfg_modal-tag{font-size:11px;color:#9a6b12;background:var(--warn-bg);border-radius:var(--r);padding:3px 8px}\n  [data-kfg-root] .kfg_modal-head button{margin-left:auto;border:0;background:var(--alt);border-radius:var(--r);width:36px;height:36px;font-size:20px;cursor:pointer}\n  [data-kfg-root] .kfg_modal-grid{display:grid;grid-template-columns:1fr;gap:var(--s-m)}\n  @media(min-width:760px){[data-kfg-root] .kfg_modal-grid{grid-template-columns:55fr 45fr}}\n  [data-kfg-root] .kfg_modal-draw{background:var(--card);border-radius:var(--r);padding:var(--s-xs)}\n  [data-kfg-root] .kfg_modal-draw svg{width:100%;display:block}\n  [data-kfg-root] .kfg_modal-draw p{font-size:11px;color:#8a877f;text-align:center;padding-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_modal-data table{width:100%;border-collapse:collapse;font-size:13px}\n  [data-kfg-root] .kfg_modal-data td{padding:6px 0;border-bottom:1px solid var(--hair);vertical-align:top}\n  [data-kfg-root] .kfg_modal-data td:first-child{color:#5F5F5F;width:38%;padding-right:var(--s-xs)}\n  [data-kfg-root] .kfg_modal-data .props{margin-top:var(--s-s);background:var(--alt);border-radius:var(--r);padding:var(--s-xs);\n    font-size:11px;color:#555;font-weight:300;letter-spacing:.02em;line-height:1.7;word-break:break-all}\n  [data-kfg-root] .kfg_modal-data .props b{display:block;font-weight:500;color:var(--ink);font-size:11.5px;margin-bottom:4px;letter-spacing:0}\n  [data-kfg-root] .toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%) translateY(20px);background:var(--deep);color:#fff;\n    padding:10px 18px;border-radius:var(--r);font-size:13px;opacity:0;pointer-events:none;transition:all .25s;z-index:70}\n  [data-kfg-root] .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}\n\n  /* \u2500\u2500 Isolationsschicht: Webflow-Site-CSS darf nicht in den Konfigurator bluten,\n        und der Konfigurator faerbt/resettet nichts ausserhalb seines Containers.\n        :where() hat Spezifitaet 0 \u2192 eigene Regeln gewinnen immer. \u2500\u2500 */\n  [data-kfg-root]{\n    --ink:#1E1E1E; --deep:#0A0A0A; --card:#F2F0EB; --alt:#FAFAFA; --hair:#E5E5E5;\n    --ok:#1c7a3d; --ok-bg:#e8f4ec; --warn:#9a6b12; --warn-bg:#faf3e2;\n    --s-3xs:4px; --s-2xs:8px; --s-xs:12px; --s-s:16px; --s-m:24px; --s-l:32px; --s-xl:48px; --s-2xl:64px;\n    --r:8px;\n    display:block; box-sizing:border-box;\n    font-family:'Onest','DM Sans',sans-serif; font-size:15px; font-weight:400;\n    line-height:1.45; color:#1E1E1E; background:#fff; text-align:left;\n    letter-spacing:normal; text-transform:none; -webkit-font-smoothing:antialiased;\n  }\n  [data-kfg-root] :where(*, *::before, *::after){\n    box-sizing:border-box; margin:0; padding:0;\n    font-family:inherit; line-height:inherit; color:inherit;\n    letter-spacing:normal; text-transform:none;\n  }\n  /* text-align NICHT pauschal auf inherit setzen \u2014 das nahm Buttons die vom\n     Browser vorgegebene Zentrierung, wodurch Minus und Plus im Mengenfeld\n     links klebten (Befund Sascha, 27.07.). */\n  [data-kfg-root] :where(button){text-align:center}\n  [data-kfg-root] :where(b, strong){font-weight:600}\n  [data-kfg-root] :where(small){font-size:inherit}\n  [data-kfg-root] :where(button){background:none;border:none;cursor:pointer;font:inherit}\n  [data-kfg-root] :where(img, svg){max-width:100%}\n  [data-kfg-root] :where(p, span, div, label, li, td, th, summary){font-weight:inherit}\n\n  /* Ueberschriften grundsaetzlich schwarz (Sascha 26.07.) */\n  [data-kfg-root] .kfg_step-title,\n  [data-kfg-root] .kfg_step-num,\n  [data-kfg-root] .kfg_sublabel,\n  [data-kfg-root] .kfg_mat b,\n  [data-kfg-root] .kfg_preset b,\n  [data-kfg-root] .kfg_check b,\n  [data-kfg-root] .kfg_muster b,\n  [data-kfg-root] .kfg_modal-head b,\n  [data-kfg-root] .kfg_detail-label b,\n  [data-kfg-root] .kfg_upload b,\n  [data-kfg-root] h1, [data-kfg-root] h2, [data-kfg-root] h3, [data-kfg-root] h4,\n  [data-kfg-root] summary{color:#1E1E1E}\n\n  /* \u2500\u2500 Schritt 05: EIN Raster fuer alle Zeilen \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n     Spalten: [Checkbox 18px] [Text 1fr] [Preis auto] [Stepper 96px]\n     Preset-Zeilen lassen Spalte 1 leer \u2192 Textkante identisch zu den\n     Checkbox-Zeilen. Checkbox-Zeilen lassen Spalte 4 leer \u2192 Preise stehen\n     bei allen Zeilen in derselben Spalte. min-height macht alle gleich hoch. */\n  [data-kfg-root] .kfg_panel{container-type:inline-size;container-name:kfgpanel}\n  [data-kfg-root] .kfg_check,\n  [data-kfg-root] .kfg_preset{\n    display:grid;\n    grid-template-columns:18px minmax(0,1fr) auto 96px;\n    align-items:center;\n    column-gap:var(--s-xs);\n    row-gap:0;\n    min-height:0;\n    padding:var(--s-xs) var(--s-s);\n    border:1.5px solid var(--hair);\n    border-radius:var(--r);\n  }\n  /* gleiche Abstaende zwischen ALLEN Zeilentypen */\n  [data-kfg-root] .kfg_check + .kfg_check,\n  [data-kfg-root] .kfg_check + .kfg_preset,\n  [data-kfg-root] .kfg_preset + .kfg_check,\n  [data-kfg-root] .kfg_preset + .kfg_preset{margin-top:var(--s-2xs)}\n\n  [data-kfg-root] .kfg_check input{grid-column:1;margin:0;accent-color:var(--ink);width:16px;height:16px}\n  [data-kfg-root] .kfg_check > span:not(.pr),\n  [data-kfg-root] .kfg_preset > span:not(.pr):not(.kfg_stepper){\n    grid-column:2;min-width:0;display:block;\n  }\n  [data-kfg-root] .kfg_check .pr,\n  [data-kfg-root] .kfg_preset .pr{\n    grid-column:3;justify-self:end;margin:0;white-space:nowrap;text-align:right;\n    font-size:12px;font-weight:400;color:#555;letter-spacing:.02em;\n  }\n  [data-kfg-root] .kfg_preset .kfg_stepper{grid-column:4;justify-self:end;margin:0}\n\n  /* Titel einzeilig, Unterzeile auf 2 Zeilen begrenzt und reserviert\n     \u2192 jede Zeile in Schritt 05 ist exakt gleich hoch, unabhaengig von der Textlaenge */\n  /* Titel und Unterzeile je eine Zeile, Textblock mit fester Hoehe:\n     dadurch sind ALLE Zeilen in Schritt 05 exakt gleich hoch und der Preis\n     haengt nicht mehr als eigene Zeile darunter. */\n  [data-kfg-root] .kfg_check b,\n  [data-kfg-root] .kfg_preset b{\n    display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;\n    font-size:13.5px;font-weight:500;line-height:1.35;color:#1E1E1E;\n  }\n  [data-kfg-root] .kfg_check > span:not(.pr),\n  [data-kfg-root] .kfg_preset > span:not(.pr):not(.kfg_stepper){height:53px}\n  [data-kfg-root] .kfg_check small,\n  [data-kfg-root] .kfg_preset small{\n    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;\n    font-size:12px;line-height:1.35;color:#5F5F5F;margin-top:2px;\n  }\n\n  [data-kfg-root] .kfg_stepper button{width:34px;height:34px}\n\n  /* Schmale Panels: Preis + Stepper ruecken unter den Text, Raster bleibt sauber */\n  @media(max-width:520px){\n    [data-kfg-root] .kfg_check,\n    [data-kfg-root] .kfg_preset{\n      grid-template-columns:18px minmax(0,1fr) auto;\n      row-gap:var(--s-2xs);\n    }\n    [data-kfg-root] .kfg_check > span:not(.pr),\n    [data-kfg-root] .kfg_preset > span:not(.pr):not(.kfg_stepper){grid-column:2/-1}\n    [data-kfg-root] .kfg_check .pr,\n    [data-kfg-root] .kfg_preset .pr{grid-column:2;justify-self:start;text-align:left}\n    [data-kfg-root] .kfg_preset .kfg_stepper{grid-column:3;justify-self:end}\n    /* Zeilen ohne Stepper reservieren dieselbe Hoehe wie die mit Stepper */\n    [data-kfg-root] .kfg_preset .pr{display:flex;align-items:center;min-height:36px}\n    [data-kfg-root] .kfg_preset .kfg_stepper{min-height:36px}\n    /* Checkbox-Zeilen haben keinen Stepper: Preis bleibt in der ersten Zeile */\n    [data-kfg-root] .kfg_check{grid-template-columns:18px minmax(0,1fr) auto}\n    [data-kfg-root] .kfg_check > span:not(.pr){grid-column:2}\n    [data-kfg-root] .kfg_check .pr{grid-column:3;justify-self:end;text-align:right;min-height:36px;display:flex;align-items:center}\n    [data-kfg-root] .kfg_check b, [data-kfg-root] .kfg_preset b,\n    [data-kfg-root] .kfg_check small, [data-kfg-root] .kfg_preset small{-webkit-line-clamp:2}\n    [data-kfg-root] .kfg_check > span:not(.pr),\n    [data-kfg-root] .kfg_preset > span:not(.pr):not(.kfg_stepper){height:auto;min-height:53px}\n    /* im gestapelten Layout darf der Titel umbrechen \u2014 nichts wird abgeschnitten */\n    [data-kfg-root] .kfg_check b,\n    [data-kfg-root] .kfg_preset b{white-space:normal;overflow:visible}\n  }\n  @container kfgpanel (max-width:420px){\n    [data-kfg-root] .kfg_check,\n    [data-kfg-root] .kfg_preset{\n      grid-template-columns:18px minmax(0,1fr) auto;\n      row-gap:var(--s-2xs);\n    }\n    [data-kfg-root] .kfg_check > span:not(.pr),\n    [data-kfg-root] .kfg_preset > span:not(.pr):not(.kfg_stepper){grid-column:2/-1}\n    [data-kfg-root] .kfg_check .pr,\n    [data-kfg-root] .kfg_preset .pr{grid-column:2;justify-self:start;text-align:left}\n    [data-kfg-root] .kfg_preset .kfg_stepper{grid-column:3;justify-self:end}\n    /* Zeilen ohne Stepper reservieren dieselbe Hoehe wie die mit Stepper */\n    [data-kfg-root] .kfg_check .pr,\n    [data-kfg-root] .kfg_preset .pr{display:flex;align-items:center;min-height:36px}\n    [data-kfg-root] .kfg_preset .kfg_stepper{min-height:36px}\n    /* im gestapelten Layout darf der Titel umbrechen \u2014 nichts wird abgeschnitten */\n    [data-kfg-root] .kfg_check b,\n    [data-kfg-root] .kfg_preset b{white-space:normal;overflow:visible}\n  }\n\n\n  /* Musterbox-Karte auf dieselbe Textkante */\n  [data-kfg-root] .kfg_muster{align-items:center;gap:var(--s-xs);padding:var(--s-s)}\n  [data-kfg-root] .kfg_muster small{display:block;font-size:12px;line-height:1.35;color:#5F5F5F;margin-top:2px}\n\n  /* Dekor-Kacheln: Beschriftung darf nicht abgeschnitten werden */\n  /* Dekorname darf zwei Zeilen brauchen \u2014 \"Eiche Kamienny\" wurde vorher nach\n     dem ersten Wort abgeschnitten. Feste Hoehe haelt alle Kacheln gleich gross. */\n  [data-kfg-root] .kfg_dekor{overflow:visible}\n  [data-kfg-root] .kfg_dekor > span:last-child{\n    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;\n    font-size:10.5px; line-height:1.25; color:#1E1E1E; text-align:center;\n    white-space:normal; word-break:normal; hyphens:none;\n    height:30px; padding-top:var(--s-3xs);\n  }\n\n  /* \u2500\u2500 Radius je Ecke: verknuepfter Wert oben, darunter die vier Ecken\n        in derselben Anordnung wie auf der Platte (Draufsicht). \u2500\u2500 */\n  [data-kfg-root] .kfg_radgrid{margin-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_radall{\n    display:flex;align-items:center;gap:var(--s-2xs);\n    border:1.5px solid var(--hair);border-radius:var(--r);\n    padding:8px var(--s-xs);margin-bottom:var(--s-2xs);background:var(--alt);\n  }\n  [data-kfg-root] .kfg_radall.is-linked{border-color:var(--ink)}\n  [data-kfg-root] .kfg_radall em{margin-left:auto;font-style:normal;font-size:11px;color:#5F5F5F}\n  [data-kfg-root] .kfg_radquad{\n    display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s-2xs);max-width:340px;\n  }\n  [data-kfg-root] .kfg_radcell{\n    display:flex;align-items:center;gap:6px;\n    border:1.5px solid var(--hair);border-radius:var(--r);padding:6px var(--s-2xs);\n    background:#fff;cursor:text;\n  }\n  [data-kfg-root] .kfg_radcell.is-on{border-color:var(--ink)}\n  [data-kfg-root] .kfg_radall input,\n  [data-kfg-root] .kfg_radcell input{\n    width:100%;min-width:0;border:0;outline:0;background:transparent;\n    font-size:14px;font-weight:500;color:#1E1E1E;padding:2px 0;-moz-appearance:textfield;\n  }\n  [data-kfg-root] .kfg_radall input::-webkit-outer-spin-button,\n  [data-kfg-root] .kfg_radall input::-webkit-inner-spin-button,\n  [data-kfg-root] .kfg_radcell input::-webkit-outer-spin-button,\n  [data-kfg-root] .kfg_radcell input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}\n  [data-kfg-root] .kfg_radall .u,\n  [data-kfg-root] .kfg_radcell .u{font-size:11px;color:#999;flex:0 0 auto}\n  [data-kfg-root] .kfg_cornerhit:hover{fill:#1E1E1E12}\n\n  /* \u2500\u2500 Gruppen in Schritt 05 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n  [data-kfg-root] .kfg_grouplabel{\n    font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8a8a;\n    font-weight:500;margin:var(--s-m) 0 var(--s-2xs);\n  }\n  [data-kfg-root] .kfg_grouplabel:first-of-type{margin-top:var(--s-s)}\n\n  /* \u2500\u2500 Z\u00e4hler am Schritt-Kopf \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n  [data-kfg-root] .kfg_step-count{\n    margin-left:auto;font-size:11px;font-weight:500;letter-spacing:.02em;\n    background:var(--ink);color:#fff;border-radius:var(--r);padding:3px 9px;\n    white-space:nowrap;max-width:52%;overflow:hidden;text-overflow:ellipsis;\n  }\n  [data-kfg-root] .kfg_step-count.is-empty{background:var(--card);color:#8a8a8a}\n  [data-kfg-root] .kfg_step-head{display:flex;align-items:center;gap:var(--s-2xs)}\n\n  /* \u2500\u2500 Konfigurations-Zusammenfassung \u00fcber dem CTA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n  [data-kfg-root] .kfg_conf{\n    border:1px solid var(--hair);border-radius:var(--r);background:var(--alt);\n    padding:var(--s-xs);margin:var(--s-s) 0 var(--s-2xs);\n  }\n  [data-kfg-root] .kfg_conf > p{\n    font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8a8a;\n    font-weight:500;margin-bottom:var(--s-2xs);\n  }\n  [data-kfg-root] .kfg_conf-chips{display:flex;flex-wrap:wrap;gap:5px}\n  [data-kfg-root] .kfg_conf-chip{\n    font-size:12px;line-height:1.3;border:1px solid var(--hair);background:#fff;\n    border-radius:var(--r);padding:5px 9px;color:var(--ink);cursor:pointer;text-align:left;\n  }\n  [data-kfg-root] .kfg_conf-chip:hover{border-color:var(--ink)}\n  [data-kfg-root] .kfg_conf-chip.is-warn{background:var(--warn-bg);border-color:#e8dcc0;color:var(--warn)}\n  [data-kfg-root] .kfg_step.is-flash{box-shadow:0 0 0 2px var(--ink);transition:box-shadow .2s}\n\n  /* Auf flachen Fenstern die Draufsicht mitskalieren, damit die Platte beim\n     Arbeiten an Ecken und Massen komplett sichtbar bleibt. */\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_preview-stage,\n    [data-kfg-root] #stage3d{max-height:min(74vh,780px)}\n  }\n\n  /* Flache Fenster: Vorschau UND Preiskarte wandern GEMEINSAM mit. Reicht die\n     Hoehe nicht, faellt gestuft weg, was am ehesten entbehrlich ist, die\n     Warenkorbkarte bleibt dabei immer am Bild (Wunsch Sascha, 27.07.). */\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_stickycol.is-tight .kfg_trust,\n    [data-kfg-root] .kfg_stickycol.is-tight .kfg_share{display:none}\n    /* Das Vorschaubild behaelt IMMER seine Groesse (Wunsch Sascha): kein\n       Schrumpfen beim Scrollen. Fehlt Platz, wird die Karte zugeklappt —\n       die Zeile dafuer ist ja sichtbar. */\n    [data-kfg-root] .kfg_stickycol.is-tighter .kfg_conf,\n    [data-kfg-root] .kfg_stickycol.is-tighter .kfg_breakdown{display:none}\n    /* Notfallstufe: die Spalte scrollt intern. Bewusst OHNE overscroll-behavior:\n       contain - sonst bleibt das Mausrad am Ende der Karte haengen statt die\n       Seite weiterzuscrollen, und genau das fuehlt sich hakelig an. */\n    [data-kfg-root] .kfg_stickycol.is-scroll{overflow-y:auto;\n      max-height:calc(100vh - var(--kfg-top,96px) - 16px);scrollbar-width:thin;padding-right:6px}\n  }\n\n  /* Mobil: Vorschaukarte bleibt beim Konfigurieren stehen (ersetzt die Mini-Leiste).\n     Die Preiskarte sitzt auf Mobil ohnehin am Ende, Preis und CTA liegen unten\n     in der festen Leiste \u2014 die bleibt bewusst erhalten. */\n  @media(max-width:979px){\n    [data-kfg-root] .kfg_stickycol{position:sticky;top:var(--kfg-top,56px);z-index:3;\n      background:#fff;padding-bottom:var(--s-2xs)}\n    [data-kfg-root] .kfg_preview{box-shadow:0 6px 16px -12px #00000040}\n    /* Badge darf den 2D/3D-Umschalter nicht ueberlappen */\n    [data-kfg-root] .kfg_preview-badge{max-width:58%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n  }\n";

/* ═══════════════════════ MARKUP ═══════════════════════ */
var KFG_MARKUP = "<div class=\"kfg_layout\">\n\n  <!-- \u2550\u2550 PREVIEW \u2550\u2550 -->\n  <div class=\"kfg_stickycol\" id=\"stickyCol\">\n    <div class=\"kfg_preview\">\n      <div class=\"kfg_preview-badge\" id=\"badge\"><span class=\"dot\"></span><span id=\"badgeText\">Ab Lager</span></div>\n      <div class=\"kfg_viewtoggle\">\n        <button id=\"btn2d\" class=\"is-active\">2D</button>\n        <button id=\"btn3d\">3D</button>\n      </div>\n      <svg class=\"kfg_preview-stage\" id=\"stage\" viewBox=\"0 0 600 444\" role=\"img\" aria-label=\"Vorschau der konfigurierten Tischplatte\"></svg>\n      <canvas id=\"stage3d\"></canvas>\n      <details class=\"kfg_detail\" id=\"detailCard\" open>\n        <summary>Kante &amp; Material im Detail</summary>\n        <div class=\"kfg_detail-inner\">\n          <span class=\"kfg_detail-badge\">Vorschaubild</span><img id=\"detailImg\" alt=\"Detailansicht der Kante \u2014 Vorschaubild\" src=\"\">\n          <div class=\"kfg_detail-label\" id=\"detailLabel\"></div>\n        </div>\n      </details>\n      <div class=\"kfg_preview-hint\" id=\"previewHint\">Draufsicht, ma\u00dfstabsgetreu \u00b7 Kanten und Ecken anklickbar</div>\n    </div>\n\n    <div class=\"kfg_summary\">\n      <div class=\"kfg_sum-row\">\n        <div class=\"kfg_sum-price\">\n          <small id=\"priceLabel\">Dein Preis</small>\n          <span class=\"val\" id=\"price\">\u2014</span>\n          <span class=\"vat\">inkl. MwSt., kostenloser Versand bis 120 cm</span>\n        </div>\n        <div class=\"kfg_delivery\">\n          <b id=\"delivDate\">\u2014</b>\n          <span id=\"delivSub\">\u2014</span>\n        </div>\n      </div>\n      <details class=\"kfg_breakdown\">\n        <summary>Preis-Aufschl\u00fcsselung</summary>\n        <table id=\"breakdown\"></table>\n      </details>\n      <div class=\"kfg_conf\" id=\"confBox\"><p>Deine Konfiguration</p><div class=\"kfg_conf-chips\" id=\"confChips\"></div></div>\n      <button class=\"kfg_cta\" id=\"cta\">In den Warenkorb</button>\n      <div class=\"kfg_trust\">\n        <span><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 21h18M5 21V10l5 3.5V10l5 3.5V4h4v17\"/></svg> Manufaktur seit 1897</span><span><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3.2\"/><path d=\"M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1\"/></svg> CNC-pr\u00e4zise Kanten</span><span><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M1.5 16V6h12v10h-12zM13.5 9h4.5l4 4v3h-3\"/><circle cx=\"6\" cy=\"18\" r=\"1.8\"/><circle cx=\"17\" cy=\"18\" r=\"1.8\"/></svg> Versand bis 120 cm gratis</span>\n      </div>\n      <div class=\"kfg_share\">\n        <button id=\"btnShare\"><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9.5 14.5l5-5M8.5 12l-2 2a3.5 3.5 0 105 5l2-2M15.5 12l2-2a3.5 3.5 0 10-5-5l-2 2\"/></svg> Konfiguration teilen</button>\n        <button id=\"btnMail\"><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"M3 7.5l9 6 9-6\"/></svg> Per E-Mail senden</button>\n      </div>\n    </div>\n  </div>\n\n  <!-- \u2550\u2550 PANEL \u2550\u2550 -->\n  <div class=\"kfg_panel\">\n\n    <!-- 01 Material & Dekor -->\n    <section class=\"kfg_step\" id=\"kfgStep1\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">01</span><span class=\"kfg_step-title\">Material &amp; Dekor</span><span class=\"kfg_step-count\" id=\"k1\"></span></div>\n      <div class=\"kfg_mat-grid\" id=\"matGrid\"></div>\n      <div id=\"mpxSurfaceBlock\" style=\"display:none\">\n        <p class=\"kfg_sublabel\">Oberfl\u00e4che</p>\n        <div class=\"kfg_chips\" id=\"mpxSurfaceChips\">\n          <button class=\"kfg_chip is-active\" data-sf=\"natur\">Birke natur <small>geschliffen</small></button>\n          <button class=\"kfg_chip\" data-sf=\"hpl\">HPL-Laminat <small>alle Dekore</small></button>\n          <button class=\"kfg_chip\" data-sf=\"lack\">Klarlack <small>Angebot</small></button>\n        </div>\n      </div>\n      <div class=\"kfg_dekor-grid\" id=\"dekorGrid\"></div>\n      <div id=\"absColorBlock\">\n        <p class=\"kfg_sublabel\">ABS-Kantenfarbe</p>\n        <div class=\"kfg_chips\" id=\"absChips\"></div>\n      </div>\n      <div class=\"kfg_muster\" style=\"margin-top:var(--s-s)\">\n        <span class=\"ic\"><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"4\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"13\" y=\"4\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"4\" y=\"13\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"13\" y=\"13\" width=\"7\" height=\"7\" rx=\"1.5\"/></svg></span>\n        <span><b>Unsicher beim Dekor?</b><small>Musterbox mit 4 Dekoren \u2014 4,90&nbsp;\u20ac, voll angerechnet beim Kauf</small></span>\n        <button type=\"button\" id=\"btnMuster\">Muster bestellen</button>\n      </div>\n      <p class=\"kfg_dekor-note\" id=\"dekorNote\">Original-Produktfotos aus dem Kessler-Archiv. Farbige ABS-Kanten sind f\u00fcr 18 und 25 mm verf\u00fcgbar.</p>\n    </section>\n\n    <!-- 02 Form -->\n    <section class=\"kfg_step\" id=\"kfgStep2\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">02</span><span class=\"kfg_step-title\">Form</span><span class=\"kfg_step-count\" id=\"k2\"></span></div>\n      <div class=\"kfg_chips\" id=\"formChips\">\n        <button class=\"kfg_chip is-active\" data-form=\"rect\">\u25ad Rechteck</button>\n        <button class=\"kfg_chip\" data-form=\"round\">\u25ef Rund</button>\n        <button class=\"kfg_chip\" data-form=\"lform\">\u2310 L-Form</button>\n        <button class=\"kfg_chip\" data-form=\"szwal\">\u2334 N\u00e4hmaschinen-Platte</button>\n      </div>\n      <div id=\"cornerBlock\">\n        <p class=\"kfg_sublabel\">Ecken abrunden</p>\n        <div class=\"kfg_radius\">\n          <div class=\"kfg_chips\" id=\"cornerChips\"></div>\n        </div>\n        <div id=\"cornerSelBlock\">\n          <p class=\"kfg_sublabel\">Radius je Ecke</p>\n          <div class=\"kfg_radgrid\" id=\"cornerSel\"></div>\n        </div>\n        <div class=\"kfg_rule-note\" id=\"cornerRule\" style=\"display:none\"></div>\n      </div>\n    </section>\n\n    <!-- 03 Ma\u00df -->\n    <section class=\"kfg_step\" id=\"kfgStep3\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">03</span><span class=\"kfg_step-title\">Ma\u00df</span><span class=\"kfg_step-count\" id=\"k3\"></span>\n        <span class=\"kfg_step-sub\" id=\"massHint\" hidden></span></div>\n      <div class=\"kfg_dims\" id=\"dimsRect\">\n        <div class=\"kfg_field\" id=\"fL\">\n          <label for=\"inL\">L\u00e4nge</label>\n          <div class=\"in\"><input id=\"inL\" type=\"number\" inputmode=\"numeric\" value=\"120\" min=\"30\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeL\"></span><span class=\"err\" id=\"errL\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fB\">\n          <label for=\"inB\">Breite</label>\n          <div class=\"in\"><input id=\"inB\" type=\"number\" inputmode=\"numeric\" value=\"60\" min=\"30\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeB\"></span><span class=\"err\" id=\"errB\"></span>\n        </div>\n      </div>\n      <div class=\"kfg_dims\" id=\"dimsRound\" style=\"display:none\">\n        <div class=\"kfg_field\" id=\"fD\" style=\"grid-column:1/-1\">\n          <label for=\"inD\">Durchmesser \u00d8</label>\n          <div class=\"in\"><input id=\"inD\" type=\"number\" inputmode=\"numeric\" value=\"80\" min=\"30\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeD\"></span><span class=\"err\" id=\"errD\"></span>\n        </div>\n      </div>\n      <div class=\"kfg_dims\" id=\"dimsLform\" style=\"display:none\">\n        <div class=\"kfg_field\" id=\"fLL\">\n          <label for=\"inLL\">Gesamtl\u00e4nge</label>\n          <div class=\"in\"><input id=\"inLL\" type=\"number\" inputmode=\"numeric\" value=\"180\" min=\"30\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeLL\"></span><span class=\"err\" id=\"errLL\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fLB\">\n          <label for=\"inLB\">Gesamtbreite</label>\n          <div class=\"in\"><input id=\"inLB\" type=\"number\" inputmode=\"numeric\" value=\"120\" min=\"30\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeLB\"></span><span class=\"err\" id=\"errLB\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fAW\">\n          <label for=\"inAW\">Ausklinkung Breite</label>\n          <div class=\"in\"><input id=\"inAW\" type=\"number\" inputmode=\"numeric\" value=\"90\" min=\"10\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeAW\"></span><span class=\"err\" id=\"errAW\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fAH\">\n          <label for=\"inAH\">Ausklinkung Tiefe</label>\n          <div class=\"in\"><input id=\"inAH\" type=\"number\" inputmode=\"numeric\" value=\"60\" min=\"10\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeAH\"></span><span class=\"err\" id=\"errAH\"></span>\n        </div>\n        <div class=\"kfg_rule-note\" style=\"grid-column:1/-1\">Innenecke wird automatisch verrundet: R50 bei M\u00f6belplatte \u00b7 R10 bei Multiplex &amp; Compact (Fertigungsregel).</div>\n      </div>\n      <div id=\"dimsSzwal\" style=\"display:none\">\n        <p class=\"kfg_sublabel\">Plattenbreite</p>\n        <div class=\"kfg_chips\" id=\"swW\">\n          <button class=\"kfg_chip\" data-v=\"106\">106 cm</button>\n          <button class=\"kfg_chip is-active\" data-v=\"120\">120 cm</button>\n          <button class=\"kfg_chip\" data-v=\"125\">125 cm</button>\n        </div>\n        <p class=\"kfg_sublabel\">Plattentiefe</p>\n        <div class=\"kfg_chips\" id=\"swD\">\n          <button class=\"kfg_chip\" data-v=\"50\">50 cm</button>\n          <button class=\"kfg_chip\" data-v=\"55\">55 cm</button>\n          <button class=\"kfg_chip is-active\" data-v=\"60\">60 cm</button>\n        </div>\n        <p class=\"kfg_sublabel\">Maschinen-Ausschnitt (Tiefe 18 cm)</p>\n        <div class=\"kfg_chips\" id=\"swC\">\n          <button class=\"kfg_chip\" data-v=\"48\">48 cm</button>\n          <button class=\"kfg_chip is-active\" data-v=\"52\">52 cm</button>\n          <button class=\"kfg_chip\" data-v=\"61.7\">61,7 cm</button>\n        </div>\n        <div class=\"kfg_rule-note\">Standardma\u00dfe \u2014 <strong>jedes andere Ma\u00df ist m\u00f6glich</strong>, ebenso Eck-Ausklinkung und U-Ausschnitt: bitte \u00fcber \u201eEigenes Bohrbild / Skizze\" in Schritt 05 angeben. Fertigung aus Multiplex + Laminat + ABS-Kante.</div>\n      </div>\n      <div class=\"kfg_quick\" id=\"quickBlock\">\n        <p>Ab Lager \u2014 sofort lieferbar:</p>\n        <div class=\"kfg_quick-chips\" id=\"quickChips\"></div>\n      </div>\n      <details class=\"kfg_measure\">\n        <summary><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 16.5L16.5 3l4.5 4.5L7.5 21zM7.5 13l2 2M10.5 10l2 2M13.5 7l2 2\"/></svg> Richtig messen \u2014 so geht's</summary>\n        <p>Miss die gew\u00fcnschte Fl\u00e4che an der breitesten Stelle und rechne bei Wandmontage 5&nbsp;mm Luft ein. Bei Gestellen: Platten\u00fcberstand 5\u201315&nbsp;cm je Seite einplanen. Unsicher? Ruf uns an \u2014 wir pr\u00fcfen dein Ma\u00df kostenlos vor der Fertigung.</p>\n      </details>\n    </section>\n\n    <!-- 04 St\u00e4rke & Kante -->\n    <section class=\"kfg_step\" id=\"kfgStep4\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">04</span><span class=\"kfg_step-title\">St\u00e4rke &amp; Kante</span><span class=\"kfg_step-count\" id=\"k4\"></span></div>\n      <div class=\"kfg_chips\" id=\"thickChips\"></div>\n      <p class=\"kfg_sublabel\">Kantenprofil</p>\n      <div class=\"kfg_chips\" id=\"edgeChips\"></div>\n      <div id=\"edgeRadiusBlock\" style=\"display:none\">\n        <p class=\"kfg_sublabel\">Rundungsradius der Kante</p>\n        <div class=\"kfg_chips\" id=\"edgeRadiusChips\">\n          <button class=\"kfg_chip is-active\" data-er=\"3\">R3</button>\n          <button class=\"kfg_chip\" data-er=\"6\">R6</button>\n          <button class=\"kfg_chip\" data-er=\"9\">R9</button>\n        </div>\n      </div>\n      <div class=\"kfg_mpx-note\" id=\"mpxNote\">Multiplex: sichtbare Birkenschichtkante \u2014 leicht gefast ist serienm\u00e4\u00dfig. 45\u00b0 gefr\u00e4st oder halbrund gegen Aufpreis; Seiten auf Wunsch mit ABS oder klarlackiert (Angebot).</div>\n      <div class=\"kfg_edge-note\" id=\"edgeTip\"><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 3l6 16 2.5-6.5L20 10z\"/></svg><span>Tipp: Klicke in der 2D-Vorschau direkt auf eine Kante, um sie einzeln zu \u00e4ndern.</span></div>\n    </section>\n\n    <!-- 05 Ausschnitte & Bohrungen -->\n    <section class=\"kfg_step\" id=\"kfgStep5\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">05</span><span class=\"kfg_step-title\">Ausschnitte &amp; Bohrungen</span><span class=\"kfg_step-count\" id=\"k5\"></span></div>\n      <p class=\"kfg_grouplabel\">Bohrungen &amp; Durchl\u00e4sse</p>\n      <label class=\"kfg_check\"><input type=\"checkbox\" data-x=\"bohr\">\n        <span><b>Montagebohrungen 4\u00d7 \u00d88</b><small>vorgebohrt f\u00fcr g\u00e4ngige Gestelle</small></span><span class=\"pr\">+ 9,90&nbsp;\u20ac</span></label>\n      <div class=\"kfg_preset\" data-preset=\"kabel\">\n        <span><b>Kabeldurchlass \u00d860</b><small>inkl. Abdeckung, frei positionierbar</small></span>\n        <span class=\"pr\">+ 14,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <div class=\"kfg_preset\" data-preset=\"kabel80\">\n        <span><b>Kabeldurchlass \u00d880</b><small>inkl. Abdeckung, frei positionierbar</small></span>\n        <span class=\"pr\">+ 16,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <div class=\"kfg_preset\" data-preset=\"armatur\">\n        <span><b>Armaturenbohrung \u00d835</b><small>f\u00fcr Armatur oder Kabeldose</small></span>\n        <span class=\"pr\">+ 12,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <p class=\"kfg_grouplabel\">K\u00fcchen-Ausschnitte</p>\n      <div class=\"kfg_preset\" data-preset=\"usb\">\n        <span><b>Steckdosen-Ausschnitt</b><small>26,5 \u00d7 10 cm, f\u00fcr USB oder Steckdose</small></span>\n        <span class=\"pr\">+ 21,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <div class=\"kfg_preset\" data-preset=\"spuele\">\n        <span><b>Sp\u00fclen-Ausschnitt</b><small>78 \u00d7 43 cm, K\u00fcchen-Arbeitsplatte</small></span>\n        <span class=\"pr\">+ 65,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <div class=\"kfg_preset\" data-preset=\"induktion\">\n        <span><b>Induktionsfeld-Ausschnitt</b><small>56 \u00d7 49 cm, K\u00fcchen-Arbeitsplatte</small></span>\n        <span class=\"pr\">+ 54,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <p class=\"kfg_grouplabel\">Individuelle Bearbeitung</p>\n      <label class=\"kfg_check\"><input type=\"checkbox\" data-x=\"custom\">\n        <span><b>Eigenes Bohrbild</b><small>frei nach deiner Vorgabe, CNC-gefr\u00e4st</small></span><span class=\"pr\">Angebot</span></label>\n      <div class=\"kfg_custom\" id=\"customBlock\">\n        <textarea id=\"customText\" placeholder=\"Beschreibe kurz, was du brauchst \u2014 z. B. \u201eEck-Ausklinkung 20\u00d715 cm hinten links\u201c.\"></textarea>\n        <div class=\"kfg_upload\" id=\"uploadZone\">\n          <b>Skizze oder Zeichnung hochladen</b>\n          PDF, Foto, DXF \u2014 oder einfach sp\u00e4ter per E-Mail an uns schicken\n          <input type=\"file\" id=\"uploadInput\" hidden>\n        </div>\n        <p class=\"kfg_custom-hint\">Mit eigener Skizze wird deine Platte individuell gefertigt \u2014 verbindliches Angebot in 24&nbsp;h.</p>\n      </div>\n      <p class=\"kfg_grouplabel\">Frei gestalten</p>\n      <p class=\"kfg_sublabel\">In der Vorschau aufziehen oder hinzuf\u00fcgen \u2014 danach jede Position auf den Millimeter genau einstellbar. Der Preis wird sofort berechnet.</p>\n      <div class=\"kfg_chips\" id=\"freiTools\">\n        <button class=\"kfg_chip\" id=\"drawRect\" data-draw=\"r\">\u25ad Ausschnitt</button>\n        <button class=\"kfg_chip\" id=\"drawCircle\" data-draw=\"c\">\u25ef Runder Ausschnitt</button>\n        <button class=\"kfg_chip\" id=\"drawPoly\" data-draw=\"p\">\u2b20 Freie Kontur</button>\n        <button class=\"kfg_chip\" id=\"addKanal\">\u2933 Kabelkanal fr\u00e4sen</button>\n      </div>\n      <div class=\"kfg_cutlist\" id=\"cutList\"></div>\n      <p class=\"kfg_custom-hint\" id=\"drawHint\" style=\"display:none\">Zeichnen-Modus: In der Vorschau aufziehen.</p>\n    </section>\n\n  </div>\n</div>\n\n<div class=\"kfg_bar\">\n  <span class=\"kfg_bar-thumb\" id=\"barThumb\" aria-hidden=\"true\"></span>\n  <div class=\"kfg_bar-what\"><b id=\"barTitle\">\u2014</b><small id=\"barSpec\">\u2014</small></div>\n  <div class=\"p\"><span class=\"val\" id=\"priceBar\">\u2014</span><small id=\"delivBar\">\u2014</small></div>\n  <button class=\"kfg_cta\" id=\"ctaBar\">In den Warenkorb</button>\n</div>\n\n\n<div class=\"toast\" id=\"toast\"></div>\n\n<div class=\"kfg_modal\" id=\"orderModal\" hidden>\n  <div class=\"kfg_modal-box\">\n    <div class=\"kfg_modal-head\"><b>So kommt deine Bestellung bei uns an</b>\n      <span class=\"kfg_modal-tag\">Demo \u00b7 interne Ansicht</span>\n      <button id=\"omClose\" aria-label=\"Schlie\u00dfen\">\u00d7</button></div>\n    <div class=\"kfg_modal-grid\">\n      <div class=\"kfg_modal-draw\">\n        <svg id=\"omSvg\" viewBox=\"0 0 600 444\"></svg>\n        <p>Fertigungszeichnung \u2014 automatisch aus der Konfiguration erzeugt (inkl. Ausschnitt-Abst\u00e4nde)</p>\n      </div>\n      <div class=\"kfg_modal-data\" id=\"omData\"></div>\n    </div>\n  </div>\n</div>";

/* ═══════════════════════ APP ═══════════════════════ */
function KFG_APP(shopData){

/* ═══════ Produktmatrix (Shopify-Lagerartikel: [EUR, VariantId, SKU]) ═══════ */
let SHOP = {};

/* ═══════ Bilder (injiziert) ═══════ */
const ASSET=(window.__KFG_BASE||'')+'/assets/kfg/';
const TEX = Object.fromEntries(["weiss", "schwarz", "kaszmir", "sosna-bielona", "ahorn", "buk", "sonoma-eiche", "eiche-artison", "sperrholz-natur", "marmor-weiss", "marmor-schwarz", "czarny", "hikora", "alaska-weiss", "szary", "eiche-kamienny"].map(k=>[k,ASSET+'top/'+k+'.webp']));
const KANTE = Object.fromEntries(["schwarz_18", "schwarz_28", "schwarz_40", "szary_18", "kaszmir_18", "kaszmir_28", "kaszmir_36", "sosna-bielona_18", "sosna-bielona_28", "sosna-bielona_36", "ahorn_18", "ahorn_28", "ahorn_36", "buk_18", "buk_20", "buk_28", "buk_40", "sonoma-eiche_18", "sonoma-eiche_28", "sonoma-eiche_36", "eiche-artison_18", "eiche-artison_28", "eiche-artison_36", "weiss_36", "hikora_18", "hikora_36", "mpx_21", "mpx_40", "compact_12", "compact_weiss", "compact_szary", "compact_marmor-weiss", "compact_marmor-schwarz", "compact_czarny", "alaska-weiss_36", "eiche-kamienny_18", "eiche-kamienny_36", "szary_28"].map(k=>[k,ASSET+'kante/'+k+'.webp']));

/* ═══════ Preismatrix (Produktions-Docx, zł brutto) ═══════ */
const KURS = 4.3;                                   /* zł → € Fixkurs (Sascha-Entscheidung) */
const eur = zl => Math.max(25.9, Math.ceil(zl/KURS) - 0.10);   /* ,90-Rundung, Minimum 25,90 € */
const RATE = {                                      /* zł pro m² */
  dekor:   {18:295, 25:386, 36:566},
  mpx:     {21:446, 40:515},                        /* Birke natur */
  mpxHPL:  {hikora:{21:650,40:750}, std:{21:600,40:700}},
  compact: {std:990, marmor:1080}
};
/* Fertigungsregeln (Senior): Radien + Maximalmaße */
const RULES = {
  dekor:   {maxL:270, maxB:200, maxD:160, minCorner:30, cornerNote:'Möbelplatte (ABS-Kante): Außenradien mind. R30. Kleinere Radien sind fertigungstechnisch nicht möglich.'},
  compact: {maxL:238, maxB:120, maxD:120, minCorner:0, cornerNote:''},
  mpx:     {maxL:238, maxB:120, maxD:120, minCorner:0, cornerNote:''}
};

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
/* Auf Multiplex kann jedes Laminat der Möbelplatten-Palette aufgeklebt werden (Sascha 26.07.) */
const DEKOR_HPL = DEKOR_MOEBEL;
const MATERIALS = {
  dekor:   { name:'Möbelplatte', sub:'ab 25,90 € · 18/25/36 mm',
             thick:[['18','18 mm'],['25','25 mm'],['36','36 mm']], def:'25', dekore:DEKOR_MOEBEL, hasABS:true },
  compact: { name:'Compact / HPL', sub:'ab 89 € · 12 mm',
             thick:[['12','12 mm Vollkern']], def:'12',
             dekore:[['weiss','Weiß'],['czarny','Schwarz'],['szary','Grau'],['marmor-weiss','Weißer Marmor'],['marmor-schwarz','Schwarzer Marmor']], hasABS:false },
  mpx:     { name:'Multiplex Birke', sub:'ab 49 € · 21/40 mm · alle Dekore',
             thick:[['21','21 mm'],['40','40 mm']], def:'21', dekore:[['sperrholz-natur','Birke natur']], hasABS:false }
};
const FLAT = {'weiss':'#f0eee9','schwarz':'#232120','szary':'#b7b6b2','kaszmir':'#d9d2c4','sosna-bielona':'#ece5d6',
  'ahorn':'#e9d1a8','buk':'#d9af7e','sonoma-eiche':'#c2a172','eiche-artison':'#a8815a','hikora':'#8f704a',
  'sperrholz-natur':'#e7d9ba','marmor-weiss':'#ebe9e4','marmor-schwarz':'#2b2926','czarny':'#232120'};
const ABS_COL = {dekor:null, weiss:'#f0eee9', popiel:'#b7b6b2', dunkelgrau:'#6f6e6b', schwarz:'#232120',
  gruen:'#3d6b46', rot:'#8f2f2c', gelb:'#c9a227', blau:'#2f4f7a'};
/* Kantenprofile je Material (Zuschläge = Demo bis Senior-Preise vorliegen) */
/* Kantenprofile — Preise + Verfügbarkeit final (Produktion 26.07.2026) */
const EDGEPROFILES = {
  dekor:   [['abs','ABS-Kante 2 mm · R2',0,'inklusive','#1E1E1E']],
  mpx:     [['fase','Leicht gefast',0,'serienmäßig','#1E1E1E'],['f45','Gefast 45°',5,'+ 5 €/lfm','#8a6844'],['halbrund','Halbrund',8,'+ 8 €/lfm','#4a7a9b']],
  compact: [['roh','Geschliffen',0,'serienmäßig','#1E1E1E'],['fase','Gefast 45°',7,'+ 7 €/lfm','#8a6844'],['halbrund','Halbrund',8,'+ 8 €/lfm','#4a7a9b']]
};
const CORNER_PRICE = { 30:3.8, 50:3.8, 100:7.9 };          /* € je Ecke (27.07.: 5 % unter KOLM) */
/* Ecken einzeln waehlbar (Wunsch Produktion, 27.07.): der Radius gilt nur fuer die
   angehakten Ecken. Reihenfolge im Uhrzeigersinn ab oben links = hinten links,
   hinten rechts, vorne rechts, vorne links. */
const CORNER_NAMES = ['hinten links','hinten rechts','vorne rechts','vorne links'];
/* Radius JE ECKE in mm (0 = eckig). Preisstufen wie in der Preisliste:
   bis R50 = 4,90 € je Ecke, darueber = 7,90 € je Ecke. */
function cornerLabel(){
  if(S.form==='lform') return cornerR(0)>0?`R${cornerR(0)} · alle Außenecken`:'eckig';
  const on=[0,1,2,3].filter(i=>cornerR(i)>0);
  if(!on.length) return 'eckig';
  const uniq=[...new Set(on.map(cornerR))];
  if(uniq.length===1) return `R${uniq[0]} · ${on.length===4?'alle vier':on.map(i=>CORNER_NAMES[i]).join(', ')}`;
  return on.map(i=>`${CORNER_NAMES[i]} R${cornerR(i)}`).join(' · ');
}
function cornerPriceFor(r){ return r<=0?0:(r<=50?3.8:7.9); }
/* Rechteck und Naehmaschinen-Platte: Radius je Ecke einzeln.
   L-Form: ein Radius fuer alle fuenf Aussenecken (die Innenecke bekommt
   ohnehin automatisch R50 bzw. R10 nach Fertigungsregel). Rund: entfaellt. */
function cornerFormOk(){ return S.form==='rect'||S.form==='szwal'||S.form==='lform'; }
function cornerPerCorner(){ return S.form==='rect'||S.form==='szwal'; }
function cornerR(i){
  if(!cornerFormOk()) return 0;
  if(!cornerPerCorner()) return Math.max(0, +S.cornerR[0]||0);   /* L-Form: einheitlich */
  return Math.max(0, +S.cornerR[i]||0);
}
function cornerOuterCount(){ return S.form==='lform' ? 5 : 4; }
function cornerCount(){ return S.form==='lform' ? (cornerR(0)>0?5:0) : [0,1,2,3].filter(i=>cornerR(i)>0).length; }
function cornerOn(i){ return cornerR(i)>0; }
function cornerSum(){ return S.form==='lform' ? cornerPriceFor(cornerR(0))*5 : [0,1,2,3].reduce((a,i)=>a+cornerPriceFor(cornerR(i)),0); }
function cornerMax(){ return Math.max(0,...[0,1,2,3].map(cornerR)); }
/* Auf Fertigungsregeln und halbe Plattenmasse begrenzen */
function clampCorner(r){
  const d=dims(), lim=Math.min(d.w,d.h)*10/2, mn=rules().minCorner;
  r=Math.max(0,Math.min(300,Math.round(r||0)));
  if(r>0&&mn>0&&r<mn) r=mn;
  return Math.min(r,Math.floor(lim));
}
function setAllCorners(r){ S.cornerR=[0,1,2,3].map(()=>clampCorner(r)); S.corner=cornerMax(); }
function cornerFieldsVisible(){ return cornerPerCorner(); }
/* Radius je Ecke in Pixeln des Aufrufers */
function cornerRadii(scale, maxA, maxB){
  const cap=Math.min(maxA,maxB);
  return [0,1,2,3].map(i => Math.min(cornerR(i)/10*scale, cap));
}
const ABS_STOCK = [['dekor','Dekorgleich','Standard'],['weiss','Weiß',''],['popiel','Asche Grau',''],
  ['dunkelgrau','Dunkelgrau',''],['schwarz','Schwarz',''],
  ['gruen','Grün','18/25 mm'],['rot','Rot','18/25 mm'],['gelb','Gelb','18/25 mm'],['blau','Blau','18/25 mm']];
const ABS_LIMITED = ['gruen','rot','gelb','blau'];          /* nur 18 + 25 mm */
/* Sascha-Entscheidung 26.07.: Bei Möbelplatten zeigt die Detailansicht IMMER die mittlere
   Stärke (25 mm ≙ 28-mm-Archivaufnahme) — nicht für jede Farbe existiert jede Stärke.
   Der Hinweis unter dem Bild sagt das explizit. Multiplex/Compact: Foto passt zur Stärke. */
const REF_MM = 28;                       /* Archiv-Ordner der 25-mm-Platte */
function edgePhoto(){
  if(S.mat==='compact') return {src:KANTE['compact_'+S.dekor]||KANTE['compact_12'], ref:false};
  if(S.mat!=='dekor') return {src:KANTE[S.mat+'_'+S.thick]||KANTE['mpx_40'], ref:false};
  /* Regelfall: die 28-mm-Archivaufnahme zeigt die 25-mm-Platte (Sascha 26.07.). */
  if(KANTE[S.dekor+'_'+REF_MM]) return {src:KANTE[S.dekor+'_'+REF_MM], ref:true, mm:25};
  /* Ersatz: naechstliegende ECHTE Staerke zur 25-mm-Platte. Betrifft Eiche Kamienny
     und Eiche Hickory — deren 28-mm-Ordner im Archiv enthielt Artison-Fotos. */
  const avail=Object.keys(KANTE).filter(k=>k.startsWith(S.dekor+'_')).map(k=>+k.split('_')[1]);
  if(!avail.length) return {src:TEX[S.dekor], ref:true, mm:null};
  const near=avail.sort((a,b)=>Math.abs(a-25)-Math.abs(b-25))[0];
  return {src:KANTE[S.dekor+'_'+near], ref:true, mm:near};
}
/* Lagergrößen kommen jetzt aus der Produktmatrix — nichts mehr hartcodiert */
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
function shopSizes(){
  const dek=S.mat==='mpx'?'sperrholz-natur':S.dekor;
  const pre=`${S.mat}|${S.form}|${dek}|${S.thick}|`, out=[];
  for(const k in SHOP){ if(!k.startsWith(pre))continue;
    const m=k.slice(pre.length);
    if(S.form==='round') out.push({d:+m.slice(1).replace(',','.')});
    else { const [a,b]=m.split('x').map(x=>+x.replace(',','.')); out.push({l:a,b:b}); }
  }
  return S.form==='round'?out.sort((x,y)=>x.d-y.d):out.sort((x,y)=>x.l-y.l||x.b-y.b);
}
const X_PRICE = { bohr:9.9 };
/* Preise 27.07.2026 an den Wettbewerb angeglichen (5 % unter KOLM, Freigabe Sascha).
   Vergleichsbasis siehe kessler-pro-docs/plans/Konfigurator-Wettbewerb-KOLM.md */
/* Freie Bearbeitungen: Grundpreis + Zuschlag je laufendem Meter Schnittkante.
   Hergeleitet aus KOLM, 5 % darunter (plans/Konfigurator-Wettbewerb-KOLM.md):
   Kreisausschnitt bis Ø650 = 43,97 € bei 2,04 lfm, bis Ø1300 = 66,06 € bei
   4,08 lfm → Steigung 10,80 €/lfm, Grundpreis 21,90 €. Kleinere Ausschnitte
   liegen damit deutlich unter KOLM (Syphon 160×120: 27,95 € statt 30,71 €).
   */
const FREI_PRICE  = {basis:21.9, lfm:10.8};
/* Kabelkanal: KOLM bietet Kanaele nicht an, es gibt also keinen Vergleichswert.
   Abgeleitet aus der eigenen Fraesformel: eine Nut ist eine Tasche, der Fraeser
   muss sie in mehreren Bahnen ausraeumen statt einmal durchzutrennen. Basis ist
   die Standardnut 60 mm breit, 10 mm tief; breiter und tiefer kostet Zuschlag
   je angefangener Stufe. NOCH NICHT VON DER FERTIGUNG GEGENGERECHNET. */
const KANAL_PRICE = {basis:14.9, lfm:12.9, breiteStufe:30, breitePlus:3.9,
                     tiefeStufe:5, tiefePlus:2.9, wBasis:60, tBasis:10};
function kanalLfmPreis(w,t){
  const bStufen=Math.max(0,Math.ceil(((w||60)-KANAL_PRICE.wBasis)/KANAL_PRICE.breiteStufe));
  const tStufen=Math.max(0,Math.ceil(((t||10)-KANAL_PRICE.tBasis)/KANAL_PRICE.tiefeStufe));
  return KANAL_PRICE.lfm + bStufen*KANAL_PRICE.breitePlus + tStufen*KANAL_PRICE.tiefePlus;
}
const PRESETS = {
  kabel:    {label:'Kabeldurchlass Ø60', short:'Ø60',       t:'c', d:6,          price:14.9, pos:(L,B,n)=>[L/2+n*10, 0.15*B]},
  kabel80:  {label:'Kabeldurchlass Ø80', short:'Ø80',       t:'c', d:8,          price:16.9, pos:(L,B,n)=>[L/2+n*12, 0.15*B]},
  armatur:  {label:'Armaturenbohrung Ø35', short:'Ø35',     t:'c', d:3.5,        price:12.9, pos:(L,B,n)=>[L/2+n*8, 0.12*B]},
  usb:      {label:'Steckdosen-Ausschnitt', short:'Steckdose',       t:'r', w:26.5, h:10, price:21.9, pos:(L,B,n)=>[L-21.25-n*30, 0.10*B+5]},
  spuele:   {label:'Spülen-Ausschnitt',  short:'Spüle',     t:'r', w:78,  h:43,  price:65.9, pos:(L,B,n)=>[0.08*L+39+n*10, B/2]},
  induktion:{label:'Induktionsfeld',     short:'Induktion', t:'r', w:56,  h:49,  price:54.9, pos:(L,B,n)=>[L-34-n*10, B/2]}
};

/* ═══════ State ═══════ */
/* Startkonfiguration: bewusst ein LAGERARTIKEL (Buche 120x60x25 = 47,95 EUR ab Lager).
   Eiche Sonoma gibt es nur in 90x50 und 90x60 — der Konfigurator startete dadurch
   im Angebots-Flow statt mit dem starken "Ab Lager"-Signal. */
const S = { mat:'dekor', dekor:'buk', mpxSurface:'natur', absColor:'dekor',
            form:'rect', L:120, B:60, D:80, sw:{w:120,d:60,c:52}, lf:{L:180,B:120,aw:90,ah:60}, thick:'25',
            corner:0, cornerR:[0,0,0,0], edgeR:3, edges:['abs','abs','abs','abs'],
            extras:{bohr:false,custom:false},
            cuts:[], draw:null, view:'2d' };

/* ═══════ Helpers ═══════ */
const $=id=>document.getElementById(id);
const fmt=v=>v.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),2600)}
function rules(){ return RULES[S.mat]; }
function baseEdge(){ return EDGEPROFILES[S.mat][0][0]; }
function profileOf(id){ return EDGEPROFILES[S.mat].find(p=>p[0]===id)||EDGEPROFILES[S.mat][0]; }
function edgeLabel(e){ const p=profileOf(e); return (e==='rund'||e==='halbrund')?`${p[1]} R${S.edgeR}`:p[1]; }
function texKey(){ return S.mat==='mpx' ? (S.mpxSurface==='hpl'?S.dekor:'sperrholz-natur') : S.dekor; }
function isLack(){ return S.mat==='mpx' && S.mpxSurface==='lack'; }

function dims(){
  if(S.form==='rect') return {w:+S.L,h:+S.B};
  if(S.form==='round') return {w:+S.D,h:+S.D};
  if(S.form==='lform') return {w:+S.lf.L,h:+S.lf.B};
  return {w:S.sw.w,h:S.sw.d};
}
function areaM2(){
  if(S.form==='rect') return S.L*S.B/1e4;
  if(S.form==='round') return Math.PI*Math.pow(S.D/200,2);
  if(S.form==='lform') return (S.lf.L*S.lf.B - S.lf.aw*S.lf.ah)/1e4;
  return (S.sw.w*S.sw.d - S.sw.c*18)/1e4;
}
function rateZl(){
  /* Nähmaschinen-Platten werden aus Sklejka + Laminat + ABS gefertigt (Produktion 26.07.) */
  if(S.form==='szwal') return (S.dekor==='hikora'?RATE.mpxHPL.hikora:RATE.mpxHPL.std)[+S.thick]||RATE.mpxHPL.std[21];
  if(S.mat==='dekor') return RATE.dekor[+S.thick];
  if(S.mat==='compact') return (S.dekor==='marmor-weiss'||S.dekor==='marmor-schwarz')?RATE.compact.marmor:RATE.compact.std;
  if(S.mpxSurface==='hpl') return (S.dekor==='hikora'?RATE.mpxHPL.hikora:RATE.mpxHPL.std)[+S.thick];
  return RATE.mpx[+S.thick];
}
function perimM(){
  if(S.form==='round') return Math.PI*S.D/100;
  const d=dims(); return 2*(d.w+d.h)/100;
}
function dekorList(){
  if(S.mat!=='mpx') return MATERIALS[S.mat].dekore;
  return S.mpxSurface==='hpl'?DEKOR_HPL:(S.mpxSurface==='lack'?[]:[['sperrholz-natur','Birke natur']]);
}
function calc(){
  const zl=areaM2()*rateZl();
  const hit=shopHit();
  const basis=hit?hit[0]:eur(zl);      /* Lagerartikel: verbindlicher Shop-Preis */
  let kante=0;
  if(S.form==='rect'){ const len=[+S.L,+S.B,+S.L,+S.B];
    S.edges.forEach((e,i)=>kante+=profileOf(e)[2]*len[i]/100);
  } else kante=profileOf(S.edges[0])[2]*perimM();
  const ecken=cornerSum();
  let extras=0; if(S.extras.bohr) extras+=X_PRICE.bohr;
  S.cuts.forEach(c2=>{ extras+=cutPrice(c2); });   /* freie Bearbeitungen jetzt mit Sofortpreis */
  ensureDekor();
  const dk=(dekorList().find(x=>x[0]===S.dekor))||dekorList()[0]||['','—'];
  const tt=MATERIALS[S.mat].thick.find(t=>t[0]===S.thick)||MATERIALS[S.mat].thick[0];
  return {zl,basis,kante,ecken,extras,total:basis+kante+ecken+extras,
    dekorName:isLack()?'Klarlack':dk[1],thickName:tt[1]};
}
function isStandard(){
  if(S.extras.custom||isLack()||S.form==='szwal'||S.form==='lform'||cornerCount()>0||S.cuts.some(c=>!c.preset)) return false;
  if(S.mat!=='dekor'&&S.mat!=='compact') { /* mpx Festmaße? aktuell keine → nur 18er Liste für dekor */ }
  return !!shopHit();
}
/* Freie Ausschnitte, Ausklinkungen und Konturen haben seit v1.7.0 einen
   Sofortpreis nach Formel — auch der Kabelkanal seit v1.8.0. Ins Angebot geht
   nur noch die eigene Skizze und die Klarlack-Lackierung. */
function needsOffer(){ return S.extras.custom||isLack(); }
function delivDate(){
  const d=new Date(); let n=0;
  while(n<4){ d.setDate(d.getDate()+1); if(d.getDay()!==0&&d.getDay()!==6)n++; }
  return d.toLocaleDateString('de-DE',{day:'numeric',month:'long'});
}

/* ═══════ 2D-SVG ═══════ */
function drawStage(){
  /* PAD war 76, dann 58. Jetzt 42: die Massketten brauchen rund 30 Einheiten,
     der Rest war reine Luft (Wunsch Vater 29.07.: "Tischplatte muss groesser
     sein"). Damit nutzt die Platte 516 von 600 Einheiten Breite. */
  /* Nicht mehr rundum gleich: die Massketten liegen rechts und unten, dort
     brauchen sie Platz — links und oben war er nur Luft. */
  const svg=$('stage'); const W=600,H=444;
  const PADL=16, PADT=14;
  const rand=30+dimAb()+Math.round(_dimFS*0.5);      /* Kette + Zahl + Luft */
  const PADR=rand, PADB=rand;
  const bw=W-PADL-PADR, bh=H-PADT-PADB;
  const d=dims(), sc=Math.min(bw/d.w,bh/d.h);
  const pw=d.w*sc, ph=d.h*sc, x=PADL+(bw-pw)/2, y=PADT+(bh-ph)/2;
  const tex=TEX[texKey()];
  let inner='';

  if(S.form==='round'){
    const r=pw/2, cx=W/2, cy=y+r;
    inner+=`<clipPath id="plateClip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`;
    inner+=isLack()?`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#dcd9d2"/>`
      :`<image href="${tex}" x="${cx-r*1.16}" y="${cy-r*1.16}" width="${2.32*r}" height="${2.32*r}" preserveAspectRatio="xMidYMid slice" clip-path="url(#plateClip)"/>`;
    inner+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#00000018"/>`;
    inner+=`<circle class="kfg_edge" data-i="0" cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${edgeCol(S.edges[0])}" stroke-width="5"><title>Kante: ${edgeLabel(S.edges[0])}</title></circle>`;
    inner+=dimH(cx-r,cx+r,cy+r+30,'Ø '+S.D+' cm');
  } else if(S.form==='lform'){
    const aw=S.lf.aw*sc, ah=S.lf.ah*sc, ri=(S.mat==='dekor'?5:1)*sc;
    /* Aussenecken nach Wunsch abrunden; die Innenecke behaelt den
       fertigungsbedingten Mindestradius (R50 Moebelplatte / R10 sonst). */
    const rOut=Math.min(cornerR(0)/10*sc, pw/3, ph/3);
    const ptsL=[[x,y],[x+pw-aw,y],[x+pw-aw,y+ah],[x+pw,y+ah],[x+pw,y+ph],[x,y+ph]];
    const radL=[rOut,rOut,ri,rOut,rOut,rOut];
    const pd=roundPoly(ptsL, radL);
    inner+=`<clipPath id="plateClip"><path d="${pd}"/></clipPath>`;
    inner+=isLack()?`<path d="${pd}" fill="#dcd9d2"/>`
      :`<image href="${tex}" x="${x-pw*0.08}" y="${y-ph*0.08}" width="${pw*1.16}" height="${ph*1.16}" preserveAspectRatio="xMidYMid slice" clip-path="url(#plateClip)"/>`;
    inner+=`<path d="${pd}" fill="none" stroke="${edgeCol(S.edges[0])}" stroke-width="5" stroke-linejoin="round"/>`;
    inner+=`<path d="${pd}" fill="none" stroke="#00000018"/>`;
    inner+=dimH(x,x+pw,y+ph+30,S.lf.L+' cm')+dimV(x-30,y,y+ph,S.lf.B+' cm');
    inner+=`<text class="dim-text" x="${x+pw-aw/2}" y="${y+ah/2+4}" text-anchor="middle">${S.lf.aw} × ${S.lf.ah}</text>`;
  } else {
    /* Radius je Ecke — 0 heisst eckig. Ohne Rundung bleibt die alte leichte 3-px-Fase. */
    const RR=cornerRadii(sc,pw/2,ph/2);
    const anyR=RR.some(v=>v>0.5);
    const R4=anyR?RR:[3,3,3,3];
    const rx=Math.max(...R4);
    const pdRect=roundPath(x,y,pw,ph,R4);
    let clip=`<path d="${pdRect}"/>`;
    inner+=`<clipPath id="plateClip">${clip}</clipPath>`;
    inner+=isLack()?`<path d="${pdRect}" fill="#dcd9d2"/>`
      :`<image href="${tex}" x="${x-pw*0.08}" y="${y-ph*0.08}" width="${pw*1.16}" height="${ph*1.16}" preserveAspectRatio="xMidYMid slice" clip-path="url(#plateClip)"/>`;
    /* Nähmaschinen-Ausschnitt: Loch vorne mittig, 6 cm Randabstand */
    if(S.form==='szwal'){
      const cw=S.sw.c*sc, ch=18*sc, hx=x+(pw-cw)/2, hy=y+ph-(18+6)*sc;
      inner+=`<rect x="${hx}" y="${hy}" width="${cw}" height="${ch}" rx="${Math.min(10,ch/4)}" fill="#F2F0EB" stroke="#00000055"/>`;
      inner+=`<text class="dim-text" x="${hx+cw/2}" y="${hy+ch/2+4}" text-anchor="middle">${(''+S.sw.c).replace('.',',')} × 18</text>`;
    }
    inner+=`<path d="${pdRect}" fill="none" stroke="#00000018"/>`;
    /* Kanten als konturfolgende Pfade — jede Kante traegt die Haelfte der beiden
       angrenzenden Eckbogen, jetzt mit individuellem Radius je Ecke. */
    const seg=edgeSegments(x,y,pw,ph,R4);
    seg.forEach((dd,i)=>{
      inner+=`<path class="kfg_edge" data-i="${i}" d="${dd}" fill="none"
        stroke="${edgeCol(S.edges[i])}" stroke-width="5" stroke-linecap="butt"><title>Kante ${'ABCD'[i]}: ${edgeLabel(S.edges[i])}</title></path>`;
    });
    inner+=dimH(x,x+pw,y+ph+30,d.w+' cm')+dimV(x+pw+30,y,y+ph,d.h+' cm');
    if(cornerCount()>0) inner+=`<text class="dim-text" x="${x+8}" y="${y-10}">Ecken: ${cornerLabel()}</text>`;
    /* Ecken direkt anklickbar — analog zu den Kanten */
    if(S.form==='rect'){
      [[x,y],[x+pw,y],[x+pw,y+ph],[x,y+ph]].forEach((pt,i)=>{
        inner+=`<circle class="kfg_cornerhit" data-c="${i}" cx="${pt[0]}" cy="${pt[1]}" r="15" fill="transparent" style="cursor:pointer">`
          +`<title>Ecke ${CORNER_NAMES[i]}, klicken zum ${cornerOn(i)?'Begradigen':'Abrunden'}</title></circle>`;
      });
    }
    /* Ausschnitte */
    if(S.extras.bohr){
      const off=Math.max(6*sc,10)+(cornerCount()>0&&S.corner>10?S.corner/10*sc*0.5:0);
      [[x+off,y+off],[x+pw-off,y+off],[x+off,y+ph-off],[x+pw-off,y+ph-off]]
        .forEach(([bx,by])=>inner+=`<circle cx="${bx}" cy="${by}" r="4.5" fill="#F2F0EB" stroke="#00000060"/>`);
    }
  }
  /* Zeichnen-Kontext + eingezeichnete Ausschnitte */
  if(S.form!=='round'){
    G={x,y,sc,pw,ph,w:d.w,h:d.h};
    const all=tmpCut&&tmpCut.x1!==null?[...S.cuts,normCut(tmpCut)]:S.cuts;
    all.forEach((c2,i)=>{
      const committed=i<S.cuts.length;
      if(c2.t==='k'){
        const kp=kanalPunkte(c2).map(p=>[x+p[0]*sc, y+p[1]*sc]);
        const bw=Math.max(3,(c2.w||60)/10*sc);
        const dPfad='M '+kp.map(p=>p.join(' ')).join(' L ');
        const oben=c2.seite==='oben';
        /* breite Bahn = die Nut, gestrichelt wenn sie unten liegt und von oben
           nicht zu sehen ist */
        inner+=`<path class="kfg_cutshape" data-idx="${i}" d="${dPfad}" fill="none"
          stroke="#F2F0EB" stroke-opacity="${oben?'.95':'.6'}" stroke-width="${bw}"
          stroke-linejoin="round" stroke-linecap="${(c2.enden||'').length?'butt':'round'}"${committed?' style="cursor:move"':''}><title>Kabelkanal, ziehen zum Verschieben</title></path>`;
        inner+=`<path d="${dPfad}" fill="none" stroke="#00000055" stroke-width="${bw}"
          stroke-linejoin="round" stroke-linecap="butt" stroke-dasharray="${oben?'':'7 4'}"
          style="pointer-events:none;fill:none" opacity=".0"/>`;
        inner+=`<path d="${dPfad}" fill="none" stroke="#00000060" stroke-width="1.2"
          stroke-dasharray="${oben?'':'7 4'}" style="pointer-events:none"/>`;
        /* Beschriftung neben die Nut legen, nicht darauf — sonst kreuzt sie die
           Bandkanten und ist nicht mehr zu lesen. */
        const mp=[(kp[0][0]+kp[kp.length-1][0])/2,(kp[0][1]+kp[kp.length-1][1])/2];
        const quer=c2.dir==='quer';
        inner+=`<text class="dim-text" x="${quer?mp[0]+bw/2+7:mp[0]}" y="${quer?mp[1]+4:mp[1]-bw/2-7}"
          text-anchor="${quer?'start':'middle'}"
          style="font-size:10.5px;pointer-events:none;paint-order:stroke;stroke:#F2F0EB;stroke-width:3px"
          >Kanal ${Math.round(cutLen(c2))} cm · ${c2.w} × ${c2.dp} mm</text>`;
        return;
      }
      if(c2.t==='p'){
        const pa=polyAbs(c2).map(p=>[x+p[0]*sc, y+p[1]*sc]);
        const rr=pa.map(()=>Math.max(0,(c2.r||0))/10*sc);
        inner+=`<path class="kfg_cutshape" data-idx="${i}" d="${roundPoly(pa,rr)}"
          fill="#F2F0EB" fill-opacity=".92" stroke="#00000060" stroke-dasharray="5 3"${committed?' style="cursor:move"':''}><title>Freie Kontur, ziehen zum Verschieben</title></path>`;
        inner+=`<text class="dim-text" x="${x+c2.cx*sc}" y="${y+c2.cy*sc+4}" text-anchor="middle" style="font-size:11px;pointer-events:none">${(c2.pts||[]).length} Punkte</text>`;
        return;
      }
      if(c2.t==='c'){
        inner+=`<circle class="kfg_cutshape" data-idx="${i}" cx="${x+c2.cx*sc}" cy="${y+c2.cy*sc}" r="${c2.d/2*sc}"
          fill="#F2F0EB" fill-opacity=".92" stroke="#00000060" stroke-dasharray="5 3"${committed?' style="cursor:move"':''}><title>Ø ${c2.d} cm, ziehen zum Verschieben</title></circle>`;
        inner+=`<text class="dim-text" x="${x+c2.cx*sc}" y="${y+c2.cy*sc+4}" text-anchor="middle" style="font-size:11px;pointer-events:none">${cutShort(c2)}</text>`;
      } else {
        inner+=`<rect class="kfg_cutshape" data-idx="${i}" x="${x+(c2.cx-c2.w/2)*sc}" y="${y+(c2.cy-c2.h/2)*sc}" width="${c2.w*sc}" height="${c2.h*sc}" rx="3"
          fill="#F2F0EB" fill-opacity=".92" stroke="#00000060" stroke-dasharray="5 3"${committed?' style="cursor:move"':''}><title>${c2.w} × ${c2.h} cm, ziehen zum Verschieben</title></rect>`;
        inner+=`<text class="dim-text" x="${x+c2.cx*sc}" y="${y+c2.cy*sc+4}" text-anchor="middle" style="font-size:11px;pointer-events:none">${cutShort(c2)}</text>`;
      }
      /* Abstandsmaße zur Kante: beim Ziehen dieses Ausschnitts oder in der Auftragszeichnung */
      if((dragCut&&dragCut.i===i&&committed)||FORCE_DISTS){
        const f=v=>(''+(Math.round(v*10)/10)).replace('.',',');
        const cl=c2.cx-c2.w/2, cr=G.w-(c2.cx+c2.w/2), ct=c2.cy-c2.h/2, cb=G.h-(c2.cy+c2.h/2);
        const cyp=y+c2.cy*sc, cxp=x+c2.cx*sc;
        const halo='paint-order:stroke;stroke:#F2F0EB;stroke-width:3px;font-size:10.5px';
        const dline=(x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#F2F0EB" stroke-width="3"/>
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#55524d" stroke-width="1" stroke-dasharray="2 2"/>`;
        inner+=`<g style="pointer-events:none">
          ${dline(x,cyp,x+cl*sc,cyp)}<text class="dim-text" x="${x+cl*sc/2}" y="${cyp-6}" text-anchor="middle" style="${halo}">${f(cl)}</text>
          ${dline(x+(G.w-cr)*sc,cyp,x+G.w*sc,cyp)}<text class="dim-text" x="${x+(G.w-cr/2)*sc}" y="${cyp-6}" text-anchor="middle" style="${halo}">${f(cr)}</text>
          ${dline(cxp,y,cxp,y+ct*sc)}<text class="dim-text" x="${cxp+6}" y="${y+ct*sc/2+4}" style="${halo}">${f(ct)}</text>
          ${dline(cxp,y+(G.h-cb)*sc,cxp,y+G.h*sc)}<text class="dim-text" x="${cxp+6}" y="${y+(G.h-cb/2)*sc+4}" style="${halo}">${f(cb)}</text>
        </g>`;
      }
    });
    /* Kontur, die gerade gezeichnet wird */
    if(polyTmp&&polyTmp.length){
      const pa=polyTmp.map(p=>[x+p[0]*sc, y+p[1]*sc]);
      inner+=`<polyline points="${pa.map(p=>p.join(',')).join(' ')}" fill="#F2F0EB" fill-opacity=".55"
        stroke="#00000070" stroke-dasharray="5 3" stroke-width="1.5"/>`;
      pa.forEach((p,k)=>inner+=`<circle cx="${p[0]}" cy="${p[1]}" r="${k===0?5:3.5}"
        fill="${k===0?'#1E1E1E':'#F2F0EB'}" stroke="#1E1E1E"/>`);
      inner+=`<text class="dim-text" x="${pa[0][0]}" y="${pa[0][1]-12}" text-anchor="middle" style="font-size:10.5px">${polyTmp.length<3?'weiter klicken':'Doppelklick schließt'}</text>`;
    }
  } else G=null;
  svg.innerHTML=inner;
  svg.classList.toggle('is-drawing',!!S.draw);
  svg.querySelectorAll('.kfg_edge').forEach(e=>e.addEventListener('click',()=>cycleEdge(+e.dataset.i)));
  /* Ecke in der Vorschau anklicken = abrunden bzw. begradigen */
  svg.querySelectorAll('.kfg_cornerhit').forEach(e=>e.addEventListener('click',ev=>{
    ev.stopPropagation();
    const i=+e.dataset.c;
    if(cornerR(i)>0){ S.cornerR[i]=0; }
    else { S.cornerR[i]=clampCorner(cornerMax()||(rules().minCorner>0?rules().minCorner:10)); }
    S.corner=cornerMax();
    buildCorner(); render();
    toast(cornerR(i)>0?`Ecke ${CORNER_NAMES[i]}: R${cornerR(i)}`:`Ecke ${CORNER_NAMES[i]} wieder eckig`);
  }));

  drawDetail(); if(S.view==='3d') draw3D();
}
/* ── Zeichnen-Werkzeug ── */
let G=null, tmpCut=null, dragCut=null, FORCE_DISTS=false, polyTmp=null;
/* Ausklinkung anlegen — Standard: Eckausschnitt hinten links, danach in der
   Liste frei einstellbar (Kante, Breite, Tiefe, Abstand, Innenradius). */
/* Kabelkanal anlegen — wie die Ausschnitte: hinzufuegen, dann in den Feldern
   einstellen und in der Vorschau verschieben (Wunsch Sascha 27.07.). */
function addKanal(){
  if(S.form==='round'){ toast('Kabelkanal aktuell nur bei eckigen Formen'); return; }
  const d=dims();
  S.cuts.push({t:'k', cx:d.w/2, cy:d.h/2, len:Math.round(d.w*0.6),
               dir:'laengs', w:60, dp:10, seite:'unten', enden:'zu'});
  toast('Kabelkanal hinzugefügt — Länge, Breite und Lage stellst du unten ein');
  render();
  const box=$('cutList'); if(box&&box.lastElementChild) box.lastElementChild.scrollIntoView({behavior:'smooth',block:'center'});
}
/* Freie Kontur: Punkt fuer Punkt klicken, Doppelklick oder Klick auf den
   ersten Punkt schliesst die Form. */
function polyKlick(px,py){
  if(!G) return;
  const r5=v=>Math.round(v*2)/2;
  const cx=r5(Math.max(0,Math.min(G.w,(px-G.x)/G.sc)));
  const cy=r5(Math.max(0,Math.min(G.h,(py-G.y)/G.sc)));
  if(!polyTmp){ polyTmp=[[cx,cy]]; toast('Weitere Punkte klicken · Doppelklick schließt die Kontur'); drawStage(); return; }
  const erst=polyTmp[0];
  if(polyTmp.length>=3 && Math.hypot(cx-erst[0],cy-erst[1])<Math.max(2,G.w*0.02)){ polySchliessen(); return; }
  polyTmp.push([cx,cy]); drawStage();
}
function polySchliessen(){
  if(!polyTmp || polyTmp.length<3){ polyTmp=null; setDraw(null); drawStage(); return; }
  const xs=polyTmp.map(p=>p[0]), ys=polyTmp.map(p=>p[1]);
  const cx=(Math.min(...xs)+Math.max(...xs))/2, cy=(Math.min(...ys)+Math.max(...ys))/2;
  const c={t:'p', cx, cy, w:Math.max(...xs)-Math.min(...xs), h:Math.max(...ys)-Math.min(...ys),
           r:10, pts:polyTmp.map(p=>[p[0]-cx,p[1]-cy])};
  polyTmp=null; setDraw(null);
  if(c.w<3||c.h<3){ toast('Zu klein: mindestens 3 cm'); render(); return; }
  S.cuts.push(c);
  toast('Freie Kontur hinzugefügt · '+fmt(cutPrice(c)));
  render();
}
/* Absolute Punkte einer freien Kontur oder eines Kanals (cm) */
function polyAbs(c){ return (c.pts||[]).map(p=>[c.cx+p[0], c.cy+p[1]]); }
/* ── Kabelkanal ─────────────────────────────────────────────────────────────
   Der Kanal ist ein offener Zug aus beliebig vielen Punkten. Enden, die an der
   Plattenkante liegen sollen, werden dorthin verlaengert (Kabel laeuft seitlich
   ein); geschlossene Enden bleiben als Tasche in der Platte. */
const KANAL_ENDEN={zu:'beide geschlossen', a:'Anfang an der Kante', e:'Ende an der Kante', ae:'beide an der Kante'};
/* Ein Kanal ist ein gerader Zug: Mittelpunkt, Laenge und Richtung. Offene
   Enden werden bis an die naechste Kante gezogen. */
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
function normCut(t){
  const r5=v=>Math.round(v*2)/2;
  let x0=Math.max(0,Math.min(G.w,Math.min(t.x0,t.x1))), x1=Math.max(0,Math.min(G.w,Math.max(t.x0,t.x1)));
  let y0=Math.max(0,Math.min(G.h,Math.min(t.y0,t.y1))), y1=Math.max(0,Math.min(G.h,Math.max(t.y0,t.y1)));
  const w=r5(x1-x0), hh=r5(y1-y0);
  if(t.t==='c'){ const d2=r5(Math.max(w,hh)); return {t:'c',cx:r5((x0+x1)/2),cy:r5((y0+y1)/2),d:d2,w:d2,h:d2}; }
  return {t:'r',cx:r5((x0+x1)/2),cy:r5((y0+y1)/2),w,h:hh};
}
function fmtCut(c){
  if(c.t==='k') return `Kabelkanal ${cutMass(c)}`;
  if(c.t==='p') return `Freie Kontur, ${(c.pts||[]).length} Punkte`;
  const m=cutMass(c);
  return c.preset?`${PRESETS[c.preset].label} (${m})`:`Ausschnitt ${m}`; }
function cutShort(c){
  const z=v=>(''+v).replace('.',',');
  if(c.preset) return PRESETS[c.preset].short;
  if(c.t==='p') return (c.pts||[]).length+' Punkte';
  return c.t==='c'?('Ø '+z(c.d)):(z(c.w)+' × '+z(c.h));
}
function setDraw(v){
  if(v!=='p') polyTmp=null;
  if(v&&S.form==='round'){toast('Zeichnen aktuell nur bei eckigen Formen');return;}
  if(v&&S.view==='3d'){setView('2d');}
  S.draw=v;
  document.querySelectorAll('[data-draw]').forEach(b=>b.classList.toggle('is-active',b.dataset.draw===v));
  $('drawHint').style.display=v?'block':'none';
  $('stage').classList.toggle('is-drawing',!!v);
  if(v&&window.innerWidth<980){
    document.querySelector('.kfg_preview').scrollIntoView({behavior:'smooth',block:'start'});
    toast('Ziehe den Ausschnitt in der Vorschau auf');
  }
}
function svgPt(e){const r=$('stage').getBoundingClientRect();
  return [(e.clientX-r.left)*600/r.width,(e.clientY-r.top)*444/r.height];}
function cut(x,y,w,h,label){
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#00000018" stroke="#00000045" stroke-dasharray="4 3"/>
    <text class="dim-text" x="${x+w/2}" y="${y+h/2+4}" text-anchor="middle" style="font-size:11px">${label}</text>`;
}
function shadeHex(hex,f){const n=parseInt(hex.slice(1),16),r=n>>16&255,g=n>>8&255,b=n&255;
  return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;}
function edgeCol(e){
  if(e==='abs'||e==='roh'){
    if(S.mat==='dekor'&&S.absColor!=='dekor') return ABS_COL[S.absColor];
    return shadeHex(FLAT[texKey()]||'#c9b48b',0.78);   /* dekorgleich: Dekorton statt Schwarz */
  }
  return profileOf(e)[4];
}
/* Abstand Linie -> Zahl. Die Zahl ist an der Masskette gedreht, ihr optischer
   Schwerpunkt liegt deshalb auf halber Schrifthoehe. 0,62 war zu knapp, die 60
   klebte an der Linie (Befund Sascha 29.07.) — jetzt 0,8 plus 10 Einheiten. */
function dimAb(){ return Math.round(_dimFS*0.8)+10; }
function dimH(x1,x2,y,t){const a=dimAb();return `<line class="dim-line" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>
  <line class="dim-line" x1="${x1}" y1="${y-5}" x2="${x1}" y2="${y+5}"/><line class="dim-line" x1="${x2}" y1="${y-5}" x2="${x2}" y2="${y+5}"/>
  <text class="dim-text" x="${(x1+x2)/2}" y="${y+a+4}" text-anchor="middle">${t}</text>`}
function dimV(x,y1,y2,t){const a=dimAb();return `<line class="dim-line" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>
  <line class="dim-line" x1="${x-5}" y1="${y1}" x2="${x+5}" y2="${y1}"/><line class="dim-line" x1="${x-5}" y1="${y2}" x2="${x+5}" y2="${y2}"/>
  <text class="dim-text" x="${x+a}" y="${(y1+y2)/2}" text-anchor="middle"
    transform="rotate(-90 ${x+a} ${(y1+y2)/2})">${t}</text>`}

function cycleEdge(i){
  if(S.draw)return;
  const order=EDGEPROFILES[S.mat].map(p=>p[0]);
  const cur=S.form==='round'?S.edges[0]:S.edges[i];
  const next=order[(order.indexOf(cur)+1)%order.length];
  if(S.form==='round') S.edges=[next,next,next,next]; else S.edges[i]=next;
  syncEdgeChips();
  toast('Kante '+(S.form==='round'?'':('ABCD'[i]+' '))+'→ '+edgeLabel(next));
  render();
}
function syncEdgeChips(){
  const uniq=[...new Set(S.form==='round'?[S.edges[0]]:S.edges)];
  document.querySelectorAll('#edgeChips .kfg_chip').forEach(c=>
    c.classList.toggle('is-active',uniq.length===1&&c.dataset.edge===uniq[0]));
  $('edgeRadiusBlock').style.display=(S.edges.includes('rund')||S.edges.includes('halbrund'))?'block':'none';
}

/* ═══════ Detailansicht (Kanten-Foto) ═══════ */
function drawDetail(){
  const img=$('detailImg'); if(!img)return;
  const ph=edgePhoto(); img.src=ph.src;
  const c=calc(), m=MATERIALS[S.mat];
  const uniq=[...new Set((S.form==='round'?[S.edges[0]]:S.edges).map(edgeLabel))];
  const absNm=(ABS_STOCK.find(a=>a[0]===S.absColor)||[])[1];
  const absTxt=(S.mat==='dekor'&&S.absColor!=='dekor')?` · ABS ${absNm}`:'';
  $('detailLabel').innerHTML=`<b>${c.dekorName}</b>
    <span>${m.name}${S.mat==='mpx'&&S.mpxSurface==='hpl'?' + HPL':''} · ${c.thickName}</span>
    <span>Kante: ${uniq.join(' · ')}${absTxt}</span>
    ${cornerCount()>0?`<span>Ecken: ${cornerLabel()}</span>`:''}
    <em>${ph.ref?(ph.mm===25||!ph.mm?`Abbildung zeigt die Kante in 25 mm, unabhängig von der gewählten Stärke. Gefertigt wird in ${c.thickName}.`:`Abbildung zeigt eine ${ph.mm}-mm-Aufnahme dieses Dekors. Für dieses Dekor liegt noch keine 25-mm-Kantenaufnahme vor. Gefertigt wird in ${c.thickName}.`)
      :`Kantenfoto ${c.thickName}, Originalaufnahme aus der Fertigung.`}</em>`;
}

/* Rechteck-Pfad mit Radius je Ecke: r = [hinten links, hinten rechts, vorne rechts, vorne links] */
function roundPath(x,y,w,h,r){
  const [a,b,c,d]=r.map(v=>Math.max(0,v));
  let p=`M ${x+a} ${y} L ${x+w-b} ${y}`;
  if(b) p+=` A ${b} ${b} 0 0 1 ${x+w} ${y+b}`;
  p+=` L ${x+w} ${y+h-c}`;
  if(c) p+=` A ${c} ${c} 0 0 1 ${x+w-c} ${y+h}`;
  p+=` L ${x+d} ${y+h}`;
  if(d) p+=` A ${d} ${d} 0 0 1 ${x} ${y+h-d}`;
  p+=` L ${x} ${y+a}`;
  if(a) p+=` A ${a} ${a} 0 0 1 ${x+a} ${y}`;
  return p+' Z';
}
/* Polygon mit gerundeten Ecken — fuer die L-Form, deren Kontur kein Rechteck ist.
   r kann Zahl oder Array sein; konkave Ecken bekommen automatisch die andere
   Bogenrichtung, damit die Innenecke nicht nach aussen beult. */
function roundPoly(pts, r){
  const n=pts.length, rad=Array.isArray(r)?r:pts.map(()=>r);
  const seg=[];
  for(let i=0;i<n;i++){
    const p=pts[i], a=pts[(i-1+n)%n], b=pts[(i+1)%n];
    const v1=[a[0]-p[0],a[1]-p[1]], v2=[b[0]-p[0],b[1]-p[1]];
    const l1=Math.hypot(...v1)||1, l2=Math.hypot(...v2)||1;
    const rr=Math.min(rad[i]||0, l1/2, l2/2);
    const p1=[p[0]+v1[0]/l1*rr, p[1]+v1[1]/l1*rr];
    const p2=[p[0]+v2[0]/l2*rr, p[1]+v2[1]/l2*rr];
    const kreuz=v1[0]*v2[1]-v1[1]*v2[0];
    /* Im SVG-Koordinatensystem (y nach unten) und bei im Uhrzeigersinn
       angegebenen Punkten ist das Kreuzprodukt bei konvexen Ecken negativ. */
    seg.push({p1,p2,rr,sweep:kreuz<0?1:0});
  }
  let d=`M ${seg[0].p2}`;
  for(let i=1;i<=n;i++){
    const cur=seg[i%n];
    d+=` L ${cur.p1}`;
    if(cur.rr>0.5) d+=` A ${cur.rr} ${cur.rr} 0 0 ${cur.sweep} ${cur.p2}`;
    else d+=` L ${cur.p2}`;
  }
  return d+' Z';
}
/* Vier Kantensegmente; jedes startet/endet in der Mitte des jeweiligen Eckbogens */
function edgeSegments(x,y,w,h,r){
  const k=Math.SQRT1_2, [a,b,c,d]=r.map(v=>Math.max(0,v));
  const cen=[[x+a,y+a],[x+w-b,y+b],[x+w-c,y+h-c],[x+d,y+h-d]];
  const dir=[[-1,-1],[1,-1],[1,1],[-1,1]];
  const rad=[a,b,c,d];
  const mid=i=>rad[i]? [cen[i][0]+dir[i][0]*rad[i]*k, cen[i][1]+dir[i][1]*rad[i]*k]
                     : [i===0||i===3?x:x+w, i===0||i===1?y:y+h];
  /* Start-/Endpunkte der Geraden je Kante */
  const straight=[
    [[x+a,y],[x+w-b,y]],            /* A oben  */
    [[x+w,y+b],[x+w,y+h-c]],        /* B rechts*/
    [[x+w-c,y+h],[x+d,y+h]],        /* C unten */
    [[x,y+h-d],[x,y+a]]             /* D links */
  ];
  const arcTo=(i,pt)=>rad[i]?` A ${rad[i]} ${rad[i]} 0 0 1 ${pt}`:` L ${pt}`;
  const from=[0,1,2,3], to=[1,2,3,0];
  return [0,1,2,3].map(i=>{
    const s0=mid(from[i]), s1=straight[i][0], s2=straight[i][1], s3=mid(to[i]);
    return `M ${s0}${arcTo(from[i],s1)} L ${s2}${arcTo(to[i],s3)}`;
  });
}

/* ═══════ 3D (three.js, lazy) ═══════ */
let three={ready:false,failed:false,scene:null,cam:null,renderer:null,mesh:null,rotY:-0.5,rotX:0.45};
function ensure3D(cb){
  if(three.ready)return cb();
  if(three.failed)return;
  if(window.THREE)return init3D(cb);
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  s.onload=()=>init3D(cb);
  s.onerror=()=>{three.failed=true;toast('3D-Ansicht konnte nicht geladen werden');setView('2d')};
  document.head.appendChild(s);
}
function init3D(cb){
  const canvas=$('stage3d');
  three.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  three.renderer.outputEncoding=THREE.sRGBEncoding;      /* korrekter Farbraum — sonst überbelichtet */
  three.scene=new THREE.Scene();
  three.cam=new THREE.PerspectiveCamera(32,600/444,0.1,1000);
  three.cam.position.set(0,9,17); three.cam.lookAt(0,0,0);
  three.scene.add(new THREE.AmbientLight(0xffffff,0.62));
  const dl=new THREE.DirectionalLight(0xffffff,0.55); dl.position.set(6,12,8); three.scene.add(dl);
  /* Drag-Rotation */
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;
    three.rotY+=(e.clientX-drag[0])*0.008; three.rotX=Math.max(0.05,Math.min(1.35,three.rotX+(e.clientY-drag[1])*0.005));
    drag=[e.clientX,e.clientY]; frame3D();});
  canvas.addEventListener('pointerup',()=>drag=null);
  three.ready=true; cb();
}
/* Ausschnitte als echte Löcher in der 3D-Geometrie (2D-Koordinaten → Shape-Koordinaten) */
function addCutHoles(sh){
  const d=dims(), W=d.w/10, H=d.h/10;
  S.cuts.forEach(c2=>{
    if(c2.t==='k') return;                       /* Kanal hat eigene Geometrie */
    const xS=-W/2+c2.cx/10, yS=H/2-c2.cy/10, p=new THREE.Path();
    if(c2.t==='p'){
      const pa=polyAbs(c2).map(q=>[-W/2+q[0]/10, H/2-q[1]/10]);
      polyToShape(p, pa, pa.map(()=>Math.max(0,(c2.r||0))/100));
      sh.holes.push(p); return;
    }
    if(c2.t==='c'){ p.absarc(xS,yS,c2.d/20,0,Math.PI*2,true); }
    else { const hw=c2.w/20, hh=c2.h/20;
      p.moveTo(xS-hw,yS-hh); p.lineTo(xS+hw,yS-hh); p.lineTo(xS+hw,yS+hh); p.lineTo(xS-hw,yS+hh); p.closePath(); }
    sh.holes.push(p);
  });
}
function addPresetHoles(sh){
  if(S.form!=='rect')return;
  const Lc=+S.L, Bc=+S.B, W=Lc/10, H=Bc/10;
  const rect=(cx,cy,w,hh)=>{ const xS=-W/2+cx/10, yS=H/2-cy/10, p=new THREE.Path(), hw=w/20, hb=hh/20;
    p.moveTo(xS-hw,yS-hb); p.lineTo(xS+hw,yS-hb); p.lineTo(xS+hw,yS+hb); p.lineTo(xS-hw,yS+hb); p.closePath(); sh.holes.push(p); };
  if(S.extras.kabel){ const p=new THREE.Path(); p.absarc(0,H/2-(0.15*Bc)/10,0.3,0,Math.PI*2,true); sh.holes.push(p); }
  if(S.extras.usb) rect(Lc-8-13.25, 0.10*Bc+5, 26.5, 10);
  if(S.extras.spuele) rect(0.08*Lc+39, Bc/2, 78, 43);
  if(S.extras.induktion) rect(Lc-6-28, Bc/2, 56, 49);
}
/* Polygon in eine THREE.Shape uebertragen, Ecken nach Radius verrundet */
function polyToShape(sh, pts, rad){
  const n=pts.length;
  const t=pts.map((p,i)=>{
    const a=pts[(i-1+n)%n], b=pts[(i+1)%n];
    const v1=[a[0]-p[0],a[1]-p[1]], v2=[b[0]-p[0],b[1]-p[1]];
    const l1=Math.hypot(v1[0],v1[1])||1, l2=Math.hypot(v2[0],v2[1])||1;
    const r=Math.min(rad[i]||0, l1/2, l2/2);
    return { p, r, p1:[p[0]+v1[0]/l1*r, p[1]+v1[1]/l1*r], p2:[p[0]+v2[0]/l2*r, p[1]+v2[1]/l2*r] };
  });
  sh.moveTo(t[0].p2[0], t[0].p2[1]);
  for(let i=1;i<=n;i++){
    const c=t[i%n];
    sh.lineTo(c.p1[0], c.p1[1]);
    if(c.r>0.005) sh.quadraticCurveTo(c.p[0], c.p[1], c.p2[0], c.p2[1]);
    else sh.lineTo(c.p2[0], c.p2[1]);
  }
  sh.closePath();
}
function plateShape(){
  const d=dims(), w=d.w/10, h=d.h/10, sh=new THREE.Shape();
  if(S.form==='round'){ sh.absarc(0,0,w/2,0,Math.PI*2,false); return sh; }
  /* Radius je Ecke — gleiche Reihenfolge wie in der 2D-Draufsicht */
  const cap=Math.min(w/2,h/2);
  /* Die 3D-Geometrie wird beim Kippen um X gespiegelt: die Shape-Ecke oben links
     liegt in der Ansicht vorne links. Reihenfolge daher umgekehrt zur Draufsicht. */
  const RC=[3,2,1,0].map(i=>Math.min(cornerR(i)/100,cap));
  const x=-w/2,y=-h/2;
  const ra=RC[0], rb=RC[1], rc=RC[2], rd=RC[3];
  if(RC.some(v=>v>0.01)){
    sh.moveTo(x+ra,y);
    sh.lineTo(x+w-rb,y); if(rb) sh.quadraticCurveTo(x+w,y,x+w,y+rb);
    sh.lineTo(x+w,y+h-rc); if(rc) sh.quadraticCurveTo(x+w,y+h,x+w-rc,y+h);
    sh.lineTo(x+rd,y+h); if(rd) sh.quadraticCurveTo(x,y+h,x,y+h-rd);
    sh.lineTo(x,y+ra); if(ra) sh.quadraticCurveTo(x,y,x+ra,y);
  } else { sh.moveTo(x,y); sh.lineTo(x+w,y); sh.lineTo(x+w,y+h); sh.lineTo(x,y+h); sh.closePath(); }
  if(S.form==='lform'){
    const L2=S.lf.L/10,B2=S.lf.B/10,aw2=S.lf.aw/10,ah2=S.lf.ah/10,ri=(S.mat==='dekor'?0.5:0.1);
    const sh2=new THREE.Shape(), x2=-L2/2, y2=-B2/2;
    /* Aussenecken nach Wunsch, Innenecke mit dem Fertigungsradius */
    const ro=Math.min(cornerR(0)/100, L2/3, B2/3);
    polyToShape(sh2,
      [[x2,y2],[x2+L2,y2],[x2+L2,y2+B2-ah2],[x2+L2-aw2,y2+B2-ah2],[x2+L2-aw2,y2+B2],[x2,y2+B2]],
      [ro,ro,ro,ri,ro,ro]);
    addCutHoles(sh2);
    return sh2;
  }
  if(S.form==='szwal'){
    const cw=S.sw.c/10, ch=1.8, hx=-cw/2, hy=y+0.0; /* Ausschnitt an der Vorderkante (y-) mit 0,6 Randsteg */
    const hole=new THREE.Path();
    const hy0=y+0.6;
    hole.moveTo(hx,hy0); hole.lineTo(hx+cw,hy0); hole.lineTo(hx+cw,hy0+ch); hole.lineTo(hx,hy0+ch); hole.closePath();
    sh.holes.push(hole);
  }
  addCutHoles(sh);
  return sh;
}
function plyTexture(){
  const c=document.createElement('canvas'); c.width=64; c.height=64;
  const g=c.getContext('2d'); g.fillStyle='#e7d9ba'; g.fillRect(0,0,64,64);
  g.fillStyle='#c9b48b'; const n=+S.thick>30?12:7;
  for(let i=0;i<n;i++) g.fillRect(0,Math.round(i*64/n),64,2);
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t;
}
/* Kabelkanaele in 3D: je Abschnitt ein flacher Quader auf der Ober- oder
   Unterseite. Eine echte Tasche in der Extrusion waere aufwendig und bringt
   optisch nichts — der Quader liest sich beim Drehen genauso als Nut. */
function kanal3D(depth){
  const kanaele=S.cuts.filter(c=>c.t==='k');
  if(!kanaele.length||S.form==='round') return null;
  const d=dims(), W=d.w/10, H=d.h/10;
  const g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:0x1a1714, roughness:1});
  kanaele.forEach(c=>{
    const q=kanalPunkte(c), bw=Math.max(0.01,(c.w||60)/100), bt=Math.max(0.01,(c.dp||10)/100);
    /* Nach rotateX + translate liegt die Platte zwischen y=depth (unten) und
       y=2*depth (oben) — nicht zwischen 0 und depth. Die Nut wird minimal
       ueber die jeweilige Flaeche gelegt, sonst gewinnt der Tiefenpuffer und
       man sieht gar nichts. */
    const yF=c.seite==='oben' ? 2*depth-bt/2+0.004 : depth+bt/2-0.004;
    for(let i=0;i<q.length-1;i++){
      const ax=q[i][0]/10-W/2, az=q[i][1]/10-H/2;
      const bx=q[i+1][0]/10-W/2, bz=q[i+1][1]/10-H/2;
      const len=Math.hypot(bx-ax,bz-az); if(len<0.001) continue;
      const m=new THREE.Mesh(new THREE.BoxGeometry(len,bt,bw),mat);
      m.position.set((ax+bx)/2, yF, (az+bz)/2);
      m.rotation.y=-Math.atan2(bz-az, bx-ax);
      g.add(m);
    }
    /* Ecken auffuellen, sonst klafft an jedem Knick ein Keil */
    for(let i=1;i<q.length-1;i++){
      const m=new THREE.Mesh(new THREE.BoxGeometry(bw,bt,bw),mat);
      m.position.set(q[i][0]/10-W/2, yF, q[i][1]/10-H/2);
      g.add(m);
    }
  });
  return g;
}
function draw3D(){
  ensure3D(()=>{
    if(three.mesh){three.scene.remove(three.mesh);three.mesh.geometry.dispose();}
    if(three.kanal){three.scene.remove(three.kanal);three.kanal=null;}
    const depth=(+S.thick)/100;
    const geo=new THREE.ExtrudeGeometry(plateShape(),{depth,bevelEnabled:false,curveSegments:48});
    /* UV-Fix: Deckflächen sauber [0..1] gemappt, Proportionen über max(B,T) — kein Kacheln, kein Zerren */
    { const d2=dims(), M=Math.max(d2.w,d2.h)/10;
      const pos=geo.attributes.position, uv=geo.attributes.uv;
      for(let i=0;i<uv.count;i++) uv.setXY(i, pos.getX(i)/M+0.5, pos.getY(i)/M+0.5);
      uv.needsUpdate=true; }
    geo.rotateX(-Math.PI/2); geo.translate(0,depth,0);
    const key=texKey();
    let topMat;
    if(isLack()) topMat=new THREE.MeshStandardMaterial({color:0xdcd9d2,roughness:.5});
    else{
      const t=new THREE.TextureLoader().load(TEX[key],frame3D);
      t.encoding=THREE.sRGBEncoding;
      t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping; t.anisotropy=8;
      topMat=new THREE.MeshStandardMaterial({map:t,roughness:.65});
    }
    let sideMat;
    if(S.mat==='mpx') sideMat=new THREE.MeshStandardMaterial({map:plyTexture(),roughness:.8});
    else if(S.mat==='compact') sideMat=new THREE.MeshStandardMaterial({color:0x241f1b,roughness:.6});
    else{
      const col=S.absColor!=='dekor'?ABS_COL[S.absColor]:(FLAT[S.dekor]||'#c9b48b');
      sideMat=new THREE.MeshStandardMaterial({color:new THREE.Color(col),roughness:.55});
    }
    three.mesh=new THREE.Mesh(geo,[topMat,sideMat]);
    three.scene.add(three.mesh);
    three.kanal=kanal3D(depth);
    if(three.kanal) three.scene.add(three.kanal);
    const d=dims(), maxd=Math.max(d.w,d.h)/10;
    three.cam.position.set(0, maxd*0.9, maxd*1.55); three.cam.lookAt(0,0,0);
    frame3D();
  });
}
function frame3D(){
  if(!three.ready||!three.mesh)return;
  const canvas=$('stage3d');
  if(canvas.clientWidth&&(canvas.width!==canvas.clientWidth)){canvas.width=canvas.clientWidth;canvas.height=canvas.clientHeight;
    three.renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
    three.cam.aspect=canvas.clientWidth/canvas.clientHeight;three.cam.updateProjectionMatrix();}
  three.mesh.rotation.y=three.rotY;
  three.mesh.rotation.x=0; three.scene.rotation.x=three.rotX-0.45;
  three.renderer.render(three.scene,three.cam);
}
function setView(v){
  S.view=v;
  $('btn2d').classList.toggle('is-active',v==='2d');
  $('btn3d').classList.toggle('is-active',v==='3d');
  $('stage').style.display=v==='2d'?'block':'none';
  $('stage3d').style.display=v==='3d'?'block':'none';
  $('previewHint').textContent=v==='2d'?'Draufsicht, maßstabsgetreu · Kanten anklickbar':'3D-Ansicht · ziehen zum Drehen';
  if(v==='3d') draw3D();
}

/* ═══════ UI-Aufbau ═══════ */
function buildMats(){
  $('matGrid').innerHTML=Object.entries(MATERIALS).map(([k,m])=>
    `<button class="kfg_mat${k===S.mat?' is-active':''}" data-m="${k}"><b>${m.name}</b><small>${m.sub}</small></button>`).join('');
  $('matGrid').querySelectorAll('.kfg_mat').forEach(b=>b.addEventListener('click',()=>{
    S.mat=b.dataset.m; S.thick=MATERIALS[S.mat].def;
    if(S.mat==='mpx'){S.mpxSurface='natur';S.dekor='sperrholz-natur';}
    else if(!MATERIALS[S.mat].dekore.some(d=>d[0]===S.dekor)) S.dekor=MATERIALS[S.mat].dekore[0][0];
    const be=baseEdge(); S.edges=[be,be,be,be];
    S.cornerR=S.cornerR.map(r=>clampCorner(r)); S.corner=cornerMax();
    clampDims(); buildAll(); render();
  }));
}
const DEKOR_ALIAS = { 'eiche-kamienny':'hikora', 'asche-grau':'szary' };   /* zusammengefuehrte Dekore */
function ensureDekor(){
  /* Schutz: haelt S.dekor immer innerhalb der aktuell gueltigen Liste.
     Vorher konnte der angezeigte Dekorname vom markierten Swatch abweichen. */
  if(DEKOR_ALIAS[S.dekor]) S.dekor=DEKOR_ALIAS[S.dekor];
  const l=dekorList(); if(!l.length) return;
  if(!l.some(x=>x[0]===S.dekor)) S.dekor=l[0][0];
}
function buildDekore(){
  ensureDekor();
  const list=dekorList();
  $('dekorGrid').innerHTML=list.map(([k,n])=>
    `<button class="kfg_dekor${k===S.dekor?' is-active':''}" data-d="${k}" title="${n}"><span class="sw" style="background-image:url(${TEX[k]})"></span><span>${n}</span></button>`).join('');
  $('dekorGrid').querySelectorAll('.kfg_dekor').forEach(b=>b.addEventListener('click',()=>{
    S.dekor=b.dataset.d; buildDekore(); render();
  }));
  $('mpxSurfaceBlock').style.display=S.mat==='mpx'?'block':'none';
  const dn=$('dekorNote'); if(dn) dn.textContent = (S.mat==='mpx'&&S.mpxSurface==='hpl')
    ? 'Auf Multiplex lässt sich jedes Laminat unserer Möbelplatten-Palette aufkleben, die Kante bleibt sichtbare Birkenschicht.'
    : 'Original-Produktfotos aus dem Kessler-Archiv. Farbige ABS-Kanten sind für 18 und 25 mm verfügbar.';
  $('absColorBlock').style.display=S.mat==='dekor'?'block':'none';
}
function buildThick(){
  $('thickChips').innerHTML=MATERIALS[S.mat].thick.map(([v,lab])=>
    `<button class="kfg_chip${v===S.thick?' is-active':''}" data-t="${v}">${lab}</button>`).join('');
  $('thickChips').querySelectorAll('.kfg_chip').forEach(b=>b.addEventListener('click',()=>{
    S.thick=b.dataset.t; buildThick(); buildAbs(); render();
  }));
}
function buildAbs(){
  const el=$('absChips'); if(!el)return;
  const limited=!(S.thick==='18'||S.thick==='25');
  if(limited&&ABS_LIMITED.includes(S.absColor)) S.absColor='dekor';
  el.innerHTML=ABS_STOCK.filter(([k])=>!(limited&&ABS_LIMITED.includes(k))).map(([k,n,note])=>
    `<button class="kfg_chip${S.absColor===k?' is-active':''}" data-abs="${k}">${
      k==='dekor'?'':`<span style="width:14px;height:14px;border-radius:3px;display:inline-block;background:${ABS_COL[k]};border:1px solid #00000022"></span>`
    }${n}${note?` <small>${note}</small>`:''}</button>`).join('');
  el.querySelectorAll('.kfg_chip').forEach(b=>b.addEventListener('click',()=>{
    S.absColor=b.dataset.abs; buildAbs(); render();
  }));
}
function buildEdges(){
  $('edgeChips').innerHTML=EDGEPROFILES[S.mat].map(p=>
    `<button class="kfg_chip${S.edges.every(e=>e===p[0])?' is-active':''}" data-edge="${p[0]}">${p[1]} <small>${p[3]}</small></button>`).join('');
  $('edgeChips').querySelectorAll('.kfg_chip').forEach(b=>b.addEventListener('click',()=>{
    const p=b.dataset.edge; S.edges=[p,p,p,p]; syncEdgeChips(); render();
  }));
  $('mpxNote').style.display=S.mat==='mpx'?'block':'none';
  const tip=$('edgeTip'); if(tip) tip.style.display=EDGEPROFILES[S.mat].length>1?'flex':'none';
  syncEdgeChips();
}
function buildCorner(){
  const r=rules();
  const opts=r.minCorner>0?[[0,'Eckig','Standard'],[30,'R30',''],[50,'R50',''],[100,'R100','']]
                          :[[0,'Eckig','Standard'],[3,'R3',''],[10,'R10',''],[30,'R30','']];
  $('cornerChips').innerHTML=opts.map(([v,l,s])=>
    `<button class="kfg_chip${[0,1,2,3].every(i=>cornerR(i)===v)?' is-active':''}" data-c="${v}">${l}${s?` <small>${s}</small>`:''}</button>`).join('');
  $('cornerChips').querySelectorAll('.kfg_chip').forEach(b=>b.addEventListener('click',()=>{
    setAllCorners(+b.dataset.c);
    buildCorner(); render();
  }));
  buildCornerSel();
  const note=$('cornerRule');
  const lformNote = S.form==='lform'
    ? 'L-Form: der Radius gilt für alle Außenecken. Die Innenecke wird nach Fertigungsregel automatisch verrundet.'
    : '';
  const txt=[lformNote, r.minCorner>0?r.cornerNote:''].filter(Boolean).join(' ');
  note.style.display=txt?'block':'none';
  note.textContent=txt;
}
/* Kleines Icon: Quadrat, bei dem genau die gemeinte Ecke gerundet ist */
function radiusField(i,val,on){
  return `<label class="kfg_radcell${on?' is-on':''}">`
    +cornerIcon(i,on)
    +`<input type="number" inputmode="numeric" min="0" max="300" step="1" value="${val}" data-cr="${i}"
       aria-label="Radius ${CORNER_NAMES[i]}"><span class="u">mm</span></label>`;
}
function cornerIcon(i,on){
  /* Das Icon zeigt IMMER die gemeinte Ecke gerundet — gefuellt = ausgewaehlt.
     (Vorher war die Rundung nur bei Auswahl zu sehen, damit sahen alle
      abgewaehlten Ecken gleich aus.) */
  const p=roundPath(2,2,16,16,[0,1,2,3].map(k=>k===i?7:0));
  return `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" style="vertical-align:-4px;margin-right:6px;flex:0 0 auto">`
    +`<path d="${p}" fill="${on?'#1E1E1E':'#FFFFFF'}" stroke="#1E1E1E" stroke-width="1.7"/></svg>`;
}
function buildCornerSel(){
  const box=$('cornerSelBlock'), el=$('cornerSel'); if(!box||!el) return;
  const show=cornerFieldsVisible();
  box.style.display=show?'block':'none';
  if(!show) return;
  const all=cornerMax(), gleich=[0,1,2,3].every(i=>cornerR(i)===all);
  /* Kopfzeile = verknuepfter Wert fuer alle vier Ecken, darunter die 2x2-Felder
     in derselben Anordnung wie auf der Platte (Draufsicht). */
  el.innerHTML=`<label class="kfg_radall${gleich?' is-linked':''}">`
      +`<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="${roundPath(2,2,16,16,[6,6,6,6])}" fill="none" stroke="#1E1E1E" stroke-width="1.7"/></svg>`
      +`<input type="number" inputmode="numeric" min="0" max="300" step="1" value="${gleich?all:''}" placeholder="—" data-cr="all" aria-label="Radius alle Ecken"><span class="u">mm</span>`
      +`<em>${gleich?'alle Ecken':'gemischt'}</em></label>`
    /* Anordnung wie auf der Platte: oben hinten links|rechts, unten vorne links|rechts.
       Die Datenreihenfolge laeuft im Uhrzeigersinn (…,vorne rechts,vorne links),
       fuer die Anzeige werden die unteren beiden daher getauscht. */
    +`<div class="kfg_radquad">`+[0,1,3,2].map(i=>radiusField(i,cornerR(i),cornerR(i)>0)).join('')+`</div>`;
  el.querySelectorAll('input[data-cr]').forEach(inp=>{
    const apply=()=>{
      const v=+inp.value||0;
      if(inp.dataset.cr==='all') setAllCorners(v);
      else { S.cornerR[+inp.dataset.cr]=clampCorner(v); S.corner=cornerMax(); }
      buildCorner(); render();
    };
    inp.addEventListener('change',apply);
    inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); apply(); }});
  });
}
function buildQuick(){
  if(S.form==='szwal'||S.form==='lform'){$('quickBlock').style.display='none';$('massHint').textContent='CNC-Fertigung nach Maß';return;}
  $('quickBlock').style.display='block';
  const sizes=shopSizes();
  const list=S.form==='rect'
    ? sizes.map(s=>({t:s.l+'×'+s.b,l:s.l,b:s.b,act:+S.L===s.l&&+S.B===s.b}))
    : sizes.map(s=>({t:'Ø'+s.d,d:s.d,act:+S.D===s.d}));
  if(!list.length){ $('quickChips').innerHTML=''; $('quickBlock').style.display='none';
    $('massHint').textContent='Fertigung nach Maß'; return; }
  $('quickBlock').style.display='block';
  $('quickChips').innerHTML=list.map((c,i)=>`<button class="kfg_quick-chip${c.act?' is-active':''}" data-i="${i}">${c.t}</button>`).join('');
  $('quickChips').querySelectorAll('.kfg_quick-chip').forEach(b=>b.addEventListener('click',()=>{
    const c=list[+b.dataset.i];
    if(S.form==='rect'){S.L=c.l;S.B=c.b;$('inL').value=c.l;$('inB').value=c.b;}
    else {S.D=c.d;$('inD').value=c.d;}
    render();
  }));
  $('massHint').textContent=`${list.length} ${list.length===1?'Größe':'Größen'} ab Lager`;
}
function buildAll(){ buildMats(); buildDekore(); buildThick(); buildAbs(); buildEdges(); buildCorner(); }

function clampDims(){
  const r=rules();
  if(+S.L>r.maxL){S.L=r.maxL;$('inL').value=S.L;}
  if(+S.B>r.maxB){S.B=r.maxB;$('inB').value=S.B;}
  if(+S.D>r.maxD){S.D=r.maxD;$('inD').value=S.D;}
}

/* ═══════ Render ═══════ */
function validate(){
  const r=rules(); let ok=true;
  const chk=(fid,eid,rid,v,min,max)=>{
    $(rid).textContent=`${min} bis ${max} cm`;
    $(eid).textContent=`Bitte ${min} bis ${max} cm eingeben`;
    const bad=!(v>=min&&v<=max); $(fid).classList.toggle('is-error',bad); if(bad)ok=false;
  };
  if(S.form==='rect'){ chk('fL','errL','rangeL',+S.L,10,r.maxL); chk('fB','errB','rangeB',+S.B,10,r.maxB); }
  else if(S.form==='round') chk('fD','errD','rangeD',+S.D,10,r.maxD);
  else if(S.form==='lform'){
    chk('fLL','errLL','rangeLL',+S.lf.L,10,r.maxL); chk('fLB','errLB','rangeLB',+S.lf.B,10,r.maxB);
    chk('fAW','errAW','rangeAW',+S.lf.aw,10,Math.max(10,+S.lf.L-10)); chk('fAH','errAH','rangeAH',+S.lf.ah,10,Math.max(10,+S.lf.B-10));
  }
  /* Radius-Regel Möbelplatte */
  if(S.form==='rect'&&S.mat==='dekor'&&cornerCount()>0&&cornerMax()<r.minCorner){
    S.cornerR=S.cornerR.map(v=>v>0?r.minCorner:0); S.corner=cornerMax();
    toast('Möbelplatte: Außenradius mind. R30, angepasst'); buildCorner();
  }
  return ok;
}
function render(){
  if(!validate())return;
  clampCuts();          /* zuerst begrenzen, dann anzeigen — sonst zeigt die
                           Liste noch die alten, zu grossen Werte an */
  const std=isStandard(), offer=needsOffer(), c=calc();
  $('badge').classList.toggle('is-sonder',!std);
  /* Seit v1.7.0 haben auch freie Ausschnitte, Ausklinkungen und Konturen einen
     festen Preis nach Formel — nur eigene Skizze, Kabelkanal und Lack sind noch
     Angebotssache. Das Etikett sagt das jetzt auch. */
  $('badgeText').textContent=std?'Ab Lager · lieferbar in 3 bis 5 Tagen'
    :(offer?'Individuelle Fertigung · Angebot in 24 h':'CNC-Fertigung · Preis steht fest');
  const pv=offer?fmt(c.total)+' +':fmt(c.total);
  $('price').textContent=pv; $('priceBar').textContent=pv;
  $('priceLabel').textContent=std?'Dein Preis':(offer?'Preis ab (zzgl. Sonderarbeiten)':'Dein Preis');
  if(std){$('delivDate').textContent='Versand bis '+delivDate();$('delivSub').textContent='DHL, ab Lager';$('delivBar').textContent='Versand bis '+delivDate();}
  else {$('delivDate').textContent='Angebot in 24 h';$('delivSub').textContent='Versandkosten im Angebot';$('delivBar').textContent='Fertigung · Angebot in 24 h';}
  const t=std?'In den Warenkorb':'Unverbindlich anfragen';
  $('cta').textContent=t;$('ctaBar').textContent=t;
  $('cta').classList.toggle('is-sonder',!std);$('ctaBar').classList.toggle('is-sonder',!std);
  const sur=S.mat==='mpx'?{natur:' · natur',hpl:' + HPL',lack:' · klarlackiert'}[S.mpxSurface]:'';
  const hit=shopHit();
  const rows=[[hit
    ? `${MATERIALS[S.mat].name}${sur} · ${c.dekorName} · ${c.thickName} · Lagerartikel ${hit[2]||''}`
    : `${MATERIALS[S.mat].name}${sur} · ${c.dekorName} · ${c.thickName} (${Math.round(areaM2()*100)/100} m² × ${rateZl()} zł)`, c.basis]];
  if(c.kante>0)rows.push([`Kantenbearbeitung`,c.kante]);
  if(c.ecken>0){
    const uniq=[...new Set([0,1,2,3].map(cornerR).filter(r=>r>0))];
    rows.push([uniq.length===1
      ? `Eckenrundung R${uniq[0]} (${cornerCount()}× à ${fmt(cornerPriceFor(uniq[0]))})`
      : `Eckenrundung ${[0,1,2,3].filter(i=>cornerR(i)>0).map(i=>'R'+cornerR(i)).join(' · ')}`, c.ecken]);
  }
  /* Presets in einer Zeile, jede freie Bearbeitung mit eigenem Preis darunter */
  const summePreset=(S.extras.bohr?X_PRICE.bohr:0)
    + S.cuts.filter(c2=>c2.preset).reduce((a,c2)=>a+cutPrice(c2),0);
  if(summePreset>0){
    const parts=[]; if(S.extras.bohr)parts.push('Montagebohrungen');
    Object.keys(PRESETS).forEach(k=>{const n=presetCount(k); if(n)parts.push((n>1?n+'× ':'')+PRESETS[k].label);});
    rows.push([parts.join(', '),summePreset]);
  }
  S.cuts.filter(c2=>!c2.preset).forEach(c2=>rows.push([cutTypName(c2)+' '+cutMass(c2), cutPrice(c2)]));
  if(S.extras.custom||isLack())rows.push([isLack()?'Klarlack-Lackierung':'Eigenes Bohrbild','im Angebot']);
  buildCutList();
  syncPresets();
  $('breakdown').innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${typeof r[1]==='number'?fmt(r[1]):r[1]}</td></tr>`).join('')
    +`<tr class="total"><td>Gesamt inkl. MwSt.</td><td>${pv}</td></tr>`;
  buildQuick(); drawStage(); updateMini(); updateSticky(); updateBottomBar(); buildCounts(); buildConf(); buildBarWhat(); syncURL();
}
/* Geteilte Links wiederherstellen — syncURL schreibt den Zustand in den Hash,
   bisher hat ihn aber niemand gelesen: "Konfiguration teilen" fuehrte zur Standard-
   konfiguration. Wird einmalig vor dem ersten Aufbau aufgerufen. */
function restoreFromHash(){
  const h=location.hash||''; if(h.length<4) return;
  let p; try{ p=new URLSearchParams(h.slice(1)); }catch(e){ return; }
  const g=k=>p.get(k), num=(k,min,max)=>{const v=+g(k); return isFinite(v)&&v>=min&&v<=max?v:null;};
  if(g('m')&&MATERIALS[g('m')]) S.mat=g('m');
  if(['natur','hpl','lack'].indexOf(g('sf'))>=0) S.mpxSurface=g('sf');
  if(g('d')) S.dekor=g('d');
  if(['rect','round','lform','szwal'].indexOf(g('f'))>=0) S.form=g('f');
  if(g('t')&&MATERIALS[S.mat].thick.some(t=>t[0]===g('t'))) S.thick=g('t');
  const c=num('c',0,300); if(c!==null) S.corner=c;
  if(/^\d{1,3}(-\d{1,3}){3}$/.test(g('cr')||'')) S.cornerR=g('cr').split('-').map(v=>clampCorner(+v));
  else if(/^[01]{4}$/.test(g('cs')||'')) S.cornerR=g('cs').split('').map(v=>v==='1'?clampCorner(S.corner):0);  /* Alt-Links */
  else if(S.corner>0) setAllCorners(S.corner);
  S.corner=cornerMax();
  const er=num('er',1,20); if(er!==null) S.edgeR=er;
  if(g('ac')&&ABS_STOCK.some(a=>a[0]===g('ac'))) S.absColor=g('ac');
  const L=num('l',10,300), B=num('b',10,300), D=num('dm',10,300);
  if(L!==null) S.L=L; if(B!==null) S.B=B; if(D!==null) S.D=D;
  const sw=num('sw',10,300), sd=num('sd',10,300), sc2=num('sc',10,300);
  if(sw!==null) S.sw.w=sw; if(sd!==null) S.sw.d=sd; if(sc2!==null) S.sw.c=sc2;
  const e=(g('e')||'').split(','); if(e.length===4) S.edges=e;
  ensureDekor();
  ['inL','inB','inD'].forEach((id,i)=>{const el=$(id); if(el) el.value=[S.L,S.B,S.D][i];});
}
/* ── Zähler am Schritt-Kopf + Konfigurations-Chips über dem CTA ───────────── */
function extrasList(){
  const out=[];
  if(S.extras.bohr) out.push({t:'Montagebohrungen 4× Ø8', s:5});
  Object.keys(PRESETS).forEach(k=>{ const n=presetCount(k); if(n) out.push({t:(n>1?n+'× ':'')+PRESETS[k].label, s:5}); });
  /* Freie Bearbeitungen einzeln nennen — sie haben jetzt einen festen Preis
     und sind damit kein Angebotsgrund mehr (kein warn-Flag). */
  S.cuts.filter(c=>!c.preset).forEach(c=>out.push({t:cutTypName(c)+' '+cutMass(c), s:5}));
  if(S.extras.custom) out.push({t:'Eigenes Bohrbild', s:5, warn:true});
  return out;
}
function buildCounts(){
  const c=calc(), d=dims(), ex=extrasList();
  const set=(id,txt,leer)=>{ const el=$(id); if(!el) return;
    el.textContent=txt; el.classList.toggle('is-empty',!!leer); };
  set('k1', `${MATERIALS[S.mat].name.split(' ')[0]} · ${c.dekorName}`);
  set('k2', S.form==='rect'
      ? (cornerCount()>0?`Rechteck · ${cornerCount()}× rund`:'Rechteck')
      : {round:'Rund',lform:'L-Form',szwal:'Nähmaschinen-Platte'}[S.form]);
  set('k3', S.form==='round'?`Ø ${S.D} cm`:`${d.w} × ${d.h} cm`);
  const prof=[...new Set((S.form==='round'?[S.edges[0]]:S.edges).map(e=>profileOf(e)[1]))];
  set('k4', `${c.thickName} · ${prof.length===1?prof[0]:'Kanten gemischt'}`);
  set('k5', ex.length?`${ex.length} gewählt`:'optional', !ex.length);
}
/* Kurzfassung der Konfiguration fuer die feste Leiste. Bewusst zwei Zeilen:
   oben WAS (Material und Dekor), unten WIE (Form, Mass, Staerke) — mehr passt
   nicht in eine Leiste, ohne dass sie unruhig wird. */
function buildBarWhat(){
  const t=$('barTitle'), sp=$('barSpec'), th=$('barThumb');
  if(!t||!sp) return;
  const c=calc(), d=dims();
  t.textContent = `${MATERIALS[S.mat].name}${S.mat==='mpx'&&S.mpxSurface==='hpl'?' + HPL':''} · ${c.dekorName}`;
  const mass = S.form==='round' ? `Ø ${S.D} cm`
             : S.form==='rect'  ? `${d.w} × ${d.h} cm`
             : S.form==='lform' ? `L-Form ${S.lf.L} × ${S.lf.B} cm`
                                : `${S.sw.w} × ${S.sw.d} cm`;
  const teile=[mass, c.thickName];
  const ex=extrasList();
  if(ex.length) teile.push(ex.length===1?'1 Bearbeitung':`${ex.length} Bearbeitungen`);
  sp.textContent = teile.join(' · ');
  if(th){
    const tex=TEX[texKey()];
    th.style.backgroundImage = tex ? `url(${tex})` : '';
    th.classList.toggle('is-round', S.form==='round');
  }
}
function buildConf(){
  const box=$('confChips'); if(!box) return;
  const c=calc(), d=dims(), hit=shopHit();
  const items=[
    {t:`${MATERIALS[S.mat].name}${S.mat==='mpx'&&S.mpxSurface==='hpl'?' + HPL':''} · ${c.dekorName}`, s:1},
    {t:c.thickName, s:1},
    {t:S.form==='round'?`Rund Ø ${S.D} cm`
      :S.form==='rect'?`Rechteck ${d.w} × ${d.h} cm`
      :S.form==='lform'?`L-Form ${S.lf.L} × ${S.lf.B} cm`:`Nähmaschinen-Platte ${S.sw.w} × ${S.sw.d} cm`,
     s:3, warn:!hit&&(S.form==='rect'||S.form==='round')},
  ];
  const prof=[...new Set((S.form==='round'?[S.edges[0]]:S.edges).map(edgeLabel))];
  items.push({t:prof.length===1?prof[0]:'Kanten je Seite', s:4});
  if(S.mat==='dekor'&&S.absColor!=='dekor')
    items.push({t:`ABS ${(ABS_STOCK.find(a=>a[0]===S.absColor)||[])[1]}`, s:4});
  if(cornerCount()>0) items.push({t:`Ecken ${cornerLabel()}`, s:2});
  extrasList().forEach(e=>items.push(e));
  box.innerHTML=items.map(i=>
    `<button class="kfg_conf-chip${i.warn?' is-warn':''}" data-step="${i.s}">${i.t}</button>`).join('');
  box.querySelectorAll('.kfg_conf-chip').forEach(b=>b.addEventListener('click',()=>{
    const el=$('kfgStep'+b.dataset.step); if(!el) return;
    el.dataset.manual='1'; stepOffen(+b.dataset.step,true);   /* sonst springt man auf eine zugeklappte Karte */
    el.scrollIntoView({behavior:'smooth',block:'center'});
    el.classList.add('is-flash'); setTimeout(()=>el.classList.remove('is-flash'),900);
  }));
}
/* ── Bearbeitungsliste: jede Position mit exakten mm-Feldern ─────────────────
   Ziehen in der Vorschau und Tippen in den Feldern schreiben in dieselben
   Werte; nach dem Ziehen werden die Felder neu gezeichnet und umgekehrt. */
function feld(lbl, f, val, unit, extra){
  return `<label>${lbl}<span class="in"><input type="number" inputmode="numeric" data-f="${f}"
    value="${Math.round(val)}" ${extra||''}><i>${unit}</i></span></label>`;
}
function buildCutList(){
  const box=$('cutList'); if(!box) return;
  const d=dims();
  box.innerHTML=S.cuts.map((c,i)=>{
    const warn=cutWarn(c);
    const ic={r:'▭',c:'◯',p:'⬠',k:'⤳'}[c.t]||'▭';
    let f='';
    if(c.t==='c') f+=feld('Durchmesser','d',c.d*10,'mm','min="10"');
    else if(c.t==='r'){ f+=feld('Breite','w',c.w*10,'mm','min="30"')+feld('Höhe','h',c.h*10,'mm','min="30"'); }
    else if(c.t==='k'){
      f+=`<label>Richtung<span class="in"><select data-f="dir">`+
         [['laengs','längs (links → rechts)'],['quer','quer (hinten → vorne)']]
           .map(o=>`<option value="${o[0]}"${(c.dir||'laengs')===o[0]?' selected':''}>${o[1]}</option>`).join('')+
         `</select></span></label>`;
      f+=feld('Länge','len',c.len*10,'mm','min="50"');
      f+=feld('Kanalbreite','w',c.w,'mm','min="20" max="200"')+feld('Frästiefe','dp',c.dp,'mm','min="3"');
      f+=`<label>Seite<span class="in"><select data-f="seite">`+
         [['unten','Unterseite'],['oben','Oberseite']]
           .map(o=>`<option value="${o[0]}"${c.seite===o[0]?' selected':''}>${o[1]}</option>`).join('')+
         `</select></span></label>`;
      f+=`<label class="breit">Enden<span class="in"><select data-f="enden">`+
         Object.keys(KANAL_ENDEN).map(k=>`<option value="${k}"${(c.enden||'zu')===k?' selected':''}>${KANAL_ENDEN[k]}</option>`).join('')+
         `</select></span></label>`;
    }
    if(c.t==='r'||c.t==='p') f+=feld('Radius','r',c.r||0,'mm','min="0" max="200"');
    f+=feld('X ab links','cx',c.cx*10,'mm','min="0"')+feld('Y ab hinten','cy',c.cy*10,'mm','min="0"');
    if(c.t==='k') f=`<span class="kfg_cutlen">Länge ${Math.round(cutLen(c))} cm · ${fmt(kanalLfmPreis(c.w,c.dp))} je lfm</span>`+f;
    return `<div class="kfg_cutrow${warn?' is-warn':''}" data-i="${i}">
      <div class="kfg_cutrow-head"><span class="ic">${ic}</span><b>${cutTypName(c)}</b>
        <span class="pr">+ ${fmt(cutPrice(c))}</span>
        <button class="del" data-del="${i}" aria-label="Entfernen">×</button></div>
      <div class="kfg_cutrow-fields">${f}</div>
      ${warn?`<span class="kfg_cutwarn">${warn}</span>`:''}
    </div>`;
  }).join('');
  box.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{
    S.cuts.splice(+b.dataset.del,1); render();
  }));
  box.querySelectorAll('.kfg_cutrow').forEach(row=>{
    const c=S.cuts[+row.dataset.i]; if(!c) return;
    const uebernehmen=(el)=>{
      const f=el.dataset.f, v=+el.value;
      if(f==='seite'){ c.seite=el.value; }
      else if(f==='dir'){ c.dir=el.value; }
      else if(f==='enden'){ c.enden=el.value; }
      else if(c.t==='k'&&f==='len'){ c.len=Math.max(5,v/10); }
      else if(c.t==='k'&&f==='w'){ c.w=Math.max(20,Math.min(200,v)); }
      else if(c.t==='k'&&f==='dp'){ c.dp=Math.max(3,Math.min(maxTiefe(),v)); }
      else if(f==='r'){ c.r=Math.max(0,Math.min(200,v)); }
      else if(f==='d'){ c.d=Math.max(1,v/10); c.w=c.d; c.h=c.d; }
      else if(f==='a'){ c.a=Math.max(0,v/10); }
      else { c[f]=Math.max(0.1,v/10); }
      {
        const bx=cutBox(c);
        c.cx=Math.max(bx.w/2,Math.min(Math.max(bx.w/2,d.w-bx.w/2),c.cx));
        c.cy=Math.max(bx.h/2,Math.min(Math.max(bx.h/2,d.h-bx.h/2),c.cy));
      }
      render();
    };
    row.querySelectorAll('input').forEach(el=>{
      let t; el.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>uebernehmen(el),400);});
      el.addEventListener('change',()=>{clearTimeout(t);uebernehmen(el);});
    });
    row.querySelectorAll('select').forEach(el=>el.addEventListener('change',()=>uebernehmen(el)));
  });
}
/* ── Schritte auf- und zuklappen ─────────────────────────────────────────────
   Zugeklappt bleibt die Kopfzeile sichtbar; die Zusammenfassung darin (k1…k5)
   sagt, was gewaehlt ist. Nach einer Auswahl klappt der Schritt zu und der
   naechste auf — wer einen Schritt selbst anfasst, behaelt ihn offen. */
/* Selektoren bewusst OHNE Elternteil: die Chip-Reihen werden beim Klick neu
   gebaut, das geklickte Element ist beim Hochblubbern also schon aus dem DOM
   geloest — ein Selektor wie '#dekorGrid button' greift dann nicht mehr. */
const STEP_TRIGGER={           /* was als "entschieden" zaehlt */
  1:'.kfg_mat, .kfg_dekor',
  2:'[data-form]',
  3:'[data-v]',
  4:'[data-t], [data-edge]'
};
function stepEl(n){ return $('kfgStep'+n); }
/* Klappt ein Schritt zu, verschwindet Inhalt UEBER dem sichtbaren Bereich und
   die Seite rutscht unter dem Finger weg — im schlimmsten Fall so weit, dass
   die Tischplatte ganz aus dem Bild faellt (Befund Vater, 29.07.: "Wenn
   Ausschnitte zurueckgeklappt ist soll weiterhin die Tischplatte gesehen
   werden"). Deshalb wird die Bildlage an einem Ankerpunkt festgehalten und
   danach nachgezogen. */
function ohneSprung(anker, fn){
  const vor = anker ? anker.getBoundingClientRect().top : null;
  fn();
  if(vor!==null){
    const nach = anker.getBoundingClientRect().top;
    const d = nach - vor;
    if(Math.abs(d) > 1) window.scrollBy(0, d);
  }
  plattImBild();
}
/* Sicherheitsnetz: ist von der Draufsicht danach zu wenig zu sehen, wird sie
   zurueckgeholt. Greift auch, wenn der Anker allein nicht reicht (etwa wenn
   das Layout unter dem Ankerpunkt zusammenfaellt). */
function plattImBild(){
  const st=$('stage'); if(!st) return;
  const r=st.getBoundingClientRect(), vh=window.innerHeight;
  const sichtbar=Math.max(0, Math.min(r.bottom,vh)-Math.max(r.top,0));
  if(r.height<1) return;
  if(sichtbar/r.height >= 0.9) return;                 /* genug zu sehen */
  if(r.height-sichtbar < 24) return;                   /* Kleinkram nicht nachkorrigieren */
  const col=$('stickyCol'); if(!col) return;
  const ziel=window.scrollY + col.getBoundingClientRect().top - Math.max(0, headerBottom()) - 12;
  window.scrollTo({top:Math.max(0,ziel), behavior:'smooth'});
}
function stepOffen(n,auf){
  const sec=stepEl(n); if(!sec) return;
  sec.classList.toggle('is-open',!!auf);
  const h=sec.querySelector('.kfg_step-head'); if(h) h.setAttribute('aria-expanded',auf?'true':'false');
}
function initSteps(){
  document.querySelectorAll('[data-kfg-root] .kfg_step').forEach((sec,idx)=>{
    const head=sec.querySelector('.kfg_step-head'); if(!head) return;
    const body=document.createElement('div'); body.className='kfg_step-body';
    while(head.nextSibling) body.appendChild(head.nextSibling);
    sec.appendChild(body);
    head.setAttribute('role','button'); head.setAttribute('tabindex','0');
    head.insertAdjacentHTML('beforeend','<span class="kfg_step-chev" aria-hidden="true"></span>');
    const um=()=>{
      const auf=!sec.classList.contains('is-open');
      sec.dataset.manual='1';                 /* ab jetzt entscheidet der Nutzer */
      ohneSprung(head, ()=>stepOffen(idx+1,auf));
    };
    head.addEventListener('click',um);
    head.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); um(); }
    });
    /* Auswahl im Schritt: zuklappen und den naechsten oeffnen */
    const sel=STEP_TRIGGER[idx+1];
    if(sel) sec.addEventListener('click',e=>{
      if(!e.target.closest || !e.target.closest(sel)) return;
      if(sec.dataset.manual) return;
      clearTimeout(sec.__t);
      sec.__t=setTimeout(()=>weiterZu(idx+1),650);
    });
  });
  stepOffen(1,true);                          /* Schritt 01 offen, Rest zu */
}
function weiterZu(n){
  const sec=stepEl(n); if(!sec||sec.dataset.manual) return;
  if(sec.contains(document.activeElement)) return;   /* es wird gerade getippt */
  const nx=stepEl(n+1);
  const anker=sec.querySelector('.kfg_step-head');
  ohneSprung(anker, ()=>{
    stepOffen(n,false);
    if(nx && !nx.dataset.manual && !nx.classList.contains('is-open')) stepOffen(n+1,true);
  });
  if(nx && nx.classList.contains('is-open')){
    const r=nx.getBoundingClientRect();
    if(r.top<0 || r.top>window.innerHeight-120) nx.scrollIntoView({behavior:'smooth',block:'center'});
  }
}
function syncURL(){
  const p=new URLSearchParams({m:S.mat,d:S.dekor,f:S.form,t:S.thick,c:S.corner,cr:S.cornerR.join('-'),er:S.edgeR,sf:S.mpxSurface,ac:S.absColor,
    ...(S.form==='rect'?{l:S.L,b:S.B}:S.form==='round'?{dm:S.D}:{sw:S.sw.w,sd:S.sw.d,sc:S.sw.c}),e:S.edges.join(',')});
  history.replaceState(null,'','#'+p.toString());
}

/* ═══════ Events ═══════ */
document.querySelectorAll('[data-draw]').forEach(b=>b.addEventListener('click',()=>setDraw(S.draw===b.dataset.draw?null:b.dataset.draw)));
function startDraw(e){ if(!G)return;
  if(!S.draw){                                       /* kein Zeichnen-Modus → evtl. Cut anfassen */
    const t=e.target&&e.target.classList&&e.target.classList.contains('kfg_cutshape')?e.target:null;
    if(t&&+t.dataset.idx<S.cuts.length){
      const [px,py]=svgPt(e), c2=S.cuts[+t.dataset.idx];
      dragCut={i:+t.dataset.idx, ox:(px-G.x)/G.sc-c2.cx, oy:(py-G.y)/G.sc-c2.cy};
      $('stage').classList.add('is-dragging');
      e.preventDefault();
    }
    return;
  }
  if(S.draw==='p'){ const [px,py]=svgPt(e); polyKlick(px,py); e.preventDefault(); return; }
  if(tmpCut)return;
  const [px,py]=svgPt(e); tmpCut={t:S.draw,x0:(px-G.x)/G.sc,y0:(py-G.y)/G.sc,x1:null,y1:null};
  e.preventDefault(); }
$('stage').addEventListener('dblclick',e=>{ if(S.draw==='p'){ e.preventDefault(); polySchliessen(); } });
window.addEventListener('keydown',e=>{
  if(S.draw!=='p') return;
  if(e.key==='Enter'){ e.preventDefault(); polySchliessen(); }
  if(e.key==='Escape'){ polyTmp=null; setDraw(null); drawStage(); }
});
$('addKanal').addEventListener('click',addKanal);
$('stage').addEventListener('pointerdown',startDraw);
$('stage').addEventListener('mousedown',startDraw);
$('stage').addEventListener('touchstart',e=>{const t=e.touches[0];startDraw({clientX:t.clientX,clientY:t.clientY,preventDefault:()=>e.preventDefault()})},{passive:false});
function moveDraw(e){
  if(dragCut&&G){ const [px,py]=svgPt(e), c2=S.cuts[dragCut.i], r5=v=>Math.round(v*2)/2;
    const bx=cutBox(c2);
    c2.cx=r5(Math.max(bx.w/2,Math.min(Math.max(bx.w/2,G.w-bx.w/2),(px-G.x)/G.sc-dragCut.ox)));
    c2.cy=r5(Math.max(bx.h/2,Math.min(Math.max(bx.h/2,G.h-bx.h/2),(py-G.y)/G.sc-dragCut.oy)));
    drawStage(); return; }
  if(!S.draw||!tmpCut)return;
  const [px,py]=svgPt(e); tmpCut.x1=(px-G.x)/G.sc; tmpCut.y1=(py-G.y)/G.sc; drawStage(); }
function endDraw(){
  if(dragCut){ dragCut=null; $('stage').classList.remove('is-dragging'); render(); return; }
  if(S.draw==='p') return;                      /* Polygon endet per Doppelklick */
  if(!S.draw||!tmpCut)return;
  if(tmpCut.x1!==null){ const c2=normCut(tmpCut);
    if(c2.w>=3&&c2.h>=3){S.cuts.push(c2);toast('Ausschnitt '+fmtCut(c2)+' hinzugefügt · '+fmt(cutPrice(c2)));}
    else toast('Zu klein: mindestens 3 cm aufziehen'); }
  tmpCut=null; setDraw(null); render(); }
window.addEventListener('mousemove',moveDraw);
$('stage').addEventListener('touchmove',e=>{ if(!S.draw&&!dragCut)return;
  const t=e.touches[0]; moveDraw({clientX:t.clientX,clientY:t.clientY}); e.preventDefault(); },{passive:false});
window.addEventListener('touchend',endDraw);
window.addEventListener('pointermove',moveDraw);
window.addEventListener('mouseup',endDraw);
$('stage').addEventListener('pointermove',e=>{ if(!S.draw||!tmpCut)return;
  const [px,py]=svgPt(e); tmpCut.x1=(px-G.x)/G.sc; tmpCut.y1=(py-G.y)/G.sc; drawStage(); });
window.addEventListener('pointerup',endDraw);
$('btn2d').addEventListener('click',()=>setView('2d'));
$('btn3d').addEventListener('click',()=>setView('3d'));
document.querySelectorAll('#formChips .kfg_chip').forEach(b=>b.addEventListener('click',()=>{
  S.form=b.dataset.form;
  document.querySelectorAll('#formChips .kfg_chip').forEach(x=>x.classList.toggle('is-active',x===b));
  $('dimsRect').style.display=S.form==='rect'?'grid':'none';
  $('dimsRound').style.display=S.form==='round'?'grid':'none';
  $('dimsLform').style.display=S.form==='lform'?'grid':'none';
  $('dimsSzwal').style.display=S.form==='szwal'?'block':'none';
  /* Ecken jetzt auch bei Naehmaschinen-Platte und L-Form (Wunsch Sascha 27.07.) */
  $('cornerBlock').style.display=cornerFormOk()?'block':'none';
  buildCorner();          /* Chips + Radiusfelder an die neue Form anpassen */
  render();
}));
document.querySelectorAll('#mpxSurfaceChips .kfg_chip').forEach(b=>b.addEventListener('click',()=>{
  S.mpxSurface=b.dataset.sf;
  document.querySelectorAll('#mpxSurfaceChips .kfg_chip').forEach(x=>x.classList.toggle('is-active',x===b));
  S.dekor=S.mpxSurface==='hpl'?DEKOR_HPL[0][0]:'sperrholz-natur';
  buildDekore(); render();
}));
['swW','swD','swC'].forEach(id=>$(id).querySelectorAll('.kfg_chip').forEach(b=>b.addEventListener('click',()=>{
  const key={swW:'w',swD:'d',swC:'c'}[id]; S.sw[key]=+b.dataset.v;
  $(id).querySelectorAll('.kfg_chip').forEach(x=>x.classList.toggle('is-active',x===b));
  render();
})));
let cT; const inCEl=$('inC'); if(inCEl) inCEl.addEventListener('input',()=>{clearTimeout(cT);cT=setTimeout(()=>{
  setAllCorners(Math.max(0,Math.min(300,+inCEl.value||0)));
  document.querySelectorAll('#cornerChips .kfg_chip').forEach(c=>c.classList.remove('is-active'));
  render();},250)});
['inL','inB','inD','inLL','inLB','inAW','inAH'].forEach(id=>{let t;$(id).addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{
  S.L=$('inL').value;S.B=$('inB').value;S.D=$('inD').value;
  S.lf={L:+$('inLL').value,B:+$('inLB').value,aw:+$('inAW').value,ah:+$('inAH').value};render();},250)})});
document.querySelectorAll('#edgeRadiusChips .kfg_chip').forEach(b=>b.addEventListener('click',()=>{
  S.edgeR=+b.dataset.er;
  document.querySelectorAll('#edgeRadiusChips .kfg_chip').forEach(c=>c.classList.toggle('is-active',c===b));
  render();
}));
document.querySelectorAll('.kfg_check input').forEach(i=>i.addEventListener('change',()=>{
  S.extras[i.dataset.x]=i.checked;
  i.closest('.kfg_check').classList.toggle('is-active',i.checked);
  if(i.dataset.x==='custom')$('customBlock').classList.toggle('is-open',i.checked);
  render();
}));
$('uploadZone').addEventListener('click',()=>$('uploadInput').click());
$('uploadInput').addEventListener('change',()=>{
  if($('uploadInput').files.length){$('uploadZone').querySelector('b').textContent='✓ '+$('uploadInput').files[0].name;toast('Skizze angehängt, geht mit der Anfrage raus')}
});
function openOrder(){
  FORCE_DISTS=true; drawStage();
  $('omSvg').innerHTML=$('stage').innerHTML;
  FORCE_DISTS=false; drawStage();
  const std=isStandard(), offer=needsOffer(), c=calc();
  const formName={rect:'Rechteck',round:'Rund',lform:'L-Form',szwal:'Nähmaschinen-Platte'}[S.form];
  const mass=S.form==='rect'?`${S.L} × ${S.B} cm`:S.form==='round'?`Ø ${S.D} cm`
    :S.form==='lform'?`${S.lf.L} × ${S.lf.B} cm · Ausklinkung ${S.lf.aw} × ${S.lf.ah} cm`
    :`${S.sw.w} × ${S.sw.d} cm · Ausschnitt ${(''+S.sw.c).replace('.',',')} × 18 cm`;
  const edges=[...new Set((S.form==='round'?[S.edges[0]]:S.edges).map(edgeLabel))];
  const edgeTxt=edges.length===1?edges[0]:S.edges.map((e,i)=>'ABCD'[i]+': '+edgeLabel(e)).join(' · ');
  const cutsTxt=(G?S.cuts:[]).map(c2=>{
    const f=v=>(''+(Math.round(v*10)/10)).replace('.',',');
    if(c2.t==='k') return `Kabelkanal ${Math.round(cutLen(c2))} cm, Nut ${c2.w} × ${c2.dp} mm, `
      +`${c2.seite==='oben'?'Oberseite':'Unterseite'}, Enden: ${KANAL_ENDEN[c2.enden||'zu']}, `
      +`Verlauf (x/y in cm ab hinten links): `+kanalPunkte(c2).map(q=>f(q[0])+'/'+f(q[1])).join(' → ');
    if(c2.t==='p') return `Freie Kontur, Punkte (x/y in cm ab hinten links): `
      +(c2.pts||[]).map(p=>f(p[0])+'/'+f(p[1])).join(' · ')+`, Radius R${c2.r||0}`;
    return `${fmtCut(c2)} · Abstände: links ${f(c2.cx-c2.w/2)} · rechts ${f(G.w-(c2.cx+c2.w/2))} · hinten ${f(c2.cy-c2.h/2)} · vorn ${f(G.h-(c2.cy+c2.h/2))} cm`;
  });
  const presets=[]; if(S.extras.bohr)presets.push('Montagebohrungen 4× Ø8');
  Object.keys(PRESETS).forEach(k=>{const n=presetCount(k); if(n)presets.push((n>1?n+'× ':'')+PRESETS[k].label);});
  const rows=[
    ['Auftragsart', std?`Lager-Artikel → cartLinesAdd · Variant ${shopHit()[1]} · SKU ${shopHit()[2]||'—'}`
      :(offer?'Angebotsanfrage → E-Mail an Fertigung + Kunde':'CNC-Fertigungsauftrag → Anfrage-Flow')],
    ['Material', MATERIALS[S.mat].name+(S.mat==='mpx'?{natur:' · Birke natur',hpl:' + HPL-Laminat',lack:' · klarlackiert'}[S.mpxSurface]:'')],
    ['Dekor', c.dekorName],
    ['Stärke', c.thickName],
    ['Form & Maß', `${formName} · ${mass}`],
    ...(cornerCount()>0?[['Eckenradius',[0,1,2,3].filter(i=>cornerR(i)>0)
      .map(i=>`${CORNER_NAMES[i]} R${cornerR(i)}`).join(' · ')]]:[]),
    ['Kante', edgeTxt+(S.mat==='dekor'&&S.absColor!=='dekor'?` · ABS-Farbe ${(ABS_STOCK.find(a=>a[0]===S.absColor)||[])[1]}`:'')],
    ...(presets.length?[['Ausschnitte (Preset)',presets.join(', ')]]:[]),
    ...(cutsTxt.length?[['Ausschnitt-Positionen',cutsTxt.join('<br>')]]:[]),
    ...(S.extras.custom?[['Eigenes Bohrbild',($('customText').value||'—')+' · Skizze: '+($('uploadInput').files.length?$('uploadInput').files[0].name:'folgt per E-Mail')]]:[]),
    ['Preis', $('price').textContent+' inkl. MwSt. ('+Math.round(c.zl)+' zł Materialbasis)'],
  ];
  const hitP=shopHit();
  const props={...(hitP?{'_kfg_variant_id':hitP[1],'_kfg_sku':hitP[2]||''}:{}),
    '_kfg_config_url':location.href.slice(0,60)+'…','_kfg_material':S.mat,'_kfg_dekor':S.dekor,'_kfg_staerke_mm':S.thick,
    '_kfg_form':S.form,'_kfg_mass_cm':mass.replace(/ cm/g,''),'_kfg_kante':S.edges.join('|'),'_kfg_abs':S.absColor,
    ...(S.cuts.some(c2=>c2.t==='k')?{'_kfg_kabelkanal':S.cuts.filter(c2=>c2.t==='k')
      .map(c2=>`${Math.round(cutLen(c2))}cm x ${c2.w}mm x ${c2.dp}mm ${c2.seite}`).join(' | ')}:{}),
    ...(cornerCount()>0?{'_kfg_eckenradius_mm':S.cornerR.join('/'),
      '_kfg_ecken':[0,1,2,3].filter(i=>cornerR(i)>0).map(i=>`${CORNER_NAMES[i]}:R${cornerR(i)}`).join(' | ')}:{}),
    ...(S.cuts.length?{'_kfg_cuts':S.cuts.map(c2=>`${c2.preset||c2.t}:${c2.w}x${c2.h}@${c2.cx}/${c2.cy}`).join(';')}:{})};
  $('omData').innerHTML='<table>'+rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')+'</table>'
    +'<div class="props"><b>Technisch: Shopify Line-Item-Properties</b>'
    +Object.entries(props).map(([k,v])=>`${k}: ${v}`).join('<br>')+'</div>';
  $('orderModal').hidden=false;
}
$('omClose').addEventListener('click',()=>$('orderModal').hidden=true);
$('orderModal').addEventListener('click',e=>{if(e.target===$('orderModal'))$('orderModal').hidden=true});
$('cta').addEventListener('click',openOrder);
$('ctaBar').addEventListener('click',()=>$('cta').click());
$('btnShare').addEventListener('click',()=>{navigator.clipboard&&navigator.clipboard.writeText(location.href);toast('Link kopiert, Konfiguration teilbar')});
$('btnMail').addEventListener('click',()=>toast('Demo: E-Mail-Capture → Konfiguration + Preis als Mail (Lead)'));
$('btnMuster').addEventListener('click',()=>toast('Demo: Musterbox als Shopify-Produkt in den Warenkorb'));

/* Schnittlaenge einer Bearbeitung in cm — Grundlage der Preisformel */
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
  return Math.round((FREI_PRICE.basis + FREI_PRICE.lfm*cutLen(c)/100)*10)/10;   /* auf 10 Cent */
}
/* Fertigungsgrenzen: geschlossene Aussparungen brauchen Abstand zur Kante,
   Innenecken einen Mindestradius, Ausklinkungen duerfen die Platte nicht
   halbieren. Wird als Hinweis angezeigt, nicht als Sperre. */
/* Bearbeitungen an die aktuelle Plattengroesse anpassen. Ohne das liefen
   Ausklinkungen beim Verkleinern der Platte aus der Kontur heraus und die
   Draufsicht zerfiel. */
function clampCuts(){
  const d=dims();
  S.cuts.forEach(c=>{
    if(c.t==='k'){
      c.dp=Math.max(3,Math.min(maxTiefe(),c.dp));
      c.w=Math.max(20,Math.min(200,c.w));
      c.len=Math.max(5,Math.min(c.dir==='quer'?d.h:d.w, c.len||10));
    } else {
      const bx=cutBox(c);
      c.cx=Math.max(bx.w/2,Math.min(Math.max(bx.w/2,d.w-bx.w/2),c.cx));
      c.cy=Math.max(bx.h/2,Math.min(Math.max(bx.h/2,d.h-bx.h/2),c.cy));
    }
  });
}
function cutWarn(c){
  const d=dims(), m=cutMinEdge();
  if(c.t==='k'){
    if(c.dp>maxTiefe()) return 'Tiefer als ' + maxTiefe() + ' mm ist bei ' + S.thick + ' mm Platte nicht möglich';
    if(c.w>200) return 'Breiter als 200 mm bitte anfragen';
    return '';
  }
  if(c.t==='p') return '';
  const w=c.t==='c'?c.d:c.w, h=c.t==='c'?c.d:c.h;
  if(c.cx-w/2<m||c.cy-h/2<m||c.cx+w/2>d.w-m||c.cy+h/2>d.h-m)
    return 'Mindestabstand ' + (m*10) + ' mm zur Plattenkante unterschritten';
  return '';
}
/* Massangabe fuer Aufschluesselung und Bestelldaten — mit Einheit und Komma */
function cutMass(c){
  const z=v=>(''+(Math.round(v*10)/10)).replace('.',',');
  if(c.t==='k') return z(Math.round(cutLen(c)))+' cm · '+c.w+' × '+c.dp+' mm · '+(c.seite==='oben'?'Oberseite':'Unterseite');
  if(c.t==='p') return (c.pts||[]).length+' Punkte';
  if(c.t==='c') return 'Ø '+z(c.d)+' cm';
  return z(c.w)+' × '+z(c.h)+' cm';
}
/* Maximale Frästiefe: nie mehr als 60 % der Plattenstärke stehen lassen */
function maxTiefe(){ return Math.max(3, Math.round((+S.thick||25)*0.6)); }
/* Huellmass einer Bearbeitung in cm — fuers Ziehen und Begrenzen.
   Beim Kanal ist c.w die NUTBREITE in mm, nicht die Ausdehnung: ohne diese
   Unterscheidung haette das Ziehen den Kanal auf einen Streifen eingesperrt. */
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
function cutTypName(c){
  if(c.preset) return PRESETS[c.preset].label;
  return {r:'Ausschnitt', c:'Runder Ausschnitt', p:'Freie Kontur', k:'Kabelkanal'}[c.t]||'Bearbeitung';
}
/* Mindestabstand einer geschlossenen Aussparung zur Plattenkante (cm) */
function cutMinEdge(){ return S.mat==='compact' ? 3 : 5; }
function presetCount(k){ return S.cuts.filter(c=>c.preset===k).length; }
function addPreset(k){
  if(S.form==='round'){toast('Ausschnitte aktuell nur bei eckigen Formen');return;}
  const p=PRESETS[k], d=dims(), n=presetCount(k);
  let [cx,cy]=p.pos(d.w,d.h,n);
  const w=p.t==='c'?p.d:p.w, hh=p.t==='c'?p.d:p.h;
  if(w>d.w-2||hh>d.h-2){toast(p.label+' passt nicht auf diese Plattengröße');return;}
  cx=Math.max(w/2,Math.min(d.w-w/2,cx)); cy=Math.max(hh/2,Math.min(d.h-hh/2,cy));
  S.cuts.push(p.t==='c'?{t:'c',preset:k,cx,cy,d:p.d,w:p.d,h:p.d}:{t:'r',preset:k,cx,cy,w:p.w,h:p.h});
  toast(p.label+' hinzugefügt, auf der Platte verschiebbar'); render();
}
function removePreset(k){
  for(let i=S.cuts.length-1;i>=0;i--) if(S.cuts[i].preset===k){S.cuts.splice(i,1);render();return;}
}
function syncPresets(){
  document.querySelectorAll('.kfg_preset').forEach(el=>{
    const n=presetCount(el.dataset.preset);
    el.querySelector('[data-count]').textContent=n;
    el.classList.toggle('is-active',n>0);
  });
}
document.querySelectorAll('.kfg_preset').forEach(el=>{
  el.querySelector('[data-inc]').addEventListener('click',()=>addPreset(el.dataset.preset));
  el.querySelector('[data-dec]').addEventListener('click',()=>removePreset(el.dataset.preset));
});
/* ══ Mobile: Sticky-Mini-Vorschau + Summary-Position ══ */
function updateMini(){
  const el=$('miniBar'); if(!el)return;   /* Leiste entfernt — Aufrufe laufen ins Leere */
  const d=dims(), c=calc();
  const pl=$('miniPlate');
  const ratio=Math.max(0.35,Math.min(2.6,d.w/d.h));
  pl.style.aspectRatio=ratio+' / 1';
  pl.style.backgroundImage=isLack()?'none':`url(${TEX[texKey()]})`;
  pl.style.backgroundColor=isLack()?'#dcd9d2':'';
  pl.classList.toggle('is-round',S.form==='round');
  /* Eckenradien in der Miniatur andeuten, damit man beim Scrollen sieht,
     was die Eckenfelder bewirken. Skaliert auf die Miniaturhoehe. */
  if(S.form==='rect'){
    const h=34, sk=h/(d.h*10);
    pl.style.borderRadius=[0,1,2,3].map(i=>Math.min(12,Math.round(cornerR(i)*sk))+'px').join(' ');
  } else if(S.form!=='round'){ pl.style.borderRadius='4px'; } else { pl.style.borderRadius=''; }
  const mass=S.form==='rect'?`${S.L} × ${S.B} cm`:S.form==='round'?`Ø ${S.D} cm`
    :S.form==='lform'?`${S.lf.L} × ${S.lf.B} cm · L-Form`:`${S.sw.w} × ${S.sw.d} cm · Nähmaschine`;
  $('miniTitle').textContent=mass;
  $('miniSub').textContent=`${MATERIALS[S.mat].name} · ${c.dekorName} · ${c.thickName}`;
}
/* Achtung: das toggle-Ereignis von <details> kommt auch beim programmatischen
   Setzen von .open vom Browser (isTrusted:true). Ohne eigenen Schalter haette
   sich der Konfigurator jede automatische Umschaltung als Nutzerwunsch gemerkt
   und danach nie wieder von selbst aufgeklappt. */
function setDetailAuto(d, offen){
  if(!d || d.open===offen) return;
  d.dataset.auto='1'; d.open=offen;
  setTimeout(()=>{ delete d.dataset.auto; }, 0);
}
(function(){ const d=$('detailCard'); if(d) d.addEventListener('toggle',()=>{
  if(d.dataset.auto) return;                   /* vom Konfigurator umgeschaltet */
  d.dataset.manual='1';                        /* vom Nutzer bedient */
  updateSticky();                              /* Platz neu verteilen */
}); })();
function initMini(){
  const bar=$('miniBar'), prev=document.querySelector('.kfg_preview'), head=document.querySelector('header.site');
  if(!bar||!prev)return;   /* Mini-Leiste gibt es nicht mehr */
  const sync=()=>{
    const hb=headerBottom();
    updateBottomBar();
    bar.style.top=Math.max(0,hb)+'px';
    /* Nur auf Mobil — am Desktop wollte Sascha weder die Mini-Leiste
       noch die eingeblendete Preisleiste (27.07.). */
    const stg=document.getElementById('stage');
    const ref=(stg&&stg.getBoundingClientRect().height>0?stg:prev).getBoundingClientRect();
    const on = window.innerWidth<980 && ref.top < hb-4;
    bar.classList.toggle('is-on',on); bar.setAttribute('aria-hidden',on?'false':'true');
  };
  if(window.innerWidth<980) $('detailCard').open=false;
  sync();
  window.addEventListener('scroll',sync,{passive:true});
  window.addEventListener('resize',sync);
  $('miniJump').addEventListener('click',()=>prev.scrollIntoView({behavior:'smooth',block:'start'}));
}
/* Preis-Karte wandert auf Mobile ans Ende — unten trägt die Sticky-Bar den Preis */
function placeSummary(){
  const sum=document.querySelector('.kfg_summary'), panel=document.querySelector('.kfg_panel'), col=$('stickyCol');
  if(!sum||!panel||!col)return;
  const target=window.innerWidth<980?panel:col;
  if(sum.parentElement!==target) target.appendChild(sum);
}
/* Hoehe des sticky/fixed Site-Headers messen — Webflow-Header, Ankuendigungs-
   balken und Mini-Leiste koennen unterschiedlich hoch sein und sich aendern
   (Scroll-Header, Sprachumschalter). Gemessen wird beim Start und bei jeder
   Fensteraenderung — NICHT beim Scrollen: das kostete pro Scrollschritt einen
   Layout-Durchlauf ueber die ganze Seite und liess alles ruckeln. Der beim
   Seitenanfang gemessene (hoechste) Wert ist die sichere Untergrenze: faehrt
   der Header beim Scrollen ein, steht die Spalte hoechstens etwas tiefer. */
var _kfgHead=null, _kfgHeadEls=null;
/* Die Kopfleiste EINMAL suchen (das ist der teure Teil: Suche ueber die ganze
   Seite plus getComputedStyle). Danach werden nur noch diese wenigen Elemente
   ausgemessen. */
function headerEls(){
  if(_kfgHeadEls) return _kfgHeadEls;
  const out=[];
  document.querySelectorAll('header, [class*="header"], [class*="navbar"], [class*="nav_"]').forEach(el=>{
    if(el.closest('[data-kfg-root]')) return;                 /* eigene Elemente ignorieren */
    const cs=getComputedStyle(el);
    if(cs.position!=='fixed'&&cs.position!=='sticky') return;
    out.push(el);
  });
  return (_kfgHeadEls=out);
}
function headerBottom(){
  if(_kfgHead!==null) return _kfgHead;
  return (_kfgHead=messeHeader());
}
function messeHeader(){
  let hb=0;
  headerEls().forEach(el=>{
    const cs=getComputedStyle(el);
    if(cs.visibility==='hidden'||cs.display==='none') return;
    const r=el.getBoundingClientRect();
    if(r.height<8||r.top>80) return;                          /* nur echte Kopfleisten */
    hb=Math.max(hb, r.bottom);
  });
  return Math.round(hb);
}
var _kfgStickyLaeuft=false, _kfgStufe=0, _kfgSpart=[0,0,0,0,0], _kfgHeadMax=0;
/* Die Buehne hat viewBox 0 0 600 444 und wird auf die Kartenbreite skaliert.
   Eine feste Schriftgroesse kommt deshalb je nach Geraet unterschiedlich gross
   an: auf einem 390er Display mit Massstab 0.57 wurden aus 13 px gerade 7 px
   (Befund Vater, 29.07.). Gerechnet wird jetzt rueckwaerts — gewuenschte
   Groesse auf dem Schirm geteilt durch den Massstab. */
/* Zielgroesse der Masszahl auf dem Schirm. Mobil bewusst GROESSER als am
   Desktop: das Bild ist dort kleiner, die Zahl steht naeher am Auge und war
   auch mit 14 px noch schwer zu lesen (Ruckmeldung Sascha 29.07.). */
var DIM_ZIEL = 15;
var _dimFS = 16;                        /* aktuelle Schriftgroesse in Nutzereinheiten */
function dimSkala(){
  const st=$('stage'); if(!st) return;
  const b=st.getBoundingClientRect().width;
  if(b<40) return;                      /* noch nicht gezeichnet */
  const m=b/600;                        /* Abbildungsmassstab */
  const ziel=window.innerWidth<980 ? DIM_ZIEL+3 : DIM_ZIEL;
  _dimFS = Math.round(ziel/m*10)/10;
  st.style.setProperty('--dim-fs', _dimFS+'px');
  st.style.setProperty('--dim-halo', Math.round(3.6/m*10)/10+'px');
  if(typeof drawStage==='function' && G) drawStage();   /* Abstaende haengen an _dimFS */
}
function updateSticky(){
  const el=$('stickyCol'); if(!el)return;
  _kfgStickyLaeuft=true;
  requestAnimationFrame(()=>{ _kfgStickyLaeuft=false; });
  if(window.innerWidth<980){
    /* Mobil: die Vorschaukarte selbst wandert mit (Wunsch Sascha 27.07.) —
       die fruehere Mini-Leiste entfaellt dafuer ganz. Die Draufsicht wird
       gedeckelt, damit unter der Karte noch genug Panel sichtbar bleibt. */
    el.style.setProperty('--kfg-top', (headerBottom()+8)+'px');
    el.style.top='';
    const st=$('stage'), st3=$('stage3d');
    const cap=Math.round(window.innerHeight*0.46)+'px';
    if(st){ st.style.maxHeight=cap; if(st3) st3.style.maxHeight=cap; }
    dimSkala();
    /* Detailkarte zuklappen, solange die mitwandernde Karte sonst den halben
       Bildschirm belegt — sonst sieht man vom Panel nichts mehr. */
    const det=$('detailCard'), prev=document.querySelector('.kfg_preview');
    if(det&&prev&&!det.dataset.manual&&det.open&&prev.getBoundingClientRect().height>window.innerHeight*0.5)
      setDetailAuto(det, false);
    el.classList.remove('is-tight','is-tighter','is-scroll');
    return;
  }
  /* Die Spalte startet immer UNTER dem gemessenen Header und bleibt am Desktop
     IMMER sticky — Vorschau und Warenkorbkarte wandern zusammen mit
     (Wunsch Sascha, 27.07.). Fehlt Hoehe, wird gestuft Platz geschaffen:

       Stufe 0  alles sichtbar
       Stufe 1  Vertrauenszeile + Teilen-Buttons aus
       Stufe 2  Konfigurations-Chips + Preisaufschluesselung aus
       Stufe 3  Detailkarte zugeklappt (Zeile bleibt sichtbar)
       Stufe 4  Spalte scrollt intern

     Frueher wurde bei JEDEM Aufruf erst alles zurueckgesetzt und dann neu
     durchprobiert. Das flackerte bei jedem Klick und ruckelte beim Scrollen.
     Jetzt wird vom aktuellen Zustand aus nur noch eine Stufe hoch oder runter
     gegangen, mit Puffer gegen Hin-und-Her-Springen. */
  const det=$('detailCard');
  const hb=headerBottom();
  /* POSITION folgt dem Header, GROESSE nicht. Die Kessler-Kopfleiste schrumpft
     beim Scrollen von ~210 auf ~93 px — wuerde die Groesse mitrechnen, wuchse
     die Draufsicht beim Scrollen mit (Befund Sascha, 27.07.: "Wenn wir scrollen
     sollte die Groesse gleich bleiben"). Gerechnet wird deshalb immer mit der
     GROESSTEN bisher gesehenen Kopfleiste: die Spalte passt damit in jedem
     Zustand, und unten bleibt hoechstens etwas Luft ueber. */
  _kfgHeadMax=Math.max(_kfgHeadMax, hb);
  const top=hb+12;
  const platz=window.innerHeight-12-16;   /* Kopfleiste weicht beim Scrollen */
  const stage=$('stage'), stage3=$('stage3d');
  /* Nur schreiben, wenn sich der Wert wirklich aendert — jeder ueberfluessige
     Stilzugriff erzwingt sonst ein neues Layout. */
  const setMax = v => {
    if(!stage || stage.style.maxHeight===v) return;
    stage.style.maxHeight=v; if(stage3) stage3.style.maxHeight=v;
  };
  const setzeTop = v => { if(el.style.top!==v) el.style.top=v; };
  const stufe = n => {
    el.classList.toggle('is-tight',   n>=1);
    el.classList.toggle('is-tighter', n>=2);
    el.classList.toggle('is-scroll',  n>=4);
    if(det && !det.dataset.manual) setDetailAuto(det, n<1);
  };
  el.style.setProperty('--kfg-top', top+'px');
  setzeTop(top+'px');

  /* Mindesthoehe der Draufsicht je Stufe. Bewusst hoch: die Draufsicht ist das
     Produktbild und soll gross bleiben — lieber Beiwerk ausblenden. */
  const MIN=[620,560,480,400,240];
  const restOhneStage = () => Math.round(el.offsetHeight - stage.getBoundingClientRect().height);
  if(!stage){ stufe(0); return; }

  let n=_kfgStufe;
  stufe(n);                               /* Ausgangszustand herstellen */
  /* Abwaerts, solange es nicht passt. Beim Abstieg merken, wie viel die Stufe
     eingespart hat — damit spaeter ohne Probieren entschieden werden kann, ob
     der Aufstieg wieder moeglich ist. */
  for(let i=0;i<5 && n<4;i++){
    const rest=restOhneStage();
    if(platz-rest >= MIN[n]) break;
    n++; stufe(n);
    _kfgSpart[n]=Math.max(0, rest-restOhneStage());
  }
  /* Aufwaerts, wenn wieder genug Luft ist. Die 32 px Puffer verhindern, dass
     eine Stufe bei minimaler Aenderung staendig auf- und zuklappt. */
  while(n>0){
    const rest=restOhneStage();
    if(platz-rest-(_kfgSpart[n]||0)-32 < MIN[n-1]) break;
    n--; stufe(n);
  }
  _kfgStufe=n;
  const frei=Math.round(platz-restOhneStage());
  setMax(Math.max(frei, MIN[4])+'px');
  dimSkala();
}
/* ── Kopfleiste ausblenden, solange im Konfigurator gearbeitet wird ─────────
   Die Kessler-Kopfleiste ist mobil 114 px und am Desktop bis 223 px hoch. Sie
   steht damit dauerhaft im Weg, obwohl sie beim Konfigurieren niemand braucht
   (Wunsch Vater 29.07.: "Header wegmachen", "Produkt muss immer zu sehen
   sein"). Sie verschwindet deshalb, sobald im Konfigurator nach unten gescrollt
   wird, und kommt beim Hochscrollen oder ausserhalb des Werkzeugs zurueck.

   Bewusst NICHT display:none — die Leiste behaelt ihren Platz im Fluss und ihre
   eigene Logik laeuft weiter, sie wird nur nach oben geschoben. */
var _kfgWeg=false, _kfgLetztY=0;
function kopfleisteZeigen(zeigen){
  if(_kfgWeg===!zeigen) return;
  _kfgWeg=!zeigen;
  headerEls().forEach(el=>el.classList.toggle('kfg-headaway', _kfgWeg));
  /* Die Spalte sitzt direkt unter der Leiste — nach dem Wechsel neu messen.
     Erst nach der Uebergangszeit, sonst wird ein Zwischenstand gemessen. */
  clearTimeout(window.__kfgHT);
  window.__kfgHT=setTimeout(()=>{ _kfgHead=null; updateSticky(); }, 260);
}
(function(){
  /* Frueher wich die Kopfleiste nur, solange der Konfigurator im Bild war.
     Auf dieser Seite soll sie beim Runterscrollen ueberall weichen (Wunsch
     Sascha 29.07.) — das Skript laeuft ohnehin nur hier. */
  let tick=false;
  addEventListener('scroll',()=>{
    if(tick) return; tick=true;
    requestAnimationFrame(()=>{
      tick=false;
      const y=Math.max(0, window.scrollY||0);
      const runter = y > _kfgLetztY + 4;
      const hoch    = y < _kfgLetztY - 4;
      if(runter||hoch) _kfgLetztY=y;
      updateBottomBar();
      if(y<80){ kopfleisteZeigen(true); return; }   /* ganz oben immer sichtbar */
      if(runter) kopfleisteZeigen(false);
      else if(hoch) kopfleisteZeigen(true);
    });
  }, {passive:true});
})();

/* Am Desktop erscheint die Leiste erst, wenn das Werkzeug nach oben aus dem
   Bild gescrollt ist. Solange es sichtbar ist, wandert die Preiskarte ohnehin
   mit und eine zweite Leiste waere doppelt (Sascha 27.07.). Wer aber unter dem
   Konfigurator liest, soll nicht hochscrollen muessen (Sascha 29.07.). */
/* Der Fussbereich der Seite. Einmal suchen und merken - er wandert nicht. */
var _kfgFuss;
function fussEl(){
  if(_kfgFuss!==undefined) return _kfgFuss;
  return (_kfgFuss = document.querySelector('footer.footer-wrapper, footer, .footer-wrapper') || null);
}
function updateBottomBar(){
  const bar=document.querySelector('.kfg_bar');
  if(!bar) return;
  /* Bezug ist der ganze Konfigurator, nicht nur die Vorschauspalte: mobil steht
     das Bedienfeld UNTER der Spalte, dort waere die Leiste sonst schon mitten
     im Konfigurieren da. */
  const wurzel=document.querySelector('[data-kfg-root] .kfg_layout')||$('stickyCol');
  if(!wurzel){ bar.classList.remove('is-on'); return; }
  const r=wurzel.getBoundingClientRect();
  /* Unterkante ueber dem oberen Bildrand = wir sind darunter. 40 px Puffer,
     damit die Leiste an der Grenze nicht flackert. */
  const an = r.bottom < 40;
  bar.classList.toggle('is-on', an);
  /* Die Leiste darf den Fussbereich nicht ueberdecken (Wunsch Sascha 29.07.):
     sobald er ins Bild kommt, setzt sie sich auf seine Oberkante statt am
     unteren Bildrand kleben zu bleiben. */
  if(!an){ if(bar.style.bottom) bar.style.bottom=''; return; }
  const f=fussEl();
  const unten = f ? Math.max(0, Math.round(window.innerHeight - f.getBoundingClientRect().top)) : 0;
  const neu = unten ? unten+'px' : '';
  if(bar.style.bottom!==neu) bar.style.bottom=neu;
}
window.addEventListener('resize',()=>{clearTimeout(window.__stT);window.__stT=setTimeout(()=>{_kfgHead=null;_kfgHeadEls=null;_kfgHeadMax=0;if(window.__kfgBeobachteHeader)window.__kfgBeobachteHeader();placeSummary();updateSticky();updateBottomBar();frame3D()},120)});

/* Die Hoehe der Spalte steht beim ersten Messen noch nicht fest: das Kantenbild
   ist dann meist noch nicht geladen und zaehlt mit 0 px. Deshalb wird nach dem
   Laden der Bilder nachgemessen — und nur dann. BEWUSST NICHT beim Scrollen:
   genau das machte die Seite ruckelig (Befund Sascha, 27.07.). */
(function(){
  let sT;
  const nachmessen=()=>{ clearTimeout(sT); sT=setTimeout(()=>{ updateSticky(); }, 80); };
  document.querySelectorAll('[data-kfg-root] img').forEach(im=>{
    im.addEventListener('load', nachmessen);
    im.addEventListener('error', nachmessen);
  });
  window.addEventListener('load', ()=>{ _kfgHead=null; nachmessen(); });

  /* Die Kessler-Kopfleiste ist am Seitenanfang gross (Promo + Topzeile +
     Navigation, ~210 px) und schaltet beim Scrollen auf die kompakte Variante
     (~93 px). Wurde sie nur einmal gemessen, blieb ueber der Vorschau eine
     Luecke von gut 100 px stehen (Befund Sascha, 27.07.). Ein ResizeObserver
     auf der Leiste meldet genau diesen Wechsel — und NUR ihn, nicht jeden
     Scrollschritt. Damit sitzt die Spalte immer direkt unter dem Header, ohne
     dass beim Scrollen irgendetwas gerechnet wird. */
  if(!window.ResizeObserver) return;
  let hT;
  const ro=new ResizeObserver(()=>{
    clearTimeout(hT);
    hT=setTimeout(()=>{
      const neu=messeHeader();
      if(Math.abs(neu-(_kfgHead||0))<2) return;
      _kfgHead=neu; updateSticky();
    }, 60);
  });
  window.__kfgBeobachteHeader=()=>{ ro.disconnect(); headerEls().forEach(el=>ro.observe(el)); };
  window.__kfgBeobachteHeader();
})();

/* ═══════ Init ═══════ */



  SHOP = shopData || {};

  restoreFromHash();
  buildAll(); placeSummary(); render(); initMini(); initSteps();

  window.KFG = {
    version: VERSION,
    getConfig: function(){ return JSON.parse(JSON.stringify(S)); },
    setConfig: function(patch){ Object.assign(S, patch||{}); buildAll(); render(); },
    reload: function(){ render(); },
    _debug: function(){ return { S:S, shopArtikel:Object.keys(SHOP).length, treffer:shopHit(), drei:three }; }
  };
}
})();
