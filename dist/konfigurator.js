/*! Kessler PRO — Tischplatten-Konfigurator  v1.1.0
 *  Rendert die komplette Konfigurator-UI in jeden Container mit [data-kfg-root].
 *  Daten: kfg-produktmatrix.json (Lagerartikel) · Bilder: assets/kfg/ — beide via jsDelivr.
 *  Public API: window.KFG = { version, getConfig(), setConfig(), reload(), _debug() }
 */
(function(){
  if (window.__KFG_LOADED) return;                      /* Idempotenz-Guard (Bootstrap-Quirk) */
  window.__KFG_LOADED = true;

  var VERSION = '1.1.0';
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
var KFG_CSS = "\n  [data-kfg-root]{\n    --ink:#1E1E1E; --deep:#0A0A0A; --card:#F2F0EB; --alt:#FAFAFA; --hair:#E5E5E5;\n    --ok:#1c7a3d; --ok-bg:#e8f4ec; --warn:#9a6b12; --warn-bg:#faf3e2;\n    --s-3xs:4px; --s-2xs:8px; --s-xs:12px; --s-s:16px; --s-m:24px; --s-l:32px; --s-xl:48px; --s-2xl:64px;\n    --r:8px;\n  }\n  [data-kfg-root] *{box-sizing:border-box;margin:0;padding:0}\n  [data-kfg-root] button, [data-kfg-root] select, [data-kfg-root] input, [data-kfg-root] textarea{font-family:inherit}\n  \n\n  \n  \n  \n  \n  \n  \n  \n  \n  @media(min-width:768px){}\n\n  [data-kfg-root] .kfg_hero{max-width:1280px;margin-inline:auto;padding:var(--s-l) clamp(16px,4vw,80px) var(--s-s)}\n  [data-kfg-root] .kfg_hero h1{font-size:clamp(24px,3.4vw,36px);font-weight:500;letter-spacing:-.01em}\n  [data-kfg-root] .kfg_hero p{margin-top:var(--s-2xs);color:#555;font-size:15px;max-width:680px}\n  [data-kfg-root] .kfg_hero .anchor{color:var(--ink);font-weight:600}\n\n  [data-kfg-root] .kfg_layout{max-width:1280px;margin-inline:auto;padding:var(--s-s) clamp(16px,4vw,80px) 140px;\n    display:grid;grid-template-columns:1fr;gap:var(--s-m)}\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_layout{grid-template-columns:55fr 45fr;gap:var(--s-xl);padding-bottom:var(--s-2xl)}\n  }\n\n  /* \u2500\u2500 Preview \u2500\u2500 */\n  [data-kfg-root] .kfg_preview{background:var(--card);border-radius:16px;padding:var(--s-s);position:relative}\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_preview{padding:var(--s-m)}\n    [data-kfg-root] .kfg_stickycol{position:sticky;top:84px;align-self:start}\n  }\n  [data-kfg-root] .kfg_preview-badge{position:absolute;top:var(--s-s);left:var(--s-s);z-index:2;display:inline-flex;align-items:center;gap:6px;\n    font-size:12px;font-weight:500;padding:6px 12px;border-radius:var(--r);background:var(--ok-bg);color:var(--ok)}\n  [data-kfg-root] .kfg_preview-badge.is-sonder{background:var(--warn-bg);color:var(--warn)}\n  [data-kfg-root] .kfg_preview-badge .dot{width:7px;height:7px;border-radius:50%;background:currentColor}\n  [data-kfg-root] .kfg_viewtoggle{position:absolute;top:var(--s-s);right:var(--s-s);z-index:2;display:flex;gap:2px;background:#fff;\n    border:1px solid var(--hair);border-radius:var(--r);padding:2px}\n  [data-kfg-root] .kfg_viewtoggle button{border:0;background:transparent;font-size:12px;font-weight:500;padding:6px 14px;\n    cursor:pointer;border-radius:6px;min-height:32px;color:#777}\n  [data-kfg-root] .kfg_viewtoggle button.is-active{background:var(--ink);color:#fff}\n  [data-kfg-root] .kfg_preview-stage{width:100%;aspect-ratio:10/7.4;display:block}\n  [data-kfg-root] #stage3d{width:100%;aspect-ratio:10/7.4;display:none;border-radius:var(--r);cursor:grab;touch-action:none}\n  [data-kfg-root] .kfg_preview-hint{text-align:center;font-size:12px;color:#8a877f;padding-top:var(--s-2xs)}\n  [data-kfg-root] .ic-svg{width:14px;height:14px;flex:0 0 auto}\n  [data-kfg-root] .kfg_edge{cursor:pointer;transition:opacity .15s}\n  [data-kfg-root] .kfg_edge:hover{opacity:.75}\n  [data-kfg-root] .dim-line{stroke:#9b978c;stroke-width:1}\n  [data-kfg-root] .dim-text{font-family:'Onest',sans-serif;font-weight:300;font-size:13px;fill:#6b6862;letter-spacing:.03em}\n\n  /* Detail */\n  [data-kfg-root] .kfg_detail{margin-top:var(--s-xs);background:#fff;border-radius:var(--r);padding:var(--s-xs)}\n  [data-kfg-root] .kfg_detail summary{display:none}\n  [data-kfg-root] .kfg_detail-inner{display:flex;align-items:center;gap:var(--s-s);position:relative}\n  [data-kfg-root] .kfg_detail-badge{position:absolute;top:var(--s-2xs);left:var(--s-2xs);z-index:2;font-size:10px;font-weight:500;\n    letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:var(--r);\n    background:#ffffffd9;color:#666;border:1px solid var(--hair)}\n  [data-kfg-root] .kfg_detail img{width:54%;min-width:200px;max-width:320px;flex:0 0 auto;display:block;border-radius:6px;background:var(--alt)}\n  [data-kfg-root] .kfg_detail-label{font-size:12.5px;color:#666;line-height:1.5;min-width:0}\n  [data-kfg-root] .kfg_detail-label b{display:block;font-weight:600;color:var(--ink);font-size:15px;margin-bottom:var(--s-3xs)}\n  [data-kfg-root] .kfg_detail-label span{display:block}\n  [data-kfg-root] .kfg_detail-label em{display:block;font-style:normal;font-size:10.5px;color:#9b978c;margin-top:var(--s-2xs)}\n  @media(max-width:560px){\n    [data-kfg-root] .kfg_detail{flex-direction:column;align-items:stretch;gap:var(--s-2xs)}\n    [data-kfg-root] .kfg_detail img{width:100%;max-width:none}\n    [data-kfg-root] .kfg_detail-label{text-align:center}\n  }\n\n  /* \u2500\u2500 Panel \u2500\u2500 */\n  [data-kfg-root] .kfg_panel{display:flex;flex-direction:column;gap:var(--s-m)}\n  [data-kfg-root] .kfg_step{border:1px solid var(--hair);border-radius:var(--r);padding:var(--s-s)}\n  @media(min-width:980px){[data-kfg-root] .kfg_step{padding:var(--s-m)}}\n  [data-kfg-root] .kfg_step-head{display:flex;align-items:baseline;gap:var(--s-xs);margin-bottom:var(--s-s)}\n  [data-kfg-root] .kfg_step-num{font-weight:500;font-size:12px;color:var(--ink);letter-spacing:.06em}\n  [data-kfg-root] .kfg_step-title{font-size:16px;font-weight:500}\n  [data-kfg-root] .kfg_step-sub{font-size:12.5px;color:#777;margin-left:auto;text-align:right}\n  [data-kfg-root] .kfg_sublabel{font-size:12px;color:#777;margin:var(--s-s) 0 var(--s-2xs)}\n\n  [data-kfg-root] .kfg_mat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s-2xs)}\n  [data-kfg-root] .kfg_mat{border:1.5px solid var(--hair);border-radius:var(--r);padding:var(--s-xs);cursor:pointer;background:#fff;\n    text-align:left;transition:border-color .15s}\n  [data-kfg-root] .kfg_mat.is-active{border-color:var(--ink)}\n  [data-kfg-root] .kfg_mat b{display:block;font-size:13.5px;font-weight:500;line-height:1.25}\n  [data-kfg-root] .kfg_mat small{font-weight:300;font-size:11px;color:#888;display:block;margin-top:var(--s-3xs);letter-spacing:.02em}\n\n  [data-kfg-root] .kfg_dekor-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--s-2xs);margin-top:var(--s-s)}\n  @media(min-width:560px){[data-kfg-root] .kfg_dekor-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}\n  [data-kfg-root] .kfg_dekor{border:1.5px solid var(--hair);border-radius:var(--r);cursor:pointer;padding:var(--s-3xs);background:#fff;\n    transition:border-color .15s;display:flex;flex-direction:column}\n  [data-kfg-root] .kfg_dekor.is-active{border-color:var(--ink)}\n  [data-kfg-root] .kfg_dekor .sw{aspect-ratio:1/1;width:100%;border-radius:5px;display:block;background-size:165%;background-position:center}\n  [data-kfg-root] .kfg_dekor span:last-child{display:block;font-size:10px;text-align:center;padding-top:var(--s-3xs);color:#666;\n    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:17px}\n  [data-kfg-root] .kfg_dekor-note{font-size:11px;color:#9b978c;margin-top:var(--s-2xs)}\n\n  [data-kfg-root] .kfg_chips{display:flex;flex-wrap:wrap;gap:var(--s-2xs)}\n  [data-kfg-root] .kfg_chip{border:1.5px solid var(--hair);border-radius:var(--r);background:#fff;padding:10px 16px;font-size:13.5px;\n    cursor:pointer;min-height:44px;display:inline-flex;align-items:center;gap:var(--s-2xs);transition:border-color .15s}\n  [data-kfg-root] .kfg_chip.is-active{border-color:var(--ink);font-weight:500}\n  [data-kfg-root] .kfg_chip small{font-size:11px;color:#888;font-weight:400}\n  [data-kfg-root] .kfg_chip:disabled{opacity:.4;cursor:not-allowed}\n\n  [data-kfg-root] .kfg_dims{display:grid;grid-template-columns:1fr 1fr;gap:var(--s-xs)}\n  [data-kfg-root] .kfg_field label{font-size:12px;color:#777;display:block;margin-bottom:var(--s-3xs)}\n  [data-kfg-root] .kfg_field .in{display:flex;align-items:center;border:1.5px solid var(--hair);border-radius:var(--r);overflow:hidden}\n  [data-kfg-root] .kfg_field input{border:0;outline:0;width:100%;padding:var(--s-xs);font-size:16px;font-weight:500;min-height:44px}\n  [data-kfg-root] .kfg_field .unit{padding-right:var(--s-xs);color:#999;font-size:13px}\n  [data-kfg-root] .kfg_field .range{font-weight:300;font-size:11px;color:#9b978c;margin-top:var(--s-3xs);display:block;letter-spacing:.03em}\n  [data-kfg-root] .kfg_field.is-error .in{border-color:#c0392b}\n  [data-kfg-root] .kfg_field .err{display:none;font-size:11.5px;color:#c0392b;margin-top:var(--s-3xs)}\n  [data-kfg-root] .kfg_field.is-error .err{display:block}\n  [data-kfg-root] .kfg_quick{margin-top:var(--s-s)}\n  [data-kfg-root] .kfg_quick p{font-size:12px;color:#777;margin-bottom:var(--s-2xs)}\n  [data-kfg-root] .kfg_quick-chips{display:flex;flex-wrap:wrap;gap:6px}\n  [data-kfg-root] .kfg_quick-chip{font-weight:300;font-size:12px;letter-spacing:.03em;padding:7px 10px;border:1px solid var(--hair);\n    border-radius:var(--r);background:var(--alt);cursor:pointer;transition:all .15s}\n  [data-kfg-root] .kfg_quick-chip:hover{border-color:var(--ink)}\n  [data-kfg-root] .kfg_quick-chip.is-active{background:var(--ink);color:#fff;border-color:var(--ink);font-weight:400}\n  [data-kfg-root] .kfg_measure{margin-top:var(--s-s);font-size:13px}\n  [data-kfg-root] .kfg_measure summary{cursor:pointer;color:#555;font-weight:500;list-style:none;display:inline-flex;align-items:center;gap:6px}\n  [data-kfg-root] .kfg_share button{display:inline-flex;align-items:center;justify-content:center;gap:7px}\n  [data-kfg-root] .kfg_measure p{margin-top:var(--s-2xs);color:#666;font-size:12.5px;line-height:1.55;background:var(--alt);\n    border-radius:var(--r);padding:var(--s-xs)}\n\n  [data-kfg-root] .kfg_radius{display:flex;align-items:flex-end;gap:var(--s-xs);flex-wrap:wrap}\n  [data-kfg-root] .kfg_radius .kfg_field{width:120px}\n  [data-kfg-root] .kfg_radius .kfg_field input{padding:9px var(--s-xs);font-size:14px;min-height:40px}\n  [data-kfg-root] .kfg_rule-note{margin-top:var(--s-2xs);font-size:12px;color:#9a6b12;background:var(--warn-bg);border-radius:var(--r);padding:var(--s-xs)}\n\n  [data-kfg-root] .kfg_edge-note{margin-top:var(--s-s);font-size:12.5px;color:#666;background:var(--alt);border-radius:var(--r);\n    padding:var(--s-xs);display:flex;gap:var(--s-2xs);align-items:flex-start}\n  [data-kfg-root] .kfg_trust span .ic-svg{width:13px;height:13px}\n  [data-kfg-root] .kfg_mpx-note{margin-top:var(--s-2xs);font-size:12px;color:#9a6b12;background:var(--warn-bg);border-radius:var(--r);padding:var(--s-xs);display:none}\n\n  [data-kfg-root] .kfg_check{display:flex;align-items:flex-start;gap:var(--s-xs);padding:var(--s-xs);border:1.5px solid var(--hair);\n    border-radius:var(--r);cursor:pointer;transition:border-color .15s}\n  [data-kfg-root] .kfg_check + .kfg_check{margin-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_check.is-active{border-color:var(--ink)}\n  [data-kfg-root] .kfg_check input{margin-top:3px;accent-color:var(--ink);width:16px;height:16px}\n  [data-kfg-root] .kfg_check b{font-size:13.5px;font-weight:500;display:block}\n  [data-kfg-root] .kfg_check small{font-size:12px;color:#777}\n  [data-kfg-root] .kfg_check .pr{margin-left:auto;font-weight:300;font-size:12px;color:#555;white-space:nowrap;letter-spacing:.02em}\n  [data-kfg-root] .kfg_custom{display:none;margin-top:var(--s-2xs);border:1.5px dashed var(--hair);border-radius:var(--r);padding:var(--s-s)}\n  [data-kfg-root] .kfg_custom.is-open{display:block}\n  [data-kfg-root] .kfg_custom textarea{width:100%;border:1.5px solid var(--hair);border-radius:var(--r);padding:var(--s-xs);\n    font-size:13px;min-height:64px;resize:vertical;outline:none}\n  [data-kfg-root] .kfg_custom textarea:focus{border-color:var(--ink)}\n  [data-kfg-root] .kfg_upload{margin-top:var(--s-2xs);border:1.5px dashed #c9c6bd;border-radius:var(--r);background:var(--alt);\n    padding:var(--s-s);text-align:center;font-size:12.5px;color:#666;cursor:pointer;transition:border-color .15s}\n  [data-kfg-root] .kfg_upload:hover{border-color:var(--ink)}\n  [data-kfg-root] .kfg_upload b{display:block;font-weight:500;color:var(--ink);margin-bottom:2px}\n  [data-kfg-root] .kfg_custom-hint{font-size:11.5px;color:#9a6b12;margin-top:var(--s-2xs)}\n\n  [data-kfg-root] .kfg_preset{display:flex;align-items:center;gap:var(--s-xs);padding:var(--s-xs);border:1.5px solid var(--hair);\n    border-radius:var(--r);transition:border-color .15s}\n  [data-kfg-root] .kfg_preset + .kfg_preset{margin-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_preset.is-active{border-color:var(--ink)}\n  [data-kfg-root] .kfg_preset b{font-size:13.5px;font-weight:500;display:block}\n  [data-kfg-root] .kfg_preset small{font-size:12px;color:#777}\n  [data-kfg-root] .kfg_preset .pr{margin-left:auto;font-weight:300;font-size:12px;color:#555;white-space:nowrap;letter-spacing:.02em}\n  [data-kfg-root] .kfg_stepper{display:inline-flex;align-items:center;gap:2px;border:1.5px solid var(--hair);border-radius:var(--r);overflow:hidden}\n  [data-kfg-root] .kfg_stepper button{border:0;background:#fff;width:36px;height:36px;font-size:17px;cursor:pointer;color:var(--ink)}\n  [data-kfg-root] .kfg_stepper button:hover{background:var(--alt)}\n  [data-kfg-root] .kfg_stepper [data-count]{min-width:26px;text-align:center;font-weight:500;font-size:14px}\n  [data-kfg-root] .kfg_cutlist{display:flex;flex-wrap:wrap;gap:var(--s-2xs);margin-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_cutitem{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--hair);border-radius:var(--r);\n    padding:6px 10px;font-size:12px;background:var(--alt)}\n  [data-kfg-root] .kfg_cutitem button{border:0;background:none;cursor:pointer;font-size:14px;color:#999;padding:0 2px;line-height:1}\n  [data-kfg-root] .kfg_cutitem button:hover{color:#c0392b}\n  [data-kfg-root] #stage.is-drawing{cursor:crosshair;touch-action:none}\n  [data-kfg-root] #stage.is-dragging{touch-action:none}\n  [data-kfg-root] .kfg_muster{background:var(--card);border-radius:var(--r);padding:var(--s-s);display:flex;gap:var(--s-xs);align-items:center}\n  [data-kfg-root] .kfg_muster .ic .ic-svg{width:22px;height:22px}\n  [data-kfg-root] .kfg_muster b{font-size:13.5px;font-weight:500;display:block}\n  [data-kfg-root] .kfg_muster small{font-size:12px;color:#666}\n  [data-kfg-root] .kfg_muster button{margin-left:auto;border:1px solid var(--ink);background:#fff;border-radius:var(--r);\n    padding:9px 14px;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;min-height:40px}\n\n  /* Summary */\n  [data-kfg-root] .kfg_summary{border:1px solid var(--hair);border-radius:var(--r);padding:var(--s-s);margin-top:var(--s-s);background:#fff}\n  [data-kfg-root] .kfg_sum-row{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--s-s)}\n  [data-kfg-root] .kfg_sum-price small{display:block;font-size:12px;color:#777}\n  [data-kfg-root] .kfg_sum-price .val{font-size:30px;font-weight:600;letter-spacing:-.01em;line-height:1.1}\n  [data-kfg-root] .kfg_sum-price .vat{font-size:11px;color:#999}\n  [data-kfg-root] .kfg_delivery{font-size:12.5px;text-align:right}\n  [data-kfg-root] .kfg_delivery b{display:block;font-weight:500}\n  [data-kfg-root] .kfg_delivery span{color:#777}\n  [data-kfg-root] .kfg_breakdown{margin-top:var(--s-xs);font-size:12.5px}\n  [data-kfg-root] .kfg_breakdown summary{cursor:pointer;color:#555;list-style:none;display:inline-flex;gap:6px;align-items:center}\n  [data-kfg-root] .kfg_breakdown summary::after{content:'\u25be';font-size:10px}\n  [data-kfg-root] .kfg_breakdown table{width:100%;margin-top:var(--s-2xs);border-collapse:collapse}\n  [data-kfg-root] .kfg_breakdown td{padding:var(--s-3xs) 0;color:#666;font-size:12px}\n  [data-kfg-root] .kfg_breakdown td:last-child{text-align:right;font-weight:300;letter-spacing:.02em}\n  [data-kfg-root] .kfg_breakdown tr.total td{border-top:1px solid var(--hair);padding-top:var(--s-2xs);color:var(--ink);font-weight:500}\n  [data-kfg-root] .kfg_cta{margin-top:var(--s-s);width:100%;border:0;border-radius:var(--r);background:var(--ink);color:#fff;\n    font-size:15px;font-weight:500;padding:var(--s-s);cursor:pointer;min-height:52px;transition:background .15s}\n  [data-kfg-root] .kfg_cta:hover{background:var(--deep)}\n  [data-kfg-root] .kfg_cta.is-sonder{background:#fff;color:var(--ink);border:1.5px solid var(--ink)}\n  [data-kfg-root] .kfg_trust{display:flex;justify-content:center;gap:var(--s-s);margin-top:var(--s-xs);font-size:11px;color:#888;flex-wrap:wrap}\n  [data-kfg-root] .kfg_trust span{display:inline-flex;align-items:center;gap:5px}\n  [data-kfg-root] .kfg_share{display:flex;gap:var(--s-2xs);margin-top:var(--s-s)}\n  [data-kfg-root] .kfg_share button{flex:1;border:1px solid var(--hair);background:var(--alt);border-radius:var(--r);\n    padding:10px;font-size:12.5px;cursor:pointer;min-height:44px}\n  [data-kfg-root] .kfg_share button:hover{border-color:var(--ink)}\n\n  /* \u2550\u2550 MOBILE \u2550\u2550 */\n  /* Sticky Mini-Vorschau: erscheint, sobald die gro\u00dfe Vorschau aus dem Bild scrollt */\n  [data-kfg-root] .kfg_mini{position:fixed;left:0;right:0;z-index:45;background:#fff;border-bottom:1px solid var(--hair);\n    display:flex;align-items:center;gap:var(--s-xs);padding:var(--s-2xs) var(--s-s);\n    box-shadow:0 6px 18px rgba(0,0,0,.06);transform:translateY(-110%);transition:transform .22s ease}\n  [data-kfg-root] .kfg_mini.is-on{transform:translateY(0)}\n  [data-kfg-root] .kfg_mini-plate{flex:0 0 auto;height:34px;max-width:64px;border-radius:4px;background-size:cover;background-position:center;\n    border:1px solid #00000018}\n  [data-kfg-root] .kfg_mini-plate.is-round{border-radius:50%}\n  [data-kfg-root] .kfg_mini-txt{min-width:0;line-height:1.25}\n  [data-kfg-root] .kfg_mini-txt b{display:block;font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  [data-kfg-root] .kfg_mini-txt span{display:block;font-size:11px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  [data-kfg-root] .kfg_mini button{margin-left:auto;flex:0 0 auto;border:1px solid var(--hair);background:var(--alt);border-radius:var(--r);\n    padding:7px 12px;font-size:12px;cursor:pointer;min-height:36px}\n  @media(min-width:980px){[data-kfg-root] .kfg_mini{display:none}}\n\n  @media(max-width:979px){\n    [data-kfg-root] .kfg_hero{padding-top:var(--s-m)}\n    [data-kfg-root] .kfg_hero h1{font-size:26px}\n    [data-kfg-root] .kfg_hero p{font-size:14px}\n    [data-kfg-root] .kfg_layout{padding-top:var(--s-2xs);gap:var(--s-s)}\n    [data-kfg-root] .kfg_preview{padding:var(--s-xs)}\n    [data-kfg-root] .kfg_preview-stage, [data-kfg-root] #stage3d{aspect-ratio:10/6.4}\n    /* Detailansicht einklappbar, spart ~300px vor dem ersten Schritt */\n    [data-kfg-root] .kfg_detail{display:block;padding:0;background:transparent}\n    [data-kfg-root] .kfg_detail summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:6px;\n      font-size:12.5px;color:#555;font-weight:500;background:#fff;border-radius:var(--r);padding:10px var(--s-xs);min-height:44px}\n    [data-kfg-root] .kfg_detail summary::after{content:'\u25be';margin-left:auto;font-size:10px;color:#999}\n    [data-kfg-root] .kfg_detail[open] summary::after{content:'\u25b4'}\n    [data-kfg-root] .kfg_detail-inner{display:flex;flex-direction:column;gap:var(--s-2xs);background:#fff;border-radius:var(--r);\n      padding:var(--s-xs);margin-top:var(--s-3xs)}\n    [data-kfg-root] .kfg_detail img{width:100%;max-width:none;min-width:0}\n    [data-kfg-root] .kfg_detail-badge{top:var(--s-m);left:var(--s-m)}\n    [data-kfg-root] .kfg_detail-label{text-align:left}\n    /* Preset-Zeilen: Stepper unter den Text statt gequetscht daneben */\n    [data-kfg-root] .kfg_preset{flex-wrap:wrap}\n    [data-kfg-root] .kfg_preset .pr{margin-left:0;order:3}\n    [data-kfg-root] .kfg_preset .kfg_stepper{margin-left:auto;order:4}\n    [data-kfg-root] .kfg_muster{flex-wrap:wrap}\n    [data-kfg-root] .kfg_muster button{margin-left:0;width:100%}\n    [data-kfg-root] .kfg_modal-box{padding:var(--s-s);border-radius:12px;max-height:94vh}\n    [data-kfg-root] .kfg_step{padding:var(--s-s) var(--s-xs)}\n  }\n  [data-kfg-root] .kfg_bar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--hair);\n    padding:var(--s-xs) var(--s-s) calc(var(--s-xs) + env(safe-area-inset-bottom));z-index:60;\n    display:flex;align-items:center;gap:var(--s-xs);box-shadow:0 -8px 24px rgba(0,0,0,.06)}\n  [data-kfg-root] .kfg_bar .p{line-height:1.15}\n  [data-kfg-root] .kfg_bar .p .val{font-size:19px;font-weight:600;display:block}\n  [data-kfg-root] .kfg_bar .p small{font-size:10.5px;color:#777;white-space:nowrap}\n  [data-kfg-root] .kfg_bar .kfg_cta{margin:0;flex:1;padding:13px;min-height:48px;font-size:14px}\n  @media(min-width:980px){[data-kfg-root] .kfg_bar{display:none}}\n\n  [data-kfg-root] .kfg_modal{position:fixed;inset:0;background:rgba(10,10,10,.45);z-index:100;display:flex;align-items:center;justify-content:center;padding:var(--s-s)}\n  [data-kfg-root] .kfg_modal[hidden]{display:none}\n  [data-kfg-root] .kfg_modal-box{background:#fff;border-radius:16px;max-width:960px;width:100%;max-height:90vh;overflow:auto;padding:var(--s-m)}\n  [data-kfg-root] .kfg_modal-head{display:flex;align-items:center;gap:var(--s-xs);margin-bottom:var(--s-s)}\n  [data-kfg-root] .kfg_modal-head b{font-size:18px;font-weight:600}\n  [data-kfg-root] .kfg_modal-tag{font-size:11px;color:#9a6b12;background:var(--warn-bg);border-radius:var(--r);padding:3px 8px}\n  [data-kfg-root] .kfg_modal-head button{margin-left:auto;border:0;background:var(--alt);border-radius:var(--r);width:36px;height:36px;font-size:20px;cursor:pointer}\n  [data-kfg-root] .kfg_modal-grid{display:grid;grid-template-columns:1fr;gap:var(--s-m)}\n  @media(min-width:760px){[data-kfg-root] .kfg_modal-grid{grid-template-columns:55fr 45fr}}\n  [data-kfg-root] .kfg_modal-draw{background:var(--card);border-radius:var(--r);padding:var(--s-xs)}\n  [data-kfg-root] .kfg_modal-draw svg{width:100%;display:block}\n  [data-kfg-root] .kfg_modal-draw p{font-size:11px;color:#8a877f;text-align:center;padding-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_modal-data table{width:100%;border-collapse:collapse;font-size:13px}\n  [data-kfg-root] .kfg_modal-data td{padding:6px 0;border-bottom:1px solid var(--hair);vertical-align:top}\n  [data-kfg-root] .kfg_modal-data td:first-child{color:#777;width:38%;padding-right:var(--s-xs)}\n  [data-kfg-root] .kfg_modal-data .props{margin-top:var(--s-s);background:var(--alt);border-radius:var(--r);padding:var(--s-xs);\n    font-size:11px;color:#555;font-weight:300;letter-spacing:.02em;line-height:1.7;word-break:break-all}\n  [data-kfg-root] .kfg_modal-data .props b{display:block;font-weight:500;color:var(--ink);font-size:11.5px;margin-bottom:4px;letter-spacing:0}\n  [data-kfg-root] .toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%) translateY(20px);background:var(--deep);color:#fff;\n    padding:10px 18px;border-radius:var(--r);font-size:13px;opacity:0;pointer-events:none;transition:all .25s;z-index:70}\n  [data-kfg-root] .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}\n\n  /* \u2500\u2500 Isolationsschicht: Webflow-Site-CSS darf nicht in den Konfigurator bluten,\n        und der Konfigurator faerbt/resettet nichts ausserhalb seines Containers.\n        :where() hat Spezifitaet 0 \u2192 eigene Regeln gewinnen immer. \u2500\u2500 */\n  [data-kfg-root]{\n    --ink:#1E1E1E; --deep:#0A0A0A; --card:#F2F0EB; --alt:#FAFAFA; --hair:#E5E5E5;\n    --ok:#1c7a3d; --ok-bg:#e8f4ec; --warn:#9a6b12; --warn-bg:#faf3e2;\n    --s-3xs:4px; --s-2xs:8px; --s-xs:12px; --s-s:16px; --s-m:24px; --s-l:32px; --s-xl:48px; --s-2xl:64px;\n    --r:8px;\n    display:block; box-sizing:border-box;\n    font-family:'Onest','DM Sans',sans-serif; font-size:15px; font-weight:400;\n    line-height:1.45; color:#1E1E1E; background:#fff; text-align:left;\n    letter-spacing:normal; text-transform:none; -webkit-font-smoothing:antialiased;\n  }\n  [data-kfg-root] :where(*, *::before, *::after){\n    box-sizing:border-box; margin:0; padding:0;\n    font-family:inherit; line-height:inherit; color:inherit;\n    letter-spacing:normal; text-transform:none; text-align:inherit;\n  }\n  [data-kfg-root] :where(b, strong){font-weight:600}\n  [data-kfg-root] :where(small){font-size:inherit}\n  [data-kfg-root] :where(button){background:none;border:none;cursor:pointer;font:inherit}\n  [data-kfg-root] :where(img, svg){max-width:100%}\n  [data-kfg-root] :where(p, span, div, label, li, td, th, summary){font-weight:inherit}\n\n  /* Ueberschriften grundsaetzlich schwarz (Sascha 26.07.) */\n  [data-kfg-root] .kfg_step-title,\n  [data-kfg-root] .kfg_step-num,\n  [data-kfg-root] .kfg_sublabel,\n  [data-kfg-root] .kfg_mat b,\n  [data-kfg-root] .kfg_preset b,\n  [data-kfg-root] .kfg_check b,\n  [data-kfg-root] .kfg_muster b,\n  [data-kfg-root] .kfg_modal-head b,\n  [data-kfg-root] .kfg_detail-label b,\n  [data-kfg-root] .kfg_upload b,\n  [data-kfg-root] h1, [data-kfg-root] h2, [data-kfg-root] h3, [data-kfg-root] h4,\n  [data-kfg-root] summary{color:#1E1E1E}\n\n  /* Schritt 05: Zeilen sauber ausrichten statt umbrechen */\n  [data-kfg-root] .kfg_preset,\n  [data-kfg-root] .kfg_check{\n    display:flex; align-items:center; gap:var(--s-xs);\n    padding:var(--s-xs) var(--s-s); min-height:56px;\n  }\n  [data-kfg-root] .kfg_preset > span:first-of-type,\n  [data-kfg-root] .kfg_check > span:first-of-type{\n    flex:1 1 auto; min-width:0; display:block;\n  }\n  [data-kfg-root] .kfg_preset b,\n  [data-kfg-root] .kfg_check b{\n    display:block; font-size:13.5px; font-weight:500; line-height:1.3;\n  }\n  [data-kfg-root] .kfg_preset small,\n  [data-kfg-root] .kfg_check small{\n    display:block; font-size:12px; line-height:1.35; color:#777; margin-top:2px;\n  }\n  [data-kfg-root] .kfg_preset .pr,\n  [data-kfg-root] .kfg_check .pr{\n    flex:0 0 auto; margin-left:auto; white-space:nowrap;\n    font-size:12px; font-weight:400; color:#555; letter-spacing:.02em; text-align:right;\n  }\n  [data-kfg-root] .kfg_preset .kfg_stepper{flex:0 0 auto; margin-left:var(--s-2xs)}\n  @media(max-width:560px){\n    [data-kfg-root] .kfg_preset,\n    [data-kfg-root] .kfg_check{flex-wrap:wrap; row-gap:var(--s-2xs)}\n    [data-kfg-root] .kfg_preset > span:first-of-type,\n    [data-kfg-root] .kfg_check > span:first-of-type{flex:1 1 100%}\n    [data-kfg-root] .kfg_preset .pr,\n    [data-kfg-root] .kfg_check .pr{margin-left:0; order:3; text-align:left}\n    [data-kfg-root] .kfg_preset .kfg_stepper{margin-left:auto; order:4}\n  }\n  /* Dekor-Kacheln: Beschriftung darf nicht abgeschnitten werden */\n  [data-kfg-root] .kfg_dekor{overflow:visible}\n  [data-kfg-root] .kfg_dekor > span:last-child{\n    display:block; font-size:11px; line-height:1.25; color:#1E1E1E;\n    white-space:normal; word-break:normal; hyphens:none;\n  }\n";

/* ═══════════════════════ MARKUP ═══════════════════════ */
var KFG_MARKUP = "<div class=\"kfg_layout\">\n\n  <!-- \u2550\u2550 PREVIEW \u2550\u2550 -->\n  <div class=\"kfg_stickycol\" id=\"stickyCol\">\n    <div class=\"kfg_preview\">\n      <div class=\"kfg_preview-badge\" id=\"badge\"><span class=\"dot\"></span><span id=\"badgeText\">Ab Lager</span></div>\n      <div class=\"kfg_viewtoggle\">\n        <button id=\"btn2d\" class=\"is-active\">2D</button>\n        <button id=\"btn3d\">3D</button>\n      </div>\n      <svg class=\"kfg_preview-stage\" id=\"stage\" viewBox=\"0 0 600 444\" role=\"img\" aria-label=\"Vorschau der konfigurierten Tischplatte\"></svg>\n      <canvas id=\"stage3d\"></canvas>\n      <details class=\"kfg_detail\" id=\"detailCard\" open>\n        <summary>Kante &amp; Material im Detail</summary>\n        <div class=\"kfg_detail-inner\">\n          <span class=\"kfg_detail-badge\">Vorschaubild</span><img id=\"detailImg\" alt=\"Detailansicht der Kante \u2014 Vorschaubild\" src=\"\">\n          <div class=\"kfg_detail-label\" id=\"detailLabel\"></div>\n        </div>\n      </details>\n      <div class=\"kfg_preview-hint\" id=\"previewHint\">Draufsicht, ma\u00dfstabsgetreu \u00b7 Kanten anklickbar</div>\n    </div>\n\n    <div class=\"kfg_summary\">\n      <div class=\"kfg_sum-row\">\n        <div class=\"kfg_sum-price\">\n          <small id=\"priceLabel\">Dein Preis</small>\n          <span class=\"val\" id=\"price\">\u2014</span>\n          <span class=\"vat\">inkl. MwSt., kostenloser Versand bis 120 cm</span>\n        </div>\n        <div class=\"kfg_delivery\">\n          <b id=\"delivDate\">\u2014</b>\n          <span id=\"delivSub\">\u2014</span>\n        </div>\n      </div>\n      <details class=\"kfg_breakdown\">\n        <summary>Preis-Aufschl\u00fcsselung</summary>\n        <table id=\"breakdown\"></table>\n      </details>\n      <button class=\"kfg_cta\" id=\"cta\">In den Warenkorb</button>\n      <div class=\"kfg_trust\">\n        <span><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 21h18M5 21V10l5 3.5V10l5 3.5V4h4v17\"/></svg> Manufaktur seit 1897</span><span><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3.2\"/><path d=\"M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1\"/></svg> CNC-pr\u00e4zise Kanten</span><span><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M1.5 16V6h12v10h-12zM13.5 9h4.5l4 4v3h-3\"/><circle cx=\"6\" cy=\"18\" r=\"1.8\"/><circle cx=\"17\" cy=\"18\" r=\"1.8\"/></svg> Versand bis 120 cm gratis</span>\n      </div>\n      <div class=\"kfg_share\">\n        <button id=\"btnShare\"><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9.5 14.5l5-5M8.5 12l-2 2a3.5 3.5 0 105 5l2-2M15.5 12l2-2a3.5 3.5 0 10-5-5l-2 2\"/></svg> Konfiguration teilen</button>\n        <button id=\"btnMail\"><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"M3 7.5l9 6 9-6\"/></svg> Per E-Mail senden</button>\n      </div>\n    </div>\n  </div>\n\n  <!-- \u2550\u2550 PANEL \u2550\u2550 -->\n  <div class=\"kfg_panel\">\n\n    <!-- 01 Material & Dekor -->\n    <section class=\"kfg_step\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">01</span><span class=\"kfg_step-title\">Material &amp; Dekor</span></div>\n      <div class=\"kfg_mat-grid\" id=\"matGrid\"></div>\n      <div id=\"mpxSurfaceBlock\" style=\"display:none\">\n        <p class=\"kfg_sublabel\">Oberfl\u00e4che</p>\n        <div class=\"kfg_chips\" id=\"mpxSurfaceChips\">\n          <button class=\"kfg_chip is-active\" data-sf=\"natur\">Birke natur <small>geschliffen</small></button>\n          <button class=\"kfg_chip\" data-sf=\"hpl\">HPL-Laminat <small>alle Dekore</small></button>\n          <button class=\"kfg_chip\" data-sf=\"lack\">Klarlack <small>Angebot</small></button>\n        </div>\n      </div>\n      <div class=\"kfg_dekor-grid\" id=\"dekorGrid\"></div>\n      <div id=\"absColorBlock\">\n        <p class=\"kfg_sublabel\">ABS-Kantenfarbe</p>\n        <div class=\"kfg_chips\" id=\"absChips\"></div>\n      </div>\n      <p class=\"kfg_dekor-note\" id=\"dekorNote\">Original-Produktfotos aus dem Kessler-Archiv. Farbige ABS-Kanten sind f\u00fcr 18 und 25 mm verf\u00fcgbar.</p>\n    </section>\n\n    <!-- 02 Form -->\n    <section class=\"kfg_step\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">02</span><span class=\"kfg_step-title\">Form</span></div>\n      <div class=\"kfg_chips\" id=\"formChips\">\n        <button class=\"kfg_chip is-active\" data-form=\"rect\">\u25ad Rechteck</button>\n        <button class=\"kfg_chip\" data-form=\"round\">\u25ef Rund</button>\n        <button class=\"kfg_chip\" data-form=\"lform\">\u2310 L-Form</button>\n        <button class=\"kfg_chip\" data-form=\"szwal\">\u2334 N\u00e4hmaschinen-Platte</button>\n      </div>\n      <div id=\"cornerBlock\">\n        <p class=\"kfg_sublabel\">Ecken abrunden</p>\n        <div class=\"kfg_radius\">\n          <div class=\"kfg_chips\" id=\"cornerChips\"></div>\n          <div class=\"kfg_field\">\n            <label for=\"inC\">Wunschradius</label>\n            <div class=\"in\"><input id=\"inC\" type=\"number\" inputmode=\"numeric\" placeholder=\"frei\" min=\"0\" max=\"300\"><span class=\"unit\">mm</span></div>\n          </div>\n        </div>\n        <div class=\"kfg_rule-note\" id=\"cornerRule\" style=\"display:none\"></div>\n      </div>\n    </section>\n\n    <!-- 03 Ma\u00df -->\n    <section class=\"kfg_step\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">03</span><span class=\"kfg_step-title\">Ma\u00df</span>\n        <span class=\"kfg_step-sub\" id=\"massHint\"></span></div>\n      <div class=\"kfg_dims\" id=\"dimsRect\">\n        <div class=\"kfg_field\" id=\"fL\">\n          <label for=\"inL\">L\u00e4nge</label>\n          <div class=\"in\"><input id=\"inL\" type=\"number\" inputmode=\"numeric\" value=\"120\" min=\"30\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeL\"></span><span class=\"err\" id=\"errL\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fB\">\n          <label for=\"inB\">Breite</label>\n          <div class=\"in\"><input id=\"inB\" type=\"number\" inputmode=\"numeric\" value=\"60\" min=\"30\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeB\"></span><span class=\"err\" id=\"errB\"></span>\n        </div>\n      </div>\n      <div class=\"kfg_dims\" id=\"dimsRound\" style=\"display:none\">\n        <div class=\"kfg_field\" id=\"fD\" style=\"grid-column:1/-1\">\n          <label for=\"inD\">Durchmesser \u00d8</label>\n          <div class=\"in\"><input id=\"inD\" type=\"number\" inputmode=\"numeric\" value=\"80\" min=\"30\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeD\"></span><span class=\"err\" id=\"errD\"></span>\n        </div>\n      </div>\n      <div class=\"kfg_dims\" id=\"dimsLform\" style=\"display:none\">\n        <div class=\"kfg_field\" id=\"fLL\">\n          <label for=\"inLL\">Gesamtl\u00e4nge</label>\n          <div class=\"in\"><input id=\"inLL\" type=\"number\" inputmode=\"numeric\" value=\"180\" min=\"30\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeLL\"></span><span class=\"err\" id=\"errLL\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fLB\">\n          <label for=\"inLB\">Gesamtbreite</label>\n          <div class=\"in\"><input id=\"inLB\" type=\"number\" inputmode=\"numeric\" value=\"120\" min=\"30\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeLB\"></span><span class=\"err\" id=\"errLB\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fAW\">\n          <label for=\"inAW\">Ausklinkung Breite</label>\n          <div class=\"in\"><input id=\"inAW\" type=\"number\" inputmode=\"numeric\" value=\"90\" min=\"10\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeAW\"></span><span class=\"err\" id=\"errAW\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fAH\">\n          <label for=\"inAH\">Ausklinkung Tiefe</label>\n          <div class=\"in\"><input id=\"inAH\" type=\"number\" inputmode=\"numeric\" value=\"60\" min=\"10\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeAH\"></span><span class=\"err\" id=\"errAH\"></span>\n        </div>\n        <div class=\"kfg_rule-note\" style=\"grid-column:1/-1\">Innenecke wird automatisch verrundet: R50 bei M\u00f6belplatte \u00b7 R10 bei Multiplex &amp; Compact (Fertigungsregel).</div>\n      </div>\n      <div id=\"dimsSzwal\" style=\"display:none\">\n        <p class=\"kfg_sublabel\">Plattenbreite</p>\n        <div class=\"kfg_chips\" id=\"swW\">\n          <button class=\"kfg_chip\" data-v=\"106\">106 cm</button>\n          <button class=\"kfg_chip is-active\" data-v=\"120\">120 cm</button>\n          <button class=\"kfg_chip\" data-v=\"125\">125 cm</button>\n        </div>\n        <p class=\"kfg_sublabel\">Plattentiefe</p>\n        <div class=\"kfg_chips\" id=\"swD\">\n          <button class=\"kfg_chip\" data-v=\"50\">50 cm</button>\n          <button class=\"kfg_chip\" data-v=\"55\">55 cm</button>\n          <button class=\"kfg_chip is-active\" data-v=\"60\">60 cm</button>\n        </div>\n        <p class=\"kfg_sublabel\">Maschinen-Ausschnitt (Tiefe 18 cm)</p>\n        <div class=\"kfg_chips\" id=\"swC\">\n          <button class=\"kfg_chip\" data-v=\"48\">48 cm</button>\n          <button class=\"kfg_chip is-active\" data-v=\"52\">52 cm</button>\n          <button class=\"kfg_chip\" data-v=\"61.7\">61,7 cm</button>\n        </div>\n        <div class=\"kfg_rule-note\">Standardma\u00dfe \u2014 <strong>jedes andere Ma\u00df ist m\u00f6glich</strong>, ebenso Eck-Ausklinkung und U-Ausschnitt: bitte \u00fcber \u201eEigenes Bohrbild / Skizze\" in Schritt 05 angeben. Fertigung aus Multiplex + Laminat + ABS-Kante.</div>\n      </div>\n      <div class=\"kfg_quick\" id=\"quickBlock\">\n        <p>Ab Lager \u2014 sofort lieferbar:</p>\n        <div class=\"kfg_quick-chips\" id=\"quickChips\"></div>\n      </div>\n      <details class=\"kfg_measure\">\n        <summary><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 16.5L16.5 3l4.5 4.5L7.5 21zM7.5 13l2 2M10.5 10l2 2M13.5 7l2 2\"/></svg> Richtig messen \u2014 so geht's</summary>\n        <p>Miss die gew\u00fcnschte Fl\u00e4che an der breitesten Stelle und rechne bei Wandmontage 5&nbsp;mm Luft ein. Bei Gestellen: Platten\u00fcberstand 5\u201315&nbsp;cm je Seite einplanen. Unsicher? Ruf uns an \u2014 wir pr\u00fcfen dein Ma\u00df kostenlos vor der Fertigung.</p>\n      </details>\n    </section>\n\n    <!-- 04 St\u00e4rke & Kante -->\n    <section class=\"kfg_step\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">04</span><span class=\"kfg_step-title\">St\u00e4rke &amp; Kante</span></div>\n      <div class=\"kfg_chips\" id=\"thickChips\"></div>\n      <p class=\"kfg_sublabel\">Kantenprofil</p>\n      <div class=\"kfg_chips\" id=\"edgeChips\"></div>\n      <div id=\"edgeRadiusBlock\" style=\"display:none\">\n        <p class=\"kfg_sublabel\">Rundungsradius der Kante</p>\n        <div class=\"kfg_chips\" id=\"edgeRadiusChips\">\n          <button class=\"kfg_chip is-active\" data-er=\"3\">R3</button>\n          <button class=\"kfg_chip\" data-er=\"6\">R6</button>\n          <button class=\"kfg_chip\" data-er=\"9\">R9</button>\n        </div>\n      </div>\n      <div class=\"kfg_mpx-note\" id=\"mpxNote\">Multiplex: sichtbare Birkenschichtkante \u2014 leicht gefast ist serienm\u00e4\u00dfig. 45\u00b0 gefr\u00e4st oder halbrund gegen Aufpreis; Seiten auf Wunsch mit ABS oder klarlackiert (Angebot).</div>\n      <div class=\"kfg_edge-note\" id=\"edgeTip\"><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 3l6 16 2.5-6.5L20 10z\"/></svg><span>Tipp: Klicke in der 2D-Vorschau direkt auf eine Kante, um sie einzeln zu \u00e4ndern.</span></div>\n    </section>\n\n    <!-- 05 Ausschnitte & Bohrungen -->\n    <section class=\"kfg_step\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">05</span><span class=\"kfg_step-title\">Ausschnitte &amp; Bohrungen</span>\n        <span class=\"kfg_step-sub\">optional</span></div>\n      <label class=\"kfg_check\"><input type=\"checkbox\" data-x=\"bohr\">\n        <span><b>Montagebohrungen 4\u00d7 \u00d88</b><small>vorgebohrt f\u00fcr g\u00e4ngige Gestelle</small></span><span class=\"pr\">+ 9,90&nbsp;\u20ac</span></label>\n      <div class=\"kfg_preset\" data-preset=\"kabel\">\n        <span><b>Kabeldurchlass \u00d860</b><small>inkl. Abdeckung \u2014 frei positionierbar</small></span>\n        <span class=\"pr\">+ 14,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <div class=\"kfg_preset\" data-preset=\"usb\">\n        <span><b>USB-/Steckdosen-Ausschnitt</b><small>26,5 \u00d7 10 cm \u2014 frei positionierbar</small></span>\n        <span class=\"pr\">+ 24,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <div class=\"kfg_preset\" data-preset=\"spuele\">\n        <span><b>Sp\u00fclen-Ausschnitt</b><small>78 \u00d7 43 cm \u2014 K\u00fcchen-Arbeitsplatte</small></span>\n        <span class=\"pr\">+ 79&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <div class=\"kfg_preset\" data-preset=\"induktion\">\n        <span><b>Induktionsfeld-Ausschnitt</b><small>56 \u00d7 49 cm \u2014 K\u00fcchen-Arbeitsplatte</small></span>\n        <span class=\"pr\">+ 79&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <label class=\"kfg_check\"><input type=\"checkbox\" data-x=\"custom\">\n        <span><b>Eigenes Bohrbild / Skizze</b><small>frei nach deiner Vorgabe \u2014 CNC-gefr\u00e4st</small></span><span class=\"pr\">Preis im Angebot</span></label>\n      <div class=\"kfg_custom\" id=\"customBlock\">\n        <textarea id=\"customText\" placeholder=\"Beschreibe kurz, was du brauchst \u2014 z. B. \u201eEck-Ausklinkung 20\u00d715 cm hinten links\u201c.\"></textarea>\n        <div class=\"kfg_upload\" id=\"uploadZone\">\n          <b>Skizze oder Zeichnung hochladen</b>\n          PDF, Foto, DXF \u2014 oder einfach sp\u00e4ter per E-Mail an uns schicken\n          <input type=\"file\" id=\"uploadInput\" hidden>\n        </div>\n        <p class=\"kfg_custom-hint\">Mit eigener Skizze wird deine Platte individuell gefertigt \u2014 verbindliches Angebot in 24&nbsp;h.</p>\n      </div>\n      <p class=\"kfg_sublabel\">Oder direkt in der 2D-Vorschau einzeichnen</p>\n      <div class=\"kfg_chips\">\n        <button class=\"kfg_chip\" id=\"drawRect\" data-draw=\"r\">\u25ad Ausschnitt zeichnen</button>\n        <button class=\"kfg_chip\" id=\"drawCircle\" data-draw=\"c\">\u25ef Runden Ausschnitt zeichnen</button>\n      </div>\n      <div class=\"kfg_cutlist\" id=\"cutList\"></div>\n      <p class=\"kfg_custom-hint\" id=\"drawHint\" style=\"display:none\">Zeichnen-Modus: In der Vorschau aufziehen. Eingezeichnete Ausschnitte werden CNC-gefr\u00e4st und im Angebot bepreist.</p>\n      <div class=\"kfg_muster\" style=\"margin-top:var(--s-s)\">\n        <span class=\"ic\"><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"4\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"13\" y=\"4\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"4\" y=\"13\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"13\" y=\"13\" width=\"7\" height=\"7\" rx=\"1.5\"/></svg></span>\n        <span><b>Unsicher beim Dekor?</b><small>Musterbox mit 4 Dekoren \u2014 4,90&nbsp;\u20ac, voll angerechnet beim Kauf</small></span>\n        <button type=\"button\" id=\"btnMuster\">Muster bestellen</button>\n      </div>\n    </section>\n\n  </div>\n</div>\n\n<div class=\"kfg_bar\">\n  <div class=\"p\"><span class=\"val\" id=\"priceBar\">\u2014</span><small id=\"delivBar\">\u2014</small></div>\n  <button class=\"kfg_cta\" id=\"ctaBar\">In den Warenkorb</button>\n</div>\n\n<div class=\"kfg_mini\" id=\"miniBar\" aria-hidden=\"true\">\n  <span class=\"kfg_mini-plate\" id=\"miniPlate\"></span>\n  <span class=\"kfg_mini-txt\"><b id=\"miniTitle\">\u2014</b><span id=\"miniSub\">\u2014</span></span>\n  <button id=\"miniJump\" type=\"button\">Vorschau</button>\n</div>\n\n<div class=\"toast\" id=\"toast\"></div>\n\n<div class=\"kfg_modal\" id=\"orderModal\" hidden>\n  <div class=\"kfg_modal-box\">\n    <div class=\"kfg_modal-head\"><b>So kommt deine Bestellung bei uns an</b>\n      <span class=\"kfg_modal-tag\">Demo \u00b7 interne Ansicht</span>\n      <button id=\"omClose\" aria-label=\"Schlie\u00dfen\">\u00d7</button></div>\n    <div class=\"kfg_modal-grid\">\n      <div class=\"kfg_modal-draw\">\n        <svg id=\"omSvg\" viewBox=\"0 0 600 444\"></svg>\n        <p>Fertigungszeichnung \u2014 automatisch aus der Konfiguration erzeugt (inkl. Ausschnitt-Abst\u00e4nde)</p>\n      </div>\n      <div class=\"kfg_modal-data\" id=\"omData\"></div>\n    </div>\n  </div>\n</div>";

/* ═══════════════════════ APP ═══════════════════════ */
function KFG_APP(shopData){

/* ═══════ Produktmatrix (Shopify-Lagerartikel: [EUR, VariantId, SKU]) ═══════ */
let SHOP = {};

/* ═══════ Bilder (injiziert) ═══════ */
const ASSET=(window.__KFG_BASE||'')+'/assets/kfg/';
const TEX = Object.fromEntries(["weiss", "schwarz", "asche-grau", "kaszmir", "sosna-bielona", "ahorn", "buk", "sonoma-eiche", "eiche-artison", "sperrholz-natur", "marmor-weiss", "marmor-schwarz", "czarny", "hikora", "alaska-weiss", "szary", "eiche-kamienny"].map(k=>[k,ASSET+'top/'+k+'.webp']));
const KANTE = Object.fromEntries(["schwarz_18", "schwarz_28", "schwarz_40", "asche-grau_18", "asche-grau_28", "kaszmir_18", "kaszmir_28", "kaszmir_36", "sosna-bielona_18", "sosna-bielona_28", "sosna-bielona_36", "ahorn_18", "ahorn_28", "ahorn_36", "buk_18", "buk_20", "buk_28", "buk_40", "sonoma-eiche_18", "sonoma-eiche_28", "sonoma-eiche_36", "eiche-artison_18", "eiche-artison_28", "eiche-artison_36", "weiss_36", "hikora_18", "hikora_28", "hikora_36", "mpx_21", "mpx_40", "compact_12", "compact_weiss", "compact_asche-grau", "compact_marmor-weiss", "compact_marmor-schwarz", "compact_czarny", "alaska-weiss_36", "eiche-kamienny_18", "eiche-kamienny_28", "eiche-kamienny_36", "szary_28"].map(k=>[k,ASSET+'kante/'+k+'.webp']));

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
  dekor:   {maxL:270, maxB:200, maxD:160, minCorner:30, cornerNote:'Möbelplatte (ABS-Kante): Außenradien mind. R30 — kleinere Radien sind fertigungstechnisch nicht möglich.'},
  compact: {maxL:238, maxB:120, maxD:120, minCorner:0, cornerNote:''},
  mpx:     {maxL:238, maxB:120, maxD:120, minCorner:0, cornerNote:''}
};

const DEKOR_MOEBEL = [
  ['weiss','Weiß'],['alaska-weiss','Alaska Weiß'],['sosna-bielona','Kiefer Weiß'],['kaszmir','Kaschmir'],
  ['asche-grau','Asche Grau'],['szary','Grau'],['schwarz','Schwarz'],
  ['ahorn','Ahorn'],['buk','Buche'],['sonoma-eiche','Eiche Sonoma'],['eiche-artison','Eiche Artison'],
  ['eiche-kamienny','Eiche Kamienny'],['hikora','Eiche Hickory']
];
/* Auf Multiplex kann jedes Laminat der Möbelplatten-Palette aufgeklebt werden (Sascha 26.07.) */
const DEKOR_HPL = DEKOR_MOEBEL;
const MATERIALS = {
  dekor:   { name:'Möbelplatte', sub:'ab 25,90 € · 18/25/36 mm',
             thick:[['18','18 mm'],['25','25 mm'],['36','36 mm']], def:'25', dekore:DEKOR_MOEBEL, hasABS:true },
  compact: { name:'Compact / HPL', sub:'ab 89 € · 12 mm',
             thick:[['12','12 mm Vollkern']], def:'12',
             dekore:[['weiss','Weiß'],['czarny','Schwarz'],['asche-grau','Asche Grau'],['marmor-weiss','Weißer Marmor'],['marmor-schwarz','Schwarzer Marmor']], hasABS:false },
  mpx:     { name:'Multiplex Birke', sub:'ab 49 € · 21/40 mm · alle Dekore',
             thick:[['21','21 mm'],['40','40 mm']], def:'21', dekore:[['sperrholz-natur','Birke natur']], hasABS:false }
};
const FLAT = {'weiss':'#f0eee9','schwarz':'#232120','asche-grau':'#b7b6b2','kaszmir':'#d9d2c4','sosna-bielona':'#ece5d6',
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
const CORNER_PRICE = { 30:4.9, 50:4.9, 100:7.9 };          /* € je Ecke */
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
  if(KANTE[S.dekor+'_'+REF_MM]) return {src:KANTE[S.dekor+'_'+REF_MM], ref:true};
  const avail=Object.keys(KANTE).filter(k=>k.startsWith(S.dekor+'_')).map(k=>+k.split('_')[1]);
  if(!avail.length) return {src:TEX[S.dekor], ref:true};
  const near=avail.sort((a,b)=>Math.abs(a-REF_MM)-Math.abs(b-REF_MM))[0];
  return {src:KANTE[S.dekor+'_'+near], ref:true};
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
const PRESETS = {
  kabel:    {label:'Kabeldurchlass Ø60', short:'Ø60',       t:'c', d:6,          price:14.9, pos:(L,B,n)=>[L/2+n*10, 0.15*B]},
  usb:      {label:'USB/Steckdose',      short:'USB',       t:'r', w:26.5, h:10, price:24.9, pos:(L,B,n)=>[L-21.25-n*30, 0.10*B+5]},
  spuele:   {label:'Spülen-Ausschnitt',  short:'Spüle',     t:'r', w:78,  h:43,  price:79,   pos:(L,B,n)=>[0.08*L+39+n*10, B/2]},
  induktion:{label:'Induktionsfeld',     short:'Induktion', t:'r', w:56,  h:49,  price:79,   pos:(L,B,n)=>[L-34-n*10, B/2]}
};

/* ═══════ State ═══════ */
const S = { mat:'dekor', dekor:'sonoma-eiche', mpxSurface:'natur', absColor:'dekor',
            form:'rect', L:120, B:60, D:80, sw:{w:120,d:60,c:52}, lf:{L:180,B:120,aw:90,ah:60}, thick:'25',
            corner:0, edgeR:3, edges:['abs','abs','abs','abs'],
            extras:{bohr:false,custom:false}, cuts:[], draw:null, view:'2d' };

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
  const ecken=(S.form==='rect'&&S.corner>0)?(CORNER_PRICE[S.corner]||4.9)*4:0;
  let extras=0; if(S.extras.bohr) extras+=X_PRICE.bohr;
  S.cuts.forEach(c2=>{ if(c2.preset) extras+=PRESETS[c2.preset].price; });
  ensureDekor();
  const dk=(dekorList().find(x=>x[0]===S.dekor))||dekorList()[0]||['','—'];
  const tt=MATERIALS[S.mat].thick.find(t=>t[0]===S.thick)||MATERIALS[S.mat].thick[0];
  return {zl,basis,kante,ecken,extras,total:basis+kante+ecken+extras,
    dekorName:isLack()?'Klarlack':dk[1],thickName:tt[1]};
}
function isStandard(){
  if(S.extras.custom||isLack()||S.form==='szwal'||S.form==='lform'||S.corner>0||S.cuts.some(c=>!c.preset)) return false;
  if(S.mat!=='dekor'&&S.mat!=='compact') { /* mpx Festmaße? aktuell keine → nur 18er Liste für dekor */ }
  return !!shopHit();
}
function needsOffer(){ return S.extras.custom||isLack()||S.cuts.some(c=>!c.preset); }
function delivDate(){
  const d=new Date(); let n=0;
  while(n<4){ d.setDate(d.getDate()+1); if(d.getDay()!==0&&d.getDay()!==6)n++; }
  return d.toLocaleDateString('de-DE',{day:'numeric',month:'long'});
}

/* ═══════ 2D-SVG ═══════ */
function drawStage(){
  const svg=$('stage'); const W=600,H=444,PAD=76;
  const d=dims(), sc=Math.min((W-2*PAD)/d.w,(H-2*PAD)/d.h);
  const pw=d.w*sc, ph=d.h*sc, x=(W-pw)/2, y=(H-ph)/2-8;
  const tex=TEX[texKey()];
  let inner='';

  if(S.form==='round'){
    const r=pw/2, cx=W/2, cy=y+r;
    inner+=`<clipPath id="plateClip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`;
    inner+=isLack()?`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#dcd9d2"/>`
      :`<image href="${tex}" x="${cx-r*1.16}" y="${cy-r*1.16}" width="${2.32*r}" height="${2.32*r}" preserveAspectRatio="xMidYMid slice" clip-path="url(#plateClip)"/>`;
    inner+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#00000018"/>`;
    inner+=`<circle class="kfg_edge" data-i="0" cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${edgeCol(S.edges[0])}" stroke-width="5"><title>Kante — ${edgeLabel(S.edges[0])}</title></circle>`;
    inner+=dimH(cx-r,cx+r,cy+r+30,'Ø '+S.D+' cm');
  } else if(S.form==='lform'){
    const aw=S.lf.aw*sc, ah=S.lf.ah*sc, ri=(S.mat==='dekor'?5:1)*sc;
    const pd=`M ${x} ${y} L ${x+pw-aw} ${y} L ${x+pw-aw} ${y+ah-ri} Q ${x+pw-aw} ${y+ah} ${x+pw-aw+ri} ${y+ah} L ${x+pw} ${y+ah} L ${x+pw} ${y+ph} L ${x} ${y+ph} Z`;
    inner+=`<clipPath id="plateClip"><path d="${pd}"/></clipPath>`;
    inner+=isLack()?`<path d="${pd}" fill="#dcd9d2"/>`
      :`<image href="${tex}" x="${x-pw*0.08}" y="${y-ph*0.08}" width="${pw*1.16}" height="${ph*1.16}" preserveAspectRatio="xMidYMid slice" clip-path="url(#plateClip)"/>`;
    inner+=`<path d="${pd}" fill="none" stroke="${edgeCol(S.edges[0])}" stroke-width="5" stroke-linejoin="round"/>`;
    inner+=`<path d="${pd}" fill="none" stroke="#00000018"/>`;
    inner+=dimH(x,x+pw,y+ph+30,S.lf.L+' cm')+dimV(x-30,y,y+ph,S.lf.B+' cm');
    inner+=`<text class="dim-text" x="${x+pw-aw/2}" y="${y+ah/2+4}" text-anchor="middle">${S.lf.aw} × ${S.lf.ah}</text>`;
  } else {
    const rx=S.form==='rect'?(Math.min(S.corner/10*sc,pw/2,ph/2)||3):3;
    let clip=`<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="${rx}"/>`;
    inner+=`<clipPath id="plateClip">${clip}</clipPath>`;
    inner+=isLack()?`<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="${rx}" fill="#dcd9d2"/>`
      :`<image href="${tex}" x="${x-pw*0.08}" y="${y-ph*0.08}" width="${pw*1.16}" height="${ph*1.16}" preserveAspectRatio="xMidYMid slice" clip-path="url(#plateClip)"/>`;
    /* Nähmaschinen-Ausschnitt: Loch vorne mittig, 6 cm Randabstand */
    if(S.form==='szwal'){
      const cw=S.sw.c*sc, ch=18*sc, hx=x+(pw-cw)/2, hy=y+ph-(18+6)*sc;
      inner+=`<rect x="${hx}" y="${hy}" width="${cw}" height="${ch}" rx="${Math.min(10,ch/4)}" fill="#F2F0EB" stroke="#00000055"/>`;
      inner+=`<text class="dim-text" x="${hx+cw/2}" y="${hy+ch/2+4}" text-anchor="middle">${(''+S.sw.c).replace('.',',')} × 18</text>`;
    }
    inner+=`<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="${rx}" fill="none" stroke="#00000018"/>`;
    /* Kanten als konturfolgende Pfade */
    const c=Math.SQRT1_2;
    const mid=(cx2,cy2,dx,dy)=>[cx2+dx*rx*c,cy2+dy*rx*c];
    const TL=[x+rx,y+rx],TR=[x+pw-rx,y+rx],BR=[x+pw-rx,y+ph-rx],BL=[x+rx,y+ph-rx];
    const arc=(x2,y2)=>`A ${rx} ${rx} 0 0 1 ${x2} ${y2}`;
    const p0=mid(...TL,-1,-1),p1=[TL[0],y],p2=[TR[0],y],p3=mid(...TR,1,-1),
          p4=[x+pw,TR[1]],p5=[x+pw,BR[1]],p6=mid(...BR,1,1),
          p7=[BR[0],y+ph],p8=[BL[0],y+ph],p9=mid(...BL,-1,1),p10=[x,BL[1]],p11=[x,TL[1]];
    const seg=[`M ${p0} ${arc(...p1)} L ${p2} ${arc(...p3)}`,`M ${p3} ${arc(...p4)} L ${p5} ${arc(...p6)}`,
               `M ${p6} ${arc(...p7)} L ${p8} ${arc(...p9)}`,`M ${p9} ${arc(...p10)} L ${p11} ${arc(...p0)}`];
    seg.forEach((dd,i)=>{
      inner+=`<path class="kfg_edge" data-i="${i}" d="${dd}" fill="none"
        stroke="${edgeCol(S.edges[i])}" stroke-width="5" stroke-linecap="butt"><title>Kante ${'ABCD'[i]} — ${edgeLabel(S.edges[i])}</title></path>`;
    });
    inner+=dimH(x,x+pw,y+ph+30,d.w+' cm')+dimV(x+pw+30,y,y+ph,d.h+' cm');
    if(S.form==='rect'&&S.corner>0) inner+=`<text class="dim-text" x="${x+8}" y="${y-10}">Ecken R${S.corner}</text>`;
    /* Ausschnitte */
    if(S.extras.bohr){
      const off=Math.max(6*sc,10)+(S.corner>10?S.corner/10*sc*0.5:0);
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
      if(c2.t==='c'){
        inner+=`<circle class="kfg_cutshape" data-idx="${i}" cx="${x+c2.cx*sc}" cy="${y+c2.cy*sc}" r="${c2.d/2*sc}"
          fill="#F2F0EB" fill-opacity=".92" stroke="#00000060" stroke-dasharray="5 3"${committed?' style="cursor:move"':''}><title>Ø ${c2.d} cm — ziehen zum Verschieben</title></circle>`;
        inner+=`<text class="dim-text" x="${x+c2.cx*sc}" y="${y+c2.cy*sc+4}" text-anchor="middle" style="font-size:11px;pointer-events:none">${cutShort(c2)}</text>`;
      } else {
        inner+=`<rect class="kfg_cutshape" data-idx="${i}" x="${x+(c2.cx-c2.w/2)*sc}" y="${y+(c2.cy-c2.h/2)*sc}" width="${c2.w*sc}" height="${c2.h*sc}" rx="3"
          fill="#F2F0EB" fill-opacity=".92" stroke="#00000060" stroke-dasharray="5 3"${committed?' style="cursor:move"':''}><title>${c2.w} × ${c2.h} cm — ziehen zum Verschieben</title></rect>`;
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
  } else G=null;
  svg.innerHTML=inner;
  svg.classList.toggle('is-drawing',!!S.draw);
  svg.querySelectorAll('.kfg_edge').forEach(e=>e.addEventListener('click',()=>cycleEdge(+e.dataset.i)));

  drawDetail(); if(S.view==='3d') draw3D();
}
/* ── Zeichnen-Werkzeug ── */
let G=null, tmpCut=null, dragCut=null, FORCE_DISTS=false;
function normCut(t){
  const r5=v=>Math.round(v*2)/2;
  let x0=Math.max(0,Math.min(G.w,Math.min(t.x0,t.x1))), x1=Math.max(0,Math.min(G.w,Math.max(t.x0,t.x1)));
  let y0=Math.max(0,Math.min(G.h,Math.min(t.y0,t.y1))), y1=Math.max(0,Math.min(G.h,Math.max(t.y0,t.y1)));
  const w=r5(x1-x0), hh=r5(y1-y0);
  if(t.t==='c'){ const d2=r5(Math.max(w,hh)); return {t:'c',cx:r5((x0+x1)/2),cy:r5((y0+y1)/2),d:d2,w:d2,h:d2}; }
  return {t:'r',cx:r5((x0+x1)/2),cy:r5((y0+y1)/2),w,h:hh};
}
function fmtCut(c){ const m=c.t==='c'?`Ø ${c.d} cm`:`${c.w} × ${c.h} cm`;
  return c.preset?`${PRESETS[c.preset].label} (${m})`:m; }
function cutShort(c){ return c.preset?PRESETS[c.preset].short:(c.t==='c'?('Ø '+(''+c.d).replace('.',',')):((''+c.w).replace('.',',')+' × '+(''+c.h).replace('.',','))); }
function setDraw(v){
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
function dimH(x1,x2,y,t){return `<line class="dim-line" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>
  <line class="dim-line" x1="${x1}" y1="${y-5}" x2="${x1}" y2="${y+5}"/><line class="dim-line" x1="${x2}" y1="${y-5}" x2="${x2}" y2="${y+5}"/>
  <text class="dim-text" x="${(x1+x2)/2}" y="${y+18}" text-anchor="middle">${t}</text>`}
function dimV(x,y1,y2,t){return `<line class="dim-line" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>
  <line class="dim-line" x1="${x-5}" y1="${y1}" x2="${x+5}" y2="${y1}"/><line class="dim-line" x1="${x-5}" y1="${y2}" x2="${x+5}" y2="${y2}"/>
  <text class="dim-text" x="${x+10}" y="${(y1+y2)/2+4}">${t}</text>`}

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
    ${S.form==='rect'&&S.corner>0?`<span>Ecken: R${S.corner}</span>`:''}
    <em>${ph.ref?`Abbildung zeigt die Kante in 25 mm — unabhängig von der gewählten Stärke. Gefertigt wird in ${c.thickName}.`
      :`Kantenfoto ${c.thickName} — Originalaufnahme aus der Fertigung.`}</em>`;
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
    const xS=-W/2+c2.cx/10, yS=H/2-c2.cy/10, p=new THREE.Path();
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
function plateShape(){
  const d=dims(), w=d.w/10, h=d.h/10, sh=new THREE.Shape();
  if(S.form==='round'){ sh.absarc(0,0,w/2,0,Math.PI*2,false); return sh; }
  const r=Math.min((S.form==='rect'?S.corner:0)/100, w/2, h/2);
  const x=-w/2,y=-h/2;
  if(r>0.01){
    sh.moveTo(x+r,y); sh.lineTo(x+w-r,y); sh.quadraticCurveTo(x+w,y,x+w,y+r);
    sh.lineTo(x+w,y+h-r); sh.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    sh.lineTo(x+r,y+h); sh.quadraticCurveTo(x,y+h,x,y+h-r);
    sh.lineTo(x,y+r); sh.quadraticCurveTo(x,y,x+r,y);
  } else { sh.moveTo(x,y); sh.lineTo(x+w,y); sh.lineTo(x+w,y+h); sh.lineTo(x,y+h); sh.closePath(); }
  if(S.form==='lform'){
    const L2=S.lf.L/10,B2=S.lf.B/10,aw2=S.lf.aw/10,ah2=S.lf.ah/10,ri=(S.mat==='dekor'?0.5:0.1);
    const sh2=new THREE.Shape(), x2=-L2/2, y2=-B2/2;
    sh2.moveTo(x2,y2); sh2.lineTo(x2+L2,y2); sh2.lineTo(x2+L2,y2+B2-ah2);
    sh2.lineTo(x2+L2-aw2+ri,y2+B2-ah2); sh2.quadraticCurveTo(x2+L2-aw2,y2+B2-ah2,x2+L2-aw2,y2+B2-ah2+ri);
    sh2.lineTo(x2+L2-aw2,y2+B2); sh2.lineTo(x2,y2+B2); sh2.closePath();
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
function draw3D(){
  ensure3D(()=>{
    if(three.mesh){three.scene.remove(three.mesh);three.mesh.geometry.dispose();}
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
    if(S.mat==='dekor'&&S.corner>0&&S.corner<rules().minCorner) S.corner=rules().minCorner;
    clampDims(); buildAll(); render();
  }));
}
function ensureDekor(){
  /* Schutz: haelt S.dekor immer innerhalb der aktuell gueltigen Liste.
     Vorher konnte der angezeigte Dekorname vom markierten Swatch abweichen. */
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
    ? 'Auf Multiplex lässt sich jedes Laminat unserer Möbelplatten-Palette aufkleben — die Kante bleibt sichtbare Birkenschicht.'
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
    `<button class="kfg_chip${S.corner===v?' is-active':''}" data-c="${v}">${l}${s?` <small>${s}</small>`:''}</button>`).join('');
  $('cornerChips').querySelectorAll('.kfg_chip').forEach(b=>b.addEventListener('click',()=>{
    S.corner=+b.dataset.c; $('inC').value='';
    buildCorner(); render();
  }));
  $('cornerRule').style.display=r.minCorner>0?'block':'none';
  $('cornerRule').textContent=r.cornerNote;
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
    $(rid).textContent=`${min} – ${max} cm`;
    $(eid).textContent=`Bitte ${min}–${max} cm eingeben`;
    const bad=!(v>=min&&v<=max); $(fid).classList.toggle('is-error',bad); if(bad)ok=false;
  };
  if(S.form==='rect'){ chk('fL','errL','rangeL',+S.L,10,r.maxL); chk('fB','errB','rangeB',+S.B,10,r.maxB); }
  else if(S.form==='round') chk('fD','errD','rangeD',+S.D,10,r.maxD);
  else if(S.form==='lform'){
    chk('fLL','errLL','rangeLL',+S.lf.L,10,r.maxL); chk('fLB','errLB','rangeLB',+S.lf.B,10,r.maxB);
    chk('fAW','errAW','rangeAW',+S.lf.aw,10,Math.max(10,+S.lf.L-10)); chk('fAH','errAH','rangeAH',+S.lf.ah,10,Math.max(10,+S.lf.B-10));
  }
  /* Radius-Regel Möbelplatte */
  if(S.form==='rect'&&S.mat==='dekor'&&S.corner>0&&S.corner<r.minCorner){
    S.corner=r.minCorner; toast('Möbelplatte: Außenradius mind. R30 — angepasst'); buildCorner();
  }
  return ok;
}
function render(){
  if(!validate())return;
  const std=isStandard(), offer=needsOffer(), c=calc();
  $('badge').classList.toggle('is-sonder',!std);
  $('badgeText').textContent=std?'Ab Lager — lieferbar in 3–5 Tagen'
    :(offer?'Individuelle Fertigung — Angebot in 24 h':'CNC-Fertigung — Angebot in 24 h');
  const pv=offer?fmt(c.total)+' +':fmt(c.total);
  $('price').textContent=pv; $('priceBar').textContent=pv;
  $('priceLabel').textContent=std?'Dein Preis':(offer?'Preis ab (zzgl. Sonderarbeiten)':'Voraussichtlicher Preis');
  if(std){$('delivDate').textContent='Versand bis '+delivDate();$('delivSub').textContent='DHL, ab Lager';$('delivBar').textContent='Versand bis '+delivDate();}
  else {$('delivDate').textContent='Angebot in 24 h';$('delivSub').textContent='Versandkosten im Angebot';$('delivBar').textContent='Fertigung · Angebot in 24 h';}
  const t=std?'In den Warenkorb':'Unverbindlich anfragen';
  $('cta').textContent=t;$('ctaBar').textContent=t;
  $('cta').classList.toggle('is-sonder',!std);$('ctaBar').classList.toggle('is-sonder',!std);
  const sur=S.mat==='mpx'?{natur:' · natur',hpl:' + HPL',lack:' · klarlackiert'}[S.mpxSurface]:'';
  const hit=shopHit();
  const rows=[[hit
    ? `${MATERIALS[S.mat].name}${sur} · ${c.dekorName} · ${c.thickName} — Lagerartikel ${hit[2]||''}`
    : `${MATERIALS[S.mat].name}${sur} · ${c.dekorName} · ${c.thickName} (${Math.round(areaM2()*100)/100} m² × ${rateZl()} zł)`, c.basis]];
  if(c.kante>0)rows.push([`Kantenbearbeitung`,c.kante]);
  if(c.ecken>0)rows.push([`Eckenrundung R${S.corner} (4× à ${fmt(CORNER_PRICE[S.corner]||4.9)})`,c.ecken]);
  if(c.extras>0){
    const parts=[]; if(S.extras.bohr)parts.push('Montagebohrungen');
    Object.keys(PRESETS).forEach(k=>{const n=presetCount(k); if(n)parts.push((n>1?n+'× ':'')+PRESETS[k].label);});
    rows.push([parts.join(', '),c.extras]);
  }
  const freeCuts=S.cuts.filter(c2=>!c2.preset);
  if(freeCuts.length)rows.push([`Eingezeichnete Ausschnitte (${freeCuts.length})`,'im Angebot']);
  if(S.extras.custom||isLack())rows.push([isLack()?'Klarlack-Lackierung':'Eigenes Bohrbild','im Angebot']);
  $('cutList').innerHTML=S.cuts.map((c2,i)=>c2.preset?'':`<span class="kfg_cutitem">${c2.t==='c'?'◯':'▭'} ${fmtCut(c2)}<button data-del="${i}" aria-label="Entfernen">×</button></span>`).join('');
  syncPresets();
  $('cutList').querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{S.cuts.splice(+b.dataset.del,1);render();}));
  $('breakdown').innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${typeof r[1]==='number'?fmt(r[1]):r[1]}</td></tr>`).join('')
    +`<tr class="total"><td>Gesamt inkl. MwSt.</td><td>${pv}</td></tr>`;
  buildQuick(); drawStage(); updateMini(); updateSticky(); syncURL();
}
function syncURL(){
  const p=new URLSearchParams({m:S.mat,d:S.dekor,f:S.form,t:S.thick,c:S.corner,er:S.edgeR,sf:S.mpxSurface,ac:S.absColor,
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
  if(tmpCut)return;
  const [px,py]=svgPt(e); tmpCut={t:S.draw,x0:(px-G.x)/G.sc,y0:(py-G.y)/G.sc,x1:null,y1:null};
  e.preventDefault(); }
$('stage').addEventListener('pointerdown',startDraw);
$('stage').addEventListener('mousedown',startDraw);
$('stage').addEventListener('touchstart',e=>{const t=e.touches[0];startDraw({clientX:t.clientX,clientY:t.clientY,preventDefault:()=>e.preventDefault()})},{passive:false});
function moveDraw(e){
  if(dragCut&&G){ const [px,py]=svgPt(e), c2=S.cuts[dragCut.i], r5=v=>Math.round(v*2)/2;
    c2.cx=r5(Math.max(c2.w/2,Math.min(G.w-c2.w/2,(px-G.x)/G.sc-dragCut.ox)));
    c2.cy=r5(Math.max(c2.h/2,Math.min(G.h-c2.h/2,(py-G.y)/G.sc-dragCut.oy)));
    drawStage(); return; }
  if(!S.draw||!tmpCut)return;
  const [px,py]=svgPt(e); tmpCut.x1=(px-G.x)/G.sc; tmpCut.y1=(py-G.y)/G.sc; drawStage(); }
function endDraw(){
  if(dragCut){ dragCut=null; $('stage').classList.remove('is-dragging'); render(); return; }
  if(!S.draw||!tmpCut)return;
  if(tmpCut.x1!==null){ const c2=normCut(tmpCut);
    if(c2.w>=3&&c2.h>=3){S.cuts.push(c2);toast('Ausschnitt '+fmtCut(c2)+' hinzugefügt — Preis im Angebot');}
    else toast('Zu klein — mindestens 3 cm aufziehen'); }
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
  $('cornerBlock').style.display=S.form==='rect'?'block':'none';
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
let cT;$('inC').addEventListener('input',()=>{clearTimeout(cT);cT=setTimeout(()=>{
  const v=Math.max(0,Math.min(300,+$('inC').value||0)); S.corner=v;
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
  if($('uploadInput').files.length){$('uploadZone').querySelector('b').textContent='✓ '+$('uploadInput').files[0].name;toast('Skizze angehängt — geht mit der Anfrage raus')}
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
    return `${fmtCut(c2)} — Abstände: links ${f(c2.cx-c2.w/2)} · rechts ${f(G.w-(c2.cx+c2.w/2))} · hinten ${f(c2.cy-c2.h/2)} · vorn ${f(G.h-(c2.cy+c2.h/2))} cm`;
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
    ...(S.form==='rect'&&S.corner>0?[['Eckenradius','R'+S.corner]]:[]),
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
    ...(S.corner>0?{'_kfg_eckenradius_mm':S.corner}:{}),
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
$('btnShare').addEventListener('click',()=>{navigator.clipboard&&navigator.clipboard.writeText(location.href);toast('Link kopiert — Konfiguration teilbar')});
$('btnMail').addEventListener('click',()=>toast('Demo: E-Mail-Capture → Konfiguration + Preis als Mail (Lead)'));
$('btnMuster').addEventListener('click',()=>toast('Demo: Musterbox als Shopify-Produkt in den Warenkorb'));

function presetCount(k){ return S.cuts.filter(c=>c.preset===k).length; }
function addPreset(k){
  if(S.form==='round'){toast('Ausschnitte aktuell nur bei eckigen Formen');return;}
  const p=PRESETS[k], d=dims(), n=presetCount(k);
  let [cx,cy]=p.pos(d.w,d.h,n);
  const w=p.t==='c'?p.d:p.w, hh=p.t==='c'?p.d:p.h;
  if(w>d.w-2||hh>d.h-2){toast(p.label+' passt nicht auf diese Plattengröße');return;}
  cx=Math.max(w/2,Math.min(d.w-w/2,cx)); cy=Math.max(hh/2,Math.min(d.h-hh/2,cy));
  S.cuts.push(p.t==='c'?{t:'c',preset:k,cx,cy,d:p.d,w:p.d,h:p.d}:{t:'r',preset:k,cx,cy,w:p.w,h:p.h});
  toast(p.label+' hinzugefügt — auf der Platte verschiebbar'); render();
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
  const el=$('miniBar'); if(!el)return;
  const d=dims(), c=calc();
  const pl=$('miniPlate');
  const ratio=Math.max(0.35,Math.min(2.6,d.w/d.h));
  pl.style.aspectRatio=ratio+' / 1';
  pl.style.backgroundImage=isLack()?'none':`url(${TEX[texKey()]})`;
  pl.style.backgroundColor=isLack()?'#dcd9d2':'';
  pl.classList.toggle('is-round',S.form==='round');
  const mass=S.form==='rect'?`${S.L} × ${S.B} cm`:S.form==='round'?`Ø ${S.D} cm`
    :S.form==='lform'?`${S.lf.L} × ${S.lf.B} cm · L-Form`:`${S.sw.w} × ${S.sw.d} cm · Nähmaschine`;
  $('miniTitle').textContent=mass;
  $('miniSub').textContent=`${MATERIALS[S.mat].name} · ${c.dekorName} · ${c.thickName}`;
}
function initMini(){
  const bar=$('miniBar'), prev=document.querySelector('.kfg_preview'), head=document.querySelector('header.site');
  if(!bar||!prev)return;
  const sync=()=>{
    const hb=head?head.getBoundingClientRect().bottom:0;
    bar.style.top=Math.max(0,hb)+'px';
    const on=window.innerWidth<980 && prev.getBoundingClientRect().bottom < hb+8;
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
function updateSticky(){
  const el=$('stickyCol'); if(!el)return;
  if(window.innerWidth<980){el.style.top='';return;}
  el.style.top=Math.min(84, window.innerHeight-el.offsetHeight-16)+'px';
}
window.addEventListener('resize',()=>{clearTimeout(window.__stT);window.__stT=setTimeout(()=>{placeSummary();updateSticky();frame3D()},120)});

/* ═══════ Init ═══════ */



  SHOP = shopData || {};

  buildAll(); placeSummary(); render(); initMini();

  window.KFG = {
    version: VERSION,
    getConfig: function(){ return JSON.parse(JSON.stringify(S)); },
    setConfig: function(patch){ Object.assign(S, patch||{}); buildAll(); render(); },
    reload: function(){ render(); },
    _debug: function(){ return { S:S, shopArtikel:Object.keys(SHOP).length, treffer:shopHit() }; }
  };
}
})();
