/*! Kessler PRO — Tischplatten-Konfigurator  v1.19.0
 *
 *  ACHTUNG — DIESE FASSUNG LIEGT NICHT IM REPO.
 *  v1.19.0 (Bauchausschnitt, 10.09.2026) wurde ohne Repo-Zugang gebaut und liegt
 *  als Webflow-Asset. Das registrierte Skript kfg_konfigurator zeigt darauf statt
 *  auf jsDelivr. Solange das so ist, wirkt sich ein Commit auf dist/konfigurator.js
 *  NICHT auf die Live-Seite aus.
 *  Zurueckdrehen: kfg_konfigurator wieder auf
 *    https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@<commit>/dist/konfigurator.js
 *  zeigen lassen, sobald diese Datei im Repo liegt. Siehe
 *  claude/STATE-Bauchausschnitt-v1.19.0-10-09-2026.md
 *  Rendert die komplette Konfigurator-UI in jeden Container mit [data-kfg-root].
 *  Daten: kfg-produktmatrix.json (Lagerartikel, EUR + PLN) · kfg-preiskurven.json
 *  (Sondermass-Kurven je Material/Staerke/Form/Dekorstufe) · Bilder: assets/kfg/ —
 *  alles via jsDelivr aus demselben Commit.
 *  Public API: window.KFG = { version, getConfig(), setConfig(), reload(), _debug() }
 */
(function(){
  if (window.__KFG_LOADED) return;                      /* Idempotenz-Guard (Bootstrap-Quirk) */
  window.__KFG_LOADED = true;

  var VERSION = '1.20.1';
  /* Basis-URL aus dem eigenen <script src> ableiten — so zeigen Daten und Bilder
     IMMER auf denselben Commit wie das Script (vorher liefen sie auseinander). */
  /* Auf den Commit gezogen, der am 10.09.2026 live lief — dort liegen Preiskurven,
   Sprachdatei und Bilder, die es unter dem alten Commit noch nicht gab. Greift,
   wenn das Skript NICHT ueber jsDelivr geladen wird (z. B. als Webflow-Asset). */
var FALLBACK_BASE = 'https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@2ee8195';
  var BASE = (function(){
    try{
      var me = document.currentScript && document.currentScript.src;
      if(!me){
        var all = document.querySelectorAll('script[src*="konfigurator"]');
        me = all.length ? all[all.length-1].src : '';
      }
      var i = me.indexOf('/dist/konfigurator-atelier.js'); if(i<0) i = me.indexOf('/dist/konfigurator.js');
      return i > 0 ? me.slice(0, i) : FALLBACK_BASE;
    }catch(e){ return FALLBACK_BASE; }
  })();
  var ROOT_SEL= '[data-kfg-root]';

  /* Der Fetch startet SOFORT beim Parsen — nicht erst bei DOMContentLoaded.
     Vorher hing die Kette an der DCL der ganzen Seite: gemessen 0,9–1,8 s
     verlorene Zeit bis „Tool lebt“ (Audit 29.07., Fix 4). null = Anfrage-Flow. */
  var MATRIX_P = fetch(BASE + '/dist/data/kfg-produktmatrix.json', {cache:'default'})
    .then(function(r){ return r.ok ? r.json() : null; })
    .catch(function(){ return null; });
  /* Sondermass-Kurven (v1.17.0): ohne sie gibt es fuer Nicht-Lagergroessen
     keinen Preis, nur den Anfrage-Flow. */
  var KURVEN_P = fetch(BASE + '/dist/data/kfg-preiskurven.json', {cache:'default'})
    .then(function(r){ return r.ok ? r.json() : null; })
    .catch(function(){ return null; });
  /* Sprachdatei (PL/EN) ebenfalls sofort — vorher startete sie erst nach der Matrix,
     die Oberflaeche war 1–2 s lang deutsch (Review 08.09., B11). */
  var LANG_FRUEH = (function(){ try{ var l=(document.documentElement.getAttribute('lang')||'').toLowerCase(), q=location.pathname.toLowerCase();
    return l.slice(0,2)==='pl'||q.indexOf('/pl-pl/')===0||q.indexOf('/pl/')===0 ? 'pl' : l.slice(0,2)==='en'||q.indexOf('/en/')===0 ? 'en' : 'de'; }catch(e){ return 'de'; } })();
  var I18N_P = LANG_FRUEH==='de' ? null : fetch(BASE + '/dist/data/kfg-i18n.json', {cache:'default'})
    .then(function(r){ return r.ok ? r.json() : null; })
    .catch(function(){ return null; });

  /* Touch-Geraete: KEINE automatischen Scroll-Korrekturen. Auf iOS kaempfen
     scrollBy/scrollTo/scrollIntoView gegen das Momentum-Scrolling des Nutzers —
     die Seite ruckt „von selbst“, Taps waehrend der Smooth-Scrolls verpuffen
     (Befund Sascha, 29.07. abends: „reagiert nicht, super instabil“).
     Nutzerinitiierte Spruenge (Chips, miniJump, Zeichnen) bleiben erhalten. */
  var KFG_TOUCH = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);

  /* GA4 ueber den vorhandenen GTM — Event-Liste von Sascha freigegeben (30.07.).
     Consent Mode v2 queued die Pushes, bis der Nutzer zugestimmt hat. */
  function ga(ev, p){ try{ (window.dataLayer = window.dataLayer || []).push(Object.assign({event: ev}, p || {})); }catch(_){} }

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
    var done = false;
    setTimeout(function(){ if(!done){ done = true; start({}, null); } }, 4000);
    /* Matrix und Kurven kommen aus den beim Parsen gestarteten Fetches — nur ein
       data-kfg-base-Override (lokaler Spiegel) holt sie selbst (Audit, Fix 4). */
    var lade = function(name){ return fetch(base + '/dist/data/' + name, {cache:'default'})
          .then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }); };
    var erst = true;
    var holen = function(){
      var mp = (erst && base === BASE) ? MATRIX_P : lade('kfg-produktmatrix.json');
      var kp = (erst && base === BASE) ? KURVEN_P : lade('kfg-preiskurven.json');
      erst = false;
      return Promise.all([mp, kp]).then(function(res){
        var d = res[0], kv = res[1], out = {};
        if (d && d.produkte) {
          for (var k in d.produkte) {
            var v = d.produkte[k];
            /* [EUR, VariantId, SKU, PLN] — PLN seit v1.17.0 fuer die polnische Seite */
            if (v.eur) out[k] = [Math.round(v.eur*100)/100, String(v.variantId||'').split('/').pop(), v.sku,
                                 v.pln ? Math.round(v.pln*100)/100 : null];
          }
        }
        return { shop: out, kurven: kv && kv.kurven ? kv.kurven : null };
      });
    };
    /* Neuladen aus dem Werkzeug heraus ("Erneut laden") */
    window.__KFG_NACHLADEN = function(){ return holen().then(function(r){ if(window.KFG && window.KFG._daten) window.KFG._daten(r.shop, r.kurven); return r; }); };
    holen().then(function(r){
        if(!done){ done = true; start(r.shop, r.kurven); }
        /* Daten kamen erst nach der 4-s-Frist: trotzdem einspielen statt verwerfen (Review 08.09., B1) */
        else if(window.KFG && window.KFG._daten) window.KFG._daten(r.shop, r.kurven);
      });
  }

  function start(shopData, kurven){
    KFG_APP(shopData, kurven);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

/* ═══════════════════════ CSS ═══════════════════════ */
var KFG_CSS = "\n  /* Bauchausschnitt (10.09.2026): das ERRECHNETE Mass ist gestrichelt und traegt\n     \"errechnet\" im Hinweis darunter — der Kunde sieht sofort, welches Feld ihm\n     folgt, statt sich mit ihm zu widersprechen. */\n  [data-kfg-root] .kfg_field.is-abgeleitet .in{border-style:dashed;background:#FAFAF8}\n  [data-kfg-root] .kfg_field.is-abgeleitet input{color:#5F5F5F}\n  [data-kfg-root] .kfg_field.is-abgeleitet .range{color:#7a7a72;font-style:italic}\n  [data-kfg-root] #dimsBauch .kfg_check{margin-top:var(--s-3xs)}\n  /* Guertel zur Webflow-nativen Reservierung auf tnm_kfg-mount: haelt die\n     Hoehe, falls der Site-Style je verloren geht. Gemessen 29.07.: Desktop\n     1278 px, <=991 px rund 2410 px. */\n  [data-kfg-root]{min-height:1240px}\n  @media(max-width:991px){[data-kfg-root]{min-height:2360px}}\n  /* Taps sofort und tolerant: kein Doppeltipp-Zoom-Delay, sichtbares\n     Druck-Feedback, und die Spalte gleitet auf Mobil nicht mehr (Bewegung\n     unter dem Finger liess iOS Taps als Wisch verwerfen). */\n  [data-kfg-root] button,[data-kfg-root] .kfg_chip,[data-kfg-root] .kfg_dekor,\n  [data-kfg-root] .kfg_mat,[data-kfg-root] .kfg_step-head,[data-kfg-root] label,\n  [data-kfg-root] .kfg_quick-chip,[data-kfg-root] summary{touch-action:manipulation}\n  [data-kfg-root] .kfg_dekor:active,[data-kfg-root] .kfg_mat:active,\n  [data-kfg-root] .kfg_chip:active,[data-kfg-root] .kfg_quick-chip:active{border-color:var(--ink)}\n  @media(max-width:979px){[data-kfg-root] .kfg_stickycol{transition:none}}\n  [data-kfg-root]{\n    --ink:#1E1E1E; --deep:#0A0A0A; --card:#F2F0EB; --alt:#FAFAFA; --hair:#E5E5E5;\n    --ok:#1c7a3d; --ok-bg:#e8f4ec; --warn:#9a6b12; --warn-bg:#faf3e2;\n    --s-3xs:4px; --s-2xs:8px; --s-xs:12px; --s-s:16px; --s-m:24px; --s-l:32px; --s-xl:48px; --s-2xl:64px;\n    --r:8px;\n  }\n  [data-kfg-root] *{box-sizing:border-box;margin:0;padding:0}\n  [data-kfg-root] button, [data-kfg-root] select, [data-kfg-root] input, [data-kfg-root] textarea{font-family:inherit}\n  \n\n  \n  \n  \n  \n  \n  \n  \n  \n  @media(min-width:768px){}\n\n  [data-kfg-root] .kfg_hero{max-width:1280px;margin-inline:auto;padding:var(--s-l) clamp(16px,4vw,80px) var(--s-s)}\n  [data-kfg-root] .kfg_hero h1{font-size:clamp(24px,3.4vw,36px);font-weight:500;letter-spacing:-.01em}\n  [data-kfg-root] .kfg_hero p{margin-top:var(--s-2xs);color:#555;font-size:15px;max-width:680px}\n  [data-kfg-root] .kfg_hero .anchor{color:var(--ink);font-weight:600}\n\n  [data-kfg-root] .kfg_layout{max-width:1280px;margin-inline:auto;padding:var(--s-s) clamp(16px,4vw,80px) 140px;\n    display:grid;grid-template-columns:1fr;gap:var(--s-m)}\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_layout{grid-template-columns:55fr 45fr;gap:var(--s-xl);padding-bottom:var(--s-2xl)}\n  }\n\n  /* \u2500\u2500 Preview \u2500\u2500 */\n  [data-kfg-root] .kfg_preview{background:var(--card);border-radius:16px;padding:var(--s-s);position:relative}\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_preview{padding:var(--s-m)}\n    /* Eigene Compositing-Ebene: die grosse Draufsicht muss beim Scrollen\n       sonst in jedem Frame neu gezeichnet werden, das ruckelt sichtbar.\n       (Im Block liegen keine fixed-Elemente, die Ebene stoert also nichts.) */\n    [data-kfg-root] .kfg_stickycol{position:sticky;top:84px;align-self:start;will-change:transform;\n      transition:top .16s ease}\n  }\n  [data-kfg-root] .kfg_preview-top{display:flex;align-items:center;justify-content:space-between;gap:var(--s-2xs);margin-bottom:var(--s-2xs);min-height:36px}   [data-kfg-root] .kfg_preview-badge{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:inline-flex;align-items:center;gap:6px;\n    font-size:12px;font-weight:500;padding:6px 12px;border-radius:var(--r);background:var(--ok-bg);color:var(--ok)}\n  [data-kfg-root] .kfg_preview-badge.is-sonder{background:var(--warn-bg);color:var(--warn)}\n  [data-kfg-root] .kfg_preview-badge .dot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:currentColor}   [data-kfg-root] .kfg_preview-badge span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis}\n  [data-kfg-root] .kfg_viewtoggle{flex:0 0 auto;display:flex;gap:2px;background:#fff;\n    border:1px solid var(--hair);border-radius:var(--r);padding:2px}\n  [data-kfg-root] .kfg_viewtoggle button{border:0;background:transparent;font-size:12px;font-weight:500;padding:6px 14px;\n    cursor:pointer;border-radius:6px;min-height:32px;color:#5F5F5F}\n  [data-kfg-root] .kfg_viewtoggle button.is-active{background:var(--ink);color:#fff}\n  [data-kfg-root] .kfg_preview-stage{width:100%;aspect-ratio:10/7.4;display:block}\n  [data-kfg-root] #stage3d{width:100%;aspect-ratio:10/7.4;display:none;border-radius:var(--r);cursor:grab;touch-action:none}\n  [data-kfg-root] .kfg_preview-hint{text-align:center;font-size:12px;color:#8a877f;padding-top:var(--s-2xs)}\n  [data-kfg-root] .ic-svg{width:14px;height:14px;flex:0 0 auto}\n  [data-kfg-root] .kfg_edge{cursor:pointer;transition:opacity .15s}\n  [data-kfg-root] .kfg_edge:hover{opacity:.75}\n  [data-kfg-root] .dim-line{stroke:#9b978c;stroke-width:1}\n  [data-kfg-root] .dim-text{font-family:'Onest',sans-serif;font-weight:600;font-size:var(--dim-fs,15px);fill:var(--ink);letter-spacing:.02em;\n    paint-order:stroke;stroke:var(--card);stroke-width:var(--dim-halo,3px);stroke-linejoin:round}\n\n  /* Detail */\n  /* Aufklapp-Zeile in JEDER Breite sichtbar: das Vorschaubild soll sich\n     jederzeit wegklicken lassen, so wie auf Mobil (Wunsch Sascha, 27.07.). */\n  /* Bearbeitungsliste: je Eintrag eine Zeile mit mm-Feldern */\n  /* Aufklappbare Schritte: zugeklappt bleibt die Kopfzeile mit Nummer,\n     Titel und der Zusammenfassung stehen. */\n  /* Kopfleiste ausblenden, solange im Konfigurator nach unten gescrollt\n     wird. Die Klasse sitzt auf den Kopfleisten selbst, nicht im Root —\n     deshalb ohne [data-kfg-root] davor. */\n  .kfg-headaway{transform:translateY(-100%) !important;transition:transform .22s ease !important}\n  [data-kfg-root] .kfg_step-head{cursor:pointer;-webkit-user-select:none;user-select:none}\n  [data-kfg-root] .kfg_step-head:hover .kfg_step-title{color:#000}\n  [data-kfg-root] .kfg_chev,\n  [data-kfg-root] .kfg_detail summary::after,\n  [data-kfg-root] .kfg_breakdown summary::after,\n  [data-kfg-root] .kfg_step-chev{content:'';flex:0 0 auto;display:inline-block;\n    width:8px;height:8px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;\n    transform:rotate(45deg);transform-origin:60% 60%;margin-left:10px;margin-bottom:3px;\n    opacity:.55;transition:transform .2s ease,opacity .2s ease}\n  [data-kfg-root] .kfg_step-head:hover .kfg_step-chev,\n  [data-kfg-root] .kfg_detail summary:hover::after{opacity:1}\n  [data-kfg-root] .kfg_step.is-open .kfg_step-chev,\n  [data-kfg-root] .kfg_detail[open] summary::after,\n  [data-kfg-root] .kfg_breakdown[open] summary::after{transform:rotate(225deg);margin-bottom:-2px}\n  [data-kfg-root] .kfg_step-body{display:none}\n  [data-kfg-root] .kfg_step.is-open .kfg_step-body{display:block}\n  [data-kfg-root] .kfg_step:not(.is-open) .kfg_step-head{margin-bottom:0}\n  /* Zugeklappt kompakter, sonst steht viel Luft um eine einzige Zeile */\n  [data-kfg-root] .kfg_step:not(.is-open){padding-top:var(--s-s);padding-bottom:var(--s-s)}\n  [data-kfg-root] .kfg_step.is-flash{outline:2px solid var(--ink);outline-offset:2px}\n  [data-kfg-root] .kfg_cutrow{border:1px solid var(--hair);border-radius:var(--r);\n    padding:var(--s-2xs) var(--s-xs) var(--s-xs);margin-top:var(--s-2xs);background:#fff}\n  [data-kfg-root] .kfg_cutrow-head{display:flex;align-items:center;gap:8px;font-size:13.5px;min-height:34px}\n  [data-kfg-root] .kfg_cutrow-head .ic{opacity:.55}\n  [data-kfg-root] .kfg_cutrow-head .pr{margin-left:auto;font-size:12.5px;color:#5F5F5F;white-space:nowrap}\n  [data-kfg-root] .kfg_cutrow-head .del{border:0;background:transparent;cursor:pointer;font-size:18px;\n    line-height:1;color:#b5b1a8;padding:0 2px;min-height:30px;min-width:30px}\n  [data-kfg-root] .kfg_cutrow-head .del:hover{color:var(--ink)}\n  [data-kfg-root] .kfg_cutrow-fields{display:flex;flex-wrap:wrap;gap:var(--s-2xs)}\n  [data-kfg-root] .kfg_cutrow-fields label{flex:1 1 96px;min-width:88px;max-width:160px;font-size:10.5px;color:#8a877f}\n  [data-kfg-root] .kfg_cutrow-fields .in{display:flex;align-items:center;border:1px solid var(--hair);\n    border-radius:6px;background:var(--alt);margin-top:3px}\n  [data-kfg-root] .kfg_cutrow-fields .in:focus-within{border-color:var(--ink)}\n  [data-kfg-root] .kfg_cutrow-fields input{width:100%;min-width:0;border:0;background:transparent;\n    padding:7px 0 7px 8px;font-size:13px;color:var(--ink);min-height:34px}\n  [data-kfg-root] .kfg_cutrow-fields select{width:100%;border:0;background:transparent;\n    padding:7px 6px;font-size:13px;color:var(--ink);min-height:34px;cursor:pointer}\n  [data-kfg-root] .kfg_cutrow-fields i{font-style:normal;font-size:10.5px;color:#9b978c;padding:0 8px}\n  [data-kfg-root] .kfg_cutrow-fields label.breit{flex:2 1 200px;max-width:340px}\n  [data-kfg-root] .kfg_cutlen{flex:1 0 100%;font-size:11.5px;color:#5F5F5F;margin-bottom:2px}\n  [data-kfg-root] .kfg_cutrow.is-warn{border-color:#e3c98f;background:var(--warn-bg)}\n  [data-kfg-root] .kfg_cutwarn{font-size:11px;color:var(--warn);margin-top:6px;display:block}\n  [data-kfg-root] .kfg_cutrow.is-sel{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}\n  [data-kfg-root] .kfg_detail{margin-top:var(--s-xs);background:transparent;border-radius:var(--r);padding:0}\n  [data-kfg-root] .kfg_detail summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:6px;\n    font-size:12.5px;color:#555;font-weight:500;background:#fff;border-radius:var(--r);padding:10px var(--s-xs);min-height:44px}\n  [data-kfg-root] .kfg_detail summary::-webkit-details-marker{display:none}\n  [data-kfg-root] .kfg_detail summary::after{margin-left:auto}\n  [data-kfg-root] .kfg_detail summary:hover{color:var(--ink)}\n  [data-kfg-root] .kfg_detail-inner{display:flex;align-items:center;gap:var(--s-s);position:relative;\n    background:#fff;border-radius:var(--r);padding:var(--s-xs);margin-top:var(--s-3xs)}\n  [data-kfg-root] .kfg_detail-badge{position:absolute;top:var(--s-2xs);left:var(--s-2xs);z-index:2;font-size:10px;font-weight:500;\n    letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:var(--r);\n    background:#ffffffd9;color:#5F5F5F;border:1px solid var(--hair)}\n  /* Vorschaubild bewusst klein: die Draufsicht ist das Produktbild und soll\n     dominieren (Wunsch Sascha, 27.07. - Groessen getauscht). */\n  [data-kfg-root] .kfg_detail img{width:38%;min-width:150px;max-width:220px;flex:0 0 auto;display:block;border-radius:6px;background:var(--alt);aspect-ratio:3/2;object-fit:cover}\n  [data-kfg-root] .kfg_detail-label{font-size:12.5px;color:#5F5F5F;line-height:1.5;min-width:0}\n  [data-kfg-root] .kfg_detail-label b{display:block;font-weight:600;color:var(--ink);font-size:15px;margin-bottom:var(--s-3xs)}\n  [data-kfg-root] .kfg_detail-label span{display:block}\n  [data-kfg-root] .kfg_detail-label em{display:block;font-style:normal;font-size:10.5px;color:#9b978c;margin-top:var(--s-2xs)}\n  @media(max-width:560px){\n    [data-kfg-root] .kfg_detail{flex-direction:column;align-items:stretch;gap:var(--s-2xs)}\n    [data-kfg-root] .kfg_detail img{width:100%;max-width:none}\n    [data-kfg-root] .kfg_detail-label{text-align:center}\n  }\n\n  /* \u2500\u2500 Panel \u2500\u2500 */\n  [data-kfg-root] .kfg_panel{display:flex;flex-direction:column;gap:var(--s-m)}\n  [data-kfg-root] .kfg_step{border:1px solid var(--hair);border-radius:var(--r);padding:var(--s-s)}\n  @media(min-width:980px){[data-kfg-root] .kfg_step{padding:var(--s-m)}}\n  [data-kfg-root] .kfg_step-head{display:flex;align-items:baseline;gap:var(--s-xs);margin-bottom:var(--s-s)}\n  [data-kfg-root] .kfg_step-num{font-weight:500;font-size:12px;color:var(--ink);letter-spacing:.06em}\n  [data-kfg-root] .kfg_step-title{font-size:16px;font-weight:500}\n  [data-kfg-root] .kfg_step-sub{font-size:12.5px;color:#5F5F5F;margin-left:auto;text-align:right}\n  [data-kfg-root] .kfg_sublabel{font-size:12px;color:#5F5F5F;margin:var(--s-s) 0 var(--s-2xs)}\n\n  [data-kfg-root] .kfg_mat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s-2xs)}\n  [data-kfg-root] .kfg_mat{border:1.5px solid var(--hair);border-radius:var(--r);padding:var(--s-xs);cursor:pointer;background:#fff;\n    text-align:left;transition:border-color .15s}\n  [data-kfg-root] .kfg_mat.is-active{border-color:var(--ink)}\n  [data-kfg-root] .kfg_mat b{display:block;font-size:13.5px;font-weight:500;line-height:1.25}\n  [data-kfg-root] .kfg_mat small{font-weight:300;font-size:11px;color:#888;display:block;margin-top:var(--s-3xs);letter-spacing:.02em}\n\n  [data-kfg-root] .kfg_dekor-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--s-2xs);margin-top:var(--s-s)}\n  @media(min-width:560px){[data-kfg-root] .kfg_dekor-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}\n  [data-kfg-root] .kfg_dekor{border:1.5px solid var(--hair);border-radius:var(--r);cursor:pointer;padding:var(--s-3xs);background:#fff;\n    transition:border-color .15s;display:flex;flex-direction:column}\n  [data-kfg-root] .kfg_dekor.is-active{border-color:var(--ink)}\n  [data-kfg-root] .kfg_dekor .sw{aspect-ratio:1/1;width:100%;border-radius:5px;display:block;background-size:165%;background-position:center}\n  [data-kfg-root] .kfg_dekor span:last-child{display:block;font-size:10px;text-align:center;padding-top:var(--s-3xs);color:#5F5F5F;line-height:1.2;height:auto}\n  [data-kfg-root] .kfg_dekor-note{font-size:11px;color:#9b978c;margin-top:var(--s-2xs)}\n\n  [data-kfg-root] .kfg_chips{display:flex;flex-wrap:wrap;gap:var(--s-2xs)}\n  [data-kfg-root] .kfg_chip{border:1.5px solid var(--hair);border-radius:var(--r);background:#fff;padding:10px 16px;font-size:13.5px;\n    cursor:pointer;min-height:44px;display:inline-flex;align-items:center;gap:var(--s-2xs);transition:border-color .15s}\n  [data-kfg-root] .kfg_chip.is-active{border-color:var(--ink);font-weight:500}\n  [data-kfg-root] .kfg_chip small{font-size:11px;color:#888;font-weight:400}\n  [data-kfg-root] .kfg_chip:disabled{opacity:.4;cursor:not-allowed}\n\n  [data-kfg-root] .kfg_dims{display:grid;grid-template-columns:1fr 1fr;gap:var(--s-xs)}\n  [data-kfg-root] .kfg_field label{font-size:12px;color:#5F5F5F;display:block;margin-bottom:var(--s-3xs)}\n  [data-kfg-root] .kfg_field .in{display:flex;align-items:center;border:1.5px solid var(--hair);border-radius:var(--r);overflow:hidden}\n  [data-kfg-root] .kfg_field input{border:0;outline:0;width:100%;padding:var(--s-xs);font-size:16px;font-weight:500;min-height:44px}\n  [data-kfg-root] .kfg_field .unit{padding-right:var(--s-xs);color:#999;font-size:13px}\n  [data-kfg-root] .kfg_field .range{font-weight:300;font-size:11px;color:#9b978c;margin-top:var(--s-3xs);display:block;letter-spacing:.03em}\n  [data-kfg-root] .kfg_field.is-error .in{border-color:#c0392b}   [data-kfg-root] .kfg_field .in:focus-within,[data-kfg-root] .kfg_radcell:focus-within,[data-kfg-root] .kfg_radall:focus-within{border-color:var(--ink)}   [data-kfg-root] .kfg_upload:focus-visible{outline:2px solid var(--ink);outline-offset:2px}   [data-kfg-root] .kfg_layout.is-busy{pointer-events:none;opacity:.7;transition:opacity .2s}   [data-kfg-root] .kfg_cta:disabled{opacity:.55;cursor:not-allowed}   [data-kfg-root] .kfg_summary.is-ungueltig .val{color:#9b978c}   [data-kfg-root] .kfg_preview-kauf{display:none}   @media(max-width:979px){ [data-kfg-root] .kfg_preview-kauf{display:flex;align-items:center;justify-content:space-between;gap:var(--s-xs);margin-top:var(--s-2xs);padding:var(--s-2xs) 0 0;border-top:1px solid #00000012}   [data-kfg-root] .kfg_preview-kauf .p{display:flex;flex-direction:column;min-width:0}   [data-kfg-root] .kfg_preview-kauf .val{font-size:22px;font-weight:600;letter-spacing:-.01em;line-height:1.1;white-space:nowrap}   [data-kfg-root] .kfg_preview-kauf small{font-size:11px;color:#5F5F5F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}   [data-kfg-root] .kfg_preview-kauf .kfg_cta{margin-top:0;width:auto;flex:0 0 auto;min-height:44px;padding:0 var(--s-s);font-size:14px}   [data-kfg-root] .kfg_preview-hint{display:none} }   [data-kfg-root] .kfg_datenhinweis[hidden]{display:none}   [data-kfg-root] .kfg_datenhinweis{margin-top:var(--s-xs);font-size:12.5px;color:var(--warn);background:var(--warn-bg);border-radius:var(--r);padding:var(--s-2xs) var(--s-xs);display:flex;gap:var(--s-2xs);align-items:center;flex-wrap:wrap}   [data-kfg-root] .kfg_datenhinweis button{border:1.5px solid currentColor;background:transparent;color:inherit;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;font-weight:500;min-height:32px}\n  [data-kfg-root] .kfg_field .err{display:none;font-size:11.5px;color:#c0392b;margin-top:var(--s-3xs)}\n  [data-kfg-root] .kfg_field.is-error .err{display:block}\n  [data-kfg-root] .kfg_quick{margin-top:var(--s-s)}\n  [data-kfg-root] .kfg_quick p{font-size:12px;color:#5F5F5F;margin-bottom:var(--s-2xs)}\n  [data-kfg-root] .kfg_quick-chips{display:flex;flex-wrap:wrap;gap:6px}\n  [data-kfg-root] .kfg_quick-chip{font-weight:300;font-size:12px;letter-spacing:.03em;padding:7px 10px;border:1px solid var(--hair);\n    border-radius:var(--r);background:var(--alt);cursor:pointer;transition:all .15s}\n  [data-kfg-root] .kfg_quick-chip:hover{border-color:var(--ink)}\n  [data-kfg-root] .kfg_quick-chip.is-active{background:var(--ink);color:#fff;border-color:var(--ink);font-weight:400}\n  [data-kfg-root] .kfg_measure{margin-top:var(--s-s);font-size:13px}\n  [data-kfg-root] .kfg_measure summary{cursor:pointer;color:#555;font-weight:500;list-style:none;display:inline-flex;align-items:center;gap:6px}\n  [data-kfg-root] .kfg_share button{display:inline-flex;align-items:center;justify-content:center;gap:7px}\n  [data-kfg-root] .kfg_measure p{margin-top:var(--s-2xs);color:#5F5F5F;font-size:12.5px;line-height:1.55;background:var(--alt);\n    border-radius:var(--r);padding:var(--s-xs)}\n\n  [data-kfg-root] .kfg_radius{display:flex;align-items:flex-end;gap:var(--s-xs);flex-wrap:wrap}\n  [data-kfg-root] .kfg_radius .kfg_field{width:120px}\n  [data-kfg-root] .kfg_radius .kfg_field input{padding:9px var(--s-xs);font-size:14px;min-height:40px}\n  [data-kfg-root] .kfg_rule-note{margin-top:var(--s-2xs);font-size:12px;color:#9a6b12;background:var(--warn-bg);border-radius:var(--r);padding:var(--s-xs)}\n\n  [data-kfg-root] .kfg_edge-note{margin-top:var(--s-s);font-size:12.5px;color:#5F5F5F;background:var(--alt);border-radius:var(--r);\n    padding:var(--s-xs);display:flex;gap:var(--s-2xs);align-items:flex-start}\n  [data-kfg-root] .kfg_trust span .ic-svg{width:13px;height:13px}\n  [data-kfg-root] .kfg_mpx-note{margin-top:var(--s-2xs);font-size:12px;color:#9a6b12;background:var(--warn-bg);border-radius:var(--r);padding:var(--s-xs);display:none}\n\n  [data-kfg-root] .kfg_check{display:flex;align-items:flex-start;gap:var(--s-xs);padding:var(--s-xs);border:1.5px solid var(--hair);\n    border-radius:var(--r);cursor:pointer;transition:border-color .15s}\n  [data-kfg-root] .kfg_check + .kfg_check{margin-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_check.is-active{border-color:var(--ink)}\n  [data-kfg-root] .kfg_check input{margin-top:3px;accent-color:var(--ink);width:16px;height:16px}\n  [data-kfg-root] .kfg_check b{font-size:13.5px;font-weight:500;display:block}\n  [data-kfg-root] .kfg_check small{font-size:12px;color:#5F5F5F}\n  [data-kfg-root] .kfg_check .pr{margin-left:auto;font-weight:300;font-size:12px;color:#555;white-space:nowrap;letter-spacing:.02em}\n  [data-kfg-root] .kfg_custom{display:none;margin-top:var(--s-2xs);border:1.5px dashed var(--hair);border-radius:var(--r);padding:var(--s-s)}\n  [data-kfg-root] .kfg_custom.is-open{display:block}\n  [data-kfg-root] .kfg_custom textarea{width:100%;border:1.5px solid var(--hair);border-radius:var(--r);padding:var(--s-xs);\n    font-size:13px;min-height:64px;resize:vertical;outline:none}\n  [data-kfg-root] .kfg_custom textarea:focus{border-color:var(--ink)}\n  [data-kfg-root] .kfg_upload{margin-top:var(--s-2xs);border:1.5px dashed #c9c6bd;border-radius:var(--r);background:var(--alt);\n    padding:var(--s-s);text-align:center;font-size:12.5px;color:#5F5F5F;cursor:pointer;transition:border-color .15s}\n  [data-kfg-root] .kfg_upload:hover{border-color:var(--ink)}\n  [data-kfg-root] .kfg_upload b{display:block;font-weight:500;color:var(--ink);margin-bottom:2px}\n  [data-kfg-root] .kfg_custom-hint{font-size:11.5px;color:#9a6b12;margin-top:var(--s-2xs)}\n\n  [data-kfg-root] .kfg_preset{display:flex;align-items:center;gap:var(--s-xs);padding:var(--s-xs);border:1.5px solid var(--hair);\n    border-radius:var(--r);transition:border-color .15s}\n  [data-kfg-root] .kfg_preset + .kfg_preset{margin-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_preset.is-active{border-color:var(--ink)}\n  [data-kfg-root] .kfg_preset b{font-size:13.5px;font-weight:500;display:block}\n  [data-kfg-root] .kfg_preset small{font-size:12px;color:#5F5F5F}\n  [data-kfg-root] .kfg_preset .pr{margin-left:auto;font-weight:300;font-size:12px;color:#555;white-space:nowrap;letter-spacing:.02em}\n  [data-kfg-root] .kfg_stepper{display:inline-flex;align-items:stretch;gap:0;\n    border:1.5px solid var(--hair);border-radius:var(--r);overflow:hidden}\n  [data-kfg-root] .kfg_stepper button{border:0;background:#fff;width:36px;height:36px;font-size:17px;\n    cursor:pointer;color:var(--ink);display:grid;place-items:center;line-height:1;padding:0}\n  [data-kfg-root] .kfg_stepper button:hover{background:var(--alt)}\n  [data-kfg-root] .kfg_stepper [data-count]{min-width:28px;text-align:center;font-weight:500;font-size:14px;\n    font-variant-numeric:tabular-nums;display:grid;place-items:center;line-height:1}\n  [data-kfg-root] .kfg_cutlist{display:flex;flex-wrap:wrap;gap:var(--s-2xs);margin-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_cutitem{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--hair);border-radius:var(--r);\n    padding:6px 10px;font-size:12px;background:var(--alt)}\n  [data-kfg-root] .kfg_cutitem button{border:0;background:none;cursor:pointer;font-size:14px;color:#999;padding:0 2px;line-height:1}\n  [data-kfg-root] .kfg_cutitem button:hover{color:#c0392b}\n  [data-kfg-root] #stage.is-drawing{cursor:crosshair;touch-action:none}\n  [data-kfg-root] #stage.is-dragging{touch-action:none}\n  [data-kfg-root] .kfg_muster{background:var(--card);border-radius:var(--r);padding:var(--s-s);display:flex;gap:var(--s-xs);align-items:center}\n  [data-kfg-root] .kfg_muster .ic .ic-svg{width:22px;height:22px}\n  [data-kfg-root] .kfg_muster b{font-size:13.5px;font-weight:500;display:block}\n  [data-kfg-root] .kfg_muster small{font-size:12px;color:#5F5F5F}\n  [data-kfg-root] .kfg_muster button{margin-left:auto;border:1px solid var(--ink);background:#fff;border-radius:var(--r);\n    padding:9px 14px;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;min-height:40px}\n\n  /* Summary */\n  [data-kfg-root] .kfg_summary{border:1px solid var(--hair);border-radius:var(--r);padding:var(--s-s);margin-top:var(--s-s);background:#fff}\n  [data-kfg-root] .kfg_sum-row{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--s-s)}\n  [data-kfg-root] .kfg_sum-price small{display:block;font-size:12px;color:#5F5F5F}\n  [data-kfg-root] .kfg_sum-price .val{font-size:30px;font-weight:600;letter-spacing:-.01em;line-height:1.1}\n  [data-kfg-root] .kfg_sum-price .vat{font-size:11px;color:#999}\n  [data-kfg-root] .kfg_delivery{font-size:12.5px;text-align:right}\n  [data-kfg-root] .kfg_delivery b{display:block;font-weight:500}\n  [data-kfg-root] .kfg_delivery span{color:#5F5F5F}\n  [data-kfg-root] .kfg_breakdown{margin-top:var(--s-xs);font-size:12.5px}\n  [data-kfg-root] .kfg_breakdown summary{cursor:pointer;color:#555;list-style:none;display:inline-flex;gap:6px;align-items:center}\n  [data-kfg-root] .kfg_breakdown summary::after{margin-left:2px}\n  [data-kfg-root] .kfg_breakdown table{width:100%;margin-top:var(--s-2xs);border-collapse:collapse}\n  [data-kfg-root] .kfg_breakdown td{padding:var(--s-3xs) 0;color:#5F5F5F;font-size:12px}\n  [data-kfg-root] .kfg_breakdown td:last-child{text-align:right;font-weight:300;letter-spacing:.02em}\n  [data-kfg-root] .kfg_breakdown tr.total td{border-top:1px solid var(--hair);padding-top:var(--s-2xs);color:var(--ink);font-weight:500}\n  [data-kfg-root] .kfg_cta{margin-top:var(--s-s);width:100%;border:0;border-radius:var(--r);background:var(--ink);color:#fff;\n    font-size:15px;font-weight:500;padding:var(--s-s);cursor:pointer;min-height:52px;transition:background .15s}\n  [data-kfg-root] .kfg_cta:hover{background:var(--deep)}\n  [data-kfg-root] .kfg_cta.is-sonder{background:#fff;color:var(--ink);border:1.5px solid var(--ink)}\n  .kfg_cta.is-sofort{background:#fff;color:var(--ink);border:1.5px solid var(--ink);margin-top:var(--s-2xs)}\n  .kfg_cta.is-sofort:hover{background:var(--card)}\n  [data-kfg-root] .kfg_bar .kfg_cta.is-sonder{border-width:1.5px}\n  [data-kfg-root] .kfg_trust{display:flex;justify-content:center;gap:var(--s-s);margin-top:var(--s-xs);font-size:11px;color:#888;flex-wrap:wrap}\n  [data-kfg-root] .kfg_trust span{display:inline-flex;align-items:center;gap:5px}\n  [data-kfg-root] .kfg_share{display:flex;gap:var(--s-2xs);margin-top:var(--s-s)}\n  [data-kfg-root] .kfg_share button{flex:1;border:1px solid var(--hair);background:var(--alt);border-radius:var(--r);\n    padding:10px;font-size:12.5px;cursor:pointer;min-height:44px}\n  [data-kfg-root] .kfg_share button:hover{border-color:var(--ink)}\n\n  /* \u2550\u2550 MOBILE \u2550\u2550 */\n  /* Sticky Mini-Vorschau: erscheint, sobald die gro\u00dfe Vorschau aus dem Bild scrollt */\n  [data-kfg-root] .kfg_mini{position:fixed;left:0;right:0;z-index:45;background:#fff;border-bottom:1px solid var(--hair);\n    display:flex;align-items:center;gap:var(--s-xs);padding:var(--s-2xs) var(--s-s);\n    box-shadow:0 6px 18px rgba(0,0,0,.06);transform:translateY(-110%);transition:transform .22s ease}\n  [data-kfg-root] .kfg_mini.is-on{transform:translateY(0)}\n  [data-kfg-root] .kfg_mini-plate{flex:0 0 auto;height:34px;max-width:64px;border-radius:4px;background-size:cover;background-position:center;\n    border:1px solid #00000018}\n  [data-kfg-root] .kfg_mini-plate.is-round{border-radius:50%}\n  [data-kfg-root] .kfg_mini-txt{min-width:0;line-height:1.25}\n  [data-kfg-root] .kfg_mini-txt b{display:block;font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  [data-kfg-root] .kfg_mini-txt span{display:block;font-size:11px;color:#5F5F5F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  [data-kfg-root] .kfg_mini button{margin-left:auto;flex:0 0 auto;border:1px solid var(--hair);background:var(--alt);border-radius:var(--r);\n    padding:7px 12px;font-size:12px;cursor:pointer;min-height:36px}\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_mini{padding-inline:clamp(16px,4vw,80px)}\n    [data-kfg-root] .kfg_mini-plate{height:42px;max-width:84px}\n  }\n\n  @media(max-width:979px){\n    [data-kfg-root] .kfg_hero{padding-top:var(--s-m)}\n    [data-kfg-root] .kfg_hero h1{font-size:26px}\n    [data-kfg-root] .kfg_hero p{font-size:14px}\n    [data-kfg-root] .kfg_layout{padding-top:var(--s-2xs);gap:var(--s-s)}\n    [data-kfg-root] .kfg_preview{padding:var(--s-xs)}\n    [data-kfg-root] .kfg_preview-stage, [data-kfg-root] #stage3d{aspect-ratio:10/7}\n    [data-kfg-root] .kfg_preview{margin-inline:calc(clamp(16px,4vw,80px) * -1);border-radius:0}\n    [data-kfg-root] .kfg_preview-hint{display:none}\n    /* Detailansicht einklappbar, spart ~300px vor dem ersten Schritt */\n    [data-kfg-root] .kfg_detail{display:block;padding:0;background:transparent}\n    [data-kfg-root] .kfg_detail summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:6px;\n      font-size:12.5px;color:#555;font-weight:500;background:#fff;border-radius:var(--r);padding:10px var(--s-xs);min-height:44px}\n    [data-kfg-root] .kfg_detail summary::after{margin-left:auto}\n    [data-kfg-root] .kfg_detail-inner{display:flex;flex-direction:column;gap:var(--s-2xs);background:#fff;border-radius:var(--r);\n      padding:var(--s-xs);margin-top:var(--s-3xs)}\n    [data-kfg-root] .kfg_detail img{width:100%;max-width:none;min-width:0}\n    [data-kfg-root] .kfg_detail-badge{top:var(--s-m);left:var(--s-m)}\n    [data-kfg-root] .kfg_detail-label{text-align:left}\n    /* Preset-Zeilen: Stepper unter den Text statt gequetscht daneben */\n    [data-kfg-root] .kfg_preset{flex-wrap:wrap}\n    [data-kfg-root] .kfg_preset .pr{margin-left:0;order:3}\n    [data-kfg-root] .kfg_preset .kfg_stepper{margin-left:auto;order:4}\n    [data-kfg-root] .kfg_muster{flex-wrap:wrap}\n    [data-kfg-root] .kfg_muster button{margin-left:0;width:100%}\n    [data-kfg-root] .kfg_modal-box{padding:var(--s-s);border-radius:12px;max-height:94vh}\n    [data-kfg-root] .kfg_step{padding:var(--s-s) var(--s-xs)}\n  }\n  /* Die Leiste ist grundsaetzlich aus und kommt erst, wenn der Konfigurator\n     nach oben aus dem Bild gescrollt ist — auch mobil (Wunsch Sascha\n     29.07.). Solange man konfiguriert, steht der Preis in der Karte. */\n  /* Schwebende Karte statt randloser Platte: 8 px Ecken, umlaufender\n     Haarstrich, und die Hoehe folgt der Beschriftung statt fest zu sein\n     (Wunsch Sascha 29.07.). */\n  [data-kfg-root] .kfg_bar{position:fixed;bottom:0;left:0;right:0;background:#fff;\n    border:1px solid var(--hair);border-radius:var(--r);\n    margin:0 var(--s-xs) calc(var(--s-xs) + env(safe-area-inset-bottom));\n    display:none;transform:translateY(140%);transition:transform .22s ease;\n    padding:var(--s-xs) var(--s-xs) var(--s-xs) var(--s-s);z-index:60;\n    align-items:center;gap:var(--s-xs);box-shadow:0 10px 30px -12px rgba(0,0,0,.22)}\n  [data-kfg-root] .kfg_bar.is-on{display:flex;transform:translateY(0)}\n  /* Was gekauft wird, steht jetzt in der Leiste: kleine Platte, Material\n     und Dekor, darunter Form, Mass und Staerke (Befund Sascha 29.07.). */\n  [data-kfg-root] .kfg_bar-thumb{flex:0 0 auto;width:48px;height:36px;border-radius:4px;\n    background:var(--card);background-size:cover;background-position:center;border:1px solid #00000018}\n  [data-kfg-root] .kfg_bar-thumb.is-round{border-radius:50%;width:36px}\n  [data-kfg-root] .kfg_bar-what{min-width:0;line-height:1.25;flex:1 1 auto}\n  [data-kfg-root] .kfg_bar-what b{display:block;font-size:12.5px;font-weight:500;\n    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  [data-kfg-root] .kfg_bar-what small{display:block;font-size:11px;color:#5F5F5F;\n    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  [data-kfg-root] .kfg_bar .p{line-height:1.15;flex:0 0 auto;text-align:right}\n  [data-kfg-root] .kfg_bar .p .val{font-size:19px;font-weight:600;display:block}\n  [data-kfg-root] .kfg_bar .p small{font-size:10.5px;color:#5F5F5F;white-space:nowrap}\n  /* Gleiche Optik wie der Knopf in der Preiskarte (Wunsch Sascha 29.07.):\n     Rundung, Schriftgroesse und Hoehe unveraendert, nur die Breite ist\n     begrenzt statt ueber die halbe Seite zu laufen. */\n  [data-kfg-root] .kfg_bar .kfg_cta{margin:0;flex:0 0 auto;padding:14px var(--s-l);\n    min-height:50px;font-size:15px;width:auto;min-width:230px;border-radius:var(--r)}\n  /* Schmale Schirme: Bezeichnung und Miniatur weichen, damit Preis und\n     Knopf nicht aus der Leiste laufen (Befund Sascha 29.07.). */\n  @media(max-width:560px){\n    [data-kfg-root] .kfg_bar{gap:var(--s-2xs);padding-inline:var(--s-xs)}\n    [data-kfg-root] .kfg_bar-what{display:none}\n    [data-kfg-root] .kfg_bar-thumb{display:none}\n    [data-kfg-root] .kfg_bar .p{margin-right:auto;text-align:left}\n    [data-kfg-root] .kfg_bar .kfg_cta{flex:1 1 auto;min-width:0;max-width:62%;\n      padding-inline:var(--s-xs);font-size:14px;white-space:nowrap;\n      overflow:hidden;text-overflow:ellipsis}\n  }\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_bar.is-on{max-width:1180px;margin-inline:auto;\n      padding:var(--s-xs) var(--s-xs) var(--s-xs) var(--s-m)}\n    [data-kfg-root] .kfg_bar.is-on .p{margin-left:auto}\n    [data-kfg-root] .kfg_bar.is-on .p .val{font-size:21px}\n    [data-kfg-root] .kfg_bar.is-on .kfg_cta{flex:0 0 auto;min-width:260px}\n    [data-kfg-root] .kfg_bar.is-on .kfg_bar-thumb{width:62px;height:47px}\n    [data-kfg-root] .kfg_bar.is-on .kfg_bar-what b{font-size:14px}\n    [data-kfg-root] .kfg_bar.is-on .kfg_bar-what small{font-size:12px}\n  }\n\n  [data-kfg-root] .kfg_modal{position:fixed;inset:0;background:rgba(10,10,10,.45);z-index:100;display:flex;align-items:center;justify-content:center;padding:var(--s-s)}\n  [data-kfg-root] .kfg_modal[hidden]{display:none}\n  [data-kfg-root] .kfg_modal-box{background:#fff;border-radius:16px;max-width:960px;width:100%;max-height:90vh;overflow:auto;padding:var(--s-m)}\n  [data-kfg-root] .kfg_modal-head{display:flex;align-items:center;gap:var(--s-xs);margin-bottom:var(--s-s)}\n  [data-kfg-root] .kfg_modal-head b{font-size:18px;font-weight:600}\n  [data-kfg-root] .kfg_modal-tag{font-size:11px;color:#9a6b12;background:var(--warn-bg);border-radius:var(--r);padding:3px 8px}\n  [data-kfg-root] .kfg_modal-head button{margin-left:auto;border:0;background:var(--alt);border-radius:var(--r);width:36px;height:36px;font-size:20px;cursor:pointer}\n  [data-kfg-root] .kfg_modal-grid{display:grid;grid-template-columns:1fr;gap:var(--s-m)}\n  @media(min-width:760px){[data-kfg-root] .kfg_modal-grid{grid-template-columns:55fr 45fr}}\n  [data-kfg-root] .kfg_modal-draw{background:var(--card);border-radius:var(--r);padding:var(--s-xs)}\n  [data-kfg-root] .kfg_modal-draw svg{width:100%;display:block}\n  [data-kfg-root] .kfg_modal-draw p{font-size:11px;color:#8a877f;text-align:center;padding-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_modal-data table{width:100%;border-collapse:collapse;font-size:13px}\n  [data-kfg-root] .kfg_modal-data td{padding:6px 0;border-bottom:1px solid var(--hair);vertical-align:top}\n  [data-kfg-root] .kfg_modal-data td:first-child{color:#5F5F5F;width:38%;padding-right:var(--s-xs)}\n  [data-kfg-root] .kfg_modal-data .props{margin-top:var(--s-s);background:var(--alt);border-radius:var(--r);padding:var(--s-xs);\n    font-size:11px;color:#555;font-weight:300;letter-spacing:.02em;line-height:1.7;word-break:break-all}\n  [data-kfg-root] .kfg_modal-data .props b{display:block;font-weight:500;color:var(--ink);font-size:11.5px;margin-bottom:4px;letter-spacing:0}\n  [data-kfg-root] .toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%) translateY(20px);background:var(--deep);color:#fff;\n    padding:10px 18px;border-radius:var(--r);font-size:13px;opacity:0;pointer-events:none;transition:all .25s;z-index:70}\n  [data-kfg-root] .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}\n\n  /* \u2500\u2500 Isolationsschicht: Webflow-Site-CSS darf nicht in den Konfigurator bluten,\n        und der Konfigurator faerbt/resettet nichts ausserhalb seines Containers.\n        :where() hat Spezifitaet 0 \u2192 eigene Regeln gewinnen immer. \u2500\u2500 */\n  [data-kfg-root]{\n    --ink:#1E1E1E; --deep:#0A0A0A; --card:#F2F0EB; --alt:#FAFAFA; --hair:#E5E5E5;\n    --ok:#1c7a3d; --ok-bg:#e8f4ec; --warn:#9a6b12; --warn-bg:#faf3e2;\n    --s-3xs:4px; --s-2xs:8px; --s-xs:12px; --s-s:16px; --s-m:24px; --s-l:32px; --s-xl:48px; --s-2xl:64px;\n    --r:8px;\n    display:block; box-sizing:border-box;\n    font-family:'Onest','DM Sans',sans-serif; font-size:15px; font-weight:400;\n    line-height:1.45; color:#1E1E1E; background:#fff; text-align:left;\n    letter-spacing:normal; text-transform:none; -webkit-font-smoothing:antialiased;\n  }\n  [data-kfg-root] :where(*, *::before, *::after){\n    box-sizing:border-box; margin:0; padding:0;\n    font-family:inherit; line-height:inherit; color:inherit;\n    letter-spacing:normal; text-transform:none;\n  }\n  /* text-align NICHT pauschal auf inherit setzen \u2014 das nahm Buttons die vom\n     Browser vorgegebene Zentrierung, wodurch Minus und Plus im Mengenfeld\n     links klebten (Befund Sascha, 27.07.). */\n  [data-kfg-root] :where(button){text-align:center}\n  [data-kfg-root] :where(b, strong){font-weight:600}\n  [data-kfg-root] :where(small){font-size:inherit}\n  [data-kfg-root] :where(button){background:none;border:none;cursor:pointer;font:inherit}\n  [data-kfg-root] :where(img, svg){max-width:100%}\n  [data-kfg-root] :where(p, span, div, label, li, td, th, summary){font-weight:inherit}\n\n  /* Ueberschriften grundsaetzlich schwarz (Sascha 26.07.) */\n  [data-kfg-root] .kfg_step-title,\n  [data-kfg-root] .kfg_step-num,\n  [data-kfg-root] .kfg_sublabel,\n  [data-kfg-root] .kfg_mat b,\n  [data-kfg-root] .kfg_preset b,\n  [data-kfg-root] .kfg_check b,\n  [data-kfg-root] .kfg_muster b,\n  [data-kfg-root] .kfg_modal-head b,\n  [data-kfg-root] .kfg_detail-label b,\n  [data-kfg-root] .kfg_upload b,\n  [data-kfg-root] h1, [data-kfg-root] h2, [data-kfg-root] h3, [data-kfg-root] h4,\n  [data-kfg-root] summary{color:#1E1E1E}\n\n  /* \u2500\u2500 Schritt 05: EIN Raster fuer alle Zeilen \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n     Spalten: [Checkbox 18px] [Text 1fr] [Preis auto] [Stepper 96px]\n     Preset-Zeilen lassen Spalte 1 leer \u2192 Textkante identisch zu den\n     Checkbox-Zeilen. Checkbox-Zeilen lassen Spalte 4 leer \u2192 Preise stehen\n     bei allen Zeilen in derselben Spalte. min-height macht alle gleich hoch. */\n  [data-kfg-root] .kfg_panel{container-type:inline-size;container-name:kfgpanel}\n  [data-kfg-root] .kfg_check,\n  [data-kfg-root] .kfg_preset{\n    display:grid;\n    grid-template-columns:18px minmax(0,1fr) auto 96px;\n    align-items:center;\n    column-gap:var(--s-xs);\n    row-gap:0;\n    min-height:0;\n    padding:var(--s-xs) var(--s-s);\n    border:1.5px solid var(--hair);\n    border-radius:var(--r);\n  }\n  /* gleiche Abstaende zwischen ALLEN Zeilentypen */\n  [data-kfg-root] .kfg_check + .kfg_check,\n  [data-kfg-root] .kfg_check + .kfg_preset,\n  [data-kfg-root] .kfg_preset + .kfg_check,\n  [data-kfg-root] .kfg_preset + .kfg_preset{margin-top:var(--s-2xs)}\n\n  [data-kfg-root] .kfg_check input{grid-column:1;margin:0;accent-color:var(--ink);width:16px;height:16px}\n  [data-kfg-root] .kfg_check > span:not(.pr),\n  [data-kfg-root] .kfg_preset > span:not(.pr):not(.kfg_stepper){\n    grid-column:2;min-width:0;display:block;\n  }\n  [data-kfg-root] .kfg_check .pr,\n  [data-kfg-root] .kfg_preset .pr{\n    grid-column:3;justify-self:end;margin:0;white-space:nowrap;text-align:right;\n    font-size:12px;font-weight:400;color:#555;letter-spacing:.02em;\n  }\n  [data-kfg-root] .kfg_preset .kfg_stepper{grid-column:4;justify-self:end;margin:0}\n\n  /* Titel einzeilig, Unterzeile auf 2 Zeilen begrenzt und reserviert\n     \u2192 jede Zeile in Schritt 05 ist exakt gleich hoch, unabhaengig von der Textlaenge */\n  /* Titel und Unterzeile je eine Zeile, Textblock mit fester Hoehe:\n     dadurch sind ALLE Zeilen in Schritt 05 exakt gleich hoch und der Preis\n     haengt nicht mehr als eigene Zeile darunter. */\n  [data-kfg-root] .kfg_check b,\n  [data-kfg-root] .kfg_preset b{\n    display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;\n    font-size:13.5px;font-weight:500;line-height:1.35;color:#1E1E1E;\n  }\n  [data-kfg-root] .kfg_check > span:not(.pr),\n  [data-kfg-root] .kfg_preset > span:not(.pr):not(.kfg_stepper){height:53px}\n  [data-kfg-root] .kfg_check small,\n  [data-kfg-root] .kfg_preset small{\n    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;\n    font-size:12px;line-height:1.35;color:#5F5F5F;margin-top:2px;\n  }\n\n  [data-kfg-root] .kfg_stepper button{width:34px;height:34px}\n\n  /* Schmale Panels: Preis + Stepper ruecken unter den Text, Raster bleibt sauber */\n  @media(max-width:520px){\n    [data-kfg-root] .kfg_check,\n    [data-kfg-root] .kfg_preset{\n      grid-template-columns:18px minmax(0,1fr) auto;\n      row-gap:var(--s-2xs);\n    }\n    [data-kfg-root] .kfg_check > span:not(.pr),\n    [data-kfg-root] .kfg_preset > span:not(.pr):not(.kfg_stepper){grid-column:2/-1}\n    [data-kfg-root] .kfg_check .pr,\n    [data-kfg-root] .kfg_preset .pr{grid-column:2;justify-self:start;text-align:left}\n    [data-kfg-root] .kfg_preset .kfg_stepper{grid-column:3;justify-self:end}\n    /* Zeilen ohne Stepper reservieren dieselbe Hoehe wie die mit Stepper */\n    [data-kfg-root] .kfg_preset .pr{display:flex;align-items:center;min-height:36px}\n    [data-kfg-root] .kfg_preset .kfg_stepper{min-height:36px}\n    /* Checkbox-Zeilen haben keinen Stepper: Preis bleibt in der ersten Zeile */\n    [data-kfg-root] .kfg_check{grid-template-columns:18px minmax(0,1fr) auto}\n    [data-kfg-root] .kfg_check > span:not(.pr){grid-column:2}\n    [data-kfg-root] .kfg_check .pr{grid-column:3;justify-self:end;text-align:right;min-height:36px;display:flex;align-items:center}\n    [data-kfg-root] .kfg_check b, [data-kfg-root] .kfg_preset b,\n    [data-kfg-root] .kfg_check small, [data-kfg-root] .kfg_preset small{-webkit-line-clamp:2}\n    [data-kfg-root] .kfg_check > span:not(.pr),\n    [data-kfg-root] .kfg_preset > span:not(.pr):not(.kfg_stepper){height:auto;min-height:53px}\n    /* im gestapelten Layout darf der Titel umbrechen \u2014 nichts wird abgeschnitten */\n    [data-kfg-root] .kfg_check b,\n    [data-kfg-root] .kfg_preset b{white-space:normal;overflow:visible}\n  }\n  @container kfgpanel (max-width:420px){\n    [data-kfg-root] .kfg_check,\n    [data-kfg-root] .kfg_preset{\n      grid-template-columns:18px minmax(0,1fr) auto;\n      row-gap:var(--s-2xs);\n    }\n    [data-kfg-root] .kfg_check > span:not(.pr),\n    [data-kfg-root] .kfg_preset > span:not(.pr):not(.kfg_stepper){grid-column:2/-1}\n    [data-kfg-root] .kfg_check .pr,\n    [data-kfg-root] .kfg_preset .pr{grid-column:2;justify-self:start;text-align:left}\n    [data-kfg-root] .kfg_preset .kfg_stepper{grid-column:3;justify-self:end}\n    /* Zeilen ohne Stepper reservieren dieselbe Hoehe wie die mit Stepper */\n    [data-kfg-root] .kfg_check .pr,\n    [data-kfg-root] .kfg_preset .pr{display:flex;align-items:center;min-height:36px}\n    [data-kfg-root] .kfg_preset .kfg_stepper{min-height:36px}\n    /* im gestapelten Layout darf der Titel umbrechen \u2014 nichts wird abgeschnitten */\n    [data-kfg-root] .kfg_check b,\n    [data-kfg-root] .kfg_preset b{white-space:normal;overflow:visible}\n  }\n\n\n  /* Musterbox-Karte auf dieselbe Textkante */\n  [data-kfg-root] .kfg_muster{align-items:center;gap:var(--s-xs);padding:var(--s-s)}\n  [data-kfg-root] .kfg_muster small{display:block;font-size:12px;line-height:1.35;color:#5F5F5F;margin-top:2px}\n\n  /* Dekor-Kacheln: Beschriftung darf nicht abgeschnitten werden */\n  /* Dekorname darf zwei Zeilen brauchen \u2014 \"Eiche Kamienny\" wurde vorher nach\n     dem ersten Wort abgeschnitten. Feste Hoehe haelt alle Kacheln gleich gross. */\n  [data-kfg-root] .kfg_dekor{overflow:visible}\n  [data-kfg-root] .kfg_dekor > span:last-child{\n    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;\n    font-size:10.5px; line-height:1.25; color:#1E1E1E; text-align:center;\n    white-space:normal; word-break:normal; hyphens:none;\n    height:30px; padding-top:var(--s-3xs);\n  }\n\n  /* \u2500\u2500 Radius je Ecke: verknuepfter Wert oben, darunter die vier Ecken\n        in derselben Anordnung wie auf der Platte (Draufsicht). \u2500\u2500 */\n  [data-kfg-root] .kfg_radgrid{margin-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_radall{\n    display:flex;align-items:center;gap:var(--s-2xs);\n    border:1.5px solid var(--hair);border-radius:var(--r);\n    padding:8px var(--s-xs);margin-bottom:var(--s-2xs);background:var(--alt);\n  }\n  [data-kfg-root] .kfg_radall.is-linked{border-color:var(--ink)}\n  [data-kfg-root] .kfg_radall em{margin-left:auto;font-style:normal;font-size:11px;color:#5F5F5F}\n  [data-kfg-root] .kfg_radquad{\n    display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s-2xs);max-width:340px;\n  }\n  [data-kfg-root] .kfg_radlist{display:grid;grid-template-columns:1fr;gap:var(--s-2xs);max-width:420px}\n  [data-kfg-root] .kfg_radlist .kfg_radcell .nm{flex:1 1 auto;font-size:12.5px;color:#1E1E1E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  [data-kfg-root] .kfg_radlist .kfg_radcell input{width:64px;flex:0 0 64px;text-align:right}\n  [data-kfg-root] .kfg_lfrow{margin-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_lfrow .kfg_sublabel{margin-top:0}\n  [data-kfg-root] .kfg_radcell{\n    display:flex;align-items:center;gap:6px;\n    border:1.5px solid var(--hair);border-radius:var(--r);padding:6px var(--s-2xs);\n    background:#fff;cursor:text;\n  }\n  [data-kfg-root] .kfg_radcell.is-on{border-color:var(--ink)}\n  [data-kfg-root] .kfg_radall input,\n  [data-kfg-root] .kfg_radcell input{\n    width:100%;min-width:0;border:0;outline:0;background:transparent;\n    font-size:14px;font-weight:500;color:#1E1E1E;padding:2px 0;-moz-appearance:textfield;\n  }\n  [data-kfg-root] .kfg_radall input::-webkit-outer-spin-button,\n  [data-kfg-root] .kfg_radall input::-webkit-inner-spin-button,\n  [data-kfg-root] .kfg_radcell input::-webkit-outer-spin-button,\n  [data-kfg-root] .kfg_radcell input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}\n  [data-kfg-root] .kfg_radall .u,\n  [data-kfg-root] .kfg_radcell .u{font-size:11px;color:#999;flex:0 0 auto}\n  [data-kfg-root] .kfg_cornerhit:hover{fill:#1E1E1E12}\n\n  /* \u2500\u2500 Gruppen in Schritt 05 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n  [data-kfg-root] .kfg_grouplabel{\n    font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8a8a;\n    font-weight:500;margin:var(--s-m) 0 var(--s-2xs);\n  }\n  [data-kfg-root] .kfg_grouplabel:first-of-type{margin-top:var(--s-s)}\n\n  /* \u2500\u2500 Z\u00e4hler am Schritt-Kopf \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n  [data-kfg-root] .kfg_step-count{\n    margin-left:auto;font-size:11px;font-weight:500;letter-spacing:.02em;\n    background:var(--ink);color:#fff;border-radius:var(--r);padding:3px 9px;\n    white-space:nowrap;max-width:52%;overflow:hidden;text-overflow:ellipsis;\n  }\n  [data-kfg-root] .kfg_step-count.is-empty{background:var(--card);color:#8a8a8a}\n  [data-kfg-root] .kfg_step-head{display:flex;align-items:center;gap:var(--s-2xs)}\n\n  /* \u2500\u2500 Konfigurations-Zusammenfassung \u00fcber dem CTA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n  [data-kfg-root] .kfg_conf{\n    border:1px solid var(--hair);border-radius:var(--r);background:var(--alt);\n    padding:var(--s-xs);margin:var(--s-s) 0 var(--s-2xs);\n  }\n  [data-kfg-root] .kfg_conf > p{\n    font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8a8a;\n    font-weight:500;margin-bottom:var(--s-2xs);\n  }\n  [data-kfg-root] .kfg_conf-chips{display:flex;flex-wrap:wrap;gap:5px}\n  [data-kfg-root] .kfg_conf-chip{\n    font-size:12px;line-height:1.3;border:1px solid var(--hair);background:#fff;\n    border-radius:var(--r);padding:5px 9px;color:var(--ink);cursor:pointer;text-align:left;\n  }\n  [data-kfg-root] .kfg_conf-chip:hover{border-color:var(--ink)}\n  [data-kfg-root] .kfg_conf-chip.is-warn{background:var(--warn-bg);border-color:#e8dcc0;color:var(--warn)}\n  [data-kfg-root] .kfg_step.is-flash{box-shadow:0 0 0 2px var(--ink);transition:box-shadow .2s}\n\n  /* Auf flachen Fenstern die Draufsicht mitskalieren, damit die Platte beim\n     Arbeiten an Ecken und Massen komplett sichtbar bleibt. */\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_preview-stage,\n    [data-kfg-root] #stage3d{max-height:min(74vh,780px)}\n  }\n\n  /* Flache Fenster: Vorschau UND Preiskarte wandern GEMEINSAM mit. Reicht die\n     Hoehe nicht, faellt gestuft weg, was am ehesten entbehrlich ist, die\n     Warenkorbkarte bleibt dabei immer am Bild (Wunsch Sascha, 27.07.). */\n  @media(min-width:980px){\n    [data-kfg-root] .kfg_stickycol.is-tight .kfg_trust,\n    [data-kfg-root] .kfg_stickycol.is-tight .kfg_share{display:none}\n    /* Das Vorschaubild behaelt IMMER seine Groesse (Wunsch Sascha): kein\n       Schrumpfen beim Scrollen. Fehlt Platz, wird die Karte zugeklappt —\n       die Zeile dafuer ist ja sichtbar. */\n    [data-kfg-root] .kfg_stickycol.is-tighter .kfg_conf,\n    [data-kfg-root] .kfg_stickycol.is-tighter .kfg_breakdown{display:none}\n    /* Notfallstufe: die Spalte scrollt intern. Bewusst OHNE overscroll-behavior:\n       contain - sonst bleibt das Mausrad am Ende der Karte haengen statt die\n       Seite weiterzuscrollen, und genau das fuehlt sich hakelig an. */\n    [data-kfg-root] .kfg_stickycol.is-scroll{overflow-y:auto;\n      max-height:calc(100vh - var(--kfg-top,96px) - 16px);scrollbar-width:thin;padding-right:6px}\n  }\n\n  /* Mobil: Vorschaukarte bleibt beim Konfigurieren stehen (ersetzt die Mini-Leiste).\n     Die Preiskarte sitzt auf Mobil ohnehin am Ende, Preis und CTA liegen unten\n     in der festen Leiste \u2014 die bleibt bewusst erhalten. */\n  @media(max-width:979px){\n    [data-kfg-root] .kfg_stickycol{position:sticky;top:var(--kfg-top,56px);z-index:3;\n      background:#fff;padding-bottom:var(--s-2xs)}\n    [data-kfg-root] .kfg_preview{box-shadow:0 6px 16px -12px #00000040}\n    /* Badge darf den 2D/3D-Umschalter nicht ueberlappen */\n    [data-kfg-root] .kfg_preview-badge{flex:1 1 auto;max-width:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n  }\n  [data-kfg-root] .kfg_machine{display:block;margin-top:var(--s-2xs);font-size:13px;color:#555}\n  [data-kfg-root] .kfg_machine input{width:100%;margin-top:var(--s-3xs);padding:10px 12px;border:1px solid var(--hair);\n    border-radius:var(--r);font-size:15px;background:#fff;color:var(--ink)}\n  [data-kfg-root] .kfg_machine input:focus{outline:none;border-color:var(--ink)}\n  /* Die Lackierung ist eine Kantenoption, keine Zeile aus Schritt 05. Sie erbt\n     sonst deren Kasten samt der fuer den Mengenregler reservierten Spalte und\n     klebt am Chip-Raster darueber (Ruecklauf Senior 30.07.: 'die Raender\n     muessen bei Kante Natur weg'). */\n  [data-kfg-root] #lackBlock{margin-top:var(--s-s)}\n  [data-kfg-root] #lackBlock .kfg_check,\n  [data-kfg-root] #lackBlock .kfg_check.is-active{\n    border:0;border-radius:0;padding:0;background:none;\n    grid-template-columns:18px minmax(0,1fr) auto;align-items:start;column-gap:var(--s-2xs)}\n  [data-kfg-root] #lackBlock .kfg_check > span:not(.pr){height:auto;grid-column:2}\n  [data-kfg-root] #lackBlock .kfg_check .pr{grid-column:3;justify-self:end;text-align:right;\n    align-self:center;min-height:0}\n  [data-kfg-root] #lackBlock .kfg_check small{-webkit-line-clamp:3}\n  [data-kfg-root] #lackBlock .kfg_check input{margin-top:2px}\n  @media(max-width:520px){\n    [data-kfg-root] #lackBlock .kfg_check .pr{grid-column:2;justify-self:start;text-align:left}\n  }\n  /* ── Abstaende in Schritt 05 ────────────────────────────────────────────\n     Die Gruppen-Wrapper aus v1.16.0 (#grpMaschine, #grpDurchlass, #grpKueche,\n     #grpCustom, #grpFrei) haben die Nachbarschafts-Selektoren zerschnitten:\n     '.kfg_check + .kfg_preset' greift ueber eine Wrapper-Grenze nicht mehr\n     (erste Zeile einer Gruppe stand ohne Abstand, Rahmen an Rahmen), und\n     jede Gruppenueberschrift galt in ihrem Wrapper als :first-of-type und\n     bekam 16 statt 24 px. Die Abstaende haengen deshalb ab v1.16.1 am\n     Element selbst statt an der Nachbarschaft — unabhaengig davon, wie tief\n     es verschachtelt ist. 8 px zwischen Zeilen, 24 px vor einer neuen\n     Gruppe, 16 px vor der ersten (Ruecklauf Senior 30.07.). */\n  [data-kfg-root] .kfg_step .kfg_check,\n  [data-kfg-root] .kfg_step .kfg_preset{margin-top:var(--s-2xs)}\n  [data-kfg-root] .kfg_step .kfg_grouplabel{margin-top:var(--s-m)}\n  [data-kfg-root] .kfg_step-body > .kfg_grouplabel:first-child{margin-top:var(--s-s)}\n  [data-kfg-root] .kfg_grouplabel + .kfg_sublabel{margin-top:0}\n  [data-kfg-root] .kfg_machine + .kfg_chips{margin-top:var(--s-2xs)}\n";

/* ═══════════════════════ MARKUP ═══════════════════════ */
var KFG_MARKUP = "<div class=\"kfg_layout\">\n\n  <!-- \u2550\u2550 PREVIEW \u2550\u2550 -->\n  <div class=\"kfg_stickycol\" id=\"stickyCol\">\n    <div class=\"kfg_preview\">\n      <div class=\"kfg_preview-top\">\n      <div class=\"kfg_preview-badge\" id=\"badge\"><span class=\"dot\"></span><span id=\"badgeText\">Ab Lager</span></div>\n      <div class=\"kfg_viewtoggle\">\n        <button id=\"btn2d\" class=\"is-active\" aria-pressed=\"true\">2D</button>\n        <button id=\"btn3d\" aria-pressed=\"false\">3D</button>\n      </div>\n      </div>\n      <svg class=\"kfg_preview-stage\" id=\"stage\" viewBox=\"0 0 600 444\" role=\"img\" aria-label=\"Vorschau der konfigurierten Tischplatte\"></svg>\n      <canvas id=\"stage3d\"></canvas>\n      <div class=\"kfg_preview-kauf\" id=\"previewKauf\"><div class=\"p\"><span class=\"val\" id=\"priceMini\">\u2014</span><small id=\"delivMini\">\u2014</small></div><button class=\"kfg_cta\" id=\"ctaMini\">In den Warenkorb</button></div>\n      <details class=\"kfg_detail\" id=\"detailCard\" open>\n        <summary>Kante &amp; Material im Detail</summary>\n        <div class=\"kfg_detail-inner\">\n          <span class=\"kfg_detail-badge\">Vorschaubild</span><img id=\"detailImg\" alt=\"Detailansicht der Kante \u2014 Vorschaubild\" src=\"\">\n          <div class=\"kfg_detail-label\" id=\"detailLabel\"></div>\n        </div>\n      </details>\n      <div class=\"kfg_preview-hint\" id=\"previewHint\">Draufsicht, ma\u00dfstabsgetreu \u00b7 Kanten und Ecken anklickbar</div>\n    </div>\n\n    <div class=\"kfg_summary\">\n      <div class=\"kfg_sum-row\">\n        <div class=\"kfg_sum-price\">\n          <small id=\"priceLabel\">Dein Preis</small>\n          <span class=\"val\" id=\"price\" aria-live=\"polite\">\u2014</span>\n          <span class=\"vat\" id=\"vatLine\">inkl. MwSt., kostenloser Versand</span>\n        </div>\n        <div class=\"kfg_delivery\">\n          <b id=\"delivDate\">\u2014</b>\n          <span id=\"delivSub\">\u2014</span>\n        </div>\n      </div>\n      <div class=\"kfg_datenhinweis\" id=\"datenHinweis\" hidden><span>Preise konnten gerade nicht geladen werden.</span> <button type=\"button\" id=\"datenNeu\">Erneut laden</button></div>\n      <details class=\"kfg_breakdown\">\n        <summary>Preis-Aufschl\u00fcsselung</summary>\n        <table id=\"breakdown\"></table>\n      </details>\n      <div class=\"kfg_conf\" id=\"confBox\"><p>Deine Konfiguration</p><div class=\"kfg_conf-chips\" id=\"confChips\"></div></div>\n      <button class=\"kfg_cta\" id=\"cta\">In den Warenkorb</button>\n      <button class=\"kfg_cta is-sofort\" id=\"ctaBuy\">Sofortkauf</button>\n      <div class=\"kfg_trust\">\n        <span><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 21h18M5 21V10l5 3.5V10l5 3.5V4h4v17\"/></svg> Manufaktur seit 1897</span><span><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3.2\"/><path d=\"M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1\"/></svg> CNC-pr\u00e4zise Kanten</span><span><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M1.5 16V6h12v10h-12zM13.5 9h4.5l4 4v3h-3\"/><circle cx=\"6\" cy=\"18\" r=\"1.8\"/><circle cx=\"17\" cy=\"18\" r=\"1.8\"/></svg> Lagergr\u00f6\u00dfe versandkostenfrei \u00b7 nach Ma\u00df 19,99 \u20ac</span>\n      </div>\n      <div class=\"kfg_share\">\n        <button id=\"btnShare\"><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9.5 14.5l5-5M8.5 12l-2 2a3.5 3.5 0 105 5l2-2M15.5 12l2-2a3.5 3.5 0 10-5-5l-2 2\"/></svg> Konfiguration teilen</button>\n        <button id=\"btnMail\"><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"M3 7.5l9 6 9-6\"/></svg> Per E-Mail senden</button>\n      </div>\n    </div>\n  </div>\n\n  <!-- \u2550\u2550 PANEL \u2550\u2550 -->\n  <div class=\"kfg_panel\">\n\n    <!-- 01 Material & Dekor -->\n    <section class=\"kfg_step\" id=\"kfgStep1\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">01</span><span class=\"kfg_step-title\">Material &amp; Dekor</span><span class=\"kfg_step-count\" id=\"k1\"></span></div>\n      <div class=\"kfg_mat-grid\" id=\"matGrid\"></div>\n      <div id=\"mpxSurfaceBlock\" style=\"display:none\">\n        <p class=\"kfg_sublabel\">Oberfl\u00e4che</p>\n        <div class=\"kfg_chips\" id=\"mpxSurfaceChips\">\n          <button class=\"kfg_chip is-active\" data-sf=\"natur\">Birke natur <small>geschliffen</small></button>\n          <button class=\"kfg_chip\" data-sf=\"hpl\">HPL-Laminat <small>alle Dekore</small></button>\n        </div>\n      </div>\n      <div class=\"kfg_dekor-grid\" id=\"dekorGrid\"></div>\n      <div class=\"kfg_muster\" style=\"margin-top:var(--s-s)\">\n        <span class=\"ic\"><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"4\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"13\" y=\"4\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"4\" y=\"13\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"13\" y=\"13\" width=\"7\" height=\"7\" rx=\"1.5\"/></svg></span>\n        <span><b>Unsicher beim Dekor?</b><small>Musterbox mit 4 Dekoren \u2014 4,90&nbsp;\u20ac, voll angerechnet beim Kauf</small></span>\n        <button type=\"button\" id=\"btnMuster\">Muster bestellen</button>\n      </div>\n      <p class=\"kfg_dekor-note\" id=\"dekorNote\">Original-Produktfotos aus dem Kessler-Archiv. Farbige ABS-Kanten sind f\u00fcr 18 und 25 mm verf\u00fcgbar.</p>\n    </section>\n\n    <!-- 02 Form -->\n    <section class=\"kfg_step\" id=\"kfgStep2\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">02</span><span class=\"kfg_step-title\">Form</span><span class=\"kfg_step-count\" id=\"k2\"></span></div>\n      <div class=\"kfg_chips\" id=\"formChips\">\n        <button class=\"kfg_chip is-active\" data-form=\"rect\">\u25ad Rechteck</button>\n        <button class=\"kfg_chip\" data-form=\"round\">\u25ef Rund</button>\n        <button class=\"kfg_chip\" data-form=\"lform\">\u2310 L-Form</button>\n        <button class=\"kfg_chip\" data-form=\"bauch\">\u2293 Bauchausschnitt</button>\n      </div>\n      <div id=\"cornerBlock\">\n        <p class=\"kfg_sublabel\">Ecken abrunden</p>\n        <div class=\"kfg_radius\">\n          <div class=\"kfg_chips\" id=\"cornerChips\"></div>\n        </div>\n        <div id=\"cornerSelBlock\">\n          <p class=\"kfg_sublabel\">Radius je Ecke</p>\n          <div class=\"kfg_radgrid\" id=\"cornerSel\"></div>\n        </div>\n        <div class=\"kfg_rule-note\" id=\"cornerRule\" style=\"display:none\"></div>\n      </div>\n    </section>\n\n    <!-- 03 Ma\u00df -->\n    <section class=\"kfg_step\" id=\"kfgStep3\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">03</span><span class=\"kfg_step-title\">Ma\u00df</span><span class=\"kfg_step-count\" id=\"k3\"></span>\n        <span class=\"kfg_step-sub\" id=\"massHint\" hidden></span></div>\n      <div class=\"kfg_dims\" id=\"dimsRect\">\n        <div class=\"kfg_field\" id=\"fL\">\n          <label for=\"inL\">L\u00e4nge</label>\n          <div class=\"in\"><input id=\"inL\" type=\"number\" inputmode=\"numeric\" value=\"120\" min=\"20\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeL\"></span><span class=\"err\" id=\"errL\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fB\">\n          <label for=\"inB\">Breite</label>\n          <div class=\"in\"><input id=\"inB\" type=\"number\" inputmode=\"numeric\" value=\"60\" min=\"20\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeB\"></span><span class=\"err\" id=\"errB\"></span>\n        </div>\n      </div>\n      <div class=\"kfg_dims\" id=\"dimsRound\" style=\"display:none\">\n        <div class=\"kfg_field\" id=\"fD\" style=\"grid-column:1/-1\">\n          <label for=\"inD\">Durchmesser \u00d8</label>\n          <div class=\"in\"><input id=\"inD\" type=\"number\" inputmode=\"numeric\" value=\"80\" min=\"20\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeD\"></span><span class=\"err\" id=\"errD\"></span>\n        </div>\n      </div>\n      <div class=\"kfg_dims\" id=\"dimsLform\" style=\"display:none\">\n        <div class=\"kfg_field\" id=\"fLL\">\n          <label for=\"inLL\">Gesamtl\u00e4nge</label>\n          <div class=\"in\"><input id=\"inLL\" type=\"number\" inputmode=\"numeric\" value=\"180\" min=\"20\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeLL\"></span><span class=\"err\" id=\"errLL\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fLB\">\n          <label for=\"inLB\">Gesamtbreite</label>\n          <div class=\"in\"><input id=\"inLB\" type=\"number\" inputmode=\"numeric\" value=\"120\" min=\"20\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeLB\"></span><span class=\"err\" id=\"errLB\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fAW\">\n          <label for=\"inAW\">Ausklinkung Breite</label>\n          <div class=\"in\"><input id=\"inAW\" type=\"number\" inputmode=\"numeric\" value=\"90\" min=\"10\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeAW\"></span><span class=\"err\" id=\"errAW\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fAH\">\n          <label for=\"inAH\">Ausklinkung Tiefe</label>\n          <div class=\"in\"><input id=\"inAH\" type=\"number\" inputmode=\"numeric\" value=\"60\" min=\"10\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeAH\"></span><span class=\"err\" id=\"errAH\"></span>\n        </div>\n        <div class=\"kfg_lfrow\" style=\"grid-column:1/-1\"><p class=\"kfg_sublabel\">Lage der Ausklinkung</p><div class=\"kfg_chips\" id=\"lfPosChips\"></div></div>\n        <div class=\"kfg_lfrow\" style=\"grid-column:1/-1\"><p class=\"kfg_sublabel\">Schnitt</p><div class=\"kfg_chips\" id=\"lfCutChips\"><button class=\"kfg_chip is-active\" data-ls=\"gerade\">Gerade</button><button class=\"kfg_chip\" data-ls=\"schraeg\">Schr\u00e4g</button></div></div>\n        <div class=\"kfg_field\" id=\"fLW\" style=\"display:none\">\n          <label for=\"inLW\">Winkel bei B</label>\n          <div class=\"in\"><input id=\"inLW\" type=\"number\" inputmode=\"numeric\" value=\"120\" min=\"91\" max=\"179\"><span class=\"unit\">\u00b0</span></div>\n          <span class=\"range\" id=\"rangeLW\">91 bis 179\u00b0 \u2014 bei Punkt B zwischen Plattenkante und Schr\u00e4ge \u00b7 90\u00b0 = gerade</span><span class=\"err\" id=\"errLW\"></span>\n        </div>\n        <div class=\"kfg_rule-note\" id=\"lfInnerNote\" style=\"grid-column:1/-1\">Innenecke wird automatisch verrundet: R50 bei M\u00f6belplatte \u00b7 R10 bei Multiplex &amp; Compact (Fertigungsregel).</div>\n      </div>\n      <div class=\"kfg_dims\" id=\"dimsBauch\" style=\"display:none\">\n        <div class=\"kfg_field\" id=\"fBsL\">\n          <label for=\"inBsL\">Länge</label>\n          <div class=\"in\"><input id=\"inBsL\" type=\"number\" inputmode=\"numeric\" value=\"200\" min=\"20\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeBsL\"></span><span class=\"err\" id=\"errBsL\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fBsBR\">\n          <label for=\"inBsBR\">Breite</label>\n          <div class=\"in\"><input id=\"inBsBR\" type=\"number\" inputmode=\"numeric\" value=\"90\" min=\"20\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeBsBR\"></span><span class=\"err\" id=\"errBsBR\"></span>\n        </div>\n        <div style=\"grid-column:1/-1\"><p class=\"kfg_sublabel\">Ausschnitt in der Vorderkante</p>\n          <div class=\"kfg_chips\" id=\"bsArtChips\" style=\"margin-bottom:var(--s-2xs)\"><button class=\"kfg_chip is-active\" aria-pressed=\"true\" data-ba=\"trapez\">Trapez <small>gerade Schr\u00e4gen</small></button><button class=\"kfg_chip\" aria-pressed=\"false\" data-ba=\"welle\">Welle <small>rund, ohne Ecken</small></button></div>\n          <label class=\"kfg_check\"><input type=\"checkbox\" id=\"inBsM\">\n            <span><b>Ausschnitt mittig</b><small>A und B laufen gleich — ohne Haken bestimmst du jede Länge selbst</small></span></label>\n        </div>\n        <div class=\"kfg_field\" id=\"fBsA\">\n          <label for=\"inBsA\">A — links</label>\n          <div class=\"in\"><input id=\"inBsA\" type=\"number\" inputmode=\"numeric\" value=\"55\" min=\"0\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeBsA\"></span><span class=\"err\" id=\"errBsA\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fBsB\">\n          <label for=\"inBsB\">B — rechts</label>\n          <div class=\"in\"><input id=\"inBsB\" type=\"number\" inputmode=\"numeric\" value=\"55\" min=\"0\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeBsB\"></span><span class=\"err\" id=\"errBsB\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fBsC\">\n          <label for=\"inBsC\">C — Grund</label>\n          <div class=\"in\"><input id=\"inBsC\" type=\"number\" inputmode=\"numeric\" value=\"60\" min=\"10\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeBsC\"></span><span class=\"err\" id=\"errBsC\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fBsT\">\n          <label for=\"inBsT\">Tiefe</label>\n          <div class=\"in\"><input id=\"inBsT\" type=\"number\" inputmode=\"numeric\" value=\"15\" min=\"1\"><span class=\"unit\">cm</span></div>\n          <span class=\"range\" id=\"rangeBsT\"></span><span class=\"err\" id=\"errBsT\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fBsW1\">\n          <label for=\"inBsW1\">Winkel links</label>\n          <div class=\"in\"><input id=\"inBsW1\" type=\"number\" inputmode=\"numeric\" value=\"135\" min=\"90\" max=\"179\"><span class=\"unit\">°</span></div>\n          <span class=\"range\" id=\"rangeBsW1\"></span><span class=\"err\" id=\"errBsW1\"></span>\n        </div>\n        <div class=\"kfg_field\" id=\"fBsW2\">\n          <label for=\"inBsW2\">Winkel rechts</label>\n          <div class=\"in\"><input id=\"inBsW2\" type=\"number\" inputmode=\"numeric\" value=\"135\" min=\"90\" max=\"179\"><span class=\"unit\">°</span></div>\n          <span class=\"range\" id=\"rangeBsW2\"></span><span class=\"err\" id=\"errBsW2\"></span>\n        </div>\n        <div class=\"kfg_rule-note\" id=\"bsNote\" style=\"grid-column:1/-1\"></div>\n      </div>\n      <div class=\"kfg_quick\" id=\"quickBlock\">\n        <p>Ab Lager \u2014 sofort lieferbar:</p>\n        <div class=\"kfg_quick-chips\" id=\"quickChips\"></div>\n      </div>\n      <details class=\"kfg_measure\">\n        <summary><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 16.5L16.5 3l4.5 4.5L7.5 21zM7.5 13l2 2M10.5 10l2 2M13.5 7l2 2\"/></svg> Richtig messen \u2014 so geht's</summary>\n        <p>Miss die gew\u00fcnschte Fl\u00e4che an der breitesten Stelle und rechne bei Wandmontage 5&nbsp;mm Luft ein. Bei Gestellen: Platten\u00fcberstand 5\u201315&nbsp;cm je Seite einplanen. Unsicher? Ruf uns an \u2014 wir pr\u00fcfen dein Ma\u00df kostenlos vor der Fertigung.</p>\n      </details>\n    </section>\n\n    <!-- 04 St\u00e4rke & Kante -->\n    <section class=\"kfg_step\" id=\"kfgStep4\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">04</span><span class=\"kfg_step-title\">St\u00e4rke &amp; Kante</span><span class=\"kfg_step-count\" id=\"k4\"></span></div>\n      <div class=\"kfg_chips\" id=\"thickChips\"></div>\n      <p class=\"kfg_sublabel\">Kantenprofil</p>\n      <div class=\"kfg_chips\" id=\"edgeChips\"></div>\n      <div id=\"edgeRadiusBlock\" style=\"display:none\">\n        <p class=\"kfg_sublabel\">Rundungsradius der Kante</p>\n        <div class=\"kfg_chips\" id=\"edgeRadiusChips\">\n          <button class=\"kfg_chip is-active\" data-er=\"3\">R3</button>\n          <button class=\"kfg_chip\" data-er=\"6\">R6</button>\n          <button class=\"kfg_chip\" data-er=\"9\">R9</button>\n        </div>\n      </div>\n      <div id=\"absColorBlock\" style=\"display:none\">\n        <p class=\"kfg_sublabel\">ABS-Kantenfarbe</p>\n        <div class=\"kfg_chips\" id=\"absChips\"></div>\n      </div>\n      <div id=\"lackBlock\" style=\"display:none\">\n        <label class=\"kfg_check\"><input type=\"checkbox\" data-x=\"lack\">\n          <span><b>Kante natur, aber lackiert</b><small>unsere Lackierung, seidenmatt \u2014 sch\u00fctzt die offene Schichtkante</small></span><span class=\"pr\">5 \u20ac/lfm</span></label>\n      </div>\n      <div id=\"massbandBlock\" style=\"display:none\">\n        <p class=\"kfg_sublabel\">Ma\u00dfband an der Vorderkante</p>\n        <div class=\"kfg_chips\" id=\"massbandChips\"></div>\n        <div class=\"kfg_chips\" id=\"massbandNullChips\" style=\"margin-top:var(--s-2xs);display:none\"></div>\n        <div class=\"kfg_rule-note\" id=\"massbandNote\" style=\"display:none\"></div>\n      </div>\n      <div class=\"kfg_mpx-note\" id=\"mpxNote\">Sichtbare Schichtkante: nicht gefr\u00e4st ist serienm\u00e4\u00dfig, gefr\u00e4st 45\u00b0 kostet 5 \u20ac/lfm, halbrund 8 \u20ac/lfm. Lackiert sind es 5, 10 und 16 \u20ac/lfm \u2014 wir haben genau eine Lackierung. Alternativ eine ABS-Kante in der gew\u00fcnschten Farbe.</div>\n      <div class=\"kfg_edge-note\" id=\"edgeTip\"><svg class=\"ic-svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 3l6 16 2.5-6.5L20 10z\"/></svg><span>Tipp: Klicke in der 2D-Vorschau direkt auf eine Kante, um sie einzeln zu \u00e4ndern.</span></div>\n    </section>\n\n    <!-- 05 Ausschnitte & Bohrungen -->\n    <section class=\"kfg_step\" id=\"kfgStep5\">\n      <div class=\"kfg_step-head\"><span class=\"kfg_step-num\">05</span><span class=\"kfg_step-title\">Ausschnitte &amp; Bohrungen</span><span class=\"kfg_step-count\" id=\"k5\"></span></div>\n      <p class=\"kfg_grouplabel\">Bohrungen &amp; Durchl\u00e4sse</p>\n      <label class=\"kfg_check\"><input type=\"checkbox\" data-x=\"bohr\">\n        <span><b>Montagebohrungen 4\u00d7 \u00d88</b><small>vorgebohrt f\u00fcr g\u00e4ngige Gestelle</small></span><span class=\"pr\">+ 9,90&nbsp;\u20ac</span></label>\n      <div id=\"grpMaschine\" style=\"display:none\">\n        <p class=\"kfg_grouplabel\">Ausschnitt f\u00fcr die Maschine</p>\n        <div class=\"kfg_rule-note\">W\u00e4hle ein Standardma\u00df oder lass uns nach deiner Maschine messen \u2014 Hersteller und Modell brauchen wir in jedem Fall. Wo der Ausschnitt sitzt, legst du selbst fest: in der Vorschau verschieben, die Abst\u00e4nde zu allen vier Kanten stehen daneben.</div>\n        <p class=\"kfg_sublabel\">Ma\u00df des Ausschnitts</p>\n        <div class=\"kfg_chips\" id=\"maschineMassChips\"><button class=\"kfg_chip is-active\" data-mm=\"52x18.1\">52 \u00d7 18,1 cm</button><button class=\"kfg_chip\" data-mm=\"48x18.1\">48 \u00d7 18,1 cm</button><button class=\"kfg_chip\" data-mm=\"61.7x18.1\">61,7 \u00d7 18,1 cm</button><button class=\"kfg_chip\" data-mm=\"auto\">Nach Maschine <small>wir messen</small></button></div>\n        <label class=\"kfg_machine\">N\u00e4hmaschine \u2014 Hersteller und Modell\n          <input type=\"text\" id=\"machineInput\" placeholder=\"z. B. Bernina 770 QE oder Juki TL-2200\">\n        </label>\n        <div class=\"kfg_chips\"><button class=\"kfg_chip\" id=\"btnMaschine\">Maschinen-Ausschnitt hinzuf\u00fcgen</button> <span class=\"pr\" style=\"align-self:center;font-size:13px\">+ 40,00 \u20ac pauschal</span></div>\n      </div>\n      <div id=\"grpDurchlass\">\n      <div class=\"kfg_preset\" data-preset=\"kabel\">\n        <span><b>Kabeldurchlass \u00d860</b><small>inkl. Abdeckung, frei positionierbar</small></span>\n        <span class=\"pr\">+ 9,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <div class=\"kfg_preset\" data-preset=\"kabel80\">\n        <span><b>Kabeldurchlass \u00d880</b><small>inkl. Abdeckung, frei positionierbar</small></span>\n        <span class=\"pr\">+ 9,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <div class=\"kfg_preset\" data-preset=\"armatur\">\n        <span><b>Armaturenbohrung \u00d835</b><small>f\u00fcr Armatur oder Kabeldose</small></span>\n        <span class=\"pr\">+ 9,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      </div>\n      <div id=\"grpKueche\">\n      <p class=\"kfg_grouplabel\">K\u00fcchen-Ausschnitte</p>\n      <div class=\"kfg_preset\" data-preset=\"usb\">\n        <span><b>Steckdosen-Ausschnitt</b><small>26,5 \u00d7 10 cm, f\u00fcr USB oder Steckdose</small></span>\n        <span class=\"pr\">+ 14,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <div class=\"kfg_preset\" data-preset=\"spuele\">\n        <span><b>Sp\u00fclen-Ausschnitt</b><small>78 \u00d7 43 cm, K\u00fcchen-Arbeitsplatte</small></span>\n        <span class=\"pr\">+ 39,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      <div class=\"kfg_preset\" data-preset=\"induktion\">\n        <span><b>Induktionsfeld-Ausschnitt</b><small>56 \u00d7 49 cm, K\u00fcchen-Arbeitsplatte</small></span>\n        <span class=\"pr\">+ 39,90&nbsp;\u20ac / St\u00fcck</span>\n        <span class=\"kfg_stepper\"><button data-dec aria-label=\"Weniger\">\u2212</button><span data-count>0</span><button data-inc aria-label=\"Mehr\">+</button></span>\n      </div>\n      </div>\n      <div id=\"grpCustom\">\n      <p class=\"kfg_grouplabel\">Individuelle Bearbeitung</p>\n      <label class=\"kfg_check\"><input type=\"checkbox\" data-x=\"custom\">\n        <span><b>Eigenes Bohrbild</b><small>frei nach deiner Vorgabe, CNC-gefr\u00e4st</small></span><span class=\"pr\">Angebot</span></label>\n      <div class=\"kfg_custom\" id=\"customBlock\">\n        <textarea id=\"customText\" placeholder=\"Beschreibe kurz, was du brauchst \u2014 z. B. \u201eEck-Ausklinkung 20\u00d715 cm hinten links\u201c.\"></textarea>\n        <div class=\"kfg_upload\" id=\"uploadZone\" role=\"button\" tabindex=\"0\">\n          <b>Skizze oder Zeichnung hochladen</b>\n          PDF, Foto, DXF \u2014 oder einfach sp\u00e4ter per E-Mail an uns schicken\n          <input type=\"file\" id=\"uploadInput\" hidden>\n        </div>\n        <p class=\"kfg_custom-hint\">Mit eigener Skizze wird deine Platte individuell gefertigt \u2014 verbindliches Angebot in 24&nbsp;h.</p>\n      </div>\n      </div>\n      <div id=\"grpFrei\">\n      <p class=\"kfg_grouplabel\">Frei gestalten</p>\n      <p class=\"kfg_sublabel\">In der Vorschau aufziehen oder hinzuf\u00fcgen \u2014 danach jede Position auf den Millimeter genau einstellbar. Der Preis wird sofort berechnet.</p>\n      <div class=\"kfg_chips\" id=\"freiTools\">\n        <button class=\"kfg_chip\" id=\"drawRect\" data-draw=\"r\">\u25ad Ausschnitt</button>\n        <button class=\"kfg_chip\" id=\"drawCircle\" data-draw=\"c\">\u25ef Runder Ausschnitt</button>\n        <button class=\"kfg_chip\" id=\"drawPoly\" data-draw=\"p\">\u2b20 Freie Kontur</button>\n        <button class=\"kfg_chip\" id=\"addKanal\">\u2933 Kabelkanal fr\u00e4sen</button>\n      </div>\n      <p class=\"kfg_custom-hint\" id=\"drawHint\" style=\"display:none\">Zeichnen-Modus: In der Vorschau aufziehen.</p>\n      </div>\n      <div class=\"kfg_cutlist\" id=\"cutList\"></div>\n    </section>\n\n  </div>\n</div>\n\n<div class=\"kfg_bar\">\n  <span class=\"kfg_bar-thumb\" id=\"barThumb\" aria-hidden=\"true\"></span>\n  <div class=\"kfg_bar-what\"><b id=\"barTitle\">\u2014</b><small id=\"barSpec\">\u2014</small></div>\n  <div class=\"p\"><span class=\"val\" id=\"priceBar\">\u2014</span><small id=\"delivBar\">\u2014</small></div>\n  <button class=\"kfg_cta\" id=\"ctaBar\">In den Warenkorb</button>\n</div>\n\n\n<div class=\"toast\" id=\"toast\" role=\"status\" aria-live=\"polite\"></div>\n\n<div class=\"kfg_modal\" id=\"orderModal\" hidden>\n  <div class=\"kfg_modal-box\">\n    <div class=\"kfg_modal-head\"><b>So kommt deine Bestellung bei uns an</b>\n      <span class=\"kfg_modal-tag\">Demo \u00b7 interne Ansicht</span>\n      <button id=\"omClose\" aria-label=\"Schlie\u00dfen\">\u00d7</button></div>\n    <div class=\"kfg_modal-grid\">\n      <div class=\"kfg_modal-draw\">\n        <svg id=\"omSvg\" viewBox=\"0 0 600 444\"></svg>\n        <p>Fertigungszeichnung \u2014 automatisch aus der Konfiguration erzeugt (inkl. Ausschnitt-Abst\u00e4nde)</p>\n      </div>\n      <div class=\"kfg_modal-data\" id=\"omData\"></div>\n    </div>\n  </div>\n</div>";

/* ═══════════════════════ APP ═══════════════════════ */
function KFG_APP(shopData, kurvenData){

/* ═══════ Produktmatrix (Shopify-Lagerartikel: [EUR, VariantId, SKU, PLN]) ═══════ */
let SHOP = {};
let KURVEN = {};                                    /* Sondermass-Kurven, s. Preisbasis */

/* ═══════ Bilder (injiziert) ═══════ */
const ASSET=(window.__KFG_BASE||'')+'/assets/kfg/';
const TEX = Object.fromEntries(["weiss", "schwarz", "kaszmir", "sosna-bielona", "ahorn", "buk", "sonoma-eiche", "eiche-artison", "sperrholz-natur", "marmor-weiss", "marmor-schwarz", "czarny", "hikora", "alaska-weiss", "szary", "eiche-kamienny", "sz-gewebe"].map(k=>[k,ASSET+'top/'+k+'.webp']));
/* 128-px-Thumbs fuer das Dekor-Raster — die Vollformate (TEX) laedt nur noch die
   Buehne fuer das GEWAEHLTE Dekor. Vorher zogen 11 Draufsichten ~440 KB als
   60-px-Kacheln (Audit 29.07., Fix 3). */
const TEX_THUMB = Object.fromEntries(Object.entries(TEX).map(([k,u])=>[k,u.replace('/top/','/thumb/')]));
const ATELIER_ATLASES=Object.fromEntries(Object.entries({"hikora":{"src":"./assets/kfg/atlas/hikora.webp","widthCm":300,"heightCm":200,"generated":true,"status":"prototype-ki-erweiterung-kein-herstellerscan","reference":"assets/kfg/top/hikora.webp"},"ahorn":{"src":"./assets/kfg/atlas/ahorn.webp","widthCm":300,"heightCm":200,"generated":true,"status":"prototype-ki-erweiterung-kein-herstellerscan","reference":"assets/kfg/top/ahorn.webp"},"buk":{"src":"./assets/kfg/atlas/buk.webp","widthCm":300,"heightCm":200,"generated":true,"status":"prototype-ki-erweiterung-kein-herstellerscan","reference":"assets/kfg/top/buk.webp"},"sonoma-eiche":{"src":"./assets/kfg/atlas/sonoma-eiche.webp","widthCm":300,"heightCm":200,"generated":true,"status":"prototype-ki-erweiterung-kein-herstellerscan","reference":"assets/kfg/top/sonoma-eiche.webp"},"eiche-artison":{"src":"./assets/kfg/atlas/eiche-artison.webp","widthCm":300,"heightCm":200,"generated":true,"status":"prototype-ki-erweiterung-kein-herstellerscan","reference":"assets/kfg/top/eiche-artison.webp"},"sosna-bielona":{"src":"./assets/kfg/atlas/sosna-bielona.webp","widthCm":300,"heightCm":200,"generated":true,"status":"prototype-ki-erweiterung-kein-herstellerscan","reference":"assets/kfg/top/sosna-bielona.webp"},"sperrholz-natur":{"src":"./assets/kfg/atlas/sperrholz-natur.webp","widthCm":300,"heightCm":200,"generated":true,"status":"prototype-ki-erweiterung-kein-herstellerscan","reference":"assets/kfg/top/sperrholz-natur.webp"}}).map(([k,v])=>[k,Object.assign({},v,{src:ASSET+v.src.replace(/^\.\/assets\/kfg\//,'')})]));

/* Vollbild-Cache: Die Buehne zeigt beim Dekorwechsel SOFORT das (gecachte)
   128-px-Thumb und tauscht auf das Vollbild, sobald es dekodiert ist. Vorher
   lud der erste Wechsel auf ein neues Dekor 40-120 KB nach - auf Mobilfunk
   0,5-2 s scheinbarer Stillstand (Befund Sascha 29.07. abends). */
var _texOk = Object.create(null), _texCb = Object.create(null);
function ensureTex(k, cb){
  if(!TEX[k]){ cb && cb(); return; }
  if(_texOk[k]){ cb && cb(); return; }
  if(_texCb[k]){ cb && _texCb[k].push(cb); return; }
  _texCb[k] = cb ? [cb] : [];
  var im = new Image(); im.decoding = 'async';
  var fertig = function(){
    if(_texOk[k]) return; _texOk[k] = 1;
    var l = _texCb[k] || []; delete _texCb[k];
    l.forEach(function(f){ try{ f(); }catch(_){} });
  };
  im.onload = fertig; im.onerror = fertig; im.src = TEX[k];
}
function stageTex(k){ return ATELIER_ATLASES[k]?.src || (_texOk[k] ? TEX[k] : (TEX_THUMB[k] || TEX[k])); }
/* Reale Kantenlaenge eines Dekorfotos in cm. Die Archivaufnahmen zeigen einen
   Ausschnitt von rund 40 cm (Dielenbreiten, Astgroessen) — bis v1.17.9 wurde EIN Foto
   ueber die ganze Platte gezogen, die Maserung war auf 120 cm dreimal zu gross
   (Sascha 08.09.). Jetzt wird das Foto im Massstab gekachelt, gespiegelt an den
   Stoessen, mit 8 % Randbeschnitt (Plattenkanten auf einigen Fotos). */
/* null = nicht kacheln: Marmor hat grossflaechige Adern, gespiegelt entstuende ein
   Kaleidoskop — dort bleibt das Foto wie bisher ueber die ganze Platte gelegt. */
const TEX_CM = { 'marmor-weiss': null, 'marmor-schwarz': null, 'sperrholz-natur': 50 };
const TEX_RAND = 0.08;
function texCm(){ if(ATELIER_ATLASES[texKey()]) return null; const v=TEX_CM[texKey()]; return v===undefined ? 40 : v; }
/* SVG-Muster: 2x2 Kacheln, jede zweite horizontal bzw. vertikal gespiegelt, damit an
   den Stoessen keine harten Kanten entstehen. Ursprung = Plattenecke (x,y), T = Kachel in px. */
function texPattern(x,y,T,href,pw,ph){
  const atlas=ATELIER_ATLASES[texKey()];
  if(atlas){
    const d=dims(), sc=pw/d.w, tw=atlas.widthCm*sc, th=atlas.heightCm*sc;
    const ox=x-(tw-pw)/2, oy=y-(th-ph)/2;
    return '<pattern id="texPat" patternUnits="userSpaceOnUse" x="'+ox+'" y="'+oy+'" width="'+tw+'" height="'+th+'"><image href="'+atlas.src+'" width="'+tw+'" height="'+th+'" preserveAspectRatio="xMidYMid slice"/></pattern>';
  }
  if(!T){   /* ein Foto ueber die ganze Platte, 8 % Ueberstand wie bis v1.17.9 */
    return `<pattern id="texPat" patternUnits="userSpaceOnUse" x="${x}" y="${y}" width="${pw}" height="${ph}">`
      +`<image href="${href}" x="${-pw*TEX_RAND}" y="${-ph*TEX_RAND}" width="${pw*(1+2*TEX_RAND)}" height="${ph*(1+2*TEX_RAND)}" preserveAspectRatio="xMidYMid slice"/></pattern>`;
  }
  const ins=TEX_RAND*100, sz=100+2*ins;
  /* +0.6 px Ueberlappung: sonst bleibt zwischen den Kacheln eine Haarlinie (Subpixel) */
  const kachel=(tx,ty,fx,fy)=>`<svg x="${tx}" y="${ty}" width="${T+0.6}" height="${T+0.6}" viewBox="0 0 100 100" preserveAspectRatio="none">`
    +`<image href="${href}" x="${-ins}" y="${-ins}" width="${sz}" height="${sz}" preserveAspectRatio="none"${(fx||fy)?` transform="matrix(${fx?-1:1} 0 0 ${fy?-1:1} ${fx?100:0} ${fy?100:0})"`:''}/></svg>`;
  return `<pattern id="texPat" patternUnits="userSpaceOnUse" x="${x}" y="${y}" width="${2*T}" height="${2*T}">`
    +kachel(0,0,0,0)+kachel(T,0,1,0)+kachel(0,T,0,1)+kachel(T,T,1,1)+`</pattern>`;
}
function refreshStage(){
  var st = document.getElementById('stage'); if(!st) return;
  var u = stageTex(texKey());
  st.querySelectorAll('image').forEach(function(n){
    if(n.getAttribute('href') !== u) n.setAttribute('href', u);
  });
}
/* Alle Draufsichten nach dem Start leise vorladen - danach ist jeder
   Farbwechsel wieder sofort scharf, ohne den 440-KB-Burst beim Laden. */
function texVorladen(){
  try{ if(navigator.connection && navigator.connection.saveData) return; }catch(_){}
  var keys = Object.keys(TEX).filter(function(k){ return !_texOk[k] && !_texCb[k]; });
  (function next(){
    var k = keys.shift(); if(!k) return;
    ensureTex(k, function(){ setTimeout(next, 250); });
  })();
}
const KANTE = Object.fromEntries(["szwal_21", "schwarz_18", "schwarz_28", "schwarz_40", "szary_18", "kaszmir_18", "kaszmir_28", "kaszmir_36", "sosna-bielona_18", "sosna-bielona_28", "sosna-bielona_36", "ahorn_18", "ahorn_28", "ahorn_36", "buk_18", "buk_20", "buk_28", "buk_40", "sonoma-eiche_18", "sonoma-eiche_28", "sonoma-eiche_36", "eiche-artison_18", "eiche-artison_28", "eiche-artison_36", "weiss_36", "hikora_18", "hikora_36", "mpx_21", "mpx_40", "compact_12", "compact_weiss", "compact_szary", "compact_marmor-weiss", "compact_marmor-schwarz", "compact_czarny", "alaska-weiss_36", "eiche-kamienny_18", "eiche-kamienny_36", "szary_28"].map(k=>[k,ASSET+'kante/'+k+'.webp']));

/* ═══════ Preisbasis (Preiswerk 29.08.2026, eingebaut 02.09.2026) ═══════
   Bis v1.16.2 galt ein flacher zl/m2-Satz je Material und Staerke (RATE) —
   eine 50x50 zahlte denselben m2-Preis wie eine 200x100. Jetzt:
     ① Lagergroesse  -> exakt der Shop-Preis (SHOP, aus kfg-produktmatrix.json)
     ② Sondermass    -> Kurve durch die Katalogpunkte, je Material, Staerke,
                        Form und Dekorstufe (KURVEN, aus kfg-preiskurven.json),
                        linear zwischen den Stuetzstellen, ausserhalb mit der
                        Randsteigung, nach unten begrenzt, auf ,90 aufgerundet
     ③ Deckel        -> ein Sondermass kostet nie mehr als die kleinste
                        Lagerplatte, aus der es sich schneiden liesse
   Nur die 18er Moebelplatte spreizt nach Dekor (premium / basis); alle anderen
   Gruppen haben je Staerke und Form genau eine Kurve. Doku:
   PREISBASIS-Konfigurator-aus-Preiswerk-02-09-2026.md */
/* Preiskanal: die polnische Seite rechnet in zl — Grundpreise aus eigener Preisliste
   (Katalog + Kurven), Aufschlaege (Kanten, Ecken, Bearbeitungen, Massband, Maschine)
   aus den EUR-Werten mit festem Kurs, aufgerundet auf ,90 (Sascha 08.09.: "1 passt").
   Bis v1.17.9 standen die EUR-Zahlen unveraendert auf dem zl-Preis. */
function kanal(){ return KFG_LANG==='pl' ? 'pln' : 'eur'; }
const PLN_KURS = 4.24;                    /* Median der EU-Preisliste, PREISBASIS 13.08. */
function zl(v){ return kanal()==='pln' ? (v>0 ? auf90(v*PLN_KURS) : 0) : v; }
/* Dekore, die es im Katalog (noch) nicht gibt, laufen in der naechstliegenden
   Stufe der 18er: Unifarben wie Grau/Schwarz, Holzdekore wie Buche/Ahorn. */
const DEKOR_STUFE_ERSATZ = { weiss:'basis', 'alaska-weiss':'basis', kaszmir:'basis', 'eiche-artison':'premium' };
/* 36 mm gibt es im Katalog nicht — Verhaeltnis zur 25er aus der alten
   Preismatrix (566 / 386 zl je m2). */
const STAERKE_FAKTOR = { 'dekor|36': 1.466 };
/* Alle Preise enden auf ,90 — aufgerundet, nie abgerundet. */
function auf90(v){ return Math.ceil(v - 0.90 - 1e-9) + 0.90; }
function kurvenDekor(){ return S.mat==='mpx' ? 'sperrholz-natur' : S.dekor; }
/* Welche Kurve gilt? Erst die Dekorstufen (premium/basis), dann standard. */
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
/* Flaeche, mit der die Kurve gerechnet wird: bei "rund ueber Rechteck" das Quadrat D x D */
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
/* Deckel: kleinste Lagerplatte derselben Gruppe, in die das Mass passt. */
function deckel(){
  if(S.form!=='rect'&&S.form!=='round') return null;
  /* HPL auf Multiplex hat keinen Lagerartikel: der Deckel der ROHEN Platte kappte den
     Laminatzuschlag weg (119x60 HPL = 69,90 wie natur). Review 08.09., A3. */
  if(S.mat==='mpx'&&S.mpxSurface!=='natur') return null;
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
/* Sondermass-Grundpreis oder null, wenn keine Kurve vorliegt (dann Anfrage). */
/* HPL auf Multiplex und die Naehtischplatte (Sklejka + Laminat) haben keinen
   Katalog. Sie laufen ueber die Multiplex-Kurve plus Laminatzuschlag je m2 —
   der Abstand entspricht der alten Preismatrix (600/700 gegen 446/515 zl). */
const HPL_ZUSCHLAG = { eur: {std:36, hikora:47}, pln: {std:155, hikora:200} };
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
/* Fertigungsregeln (Senior): Radien + Maximalmaße */
const RULES = {
  dekor:   {maxL:270, maxB:200, maxD:160, minCorner:30, cornerNote:'Möbelplatte (ABS-Kante): Außenradien mind. R30. Kleinere Radien sind fertigungstechnisch nicht möglich.'},
  compact: {maxL:238, maxB:120, maxD:130, minCorner:0, cornerNote:''},   /* Katalog: rund bis 130 */
  mpx:     {maxL:238, maxB:120, maxD:120, minCorner:0, cornerNote:''},
  /* Naehtischplatten kommen aus der 240x120-Rohplatte (Senior 30.07.). */
  szwal:   {maxL:240, maxB:120, maxD:120, minCorner:0, cornerNote:''}
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
/* Naehtischplatten-Farben (Senior 30.07.). Eigene Draufsichten gibt es noch
   nicht — bis dahin leihen wir die farblich naechstliegende aus dem Archiv. */
const DEKOR_SZWAL = [['sz-weiss','Weiß'],['sz-gewebe','Gewebestruktur Weiß'],
                     ['sz-grau','Grau'],['sz-schwarz','Schwarz']];
/* 'sz-gewebe' hat seit v1.16.2 eine eigene Aufnahme (Fotos Sascha 30.07.),
   die drei uebrigen leihen sich weiter die farblich naechstliegende. */
const SZWAL_TEX = {'sz-weiss':'weiss','sz-grau':'szary','sz-schwarz':'schwarz'};
Object.keys(SZWAL_TEX).forEach(function(k){
  TEX[k]=TEX[SZWAL_TEX[k]]; TEX_THUMB[k]=TEX_THUMB[SZWAL_TEX[k]];
});
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
const FLAT = {'weiss':'#f0eee9','alaska-weiss':'#efefef','schwarz':'#232120','szary':'#b7b6b2','kaszmir':'#d9d2c4','sosna-bielona':'#ece5d6',
  'ahorn':'#e9d1a8','buk':'#d9af7e','sonoma-eiche':'#c2a172','eiche-artison':'#a8815a','hikora':'#8f704a',
  'sperrholz-natur':'#e7d9ba','marmor-weiss':'#ebe9e4','marmor-schwarz':'#2b2926','czarny':'#232120',
  'sz-weiss':'#f0eee9','sz-gewebe':'#eae7e0','sz-grau':'#b7b6b2','sz-schwarz':'#232120'};
const ABS_COL = {dekor:null, weiss:'#f0eee9', popiel:'#b7b6b2', dunkelgrau:'#6f6e6b', schwarz:'#232120',
  gruen:'#3d6b46', rot:'#8f2f2c', gelb:'#c9a227', blau:'#2f4f7a'};
/* Kantenprofile je Material (Preise final seit 26.07.) */
/* Kantenprofile — Preise + Verfügbarkeit final (Produktion 26.07.2026) */
/* ┌ PREISE MULTIPLEX / NAEHTISCHPLATTE — geklaert mit dem Senior 30.07.2026 ─┐
   │ UNLACKIERT bleibt wie bisher: nicht gefraest 0, gefraest 45° 5,          │
   │ halbrund 8 — je laufendem Meter Kante.                                   │
   │ LACKIERT ist es rund das Doppelte: 5 / 10 / 16 €/lfm. Das ist KEIN        │
   │ Aufschlag, sondern ersetzt den Grundpreis (LACK_LFM unten). Damit hat     │
   │ die Lackierung erstmals einen festen Preis und faellt aus dem            │
   │ Angebots-Flow heraus.                                                    │
   └──────────────────────────────────────────────────────────────────────────┘ */
const EDGE_MPX = [['nicht','Nicht gefräst',0,'serienmäßig','#1E1E1E'],
                  ['f45','Gefräst 45°',5,'+ 5 €/lfm','#8a6844'],
                  ['halbrund','Halbrund',8,'+ 8 €/lfm','#4a7a9b'],
                  ['abs','ABS-Kante 2 mm',0,'inklusive','#2f6b4f']];
/* Preis je lfm, wenn die offene Schichtkante lackiert wird. */
const LACK_LFM = { nicht:5, f45:10, halbrund:16 };
const EDGEPROFILES = {
  dekor:   [['abs','ABS-Kante 2 mm · R2',0,'inklusive','#1E1E1E']],
  mpx:     EDGE_MPX,
  szwal:   EDGE_MPX,
  compact: [['roh','Geschliffen',0,'serienmäßig','#1E1E1E'],['fase','Gefast 45°',7,'+ 7 €/lfm','#8a6844'],['halbrund','Halbrund',8,'+ 8 €/lfm','#4a7a9b']]
};
/* Alt-Links: 'fase' hiess auf Multiplex die serienmaessige Kante. */
const EDGE_ALIAS = { mpx:{fase:'nicht'}, szwal:{fase:'nicht'} };
function normEdges(){
  const ids=EDGEPROFILES[S.mat].map(p=>p[0]), al=EDGE_ALIAS[S.mat]||{};
  S.edges=S.edges.map(e=>{ e=hasOwn(al,e)?al[e]:e; return ids.indexOf(e)>=0?e:ids[0]; });
}
/* Massband nur auf Naehtischplatten (Senior 30.07.) */
const MASSBAND = [['none','Kein Maßband','',0],
                  ['laser','Maßband gelasert','+ 15 €',15],
                  ['sticker','Aufkleberkante','+ 10 €',10]];
function massbandEintrag(){ return MASSBAND.find(m=>m[0]===S.massband)||MASSBAND[0]; }
function massbandPreis(){ return S.mat==='szwal' ? zl(massbandEintrag()[3]) : 0; }
function massbandName(){ return massbandEintrag()[1]; }
/* Eckenpreis seit 26.08.2026 als Staffel nach Anzahl (RADIEN_STAFFEL), nicht
   mehr je Ecke — CORNER_PRICE / cornerPriceFor sind damit Geschichte. */
/* Ecken einzeln waehlbar (Wunsch Produktion, 27.07.): der Radius gilt nur fuer die
   angehakten Ecken. Reihenfolge im Uhrzeigersinn ab oben links = hinten links,
   hinten rechts, vorne rechts, vorne links. */
const CORNER_NAMES = ['hinten links','hinten rechts','vorne rechts','vorne links'];
/* Radius JE ECKE in mm (0 = eckig). Preisstufen wie in der Preisliste:
   bis R50 = 4,90 € je Ecke, darueber = 7,90 € je Ecke. */
function cornerLabel(){
  const idx=cornerIdx(), on=idx.filter(i=>cornerR(i)>0);
  if(!on.length) return 'eckig';
  const uniq=[...new Set(on.map(cornerR))];
  if(uniq.length===1) return `R${uniq[0]} · ${on.length===idx.length?(idx.length===6?'alle sechs':idx.length===5?'alle fünf':'alle vier'):on.map(cornerName).join(', ')}`;
  return on.map(i=>`${cornerName(i)} R${cornerR(i)}`).join(' · ');
}
/* Indizes der Aussenecken: vier beim Rechteck, fuenf bei der L-Form */
function cornerIdx(){ return S.form==='lform' ? [0,1,2,3,4] : S.form==='bauch' ? bsOrd() : [0,1,2,3]; }
function cornerName(i){ return S.form==='lform' ? lfCornerName(i) : S.form==='bauch' ? BS_CORNER_NAMES[i] : CORNER_NAMES[i]; }
function setCorner(i,r){
  if(S.form==='lform'){ if(!Array.isArray(S.lfR)||S.lfR.length!==5) S.lfR=[0,0,0,0,0]; S.lfR[i]=clampCorner(r); }
  else if(S.form==='bauch'){ if(!Array.isArray(S.bsR)||S.bsR.length!==6) S.bsR=[0,0,0,0,0,0]; S.bsR[i]=clampCorner(r); }
  else S.cornerR[i]=clampCorner(r);
  S.corner=cornerMax();
}
function cornerPriceFor(r){ return r<=0?0:radienpreis(1); }   /* nur noch fuer Alt-Aufrufer */
/* Rechteck, Naehtischplatte UND L-Form: Radius je Ecke einzeln (Senior 02.09.:
   "nicht immer muessen alle Ecken gerundet sein"). Die Innenecke des geraden L
   bekommt automatisch R50 bzw. R10 nach Fertigungsregel. Rund: entfaellt. */
function cornerFormOk(){ return S.form==='rect'||S.form==='lform'||S.form==='bauch'; }
function cornerPerCorner(){ return cornerFormOk(); }
function cornerR(i){
  if(!cornerFormOk()) return 0;
  if(S.form==='lform') return lfCornerR(i);
  if(S.form==='bauch') return bsCornerR(i);
  return Math.max(0, +S.cornerR[i]||0);
}
function cornerOuterCount(){ return S.form==='lform' ? 5 : S.form==='bauch' ? bsOrd().length : 4; }
function cornerCount(){ return cornerIdx().filter(i=>cornerR(i)>0).length; }
function cornerOn(i){ return cornerR(i)>0; }
/* Radien aus der Fertigungsregel an A und B der Schraege (Senior 03.09.: „genau
   der gleiche Preis wie die anderen Ecken") zaehlen in der Staffel mit — nur die,
   die der Kunde nicht schon selbst als Aussenecke gerundet hat. Die Innenecke des
   geraden L bleibt wie bisher ohne Aufpreis. */
function lfAutoEcken(){
  if(S.form!=='lform'||!lfSchraeg()) return 0;
  const g=lfPts(); let n=0;
  g.pts.forEach((_,i)=>{ const o=g.ord[i]; if(g.rad[i]>0 && (o<0 || lfCornerR(o)<=0) && lfIstDiagonalEcke(g,i)) n++; });
  return n;
}
function lfIstDiagonalEcke(g,i){
  /* Endpunkte der Schraege: das Segment davor oder danach ist weder waagerecht noch senkrecht */
  const n=g.pts.length, a=g.pts[(i-1+n)%n], b=g.pts[i], c=g.pts[(i+1)%n];
  const schief=(p,q)=>Math.abs(p[0]-q[0])>1e-6 && Math.abs(p[1]-q[1])>1e-6;
  return schief(a,b)||schief(b,c);
}
function cornerSum(){ return radienpreis(cornerCount()+lfAutoEcken()+bsAutoEcken()); }
function cornerMax(){ return Math.max(0,...cornerIdx().map(cornerR)); }
/* Auf Fertigungsregeln und halbe Plattenmasse begrenzen */
function clampCorner(r){
  const d=dims(), lim=Math.min(d.w,d.h)*10/2, mn=rules().minCorner;
  r=Math.max(0,Math.min(300,Math.round(r||0)));
  if(r>0&&mn>0&&r<mn) r=mn;
  return Math.min(r,Math.floor(lim));
}
/* Groesster Radius (mm) an Ecke i: halbe Laenge der kuerzeren angrenzenden Kante —
   beim Rechteck die halbe Plattenseite, bei der L-Form die echten Schenkel aus lfPts.
   Wird in validate() bei jedem Render angewandt: vorher klemmte nur das Setzen, nach
   einer Massaenderung blieb "R300" an einem 30-cm-Schenkel stehen (Review 08.09., A9). */
function cornerLimit(i){
  if(S.form==='lform'||S.form==='bauch'){
    const g=formPts(), k=g.ord.indexOf(i); if(k<0) return 0;
    const n=g.pts.length, p=g.pts[k], a=g.pts[(k-1+n)%n], b=g.pts[(k+1)%n];
    return Math.floor(Math.min(Math.hypot(a[0]-p[0],a[1]-p[1]), Math.hypot(b[0]-p[0],b[1]-p[1]))*10/2);
  }
  const d=dims(); return Math.floor(Math.min(d.w,d.h)*10/2);
}
function radienBegrenzen(){
  let geklemmt=false;
  cornerIdx().forEach(i=>{ const r=cornerR(i); if(r<=0) return;
    const lim=Math.min(300, cornerLimit(i));
    if(r>lim){ const mn=rules().minCorner; setCorner(i, lim>=mn?lim:0); geklemmt=true; } });
  if(geklemmt) S.corner=cornerMax();
  return geklemmt;
}
function setAllCorners(r){
  const v=clampCorner(r);
  if(S.form==='lform') S.lfR=[0,1,2,3,4].map(()=>v);
  else if(S.form==='bauch'){ if(!Array.isArray(S.bsR)||S.bsR.length!==6) S.bsR=[0,0,0,0,0,0];
    bsOrd().forEach(i=>{ S.bsR[i]=v; }); }
  else S.cornerR=[0,1,2,3].map(()=>v);
  S.corner=cornerMax();
}
function cornerFieldsVisible(){ return cornerPerCorner(); }
/* Radius je Ecke in Pixeln des Aufrufers */
function cornerRadii(scale, maxA, maxB){
  const cap=Math.min(maxA,maxB);
  return [0,1,2,3].map(i => Math.min(cornerR(i)/10*scale, cap));
}
/* ═══════ L-Form: Lage der Ausklinkung, gerader oder schraeger Schnitt ═══════
   Senior 02.09.: Lage waehlbar (bei Naehtischen sitzt sie meist vorn, wo die
   Naeherin sitzt), der kurze Schenkel darf schraeg angesetzt werden, jede
   Aussenecke einzeln rundbar. Winkel ohne Grenze ("was der Kunde braucht"). */
/* Lage der Ausklinkung. Senior/Sascha 03.09.: Vorgabe „vorne rechts", daneben
   „vorne links". Eine Ausklinkung hinten ist dieselbe Platte um 180° gedreht
   (hinten rechts = vorne links, hinten links = vorne rechts): alle Kanten der
   L-Form tragen dasselbe Profil, das Dekor hat keine Laufrichtung. Nur die
   Naehtischplatte hat ein festes „vorn" (Massband, Maschinenausschnitt) —
   dort bleiben alle vier Lagen waehlbar. Alte Links mit lp=hr/hl rendern
   weiter, die Lage erscheint dann als zusaetzlicher Chip. */
const LF_POS = [['vr','vorne rechts'],['vl','vorne links'],['hr','hinten rechts'],['hl','hinten links']];
function lfPosListe(){ const cur=lfPos(); return LF_POS.filter(([k])=>S.mat==='szwal'||k==='vr'||k==='vl'||k===cur); }
function lfPos(){ return S.lf.pos || 'vr'; }
function lfSchraeg(){ return S.lf.schnitt==='schraeg'; }
/* Schraeger Schnitt (Senior 08.09., ersetzt die Fassungen vom 03. und 07.09.):
   B = Ecke der Ausklinkung AN DER PLATTENKANTE, D = die Plattenecke neben B auf
   derselben Kante. A = Punkt auf der INNEREN Kante der Ausklinkung (Tiefe ah),
   C = das Ende dieser Kante an der Aussenkante. Die Schraege laeuft von B nach
   A; A–C bleibt immer gerade (parallel zur Plattenkante), die Ausklinkung
   behaelt an der Kante ihre Breite aw. Der Winkel wird BEI B gemessen, auf der
   Platte, zwischen Plattenkante (Richtung D) und Schraege: 90 Grad = gerader
   Schnitt, groesser = die Schraege lehnt sich in die Ausklinkung. A rueckt dabei
   um u = ah * tan(winkel - 90) von der Ausklinkungskante nach innen — hoechstens
   bis aw - 10 cm, damit A–C ein gerades Stueck von 10 cm bleibt (Platz fuer die
   Verrundung R50 an A und den Kundenradius an C). */
/* Fertigungsradius der Ausklinkung (Senior 03.09.): alles, was mit PVC/ABS
   geklebt ist, braucht an der Innenecke und bei der Schraege an A und B
   mindestens R50; Platten ohne PVC (Multiplex roh/gefraest) und Compact R10.
   Die L-Form traegt eine Kante umlaufend, darum genuegt edges[0]. In cm. */
function lfMinR(){ return S.edges[0]==='abs' ? 5 : 1; }
const LF_WINKEL = 120;   /* Vorgabe fuer den Winkel bei B, wenn "schraeg" gewaehlt wird */
const LF_MIN_AC = 10;    /* cm, die von A–C mindestens gerade bleiben */
/* Ausklinkung auf gueltige Masse geklemmt (cm) */
function lfMasse(){ const L=+S.lf.L, B=+S.lf.B; return {L, B, aw:Math.max(1,Math.min(+S.lf.aw, L-1)), ah:Math.max(1,Math.min(+S.lf.ah, B-1))}; }
function lfWinkelMax(){ const m=lfMasse(); if(!(m.aw>LF_MIN_AC)||!(m.ah>0)) return 91; return Math.max(91, Math.floor(90+Math.atan((m.aw-LF_MIN_AC)/m.ah)*180/Math.PI)); }
function lfWinkel(){ if(!lfSchraeg()) return 90; const w=Math.round(+S.lf.winkel||LF_WINKEL); return Math.max(91, Math.min(lfWinkelMax(), w)); }
/* Versatz von A gegenueber der Ausklinkungskante (cm, ungerundet) */
function lfU(){ if(!lfSchraeg()) return 0; const m=lfMasse(); return Math.max(0, Math.min(m.aw-LF_MIN_AC, m.ah*Math.tan((lfWinkel()-90)*Math.PI/180))); }
/* Kontur in Plattenkoordinaten (cm, Ursprung hinten links, y nach vorn), im
   Uhrzeigersinn. ord = Nummer der Aussenecke (0..4) oder -1 fuer die Innenecke.
   Gebaut wird immer fuer "hinten rechts" und dann gespiegelt; eine Spiegelung
   kehrt den Umlaufsinn um, deshalb wird dann die Reihenfolge umgedreht. */
/* Winkelbogen an der Ecke A zwischen den Richtungen A->K und A->Bp, auf der Seite,
   auf der der kleinere Winkel liegt (im Ausschnitt). r in px, Text am Winkelhalbierenden. */
function winkelBogen(A,K,Bp,r,text){
  const u=(p)=>{ const dx=p[0]-A[0], dy=p[1]-A[1], l=Math.hypot(dx,dy)||1; return [dx/l,dy/l]; };
  const u1=u(K), u2=u(Bp), cross=u1[0]*u2[1]-u1[1]*u2[0], sweep=cross>0?1:0;
  const p1=[A[0]+u1[0]*r, A[1]+u1[1]*r], p2=[A[0]+u2[0]*r, A[1]+u2[1]*r];
  let bx=u1[0]+u2[0], by=u1[1]+u2[1]; const bl=Math.hypot(bx,by)||1; bx/=bl; by/=bl;
  const f=(v)=>Math.round(v*10)/10;
  /* Text auf der Winkelhalbierenden hinter dem Bogen; Ankerseite nach Richtung, damit
     der Text nie in den Bogen laeuft (sonst sah "104°" aus wie "-104°") */
  const anchor=bx>0.35?'start':bx<-0.35?'end':'middle', d=anchor==='middle'?r+14:r+6;
  return `<path d="M${f(p1[0])} ${f(p1[1])} A${f(r)} ${f(r)} 0 0 ${sweep} ${f(p2[0])} ${f(p2[1])}" fill="none" stroke="#1E1E1E" stroke-width="1.2"/>`
    +`<text class="dim-text" x="${f(A[0]+bx*d)}" y="${f(A[1]+by*d+4)}" text-anchor="${anchor}">${text}</text>`;
}
function lfPts(){
  const m=lfMasse(), L=m.L, B=m.B, aw=m.aw, ah=m.ah, pos=lfPos();
  const schr=lfSchraeg(), u=lfU();
  /* D=(0,0) … B=(L-aw,0) an der Kante, A=(L-aw+u,ah) auf der inneren Kante, C=(L,ah);
     gerader Schnitt: u = 0, A ist die gewoehnliche Innenecke */
  let pts=[[0,0],[L-aw,0],[L-aw+u,ah],[L,ah],[L,B],[0,B]], ord=[0,1,-1,2,3,4];
  /* Radius je Punkt (cm): A (Innenecke) = Fertigungsradius; beim schraegen Schnitt
     bekommt auch B mindestens den Fertigungsradius (Senior 03.09.), sonst der vom
     Kunden gewaehlte Radius der Aussenecke. */
  const rmin=lfMinR();
  let rad=pts.map((_,i)=>ord[i]<0 ? rmin : (schr&&i===1 ? Math.max(rmin, lfCornerR(ord[i])/10) : lfCornerR(ord[i])/10));
  const mx=(pos==='hl'||pos==='vl'), my=(pos==='vr'||pos==='vl');
  pts=pts.map(([x,y])=>[mx?L-x:x, my?B-y:y]);
  if(mx!==my){ pts.reverse(); ord.reverse(); rad.reverse(); }
  return {pts, ord, rad, L, B, aw, ah, pos, u, winkel:lfWinkel()};
}
/* Schnittlaenge (m) des L-Schnitts und Umfang (m) der fertigen Kontur */
function lfGeo(){
  const g=lfPts(), L=g.L/100, B=g.B/100, aw=g.aw/100, ah=g.ah/100;
  if(lfSchraeg()){ const u=g.u/100, s=Math.hypot(u,ah)+(aw-u);      /* Schraege B–A plus gerades Stueck A–C */
    return {schnitt:s, umfang:2*(L+B)-aw-ah+s, schraeg:true, winkel:g.winkel, u:g.u, ac:g.aw-g.u}; }
  return {schnitt:aw+ah, umfang:2*(L+B), schraeg:false, winkel:90, u:0, ac:g.aw};
}
function lfSchnittCm(){ return Math.round(lfGeo().schnitt*100); }
/* Name einer Aussenecke aus ihrer Lage — folgt der gewaehlten Lage der Ausklinkung */
function lfCornerName(o){
  const g=lfPts(), i=g.ord.indexOf(o); if(i<0) return '';
  const [x,y]=g.pts[i], e=1e-6;
  const yy=y<e?'hinten':(y>g.B-e?'vorne':null), xx=x<e?'links':(x>g.L-e?'rechts':null);
  if(yy&&xx) return `${yy} ${xx}`;
  return `${yy||xx} · Ausklinkung`;
}
function lfCornerR(o){ return Math.max(0, +((S.lfR||[])[o])||0); }
/* Mittelpunkt der Ausklinkung in Plattenkoordinaten (fuer die Massbeschriftung) */
function lfNotchCenter(){
  const g=lfPts(), mx=(g.pos==='hl'||g.pos==='vl'), my=(g.pos==='vr'||g.pos==='vl');
  return [mx?g.aw/2:g.L-g.aw/2, my?g.B-g.ah/2:g.ah/2];
}
/* Abstand von einem Punkt (cm) in Richtung (dx,dy) bis zur Plattenkontur —
   bei der L-Form bis zur naechsten Kante, also auch bis zur Ausklinkung. */
function konturAbstand(px,py,dx,dy){
  const d=dims(), g=formPts();
  if(!g){ return dx>0?d.w-px:dx<0?px:dy>0?d.h-py:py; }
  const n=g.pts.length; let best=Infinity;
  for(let i=0;i<n;i++){ const a=g.pts[i], b=g.pts[(i+1)%n];
    const ex=b[0]-a[0], ey=b[1]-a[1], den=dx*ey-dy*ex; if(Math.abs(den)<1e-9) continue;
    const t=((a[0]-px)*ey-(a[1]-py)*ex)/den, u=((a[0]-px)*dy-(a[1]-py)*dx)/den;
    if(t>1e-6&&u>=-1e-6&&u<=1+1e-6) best=Math.min(best,t); }
  return isFinite(best)?best:(dx>0?d.w-px:dx<0?px:dy>0?d.h-py:py);
}
/* Die vier Randabstaende eines Ausschnitts, von seinen Kanten aus gemessen */
function cutAbstaende(c){
  const w=c.t==='c'?c.d:c.w, h=c.t==='c'?c.d:c.h;
  return { l:konturAbstand(c.cx-w/2,c.cy,-1,0), r:konturAbstand(c.cx+w/2,c.cy,1,0),
           t:konturAbstand(c.cx,c.cy-h/2,0,-1), b:konturAbstand(c.cx,c.cy+h/2,0,1) };
}
/* Liegt ein Punkt (cm) in der weggenommenen Ecke? */
function lfInNotch(px,py){
  const g=lfPts(), mx=(g.pos==='hl'||g.pos==='vl'), my=(g.pos==='vr'||g.pos==='vl');
  const qx=mx?px:g.L-px, qy=my?g.B-py:py;        /* auf "hinten rechts" normiert: qx vom Aussenrand, qy von der Plattenkante */
  if(qx>g.aw||qy>g.ah) return false;
  return qx < g.aw - g.u*(qy/g.ah);              /* jenseits der Schraege B–A (B an der Kante, A bei Tiefe ah um u nach innen) */
}

/* ═══════ Bauchausschnitt (Wunsch Senior 10.09.2026) ═══════
   Rechteckige Platte, in die VORDERKANTE ist ein Trapez geschnitten, das sich
   nach innen verjuengt. Der Vater nennt fuenf Masse: A (gerades Stueck links),
   B (gerades Stueck rechts), C (gerader Grund, parallel zur Vorderkante) und
   zwei Winkel. Die Tiefe folgt daraus — oder umgekehrt, je nachdem, welches
   Feld der Kunde zuletzt angefasst hat. Ein Haekchen macht den Ausschnitt
   mittig; ohne Haken bestimmt der Kunde jede Laenge selbst (Sascha 10.09.).

   Winkelkonvention: gemessen am Ende von C, zwischen C und der Schraege. Weil C
   parallel zur Vorderkante laeuft, ist das derselbe Wert wie an der Vorderkante
   (Wechselwinkel) — und dieselbe Lesart wie "Winkel bei B" der L-Form:
   90 Grad = senkrechter Schnitt, groesser = flacher. */
const BS_DEF_W = 135;      /* Vorgabe: Vorlauf gleich Tiefe */
const BS_MIN_C = 10;       /* cm — damit die beiden Innenecken Platz fuer die Verrundung haben */
const BS_REST  = 10;       /* cm — die hinter dem Ausschnitt stehen bleiben muessen */
const BS_CORNER_NAMES = ['hinten links','hinten rechts','vorne rechts',
                         'Ausschnitt rechts','Ausschnitt links','vorne links'];
/* Vorlauf der Schraege je cm Tiefe: v = cot(180 - Winkel) */
function bsVorlauf(g){ if(!(g>90)) return 0; const r=(180-g)*Math.PI/180; return r<=1e-9?0:1/Math.tan(r); }
function bsWinkel(k){ const w=Math.round(+S.bs['w'+k]||BS_DEF_W); return Math.max(90,Math.min(179,w)); }
function bsCornerR(o){ return Math.max(0, +((S.bsR||[])[o])||0); }
function bsSenkrecht(){ return bsVorlauf(bsWinkel(1))+bsVorlauf(bsWinkel(2)) < 1e-9; }
/* B laeuft nicht frei, wenn der Ausschnitt mittig sitzt oder beide Schnitte
   senkrecht sind (dann ist A + B + C zwingend gleich der Laenge). */
function bsBGebunden(){ return !!S.bs.mittig || (!bsWelle() && bsSenkrecht()); }
/* ── Zweite Schnittart: Welle (Zeichnung Sascha/Senior 10.09. abends, 130x90) ──
   Statt gerader Schraegen mit flachem Grund laeuft die Vorderkante als weiche
   Kosinusmulde: sie geht tangential aus der Kante heraus, ist in der Mitte am
   tiefsten und hat KEINE einzige Ecke. Darum gibt es hier auch nichts zu
   verrunden und keinen Eckenaufschlag (Entscheidung Sascha 10.09.) — nur die
   Schnittlaenge zaehlt. A, B und Tiefe sind frei, "mittig" laesst B mit A
   mitlaufen. C und die beiden Winkel gehoeren allein zum Trapez. */
const BS_MIN_O = 20;       /* cm — schmaler ist keine Mulde mehr */
const BS_KURVE = 72;       /* Stuetzpunkte der Welle in der Kontur */
function bsWelle(){ return S.bs.art==='welle'; }
/* Aussenecken, die der Kunde runden kann: bei der Welle nur die vier Plattenecken. */
function bsOrd(){ return bsWelle() ? [0,1,2,5] : [0,1,2,3,4,5]; }
/* Hoehe der Mulde ueber der Vorderkante an der Stelle u (0..1): 0 an den Enden,
   1 in der Mitte, an beiden Enden UND im Scheitel waagerecht. */
function bsWelleF(u){ return (1-Math.cos(2*Math.PI*u))/2; }
/* Bogenlaenge der Mulde (cm). Das Integral hat keine geschlossene Form —
   Simpson mit 400 Schritten, das ist auf Zehntelmillimeter genau. */
function bsWelleLaenge(O,T){
  if(!(O>0)) return 0;
  if(!(T>0)) return O;
  const n=400, h=1/n, k=Math.PI*T/O, f=u=>Math.hypot(1, k*Math.sin(2*Math.PI*u));
  let sum=f(0)+f(1);
  for(let i=1;i<n;i++) sum+=(i%2?4:2)*f(i*h);
  return O*sum*h/3;
}
/* Die fuenf Masse in einen widerspruchsfreien Satz bringen: getrieben wird das
   Feld, das der Kunde NICHT zuletzt angefasst hat. */
function bsGeo(){
  const L=Math.max(20,+S.bs.L||0), BR=Math.max(20,+S.bs.BR||0), c=Math.max(1,+S.bs.c||0);
  if(bsWelle()){
    /* Welle: nichts wird abgeleitet — A, B und Tiefe stehen fuer sich, die
       Oeffnung folgt aus L - A - B. */
    const a=Math.max(0,+S.bs.a||0), b=S.bs.mittig?a:Math.max(0,+S.bs.b||0);
    const t=Math.max(0.1,+S.bs.t||0), O=L-a-b, schnitt=bsWelleLaenge(O,t)/100;
    return {L,BR,a,b,c:0,t,w1:0,w2:0,k1:0,k2:0,r1:0,r2:0,ks:0,welle:true,senkrecht:false,
            schnitt, oeffnung:O, umfang:(2*(L+BR)-O)/100+schnitt};
  }
  const w1=bsWinkel(1), w2=bsWinkel(2), k1=bsVorlauf(w1), k2=bsVorlauf(w2), ks=k1+k2;
  let a=Math.max(0,+S.bs.a||0), b, t;
  if(ks<1e-9){                                  /* zwei senkrechte Schnitte: Tiefe ist frei */
    t=Math.max(0.1,+S.bs.t||0);
    if(S.bs.mittig) a=(L-c)/2;
    b=L-a-c;
  } else if(S.bs.mittig){
    if(S.bs.treiber==='t'){ t=Math.max(0.1,+S.bs.t||0); a=(L-c-t*ks)/2; }
    else t=(L-2*a-c)/ks;
    b=a;
  } else if(S.bs.treiber==='t'){
    t=Math.max(0.1,+S.bs.t||0); b=L-a-c-t*ks;
  } else {
    b=Math.max(0,+S.bs.b||0); t=(L-a-b-c)/ks;
  }
  const r1=t*k1, r2=t*k2;
  const schnitt=(Math.hypot(r1,t)+c+Math.hypot(r2,t))/100;      /* m */
  const oeffnung=r1+c+r2;                                       /* cm, an der Vorderkante */
  return {L,BR,a,b,c,t,w1,w2,k1,k2,r1,r2,ks,schnitt,oeffnung,
          umfang:(2*(L+BR)-oeffnung)/100+schnitt, senkrecht:ks<1e-9};
}
function bsSchnittCm(){ return Math.round(bsGeo().schnitt*100); }
/* Kontur in Plattenkoordinaten (cm, Ursprung hinten links, y nach vorn), im
   Uhrzeigersinn. ACHT Punkte: vier Plattenecken, zwei aeussere Ausschnittecken
   an der Vorderkante, zwei innere an den Enden von C.
   ord = Nummer der Aussenecke (0..5) oder -1 fuer eine Innenecke. */
function bsPts(){
  const g=bsGeo(), L=g.L, BR=g.BR, rmin=lfMinR();
  if(g.welle){
    /* Die Mulde wird als Streckenzug abgelegt — von rechts nach links, damit der
       Umlauf wie beim Trapez im Uhrzeigersinn bleibt. Die beiden Enden liegen
       genau auf der Vorderkante und sind KEINE Ecken (Radius 0, kein Name). */
    const kurve=[];
    for(let i=0;i<=BS_KURVE;i++){ const u=1-i/BS_KURVE;
      kurve.push([g.a+u*g.oeffnung, BR-g.t*bsWelleF(u)]); }
    const pts=[[0,0],[L,0],[L,BR]].concat(kurve, [[0,BR]]);
    const ord=[0,1,2].concat(kurve.map(()=>-1), [5]);
    const rad=ord.map(o=>o<0?0:bsCornerR(o)/10);
    return Object.assign({pts, ord, rad}, g);
  }
  const pts=[[0,0],[L,0],[L,BR],[L-g.b,BR],[L-g.b-g.r2,BR-g.t],[g.a+g.r1,BR-g.t],[g.a,BR],[0,BR]];
  const ord=[0,1,2,3,-1,-1,4,5];
  /* Wie bei der L-Form: die Innenecken tragen immer den Fertigungsradius; an
     einer Schraege bekommt auch die aeussere Ausschnittecke mindestens ihn. */
  const rad=ord.map(o=>{
    if(o<0) return rmin;
    if(o===3) return g.w2>90.5 ? Math.max(rmin, bsCornerR(3)/10) : bsCornerR(3)/10;
    if(o===4) return g.w1>90.5 ? Math.max(rmin, bsCornerR(4)/10) : bsCornerR(4)/10;
    return bsCornerR(o)/10;
  });
  return Object.assign({pts, ord, rad}, g);
}
/* Automatisch verrundete Schraegen-Ecken zaehlen in der Radienstaffel mit — nur
   die, die der Kunde nicht ohnehin selbst gerundet hat (Regel wie L-Form). */
function bsAutoEcken(){
  if(S.form!=='bauch') return 0;
  if(bsWelle()) return 0;      /* tangentiale Uebergaenge, nichts zu verrunden */
  /* Genau die Regel der L-Form: jede Ecke, die an einer Schraege liegt, traegt
     den Fertigungsradius und zaehlt in der Staffel mit — je Schraege sind das
     zwei (aussen an der Vorderkante, innen am Grund). Bei senkrechten Schnitten
     gibt es keine Schraege: dann sind die Innenecken wie beim geraden L frei. */
  const g=bsPts(); let n=0;
  g.pts.forEach((_,i)=>{ const o=g.ord[i];
    if(g.rad[i]>0 && (o<0 || bsCornerR(o)<=0) && lfIstDiagonalEcke(g,i)) n++; });
  return n;
}
/* Mitte des Ausschnitts in Plattenkoordinaten */
function bsCenter(){ const g=bsGeo(); return g.welle ? [g.a+g.oeffnung/2, g.BR-g.t/2] : [g.a+g.r1+g.c/2, g.BR-g.t/2]; }
/* Liegt ein Punkt (cm) im weggenommenen Trapez? */
function bsImAusschnitt(px,py){
  const g=bsGeo(); if(!(g.t>0) || py < g.BR-g.t-1e-9) return false;
  if(g.welle){ if(px<=g.a||px>=g.L-g.b) return false;
    return py > g.BR-g.t*bsWelleF((px-g.a)/g.oeffnung)+1e-9; }
  const f=(g.BR-py)/g.t;                    /* 0 an der Vorderkante, 1 am Grund */
  return px > g.a+g.r1*f+1e-9 && px < g.L-g.b-g.r2*f-1e-9;
}
/* Kontur der aktuellen Form, wenn sie kein Rechteck ist */
function formPts(){ return S.form==='lform'?lfPts() : S.form==='bauch'?bsPts() : null; }

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
/* Preis einer Lagerposition im aktiven Kanal */
function hitPreis(hit){ return kanal()==='pln' ? (hit[3]!=null?hit[3]:null) : hit[0]; }
/* Bearbeitungen sind seit 26.08.2026 feste Aufschlaege (PREISREGEL-Bearbeitungen-
   Konfigurator-26-08-2026.md), unabhaengig von Material und Staerke. Freie
   Ausschnitte nach Schnittlaenge, kalibriert auf Steckdose 100x50 mm = 14,90 und
   Spuele 560x480 mm = 39,90; kleiner als ein Steckdosenausschnitt gibt es nicht. */
const FREI_PRICE  = {basis:10.7, lfm:13.9, minimum:14.9};
function freierAusschnitt(lfm){ return zl(Math.max(FREI_PRICE.minimum, auf90(FREI_PRICE.basis + FREI_PRICE.lfm*lfm))); }
/* Eckradien: Staffel nach ANZAHL gerundeter Ecken, nicht je Ecke. Ab vier gedeckelt. */
const RADIEN_STAFFEL = [0, 19.9, 29.9, 34.9, 39.9];
function radienpreis(n){ return n<=0 ? 0 : zl(RADIEN_STAFFEL[Math.min(n, RADIEN_STAFFEL.length-1)]); }
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

/* ═══════ Bezahlen nach Mass ═══════
   Lagerartikel ohne Aufpreise gehen wie bisher als Cart-Permalink in den
   Checkout. Alles andere — Sondermass, Bearbeitungen, L-Form, Naehtisch — hat
   seit v1.17.0 einen festen Preis und geht als Draft Order durch den
   Checkout-Worker (worker/konfigurator-checkout): der rechnet den Preis
   serverseitig nach, legt die Bestellung mit allen Konfigurationsdaten an
   und liefert die Checkout-URL. Ohne konfigurierten Endpunkt bleibt die
   Mail-Anfrage. Endpunkt: data-kfg-checkout am Root-Element oder
   window.KFG_CHECKOUT_URL. */
/* v1.17.2 (03.09.): Der Endpunkt steht im Skript. Das Webflow-Attribut
   data-kfg-checkout ging bei einem Designer-Publish am 03.09. verloren — die
   Seite fiel fuer alle Sondermasse still auf die Mail-Anfrage zurueck. Attribut
   oder window.KFG_CHECKOUT_URL ueberschreiben weiterhin; "off" schaltet ab. */
const CHECKOUT_DEFAULT='https://kessler-konfigurator-checkout.kessler-konfigurator-checkout.workers.dev/checkout';
const CHECKOUT_URL=(function(){
  try{ const r=document.querySelector('[data-kfg-root]');
    const a=(r&&r.getAttribute('data-kfg-checkout'))||window.KFG_CHECKOUT_URL||'';
    if(a==='off') return '';
    return a||CHECKOUT_DEFAULT; }catch(e){ return CHECKOUT_DEFAULT; }
})();
/* Versand fuer Massanfertigungen: Pauschale (Sascha 03.09.: 19,99 EUR). Der Worker
   setzt denselben Betrag als Versandzeile in die Bestellung (VERSAND_STANDARD).
   PLN-Wert vorlaeufig, von Sascha zu bestaetigen. */
const VERSAND_MASS={eur:'19,99 €', pln:'84,90 zł'};
/* Der Checkout-Worker traegt eine SERVERSEITIGE Kopie der Preisrechnung. Sie kennt
   den Bauchausschnitt noch nicht und wuerde einen anderen Betrag errechnen — der
   Abgleich im Worker haette die Bestellung mit "Preis weicht ab" abgewiesen, nachdem
   der Kunde schon geklickt hat. Bis worker/konfigurator-checkout nachgezogen ist,
   laeuft die Form deshalb BEWUSST ueber die Anfrage: der Preis steht trotzdem fest
   und reist mit. Zum Freischalten genuegt es, diese eine Bedingung zu streichen. */
const BS_WORKER_BEREIT = true;
function kannBezahlen(){ return !!CHECKOUT_URL && !needsOffer() && calc().quelle!=='offen'
  && (S.form!=='bauch' || BS_WORKER_BEREIT); }
/* Warenkorb-Endpunkt des Workers: gleicher Ursprung wie der Checkout (v1.17.8) */
const WARENKORB_URL=CHECKOUT_URL ? CHECKOUT_URL.replace(/\/checkout\/?$/,'/warenkorb') : '';
/* Lagerartikel ohne jeden Aufpreis — nur dann traegt der Permalink den vollen Preis */
function nurLager(){ const c=calc(); return isStandard() && Math.abs(c.total-c.basis)<0.005; }

/* ═══════ State ═══════ */
/* Startkonfiguration: bewusst ein LAGERARTIKEL (Buche 120x60x25 = 47,95 EUR ab Lager).
   Eiche Sonoma gibt es nur in 90x50 und 90x60 — der Konfigurator startete dadurch
   im Angebots-Flow statt mit dem starken "Ab Lager"-Signal. */
const S = { mat:'dekor', dekor:'buk', mpxSurface:'natur', absColor:'dekor',
            form:'rect', L:120, B:60, D:80, lf:{L:180,B:120,aw:90,ah:60,pos:null,schnitt:'gerade',winkel:LF_WINKEL}, thick:'25',
            bs:{L:200, BR:90, a:55, b:55, c:60, t:15, w1:BS_DEF_W, w2:BS_DEF_W, mittig:false, treiber:'b', art:'trapez'},
            corner:0, cornerR:[0,0,0,0], lfR:[0,0,0,0,0], bsR:[0,0,0,0,0,0], edgeR:3, edges:['abs','abs','abs','abs'],
            extras:{bohr:false,custom:false,lack:false},
            massband:'none', massbandNull:'links', machine:'', maschineMass:'52x18.1',
            cuts:[], draw:null, view:'2d' };

/* ═══════ Helpers ═══════ */
const ATELIER_DEFAULT=JSON.parse(JSON.stringify(S));
const $=id=>document.getElementById(id);
const hasOwn=(o,k)=>k!=null && Object.prototype.hasOwnProperty.call(o,k);
/* Nutzertext (Maschine, Skizzenbeschreibung, Dateiname) nie roh in innerHTML (Review 08.09., B9) */
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
/* Weder Lagerpreise noch Kurven da: Preise koennen nicht gerechnet werden (Review 08.09., B1) */
function ohneDaten(){ return !Object.keys(SHOP).length && !Object.keys(KURVEN).length; }
const fmt=v=>kanal()==='pln'
  ? v.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł'
  : KFG_LANG==='en' ? '€'+v.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})
  : v.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
function toast_roh(t){const e=$('toast');e.textContent=t;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),2600)}
function rules(){ return RULES[S.mat]; }
function baseEdge(){ return EDGEPROFILES[S.mat][0][0]; }
function profileOf(id){ return EDGEPROFILES[S.mat].find(p=>p[0]===id)||EDGEPROFILES[S.mat][0]; }
function edgeLabel(e){ const p=profileOf(e); return (e==='rund'||e==='halbrund')?`${p[1]} R${S.edgeR}`:p[1]; }
function texKey(){ return S.mat==='mpx' ? (S.mpxSurface==='hpl'?S.dekor:'sperrholz-natur') : S.dekor; }
/* Lackierung ist seit v1.16.0 eine KANTEN-Option (Schritt 04), keine Oberflaeche
   mehr. Sie gilt nur fuer offene Schichtkanten, nicht fuer ABS. */
function lackAn(){ return !!S.extras.lack && (S.mat==='mpx'||S.mat==='szwal'); }
function isLack(){ return lackAn() && S.edges.some(e=>e!=='abs'); }
/* Preis je lfm fuer EINE Kante — lackiert schlaegt den Grundpreis. */
function edgeLfm(e){
  if(lackAn() && LACK_LFM[e]!==undefined) return zl(LACK_LFM[e]);
  return zl(profileOf(e)[2]||0);
}
/* Notiz am Kanten-Chip: bei Multiplex/Naehtisch aus dem gueltigen Preis
   gerechnet, damit das Ankreuzen der Lackierung sofort sichtbar wird. */
function edgeNote(p){
  if(p[0]==='abs') return p[3];
  const v=EDGEPROFILES[S.mat]===EDGE_MPX ? edgeLfm(p[0]) : zl(p[2]||0);
  return v>0 ? `+ ${fmt(v)}/lfm` : p[3]==='inklusive' ? p[3] : 'serienmäßig';
}

function dims(){
  if(S.form==='round') return {w:+S.D,h:+S.D};
  if(S.form==='lform') return {w:+S.lf.L,h:+S.lf.B};
  if(S.form==='bauch') return {w:+S.bs.L,h:+S.bs.BR};
  return {w:+S.L,h:+S.B};
}
/* Flaeche: bei der L-Form das UMSCHLIESSENDE Rechteck. Die Rohplatte wird in
   dieser Groesse eingekauft und zugeschnitten; das Weggenommene ist Verschnitt,
   kein Rabatt (PREISREGEL 26.08.). */
function areaM2(){
  if(S.form==='round') return Math.PI*Math.pow(S.D/200,2);
  if(S.form==='lform') return S.lf.L*S.lf.B/1e4;
  if(S.form==='bauch') return S.bs.L*S.bs.BR/1e4;
  return S.L*S.B/1e4;
}
/* Umfang in m: bei der L-Form der echte Konturumfang — beim geraden L gleich
   dem Rechteck, beim schraegen kuerzer (Diagonale statt zwei Katheten). */
function perimM(){
  if(S.form==='round') return Math.PI*S.D/100;
  if(S.form==='lform') return lfGeo().umfang;
  if(S.form==='bauch') return bsGeo().umfang;
  const d=dims(); return 2*(d.w+d.h)/100;
}
function dekorList(){
  if(S.mat!=='mpx') return MATERIALS[S.mat].dekore;
  return S.mpxSurface==='hpl'?DEKOR_HPL:[['sperrholz-natur','Birke natur']];
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
  const lschnitt=S.form==='lform'?freierAusschnitt(lfGeo().schnitt)
                :S.form==='bauch'?freierAusschnitt(bsGeo().schnitt):0;
  let extras=0; if(S.extras.bohr) extras+=zl(X_PRICE.bohr);
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
  if(S.extras.custom||isLack()||S.mat==='szwal'||S.form==='lform'||S.form==='bauch'||cornerCount()>0||S.cuts.length>0||S.extras.bohr) return false;
  /* Farbige ABS-Kante gibt es nicht ab Lager — Fertigungsauftrag ohne Aufpreis (Sascha 08.09.) */
  if(S.mat==='dekor'&&S.absColor!=='dekor'&&S.edges.some(e=>e==='abs')) return false;
  if(S.mat!=='dekor'&&S.mat!=='compact') { /* mpx Festmaße? aktuell keine → nur 18er Liste für dekor */ }
  return !!shopHit();
}
/* Freie Ausschnitte, Ausklinkungen und Konturen haben seit v1.7.0 einen
   Sofortpreis nach Formel, der Kabelkanal seit v1.8.0 und die lackierte Kante
   seit v1.16.1. Ins Angebot geht nur noch die eigene Skizze. */
function needsOffer(){ return S.extras.custom || calc().quelle==='offen'; }
function delivDate(){
  const d=new Date(); let n=0;
  while(n<4){ d.setDate(d.getDate()+1); if(d.getDay()!==0&&d.getDay()!==6)n++; }
  return d.toLocaleDateString(KFG_LANG==='pl'?'pl-PL':KFG_LANG==='en'?'en-GB':'de-DE',{day:'numeric',month:'long'});
}

/* ═══════ 2D-SVG ═══════ */
/* Injected inside the original core so annotations use its exact shape geometry. */
function atelierCornerDetails(){
  if(!cornerFormOk()||!cornerCount())return [];
  const g=S.form==='lform'?lfPts():S.form==='bauch'?bsPts():null;
  return cornerIdx().map((id,index)=>{
    const at=g?g.ord.indexOf(id):-1, requested=cornerR(id);
    const radius=at>=0?g.rad[at]*10:requested;
    return {id,number:index+1,name:cornerName(id),radius:Math.round(radius*10)/10,minimum:radius>requested};
  });
}
function atelierCornerMarkers(x,y,sc,pw,ph){
  const corners=atelierCornerDetails();if(!corners.length)return '';
  const g=S.form==='lform'?lfPts():S.form==='bauch'?bsPts():null;
  const pts=g?g.pts.map(([px,py])=>[x+px*sc,y+py*sc]):[[x,y],[x+pw,y],[x+pw,y+ph],[x,y+ph]];
  const rad=g?g.rad.map(r=>r*sc):cornerRadii(sc,pw/2,ph/2);
  return '<g class="atelier_corner_markers" pointer-events="none">'+corners.map(c=>{
    const at=g?g.ord.indexOf(c.id):c.id, e=eckRundung(pts,rad,at);
    const mx=e.mitte[0],my=e.mitte[1];
    let tx=mx-e.aus[0]*29,ty=my-e.aus[1]*29;
    // Keep the two recess markers above the existing angle annotations.
    if(S.form==='bauch'&&(c.id===3||c.id===4))ty=Math.min(ty,y+(g.BR-g.t)*sc-69);
    tx=Math.max(x+16,Math.min(x+pw-16,tx));ty=Math.max(y+17,Math.min(y+ph-17,ty));
    return `<g><title>Ecke ${c.number}: ${c.name}, ${c.radius?'Radius '+c.radius+' mm':'eckig'}</title><path d="M${mx} ${my}L${tx} ${ty}" fill="none" stroke="#4e4e4e" stroke-width="1.1" stroke-opacity=".6"/><circle cx="${tx}" cy="${ty}" r="12" fill="#fff" stroke="#666" stroke-width="1"/><text x="${tx}" y="${ty+5.5}" text-anchor="middle" font-family="Onest,sans-serif" font-size="17" font-weight="600" fill="#242424">${c.number}</text></g>`;
  }).join('')+'</g>';
}
function atelierLabel(cx,cy,text,kind=''){
  const width=Math.max(42,text.length*9+18);
  return `<g class="atelier_dimension ${kind}" pointer-events="none"><rect x="${cx-width/2}" y="${cy-13}" width="${width}" height="26" rx="5" fill="#fff" fill-opacity=".96" stroke="#d6d6d6" stroke-width=".8"/><text x="${cx}" y="${cy+5.5}" text-anchor="middle" fill="#171717" font-family="Onest,sans-serif" font-size="17" font-weight="500">${text}</text></g>`;
}
function atelierMeasureH(a,b,y,text){
  return `<g class="atelier_dimension" pointer-events="none" stroke="#565656" stroke-width="1.3"><path d="M${a} ${y}H${b} M${a} ${y-5}v10 M${b} ${y-5}v10" fill="none"/></g>`+atelierLabel((a+b)/2,y,text);
}
function atelierNotchDimensions(x,y,sc,pw,ph,g){
  const left=g.pos==='vl'||g.pos==='hl',front=g.pos==='vl'||g.pos==='vr';
  const x0=left?x:x+pw-g.aw*sc,x1=left?x+g.aw*sc:x+pw;
  const y0=front?y+ph-g.ah*sc:y,y1=front?y+ph:y+g.ah*sc;
  const cy=(y0+y1)/2, cx=(x0+x1)/2;
  const fmt=v=>String(Math.round(v*10)/10).replace('.',',');
  // Separate the two measurements, anchored to the actual empty notch.
  let out=atelierMeasureH(x0+5,x1-5,cy-18,`${fmt(g.aw)} cm`);
  const vx=left?x0+18:x1-18;
  out+=`<path class="atelier_dimension" d="M${vx} ${y0+5}V${y1-5} M${vx-5} ${y0+5}h10 M${vx-5} ${y1-5}h10" fill="none" stroke="#565656" stroke-width="1.3" pointer-events="none"/>`;
  out+=atelierLabel(cx,cy+22,`Tiefe ${fmt(g.ah)} cm`);
  return out;
}
function atelierBauchDimensions(x,y,sc,pw,ph,g){
  const f=v=>String(Math.round(v*10)/10).replace('.',',');
  const yf=y+ph, yi=y+(g.BR-g.t)*sc;
  const xa=x+g.a*sc, xb=x+(g.L-g.b)*sc;
  const c0=x+(g.welle?g.a:g.a+g.r1)*sc,c1=x+(g.L-g.b-(g.welle?0:g.r2))*sc;
  const mid=(c0+c1)/2;
  // One aligned dimension row outside the material; no floating label badges.
  const ink='#303030', baseline=yf+31;
  const text=(tx,ty,label)=>`<text x="${tx}" y="${ty}" text-anchor="middle" fill="${ink}" stroke="#f7f7f7" stroke-width="4" stroke-opacity=".92" paint-order="stroke" stroke-linejoin="round" font-family="Onest,sans-serif" font-size="22" font-weight="500">${label}</text>`;
  const line=(d,dashed=false)=>`<path d="${d}" fill="none" stroke="${ink}" stroke-opacity="${dashed?'.38':'.72'}" stroke-width="1.25"${dashed?' stroke-dasharray="4 4"':''}/>`;
  const measure=(a,b,startY,label)=>line(`M${a} ${startY+5}V${baseline+5} M${b} ${startY+5}V${baseline+5}`,true)
    +line(`M${a} ${baseline}H${b} M${a-3} ${baseline+4}l6 -8 M${b-3} ${baseline+4}l6 -8`)
    +text((a+b)/2,baseline-9,label);
  let out=measure(x,xa,yf,`A ${f(g.a)}`)+measure(xb,x+pw,yf,`B ${f(g.b)}`);
  out+=measure(c0,c1,g.welle?yf:yi,g.welle?`Mulde ${f(g.oeffnung)}`:`C ${f(g.c)}`);
  // The depth measures the actual recess, from its floor to the front edge.
  // Its label stays in the material, as requested, with a short leader.
  out+=line(`M${xa} ${yf}H${xb}`,true);
  out+=line(`M${mid} ${yi}V${yf} M${mid-5} ${yi}h10 M${mid-5} ${yf}h10`);
  const depthY=Math.max(y+27,yi-33);
  out+=text(mid,depthY,`Tiefe ${f(g.t)} cm`);
  out+=line(`M${mid} ${depthY+8}V${yi-5}`,true);
  if(!g.welle){
    for(const [px,value,side,run] of [[xa,g.w1,-1,g.r1],[xb,g.w2,1,g.r2]]){
      const radius=Math.min(29,Math.max(15,(side<0?g.a:g.b)*sc*.3));
      const endAngle=Math.atan2(-g.t*sc,-side*run*sc);
      const ex=px+Math.cos(endAngle)*radius, ey=yf+Math.sin(endAngle)*radius;
      out+=line(`M${px+side*radius} ${yf}A${radius} ${radius} 0 0 ${side<0?1:0} ${ex} ${ey}`);
      const tx=Math.max(x+31,Math.min(x+pw-31,px+side*24));
      out+=text(tx,yf-radius-15,`${f(value)}°`);
    }
  }
  return `<g class="atelier_dimension atelier_bauch_dimensions" pointer-events="none">${out}</g>`;
}

function drawStage(){
  /* PAD war 76, dann 58. Jetzt 42: die Massketten brauchen rund 30 Einheiten,
     der Rest war reine Luft (Wunsch Vater 29.07.: "Tischplatte muss groesser
     sein"). Damit nutzt die Platte 516 von 600 Einheiten Breite. */
  /* Nicht mehr rundum gleich: die Massketten liegen rechts und unten, dort
     brauchen sie Platz — links und oben war er nur Luft. */
  const svg=$('stage'); const W=600,H=444;
  const PADT=14;
  const rand=30+dimAb()+Math.round(_dimFS*0.5);      /* Kette + Zahl + Luft */
  /* L-Form: die Hoehenkette steht links (rechts laeuft die Ausklinkung) — dort braucht sie
     denselben Platz wie rechts, sonst wird sie am Rand abgeschnitten (Review 08.09.). */
  const PADL=S.form==='lform'?rand:16, PADR=rand, PADB=rand+(S.form==='bauch'?42:0);
  const bw=W-PADL-PADR, bh=H-PADT-PADB;
  const d=dims(), sc=Math.min(bw/d.w,bh/d.h);
  const pw=d.w*sc, ph=d.h*sc, x=PADL+(bw-pw)/2, y=PADT+(bh-ph)/2;
  const tex=stageTex(texKey()); ensureTex(texKey(), refreshStage);
  let inner='';

  inner+=texPattern(x,y,texCm()?texCm()*sc:null,tex,pw,ph);
  if(S.form==='round'){
    const r=pw/2, cx=W/2, cy=y+r;
    inner+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#texPat)"/>`;
    inner+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#00000018"/>`;
    inner+=`<circle class="kfg_edge" data-i="0" cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${edgeCol(S.edges[0])}" stroke-width="5"><title>Kante: ${edgeLabel(S.edges[0])}</title></circle>`;
    inner+=dimH(cx-r,cx+r,cy+r+30,'Ø '+S.D+' cm');
  } else if(S.form==='lform'){
    const lg=lfPts();
    /* Kontur aus Lage und Schnitt; Radien je Punkt aus lfPts (Kundenradius der
       Aussenecke, Fertigungsradius an Innenecke und an A/B der Schraege). */
    const ptsL=lg.pts.map(([px,py])=>[x+px*sc, y+py*sc]);
    const radL=lg.rad.map(r=>Math.min(r*sc, pw/3, ph/3));
    const pd=roundPoly(ptsL, radL);
    inner+=`<path d="${pd}" fill="url(#texPat)"/>`;
    inner+=massbandSVG(x,y,sc,pw,ph);
    inner+=`<path d="${pd}" fill="none" stroke="${edgeCol(S.edges[0])}" stroke-width="5" stroke-linejoin="round"/>`;
    inner+=`<path d="${pd}" fill="none" stroke="#00000018"/>`;
    inner+=dimH(x,x+pw,y+ph+30,S.lf.L+' cm')+dimV(x-30,y,y+ph,S.lf.B+' cm');
    /* Mass der Ausklinkung in ihrer Mitte, beim schraegen Schnitt mit Winkel */
    const nc=lfNotchCenter(), vorn=(lg.pos==='vr'||lg.pos==='vl'), links=(lg.pos==='hl'||lg.pos==='vl');
    const ntxt=`${lg.aw} × ${lg.ah}`;
    /* Schraege (Senior 08.09.): B = Ecke der Ausklinkung an der Plattenkante, A auf der
       inneren Kante der Ausklinkung, C deren Ende an der Aussenkante; A–C bleibt gerade.
       Winkelbogen bei B auf der Platte, zwischen Plattenkante (Richtung D) und Schraege. */
    if(lfSchraeg()){
      const mx=links, my=vorn, P=([px2,py2])=>[x+(mx?lg.L-px2:px2)*sc, y+(my?lg.B-py2:py2)*sc];
      const D=P([0,0]), Bp=P([lg.L-lg.aw,0]), A=P([lg.L-lg.aw+lg.u,lg.ah]);
      const f1=v=>Math.round(v*10)/10;
      /* Marke sitzt auf der GERUNDETEN Kontur (Bogenmitte), nicht auf der theoretischen
         Ecke — sonst schwebt der Punkt neben der Kante. Buchstabe auf der
         Winkelhalbierenden nach aussen, also nie auf der Platte. */
      const lab=(i,t,ri)=>{ const e=eckRundung(ptsL,radL,i), m=e.mitte, d=14, r=ri||e.aus;
        return `<circle cx="${f1(m[0])}" cy="${f1(m[1])}" r="3" fill="#1E1E1E" stroke="#F2F0EB" stroke-width="1.2"/>`
          +`<text class="dim-text" x="${f1(m[0]+r[0]*d)}" y="${f1(m[1]+r[1]*d+5)}" text-anchor="middle">${t}</text>`; };
      /* C liegt an der Aussenkante — dort steht schon die Masskette. Sein Buchstabe
         geht deshalb in die Ausklinkung hinein statt auf der Winkelhalbierenden nach aussen. */
      const iC=lg.ord.indexOf(2), pC=ptsL[iC], nc=lfNotchCenter();
      let cx2=x+nc[0]*sc-pC[0], cy2=y+nc[1]*sc-pC[1]; const cl=Math.hypot(cx2,cy2)||1;
      inner+=lab(lg.ord.indexOf(1),'B')+lab(lg.ord.indexOf(-1),'A')+lab(iC,'C',[cx2/cl,cy2/cl]);
      /* Bogen groesser als die Verrundung R50 an B (5 cm), damit er nicht in der Rundung liegt */
      inner+=winkelBogen(Bp,D,A,Math.min(30,lg.ah*sc*0.45,(lg.L-lg.aw)*sc*0.45),`${lg.winkel}°`);
    }
    inner+=atelierNotchDimensions(x,y,sc,pw,ph,lg);
    inner+=atelierCornerMarkers(x,y,sc,pw,ph);
    /* Aussenecken direkt anklickbar — wie beim Rechteck */
    lg.ord.forEach((o,i)=>{ if(o<0) return; const pt=ptsL[i];
      inner+=`<circle class="kfg_cornerhit" data-c="${o}" cx="${pt[0]}" cy="${pt[1]}" r="15" fill="transparent" style="cursor:pointer">`
        +`<title>Ecke ${cornerName(o)}, klicken zum ${cornerOn(o)?'Begradigen':'Abrunden'}</title></circle>`;
    });
  } else if(S.form==='bauch'){
    const bg=bsPts();
    const ptsL=bg.pts.map(([px,py])=>[x+px*sc, y+py*sc]);
    const radL=bg.rad.map(rr=>Math.min(rr*sc, pw/3, ph/3));
    const pd=roundPoly(ptsL, radL);
    inner+=`<path d="${pd}" fill="url(#texPat)"/>`;
    inner+=massbandSVG(x,y,sc,pw,ph);
    inner+=`<path d="${pd}" fill="none" stroke="${edgeCol(S.edges[0])}" stroke-width="5" stroke-linejoin="round"/>`;
    inner+=`<path d="${pd}" fill="none" stroke="#00000018"/>`;
    inner+=`<path d="${pd}" fill="none" stroke="#343434" stroke-width="1.8" stroke-linejoin="round" pointer-events="none"/>`;
    inner+=dimH(x,x+pw,y+ph+72,bg.L+' cm')+dimV(x+pw+30,y,y+ph,bg.BR+' cm');
    inner+=atelierBauchDimensions(x,y,sc,pw,ph,bg);
    inner+=atelierCornerMarkers(x,y,sc,pw,ph);
    /* Aussenecken direkt anklickbar — wie beim Rechteck und bei der L-Form */
    bg.ord.forEach((o,i)=>{ if(o<0) return; const pt=ptsL[i];
      inner+=`<circle class="kfg_cornerhit" data-c="${o}" cx="${pt[0]}" cy="${pt[1]}" r="15" fill="transparent" style="cursor:pointer">`
        +`<title>Ecke ${cornerName(o)}, klicken zum ${cornerOn(o)?'Begradigen':'Abrunden'}</title></circle>`;
    });
  } else {
    /* Radius je Ecke — 0 heisst eckig. Ohne Rundung bleibt die alte leichte 3-px-Fase. */
    const RR=cornerRadii(sc,pw/2,ph/2);
    const anyR=RR.some(v=>v>0.5);
    const R4=anyR?RR:[3,3,3,3];
    const rx=Math.max(...R4);
    const pdRect=roundPath(x,y,pw,ph,R4);
    inner+=`<path d="${pdRect}" fill="url(#texPat)"/>`;
    inner+=massbandSVG(x,y,sc,pw,ph);
    inner+=`<path d="${pdRect}" fill="none" stroke="#00000018"/>`;
    /* Kanten als konturfolgende Pfade — jede Kante traegt die Haelfte der beiden
       angrenzenden Eckbogen, jetzt mit individuellem Radius je Ecke. */
    const seg=edgeSegments(x,y,pw,ph,R4);
    seg.forEach((dd,i)=>{
      inner+=`<path class="kfg_edge" data-i="${i}" d="${dd}" fill="none"
        stroke="${edgeCol(S.edges[i])}" stroke-width="5" stroke-linecap="butt"><title>Kante ${'ABCD'[i]}: ${edgeLabel(S.edges[i])}</title></path>`;
    });
    inner+=dimH(x,x+pw,y+ph+30,d.w+' cm')+dimV(x+pw+30,y,y+ph,d.h+' cm');
    inner+=atelierCornerMarkers(x,y,sc,pw,ph);
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
      if((dragCut&&dragCut.i===i&&committed)||FORCE_DISTS||(committed&&c2.preset==='maschine')){
        const f=v=>(''+(Math.round(v*10)/10)).replace('.',',');
        const ab=cutAbstaende(c2), cl=ab.l, cr=ab.r, ct=ab.t, cb=ab.b;
        const cyp=y+c2.cy*sc, cxp=x+c2.cx*sc;
        const halo='paint-order:stroke;stroke:#F2F0EB;stroke-width:3px;font-size:10.5px';
        const dline=(x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#F2F0EB" stroke-width="3"/>
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#55524d" stroke-width="1" stroke-dasharray="2 2"/>`;
        inner+=`<g style="pointer-events:none">
          ${dline(x+(c2.cx-c2.w/2-cl)*sc,cyp,x+(c2.cx-c2.w/2)*sc,cyp)}<text class="dim-text" x="${x+(c2.cx-c2.w/2-cl/2)*sc}" y="${cyp-6}" text-anchor="middle" style="${halo}">${f(cl)}</text>
          ${dline(x+(c2.cx+c2.w/2)*sc,cyp,x+(c2.cx+c2.w/2+cr)*sc,cyp)}<text class="dim-text" x="${x+(c2.cx+c2.w/2+cr/2)*sc}" y="${cyp-6}" text-anchor="middle" style="${halo}">${f(cr)}</text>
          ${dline(cxp,y+(c2.cy-c2.h/2-ct)*sc,cxp,y+(c2.cy-c2.h/2)*sc)}<text class="dim-text" x="${cxp+6}" y="${y+(c2.cy-c2.h/2-ct/2)*sc+4}" style="${halo}">${f(ct)}</text>
          ${dline(cxp,y+(c2.cy+c2.h/2)*sc,cxp,y+(c2.cy+c2.h/2+cb)*sc)}<text class="dim-text" x="${cxp+6}" y="${y+(c2.cy+c2.h/2+cb/2)*sc+4}" style="${halo}">${f(cb)}</text>
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
  if(_kfgWB && !_imRender) uebersetze(svg);  /* nur die Buehne; im Render uebersetzt render() am Ende einmal fuer alles */
  svg.classList.toggle('is-drawing',!!S.draw);
  svg.querySelectorAll('.kfg_edge').forEach(e=>e.addEventListener('click',()=>cycleEdge(+e.dataset.i)));
  /* Ecke in der Vorschau anklicken = abrunden bzw. begradigen */
  svg.querySelectorAll('.kfg_cornerhit').forEach(e=>e.addEventListener('click',ev=>{
    ev.stopPropagation();
    const i=+e.dataset.c;
    if(cornerR(i)>0) setCorner(i,0);
    else setCorner(i, cornerMax()||(rules().minCorner>0?rules().minCorner:10));
    buildCorner(); render();
    toast(cornerR(i)>0?`Ecke ${cornerName(i)}: R${cornerR(i)}`:`Ecke ${cornerName(i)} wieder eckig`);
  }));

  if(S.view==='3d') draw3D();
}
/* ── Zeichnen-Werkzeug ── */
let G=null, tmpCut=null, dragCut=null, FORCE_DISTS=false, polyTmp=null, _imRender=false, _cutListBlur=false;
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
  if(c.preset==='maschine') return 'Maschine '+z(c.w)+' × '+z(c.h);
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
/* Bildschirm → viewBox ueber die echte Abbildungsmatrix. Die alte Rechnung ueber
   getBoundingClientRect ignorierte das Letterboxing (mobil aspect-ratio/max-height):
   quer aufgezogen ergab 34 statt 114 cm (Review 08.09., B3). */
function svgPt(e){
  const svg=$('stage');
  try{ const m=svg.getScreenCTM(); if(m){ const pt=svg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY; const q=pt.matrixTransform(m.inverse()); return [q.x,q.y]; } }catch(_){}
  const r=svg.getBoundingClientRect();
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
  document.querySelectorAll('#edgeChips .kfg_chip').forEach(c=>{
    const an=uniq.length===1&&c.dataset.edge===uniq[0]; c.classList.toggle('is-active',an); c.setAttribute('aria-pressed',an?'true':'false'); });
  $('edgeRadiusBlock').style.display=(S.edges.includes('rund')||S.edges.includes('halbrund'))?'block':'none';
}

/* ═══════ Detailansicht (Kanten-Foto) ═══════ */
function drawDetail(){
  const img=$('detailImg'); if(!img)return;
  const ph=edgePhoto();
  const card=$('detailCard');
  if(card && !card.open){ window.__kfgKantePend = ph.src; }   /* laden erst beim Aufklappen */
  else if(img.src !== ph.src){ img.src = ph.src; window.__kfgKantePend = null; }
  const c=calc(), m=MATERIALS[S.mat];
  const uniq=[...new Set((S.form==='round'?[S.edges[0]]:S.edges).map(edgeLabel))];
  const absNm=(ABS_STOCK.find(a=>a[0]===S.absColor)||[])[1];
  const absTxt=(S.edges.some(e=>e==='abs')&&S.absColor!=='dekor')?` · ABS ${absNm}`:'';
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
/* Verrundung einer Ecke. Die Tangentenlaenge ist t = r / tan(theta/2) — nur bei
   90 Grad ist sie gleich dem Radius. Bis v1.18.2 stand hier t = r; an flachen
   Ecken (die Schraege der L-Form) wurde der Bogen dadurch zu einer Beule, und die
   Werkstattzeichnung (die schon richtig rechnete) zeigte etwas anderes als die
   Vorschau. theta = Winkel zwischen den beiden Kanten, aus/mitte fuer Marken. */
function eckRundung(pts, rad, i){
  const n=pts.length, p=pts[i], a=pts[(i-1+n)%n], b=pts[(i+1)%n];
  const v1=[a[0]-p[0],a[1]-p[1]], v2=[b[0]-p[0],b[1]-p[1]];
  const l1=Math.hypot(v1[0],v1[1])||1, l2=Math.hypot(v2[0],v2[1])||1;
  const u1=[v1[0]/l1,v1[1]/l1], u2=[v2[0]/l2,v2[1]/l2];
  const theta=Math.acos(Math.max(-1,Math.min(1,u1[0]*u2[0]+u1[1]*u2[1])));
  const kreuz=v1[0]*v2[1]-v1[1]*v2[0], konvex=kreuz<0;   /* im Uhrzeigersinn: konvex = negativ */
  let bx=u1[0]+u2[0], by=u1[1]+u2[1]; const bl=Math.hypot(bx,by)||1; bx/=bl; by/=bl;
  let r=Math.max(0, (Array.isArray(rad)?rad[i]:rad)||0), t=0;
  if(r>0 && theta>1e-6 && Math.abs(theta-Math.PI)>1e-6){
    const th=Math.tan(theta/2); t=r/th;
    const tmax=Math.min(l1,l2)/2;                        /* laenger als die halbe Kante geht nicht */
    if(t>tmax){ t=tmax; r=t*th; }
  } else { r=0; }
  const p1=[p[0]+u1[0]*t, p[1]+u1[1]*t], p2=[p[0]+u2[0]*t, p[1]+u2[1]*t];
  /* Punkt, an dem die gerundete Kontur der Ecke am naechsten kommt (Bogenmitte) */
  const sin=Math.sin(theta/2)||1;
  const mitte = r>0 ? [p[0]+bx*(r/sin-r), p[1]+by*(r/sin-r)] : [p[0],p[1]];
  /* Winkelhalbierende nach aussen (weg vom Material) — bei konvexen Ecken zeigt bx/by nach innen */
  const aus = konvex ? [-bx,-by] : [bx,by];
  return {p1,p2,r,t,mitte,aus,sweep:konvex?1:0};
}
function roundPoly(pts, r){
  const n=pts.length, rad=Array.isArray(r)?r:pts.map(()=>r), seg=[];
  for(let i=0;i<n;i++) seg.push(eckRundung(pts, rad, i));
  let d=`M ${seg[0].p2}`;
  for(let i=1;i<=n;i++){
    const cur=seg[i%n];
    d+=` L ${cur.p1}`;
    if(cur.r>0.5) d+=` A ${cur.r} ${cur.r} 0 0 ${cur.sweep} ${cur.p2}`;
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
let three={ready:false,failed:false,laden:null,tex:{},scene:null,cam:null,renderer:null,mesh:null,rotY:-0.5,rotX:0.45,w:0,h:0};
/* Ein Ladevorgang, eine Warteschlange: vorher haengte jeder Klick waehrend des Ladens ein
   weiteres <script> ein und initialisierte drei Renderer auf derselben Canvas (Review 08.09., B7). */
function ensure3D(cb){
  if(three.ready)return cb();
  if(three.failed){ toast('3D-Ansicht ist gerade nicht verfügbar'); setView('2d'); return; }
  if(window.THREE)return init3D(cb);
  if(three.laden){ three.laden.push(cb); return; }
  three.laden=[cb];
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  s.integrity='sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu'; s.crossOrigin='anonymous';
  s.onload=()=>{ const l=three.laden||[]; three.laden=null; init3D(()=>l.forEach(f=>{ try{ f(); }catch(e){ try{ console.warn('kfg 3D', e && e.message); }catch(_){} } })); };
  s.onerror=()=>{ three.laden=null; three.failed=true; const b=$('btn3d'); if(b) b.disabled=true; toast('3D-Ansicht konnte nicht geladen werden'); setView('2d'); };
  document.head.appendChild(s);
}
function init3D(cb){
  if(three.ready) return cb();
  const canvas=$('stage3d');
  three.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  three.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));   /* scharf auf Retina */
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
  canvas.addEventListener('pointercancel',()=>drag=null);
  three.ready=true; cb();
}
/* GPU-Speicher freigeben: Materialien und Einmal-Texturen (Canvas) je Neuaufbau, Dekor-Texturen bleiben im Cache */
function entsorge3D(obj){
  if(!obj) return;
  obj.traverse?obj.traverse(o=>{ if(o.geometry) o.geometry.dispose();
    (Array.isArray(o.material)?o.material:o.material?[o.material]:[]).forEach(m=>{ if(m.map&&!m.map.kfgCache) m.map.dispose(); m.dispose(); }); }):0;
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
  /* Tangentenlaenge wie in eckRundung (r / tan(theta/2)) — sonst wird die Rundung
     an flachen Ecken zur Beule und 3D weicht von der 2D-Kontur ab. */
  const t=pts.map((p,i)=>{ const e=eckRundung(pts, rad, i); return { p, r:e.r, p1:e.p1, p2:e.p2 }; });
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
  if(S.form==='bauch'){
    const bg=bsPts(), L3=bg.L/10, B3=bg.BR/10, sh3=new THREE.Shape();
    polyToShape(sh3, bg.pts.map(([px,py])=>[-L3/2+px/10, B3/2-py/10]),
                     bg.rad.map(r=>Math.min(r/10, L3/3, B3/3)));
    addCutHoles(sh3);
    return sh3;
  }
  if(S.form==='lform'){
    const lg=lfPts(), L2=lg.L/10, B2=lg.B/10;
    const sh2=new THREE.Shape();
    /* Plattenkoordinaten (cm, y nach vorn) -> Shape (dm, y nach hinten), wie addCutHoles */
    const pts=lg.pts.map(([px,py])=>[-L2/2+px/10, B2/2-py/10]);
    const rad=lg.rad.map(r=>Math.min(r/10, L2/3, B2/3));
    polyToShape(sh2, pts, rad);
    addCutHoles(sh2);
    return sh2;
  }
  /* Der Maschinen-Ausschnitt ist seit v1.16.0 ein normaler, verschiebbarer
     Ausschnitt und kommt darum ueber addCutHoles in die 3D-Geometrie. */
  addCutHoles(sh);
  return sh;
}
/* Dekorfoto fuer 3D: Rand beschnitten (s. TEX_RAND), gespiegelt gekachelt wie in 2D */
function textur3D(key){
  const t=new THREE.Texture();
  t.encoding=THREE.sRGBEncoding; t.wrapS=t.wrapT=THREE.MirroredRepeatWrapping; t.anisotropy=8; t.kfgCache=true;   /* r128 kennt kein userData an Texturen */
  const im=new Image(); im.crossOrigin='anonymous';
  im.onload=()=>{
    try{ const w=im.naturalWidth, h=im.naturalHeight, border=ATELIER_ATLASES[key]?0:TEX_RAND, ix=Math.round(w*border), iy=Math.round(h*border);
      const c=document.createElement('canvas'); c.width=w-2*ix; c.height=h-2*iy;
      c.getContext('2d').drawImage(im, ix, iy, c.width, c.height, 0, 0, c.width, c.height);
      t.image=c; }
    catch(_){ t.image=im; }
    t.needsUpdate=true; frame3D();
  };
  im.src=ATELIER_ATLASES[key]?.src||TEX[key];
  return t;
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
/* Massband als Textur: Striche je cm, Zahlen alle 10 cm. Beim Aufkleber haengen
   die Striche von der Oberkante des Bandes, beim gelaserten stehen sie auf der
   Vorderkante der Platte. */
function massbandTextur(len, rechts, aufkleber){
  const cv=document.createElement('canvas'), pxCm=24; cv.width=Math.max(48,Math.round(len*pxCm)); cv.height=96;
  const g=cv.getContext('2d');
  if(aufkleber){ g.fillStyle='#f4f0e6'; g.fillRect(0,0,cv.width,cv.height); }
  g.strokeStyle='#1E1E1E'; g.fillStyle='#1E1E1E'; g.textAlign='center'; g.textBaseline='middle';
  g.font='600 26px system-ui, Arial, sans-serif';
  for(let cm=0; cm<=len; cm++){
    const xx=(rechts?len-cm:cm)*pxCm, gross=cm%10===0, mittel=cm%5===0, h=gross?50:(mittel?34:20);
    g.lineWidth=gross?3:1.5; g.beginPath();
    if(aufkleber){ g.moveTo(xx,0); g.lineTo(xx,h); } else { g.moveTo(xx,cv.height); g.lineTo(xx,cv.height-h); }
    g.stroke();
    if(gross){ let tx=xx; if(cm===0) tx+=rechts?-14:14; else if(cm===len) tx+=rechts?14:-14;
      g.fillText(String(cm), tx, aufkleber?cv.height-24:24); }
  }
  const t=new THREE.CanvasTexture(cv); t.encoding=THREE.sRGBEncoding; t.anisotropy=8;
  t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping; return t;
}
function massband3D(depth){
  const st=massbandStrecke(); if(!st) return null;
  const d=dims(), W=d.w/10, H=d.h/10, len=st.len/10, cx=-W/2+(st.x0+st.len/2)/10;
  const aufkleber=S.massband==='sticker';
  const tex=massbandTextur(st.len, st.rechts, aufkleber);
  if(aufkleber){
    const hb=Math.min(0.15, depth*0.75);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(len,hb), new THREE.MeshStandardMaterial({map:tex,roughness:.7}));
    /* Platte liegt zwischen y=depth (unten) und y=2*depth (oben), s. kanal3D */
    m.position.set(cx, 1.5*depth, H/2+0.003);                            /* Stirnseite, vorn */
    return m;
  }
  const bw=0.16;                                                       /* 1,6 cm breit */
  const m=new THREE.Mesh(new THREE.PlaneGeometry(len,bw), new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
  m.rotateX(-Math.PI/2); m.position.set(cx, 2*depth+0.003, H/2-bw/2-0.01);  /* Oberseite, an der Vorderkante */
  return m;
}
function draw3D(){
  ensure3D(()=>{
    if(three.mesh){three.scene.remove(three.mesh);entsorge3D(three.mesh);three.mesh=null;}
    if(three.kanal){three.scene.remove(three.kanal);entsorge3D(three.kanal);three.kanal=null;}
    if(three.band){three.scene.remove(three.band);entsorge3D(three.band);three.band=null;}
    const depth=(+S.thick)/100;
    const geo=new THREE.ExtrudeGeometry(plateShape(),{depth,bevelEnabled:false,curveSegments:48});
    /* UV-Fix: Deckflächen sauber [0..1] gemappt, Proportionen über max(B,T) — kein Kacheln, kein Zerren */
    { const d2=dims(), M=Math.max(d2.w,d2.h)/10;
      const pos=geo.attributes.position, uv=geo.attributes.uv;
      const atlas=ATELIER_ATLASES[texKey()], uw=atlas?atlas.widthCm/10:M, uh=atlas?atlas.heightCm/10:M;
      for(let i=0;i<uv.count;i++) uv.setXY(i, pos.getX(i)/uw+0.5, pos.getY(i)/uh+0.5);
      uv.needsUpdate=true; }
    geo.rotateX(-Math.PI/2); geo.translate(0,depth,0);
    const key=texKey();
    let topMat;
    if(isLack()) topMat=new THREE.MeshStandardMaterial({color:0xdcd9d2,roughness:.5});
    else{
      let t=three.tex[key];
      if(!t){ t=textur3D(key); three.tex[key]=t; }
      /* UV laeuft 0..1 ueber die laengere Seite (M dm); eine Kachel ist texCm() breit */
      { const M=Math.max(dims().w,dims().h)/10, n=texCm()?M/(texCm()/10):1; t.repeat.set(n,n);
        const wrap=texCm()?THREE.MirroredRepeatWrapping:THREE.ClampToEdgeWrapping; if(t.wrapS!==wrap){ t.wrapS=t.wrapT=wrap; t.needsUpdate=true; } }
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
    three.band=massband3D(depth);
    if(three.band) three.scene.add(three.band);
    const d=dims(), maxd=Math.max(d.w,d.h)/10;
    three.cam.position.set(0, maxd*0.9, maxd*1.55); three.cam.lookAt(0,0,0);
    frame3D();
  });
}
function frame3D(){
  if(!three.ready||!three.mesh)return;
  const canvas=$('stage3d');
  if(canvas.clientWidth&&(three.w!==canvas.clientWidth||three.h!==canvas.clientHeight)){three.w=canvas.clientWidth;three.h=canvas.clientHeight;
    three.renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
    three.cam.aspect=canvas.clientWidth/canvas.clientHeight;three.cam.updateProjectionMatrix();}
  three.mesh.rotation.y=three.rotY;
  three.mesh.rotation.x=0; three.scene.rotation.x=three.rotX-0.45;
  three.renderer.render(three.scene,three.cam);
}
function setView(v){
  if(v==='3d'&&three.failed){ toast('3D-Ansicht ist gerade nicht verfügbar'); v='2d'; }
  S.view=v;
  $('btn2d').classList.toggle('is-active',v==='2d'); $('btn2d').setAttribute('aria-pressed',v==='2d'?'true':'false');
  $('btn3d').classList.toggle('is-active',v==='3d'); $('btn3d').setAttribute('aria-pressed',v==='3d'?'true':'false');
  $('stage').style.display=v==='2d'?'block':'none';
  $('stage3d').style.display=v==='3d'?'block':'none';
  $('previewHint').textContent=v==='2d'?'Draufsicht, maßstabsgetreu · Kanten anklickbar':'3D-Ansicht · ziehen zum Drehen';
  if(v==='3d') draw3D();
}

/* ═══════ UI-Aufbau ═══════ */
/* Unterzeile der Materialkarte: "ab <kleinster Katalogpreis im Kanal> · …" — die feste
   EUR-Angabe stand auf der polnischen Seite neben zl-Preisen (Review 08.09., C9). */
function matSub(k,m){
  let min=null; const pre=k+'|';
  for(const key in SHOP){ if(!key.startsWith(pre)) continue; const v=hitPreis(SHOP[key]); if(v!=null&&(min===null||v<min)) min=v; }
  if(min===null) return m.sub;
  const rest=m.sub.replace(/^ab [^·]+· /,'');
  return `ab ${fmt(min)} · ${rest}`;
}
function buildMats(){
  $('matGrid').innerHTML=Object.entries(MATERIALS).map(([k,m])=>
    `<button class="kfg_mat${k===S.mat?' is-active':''}" aria-pressed="${k===S.mat}" data-m="${k}"><b>${m.name}</b><small>${matSub(k,m)}</small></button>`).join('');
  $('matGrid').querySelectorAll('.kfg_mat').forEach(b=>b.addEventListener('click',()=>{
    S.mat=b.dataset.m; S.thick=MATERIALS[S.mat].def;
    if(S.mat==='mpx'){S.mpxSurface='natur';S.dekor='sperrholz-natur';}
    else if(!MATERIALS[S.mat].dekore.some(d=>d[0]===S.dekor)) S.dekor=MATERIALS[S.mat].dekore[0][0];
    if(S.mat==='szwal'){
      if(S.form==='round') setForm('rect');           /* Rund gibt es nicht, L-Form schon (02.09.) */
      /* Schritt 05 kennt bei Naehtischplatten nur Montagebohrung und
         Maschinen-Ausschnitt — alles andere faellt beim Wechsel weg. */
      S.cuts=S.cuts.filter(c=>c.preset==='maschine');
      S.extras.custom=false;
      seedMaschine();
    } else {
      S.massband='none'; S.machine='';
      S.cuts=S.cuts.filter(c=>c.preset!=='maschine');
    }
    const be=baseEdge(); S.edges=[be,be,be,be];
    S.cornerR=S.cornerR.map(r=>clampCorner(r)); S.corner=cornerMax();
    ga('kfg_material',{material:S.mat}); clampDims(); buildAll(); render();
  }));
}
const DEKOR_ALIAS = { 'eiche-kamienny':'hikora', 'asche-grau':'szary' };   /* zusammengefuehrte Dekore */
function ensureDekor(){
  /* Schutz: haelt S.dekor immer innerhalb der aktuell gueltigen Liste.
     Vorher konnte der angezeigte Dekorname vom markierten Swatch abweichen. */
  if(hasOwn(DEKOR_ALIAS,S.dekor)) S.dekor=DEKOR_ALIAS[S.dekor];
  const l=dekorList(); if(!l.length) return;
  if(!l.some(x=>x[0]===S.dekor)) S.dekor=l[0][0];
}
function buildDekore(){
  ensureDekor();
  const list=dekorList();
  $('dekorGrid').innerHTML=list.map(([k,n])=>
    `<button class="kfg_dekor${k===S.dekor?' is-active':''}" aria-pressed="${k===S.dekor}" data-d="${k}" title="${n}"><span class="sw" style="background-image:url(${TEX_THUMB[k]})"></span><span>${n}</span></button>`).join('');
  $('dekorGrid').querySelectorAll('.kfg_dekor').forEach(b=>b.addEventListener('click',()=>{
    S.dekor=b.dataset.d; buildDekore(); render();
  }));
  $('mpxSurfaceBlock').style.display=S.mat==='mpx'?'block':'none';
  const dn=$('dekorNote'); if(dn) dn.textContent = (S.mat==='mpx'&&S.mpxSurface==='hpl')
    ? 'Auf Multiplex lässt sich jedes Laminat unserer Möbelplatten-Palette aufkleben, die Kante bleibt sichtbare Birkenschicht.'
    : 'Original-Produktfotos aus dem Kessler-Archiv. Farbige ABS-Kanten sind für 18 und 25 mm verfügbar.';
}
function buildThick(){
  $('thickChips').innerHTML=MATERIALS[S.mat].thick.map(([v,lab])=>
    `<button class="kfg_chip${v===S.thick?' is-active':''}" aria-pressed="${v===S.thick}" data-t="${v}">${lab}</button>`).join('');
  $('thickChips').querySelectorAll('.kfg_chip').forEach(b=>b.addEventListener('click',()=>{
    S.thick=b.dataset.t; buildThick(); buildAbs(); render();
  }));
}
function buildAbs(){
  const el=$('absChips'); if(!el)return;
  const limited=!(S.thick==='18'||S.thick==='25');
  if(limited&&ABS_LIMITED.includes(S.absColor)) S.absColor='dekor';
  el.innerHTML=ABS_STOCK.filter(([k])=>!(limited&&ABS_LIMITED.includes(k))).map(([k,n,note])=>
    `<button class="kfg_chip${S.absColor===k?' is-active':''}" aria-pressed="${S.absColor===k}" data-abs="${k}">${
      k==='dekor'?'':`<span style="width:14px;height:14px;border-radius:3px;display:inline-block;background:${ABS_COL[k]};border:1px solid #00000022"></span>`
    }${n}${note?` <small>${note}</small>`:''}</button>`).join('');
  el.querySelectorAll('.kfg_chip').forEach(b=>b.addEventListener('click',()=>{
    S.absColor=b.dataset.abs; buildAbs(); render();
  }));
}
function buildEdges(){
  normEdges();
  $('edgeChips').innerHTML=EDGEPROFILES[S.mat].map(p=>
    `<button class="kfg_chip${S.edges.every(e=>e===p[0])?' is-active':''}" aria-pressed="${S.edges.every(e=>e===p[0])}" data-edge="${p[0]}">${p[1]} <small>${edgeNote(p)}</small></button>`).join('');
  $('edgeChips').querySelectorAll('.kfg_chip').forEach(b=>b.addEventListener('click',()=>{
    const p=b.dataset.edge; S.edges=[p,p,p,p]; buildEdgeExtras(); syncEdgeChips(); render();
  }));
  $('mpxNote').style.display=(S.mat==='mpx'||S.mat==='szwal')?'block':'none';
  const tip=$('edgeTip'); if(tip) tip.style.display=EDGEPROFILES[S.mat].length>1?'flex':'none';
  buildEdgeExtras();
  syncEdgeChips();
}
/* ABS-Farbe, Lackierung und Massband haengen alle an der gewaehlten Kante und
   stehen deshalb seit v1.16.0 in Schritt 04 statt in Schritt 01 (Senior 30.07.). */
function buildEdgeExtras(){
  const b1=$('absColorBlock');
  if(b1) b1.style.display=S.edges.some(e=>e==='abs')?'block':'none';
  const b2=$('lackBlock');
  if(b2){
    const zeig=(S.mat==='mpx'||S.mat==='szwal')&&S.edges.some(e=>e!=='abs');
    b2.style.display=zeig?'block':'none';
    if(!zeig) S.extras.lack=false;
    const inp=b2.querySelector('input');
    if(inp){ inp.checked=!!S.extras.lack;
      inp.closest('.kfg_check').classList.toggle('is-active',!!S.extras.lack); }
    /* Der Preis haengt am gewaehlten Profil — mitfuehren statt "Angebot". */
    const pr=b2.querySelector('.pr');
    if(pr){ const e=S.edges.find(x=>x!=='abs')||'nicht';
      pr.textContent = LACK_LFM[e]!==undefined ? `${fmt(zl(LACK_LFM[e]))}/lfm` : 'auf Anfrage'; }
  }
  const b3=$('massbandBlock');
  if(b3){ b3.style.display=S.mat==='szwal'?'block':'none'; if(S.mat==='szwal') buildMassband(); }
}
function buildMassband(){
  const el=$('massbandChips'); if(!el) return;
  el.innerHTML=MASSBAND.map(([k,n,note,pr])=>
    `<button class="kfg_chip${S.massband===k?' is-active':''}" aria-pressed="${S.massband===k}" data-mb="${k}">${n}${pr?` <small>+ ${fmt(zl(pr))}</small>`:''}</button>`).join('');
  el.querySelectorAll('.kfg_chip').forEach(b=>b.addEventListener('click',()=>{
    S.massband=b.dataset.mb; buildMassband(); render();
  }));
  /* Nullpunkt links oder rechts — beides moeglich (Sascha 02.09.) */
  const nz=$('massbandNullChips'), note=$('massbandNote'), an=S.massband!=='none';
  if(nz){ nz.style.display=an?'':'none';
    nz.innerHTML=[['links','Nullpunkt links'],['rechts','Nullpunkt rechts']].map(([k,n])=>
      `<button class="kfg_chip${(S.massbandNull||'links')===k?' is-active':''}" data-mn="${k}">${n}</button>`).join('');
    nz.querySelectorAll('.kfg_chip').forEach(b=>b.addEventListener('click',()=>{ S.massbandNull=b.dataset.mn; buildMassband(); render(); })); }
  if(note){ note.style.display=an?'':'none';
    const st=massbandStrecke();
    note.innerHTML='<span>'+(S.massband==='sticker'
      ? 'Die Aufkleberkante sitzt auf der Stirnseite der Vorderkante — in der Draufsicht nur als Linie markiert, in der 3D-Ansicht sichtbar.'
      : 'Das gelaserte Maßband liegt auf der Oberseite entlang der Vorderkante.')
      +'</span> <span>Es ist höchstens 100 cm lang und endet vor den Eckradien.</span>'
      +(st?` <span>Länge hier: ${st.len} cm</span>`:''); }
}
/* Nutzbare Strecke des Massbands an der Vorderkante (cm, Plattenkoordinaten):
   die laengste gerade Vorderkante, abzueglich der beiden Eckradien und je 1 cm
   Luft, gedeckelt auf 100 cm (Senior 02.09.: "nicht laenger als ein Meter, und
   nie ueber den Radius hinaus"). */
function massbandStrecke(){
  if(S.mat!=='szwal'||S.massband==='none'||S.form==='round') return null;
  const d=dims(); let pts, rad;
  const fp=formPts();
  if(fp){ pts=fp.pts; rad=fp.rad.slice(); }
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
/* Draufsicht: gelasert = Striche auf der Oberseite; Aufkleber = nur eine Linie
   an der Kante, denn er sitzt auf der Stirnseite und ist von oben nicht zu sehen. */
function massbandSVG(x,y,sc,pw,ph){
  const st=massbandStrecke(); if(!st) return '';
  const xs=cm=>x+(st.rechts?st.x0+st.len-cm:st.x0+cm)*sc;
  let out='';
  if(S.massband==='laser'){
    const yB=y+ph-Math.max(5,1.6*sc);
    const lang=Math.max(5,0.9*sc), kurz=Math.max(2.5,0.45*sc);
    const schritt = 1*sc>=2.2 ? 1 : (5*sc>=2.2 ? 5 : 10);
    for(let cm=0; cm<=st.len+0.001; cm+=schritt){
      const gross=Math.round(cm)%10===0;
      out+=`<line x1="${xs(cm)}" y1="${yB}" x2="${xs(cm)}" y2="${yB-(gross?lang:kurz)}"
        stroke="#1E1E1E" stroke-width="${gross?1:0.6}" opacity="${gross?'.85':'.45'}"/>`;
    }
    const beschr=Math.max(10, Math.ceil(26/Math.max(1,10*sc))*10);
    for(let cm=0; cm<=st.len+0.001; cm+=beschr){
      /* Erste und letzte Zahl nach innen ziehen, sonst haengen sie ueber dem Bandende. */
      const letzte = cm+beschr > st.len;
      const innen = (cm===0) !== st.rechts;               /* Nullpunkt links → erste Zahl nach rechts ruecken */
      const anker = cm===0||letzte ? (innen?'start':'end') : 'middle';
      const dx = cm===0||letzte ? (innen?2:-2) : 0;
      out+=`<text class="dim-text" x="${xs(cm)+dx}" y="${yB-lang-2}" text-anchor="${anker}"
        style="font-size:9px;font-weight:500;stroke-width:2px">${cm}</text>`;
    }
  } else {
    const x1=x+st.x0*sc, x2=x+(st.x0+st.len)*sc, yB=y+ph;
    out+=`<line x1="${x1}" y1="${yB-1.5}" x2="${x2}" y2="${yB-1.5}" stroke="#1E1E1E" stroke-width="1.2" stroke-dasharray="3 2" opacity=".8"/>`;
    out+=`<text class="dim-text" x="${(x1+x2)/2}" y="${yB-6}" text-anchor="middle" style="font-size:9px;font-weight:500;stroke-width:2px">Maßband auf der Kante · ${st.len} cm</text>`;
  }
  return `<g style="pointer-events:none">${out}</g>`;
}
/* Legt den Maschinen-Ausschnitt an, wenn noch keiner da ist. Wird beim Wechsel
   auf die Naehtischplatte und beim Start aus einem geteilten Link gerufen —
   ohne das kam ueber einen Link eine Naehtischplatte ganz ohne Ausschnitt an. */
const MASCHINE_MASSE = {'48x18.1':[48,18.1], '52x18.1':[52,18.1], '61.7x18.1':[61.7,18.1], 'auto':[52,18.1]};
function maschineMass(){ return MASCHINE_MASSE[S.maschineMass]||MASCHINE_MASSE['52x18.1']; }
/* Vorgabe-Lage: vorne mittig; bei der L-Form mit Ausklinkung vorn hinter der
   Ausklinkung (dort sitzt die Naeherin, die Maschine steht vor ihr). */
function maschineStart(){
  const d=dims(), [w,h]=maschineMass();
  if(S.form==='bauch'){ const g=bsGeo(), m=bsCenter();
    return [Math.max(w/2,Math.min(d.w-w/2,m[0])), Math.max(h/2, d.h-g.t-h/2-5)]; }
  if(S.form==='lform'){ const g=lfPts(), nc=lfNotchCenter(), vorn=(g.pos==='vr'||g.pos==='vl');
    if(vorn) return [Math.max(w/2,Math.min(d.w-w/2,nc[0])), Math.max(h/2, d.h-g.ah-h/2-5)];
    return [Math.max(w/2,Math.min(d.w-w/2,nc[0])), Math.max(h/2, d.h-15)];
  }
  return [Math.max(w/2,d.w/2), Math.max(h/2,d.h-15)];
}
function seedMaschine(){
  if(S.mat!=='szwal' || presetCount('maschine')) return;
  const [w,h]=maschineMass(), [cx,cy]=maschineStart();
  S.cuts.push({t:'r',preset:'maschine',w,h,cx,cy});
}
/* Standardmass-Chips: Wahl schreibt ins vorhandene Ausschnitt-Objekt */
function buildMaschineMass(){
  document.querySelectorAll('#maschineMassChips .kfg_chip').forEach(b=>b.classList.toggle('is-active',b.dataset.mm===S.maschineMass));
}
document.querySelectorAll('#maschineMassChips .kfg_chip').forEach(b=>b.addEventListener('click',()=>{
  S.maschineMass=b.dataset.mm; const [w,h]=maschineMass();
  S.cuts.filter(c=>c.preset==='maschine').forEach(c=>{ c.w=w; c.h=h; });
  buildMaschineMass(); render();
}));
/* Naehtischplatte: Rechteck und L-Form (Senior 02.09.: "L-Form ist sehr
   haeufig"), kein Rund. */
function syncFormChips(){
  document.querySelectorAll('#formChips .kfg_chip').forEach(b=>{
    b.style.display=(S.mat==='szwal'&&b.dataset.form==='round')?'none':'';
  });
  if(S.mat==='szwal'&&S.form==='round') S.form='rect';
}
/* Lage-, Schnitt- und Winkel-Steuerung der L-Form */
function buildLfControls(){
  const pc=$('lfPosChips'); if(!pc) return;
  const pos=lfPos();
  pc.innerHTML=lfPosListe().map(([k,n])=>`<button class="kfg_chip${pos===k?' is-active':''}" aria-pressed="${pos===k}" data-lp="${k}">${n}</button>`).join('');
  pc.querySelectorAll('.kfg_chip').forEach(b=>b.addEventListener('click',()=>{ S.lf.pos=b.dataset.lp; render(); }));
  document.querySelectorAll('#lfCutChips .kfg_chip').forEach(b=>b.classList.toggle('is-active',(b.dataset.ls==='schraeg')===lfSchraeg()));
  const fw=$('fLW'); if(fw) fw.style.display=lfSchraeg()?'':'none';
  const iw=$('inLW'); if(iw){ iw.max=lfWinkelMax(); if(document.activeElement!==iw) iw.value=lfWinkel(); }
  /* Bereich und Folge fuer A: der Kunde sieht sofort, wie weit A nach innen rueckt und was von A–C gerade bleibt */
  const rw=$('rangeLW'); if(rw && lfSchraeg()){ const g=lfGeo();
    rw.textContent=`91 bis ${lfWinkelMax()}° — bei Punkt B zwischen Plattenkante und Schräge · 90° = gerade · A–C bleibt ${Math.round(g.ac)} cm gerade`; }
  const note=$('lfInnerNote'); if(note){ const r=lfMinR()*10, abs=S.edges[0]==='abs';
    note.textContent=(lfSchraeg()
      ? `Die Schräge läuft von B (Plattenkante) nach A; A und B werden automatisch verrundet: R${r} — ${abs?'ABS-Kante geklebt':'Kante ohne ABS'} (Fertigungsregel).`
      : `Innenecke wird automatisch verrundet: R${r} — ${abs?'ABS-Kante geklebt':'Kante ohne ABS'} (Fertigungsregel).`); }
}
/* Steuerung des Bauchausschnitts: Zweiwegbindung zwischen B und Tiefe, Haekchen
   fuer "mittig", und ein Hinweis, welches Feld gerade errechnet wird. */
function bsAbgeleitet(){
  /* Welches Feld folgt aus den anderen? Bei der Welle keines: A, B und Tiefe
     stehen fuer sich, die Oeffnung ergibt sich. */
  if(bsWelle()) return S.bs.mittig ? 'b' : '';
  if(bsSenkrecht()) return 'b';
  if(S.bs.mittig) return S.bs.treiber==='t' ? 'a' : 't';
  return S.bs.treiber==='t' ? 'b' : 't';
}
function buildBsControls(){
  const box=$('dimsBauch'); if(!box) return;
  const g=bsGeo(), r=rules(), ab=bsAbgeleitet(), z=v=>(''+(Math.round(v*10)/10)).replace('.',',');
  const set=(id,v)=>{ const el=$(id); if(el&&document.activeElement!==el) el.value=v; };
  set('inBsL',S.bs.L); set('inBsBR',S.bs.BR); set('inBsC',S.bs.c);
  set('inBsW1',g.w1); set('inBsW2',g.w2);
  set('inBsA',Math.round(g.a*10)/10); set('inBsB',Math.round(g.b*10)/10); set('inBsT',Math.round(g.t*10)/10);
  const cb=$('inBsM'); if(cb) cb.checked=!!S.bs.mittig;
  /* Schnittart: Trapez (gerade Schraegen) oder Welle (Kosinusmulde) */
  document.querySelectorAll('#bsArtChips .kfg_chip').forEach(btn=>{
    const an=(btn.dataset.ba==='welle')===bsWelle();
    btn.classList.toggle('is-active',an); btn.setAttribute('aria-pressed',an?'true':'false'); });
  ['fBsC','fBsW1','fBsW2'].forEach(id=>{ const el=$(id); if(el) el.style.display=bsWelle()?'none':''; });
  /* NUR B ist gesperrt, und nur wenn es gar nicht frei sein KANN: mittig laeuft
     es mit A mit, bei zwei senkrechten Schnitten folgt es aus A und C. Das
     errechnete Feld bleibt sonst beschreibbar — wer es anfasst, dreht die
     Rechenrichtung um. Genau das ist die Zweiwegbindung. */
  const bEl=$('inBsB'); if(bEl) bEl.readOnly=bsBGebunden();
  const aEl=$('inBsA'); if(aEl) aEl.readOnly=false;
  const tEl=$('inBsT'); if(tEl) tEl.readOnly=false;
  const hin=(fid,rid,an,txt)=>{ const f=$(fid), s=$(rid);
    if(f) f.classList.toggle('is-abgeleitet',!!an);
    if(s) s.textContent=txt; };
  const tMax=Math.max(1, Math.round((g.BR-BS_REST)*10)/10);
  if(bsWelle()){
    hin('fBsA','rangeBsA', false, 'gerades Stück der Vorderkante links von der Mulde');
    hin('fBsB','rangeBsB', !!S.bs.mittig, S.bs.mittig?'läuft mit A mit':'gerades Stück der Vorderkante rechts von der Mulde');
    hin('fBsT','rangeBsT', false, `1 bis ${z(tMax)} cm — tiefste Stelle in der Mitte`);
    const note2=$('bsNote');
    if(note2){ const teile=[`Die Mulde läuft an beiden Enden tangential aus der Vorderkante heraus — keine Ecke, nichts zu verrunden.`,
        `Öffnung an der Vorderkante ${z(g.oeffnung)} cm · Schnittlänge ${bsSchnittCm()} cm.`];
      if(!BS_WORKER_BEREIT) teile.push('Der Preis steht fest. Diese Form geben wir vor der Fertigung noch von Hand frei — dein verbindliches Angebot kommt innerhalb von 24 Stunden.');
      note2.innerHTML=teile.map(t=>`<span>${t}</span>`).join(' '); }
    return;
  }
  hin('fBsA','rangeBsA', ab==='a', ab==='a'
      ? 'errechnet — mittig aus Länge, C und Tiefe'
      : 'gerades Stück der Vorderkante links vom Ausschnitt');
  hin('fBsB','rangeBsB', ab==='b', ab==='b'
      ? (S.bs.mittig?'läuft mit A mit':'errechnet — A + B + C und die Schrägen ergeben die Länge')
      : 'gerades Stück der Vorderkante rechts vom Ausschnitt');
  hin('fBsC','rangeBsC', false, `mindestens ${BS_MIN_C} cm · Grund des Ausschnitts, parallel zur Vorderkante`);
  hin('fBsT','rangeBsT', ab==='t', ab==='t'
      ? 'errechnet aus A, B, C und den beiden Winkeln'
      : `1 bis ${z(tMax)} cm`);
  hin('fBsW1','rangeBsW1', false, '90 bis 179° — 90° = senkrechter Schnitt · 135° = Vorlauf gleich Tiefe');
  hin('fBsW2','rangeBsW2', false, '90 bis 179° — am rechten Ende von C');
  const note=$('bsNote');
  if(note){
    const rr=lfMinR()*10, abs=S.edges[0]==='abs';
    const teile=[`Die beiden Innenecken werden automatisch verrundet: R${rr} — ${abs?'ABS-Kante geklebt':'Kante ohne ABS'} (Fertigungsregel).`];
    if(g.w1>90.5||g.w2>90.5) teile.push(`Auch die äußeren Ausschnittecken an der Schräge bekommen mindestens R${rr}.`);
    if(g.senkrecht) teile.push('Zwei senkrechte Schnitte: A + B + C ergeben zusammen die Länge, die Tiefe ist frei.');
    teile.push(`Öffnung an der Vorderkante ${z(g.oeffnung)} cm · Schnittlänge ${bsSchnittCm()} cm.`);
    if(!BS_WORKER_BEREIT) teile.push('Der Preis steht fest. Diese Form geben wir vor der Fertigung noch von Hand frei — dein verbindliches Angebot kommt innerhalb von 24 Stunden.');
    note.innerHTML=teile.map(t=>`<span>${t}</span>`).join(' ');
  }
}
/* Ein Feld schreiben und dabei festhalten, welches Mass der Kunde zuletzt
   selbst gesetzt hat — daraus folgt, welches Feld errechnet wird. */
function bsFeld(key, wert, treiber){
  S.bs[key]=wert;
  if(treiber) S.bs.treiber=treiber;
  render();
}
function bindBsFelder(){
  const num=(el,min,max)=>Math.max(min,Math.min(max,+el.value||0));
  const spaet=(el,fn)=>{ let T; el.addEventListener('input',()=>{ clearTimeout(T); T=setTimeout(fn,300); });
    el.addEventListener('change',()=>{ clearTimeout(T); fn(); }); };
  const f=(id,fn)=>{ const el=$(id); if(el) spaet(el,()=>fn(el)); };
  f('inBsL', el=>bsFeld('L', num(el,20,400)));
  f('inBsBR',el=>bsFeld('BR',num(el,20,400)));
  f('inBsC', el=>bsFeld('c', num(el,1,400)));
  f('inBsA', el=>bsFeld('a', num(el,0,400), 'b'));
  f('inBsB', el=>{ if(el.readOnly) return; bsFeld('b', num(el,0,400), 'b'); });
  f('inBsT', el=>bsFeld('t', num(el,0.1,400), 't'));
  f('inBsW1',el=>bsFeld('w1',num(el,90,179)));
  f('inBsW2',el=>bsFeld('w2',num(el,90,179)));
  document.querySelectorAll('#bsArtChips .kfg_chip').forEach(btn=>btn.addEventListener('click',()=>{
    const welle=btn.dataset.ba==='welle';
    if(welle===bsWelle()) return;
    /* Beim Wechsel bleibt die Mulde so tief und so breit, wie sie war: aus dem
       Trapez wird die Oeffnung uebernommen (A und B stehen ja schon), aus der
       Welle wird C aus der Oeffnung zurueckgerechnet. */
    if(welle){ S.bs.art='welle'; }
    else { const g=bsGeo(); S.bs.art='trapez'; S.bs.treiber='t';
      S.bs.c=Math.max(BS_MIN_C, Math.round((g.oeffnung-2*g.t)*10)/10); }
    buildCorner(); render();
  }));
  const cb=$('inBsM');
  if(cb) cb.addEventListener('change',()=>{
    /* Mittig setzen laesst die Groesse des Ausschnitts stehen und rueckt ihn nur
       in die Mitte — deshalb treibt danach die Tiefe. */
    if(cb.checked && !bsSenkrecht()){ S.bs.t=Math.round(bsGeo().t*10)/10; S.bs.treiber='t'; }
    S.bs.mittig=cb.checked;
    buildCorner(); render();
  });
}
/* Schritt 05 haelt bei Naehtischplatten nur Montagebohrung und Maschinen-
   Ausschnitt bereit (Senior 30.07.) — Kuechenausschnitte, Kabeldurchlaesse,
   eigene Skizze und das freie Zeichnen sind dort nicht vorgesehen. */
function syncStep5(){
  const nt=S.mat==='szwal';
  const zeig=(id,v)=>{ const e=$(id); if(e) e.style.display=v?'':'none'; };
  zeig('grpMaschine',nt); zeig('grpDurchlass',!nt); zeig('grpKueche',!nt);
  zeig('grpCustom',!nt); zeig('grpFrei',!nt);
  const mi=$('machineInput');
  if(mi && document.activeElement!==mi && mi.value!==(S.machine||'')) mi.value=S.machine||'';
  const bm=$('btnMaschine');
  if(bm) bm.textContent=presetCount('maschine')?'Maschinen-Ausschnitt entfernen':'Maschinen-Ausschnitt hinzufügen';
  buildMaschineMass();
}
function buildCorner(){
  const r=rules();
  const opts=r.minCorner>0?[[0,'Eckig','Standard'],[30,'R30',''],[50,'R50',''],[100,'R100','']]
                          :[[0,'Eckig','Standard'],[3,'R3',''],[10,'R10',''],[30,'R30','']];
  $('cornerChips').innerHTML=opts.map(([v,l,s])=>
    `<button class="kfg_chip${cornerIdx().every(i=>cornerR(i)===v)?' is-active':''}" aria-pressed="${cornerIdx().every(i=>cornerR(i)===v)}" data-c="${v}">${l}${s?` <small>${s}</small>`:''}</button>`).join('');
  $('cornerChips').querySelectorAll('.kfg_chip').forEach(b=>b.addEventListener('click',()=>{
    setAllCorners(+b.dataset.c);
    buildCorner(); render();
  }));
  buildCornerSel();
  const note=$('cornerRule');
  const lformNote = S.form==='lform'
    ? (lfSchraeg() ? 'L-Form: fünf Außenecken, jede einzeln wählbar. Beim schrägen Schnitt werden A und B nach Fertigungsregel automatisch verrundet.'
                   : 'L-Form: fünf Außenecken, jede einzeln wählbar. Die Innenecke wird nach Fertigungsregel automatisch verrundet.')
    : '';
  const bauchNote = S.form==='bauch'
    ? 'Bauchausschnitt: sechs Außenecken, jede einzeln wählbar. Die beiden Innenecken am Grund des Ausschnitts werden nach Fertigungsregel automatisch verrundet.'
    : '';
  const teile=[lformNote, bauchNote, r.minCorner>0?r.cornerNote:''].filter(Boolean);
  note.style.display=teile.length?'block':'none';
  note.innerHTML=teile.map(t=>`<span>${t}</span>`).join(' ');   /* je Satz ein Textknoten — sonst findet die Uebersetzung den Satz nicht */
}
/* Kleines Icon: Quadrat, bei dem genau die gemeinte Ecke gerundet ist */
function radiusField(i,val,on){
  const lf=S.form==='lform'||S.form==='bauch';
  return `<label class="kfg_radcell${on?' is-on':''}">`
    +(lf?`<span class="nm">${cornerName(i)}</span>`:cornerIcon(i,on))
    +`<input type="number" inputmode="numeric" min="0" max="300" step="1" value="${val||''}" placeholder="0" data-cr="${i}"
       aria-label="Radius ${cornerName(i)}"><span class="u">mm</span></label>`;
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
  const all=cornerMax(), gleich=cornerIdx().every(i=>cornerR(i)===all);
  /* Kopfzeile = verknuepfter Wert fuer alle vier Ecken, darunter die 2x2-Felder
     in derselben Anordnung wie auf der Platte (Draufsicht). */
  el.innerHTML=`<label class="kfg_radall${gleich?' is-linked':''}">`
      +`<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="${roundPath(2,2,16,16,[6,6,6,6])}" fill="none" stroke="#1E1E1E" stroke-width="1.7"/></svg>`
      +`<input type="number" inputmode="numeric" min="0" max="300" step="1" value="${gleich&&all?all:''}" placeholder="${gleich?'0':'—'}" data-cr="all" aria-label="Radius alle Ecken"><span class="u">mm</span>`
      +`<em>${gleich?'alle Ecken':'gemischt'}</em></label>`
    /* Anordnung wie auf der Platte: oben hinten links|rechts, unten vorne links|rechts.
       Die Datenreihenfolge laeuft im Uhrzeigersinn (…,vorne rechts,vorne links),
       fuer die Anzeige werden die unteren beiden daher getauscht. */
    +(S.form==='lform'||S.form==='bauch'
        /* L-Form und Bauchausschnitt: alle Aussenecken in Umlaufrichtung, jede mit ihrem Namen */
        ? `<div class="kfg_radlist">`+formPts().ord.filter(o=>o>=0).map(o=>radiusField(o,cornerR(o),cornerR(o)>0)).join('')+`</div>`
        : `<div class="kfg_radquad">`+[0,1,3,2].map(i=>radiusField(i,cornerR(i),cornerR(i)>0)).join('')+`</div>`);
  el.querySelectorAll('input[data-cr]').forEach(inp=>{
    const apply=()=>{
      const v=+inp.value||0;
      if(inp.dataset.cr==='all') setAllCorners(v);
      else setCorner(+inp.dataset.cr, v);
      buildCorner(); render();
    };
    inp.addEventListener('change',apply);
    inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); apply(); }});
  });
}
function buildQuick(){
  if(S.mat==='szwal'||S.form==='lform'||S.form==='bauch'){$('quickBlock').style.display='none';$('massHint').textContent='CNC-Fertigung nach Maß';return;}
  $('quickBlock').style.display='block';
  const sizes=shopSizes();
  const list=S.form==='rect'
    ? sizes.map(s=>({t:s.l+'×'+s.b,l:s.l,b:s.b,act:+S.L===s.l&&+S.B===s.b}))
    : sizes.map(s=>({t:'Ø'+s.d,d:s.d,act:+S.D===s.d}));
  if(!list.length){ $('quickChips').innerHTML=''; $('quickBlock').style.display='none';
    $('massHint').textContent='Fertigung nach Maß'; return; }
  $('quickBlock').style.display='block';
  $('quickChips').innerHTML=list.map((c,i)=>`<button class="kfg_quick-chip${c.act?' is-active':''}" aria-pressed="${!!c.act}" data-i="${i}">${c.t}</button>`).join('');
  $('quickChips').querySelectorAll('.kfg_quick-chip').forEach(b=>b.addEventListener('click',()=>{
    const c=list[+b.dataset.i];
    if(S.form==='rect'){S.L=c.l;S.B=c.b;$('inL').value=c.l;$('inB').value=c.b;}
    else {S.D=c.d;$('inD').value=c.d;}
    render();
  }));
  $('massHint').textContent=`${list.length} ${list.length===1?'Größe':'Größen'} ab Lager`;
}
/* Statische Preisangaben in der Oberflaeche je Kanal setzen — auf der polnischen Seite
   standen bis v1.17.9 EUR-Betraege neben zl-Preisen (Review 08.09., B12/C9). */
function preisTexte(){
  document.querySelectorAll('.kfg_preset').forEach(el=>{ const p=PRESETS[el.dataset.preset], pr=el.querySelector('.pr'); if(p&&pr) pr.textContent=`+ ${fmt(zl(p.price))} / Stück`; });
  { const b=document.querySelector('.kfg_check input[data-x="bohr"]'); const pr=b&&b.closest('.kfg_check').querySelector('.pr'); if(pr) pr.textContent=`+ ${fmt(zl(X_PRICE.bohr))}`; }
  { const bm=$('btnMaschine'); const pr=bm&&bm.parentElement.querySelector('.pr'); if(pr) pr.textContent=`+ ${fmt(zl(PRESETS.maschine.price))} pauschal`; }
  { const t=document.querySelector('.kfg_trust'); if(t){ const sp=[...t.querySelectorAll('span')].find(x=>/nach Maß|na wymiar|made to measure/.test(x.textContent)); if(sp){ const ic=sp.querySelector('svg'); sp.textContent=` Lagergröße versandkostenfrei · nach Maß ${VERSAND_MASS[kanal()]}`; if(ic) sp.prepend(ic); } } }
  { const n=$('mpxNote'); if(n) n.textContent=`Sichtbare Schichtkante: nicht gefräst ist serienmäßig, gefräst 45° kostet ${fmt(zl(5))}/lfm, halbrund ${fmt(zl(8))}/lfm. Lackiert sind es ${fmt(zl(5))}, ${fmt(zl(10))} und ${fmt(zl(16))}/lfm — wir haben genau eine Lackierung. Alternativ eine ABS-Kante in der gewünschten Farbe.`; }
  { const b=$('btnMuster'); const sm=b&&b.parentElement.querySelector('small'); if(sm) sm.textContent=`Musterbox mit 4 Dekoren — ${fmt(zl(4.9))}, voll angerechnet beim Kauf`; }
}
function buildAll(){ preisTexte(); buildMats(); buildDekore(); buildThick(); buildAbs(); buildEdges(); syncFormChips(); syncFormUI(); buildCorner(); }

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
  if(S.form==='rect'){ chk('fL','errL','rangeL',+S.L,20,r.maxL); chk('fB','errB','rangeB',+S.B,20,r.maxB); }
  else if(S.form==='round') chk('fD','errD','rangeD',+S.D,20,r.maxD);
  else if(S.form==='lform'){
    chk('fLL','errLL','rangeLL',+S.lf.L,20,r.maxL); chk('fLB','errLB','rangeLB',+S.lf.B,20,r.maxB);
    chk('fAW','errAW','rangeAW',+S.lf.aw,10,Math.max(10,+S.lf.L-10)); chk('fAH','errAH','rangeAH',+S.lf.ah,10,Math.max(10,+S.lf.B-10));
    if(lfSchraeg()){ /* Winkel bei B: wird die Ausklinkung kleiner, klemmt der Winkel wie die Radien still auf das neue Maximum */
      const mx=lfWinkelMax(); let v=Math.round(+S.lf.winkel||LF_WINKEL); if(v>mx){ v=mx; S.lf.winkel=mx; }
      const bad=!(v>=91&&v<=mx); $('fLW').classList.toggle('is-error',bad); $('errLW').textContent=bad?`91 bis ${mx}°`:''; if(bad)ok=false; }
  }
  else if(S.form==='bauch'){
    chk('fBsL','errBsL','rangeBsL',+S.bs.L,20,r.maxL); chk('fBsBR','errBsBR','rangeBsBR',+S.bs.BR,20,r.maxB);
    const g=bsGeo(), z=v=>(''+(Math.round(v*10)/10)).replace('.',',');
    const bad=(fid,eid,schlecht,txt)=>{ $(fid).classList.toggle('is-error',!!schlecht);
      $(eid).textContent=schlecht?txt:''; if(schlecht) ok=false; };
    if(bsWelle()){
      bad('fBsA','errBsA', !(g.a>=0), 'A darf nicht negativ sein');
      bad('fBsB','errBsB', !(g.b>=0), 'B darf nicht negativ sein');
      bad('fBsT','errBsT', !(g.t>=1 && g.t<=g.BR-BS_REST),
        `1 bis ${z(Math.max(1,g.BR-BS_REST))} cm — hinter der Mulde bleiben ${BS_REST} cm stehen`);
      if(!(g.oeffnung>=BS_MIN_O)){ bad('fBsA','errBsA', true, `A und B lassen weniger als ${BS_MIN_O} cm Mulde übrig`); }
    } else {
    bad('fBsC','errBsC', !(g.c>=BS_MIN_C && g.c<=g.L-4), `${BS_MIN_C} bis ${Math.max(BS_MIN_C,g.L-4)} cm`);
    bad('fBsA','errBsA', !(g.a>=1), 'A wird zu klein — Ausschnitt schmäler oder flacher machen');
    bad('fBsB','errBsB', !(g.b>=1), 'B wird zu klein — A, C und die Schrägen passen nicht in die Länge');
    bad('fBsT','errBsT', !(g.t>=1 && g.t<=g.BR-BS_REST),
      g.t<1 && S.bs.treiber!=='t' ? 'A, B und C sind zusammen zu lang für die Platte'
      : `1 bis ${z(Math.max(1,g.BR-BS_REST))} cm — hinter dem Ausschnitt bleiben ${BS_REST} cm stehen`);
    bad('fBsW1','errBsW1', !(+S.bs.w1>=90 && +S.bs.w1<=179), '90 bis 179°');
    bad('fBsW2','errBsW2', !(+S.bs.w2>=90 && +S.bs.w2<=179), '90 bis 179°'); }
  }
  /* Radius-Regel Möbelplatte — gilt fuer Rechteck und L-Form */
  if(cornerFormOk()&&S.mat==='dekor'&&r.minCorner>0&&cornerIdx().some(i=>cornerR(i)>0&&cornerR(i)<r.minCorner)){
    cornerIdx().forEach(i=>{ if(cornerR(i)>0&&cornerR(i)<r.minCorner) setCorner(i,r.minCorner); });
    toast('Möbelplatte: Außenradius mind. R30, angepasst'); buildCorner();
  }
  /* Radien nie groesser als die halbe angrenzende Kante — auch nach einer Massaenderung */
  if(ok&&cornerFormOk()&&radienBegrenzen()){ toast('Radius an die Kantenlänge angepasst'); buildCorner(); }
  return ok;
}
/* Ungueltige Masse: Preis "—", Knoepfe gesperrt. Vorher blieb der alte Preis stehen und
   der Klick ging mit dem ungueltigen Mass an den Worker (Review 08.09., A5). */
function massSperre(an){
  const knoepfe=[$('cta'),$('ctaBar'),$('ctaBuy'),$('ctaMini')].filter(Boolean);
  const sum=document.querySelector('.kfg_summary'); if(sum) sum.classList.toggle('is-ungueltig',an);
  if(an){
    $('price').textContent='—'; $('priceBar').textContent='—';
    $('priceLabel').textContent='Bitte Maße prüfen';
    if(!_checkoutLaeuft) knoepfe.forEach(b=>{ b.disabled=true; });
  } else if(!_checkoutLaeuft) knoepfe.forEach(b=>{ b.disabled=false; });
}
function render(){ try { renderAtelierCore(); } finally { window.dispatchEvent(new CustomEvent("kfg:change")); } }
function renderAtelierCore(){
  const gueltig=validate();
  massSperre(!gueltig);
  if(!gueltig){ if(S.form==='bauch') buildBsControls(); syncURL(); uebersetze(); return; }
  clampCuts();          /* zuerst begrenzen, dann anzeigen — sonst zeigt die
                           Liste noch die alten, zu grossen Werte an */
  const std=isStandard(), offer=needsOffer(), c=calc();
  $('badge').classList.toggle('is-sonder',!std);
  /* Seit v1.7.0 haben auch freie Ausschnitte, Ausklinkungen und Konturen einen
     festen Preis nach Formel — nur eigene Skizze, Kabelkanal und Lack sind noch
     Angebotssache. Das Etikett sagt das jetzt auch. */
  $('badgeText').textContent=std?'Ab Lager · lieferbar in 3 bis 5 Tagen'
    :(offer?'Individuelle Fertigung · Angebot in 24 h':'CNC-Fertigung · Preis steht fest');
  const keineDaten=ohneDaten();
  const pv=keineDaten?'—':(offer?fmt(c.total)+' +':fmt(c.total));
  $('price').textContent=pv; $('priceBar').textContent=pv;
  $('priceLabel').textContent=keineDaten?'Preis folgt':std?'Dein Preis':(offer?'Preis ab (zzgl. Sonderarbeiten)':'Dein Preis');
  { const dh=$('datenHinweis'); if(dh) dh.hidden=!keineDaten; }
  if(keineDaten) $('badgeText').textContent='Preise gerade nicht verfügbar';
  const zahlbar=!std && kannBezahlen();
  if(std){$('delivDate').textContent='Versand bis '+delivDate();$('delivSub').textContent='DHL, ab Lager';$('delivBar').textContent='Versand bis '+delivDate();}
  else if(zahlbar){$('delivDate').textContent='Fertigung nach Maß';$('delivSub').textContent=`Versand ${VERSAND_MASS[kanal()]} pauschal`;$('delivBar').textContent='Nach Maß gefertigt';}
  else {$('delivDate').textContent='Angebot in 24 h';$('delivSub').textContent='Versandkosten im Angebot';$('delivBar').textContent='Fertigung · Angebot in 24 h';}
  { const vl=$('vatLine'); if(vl) vl.textContent=std?'inkl. MwSt., kostenloser Versand':`inkl. MwSt., zzgl. ${VERSAND_MASS[kanal()]} Versand`; }
  /* Senior 07.09.: wie auf der Produktseite — "In den Warenkorb" als Hauptknopf, darunter
     "Sofortkauf". Lagerartikel und Massplatten mit festem Preis koennen beides; ohne
     festen Preis bleibt nur die Anfrage. */
  const kaufbar=std||zahlbar;
  const t=kaufbar?'In den Warenkorb':'Unverbindlich anfragen';
  if(!_checkoutLaeuft){ $('cta').textContent=t;$('ctaBar').textContent=t; const cb=$('ctaBuy'); if(cb){ cb.textContent='Sofortkauf'; cb.style.display=kaufbar?'':'none'; } const cm=$('ctaMini'); if(cm) cm.textContent=t; }
  $('cta').classList.toggle('is-sonder',!kaufbar);$('ctaBar').classList.toggle('is-sonder',!kaufbar);
  /* Mobil: Preis und Knopf wandern in der Vorschaukarte mit — vorher war beim Konfigurieren
     kein Preis im Bild, die Preiskarte sitzt am Ende des Panels (Review 08.09., C1) */
  { const pm=$('priceMini'), dm=$('delivMini'), cm=$('ctaMini');
    if(pm) pm.textContent=pv;
    if(dm) dm.textContent=keineDaten?'Preis folgt':std?'Ab Lager · 3 bis 5 Tage':zahlbar?`Nach Maß · zzgl. ${VERSAND_MASS[kanal()]} Versand`:'Angebot in 24 h';
    if(cm) cm.classList.toggle('is-sonder',!kaufbar); }
  const sur=S.mat==='mpx'?{natur:' · natur',hpl:' + HPL'}[S.mpxSurface]:'';
  const hit=shopHit();
  const a2=(''+(Math.round(areaM2()*100)/100)).replace('.',',');
  const rows=[[hit
    ? `${MATERIALS[S.mat].name}${sur} · ${c.dekorName} · ${c.thickName} · Lagerartikel ${esc(hit[2]||'')}`
    : `${MATERIALS[S.mat].name}${sur} · ${c.dekorName} · ${c.thickName} · Sondermaß · ${a2} m²`, c.basis]];
  if(c.kante>0)rows.push([isLack()?`Kantenbearbeitung, lackiert`:`Kantenbearbeitung`,c.kante]);
  if(c.lschnitt>0)rows.push([S.form==='bauch'?`Bauchausschnitt (${bsSchnittCm()} cm Schnitt)`
    :lfGeo().schraeg?`Ausklinkung schräg (${lfSchnittCm()} cm Schnitt)`:`Ausklinkung (${lfSchnittCm()} cm Schnitt)`,c.lschnitt]);
  if(massbandPreis()>0)rows.push([massbandName(),massbandPreis()]);
  if(c.ecken>0){
    const n=cornerCount(), na=lfAutoEcken()+bsAutoEcken();
    const auto=na>0?`Schräge R${lfMinR()*10} (Fertigungsregel)`:'';
    const lbl=n>0?`${cornerLabel()}${auto?' + '+auto:''}`:auto;
    rows.push([`Eckenrundung ${lbl} (${n+na} ${n+na===1?'Ecke':'Ecken'})`, c.ecken]);
  }
  /* Presets in einer Zeile, jede freie Bearbeitung mit eigenem Preis darunter */
  const summePreset=(S.extras.bohr?zl(X_PRICE.bohr):0)
    + S.cuts.filter(c2=>c2.preset).reduce((a,c2)=>a+cutPrice(c2),0);
  if(summePreset>0){
    const parts=[]; if(S.extras.bohr)parts.push('Montagebohrungen');
    Object.keys(PRESETS).forEach(k=>{const n=presetCount(k); if(n)parts.push((n>1?n+'× ':'')+PRESETS[k].label);});
    rows.push([parts.join(', '),summePreset]);
  }
  S.cuts.filter(c2=>!c2.preset).forEach(c2=>rows.push([cutTypName(c2)+' '+cutMass(c2), cutPrice(c2)]));
  if(S.extras.custom)rows.push(['Eigenes Bohrbild','im Angebot']);
  buildCutList();
  syncPresets();
  $('breakdown').innerHTML=keineDaten?`<tr><td>Preise konnten gerade nicht geladen werden</td><td>—</td></tr>`
    :rows.map(r=>`<tr><td>${r[0]}</td><td>${typeof r[1]==='number'?fmt(r[1]):r[1]}</td></tr>`).join('')
    +`<tr class="total"><td>Gesamt inkl. MwSt.</td><td>${pv}</td></tr>`;
  syncStep5();
  _imRender=true;
  try{ buildQuick(); buildLfControls(); buildBsControls(); drawStage(); drawDetail(); updateMini(); updateSticky(); updateBottomBar(); buildCounts(); buildConf(); buildBarWhat(); syncURL(); }
  finally{ _imRender=false; }
  uebersetze();
}
/* Geteilte Links wiederherstellen — syncURL schreibt den Zustand in den Hash,
   bisher hat ihn aber niemand gelesen: "Konfiguration teilen" fuehrte zur Standard-
   konfiguration. Wird einmalig vor dem ersten Aufbau aufgerufen. */
function restoreFromHash(){
  const h=location.hash||''; if(h.length<4) return;
  let p; try{ p=new URLSearchParams(h.slice(1)); }catch(e){ return; }
  const g=k=>p.get(k), num=(k,min,max)=>{const v=+g(k); return isFinite(v)&&v>=min&&v<=max?v:null;};
  if(hasOwn(MATERIALS,g('m'))) S.mat=g('m');
  if(['natur','hpl'].indexOf(g('sf'))>=0) S.mpxSurface=g('sf');
  if(g('d')) S.dekor=g('d');
  /* Alt-Links: die Naehmaschinen-Platte war bis v1.15.0 eine FORM. */
  if(g('f')==='szwal'){ S.mat='szwal'; S.form='rect'; }
  else if(['rect','round','lform','bauch'].indexOf(g('f'))>=0) S.form=g('f');
  if(S.mat==='szwal'&&S.form==='round') S.form='rect';
  /* L-Form seit v1.17.0: Lage (lp), Schnitt (ls), Radien je Aussenecke (lr) */
  if(LF_POS.some(p=>p[0]===g('lp'))) S.lf.pos=g('lp');
  if(g('ls')==='s') S.lf.schnitt='schraeg';
  if(/^\d{2,3}$/.test(g('lw')||'')) S.lf.winkel=+g('lw');   /* Winkel bei B (08.09.); das alte lsb (Punkt A ab Kante) wird ignoriert */
  if(/^\d{1,3}(-\d{1,3}){4}$/.test(g('lr')||'')) S.lfR=g('lr').split('-').map(v=>Math.max(0,Math.min(300,+v)));
  /* Bauchausschnitt (v1.19.0): alle sechs Masse plus Mittig-Haken in EINEM Feld */
  if(g('bs')){ const v=String(g('bs')).split(',');
    if(v.length>=8){ const f=(x,mn,mx,d)=>{ const q=+String(x).replace(',','.'); return isFinite(q)&&q>=mn&&q<=mx?q:d; };
      S.bs.L=f(v[0],20,400,S.bs.L); S.bs.BR=f(v[1],20,400,S.bs.BR);
      S.bs.a=f(v[2],0,400,S.bs.a);  S.bs.b=f(v[3],0,400,S.bs.b);
      S.bs.c=f(v[4],1,400,S.bs.c);  S.bs.t=f(v[5],0.1,400,S.bs.t);
      S.bs.w1=f(v[6],90,179,S.bs.w1); S.bs.w2=f(v[7],90,179,S.bs.w2);
      S.bs.mittig=v[8]==='1'; S.bs.treiber=v[9]==='t'?'t':'b';
      S.bs.art=v[10]==='w'?'welle':'trapez'; } }
  if(/^\d{1,3}(-\d{1,3}){5}$/.test(g('bsr')||'')) S.bsR=g('bsr').split('-').map(v=>Math.max(0,Math.min(300,+v)));
  if(['links','rechts'].indexOf(g('mn'))>=0) S.massbandNull=g('mn');
  if(hasOwn(MASCHINE_MASSE,g('mm'))) S.maschineMass=g('mm');
  if(g('t')&&MATERIALS[S.mat].thick.some(t=>t[0]===g('t'))) S.thick=g('t');
  /* Erst die Masse, dann die Radien — clampCorner klemmt gegen die Plattengroesse
     (vorher mit dem Standardmass 120x60 geklemmt, Review 08.09., A9). */
  const L=num('l',10,300), B=num('b',10,300), D=num('dm',10,300);
  if(L!==null) S.L=L; if(B!==null) S.B=B; if(D!==null) S.D=D;
  /* Alt-Links trugen das Naehmaschinen-Mass in sw/sd. */
  const sw=num('sw',10,300), sd=num('sd',10,300);
  if(sw!==null) S.L=sw; if(sd!==null) S.B=sd;
  const ll=num('ll',10,300), lb=num('lb',10,300), law=num('aw',5,300), lah=num('ah',5,300);
  if(ll!==null) S.lf.L=ll; if(lb!==null) S.lf.B=lb;
  if(law!==null) S.lf.aw=law; if(lah!==null) S.lf.ah=lah;
  const c=num('c',0,300); if(c!==null) S.corner=c;
  if(/^\d{1,3}(-\d{1,3}){3}$/.test(g('cr')||'')) S.cornerR=g('cr').split('-').map(v=>clampCorner(+v));
  else if(/^[01]{4}$/.test(g('cs')||'')) S.cornerR=g('cs').split('').map(v=>v==='1'?clampCorner(S.corner):0);  /* Alt-Links */
  else if(S.corner>0) setAllCorners(S.corner);
  S.corner=cornerMax();
  const er=num('er',1,20); if(er!==null) S.edgeR=er;
  if(g('ac')&&ABS_STOCK.some(a=>a[0]===g('ac'))) S.absColor=g('ac');
  if(g('mb')&&MASSBAND.some(m=>m[0]===g('mb'))) S.massband=g('mb');
  S.extras.lack = g('lk')==='1';
  const e=(g('e')||'').split(','); if(e.length===4) S.edges=e;
  S.extras.bohr = g('bo')==='1';
  if(g('mc')) S.machine=String(g('mc')).slice(0,80);
  if(g('cu')){ const cu=cutsAusHash(g('cu')); if(cu) S.cuts=cu; }
  normEdges();
  formKonsistent();
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
      : {round:'Rund',lform:'L-Form',bauch:'Bauchausschnitt'}[S.form]);
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
             : S.form==='lform' ? `L-Form ${S.lf.L} × ${S.lf.B} cm`
             : S.form==='bauch' ? `Bauchausschnitt ${S.bs.L} × ${S.bs.BR} cm`
                                : `${d.w} × ${d.h} cm`;
  const teile=[mass, c.thickName];
  const ex=extrasList();
  if(ex.length) teile.push(ex.length===1?'1 Bearbeitung':`${ex.length} Bearbeitungen`);
  sp.textContent = teile.join(' · ');
  if(th){
    const tex=TEX_THUMB[texKey()]||TEX[texKey()];   /* 48-px-Thumb reicht der Leiste */
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
      :S.form==='lform'?`L-Form ${S.lf.L} × ${S.lf.B} cm`+(lfSchraeg()?' · schräg':'')
      :S.form==='bauch'?`Bauchausschnitt ${S.bs.L} × ${S.bs.BR} cm`+(S.bs.mittig?' · mittig':'')
      :`${S.mat==='szwal'?'Nähtischplatte':'Rechteck'} ${d.w} × ${d.h} cm`,
     s:3, warn:!hit&&S.mat!=='szwal'&&(S.form==='rect'||S.form==='round')},
  ];
  const prof=[...new Set((S.form==='round'?[S.edges[0]]:S.edges).map(edgeLabel))];
  items.push({t:prof.length===1?prof[0]:'Kanten je Seite', s:4});
  if(S.edges.some(e=>e==='abs')&&S.absColor!=='dekor')
    items.push({t:`ABS ${(ABS_STOCK.find(a=>a[0]===S.absColor)||[])[1]}`, s:4});
  if(isLack()) items.push({t:'Kante lackiert', s:4});
  if(S.mat==='szwal'&&S.massband!=='none') items.push({t:massbandName(), s:4});
  if(S.mat==='szwal'&&S.machine) items.push({t:`Maschine: ${esc(S.machine)}`, s:5});
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
/* Der Maschinen-Ausschnitt bekommt KEINE Massfelder — der Kunde nennt seine
   Maschine, wir passen den Ausschnitt an (Senior 30.07.). Verschiebbar ist er
   trotzdem, und die Abstaende zu allen vier Kanten stehen dabei. */
function maschinenZeile(c,i,d){
  const f=v=>(''+(Math.round(v*10)/10)).replace('.',',');
  const info=(S.maschineMass==='auto'
      ? `Größe ${f(c.w)} × ${f(c.h)} cm — Richtwert, wir passen ihn an deine Maschine an. `
      : `Größe ${f(c.w)} × ${f(c.h)} cm — Standardmaß. `)
    +(()=>{ const ab=cutAbstaende(c); return `Abstände: links ${f(ab.l)} · rechts ${f(ab.r)} · hinten ${f(ab.t)} · vorn ${f(ab.b)} cm`; })();
  return `<div class="kfg_cutrow" data-i="${i}">
      <div class="kfg_cutrow-head"><span class="ic">▭</span><b>Ausschnitt für die Maschine</b>
        <span class="pr">+ ${fmt(PRESETS.maschine.price)}</span>
        <button class="del" data-del="${i}" aria-label="Entfernen">×</button></div>
      <div class="kfg_cutrow-fields"><span class="kfg_cutlen breit">${info}</span>
        ${feld('X ab links','cx',c.cx*10,'mm','min="0"')}${feld('Y ab hinten','cy',c.cy*10,'mm','min="0"')}</div>
    </div>`;
}
/* Feldwert (mm bzw. Rohwert) einer Bearbeitung — dieselbe Abbildung wie in buildCutList */
function cutFeldWert(c,f){
  if(f==='d') return Math.round(c.d*10);
  if(f==='w') return c.t==='k'?Math.round(c.w):Math.round(c.w*10);
  if(f==='h') return Math.round(c.h*10);
  if(f==='len') return Math.round(c.len*10);
  if(f==='dp') return Math.round(c.dp);
  if(f==='r') return Math.round(c.r||0);
  if(f==='cx') return Math.round(c.cx*10);
  if(f==='cy') return Math.round(c.cy*10);
  return null;
}
/* Wird gerade in der Liste getippt, nur die Werte nachziehen — das fokussierte Feld bleibt
   unangetastet. Vorher baute innerHTML die Liste 400 ms nach dem ersten Zeichen neu, der
   Fokus war weg und die restlichen Ziffern landeten im Nichts (Review 08.09., B2). */
function cutListAktualisieren(box){
  const ae=document.activeElement;
  box.querySelectorAll('.kfg_cutrow').forEach(row=>{
    const c=S.cuts[+row.dataset.i]; if(!c) return;
    row.querySelectorAll('input[data-f]').forEach(el=>{ if(el===ae) return;
      const v=cutFeldWert(c, el.dataset.f); if(v!=null && String(el.value)!==String(v)) el.value=v; });
    const pr=row.querySelector('.kfg_cutrow-head .pr'); if(pr) pr.textContent=`+ ${fmt(cutPrice(c))}`;
    const len=row.querySelector('.kfg_cutlen:not(.breit)'); if(len && c.t==='k') len.textContent=`Länge ${Math.round(cutLen(c))} cm · ${fmt(zl(kanalLfmPreis(c.w,c.dp)))} je lfm`;
    if(c.preset!=='maschine'){ const warn=cutWarn(c); row.classList.toggle('is-warn',!!warn);
      const w=row.querySelector('.kfg_cutwarn'); if(w) w.textContent=warn; }
  });
}
function buildCutList(){
  const box=$('cutList'); if(!box) return;
  const d=dims();
  { const ae=document.activeElement;
    if(ae && box.contains(ae) && /^(INPUT|SELECT)$/.test(ae.tagName)){
      if(box.querySelectorAll('.kfg_cutrow').length===S.cuts.length){ cutListAktualisieren(box); return; }
      /* Zeilenzahl hat sich geaendert: erst sauber verlassen (change-Handler ohne Render),
         dann neu bauen — sonst feuert blur mitten im innerHTML (NotFoundError) */
      _cutListBlur=true; try{ ae.blur(); }finally{ _cutListBlur=false; }
    } }
  box.innerHTML=S.cuts.map((c,i)=>{
    if(c.preset==='maschine') return maschinenZeile(c,i,d);
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
    if(c.t==='k') f=`<span class="kfg_cutlen">Länge ${Math.round(cutLen(c))} cm · ${fmt(zl(kanalLfmPreis(c.w,c.dp)))} je lfm</span>`+f;
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
    const uebernehmen=(el, fertig)=>{
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
      /* Vorlagenpreis gilt nur fuer das Vorlagenmass — anderes Mass rechnet nach Formel (Sascha 08.09.) */
      if(c.preset&&c.preset!=='maschine'&&(f==='d'||f==='w'||f==='h')){ delete c.preset; toast('Maß geändert — jetzt freier Ausschnitt nach Formel'); }
      {
        const bx=cutBox(c);
        c.cx=Math.max(bx.w/2,Math.min(Math.max(bx.w/2,d.w-bx.w/2),c.cx));
        c.cy=Math.max(bx.h/2,Math.min(Math.max(bx.h/2,d.h-bx.h/2),c.cy));
      }
      if(_cutListBlur) return;               /* der laufende Neuaufbau zeichnet gleich alles */
      render();
      /* Eingabe abgeschlossen (Enter/Verlassen): geklemmten Wert ins Feld zurueckschreiben */
      if(fertig && el.isConnected && el.dataset.f){ const w=cutFeldWert(c, el.dataset.f); if(w!=null && String(el.value)!==String(w)) el.value=w; }
    };
    row.querySelectorAll('input').forEach(el=>{
      let t; el.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>uebernehmen(el,false),400);});
      el.addEventListener('change',()=>{clearTimeout(t);uebernehmen(el,true);});
      el.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); clearTimeout(t); uebernehmen(el,true); } });
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
  if(KFG_TOUCH){ fn(); return; }          /* Touch: keine Scroll-Nachfuehrung */
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
  if(KFG_TOUCH) return;                    /* Touch: nie von selbst scrollen */
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
  if(auf && !sec.classList.contains('is-open')) ga('kfg_step_open',{step:n});
  sec.classList.toggle('is-open',!!auf);
  const h=sec.querySelector('.kfg_step-head'); if(h) h.setAttribute('aria-expanded',auf?'true':'false');
}
function initSteps(){
  document.querySelectorAll('[data-kfg-root] .kfg_step').forEach((sec,idx)=>{
    const head=sec.querySelector('.kfg_step-head'); if(!head) return;
    const body=document.createElement('div'); body.className='kfg_step-body';
    while(head.nextSibling) body.appendChild(head.nextSibling);
    sec.appendChild(body);
    head.setAttribute('role','button'); head.setAttribute('tabindex','0'); head.setAttribute('aria-expanded','false');
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
/* Eine Auswahl in Schritt n oeffnet Schritt n+1 — und laesst Schritt n OFFEN.
   Zugeklappt werden nur die Schritte DAVOR: wer in Schritt 2 eine Form waehlt,
   ist mit Schritt 1 fertig. Vorher klappte der aktuelle Schritt 650 ms nach
   jedem Klick zu — beim Durchprobieren der Dekore verschwand das Raster unter
   dem Finger (Befund Sascha 02.09.). */
function weiterZu(n){ return;

  const sec=stepEl(n); if(!sec||sec.dataset.manual) return;
  const ae=document.activeElement;                   /* es wird gerade getippt — nur bei Eingabefeldern warten */
  if(ae && sec.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
  const nx=stepEl(n+1);
  const oeffneNx=()=>{ if(nx && !nx.dataset.manual && !nx.classList.contains('is-open')) stepOffen(n+1,true); };
  if(KFG_TOUCH){ oeffneNx(); return; }      /* Touch: nichts klappt zu, nichts scrollt */
  const anker=sec.querySelector('.kfg_step-head');
  ohneSprung(anker, ()=>{
    for(let k=1;k<n;k++){ const fr=stepEl(k); if(fr && !fr.dataset.manual && fr.classList.contains('is-open')) stepOffen(k,false); }
    oeffneNx();
  });
  if(nx && nx.classList.contains('is-open')){
    const r=nx.getBoundingClientRect();
    if(r.top<0 || r.top>window.innerHeight-120) nx.scrollIntoView({behavior:'smooth',block:'center'});
  }
}
/* Gebuendelt auf 250 ms: Safari drosselt replaceState auf 100 Aufrufe je 30 s —
   ungedrosselt (1x je render) konnte zuegiges Durchklicken den Konfigurator mit
   einem SecurityError anhalten (Audit 29.07., Fix 5a). */
var _kfgUrlT;
function syncURL(){ clearTimeout(_kfgUrlT); _kfgUrlT = setTimeout(_syncURLnow, 250); }
function _syncURLnow(){
  const p=new URLSearchParams({m:S.mat,d:S.dekor,f:S.form,t:S.thick,c:S.corner,cr:S.cornerR.join('-'),er:S.edgeR,sf:S.mpxSurface,ac:S.absColor,
    mb:S.massband, mn:S.massbandNull||'links', mm:S.maschineMass, lk:S.extras.lack?1:0,
    ...(S.extras.bohr?{bo:1}:{}), ...(S.machine?{mc:S.machine.slice(0,80)}:{}), ...(S.cuts.length?{cu:cutsKurz()}:{}),
    ...(S.form==='round'?{dm:S.D}
       :S.form==='lform'?{ll:S.lf.L,lb:S.lf.B,aw:S.lf.aw,ah:S.lf.ah,lp:lfPos(),ls:lfSchraeg()?'s':'g',...(lfSchraeg()?{lw:lfWinkel()}:{}),lr:[0,1,2,3,4].map(lfCornerR).join('-')}
       :S.form==='bauch'?(function(){ const g=bsGeo(), r=v=>Math.round(v*10)/10;
          return {bs:[g.L,g.BR,r(g.a),r(g.b),S.bs.c,r(g.t),S.bs.w1,S.bs.w2,S.bs.mittig?1:0,S.bs.treiber,bsWelle()?'w':'t'].join(','),
                  bsr:[0,1,2,3,4,5].map(bsCornerR).join('-')}; })()
       :{l:S.L,b:S.B}),e:S.edges.join(',')});
  history.replaceState(null,'','#'+p.toString());
}

/* Bearbeitungen kompakt im Hash (v1.18.0): vorher verlor ein geteilter Link alle
   Ausschnitte, Bohrungen und die Maschinenangabe — die Anfrage-Mail nannte einen Preis,
   den der Link nicht reproduzierte (Review 08.09., A8). */
const R1=v=>Math.round(v*10)/10;
function cutsKurz(){
  return JSON.stringify(S.cuts.slice(0,20).map(c=>{
    const o={t:c.t,x:R1(c.cx),y:R1(c.cy)}; if(c.preset) o.p=c.preset;
    if(c.t==='c') o.d=R1(c.d);
    else if(c.t==='r'){ o.w=R1(c.w); o.h=R1(c.h); if(c.r) o.r=Math.round(c.r); }
    else if(c.t==='p'){ o.pts=(c.pts||[]).slice(0,60).map(q=>[R1(q[0]),R1(q[1])]); if(c.r) o.r=Math.round(c.r); }
    else if(c.t==='k'){ o.l=R1(c.len); o.dir=c.dir==='quer'?'q':'l'; o.w=Math.round(c.w); o.dp=Math.round(c.dp); o.s=c.seite==='oben'?'o':'u'; o.e=c.enden||'zu'; }
    return o; }));
}
function cutsAusHash(txt){
  let a; try{ a=JSON.parse(txt); }catch(e){ return null; }
  if(!Array.isArray(a)) return null;
  const z=(v,max)=>{ const x=+v; return isFinite(x)&&x>=0&&x<=(max||400)?x:null; };
  const out=[];
  for(const o of a.slice(0,20)){
    if(!o||typeof o!=='object'||!['r','c','p','k'].includes(o.t)) continue;
    const cx=z(o.x), cy=z(o.y); if(cx===null||cy===null) continue;
    const preset=hasOwn(PRESETS,o.p)?o.p:undefined;
    if(o.t==='c'){ const d=z(o.d); if(d===null||d<=0) continue; out.push(Object.assign({t:'c',cx,cy,d,w:d,h:d},preset?{preset}:{})); }
    else if(o.t==='r'){ const w=z(o.w), h=z(o.h); if(!w||!h) continue; const c={t:'r',cx,cy,w,h}; if(preset) c.preset=preset; const r=z(o.r,200); if(r) c.r=r; out.push(c); }
    else if(o.t==='p'){ if(!Array.isArray(o.pts)||o.pts.length<3) continue;
      const pts=o.pts.slice(0,60).map(q=>Array.isArray(q)?[+q[0],+q[1]]:null); if(pts.some(q=>!q||!isFinite(q[0])||!isFinite(q[1])||Math.abs(q[0])>400||Math.abs(q[1])>400)) continue;
      const xs=pts.map(q=>q[0]), ys=pts.map(q=>q[1]);
      out.push({t:'p',cx,cy,w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),r:z(o.r,200)||0,pts}); }
    else { const len=z(o.l); if(!len) continue;
      out.push({t:'k',cx,cy,len,dir:o.dir==='q'?'quer':'laengs',w:z(o.w,300)||60,dp:z(o.dp,40)||10,seite:o.s==='o'?'oben':'unten',enden:['zu','a','e','ae'].includes(o.e)?o.e:'zu'}); }
  }
  return out;
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
/* Pointer Events tragen die Logik (Maus, Finger, Stift). Die Touch-Handler unten verhindern
   nur das Scrollen/Zoomen waehrend Zeichnen und Ziehen — vorher riefen sie startDraw/moveDraw
   ein zweites Mal (iOS: zwei Punkte je Tipp, Review 08.09., B13). */
$('stage').addEventListener('touchstart',e=>{ const t=e.target; if(S.draw||(t&&t.classList&&t.classList.contains('kfg_cutshape'))) e.preventDefault(); },{passive:false});
/* Hoechstens ein Neuzeichnen je Bildwechsel — jede Zeigerbewegung baute vorher das ganze SVG (Review 08.09., B10) */
let _zeichnenGeplant=false;
function zeichnenBald(){ if(_zeichnenGeplant) return; _zeichnenGeplant=true; requestAnimationFrame(()=>{ _zeichnenGeplant=false; drawStage(); }); }
function moveDraw(e){
  if(dragCut&&G){ const [px,py]=svgPt(e), c2=S.cuts[dragCut.i], r5=v=>Math.round(v*2)/2;
    const bx=cutBox(c2);
    c2.cx=r5(Math.max(bx.w/2,Math.min(Math.max(bx.w/2,G.w-bx.w/2),(px-G.x)/G.sc-dragCut.ox)));
    c2.cy=r5(Math.max(bx.h/2,Math.min(Math.max(bx.h/2,G.h-bx.h/2),(py-G.y)/G.sc-dragCut.oy)));
    zeichnenBald(); return; }
  if(!S.draw||!tmpCut)return;
  const [px,py]=svgPt(e); tmpCut.x1=(px-G.x)/G.sc; tmpCut.y1=(py-G.y)/G.sc; zeichnenBald(); }
function endDraw(){
  if(dragCut){ dragCut=null; $('stage').classList.remove('is-dragging'); render(); return; }
  if(S.draw==='p') return;                      /* Polygon endet per Doppelklick */
  if(!S.draw||!tmpCut)return;
  if(tmpCut.x1!==null){ const c2=normCut(tmpCut);
    if(c2.w>=3&&c2.h>=3){S.cuts.push(c2);toast(fmtCut(c2)+' hinzugefügt · '+fmt(cutPrice(c2)));}
    else toast('Zu klein: mindestens 3 cm aufziehen'); }
  tmpCut=null; setDraw(null); render(); }
$('stage').addEventListener('touchmove',e=>{ if(S.draw||dragCut) e.preventDefault(); },{passive:false});
window.addEventListener('pointermove',moveDraw);
window.addEventListener('pointercancel',endDraw);
/* mousemove/mouseup und der Extra-pointermove auf #stage sind raus: Pointer
   Events decken Maus, Touch und Stift ab — vorher zeichnete jede Bewegung die
   Buehne 2–3x (Audit 29.07., Fix 5b). Touch-Handler bleiben fuers preventDefault. */
window.addEventListener('pointerup',endDraw);
$('btn2d').addEventListener('click',()=>setView('2d'));
$('btn3d').addEventListener('click',()=>setView('3d'));
function setForm(f){
  S.form=f;
  if(formKonsistent()) toast('Ausschnitte entfernt — bei runden Platten nicht möglich');
  syncFormUI();
  buildCorner();          /* Chips + Radiusfelder an die neue Form anpassen */
  syncEdgeChips();
}
/* Rund und L-Form tragen EIN Kantenprofil umlaufend (calc rechnet nur edges[0]) — gemischte
   Kanten aus dem Rechteck blieben vorher stehen und standen so in den Bestelldaten; Rund
   kann keine Ausschnitte (Review 08.09., A10). Gibt true zurueck, wenn Ausschnitte wegfielen. */
function formKonsistent(){
  let weg=false;
  if(S.form!=='rect'){ const e0=S.edges[0]; S.edges=[e0,e0,e0,e0]; }
  if(S.form==='round'&&S.cuts.length){ S.cuts=[]; weg=true; }
  return weg;
}
/* Form-Chips, Massfelder und Eckenblock an S.form angleichen — auch nach
   setConfig() und geteilten Links, die frueher die Rechteck-Felder stehen liessen. */
function syncFormUI(){
  const f=S.form;
  document.querySelectorAll('#formChips .kfg_chip').forEach(x=>{ const an=x.dataset.form===f; x.classList.toggle('is-active',an); x.setAttribute('aria-pressed',an?'true':'false'); });
  $('dimsRect').style.display=f==='rect'?'grid':'none';
  $('dimsRound').style.display=f==='round'?'grid':'none';
  $('dimsLform').style.display=f==='lform'?'grid':'none';
  { const bd=$('dimsBauch'); if(bd) bd.style.display=f==='bauch'?'grid':'none'; }
  if(f==='bauch') buildBsControls();
  if(f==='lform'){ const set=(id,v)=>{ const el=$(id); if(el&&document.activeElement!==el) el.value=v; };
    set('inLL',S.lf.L); set('inLB',S.lf.B); set('inAW',S.lf.aw); set('inAH',S.lf.ah); }
  /* Ecken auch bei L-Form (Wunsch Sascha 27.07.), seit v1.17.0 je Ecke */
  $('cornerBlock').style.display=cornerFormOk()?'block':'none';
  buildLfControls();
}
/* Schnitt gerade/schraeg und Winkel der Schraege */
document.querySelectorAll('#lfCutChips .kfg_chip').forEach(b=>b.addEventListener('click',()=>{
  S.lf.schnitt=b.dataset.ls==='schraeg'?'schraeg':'gerade';
  buildCorner(); render();
}));
{ let wT; const iw=$('inLW'); if(iw){ iw.addEventListener('input',()=>{ clearTimeout(wT); wT=setTimeout(()=>{
    /* Winkel bei B (Senior 08.09.): 91..max, 90 = gerade. A rueckt um ah*tan(w-90) nach
       innen, Breite und Tiefe der Ausklinkung bleiben. */
    S.lf.winkel=Math.max(91,Math.min(lfWinkelMax(), Math.round(+iw.value||LF_WINKEL)));
    render(); },300); });
  iw.addEventListener('blur',()=>{ if(lfSchraeg()) iw.value=lfWinkel(); }); } }
bindBsFelder();
document.querySelectorAll('#formChips .kfg_chip').forEach(b=>b.addEventListener('click',()=>{
  setForm(b.dataset.form);
  ga('kfg_form',{form:S.form});
  render();
}));
document.querySelectorAll('#mpxSurfaceChips .kfg_chip').forEach(b=>b.addEventListener('click',()=>{
  S.mpxSurface=b.dataset.sf;
  document.querySelectorAll('#mpxSurfaceChips .kfg_chip').forEach(x=>x.classList.toggle('is-active',x===b));
  S.dekor=S.mpxSurface==='hpl'?DEKOR_HPL[0][0]:'sperrholz-natur';
  buildDekore(); render();
}));
/* Naehtischplatte: Modellangabe statt Ausschnittmass (Senior 30.07.). */
const _miEl=$('machineInput');
if(_miEl){ let mT; _miEl.addEventListener('input',()=>{ clearTimeout(mT);
  mT=setTimeout(()=>{ S.machine=_miEl.value.trim(); buildConf(); }, 400); }); }
const _bmEl=$('btnMaschine');
if(_bmEl) _bmEl.addEventListener('click',()=>{
  if(presetCount('maschine')) removePreset('maschine'); else addPreset('maschine');
  render();
});
let cT; const inCEl=$('inC'); if(inCEl) inCEl.addEventListener('input',()=>{clearTimeout(cT);cT=setTimeout(()=>{
  setAllCorners(Math.max(0,Math.min(300,+inCEl.value||0)));
  document.querySelectorAll('#cornerChips .kfg_chip').forEach(c=>c.classList.remove('is-active'));
  render();},250)});
['inL','inB','inD','inLL','inLB','inAW','inAH'].forEach(id=>{let t;$(id).addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{
  S.L=$('inL').value;S.B=$('inB').value;S.D=$('inD').value;
  Object.assign(S.lf,{L:+$('inLL').value,B:+$('inLB').value,aw:+$('inAW').value,ah:+$('inAH').value});render();},250)})});
document.querySelectorAll('#edgeRadiusChips .kfg_chip').forEach(b=>b.addEventListener('click',()=>{
  S.edgeR=+b.dataset.er;
  document.querySelectorAll('#edgeRadiusChips .kfg_chip').forEach(c=>c.classList.toggle('is-active',c===b));
  render();
}));
document.querySelectorAll('.kfg_check input').forEach(i=>i.addEventListener('change',()=>{
  S.extras[i.dataset.x]=i.checked;
  i.closest('.kfg_check').classList.toggle('is-active',i.checked);
  if(i.dataset.x==='custom')$('customBlock').classList.toggle('is-open',i.checked);
  /* Lackiert gilt ein anderer lfm-Preis — die Chips tragen ihn, also neu bauen. */
  if(i.dataset.x==='lack') buildEdges();
  render();
}));
$('uploadZone').addEventListener('click',()=>$('uploadInput').click());
$('uploadZone').addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); $('uploadInput').click(); } });
$('uploadInput').addEventListener('change',()=>{
  /* Die Datei kann nicht mit der mailto-Anfrage reisen — das sagen wir jetzt auch (Review 08.09., B8) */
  if($('uploadInput').files.length){$('uploadZone').querySelector('b').textContent='✓ '+$('uploadInput').files[0].name;toast('Skizze ausgewählt — bitte an die Anfrage-Mail anhängen')}
});
function openOrder(){
  FORCE_DISTS=true; drawStage();
  $('omSvg').innerHTML=$('stage').innerHTML;
  FORCE_DISTS=false; drawStage();
  const std=isStandard(), offer=needsOffer(), c=calc();
  const formName=S.mat==='szwal'?'Nähtischplatte':{rect:'Rechteck',round:'Rund',lform:'L-Form',bauch:'Rechteck mit Bauchausschnitt'}[S.form];
  const mass=S.form==='round'?`Ø ${S.D} cm`
    :S.form==='lform'?`${S.lf.L} × ${S.lf.B} cm · Ausklinkung ${S.lf.aw} × ${S.lf.ah} cm ${(LF_POS.find(p=>p[0]===lfPos())||[])[1]}${lfSchraeg()?` · schräg, Winkel bei B ${lfGeo().winkel}° · A–C gerade ${Math.round(lfGeo().ac)} cm`:''}`
    :S.form==='bauch'?(function(){ const g=bsGeo(), z=v=>(''+(Math.round(v*10)/10)).replace('.',',');
        return g.welle
          ? `${g.L} × ${g.BR} cm · Bauchausschnitt als Welle · A ${z(g.a)} · B ${z(g.b)} · Tiefe ${z(g.t)} cm`
            +` · Mulde ${z(g.oeffnung)} cm · Schnitt ${bsSchnittCm()} cm · tangential, keine Ecken`
          : `${g.L} × ${g.BR} cm · Bauchausschnitt A ${z(g.a)} · C ${z(g.c)} · B ${z(g.b)} · Tiefe ${z(g.t)} cm · Winkel ${g.w1}°/${g.w2}°`
            +` · Öffnung ${z(g.oeffnung)} cm · Schnitt ${bsSchnittCm()} cm`; })()
    :`${S.L} × ${S.B} cm`;
  const edges=[...new Set((S.form==='round'?[S.edges[0]]:S.edges).map(edgeLabel))];
  const edgeTxt=edges.length===1?edges[0]:S.edges.map((e,i)=>'ABCD'[i]+': '+edgeLabel(e)).join(' · ');
  const cutsTxt=(G?S.cuts:[]).map(c2=>{
    const f=v=>(''+(Math.round(v*10)/10)).replace('.',',');
    if(c2.t==='k') return `Kabelkanal ${Math.round(cutLen(c2))} cm, Nut ${c2.w} × ${c2.dp} mm, `
      +`${c2.seite==='oben'?'Oberseite':'Unterseite'}, Enden: ${KANAL_ENDEN[c2.enden||'zu']}, `
      +`Verlauf (x/y in cm ab hinten links): `+kanalPunkte(c2).map(q=>f(q[0])+'/'+f(q[1])).join(' → ');
    if(c2.t==='p') return `Freie Kontur, Punkte (x/y in cm ab hinten links): `
      +(c2.pts||[]).map(p=>f(p[0])+'/'+f(p[1])).join(' · ')+`, Radius R${c2.r||0}`;
    const ab=cutAbstaende(c2);
    return `${fmtCut(c2)} · Abstände: links ${f(ab.l)} · rechts ${f(ab.r)} · hinten ${f(ab.t)} · vorn ${f(ab.b)} cm`;
  });
  const presets=[]; if(S.extras.bohr)presets.push('Montagebohrungen 4× Ø8');
  Object.keys(PRESETS).forEach(k=>{const n=presetCount(k); if(n)presets.push((n>1?n+'× ':'')+PRESETS[k].label);});
  const rows=[
    ['Auftragsart', std?`Lager-Artikel → cartLinesAdd · Variant ${shopHit()[1]} · SKU ${shopHit()[2]||'—'}`
      :(offer?'Angebotsanfrage → E-Mail an Fertigung + Kunde':'CNC-Fertigungsauftrag → Anfrage-Flow')],
    ['Material', MATERIALS[S.mat].name+(S.mat==='mpx'?{natur:' · Birke natur',hpl:' + HPL-Laminat'}[S.mpxSurface]:'')],
    ['Dekor', c.dekorName],
    ['Stärke', c.thickName],
    ['Form & Maß', `${formName} · ${mass}`],
    ...(cornerCount()>0?[['Eckenradius',cornerIdx().filter(i=>cornerR(i)>0)
      .map(i=>`${cornerName(i)} R${cornerR(i)}`).join(' · ')]]:[]),
    ['Kante', edgeTxt
      +(S.edges.some(e=>e==='abs')&&S.absColor!=='dekor'?` · ABS-Farbe ${(ABS_STOCK.find(a=>a[0]===S.absColor)||[])[1]}`:'')
      +(isLack()?' · lackiert (eine Lackierung)':'')],
    ...(S.mat==='szwal'?[['Maßband', massbandName()+(S.massband!=='none'&&massbandStrecke()?` · ${massbandStrecke().len} cm · Nullpunkt ${S.massbandNull||'links'}`:'')],
                         ['Nähmaschine', esc(S.machine||'— vom Kunden noch nicht angegeben —')+` · Ausschnitt ${S.maschineMass==='auto'?'nach Maschine':S.maschineMass.replace('x',' × ')+' cm'}`]]:[]),
    ...(presets.length?[['Ausschnitte (Preset)',presets.join(', ')]]:[]),
    ...(cutsTxt.length?[['Ausschnitt-Positionen',cutsTxt.join('<br>')]]:[]),
    ...(S.extras.custom?[['Eigenes Bohrbild',esc($('customText').value||'—')+' · Skizze: '+esc($('uploadInput').files.length?$('uploadInput').files[0].name:'folgt per E-Mail')]]:[]),
    ['Preis', $('price').textContent+' inkl. MwSt. ('+(c.quelle==='katalog'?'Lagerpreis':'Sondermaß-Kurve')+')'],
  ];
  const hitP=shopHit();
  const props={...(hitP?{'_kfg_variant_id':hitP[1],'_kfg_sku':hitP[2]||''}:{}),
    '_kfg_config_url':location.href.slice(0,60)+'…','_kfg_material':S.mat,'_kfg_dekor':S.dekor,'_kfg_staerke_mm':S.thick,
    '_kfg_form':S.form,'_kfg_mass_cm':mass.replace(/ cm/g,''),'_kfg_kante':S.edges.join('|'),'_kfg_abs':S.absColor,
    ...(isLack()?{'_kfg_kante_lackiert':'ja'}:{}),
    ...(S.mat==='szwal'?{'_kfg_massband':S.massband+(S.massband!=='none'?`|${S.massbandNull||'links'}|${(massbandStrecke()||{}).len||0}cm`:''),
                         '_kfg_naehmaschine':S.machine||'','_kfg_maschinenmass':S.maschineMass}:{}),
    ...(S.form==='bauch'?(function(){ const g=bsGeo(), r=v=>Math.round(v*10)/10;
      return {'_kfg_bauch':`${bsWelle()?'welle':'trapez'}|${r(g.a)}|${r(g.b)}|${g.c}|${r(g.t)}|${g.w1}|${g.w2}|${S.bs.mittig?'mittig':'frei'}`,
              '_kfg_bauch_schnitt_cm':String(bsSchnittCm())}; })():{}),
    ...(S.form==='lform'?{'_kfg_lform':`${lfPos()}|${lfSchraeg()?'schraeg':'gerade'}|${lfGeo().winkel}|${Math.round(lfGeo().u*10)/10}`}:{}),
    ...(S.cuts.some(c2=>c2.t==='k')?{'_kfg_kabelkanal':S.cuts.filter(c2=>c2.t==='k')
      .map(c2=>`${Math.round(cutLen(c2))}cm x ${c2.w}mm x ${c2.dp}mm ${c2.seite}`).join(' | ')}:{}),
    ...(cornerCount()>0?{'_kfg_eckenradius_mm':cornerIdx().map(cornerR).join('/'),
      '_kfg_ecken':cornerIdx().filter(i=>cornerR(i)>0).map(i=>`${cornerName(i)}:R${cornerR(i)}`).join(' | ')}:{}),
    ...(S.cuts.length?{'_kfg_cuts':S.cuts.map(c2=>`${c2.preset||c2.t}:${c2.w}x${c2.h}@${c2.cx}/${c2.cy}`).join(';')}:{})};
  $('omData').innerHTML='<table>'+rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')+'</table>'
    +'<div class="props"><b>Technisch: Shopify Line-Item-Properties</b>'
    +Object.entries(props).map(([k,v])=>`${k}: ${esc(v)}`).join('<br>')+'</div>';
  $('orderModal').hidden=false;
}
$('omClose').addEventListener('click',()=>$('orderModal').hidden=true);
$('orderModal').addEventListener('click',e=>{if(e.target===$('orderModal'))$('orderModal').hidden=true});
/* Echter Abschluss (Sascha, 30.07.): Lagerartikel gehen als Shopify-Cart-
   Permalink direkt in den Checkout — der Preis kommt dort serverseitig von der
   Variante, nicht aus dem Client. Alles andere (Sondermass, CNC, Angebot) wird
   als vorbefuellte Anfrage an shop@kessler-pro.com geschickt. Das interne
   Demo-Modal bleibt fuer uns unter ?kfgdebug per Doppelklick erreichbar. */
function anfrageMail(){
  if(typeof _syncURLnow==='function') _syncURLnow();          /* Link aktuell halten */
  const preis=(($('price')||{}).textContent)||'—';
  const skizze=$('uploadInput')&&$('uploadInput').files.length?$('uploadInput').files[0].name:'';
  const zeilen=[
    'Konfiguration: '+location.href,
    'Preis lt. Konfigurator: '+preis+' inkl. MwSt.',
    ...(skizze?['Skizze: '+skizze+' (bitte an diese Mail anhaengen)']:[]),
    '',
    'Hinweis: Massanfertigungen nach Kundenspezifikation sind vom Widerruf ausgenommen (§ 312g Abs. 2 Nr. 1 BGB).',
    '',
    '(Skizze oder Fragen? Einfach in diese Mail schreiben oder anhaengen.)'
  ];
  location.href='mailto:shop@kessler-pro.com?subject='
    +encodeURIComponent('Anfrage Tischplatte nach Mass')
    +'&body='+encodeURIComponent(zeilen.join('\n'));
}
var _checkoutLaeuft=false;
/* Weiterleitung nur auf https und auf unsere bzw. Shopify-Domains (Review 08.09.) */
function checkoutUrlOk(u){ try{ const x=new URL(String(u)); if(x.hostname===location.hostname) return true; return x.protocol==='https:' && /(^|\.)(kessler-pro\.com|myshopify\.com|shopify\.com)$/.test(x.hostname); }catch(_){ return false; } }
/* Konfiguration als Draft Order anlegen lassen und in den Checkout gehen.
   Der Worker rechnet den Preis selbst nach — der hier mitgeschickte Betrag
   dient nur dem Abgleich. Schlaegt der Aufruf fehl, faellt es auf die
   Mail-Anfrage zurueck, damit der Kunde nie vor einer toten Taste steht. */
function checkoutStarten(){
  if(_checkoutLaeuft) return;
  if(typeof _syncURLnow==='function') _syncURLnow();
  const c=calc(), K=JSON.parse(JSON.stringify(S)); delete K.draw; delete K.view;
  const body={ version:VERSION, kanal:kanal(), sprache:KFG_LANG, url:location.href, base:(window.__KFG_BASE||''),
    preis:c.total, betrag_text:(($('price')||{}).textContent)||'',
    zeilen:[...document.querySelectorAll('#breakdown tr')].map(tr=>[...tr.children].map(td=>td.textContent)),
    konfig:K, lager:shopHit()?{variant:shopHit()[1], sku:shopHit()[2]}:null,
    maschine:S.machine||'', skizze:$('customText')?($('customText').value||''):'' };
  _checkoutLaeuft=true;
  const zurueck=knoepfeSperren('Kasse wird vorbereitet …');
  const ctl=new AbortController(); const tm=setTimeout(()=>ctl.abort(),15000);
  fetch(CHECKOUT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal})
    .then(r=>r.json().then(d=>({ok:r.ok,d})))
    .then(({ok,d})=>{ clearTimeout(tm);
      if(ok && d && checkoutUrlOk(d.checkoutUrl)){ ga('kfg_checkout',{preis:c.total}); location.href=d.checkoutUrl; return; }
      throw new Error((d&&d.fehler)||'kein checkoutUrl'); })
    .catch(e=>{ clearTimeout(tm); zurueck();
      toast('Bezahlen gerade nicht möglich — wir nehmen deine Anfrage per E-Mail');
      try{ ga('kfg_checkout_fehler',{grund:String(e&&e.message||e).slice(0,80)}); }catch(_){}
      setTimeout(anfrageMail, 900); });
}
/* ── Warenkorb (Senior 07.09.): die Platte landet im Shopyflow-Warenkorb der Seite,
   der Kunde kann weiter konfigurieren und eine zweite dazulegen. Lagerartikel gehen
   mit ihrer echten Variante hinein; Massplatten bekommen vom Worker eine eigene
   Variante mit festem Preis (Konfiguration als Positionsattribute + serverseitig). */
function shopyflow(){ const sf=window.Shopyflow||window.shopyflow; return sf && typeof sf.addToCart==='function' ? sf : null; }
function bodyFuerWorker(extra){
  if(typeof _syncURLnow==='function') _syncURLnow();
  const c=calc(), K=JSON.parse(JSON.stringify(S)); delete K.draw; delete K.view;
  return Object.assign({ version:VERSION, kanal:kanal(), sprache:KFG_LANG, url:location.href, preis:c.total,
    konfig:K, lager:shopHit()?{variant:shopHit()[1], sku:shopHit()[2]}:null, maschine:S.machine||'' }, extra||{});
}
/* Waehrend der Worker arbeitet, bleibt die Konfiguration eingefroren — sonst landet ein anderer
   Stand im Warenkorb als der, den der Kunde zuletzt sieht (Review 08.09., B6). */
function panelSperren(an){
  const l=document.querySelector('[data-kfg-root] .kfg_layout'); if(!l) return;
  l.classList.toggle('is-busy',!!an); if(an) l.setAttribute('aria-busy','true'); else l.removeAttribute('aria-busy');
}
function knoepfeSperren(text){
  const alt=$('cta').textContent, altB=($('ctaBuy')||{}).textContent, t=tr(text);
  [$('cta'),$('ctaBar'),$('ctaBuy'),$('ctaMini')].forEach(b=>{ if(b){ b.disabled=true; } });
  $('cta').textContent=t; $('ctaBar').textContent=t; if($('ctaMini')) $('ctaMini').textContent=t;
  panelSperren(true);
  return ()=>{ _checkoutLaeuft=false; panelSperren(false); [$('cta'),$('ctaBar'),$('ctaBuy'),$('ctaMini')].forEach(b=>{ if(b) b.disabled=false; }); $('cta').textContent=alt; $('ctaBar').textContent=alt; if($('ctaMini')) $('ctaMini').textContent=alt; if($('ctaBuy')) $('ctaBuy').textContent=altB; };
}
/* Zurueck per Browser-Zurueck aus der Kasse (bfcache): Sperre loesen, Knoepfe neu beschriften */
window.addEventListener('pageshow',e=>{ if(e.persisted){ _checkoutLaeuft=false; panelSperren(false); [$('cta'),$('ctaBar'),$('ctaBuy'),$('ctaMini')].forEach(b=>{ if(b) b.disabled=false; }); try{ render(); }catch(_){} } });
async function inWarenkorbLegen(variantId, attribute, menge){
  const sf=shopyflow(); if(!sf) throw new Error('kein Warenkorb');
  /* Shopyflow ohne eigenen Timeout: bleibt das Promise haengen, blieben die Knoepfe fuer immer gesperrt (Review 08.09., B5) */
  const frist=new Promise((_,ab)=>setTimeout(()=>ab(new Error('Warenkorb antwortet nicht')),12000));
  await Promise.race([Promise.resolve(sf.addToCart({ lineItems:[{ merchandiseId: variantId, quantity:(Number.isSafeInteger(menge)&&menge>0?menge:1), attributes: attribute||[] }], useShopifyId:true })), frist]);
  /* openCart: die Atelier-Oberflaeche oeffnet den Warenkorb selbst, erst am Ende */
}
function warenkorbStarten(){
  if(_checkoutLaeuft) return;
  const hit=nurLager()&&shopHit(), c=calc();
  _checkoutLaeuft=true;
  const zurueck=knoepfeSperren('Warenkorb wird vorbereitet …');
  const fertig=()=>{ zurueck(); toast('Platte liegt im Warenkorb — du kannst gleich eine weitere konfigurieren'); ga('kfg_warenkorb',{preis:c.total, typ: hit?'lager':'mass'}); };
  if(hit){
    if(!shopyflow()){ zurueck(); location.href='https://checkout.kessler-pro.com/cart/'+hit[1]+':1'; return; }
    inWarenkorbLegen('gid://shopify/ProductVariant/'+hit[1], []).then(fertig).catch(e=>{ zurueck(); toast('Warenkorb gerade nicht möglich — wir bringen dich direkt zur Kasse'); setTimeout(()=>{ location.href='https://checkout.kessler-pro.com/cart/'+hit[1]+':1'; }, 900); });
    return;
  }
  if(!WARENKORB_URL || !shopyflow()){ _checkoutLaeuft=false; zurueck(); checkoutStarten(); return; }
  const ctl=new AbortController(); const tm=setTimeout(()=>ctl.abort(),20000);
  fetch(WARENKORB_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bodyFuerWorker()),signal:ctl.signal})
    .then(r=>r.json().then(d=>({ok:r.ok,d})))
    .then(({ok,d})=>{ clearTimeout(tm); if(!(ok && d && d.variantId)) throw new Error((d&&d.fehler)||'keine Variante');
      /* Eine nackte Lagervariante darf nur ohne jede Bearbeitung in den Warenkorb (Review 08.09., A2) */
      if(d.lager && !nurLager()) throw new Error('Lagervariante passt nicht zur Konfiguration');
      return inWarenkorbLegen(d.variantId, d.attribute||[]); })
    .then(fertig)
    .catch(e=>{ clearTimeout(tm); zurueck();
      try{ ga('kfg_warenkorb_fehler',{grund:String(e&&e.message||e).slice(0,80)}); }catch(_){}
      /* Rueckfall: direkt zur Kasse ueber den bewaehrten Weg (Draft Order) */
      toast('Warenkorb gerade nicht möglich — wir bringen dich direkt zur Kasse');
      setTimeout(checkoutStarten, 900); });
}
/* Sofortkauf: eigener Warenkorb nur mit dieser Platte, direkt zur Kasse — der
   Shopyflow-Warenkorb des Kunden bleibt, wie er ist. Rueckfall: Draft Order. */
function sofortkaufStarten(){
  if(_checkoutLaeuft) return;
  const hit=nurLager()&&shopHit(), c=calc();
  ga('kfg_sofortkauf',{preis:c.total, typ: hit?'lager':'mass'});
  if(hit){ location.href='https://checkout.kessler-pro.com/cart/'+hit[1]+':1'; return; }
  if(!WARENKORB_URL){ checkoutStarten(); return; }
  _checkoutLaeuft=true;
  const zurueck=knoepfeSperren('Kasse wird vorbereitet …');
  const ctl=new AbortController(); const tm=setTimeout(()=>ctl.abort(),20000);
  fetch(WARENKORB_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bodyFuerWorker({sofort:true})),signal:ctl.signal})
    .then(r=>r.json().then(d=>({ok:r.ok,d})))
    .then(({ok,d})=>{ clearTimeout(tm); if(ok && d && checkoutUrlOk(d.checkoutUrl)){ location.href=d.checkoutUrl; return; } throw new Error((d&&d.fehler)||'kein checkoutUrl'); })
    .catch(e=>{ clearTimeout(tm); zurueck(); setTimeout(checkoutStarten, 200); });
}
function ctaKlick(){
  if(!validate()){ toast('Bitte zuerst die Maße korrigieren'); return; }
  const hit=nurLager() && shopHit();
  ga('kfg_cta',{typ: hit?'lager':(kannBezahlen()?'warenkorb':'anfrage'), preis: (($('price')||{}).textContent)||''});
  if(hit || kannBezahlen()){ warenkorbStarten(); return; }
  anfrageMail();
}
$('cta').addEventListener('click',ctaKlick);
$('ctaBar').addEventListener('click',()=>$('cta').click());
if($('ctaMini')) $('ctaMini').addEventListener('click',()=>$('cta').click());
if($('ctaBuy')) $('ctaBuy').addEventListener('click',()=>{ if(!validate()){ toast('Bitte zuerst die Maße korrigieren'); return; } const hit=nurLager()&&shopHit(); if(hit||kannBezahlen()) sofortkaufStarten(); else anfrageMail(); });
if(location.search.indexOf('kfgdebug')>-1){
  $('cta').addEventListener('dblclick',openOrder);            /* interne Ansicht */
}
$('btnShare').addEventListener('click',()=>{
  if(typeof _syncURLnow==='function') _syncURLnow();          /* sonst 250 ms alter Link */
  const u=location.href, ok=()=>toast('Link kopiert, Konfiguration teilbar');
  const rueckfall=()=>{ try{ const ta=document.createElement('textarea'); ta.value=u; ta.setAttribute('readonly',''); ta.style.cssText='position:fixed;opacity:0;top:0;left:0'; document.body.appendChild(ta); ta.select(); const d=document.execCommand('copy'); document.body.removeChild(ta); if(d) ok(); else window.prompt('Link zum Kopieren:', u); }catch(_){ window.prompt('Link zum Kopieren:', u); } };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(ok).catch(rueckfall); else rueckfall();
});
$('btnMail').addEventListener('click',()=>{                  /* Konfiguration teilen */
  if(typeof _syncURLnow==='function') _syncURLnow();
  location.href='mailto:?subject='+encodeURIComponent('Meine Tischplatte von Kessler PRO')
    +'&body='+encodeURIComponent('Schau mal, die habe ich konfiguriert: '+location.href);
});
$('btnMuster').addEventListener('click',()=>{                 /* Musterbox anfragen */
  ga('kfg_muster',{});
  let dek=''; try{ dek=calc().dekorName||''; }catch(_){}
  location.href='mailto:shop@kessler-pro.com?subject='+encodeURIComponent('Musterbox-Bestellung')
    +'&body='+encodeURIComponent('Bitte um die Musterbox (4 Dekore, '+fmt(zl(4.9))+' — beim Kauf voll angerechnet).\nWunsch-Dekor: '+dek+'\n\nLieferadresse:\n');
});

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
  if(c.preset) return zl(PRESETS[c.preset].price);
  if(c.t==='k') return zl(Math.round((KANAL_PRICE.basis + kanalLfmPreis(c.w,c.dp)*cutLen(c)/100)*10)/10);
  return freierAusschnitt(cutLen(c)/100);
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
  if(S.form==='lform'||S.form==='bauch'){
    const ecken=[[c.cx-w/2,c.cy-h/2],[c.cx+w/2,c.cy-h/2],[c.cx-w/2,c.cy+h/2],[c.cx+w/2,c.cy+h/2]];
    const drin=S.form==='bauch'?bsImAusschnitt:lfInNotch;
    if(ecken.some(([px,py])=>drin(px,py))) return 'Liegt im Ausschnitt — bitte verschieben';
  }
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
  let [cx,cy]=k==='maschine'?maschineStart():p.pos(d.w,d.h,n);
  const w=p.t==='c'?p.d:(k==='maschine'?maschineMass()[0]:p.w), hh=p.t==='c'?p.d:(k==='maschine'?maschineMass()[1]:p.h);
  if(w>d.w-2||hh>d.h-2){toast(p.label+' passt nicht auf diese Plattengröße');return;}
  cx=Math.max(w/2,Math.min(d.w-w/2,cx)); cy=Math.max(hh/2,Math.min(d.h-hh/2,cy));
  S.cuts.push(p.t==='c'?{t:'c',preset:k,cx,cy,d:p.d,w:p.d,h:p.d}:{t:'r',preset:k,cx,cy,w,h:hh});
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
  pl.style.backgroundImage=`url(${TEX[texKey()]})`;
  pl.style.backgroundColor='';
  pl.classList.toggle('is-round',S.form==='round');
  /* Eckenradien in der Miniatur andeuten, damit man beim Scrollen sieht,
     was die Eckenfelder bewirken. Skaliert auf die Miniaturhoehe. */
  if(S.form==='rect'){
    const h=34, sk=h/(d.h*10);
    pl.style.borderRadius=[0,1,2,3].map(i=>Math.min(12,Math.round(cornerR(i)*sk))+'px').join(' ');
  } else if(S.form!=='round'){ pl.style.borderRadius='4px'; } else { pl.style.borderRadius=''; }
  const mass=S.form==='round'?`Ø ${S.D} cm`
    :S.form==='lform'?`${S.lf.L} × ${S.lf.B} cm · L-Form`
    :S.form==='bauch'?`${S.bs.L} × ${S.bs.BR} cm · Bauchausschnitt`:`${S.L} × ${S.B} cm`;
  $('miniTitle').textContent=mass;
  $('miniSub').textContent=`${MATERIALS[S.mat].name} · ${c.dekorName} · ${c.thickName}`;
}
/* Achtung: das toggle-Ereignis von <details> kommt auch beim programmatischen
   Setzen von .open vom Browser (isTrusted:true). Ohne eigenen Schalter haette
   sich der Konfigurator jede automatische Umschaltung als Nutzerwunsch gemerkt
   und danach nie wieder von selbst aufgeklappt. */
function setDetailAuto(d, offen){
  if(KFG_TOUCH) return;                    /* Touch: Karte schaltet nie von selbst */
  if(!d || d.open===offen) return;
  d.dataset.auto='1'; d.open=offen;
  setTimeout(()=>{ delete d.dataset.auto; }, 0);
}
(function(){ const d=$('detailCard'); if(d) d.addEventListener('toggle',()=>{
  if(d.dataset.auto) return;                   /* vom Konfigurator umgeschaltet */
  d.dataset.manual='1';                        /* vom Nutzer bedient */
  if(d.open && window.__kfgKantePend){
    const im=$('detailImg'); if(im){ im.src=window.__kfgKantePend; window.__kfgKantePend=null; }
  }
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
function placeSummary(){ return; // Layout owned by atelier UI

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
/* ══════ Sprache ══════════════════════════════════════════════════════════
   Die Seite laeuft unter /pl-pl/ bzw. /en/. Massgeblich ist das lang-Attribut
   des Dokuments, der Pfad ist nur der Rueckfall — Webflow setzt lang zuverlaessig,
   aber bei lokalen Spiegeln fehlt es manchmal. */
var KFG_LANG = (function(){
  const l=(document.documentElement.getAttribute('lang')||'').toLowerCase();
  if(l.startsWith('pl')) return 'pl';
  if(l.startsWith('en')) return 'en';
  if(l.startsWith('de')) return 'de';
  const p=location.pathname.toLowerCase();
  if(p.startsWith('/pl-pl/')||p.startsWith('/pl/')) return 'pl';
  if(p.startsWith('/en/')) return 'en';
  return 'de';
})();
var _kfgWB=null, _kfgWM=null;          /* Woerterbuch und Muster */

/* Ein Text wird zuerst als Ganzes gesucht. Nur wenn das misslingt, laufen die
   Muster — sie fangen die Texte ab, die zur Laufzeit aus Zahlen entstehen
   ("Bitte 30 bis 270 cm eingeben"). */
/* ═══════ Woerter des Bauchausschnitts (v1.19.0) ═══════
   Er kam nach der letzten Fassung von kfg-i18n.json; bis die Sprachdatei
   nachgezogen ist, liegen seine Woerter hier und werden ueber das geladene
   Woerterbuch gelegt. Sobald sie in kfg-i18n.json stehen, kann dieser Block
   ersatzlos entfallen — die Schluessel sind identisch. */
function tr(txt){
  if(!_kfgWB) return txt;
  const k=txt.trim();
  if(!k) return txt;
  const u=trKern(k);
  return u===k ? txt : txt.replace(k,u);
}
/* Vier Anlaeufe, in dieser Reihenfolge:
   ① der Text als Ganzes
   ② dasselbe mit normalisiertem geschuetztem Leerzeichen (im Markup steht
      &nbsp;, im Woerterbuch ein normales Leerzeichen)
   ③ ohne fuehrendes Symbol ("\u25ad Rechteck" -> "Rechteck")
   ④ segmentweise an " \u00b7 " — die meisten zusammengesetzten Zeilen der
      Oberflaeche sind mit diesem Trenner gebaut ("Moebelplatte \u00b7 25 mm") */
function trKern(k){
  let t=_kfgWB[k];
  if(t!==undefined) return t;

  const norm=k.replace(/\u00a0/g,' ');
  if(norm!==k){ t=_kfgWB[norm]; if(t!==undefined) return t; }

  const m=norm.match(/^([^\p{L}\p{N}]+\s*)(.+)$/u);
  if(m){ t=_kfgWB[m[2]]; if(t!==undefined) return m[1]+t; }

  if(_kfgWM) for(const [re,rp] of _kfgWM){
    const m2=norm.match(re);
    if(m2) return rp.replace(/\$(\d)/g, (_,i)=>{ const g=m2[+i]; return g===undefined ? '' : trGruppe(g,0); });
  }

  const seg=trSeg(norm);
  if(seg!==norm) return seg;
  return k;
}
/* Zerlegt an " \u00b7 " und uebersetzt jedes Stueck einzeln. Die Oberflaeche baut
   fast alle zusammengesetzten Zeilen mit diesem Trenner. */
/* Trenner der Oberflaeche, vom groben zum feinen: " · " (Zeilen), " + " (Zusaetze),
   ", " (Aufzaehlungen wie "vorne links, hinten rechts"). Jedes Stueck wird erst als
   Ganzes gesucht, dann ueber die Muster, dann weiter zerlegt. */
const TR_TRENNER=[' \u00b7 ',' + ',', '];
/* Gruppe eines Musters uebersetzen: Ganzes → ohne fuehrendes Symbol ("· Weiß") → zerlegt */
function trGruppe(g, tiefe){
  if(_kfgWB[g]!==undefined) return _kfgWB[g];
  const mm=g.match(/^([^\p{L}\p{N}]+\s*)(.+)$/u);
  if(mm && _kfgWB[mm[2]]!==undefined) return mm[1]+_kfgWB[mm[2]];
  if(mm){ const w=trSeg(mm[2],tiefe); if(w!==mm[2]) return mm[1]+w; }
  return trSeg(g,tiefe);
}
function trSeg(txt, tiefe){
  tiefe=tiefe||0;
  if(!txt) return txt;
  const sep=TR_TRENNER.find(t=>txt.includes(t));
  if(!sep) return txt;
  let treffer=false;
  const neu=txt.split(sep).map(p=>{
    const q=p.trim();
    let v=_kfgWB[q];
    if(v===undefined){
      const mm=q.match(/^([^\p{L}\p{N}]+\s*)(.+)$/u);
      if(mm && _kfgWB[mm[2]]!==undefined) v=mm[1]+_kfgWB[mm[2]];
    }
    if(v===undefined && _kfgWM && tiefe<3){
      for(const [re,rp] of _kfgWM){ const m2=q.match(re); if(m2){ v=rp.replace(/\$(\d)/g,(_,i)=>{ const g=m2[+i]; return g===undefined ? '' : trGruppe(g,tiefe+1); }); break; } }
    }
    if(v===undefined && tiefe<3){ const w=trSeg(q,tiefe+1); if(w!==q) v=w; }
    if(v!==undefined){ treffer=true; return v; }
    return p;
  });
  return treffer ? neu.join(sep) : txt;
}
/* Laeuft ueber die fertigen Textknoten. Bewusst NUR unter [data-kfg-root] und
   bewusst ohne MutationObserver: der wuerde bei jedem Neuzeichnen erneut
   feuern und sich selbst triggern. */
var ATTR_TR=['placeholder','aria-label','title','alt'];
function uebersetze(wurzel){
  if(!_kfgWB) return;
  const root=wurzel||document.querySelector('[data-kfg-root]'); if(!root) return;
  const w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      if(!n.nodeValue || !/[A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df]/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
      const p=n.parentNode;
      if(p && (p.nodeName==='SCRIPT'||p.nodeName==='STYLE')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
  let n;
  while((n=w.nextNode())){
    const neu=tr(n.nodeValue);
    if(neu!==n.nodeValue) n.nodeValue=neu;
  }
  root.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(el=>{
    ATTR_TR.forEach(a=>{
      const v=el.getAttribute(a); if(!v) return;
      const neu=tr(v); if(neu!==v) el.setAttribute(a,neu);
    });
  });
}
function ladeSprache(){
  if(KFG_LANG==='de') return Promise.resolve();
  /* beim Parsen gestartet (I18N_P); nur ein data-kfg-base-Override holt selbst */
  const p = (I18N_P && (window.__KFG_BASE||'')===BASE) ? I18N_P
    : fetch((window.__KFG_BASE||'') + '/dist/data/kfg-i18n.json').then(r=>r.ok?r.json():null);
  return p
    .then(d=>{
      if(!d||!d[KFG_LANG]) return;
      /* Der Bauchausschnitt kam nach der letzten Sprachdatei — seine Woerter
         liegen deshalb im Skript und werden hier daruebergelegt (v1.19.0). */
      _kfgWB=d[KFG_LANG];
      _kfgWM=(d.muster&&d.muster[KFG_LANG]||[])
        .map(([p,r])=>[p instanceof RegExp?p:new RegExp(p), r.replace(/\$(\d)/g,'$$$1')]);
    })
    .catch(()=>{});
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
  const neu = Math.round(ziel/m*10)/10;
  if(neu===_dimFS) return;              /* unveraendert → kein Neuzeichnen (vorher 2–3x je Render) */
  _dimFS = neu;
  st.style.setProperty('--dim-fs', _dimFS+'px');
  st.style.setProperty('--dim-halo', Math.round(3.6/m*10)/10+'px');
  if(typeof drawStage==='function' && G) drawStage();   /* Abstaende haengen an _dimFS */
}
function updateSticky(){ return; // Layout owned by atelier UI

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
    const cap=Math.round(window.innerHeight*0.40)+'px';   /* 0.46 bis v1.17.9 — die Preiszeile braucht Platz */
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
  /* iOS: innerHeight zappelt mit der URL-Leiste (+-60-80 px). Auf Touch wird
     die Hoehe gelatcht und erst ab 120 px Differenz (Rotation, echtes Resize)
     neu uebernommen - sonst resized die Buehne bei jedem Scrollen. */
  const vhJetzt = window.innerHeight;
  if(!window.__kfgVH || Math.abs(vhJetzt - window.__kfgVH) > 120) window.__kfgVH = vhJetzt;
  const platz=(KFG_TOUCH ? window.__kfgVH : vhJetzt)-12-16;   /* Kopfleiste weicht beim Scrollen */
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
  /* Touch: kompaktere Draufsicht. MIN[0]=620 machte die Sticky-Spalte auf dem
     iPhone fast bildschirmfuellend - fuers Panel blieb ein schmaler Streifen,
     Ziele lagen halb unter der Spalte, Taps verhungerten (Befund 29.07.). */
  const MIN = KFG_TOUCH ? [340,300,260,220,160] : [620,560,480,400,240];
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
function kopfleisteZeigen(zeigen){ return;

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
      updateBottomBar();
      /* Die Kopfleiste kommt NUR ganz oben zurueck, nicht bei jedem Hochwischen
         (Befund Sascha 29.07.: "das nervt"). Auf dieser Seite hat sie unterwegs
         nichts zu suchen — gesucht wird im Konfigurator, nicht im Menue. */
      kopfleisteZeigen(y < 80);
    });
  }, {passive:true});
})();

/* Am Desktop erscheint die Leiste erst, wenn das Werkzeug nach oben aus dem
   Bild gescrollt ist. Solange es sichtbar ist, wandert die Preiskarte ohnehin
   mit und eine zweite Leiste waere doppelt (Sascha 27.07.). Wer aber unter dem
   Konfigurator liest, soll nicht hochscrollen muessen (Sascha 29.07.). */
/* Der Fussbereich der Seite. Einmal suchen und merken - er wandert nicht. */
/* Meldungen laufen an render() vorbei — deshalb hier direkt uebersetzen. */
function toast(m){ return toast_roh(_kfgWB ? tr(m) : m); }
var _kfgFuss;
function fussEl(){
  if(_kfgFuss!==undefined) return _kfgFuss;
  return (_kfgFuss = document.querySelector('footer.footer-wrapper, footer, .footer-wrapper') || null);
}
function updateBottomBar(){ return; // Layout owned by atelier UI

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
  const nachmessen=()=>{ clearTimeout(sT); sT=setTimeout(()=>{ updateSticky(); if(_kfgWB) uebersetze(); }, 80); };
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
  KURVEN = kurvenData || {};

  /* Ein kaputter Link darf das Werkzeug nicht toeten (Review 08.09., B4) */
  try{ restoreFromHash(); }catch(e){ try{ console.warn('kfg: Link nicht lesbar', e && e.message); }catch(_){} }
  seedMaschine();
  buildAll(); placeSummary(); render(); initMini(); initSteps();
  if(KFG_TOUCH){                            /* kompakter Start auf dem Telefon */
    const d=$('detailCard');
    if(d && d.open){ d.dataset.auto='1'; d.open=false; setTimeout(()=>{ delete d.dataset.auto; },0); }
  }
  document.addEventListener('touchstart',function(){},{passive:true});  /* :active auf iOS */
  ensureTex(texKey());                       /* aktuelles Dekor sofort in voll */
  setTimeout(texVorladen, KFG_TOUCH ? 3000 : 1200);
  ga('kfg_start',{});
  ['inL','inB','inD'].forEach(function(id){
    const el=$(id); if(el) el.addEventListener('change',function(){
      ga('kfg_mass',{form:S.form, l:+S.L||+S.D||0, b:+S.B||0});
    });
  });
  const s5=stepEl(5);
  if(s5){
    s5.addEventListener('click',function(e){
      const st=e.target.closest && e.target.closest('[data-inc],[data-dec]');
      if(!st) return;
      const p=e.target.closest('[data-preset]');
      ga('kfg_extra',{preset:(p&&p.dataset.preset)||'', richtung: st.hasAttribute('data-inc')?'plus':'minus'});
    });
    s5.addEventListener('change',function(e){
      if(e.target && e.target.matches && e.target.matches('[data-x]'))
        ga('kfg_extra',{preset:e.target.dataset.x, richtung: e.target.checked?'an':'aus'});
    });
  }
  /* Sprachdatei nachladen und einmal druebergehen. render() uebersetzt danach
     bei jedem Neuzeichnen selbst. Bewusst NICHT blockierend: lieber kurz
     deutsch als ein leeres Werkzeug, wenn die Datei haengt. */
  ladeSprache().then(uebersetze);

  { const b=$('datenNeu'); if(b) b.addEventListener('click', function(){
      b.disabled=true; b.textContent='Lade …';
      const fn=window.__KFG_NACHLADEN; (fn?fn():Promise.resolve()).then(function(){ b.disabled=false; b.textContent='Erneut laden'; if(ohneDaten()) toast('Preise sind weiterhin nicht erreichbar — bitte später noch einmal versuchen'); else toast('Preise geladen'); }).catch(function(){ b.disabled=false; b.textContent='Erneut laden'; });
    }); }
  window.KFG = {
    version: VERSION,
    atelier: {
      snapshot: function(){ return { config:JSON.parse(JSON.stringify(S)), price:calc(), standard:isStandard(), offer:needsOffer(), valid:validate(), dims:dims(), material:MATERIALS[S.mat], dekore:dekorList(), texture:TEX[texKey()], edgePhoto:edgePhoto(), edgeNames:[...new Set(S.edges.map(edgeLabel))], cornerLabel:cornerLabel(), rules:rules(), cuts:S.cuts.map(c=>({label:cutTypName(c),mass:cutMass(c),price:cutPrice(c),warning:cutWarn(c)})), minEdge:cutMinEdge(), shape:S.form==='lform'?lfPts():S.form==='bauch'?bsPts():null }; },
      setView:setView, frame:frame3D, render:render, syncLink:_syncURLnow,
      workerBody:bodyFuerWorker,
      defaultConfig:function(){return JSON.parse(JSON.stringify(ATELIER_DEFAULT));},
      textureInfo:function(){return ATELIER_ATLASES[texKey()]||null;},
      cornerDetails:atelierCornerDetails,
      outline:function(){ if(S.form==='round')return null; const g=S.form==='lform'?lfPts():S.form==='bauch'?bsPts():null; return g?roundPoly(g.pts,g.rad):roundPath(0,0,+S.L,+S.B,S.cornerR.map(r=>r/10)); },
      material:function(k){ const b=document.querySelector('#matGrid [data-m="'+k+'"]'); if(b)b.click(); },
      shape:function(k){ const b=document.querySelector('#formChips [data-form="'+k+'"]'); if(b)b.click(); },
      preset:addPreset,
      cutLabel:cutTypName,
      assetBase:function(){ return ASSET; },
      orderIntent:function(){
        const hit=nurLager()&&shopHit();
        return { body: bodyFuerWorker(), lager: hit?{variantId:'gid://shopify/ProductVariant/'+hit[1], sku:hit[2]}:null, anfrage: !kannBezahlen() && !hit };
      },
      checkout:async function(intent, menge){
        const m=Number.isSafeInteger(menge)&&menge>0?menge:1;
        if(!shopyflow()) throw new Error('Der Warenkorb des Shops ist gerade nicht erreichbar');
        if(intent && intent.lager) return inWarenkorbLegen(intent.lager.variantId, [], m);
        if(!WARENKORB_URL) throw new Error('Kein Warenkorb-Endpunkt hinterlegt');
        const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),20000);
        try{
          const r=await fetch(WARENKORB_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(intent.body),signal:ctl.signal});
          const d=await r.json().catch(()=>null);
          if(!(r.ok && d && d.variantId)) throw new Error((d&&d.fehler)||'Der Shop hat keine Variante geliefert');
          /* Der Server rechnet selbst nach: weicht sein Preis ab, wird nichts gelegt. */
          if(isFinite(+intent.body.preis) && isFinite(+d.preis) && Math.abs(+d.preis - +intent.body.preis) > 0.011)
            throw new Error('Der Preis hat sich geändert - bitte die Platte neu prüfen');
          return await inWarenkorbLegen(d.variantId, d.attribute||[], m);
        } finally { clearTimeout(tm); }
      },
      openCart:function(){ const sf=shopyflow(); try{ if(sf && typeof sf.openCart==='function') sf.openCart(); }catch(_){} },
      inquiry:anfrageMail,
      /* Die neue Oberflaeche schreibt Text nach dem Render des Kerns - die
         Wortliste laeuft danach noch einmal darueber. Dialoge liegen an <body>
         und muessen einzeln uebergeben werden. */
      translate:function(el){ try{ uebersetze(el||undefined); }catch(_){} },
      lang:function(){ return KFG_LANG; },
      /* Erst wenn die Wortliste da ist, lohnt ein zweiter Lauf ueber die Dialoge. */
      wortlisteDa:function(){ return !!_kfgWB; },
      money:fmt,
      shipping:function(){ return { betrag: kanal()==='pln' ? 84.90 : 19.99, text: VERSAND_MASS[kanal()] }; }
    },
    getConfig: function(){ return JSON.parse(JSON.stringify(S)); },
    setConfig: function(patch){ Object.assign(S, patch||{}); [["inL",S.L],["inB",S.B],["inD",S.D]].forEach(([id,v])=>{if($(id))$(id).value=v;}); buildAll(); render(); },
    reload: function(){ const fn=window.__KFG_NACHLADEN; return fn ? fn().then(function(){ return true; }) : (render(), Promise.resolve(false)); },
    /* Daten nachtraeglich einspielen (spaete Antwort, Neuladen) */
    _daten: function(shop, kurven){ SHOP=shop||{}; KURVEN=kurven||{}; buildAll(); render(); },
    _debug: function(){ return { S:S, shopArtikel:Object.keys(SHOP).length, treffer:shopHit(), drei:three }; }
  };
}
})();


/* ── Atelier-Oberflaeche (Codex-Entwurf 10.09.2026, fuer Webflow gescopt) ── */
(function(){
if(window.__KFG_ATELIER)return; window.__KFG_ATELIER=true;
/* Huelle fuer die Webflow-Seite: das Stylesheet der Vorschau lag als eigene Datei
   neben index.html, die Dialoge standen fest im HTML. Auf der Seite bringt das
   Skript beides selbst mit, damit in Webflow nur ein leerer Container noetig ist. */
(function(){
  var css=":is(#atelier,.atelier_dialog){font-family:Onest,system-ui,-apple-system,'Segoe UI',sans-serif;font-synthesis:none;color:var(--ink);-webkit-font-smoothing:antialiased}:is(#atelier,.atelier_dialog) :is(h1,h2,h3,h4,h5,h6,p,li,dt,dd,summary,label,small,strong,b,em,figcaption){font-family:inherit;color:inherit;letter-spacing:normal;text-transform:none}:root{--paper:#fff;--surface:#f4f4f5;--ink:#0a0a0a;--body:#5c5c5e;--line:#dcdcdd;--green:#0a7c47;--error:#a72d27;--radius:8px}:is(#atelier,.atelier_dialog) *{box-sizing:border-box}:is(#atelier,.atelier_dialog) button,:is(#atelier,.atelier_dialog) input,:is(#atelier,.atelier_dialog) select,:is(#atelier,.atelier_dialog) textarea{font:inherit}:is(#atelier,.atelier_dialog) button,:is(#atelier,.atelier_dialog) a,:is(#atelier,.atelier_dialog) input,:is(#atelier,.atelier_dialog) select,:is(#atelier,.atelier_dialog) textarea{-webkit-tap-highlight-color:transparent}:is(#atelier,.atelier_dialog) button{cursor:pointer;color:inherit}:is(#atelier,.atelier_dialog) a{color:inherit;text-underline-offset:4px}:is(#atelier,.atelier_dialog) button:disabled{cursor:not-allowed;opacity:.45}:is(#atelier,.atelier_dialog) button:focus-visible,:is(#atelier,.atelier_dialog) a:focus-visible,:is(#atelier,.atelier_dialog) input:focus-visible,:is(#atelier,.atelier_dialog) select:focus-visible,:is(#atelier,.atelier_dialog) summary:focus-visible,:is(#atelier,.atelier_dialog) textarea:focus-visible{outline:2px solid #0a7c47!important;outline-offset:4px}:is(#atelier,.atelier_dialog) input{caret-color:var(--green)}:is(#atelier,.atelier_dialog) [hidden]{display:none!important}:is(#atelier,.atelier_dialog) svg{flex-shrink:0}:is(#atelier,.atelier_dialog) h1,:is(#atelier,.atelier_dialog) h2,:is(#atelier,.atelier_dialog) h3,:is(#atelier,.atelier_dialog) p{margin:0}:is(#atelier,.atelier_dialog) p{line-height:1.6}:is(#atelier,.atelier_dialog) button svg,:is(#atelier,.atelier_dialog) .text_button svg,:is(#atelier,.atelier_dialog) .primary_button svg{width:20px;height:20px}:is(#atelier,.atelier_dialog) button,:is(#atelier,.atelier_dialog) a{touch-action:manipulation}.atelier_dialog::backdrop{background:rgba(10,10,10,.4)}:is(#atelier,.atelier_dialog) .sr_only{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important}:is(#atelier,.atelier_dialog) .loading{padding:80px 32px;text-align:center}:is(#atelier,.atelier_dialog) .text_button{padding:0;border:0;background:transparent;display:inline-flex;align-items:center;gap:8px;min-height:44px;font-size:13px;text-decoration:underline;text-underline-offset:4px}:is(#atelier,.atelier_dialog) .icon_button{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;border-radius:8px;font-size:26px;flex-shrink:0}:is(#atelier,.atelier_dialog) .icon_button:hover{background:#e8e8e9}:is(#atelier,.atelier_dialog) .primary_button,:is(#atelier,.atelier_dialog) .secondary_button{min-height:52px;padding:14px 22px;display:inline-flex;align-items:center;justify-content:center;gap:14px;text-decoration:none;border:1px solid var(--ink);background:var(--ink);color:#fff;border-radius:8px;font-size:14px;font-weight:600;line-height:1.35}:is(#atelier,.atelier_dialog) .secondary_button{background:#fff;color:var(--ink)}:is(#atelier,.atelier_dialog) .primary_button:hover{background:#333}:is(#atelier,.atelier_dialog) .secondary_button:hover{background:#f5f5f5}:is(#atelier,.atelier_dialog) .muted{color:var(--body)}/* Higher specificity isolates this surface from the inherited core's visual rules. */#atelier{min-height:0;--ink:#0a0a0a;--deep:#0a0a0a;--card:#f4f4f5;--alt:#fafafa;--hair:#dcdcdd;--ok:#0a7c47;font-size:15px;line-height:1.5}#atelier *{box-sizing:border-box}#atelier .atelier_shell{max-width:1440px;padding:0;margin:0 auto}#atelier .page_intro{display:flex;align-items:center;justify-content:space-between;gap:32px;padding:40px 0 32px}#atelier h1{font-size:40px;line-height:1.15;letter-spacing:-1.3px;font-weight:500;text-wrap:balance}#atelier .page_intro p{font-size:15px;color:var(--body);margin-top:10px}#atelier .page_intro .text_button{white-space:nowrap}#atelier .step_nav{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:32px;scroll-margin-top:24px}#atelier .step_nav button{display:flex;align-items:center;gap:12px;padding:19px 8px;border:0;border-bottom:2px solid transparent;background:transparent;color:#636365;font-size:14px;text-align:left;position:relative}#atelier .step_nav button>svg{width:16px;height:16px;color:#b3b3b5;margin-left:auto;margin-right:30px}#atelier .step_nav button[aria-current]{border-bottom-color:var(--ink);color:var(--ink);font-weight:600}#atelier .step_nav button[data-complete] .step_number{color:var(--green)}#atelier .step_number{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums}#atelier .workbench{display:grid;grid-template-columns:1.15fr 1fr;gap:64px;align-items:start}#atelier .work_preview{position:sticky;top:24px;min-width:0}#atelier .preview_surface{background:var(--surface);border-radius:16px;overflow:hidden;padding:16px 20px 24px;position:relative}#atelier .preview_toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px}#atelier .view_switch{display:flex;gap:0;border:1px solid #d1d1d3;border-radius:8px;overflow:hidden;background:transparent}#atelier .view_switch button{min-height:40px;padding:10px 14px;border:0;background:transparent;font-size:12px;font-weight:500;color:var(--body)}#atelier .view_switch button.is-active{background:#fff;color:var(--ink)}#atelier .preview_canvas{width:100%;position:relative;height:430px;display:flex;align-items:center;justify-content:center}#atelier #stage,#atelier #stage3d{width:100%!important;height:100%!important;max-height:none!important;aspect-ratio:auto;object-fit:contain}#atelier #stage3d{cursor:grab;touch-action:none}#atelier .preview_caption{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:0 8px}#atelier .preview_caption strong{font-weight:500;font-size:26px;letter-spacing:-.6px;display:block}#atelier .preview_caption span{font-size:13px;color:var(--body);display:block}#atelier #viewHint{font-size:11px;text-align:right;padding-bottom:3px}#atelier .preview_facts{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:16px;padding:24px 0;border-bottom:1px solid var(--line)}#atelier .preview_facts span{display:block;font-size:12px;color:var(--body);margin-bottom:5px}#atelier .preview_facts strong{font-size:15px;font-weight:500}#atelier .edge_preview{display:flex;align-items:center;gap:24px;padding:24px 0;border:0;background:transparent;width:100%;text-align:left}#atelier .edge_preview img{width:128px;height:96px;object-fit:cover;border-radius:8px;mix-blend-mode:multiply}#atelier .edge_preview>span{flex:1}#atelier .edge_preview b{display:block;font-size:15px;font-weight:500}#atelier .edge_preview span span{display:block;font-size:13px;color:var(--body);margin:4px 0 10px}#atelier .edge_preview small{font-size:12px;text-decoration:underline;text-underline-offset:4px}#atelier .edge_preview>svg{width:16px}#atelier .preview_note{font-size:12px;line-height:1.6;color:var(--body);max-width:58ch;padding-top:8px}#atelier .work_controls{min-width:0}#atelier .panel_heading{margin:2px 0 24px}#atelier .panel_heading h2{font-size:26px;font-weight:500;letter-spacing:-.65px;line-height:1.2}#atelier .panel_heading h2:focus{outline:none}#atelier .panel_heading p{font-size:14px;color:var(--body);margin-top:8px;line-height:1.6}#atelier .material_choices{display:flex;flex-direction:column;gap:0}#atelier .material_choice{width:100%;border:0;border-bottom:1px solid var(--line);background:#fff;display:flex;align-items:center;gap:18px;text-align:left;padding:12px 8px 12px 0;min-height:92px;border-radius:0;position:relative}#atelier .material_choice:first-child{border-top:1px solid var(--line)}#atelier .material_choice img{width:100px;height:68px;object-fit:cover;border-radius:6px;background:#f4f4f5}#atelier .material_choice>span:nth-child(2){flex:1;min-width:0}#atelier .material_choice b{font-size:16px;font-weight:500;display:block;margin-bottom:4px}#atelier .material_choice small{font-size:12px;color:var(--body);display:block;line-height:1.5}#atelier .selection_check{width:24px;height:24px;border:1px solid #99999b;border-radius:50%;display:grid;place-items:center}#atelier .selection_check svg{width:15px;height:15px;opacity:0}#atelier .material_choice[aria-pressed=\"true\"] .selection_check{background:var(--ink);border-color:var(--ink);color:#fff}#atelier .material_choice[aria-pressed=\"true\"] .selection_check svg{opacity:1}#atelier .material_choice[aria-pressed=\"true\"] b{font-weight:600}#atelier .material_choice:hover{background:#fafafa}#atelier .material_help{display:flex;justify-content:space-between;gap:16px;padding:6px 0 4px}#atelier .material_help button{font-size:12px}#atelier .field_heading,#atelier .thickness_header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:24px 0 12px}#atelier h3{font-size:15px;font-weight:600}#atelier .field_heading>span{font-size:13px;color:var(--body)}#atelier .thickness_header .text_button{font-size:12px;min-height:24px}#atelier #dekorGrid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px 10px}#atelier .kfg_dekor{display:flex;flex-direction:column;gap:7px;padding:0;border:0;background:transparent;min-width:0;cursor:pointer;color:var(--body);border-radius:0}#atelier .kfg_dekor .sw{width:100%;aspect-ratio:1/1;border-radius:6px;position:relative;display:block;border:1px solid rgba(0,0,0,.08)}#atelier .kfg_dekor.is-active .sw{outline:2px solid var(--ink);outline-offset:3px}#atelier .kfg_dekor img{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;border:1px solid rgba(0,0,0,.08)}#atelier .kfg_dekor.is-active img{outline:2px solid var(--ink);outline-offset:3px}#atelier .kfg_dekor span:not(.sw){font-size:11px;line-height:1.3;text-align:left;min-height:28px}#atelier .kfg_dekor.is-active{color:var(--ink)}#atelier .kfg_chip,#atelier .kfg_quick-chip{min-height:44px;border:1px solid #b7b7b9;border-radius:8px;padding:10px 16px;background:#fff;color:var(--ink);font-size:14px;line-height:1.4;display:inline-flex;align-items:center;justify-content:center;gap:5px}#atelier .kfg_chip small{font-size:12px;color:var(--body);font-weight:400}#atelier .kfg_chip.is-active,#atelier .kfg_quick-chip.is-active{border-color:var(--ink);background:#f4f4f5;box-shadow:inset 0 0 0 1px var(--ink);color:var(--ink)}#atelier .kfg_chips,#atelier #thickChips{display:flex;flex-wrap:wrap;gap:8px;margin:0}#atelier #thickChips .kfg_chip{min-width:100px}#atelier .sample_help{display:flex;align-items:center;text-align:left;gap:14px;width:100%;margin-top:28px;border:0;border-top:1px solid var(--line);background:transparent;padding:18px 0;font-size:13px}#atelier .sample_help>span{flex:1}#atelier .sample_help small{display:block;font-size:12px;color:var(--body);margin-top:4px}#atelier .sample_help>svg:last-child{width:16px}#atelier .step_actions{display:flex;align-items:center;justify-content:space-between;min-height:48px;margin-top:18px}#atelier .step_actions>span{margin-left:auto;font-size:12px;color:var(--body)}#atelier .purchase_bar{border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 0 0;margin-top:12px;background:#fff}#atelier .price_block{min-width:0;font-variant-numeric:tabular-nums}#atelier .price_block>span{font-size:12px;color:var(--body);display:block}#atelier .price_block strong{font-size:28px;letter-spacing:-.7px;line-height:1.4;font-weight:600;display:block}#atelier .price_block small{display:block;font-size:11px;line-height:1.5;color:var(--body)}#atelier .primary_button{min-height:52px;padding:14px 20px;background:var(--ink);border:1px solid var(--ink);border-radius:8px;color:#fff;font-size:13px;font-weight:500;display:inline-flex;gap:12px;align-items:center;justify-content:center;white-space:nowrap}#atelier .primary_button>svg{width:16px;height:16px}#atelier .price_status{font-size:12px;color:var(--body);line-height:1.6;margin-top:12px}#atelier .shape_choices{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:32px}#atelier .shape_choice{min-height:116px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;border:1px solid #b7b7b9;background:#fff;border-radius:8px;font-size:12px}#atelier .shape_choice>svg{width:48px;height:48px;stroke-width:.9}#atelier .shape_choice[aria-pressed=\"true\"]{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink);background:#f4f4f5}#atelier .kfg_step{padding:0!important;border:0!important;background:transparent!important;margin:0!important;border-radius:0!important}#atelier .kfg_step-head{display:none!important}#atelier .kfg_step-body{display:block!important}#atelier .kfg_field{min-width:0}#atelier .kfg_field>label{font-size:13px;font-weight:500;color:var(--ink);display:block;margin-bottom:8px}#atelier .kfg_field .in{border:1px solid #a5a5a8;border-radius:8px;background:#fff;display:flex;align-items:center;padding:0;min-height:54px}#atelier .kfg_field input{width:100%;min-width:0;padding:13px 16px;font-size:17px;line-height:1.4;border:0;background:transparent;color:var(--ink);font-variant-numeric:tabular-nums}#atelier .kfg_field .unit{font-size:13px;color:var(--body);padding-right:16px}#atelier .kfg_field .range{display:block;font-size:12px;line-height:1.6;color:var(--body);margin-top:6px}#atelier .kfg_field .err{font-size:13px;color:var(--error);margin-top:5px;line-height:1.5;display:none}#atelier .kfg_field.is-error .err{display:block}#atelier .kfg_field.is-error .in{border-color:var(--error)}#atelier .kfg_dims{gap:24px 16px}#atelier #dimsRect,#atelier #dimsLform,#atelier #dimsBauch{gap:24px 16px;grid-template-columns:repeat(2,minmax(0,1fr))}#atelier .kfg_sublabel{font-size:13px;line-height:1.5;margin:20px 0 10px;color:var(--body)}#atelier .kfg_rule-note,#atelier .kfg_mpx-note{padding:14px 16px;background:#f5f5f5;color:var(--body);font-size:12px;line-height:1.65;border-radius:8px;margin-top:14px}#atelier .kfg_measure{margin-top:28px;border-top:1px solid var(--line);padding-top:8px}#atelier .kfg_measure summary{min-height:44px;display:flex;align-items:center;font-size:13px;cursor:pointer}#atelier .kfg_measure p{font-size:13px;color:var(--body);line-height:1.6;padding:8px 0}#atelier .standard_sizes{border-top:1px solid var(--line);margin-top:28px}#atelier .standard_sizes summary,#atelier .individual_corners>summary{font-size:13px;min-height:48px;display:flex;align-items:center;cursor:pointer}#atelier .standard_sizes summary:after,#atelier .individual_corners>summary:after{content:'+';margin-left:auto;font-size:20px;font-weight:300}#atelier .standard_sizes[open]>summary:after,#atelier .individual_corners[open]>summary:after{content:'−'}#atelier #quickBlock{padding:0 0 12px;margin:0}#atelier #quickBlock>p{display:none}#atelier #quickChips{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}#atelier .kfg_quick-chip{font-size:12px;min-height:44px;padding:9px 4px}#atelier .option_group{border-top:1px solid var(--line);margin:0}#atelier .option_group:last-of-type{border-bottom:1px solid var(--line)}#atelier .option_group>summary{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:84px;padding:17px 0;cursor:pointer;list-style:none}#atelier .option_group>summary::-webkit-details-marker{display:none}#atelier .option_group>summary b{font-size:16px;font-weight:500;display:block}#atelier .option_group>summary small{font-size:12px;color:var(--body);display:block;margin-top:4px}#atelier .option_group>summary svg{width:17px;height:17px;transform:rotate(90deg)}#atelier .option_group[open]>summary svg{transform:rotate(-90deg)}#atelier .group_body{padding:0 0 24px}#atelier .kfg_grouplabel{display:none}#atelier .kfg_preset{border:0;border-bottom:1px solid var(--line);border-radius:0;padding:16px 0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 16px;margin:0;background:transparent}#atelier .kfg_preset>span:first-child{grid-row:1;grid-column:1}#atelier .kfg_preset b{font-size:14px;font-weight:500;display:block;white-space:normal}#atelier .kfg_preset small{font-size:12px;color:var(--body);display:block;line-height:1.5;margin-top:4px;white-space:normal}#atelier .kfg_preset>.pr{grid-row:2;grid-column:1;font-size:12px;color:var(--body)}#atelier .kfg_stepper{grid-column:2;grid-row:1/3;align-self:center;display:flex;align-items:center;border:1px solid #b7b7b9;border-radius:8px;overflow:hidden}#atelier .kfg_stepper button{width:40px;height:44px;min-height:44px;border:0;background:transparent;font-size:17px}#atelier .kfg_stepper [data-count]{min-width:20px;text-align:center;font-size:14px}#atelier .kfg_check{display:flex;align-items:center;gap:12px;border:0;background:#fff;border-radius:0;min-height:64px;padding:14px 0;margin:0}#atelier .kfg_check input{width:20px;height:20px;accent-color:var(--ink)}#atelier .kfg_check b{font-size:14px;font-weight:500}#atelier .kfg_check small{font-size:12px;color:var(--body);line-height:1.5}#atelier .kfg_check .pr{font-size:12px;margin-left:auto}#atelier .kfg_edge-note{font-size:12px;color:var(--body);line-height:1.6;padding-top:20px}#atelier .kfg_corner-sel{gap:8px}#atelier .kfg_corner-sel input{min-height:44px;font-size:16px}#atelier .kfg_corner-sel .cr-all,#atelier .kfg_corner-sel label{min-height:48px;border-color:#a5a5a8}#atelier #cornerBlock>.kfg_sublabel{display:none}#atelier .individual_corners{margin-top:14px}#atelier .kfg_cutrow{border:1px solid #b7b7b9;background:#fafafa;padding:14px 16px;border-radius:8px;margin-top:16px}#atelier .kfg_cutrow-head{font-size:14px;gap:8px;min-height:44px;display:flex;align-items:center;margin-bottom:8px}#atelier .kfg_cutrow-head .del{min-width:44px;min-height:44px;font-size:24px;color:var(--body);margin-left:8px}#atelier .kfg_cutrow-head .pr{font-size:12px}#atelier .kfg_cutrow-head .ic{display:none}#atelier .kfg_cutrow-fields{display:flex;flex-wrap:wrap;gap:12px}#atelier .kfg_cutrow-fields label{font-size:12px;flex:1 1 100px;min-width:90px;max-width:none;color:var(--body)}#atelier .kfg_cutrow-fields .in{border:1px solid #a5a5a8;border-radius:6px;min-height:46px;display:flex;align-items:center;margin-top:6px;background:#fff}#atelier .kfg_cutrow-fields input,#atelier .kfg_cutrow-fields select{min-height:44px;min-width:0;width:100%;font-size:16px;padding:9px;border:0;background:transparent;color:var(--ink)}#atelier .kfg_cutrow-fields i{font-size:12px;padding-right:8px;font-style:normal}#atelier .kfg_cutwarn{font-size:12px;line-height:1.5;margin-top:8px}#atelier .geometry_error{border-color:var(--error);background:#fff4f2}#atelier .validation_errors{padding:16px;background:#fff4f2;border:1px solid #d48c87;border-radius:8px;margin-top:16px;color:var(--error);font-size:13px;line-height:1.6}#atelier .validation_errors p+p{margin-top:10px}#atelier .info_note{font-size:13px;padding:16px;background:#f5f5f5;border-radius:8px;color:var(--body);margin:16px 0;line-height:1.6}#atelier .info_note button{border:0;background:none;text-decoration:underline;padding:8px 0;min-height:44px;color:var(--ink)}#atelier .kfg_custom textarea,#atelier .kfg_machine input{font-size:16px;border:1px solid #a5a5a8;padding:12px;min-height:48px;border-radius:8px;width:100%;background:#fff}#atelier .kfg_upload{min-height:96px;padding:20px;font-size:13px;border:1px dashed #999;border-radius:8px}#atelier .kfg_custom-hint{font-size:12px;color:var(--body);line-height:1.6}#atelier .kfg_machine{display:block;font-size:13px;margin:20px 0}#atelier .kfg_machine input{margin-top:8px}#atelier .review_rows>div{display:grid;grid-template-columns:140px minmax(0,1fr) auto;gap:16px;border-bottom:1px solid var(--line);padding:16px 0;align-items:start}#atelier .review_rows>div>span{font-size:12px;color:var(--body);padding-top:3px}#atelier .review_rows strong{font-size:14px;font-weight:500;line-height:1.6}#atelier .review_rows button{font-size:12px;text-decoration:underline;text-underline-offset:4px;min-height:44px;padding:0;border:0;background:none;margin-top:-9px}#atelier .review_costs{margin-top:28px}#atelier .review_costs>summary{font-weight:500;font-size:16px;cursor:pointer;min-height:44px}#atelier .review_costs>div{display:flex;justify-content:space-between;gap:16px;padding:7px 0;font-size:13px;font-variant-numeric:tabular-nums}#atelier .review_costs b{font-weight:500}#atelier .review_costs>.review_total{border-top:1px solid var(--line);margin-top:12px;padding:16px 0;align-items:center}#atelier .review_total strong{font-size:24px;font-weight:600}#atelier .order_process{margin-top:24px;padding:22px;background:#f4f4f5;border-radius:8px}#atelier .order_process p,#atelier .order_process li{font-size:13px;color:var(--body);line-height:1.7;margin-top:8px}#atelier .order_process ol{padding-left:20px;margin:10px 0 14px}#atelier .demo_explanation{font-size:12px;color:var(--body);line-height:1.6;margin-top:16px}#atelier .error_note{font-size:13px;color:var(--error);margin-top:16px}#atelier .dim-line{stroke:#626265}#atelier .dim-text{fill:#303033;font-family:Onest,sans-serif;font-size:15px;stroke:#f4f4f5;stroke-width:3px;paint-order:stroke}#atelier #stage .kfg_edge{cursor:pointer}/* Focused drawing view. */body.preview_open{overflow:hidden}#atelier.preview_expanded .work_preview{position:fixed;inset:24px;z-index:30;display:flex;flex-direction:column;align-items:center;background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.25);padding:16px}#atelier.preview_expanded .preview_surface{width:100%;height:100%;display:flex;flex-direction:column}#atelier.preview_expanded .preview_canvas{flex:1;height:auto;min-height:0}#atelier.preview_expanded .preview_facts,#atelier.preview_expanded .edge_preview,#atelier.preview_expanded .preview_note{display:none}#atelier.preview_expanded:before{content:'';position:fixed;inset:0;background:#0006;z-index:29}.atelier_dialog{width:940px;max-width:calc(100% - 40px);max-height:90vh;border:0;border-radius:16px;padding:32px;background:#fff;color:var(--ink);font-family:Onest,sans-serif}:is(#atelier,.atelier_dialog) .dialog_header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:24px}:is(#atelier,.atelier_dialog) .dialog_header h2,.atelier_dialog>h2{font-size:28px;letter-spacing:-.7px;font-weight:500}:is(#atelier,.atelier_dialog) .dialog_header p{font-size:13px;color:var(--body);margin-top:8px}:is(#atelier,.atelier_dialog) .material_compare{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}:is(#atelier,.atelier_dialog) .material_compare article{min-width:0}:is(#atelier,.atelier_dialog) .material_compare img{width:100%;height:160px;object-fit:cover;border-radius:8px}:is(#atelier,.atelier_dialog) .material_compare h3{font-size:18px;font-weight:500;margin:20px 0 8px}:is(#atelier,.atelier_dialog) .material_compare p{font-size:13px;color:var(--body);min-height:104px}:is(#atelier,.atelier_dialog) .material_compare dl{font-size:13px;line-height:1.6;display:grid;gap:8px;margin:20px 0 24px}:is(#atelier,.atelier_dialog) .material_compare dt{color:var(--body)}:is(#atelier,.atelier_dialog) .material_compare dd{margin:0;padding-bottom:8px;border-bottom:1px solid var(--line)}:is(#atelier,.atelier_dialog) .material_compare .secondary_button{width:100%;font-size:13px}.atelier_dialog>p{font-size:14px;line-height:1.65;margin:16px 0;color:var(--body)}.atelier_dialog>label{display:block;font-size:13px;margin:24px 0}.atelier_dialog>label input{display:block;width:100%;padding:14px;margin-top:8px;border:1px solid #aaa;border-radius:8px}:is(#atelier,.atelier_dialog) .large_edge{display:block;max-width:100%;max-height:55vh;object-fit:contain;margin:24px auto}:is(#atelier,.atelier_dialog) .cart_dialog{width:660px}:is(#atelier,.atelier_dialog) .cart_item{display:grid;grid-template-columns:180px 1fr;gap:24px;padding:24px 0;border-top:1px solid var(--line)}:is(#atelier,.atelier_dialog) .cart_preview{background:var(--surface);border-radius:8px;height:160px;display:flex;align-items:center}:is(#atelier,.atelier_dialog) .cart_preview svg{width:100%;height:auto}:is(#atelier,.atelier_dialog) .cart_preview .dim-text{font-size:20px;fill:#333;font-family:Onest,sans-serif}:is(#atelier,.atelier_dialog) .cart_preview .dim-line{stroke:#777}:is(#atelier,.atelier_dialog) .cart_item h3{font-size:16px;font-weight:500}:is(#atelier,.atelier_dialog) .cart_item p{font-size:13px;color:var(--body);margin:5px 0}:is(#atelier,.atelier_dialog) .cart_item strong{display:block;margin-top:12px;font-size:20px;font-weight:600}:is(#atelier,.atelier_dialog) .cart_item small{display:block;font-size:11px;color:var(--body);margin-top:4px}:is(#atelier,.atelier_dialog) .cart_item_actions{display:flex;gap:24px}:is(#atelier,.atelier_dialog) .cart_item_actions button{min-height:44px;border:0;background:none;text-decoration:underline;font-size:12px;padding:0}:is(#atelier,.atelier_dialog) .cart_item .secondary_button{font-size:12px;min-height:44px;padding:10px 12px}:is(#atelier,.atelier_dialog) .cart_dialog .demo_explanation{font-size:12px;color:var(--body);line-height:1.65}:is(#atelier,.atelier_dialog) .empty_cart{padding:40px;text-align:center}:is(#atelier,.atelier_dialog) .empty_cart>svg{width:40px;height:40px;margin-bottom:20px}:is(#atelier,.atelier_dialog) .empty_cart h3{font-size:21px;font-weight:500}:is(#atelier,.atelier_dialog) .empty_cart p{font-size:14px;color:var(--body);margin:12px 0 24px}:is(#atelier,.atelier_dialog) .kfg_pop{font-family:Onest,sans-serif}@media(min-width:1600px){#atelier .preview_canvas{height:480px}#atelier .workbench{gap:80px}}@media(max-width:1519px){#atelier .atelier_shell{margin:0 48px}#atelier .workbench{gap:48px}#atelier .preview_canvas{height:390px}}@media(max-width:1199px){#atelier .atelier_shell{margin:0 32px}#atelier .workbench{gap:32px;grid-template-columns:1fr 1fr}#atelier h1{font-size:34px}#atelier .preview_canvas{height:320px}#atelier .material_choice{gap:12px}#atelier .material_choice img{width:84px;height:64px}#atelier .material_choice small{font-size:11px}#atelier .material_choice b{font-size:15px}#atelier #dekorGrid{grid-template-columns:repeat(5,1fr)}#atelier .purchase_bar{flex-wrap:wrap;gap:14px}#atelier .purchase_bar .primary_button{flex:1}#atelier .step_nav button{font-size:12px;gap:8px}#atelier .step_nav button>svg{margin-right:12px}#atelier .review_rows>div{grid-template-columns:110px minmax(0,1fr) auto;gap:8px}#atelier .preview_facts{gap:12px}#atelier .preview_facts strong{font-size:13px}#atelier .edge_preview{gap:16px}#atelier .edge_preview img{width:96px;height:80px}#atelier .edge_preview b{font-size:13px}#atelier .shape_choices{gap:6px}#atelier .shape_choice{font-size:11px;min-height:100px}#atelier .shape_choice>svg{width:40px;height:40px}}@media(max-width:767px){#atelier .atelier_shell{margin:0 20px}#atelier .page_intro{padding:28px 0 22px;gap:12px}#atelier h1{font-size:28px;line-height:1.15;letter-spacing:-.8px;max-width:300px}#atelier .page_intro p{font-size:13px;margin-top:10px;max-width:32ch}#atelier .page_intro .text_button{font-size:0;width:44px;min-width:44px;justify-content:center;text-decoration:none}#atelier .page_intro .text_button svg{width:20px;height:20px}#atelier .step_nav{margin-bottom:20px;grid-template-columns:repeat(4,1fr);scroll-margin-top:16px}#atelier .step_nav button{flex-direction:column;align-items:flex-start;justify-content:flex-start;font-size:10px;gap:6px;padding:12px 2px;min-height:70px}#atelier .step_nav button>svg{display:none}#atelier .step_number{font-size:14px}#atelier .workbench{display:flex;flex-direction:column;gap:28px}#atelier .work_preview{position:static;top:auto;width:100%}#atelier .preview_surface{padding:8px 12px 14px;border-radius:12px}#atelier .preview_toolbar{gap:8px}#atelier .view_switch button{min-height:36px;padding:8px 10px;font-size:10px}#atelier .preview_toolbar .icon_button{width:40px;height:40px}#atelier .preview_canvas{height:190px}#atelier .preview_caption{padding:0;gap:8px}#atelier .preview_caption strong{font-size:19px;letter-spacing:-.4px}#atelier .preview_caption span{font-size:11px}#atelier #viewHint{font-size:10px}#atelier .preview_facts{padding:14px 0;border-bottom:0;gap:10px}#atelier .preview_facts span{font-size:10px;margin-bottom:3px}#atelier .preview_facts strong{font-size:12px}#atelier .edge_preview,#atelier .preview_note{display:none}#atelier .work_controls{width:100%}#atelier .flow_panel{scroll-margin-top:20px}#atelier .panel_heading{margin:0 0 20px}#atelier .panel_heading h2{font-size:23px;letter-spacing:-.6px}#atelier .panel_heading p{font-size:13px}#atelier .material_choice{min-height:86px;padding:10px 4px 10px 0;gap:12px}#atelier .material_choice img{width:84px;height:64px}#atelier .material_choice b{font-size:14px}#atelier .material_choice small{font-size:12px;line-height:1.4}#atelier .selection_check{width:22px;height:22px}#atelier .material_help{gap:12px}#atelier .material_help button{font-size:11px}#atelier #dekorGrid{grid-template-columns:repeat(5,minmax(0,1fr));gap:12px 9px}#atelier .kfg_dekor span:not(.sw){font-size:10px}#atelier .field_heading{margin-top:22px}#atelier .field_heading>span{font-size:12px}#atelier .kfg_chip{font-size:13px;padding:10px 12px;min-height:44px}#atelier #thickChips .kfg_chip{min-width:88px;flex:1}#atelier .step_actions{margin-bottom:16px}#atelier .purchase_bar{position:fixed;z-index:15;bottom:0;left:0;right:0;margin:0;padding:12px 20px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #c7c7c9;box-shadow:0 -5px 22px rgba(0,0,0,.04);gap:10px;flex-wrap:nowrap;align-items:center}#atelier .price_block{flex:1}#atelier .price_block>span{font-size:10px}#atelier .price_block strong{font-size:23px;line-height:1.3}#atelier .price_block small{font-size:10px;max-width:155px;line-height:1.4}#atelier .purchase_bar .primary_button{flex:0 1 47%;min-height:48px;padding:10px 12px;font-size:12px;white-space:normal;gap:8px;text-align:left;line-height:1.4}#atelier .purchase_bar .primary_button>svg{width:14px;min-width:14px}#atelier .price_status{font-size:12px}#atelier .shape_choices{gap:8px;grid-template-columns:repeat(2,1fr)}#atelier .shape_choice{min-height:94px;flex-direction:row;gap:10px;font-size:12px}#atelier .shape_choice>svg{width:38px;height:38px}#atelier #dimsRect,#atelier #dimsLform,#atelier #dimsBauch{gap:20px 12px}#atelier .kfg_field input{font-size:16px;padding:12px}#atelier .kfg_field>label{font-size:12px}#atelier .kfg_field .range{font-size:11px}#atelier .kfg_field .unit{font-size:12px;padding-right:12px}#atelier .option_group>summary{min-height:82px}#atelier .option_group>summary b{font-size:15px}#atelier .option_group>summary small{font-size:12px}#atelier .kfg_preset{gap:6px 10px}#atelier .kfg_preset b{font-size:13px}#atelier .kfg_preset small{font-size:12px}#atelier .kfg_stepper button{width:36px}#atelier .kfg_preset>.pr{font-size:12px}#atelier .kfg_cutrow{padding:12px}#atelier .kfg_cutrow-head{font-size:13px}#atelier .kfg_cutrow-fields{gap:10px}#atelier .kfg_cutrow-fields label{font-size:11px;min-width:80px}#atelier .kfg_cutrow-fields input{font-size:16px}#atelier .review_rows>div{grid-template-columns:minmax(0,1fr) auto;gap:6px 12px}#atelier .review_rows>div>span{grid-column:1;font-size:12px}#atelier .review_rows strong{grid-column:1;font-size:14px}#atelier .review_rows button{grid-column:2;grid-row:span 2;align-self:center;font-size:12px}#atelier .review_total strong{font-size:23px}#atelier .order_process{padding:18px}#atelier.preview_expanded .work_preview{inset:8px;padding:0;height:calc(100dvh - 16px);width:auto}#atelier.preview_expanded .preview_canvas{height:calc(100dvh - 200px)}#atelier.preview_expanded .preview_surface{border-radius:12px;padding:12px}#atelier.preview_expanded .preview_toolbar .icon_button{width:44px;height:44px}.atelier_dialog{padding:20px;width:100%;max-width:calc(100% - 24px);max-height:90dvh;border-radius:12px}:is(#atelier,.atelier_dialog) .dialog_header{margin-bottom:18px;gap:12px}:is(#atelier,.atelier_dialog) .dialog_header h2,.atelier_dialog>h2{font-size:24px}:is(#atelier,.atelier_dialog) .material_compare{display:block}:is(#atelier,.atelier_dialog) .material_compare article{margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid var(--line)}:is(#atelier,.atelier_dialog) .material_compare img{height:180px}:is(#atelier,.atelier_dialog) .material_compare p{min-height:0;font-size:14px}:is(#atelier,.atelier_dialog) .material_compare dl{grid-template-columns:80px 1fr}:is(#atelier,.atelier_dialog) .material_compare .secondary_button{min-height:48px}:is(#atelier,.atelier_dialog) .cart_item{grid-template-columns:100px 1fr;gap:16px}:is(#atelier,.atelier_dialog) .cart_preview{height:110px}:is(#atelier,.atelier_dialog) .cart_item h3{font-size:14px}:is(#atelier,.atelier_dialog) .cart_item p{font-size:12px}:is(#atelier,.atelier_dialog) .cart_item .secondary_button{font-size:11px}:is(#atelier,.atelier_dialog) .empty_cart{padding:24px 0}:is(#atelier,.atelier_dialog) .large_edge{max-height:50dvh}}@media(prefers-reduced-motion:reduce){:is(#atelier,.atelier_dialog) *,:is(#atelier,.atelier_dialog) *:before,:is(#atelier,.atelier_dialog) *:after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}/* Final responsive adjustments: a reachable price rail and native-sized targets. */#atelier .kfg_stepper button{width:44px}#atelier .view_switch button{min-height:44px}#atelier .preview_toolbar .icon_button{width:44px;height:44px}#atelier .toast{position:fixed;bottom:130px;left:50%;transform:translateX(-50%);z-index:40;max-width:calc(100% - 40px);width:max-content;padding:14px 20px;border-radius:8px;background:#161616;color:#fff;font-size:13px;line-height:1.5;pointer-events:none;opacity:0}#atelier .toast.show{opacity:1}#atelier .order_process .secondary_button{margin-top:18px;font-size:12px}#atelier .texture_test_note{font-size:12px;color:#5c5c5e;line-height:1.5;margin:12px 0 0}:is(#atelier,.atelier_dialog) .cart_quantity{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;font-size:12px}:is(#atelier,.atelier_dialog) .cart_quantity>div{display:flex;border:1px solid #aaa;border-radius:8px;overflow:hidden}:is(#atelier,.atelier_dialog) .cart_quantity button{width:44px;height:44px;background:#fff;border:0;font-size:18px}:is(#atelier,.atelier_dialog) .cart_quantity input{width:52px;height:44px;min-width:0;text-align:center;border:0;background:#fff;font-size:16px;appearance:textfield;-moz-appearance:textfield}:is(#atelier,.atelier_dialog) .cart_quantity input::-webkit-inner-spin-button,:is(#atelier,.atelier_dialog) .cart_quantity input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}:is(#atelier,.atelier_dialog) .cart_totals{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:24px 0 10px;border-top:1px solid var(--line);font-size:16px}:is(#atelier,.atelier_dialog) .cart_totals strong{font-size:26px;font-weight:600;font-variant-numeric:tabular-nums}:is(#atelier,.atelier_dialog) .cart_totals small{display:block;font-size:12px;color:var(--body);margin-top:4px}:is(#atelier,.atelier_dialog) .cart_shipping{font-size:12px;color:var(--body);margin-bottom:24px}:is(#atelier,.atelier_dialog) .cart_next{display:flex;flex-wrap:wrap;gap:12px;padding:24px 0;border-top:1px solid var(--line)}:is(#atelier,.atelier_dialog) .cart_next h3{width:100%;font-size:18px;font-weight:500;margin-bottom:4px}:is(#atelier,.atelier_dialog) .cart_next button{flex:1;font-size:13px}:is(#atelier,.atelier_dialog) .cart_item_actions{flex-wrap:wrap;gap:0 18px}@media(max-width:767px){:is(#atelier,.atelier_dialog) .cart_quantity{align-items:flex-start;flex-direction:column;gap:6px}:is(#atelier,.atelier_dialog) .cart_next button{flex:1 1 100%;font-size:14px}:is(#atelier,.atelier_dialog) .cart_totals strong{font-size:24px}:is(#atelier,.atelier_dialog) .cart_item_actions button{font-size:12px}}@media(max-width:767px){#atelier[data-view=\"2d\"] .preview_canvas{height:230px}#atelier[data-view=\"2d\"].preview_expanded .preview_canvas{height:calc(100dvh - 200px)}}@media(max-width:767px){#atelier .page_intro{padding:20px 0 16px}#atelier h1{font-size:26px;max-width:290px}#atelier .page_intro p{display:none}#atelier .step_nav{margin-bottom:16px}#atelier .preview_canvas{height:100px}#atelier .preview_facts{padding:10px 0}#atelier .preview_caption strong{font-size:16px}#atelier .workbench{gap:20px}#atelier .panel_heading{margin-bottom:16px}}@media(min-width:768px){#atelier .purchase_bar{position:fixed;z-index:15;bottom:16px;left:50%;transform:translateX(-50%);width:calc(100% - 64px);max-width:1440px;border:1px solid #dcdcdd;border-radius:12px;padding:16px 24px;box-shadow:0 5px 30px #0000000d;flex-wrap:nowrap;margin:0}#atelier .purchase_bar .primary_button{flex:0 0 auto;min-width:240px}}/* Corner identities stay concise in the drawing; full names have their own legend. */#atelier .corner_legend{margin:0 0 24px;padding:18px 0 0;border-top:1px solid #dedede}#atelier .corner_legend[hidden]{display:none}#atelier .corner_legend_heading{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px;font-size:12px}#atelier .corner_legend_heading>span{color:#666}#atelier .corner_legend ol{list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 20px;padding:0;margin:0}#atelier .corner_legend li{display:grid;grid-template-columns:20px minmax(0,1fr) auto;align-items:center;gap:7px;font-size:12px;line-height:1.4;min-width:0}#atelier .corner_number{width:20px;height:20px;display:grid;place-items:center;border:1px solid #aaa;border-radius:50%;background:#fff;font-size:11px;font-weight:600}#atelier .corner_name{overflow-wrap:anywhere}#atelier .corner_legend li>strong{text-align:right;font-size:12px;white-space:nowrap}#atelier .corner_legend li small{display:block;font-size:10px;font-weight:400;color:#666}#atelier.preview_expanded.has_corner_legend[data-view=\"2d\"] .preview_canvas{height:calc(100dvh - 380px);min-height:200px}@media(max-width:479px){#atelier .corner_legend ol{gap:12px}#atelier .corner_legend li{grid-template-columns:20px minmax(0,1fr);gap:2px 6px}#atelier .corner_legend li>strong{grid-column:2;text-align:left}#atelier .corner_legend{margin-bottom:20px}}/* Einstieg zum Entwurfskorb neben \"Konfiguration teilen\". */#atelier .atelier_actions{display:flex;align-items:center;gap:24px;flex-wrap:wrap}#atelier #atelierCart{text-decoration:none;font-weight:600}#atelier #atelierCart span{font-variant-numeric:tabular-nums}@media(max-width:767px){#atelier .atelier_actions{gap:16px}}#atelier #atelierCart span{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:var(--ink);color:#fff;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}/* Live steht die Ueberschrift auf der Webflow-Seite: nur die Knopfzeile bleibt. */#atelier .page_intro.is_bare{justify-content:flex-end;padding:0 0 20px}@media(max-width:767px){#atelier .page_intro.is_bare{padding:0 0 12px}#atelier .page_intro.is_bare .atelier_actions{width:100%;justify-content:space-between}}/* ── Rueckmeldung Sascha, 11.09. ──────────────────────────────────────────── *//* Der leere Kreis war ein Haarstrich und wirkte wie ein Fehler. */#atelier .selection_check{width:26px;height:26px;border:2px solid #9b9b9d;transition:border-color .15s,background .15s}#atelier .material_choice:hover .selection_check{border-color:#5c5c5e}#atelier .material_choice[aria-pressed=\"true\"] .selection_check{border-width:2px}#atelier .selection_check svg{width:14px;height:14px;stroke-width:2.6}/* „Ziehen zum Drehen“ mit Zeichen. */#atelier .view_hint{display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--body);white-space:nowrap}#atelier .view_hint svg{width:15px;height:15px;opacity:.7}/* Was nach der Bestellung passiert. */#atelier .order_steps{margin:14px 0 0;padding:0;list-style:none;counter-reset:schritt;display:grid;gap:10px}#atelier .order_steps li{counter-increment:schritt;position:relative;padding-left:34px;font-size:13px;line-height:1.6;color:var(--body)}#atelier .order_steps li:before{content:counter(schritt);position:absolute;left:0;top:-1px;width:22px;height:22px;border-radius:50%;\n  background:var(--ink);color:#fff;display:grid;place-items:center;font-size:12px;font-weight:600}/* Ohne Fliesstext unter jedem Schritt braucht die Statuszeile keinen festen Platz. */#atelier .price_status:empty{display:none}#atelier .step_actions{margin-top:24px}";
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

// Client preview guard. Contour points follow the original engine's rounded path.
function pointInPolygon(p,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
}
function segmentDistance(p,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len)):0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
function boundaryDistance(p,poly){return Math.min(...poly.map((a,i)=>segmentDistance(p,a,poly[(i+1)%poly.length])));}
function footprint(c){
  if(c.t==='p')return (c.pts||[]).map(p=>[c.cx+p[0],c.cy+p[1]]);
  const w=c.t==='k'?(c.dir==='quer'?c.w/10:c.len):c.w;
  const h=c.t==='k'?(c.dir==='quer'?c.len:c.w/10):c.h;
  return [[c.cx-w/2,c.cy-h/2],[c.cx+w/2,c.cy-h/2],[c.cx+w/2,c.cy+h/2],[c.cx-w/2,c.cy+h/2]];
}
function cross(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function intersect(a,b,c,d){const p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b);return p*q<0&&r*s<0;}
function polysCross(a,b){return a.some((p,i)=>b.some((q,j)=>intersect(p,a[(i+1)%a.length],q,b[(j+1)%b.length])));}
function overlap(a,b){
  if(a.t==='c'&&b.t==='c')return Math.hypot(a.cx-b.cx,a.cy-b.cy)<(a.d+b.d)/2+0.01;
  if(b.t==='c')return overlap(b,a);
  if(a.t==='c'){const p=footprint(b);return pointInPolygon([a.cx,a.cy],p)||boundaryDistance([a.cx,a.cy],p)<=a.d/2+0.01;}
  const p=footprint(a),q=footprint(b);return polysCross(p,q)||p.some(v=>pointInPolygon(v,q))||q.some(v=>pointInPolygon(v,p));
}
function validateCuts(cuts,poly,minEdge=5){
  const errors=[];
  cuts.forEach((c,i)=>{
    let valid=true;
    if(c.t==='c')valid=Number.isFinite(c.d)&&c.d>0&&Number.isFinite(c.cx)&&Number.isFinite(c.cy);
    else if(c.t==='p')valid=Number.isFinite(c.cx)&&Number.isFinite(c.cy)&&Array.isArray(c.pts)&&c.pts.length>=3&&c.pts.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite));
    else valid=[c.cx,c.cy,c.t==='k'?c.len:c.w,c.t==='k'?c.w:c.h].every(Number.isFinite)&&(c.t==='k'?c.len>0&&c.w>0:c.w>0&&c.h>0);
    if(!valid){errors.push({index:i,message:'Bitte gib gültige Maße für diese Bearbeitung ein.'});return;}
    if(c.t==='c'){
      const p=[c.cx,c.cy],dist=boundaryDistance(p,poly);
      if(!pointInPolygon(p,poly)||dist<c.d/2-0.01)errors.push({index:i,message:'Die Bohrung liegt außerhalb der Platte. Verschiebe sie vollständig auf die Materialfläche.'});
      else if(dist-c.d/2<minEdge-0.02)errors.push({index:i,message:`Halte mindestens ${minEdge*10} mm Abstand zwischen Bohrungsrand und Plattenkante.`});
    }else{
      const p=footprint(c);
      if(p.some(v=>!pointInPolygon(v,poly))||polysCross(p,poly))errors.push({index:i,message:'Der Ausschnitt liegt außerhalb der Platte. Verschiebe ihn vollständig auf die Materialfläche.'});
      else if(c.t!=='k'&&p.some(v=>boundaryDistance(v,poly)<minEdge-0.02))errors.push({index:i,message:`Halte mindestens ${minEdge*10} mm Abstand zur Plattenkante.`});
    }
    for(let j=0;j<i;j++) if(overlap(c,cuts[j])){errors.push({index:i,message:`Diese Bearbeitung überschneidet sich mit Bearbeitung ${j+1}. Bitte verschiebe oder entferne sie.`});break;}
  });return errors;
}

/* The live integration reuses Kessler's existing Worker and Shopyflow cart.
 * It is deliberately not enabled by the local design preview. */

const lineTotal=(price,quantity)=>Math.round(price*100)*quantity/100;




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
  if(started||!window.KFG?.atelier)return;started=true;api=window.KFG.atelier;atelierShellAufbauen(api);
  const root=$('atelier');
  const storage=document.createElement('div');storage.id='coreStorage';storage.hidden=true;
  while(root.firstChild)storage.append(root.firstChild);root.append(storage);
  const shell=document.createElement('div');shell.className='atelier_shell';
  shell.innerHTML=`
    <div class="page_intro is_bare"><div class="atelier_actions"><button class="text_button" id="atelierCart" data-dialog="cartDialog">${svg('<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>')}Deine Platten<span id="cartCount">0</span></button><button class="text_button" id="shareConfig">${svg('<path d="M12 16V3m-4 4 4-4 4 4M5 13v7h14v-7"/>')}Konfiguration teilen</button></div></div>
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



})();
