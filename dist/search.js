/* ============================================================
   Kessler PRO — search.js  v1.0.18
   Instant-Suche (Variante A · Stöbern). Onest-only, 8px.
   Mobile V2: Vorschläge (abgeleitet) + Verlauf + Beliebt, leichte Fuzzy-Logik.
   Quelle: search-index.json (jsDelivr) · sessionStorage-Cache.
   Selbst-rendernd: braucht im Header nur  <div data-kp-search></div>
   ============================================================ */
(function () {
  if (window.__KP_SEARCH) return; window.__KP_SEARCH = true;

  /* ---- CONFIG ---------------------------------------------------------- */
  function kpLP(){var m=(location.pathname||'').match(/^\/(pl-pl|en)(?=\/|$)/);return m?m[0]:'';}
  var CFG = {
    // Wird beim Integrieren auf den Commit-Hash gepinnt (jsDelivr).
    INDEX_URL: 'https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@main/dist/search-index.json',
    CACHE_KEY: 'kp_search_index_v2',
    MOUNT: '[data-kp-search]',
    PDP: function (s) { return kpLP() + '/products/' + s; },
    CAT: function (s) { return kpLP() + '/produktkategorien/' + s; },
    ROOM: function (s) { return kpLP() + '/raume/' + s; },
    RESULTS: function (q) { return kpLP() + '/produkte?q=' + encodeURIComponent(q); },
    MAX_PRODUCTS: 5,
    POPULAR: [] // optional; Variante A nutzt Räume/Kategorien statt Wortliste
  };

  /* ---- DATA ------------------------------------------------------------ */
  var IDX = { products: [], cats: [], rooms: [] };

  var ROOM_FALLBACK_ICONS = {
    buero:    '<rect x="3" y="13" width="18" height="3" rx="1"/><path d="M5 16v3M19 16v3M8 13V8h8v5"/>',
    werkstatt:'<path d="M14 7l3 3-7 7-3-3z"/><path d="M5 19l2-2M14 7l2-3 3 3-3 2"/>',
    praxis:   '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>',
    gastro:   '<path d="M6 8h11a3 3 0 010 6h-1"/><path d="M6 8v6a3 3 0 003 3h4a3 3 0 003-3"/><path d="M9 3v2M12 3v2M15 3v2"/>'
  };

  /* ---- HELPERS --------------------------------------------------------- */
  function norm(s){ return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function esc(s){ return (s||'').toString().replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function hl(t, term){
    t = t || '';
    if (!term) return esc(t);
    var i = norm(t).indexOf(norm(term));
    if (i < 0) return esc(t);
    return esc(t.slice(0,i)) + '<mark>' + esc(t.slice(i, i+term.length)) + '</mark>' + esc(t.slice(i+term.length));
  }
  var THUMB = '<div class="kp-thumb"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="position:relative;z-index:1"><rect x="3" y="7" width="18" height="10" rx="1.4" stroke="currentColor" stroke-width="1.3"/><path d="M3 11h18" stroke="currentColor" stroke-width="1.3"/></svg></div>';
  function thumb(p){
    if (p.img) return '<div class="kp-thumb"><img src="'+esc(p.img)+'" alt="" loading="lazy"></div>';
    return THUMB;
  }
  function maxCount(){ var m=1; IDX.cats.forEach(function(c){ if((c.k||0)>m) m=c.k; }); return m; }

  /* ---- V2: derived vocabulary · fuzzy · recent searches --------------- */
  var VOCAB = [];      // [{ d:display, n:norm, c:count }]
  var POPULAR = [];    // top derived terms (display strings)
  var RECENT_KEY = 'kp_recent_v1', RECENT_MAX = 6;
  var STOP = { 'farbe':1,'mit':1,'und':1,'der':1,'die':1,'das':1,'für':1,'fur':1,'cm':1,'mm':1,'set':1,'inkl':1,'aus':1,'pro':1,'cm²':1,'stk':1,'inkl.':1 };

  function buildVocab(){
    var map = {};   // norm -> {d, n, c}
    function add(disp, weight, force){
      var d = (disp||'').trim(); if (!d) return;
      var n = norm(d);
      if (!force){ if (n.length < 3) return; if (STOP[n]) return; if (/^\d/.test(n)) return; }
      if (!map[n]) map[n] = { d: d, n: n, c: 0 };
      map[n].c += (weight||1);
    }
    // product-name tokens (the words people actually type)
    IDX.products.forEach(function(p){
      var raw = (p.n||'').replace(/[^0-9A-Za-zÄÖÜäöüß]+/g,' ').split(' ');
      raw.forEach(function(tok){ add(tok, 1); });
    });
    // full category names (force-kept) + their tokens — high weight so they surface
    IDX.cats.forEach(function(c){
      add(c.n, 40, true);
      (c.n||'').replace(/[^0-9A-Za-zÄÖÜäöüß]+/g,' ').split(' ').forEach(function(t){ add(t, 8); });
    });
    // room names (force-kept)
    IDX.rooms.forEach(function(r){ add(r.n, 12, true); });

    VOCAB = Object.keys(map).map(function(k){ return map[k]; });
    POPULAR = VOCAB.slice().sort(function(a,b){ return b.c - a.c || a.d.length - b.d.length; })
                   .filter(function(e){ return e.n.indexOf(' ') < 0; })   // single, snappy words for chips
                   .slice(0, 6).map(function(e){ return e.d; });
  }

  function lev(a, b){
    if (a === b) return 0;
    var m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    var prev = [], i, j; for (j=0;j<=n;j++) prev[j]=j;
    for (i=1;i<=m;i++){ var cur=[i]; for (j=1;j<=n;j++){ var cost=a.charCodeAt(i-1)===b.charCodeAt(j-1)?0:1; cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost); } prev=cur; }
    return prev[n];
  }
  function fuzzyHit(nt, e){
    if (nt.length < 4) return false;
    if (lev(nt, e.n) <= 1) return true;
    var w = e.n.split(' ');
    for (var i=0;i<w.length;i++){ if (w[i].length >= 4 && lev(nt, w[i]) <= 1) return true; }
    return false;
  }
  function suggest(term){
    var nt = norm(term); if (!nt) return [];
    var out = [];
    VOCAB.forEach(function(e){
      if (e.n === nt) return;            // don't echo the exact word back
      var rank;
      if (e.n.indexOf(nt) === 0) rank = 0;
      else if (e.n.indexOf(nt) > 0) rank = 1;
      else if (fuzzyHit(nt, e)) rank = 2;
      else return;
      out.push({ d: e.d, r: rank, c: e.c, l: e.d.length });
    });
    out.sort(function(a,b){ return a.r - b.r || b.c - a.c || a.l - b.l; });
    var seen = {}, res = [];
    for (var i=0;i<out.length && res.length<7;i++){ var k=norm(out[i].d); if(seen[k])continue; seen[k]=1; res.push(out[i].d); }
    return res;
  }

  function recentGet(){ try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch(e){ return []; } }
  function recentAdd(term){
    var t = (term||'').trim(); if (!t) return;
    try {
      var list = recentGet().filter(function(x){ return norm(x) !== norm(t); });
      list.unshift(t); list = list.slice(0, RECENT_MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch(e){}
  }
  function recentRemove(term){
    try {
      var list = recentGet().filter(function(x){ return norm(x) !== norm(term); });
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch(e){}
  }
  function recentRemoveAll(){ try { localStorage.removeItem(RECENT_KEY); } catch(e){} }

  var ICON_CLOCK = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
  var ICON_SEARCH = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M20 20l-3.4-3.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var ICON_TREND = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>';
  var ICON_ARROW = '<svg class="kp-sgarrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 17L17 7M9 7h8v8"/></svg>';

  function renderSuggest(term){
    if (!SHEET) return;
    var sg = SHEET.sg, html = '';
    if (term){
      var sg_terms = suggest(term);
      if (sg_terms.length){
        html += '<div class="kp-sg-sec">';
        html += sg_terms.map(function(t){
          return '<button type="button" class="kp-sgrow" data-kp-sgterm="'+esc(t)+'">'+ICON_SEARCH
               + '<span class="kp-sgt">'+hl(t, term)+'</span>'+ICON_ARROW+'</button>';
        }).join('');
        html += '</div>';
      }
    } else {
      var rec = recentGet();
      if (rec.length){
        html += '<div class="kp-sg-sec"><p class="kp-sg-h">Letzte Suchen'
              + '<button type="button" class="kp-sg-clear" data-kp-recclear>Verlauf löschen</button></p>';
        html += rec.map(function(t){
          return '<div class="kp-sgrow kp-rec" data-kp-sgterm="'+esc(t)+'">'+ICON_CLOCK
               + '<span class="kp-sgt">'+esc(t)+'</span>'
               + '<button type="button" class="kp-recx" data-kp-recx="'+esc(t)+'" aria-label="Entfernen">&times;</button></div>';
        }).join('');
        html += '</div>';
      }
      if (POPULAR.length){
        html += '<div class="kp-sg-sec"><p class="kp-sg-h">Beliebt</p><div class="kp-chips2">';
        html += POPULAR.map(function(t){
          return '<button type="button" class="kp-sgchip" data-kp-sgterm="'+esc(t)+'">'+ICON_TREND+esc(t)+'</button>';
        }).join('');
        html += '</div></div>';
      }
    }
    sg.innerHTML = html;
  }

  /* ---- CSS (Onest · Monochrom-Deep · 8px · Ink-Eyebrows) --------------- */
  function injectCSS(){
    if (document.getElementById('kp-search-css')) return;
    var css = `
.kp-search{position:relative;display:block;flex:1 1 auto;max-width:460px;font-family:Onest,"DM Sans",sans-serif;color:#1E1E1E}
.kp-field{display:flex;width:100%;box-sizing:border-box;align-items:center;gap:10px;background:#fff;border:1.5px solid #1E1E1E;border-radius:8px;padding:13px 12px 13px 14px;transition:box-shadow .16s}
.kp-field:focus-within{box-shadow:0 10px 30px -8px rgba(10,10,10,.22)}
.kp-field input{border:0;outline:0;flex:1;font:inherit;font-size:15px;color:#1E1E1E;background:transparent}
.kp-field input::placeholder{color:#a39d94}
/* Sticky/scrolled header slot: more compact than the main field */
.header_scrolled-search.kp-search{max-width:360px !important}
.header_scrolled-link{padding-top:6px}
.header_scrolled-search .kp-field{padding:8px 11px 8px 13px;gap:9px;border-width:1.5px}
.header_scrolled-search .kp-field input{font-size:14px}
.header_scrolled-search .kp-field svg{width:18px;height:18px}
.header_scrolled-search .kp-kbd{padding:1px 7px;font-size:11px}
.kp-kbd{font-size:12px;color:#6f6a63;border:1px solid #E5E5E5;border-radius:5px;padding:2px 8px;background:#FAFAFA}
.kp-search.kp-has-q .kp-kbd{display:none}
.kp-clear{border:0;background:transparent;cursor:pointer;color:#6f6a63;width:28px;height:28px;border-radius:6px;display:none;align-items:center;justify-content:center}
.kp-clear:hover{background:#F2F0EB;color:#1E1E1E}
.kp-search.kp-has-q .kp-clear{display:flex}
.kp-scrim{position:fixed;inset:0;background:rgba(10,10,10,.34);z-index:99;opacity:0;pointer-events:none;transition:opacity .2s}
.kp-scrim.kp-open{opacity:1;pointer-events:auto}
.kp-panel{position:fixed;z-index:100000;left:0;top:0;width:min(960px,calc(100vw - 48px));max-height:min(72vh,560px);flex-direction:column;background:#fff;border:1px solid #E5E5E5;border-radius:8px;box-shadow:0 30px 80px -20px rgba(10,10,10,.30);overflow:hidden;display:none;font-family:Onest,"DM Sans",sans-serif;color:#1E1E1E}
.kp-panel.kp-open{display:flex;animation:kp-pop .2s cubic-bezier(.2,.7,.3,1) both}
@keyframes kp-pop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.kp-cols{display:grid;grid-template-columns:258px minmax(0,1fr);flex:1 1 auto;min-height:0}
.kp-col{padding:20px 22px;min-height:0;overflow-y:auto}
.kp-c1{background:#FAFAFA;border-right:1px solid #E5E5E5}
.kp-eyebrow{font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#1E1E1E;margin:0 0 14px;display:flex;align-items:center;gap:10px}
.kp-eyebrow::after{content:"";flex:1;height:1px;background:#1E1E1E}
.kp-eyebrow .kp-meta{letter-spacing:.04em;color:#6f6a63;text-transform:none;font-weight:400}
.kp-rrow{display:flex;align-items:center;gap:12px;padding:11px 6px;margin:0 -6px;border-radius:8px;cursor:pointer;transition:background .12s,transform .12s,opacity .12s}
.kp-rrow:hover{background:#fff;transform:translateX(3px)}
.kp-rrow .kp-ic{width:22px;height:22px;flex:none;color:#1E1E1E}
.kp-rrow .kp-rn{font-size:16px;flex:1}
.kp-rrow .kp-chev{opacity:0;color:#a9a399;transition:opacity .12s}
.kp-rrow:hover .kp-chev{opacity:1}
.kp-rrow.kp-dim{opacity:.3}
.kp-rrow.kp-on{background:#1E1E1E;color:#fff}
.kp-rrow.kp-on .kp-ic{color:#fff}
.kp-rrow.kp-on .kp-chev{opacity:1;color:#fff}
.kp-rrow.kp-on mark{color:#fff}
.kp-chips{display:flex;flex-wrap:wrap;gap:8px}
.kp-chip{border:1px solid #E5E5E5;border-radius:8px;padding:7px 13px;font-size:13.5px;line-height:1.3;cursor:pointer;background:#fff;transition:.12s;display:inline-block;white-space:nowrap}
.kp-chip:hover{border-color:#1E1E1E}
.kp-chip .kp-k{font-size:11px;color:#a9a399;margin-left:6px}
.kp-chip.kp-on{background:#1E1E1E;color:#fff;border-color:#1E1E1E}
.kp-chip.kp-on .kp-k{color:rgba(255,255,255,.6)}
.kp-chip.kp-on mark{color:#fff}
.kp-chip.kp-dim{opacity:.32}
.kp-prow{display:flex;align-items:center;gap:14px;padding:9px 8px;margin:0 -8px;border-radius:8px;cursor:pointer;transition:background .12s;text-decoration:none;color:inherit}
.kp-prow:hover,.kp-prow.kp-active{background:#FAFAFA}
.kp-thumb{width:54px;height:54px;flex:none;border-radius:8px;background:#F2F0EB;display:grid;place-items:center;color:#bdb6aa;position:relative;overflow:hidden}
.kp-thumb img{width:100%;height:100%;object-fit:cover}
.kp-pname{font-size:15px;font-weight:500;line-height:1.25}
.kp-pspec{font-size:12px;color:#6f6a63;margin-top:3px;letter-spacing:.01em}
.kp-pprice{font-size:13.5px;font-weight:500;margin-top:4px}
.kp-pprice .kp-ab{color:#a9a399;font-size:11.5px;margin-right:5px;font-weight:400}
.kp-go{margin-left:auto;color:#a9a399;opacity:0;transition:.12s;flex:none}
.kp-prow:hover .kp-go,.kp-prow.kp-active .kp-go{opacity:1}
.kp-catjump{display:flex;align-items:center;gap:10px;padding:12px 8px;margin:8px -8px 0;border-radius:8px;background:#F2F0EB;cursor:pointer;font-size:14px;font-weight:500;text-decoration:none;color:inherit}
.kp-catjump .kp-k{margin-left:auto;font-size:12px;color:#6f6a63;font-weight:400}
.kp-panel mark,.kp-search mark{background:transparent;color:#1E1E1E;font-weight:600}
.kp-muted{color:#a9a399;font-size:13.5px;padding:8px 0;line-height:1.5}
.kp-foot{border-top:1px solid #E5E5E5;padding:15px 26px;display:flex;justify-content:space-between;align-items:center}
.kp-foot .kp-hint{font-size:12px;color:#a9a399}
.kp-foot a{color:#1E1E1E;font-weight:500;font-size:14.5px;text-decoration:none;cursor:pointer}
.kp-foot a .kp-u{border-bottom:1.5px solid #1E1E1E;padding-bottom:1px}
.kp-stg{animation:kp-rise .26s ease both}
@keyframes kp-rise{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
@media(max-width:760px){.kp-cols{grid-template-columns:1fr}.kp-c1{border-right:0;border-bottom:1px solid #E5E5E5}.kp-panel{width:calc(100vw - 24px)}}
.kp-sheet{position:fixed;inset:0;z-index:100001;background:#fff;display:none;flex-direction:column;font-family:Onest,"DM Sans",sans-serif;color:#1E1E1E}
.kp-sheet.kp-open{display:flex}
.kp-sheet-top{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:0.5px solid #E5E5E5}
.kp-sheet-top .kp-search{flex:1 1 auto;max-width:none}
.kp-sheet-top .kp-kbd{display:none}
.kp-sheet-close{flex:0 0 auto;border:0;background:transparent;color:#1E1E1E;font-size:26px;line-height:1;padding:2px 8px;cursor:pointer}
.kp-sheet-body{flex:1 1 auto;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch}
.kp-panel--sheet{position:static!important;width:100%!important;max-width:none!important;max-height:none!important;height:auto!important;border:0!important;border-radius:0!important;box-shadow:none!important;display:flex!important;animation:none!important}
.kp-panel--sheet .kp-cols{display:flex!important;flex-direction:column}
.kp-panel--sheet .kp-col{overflow:visible}
.kp-panel--sheet .kp-c1{border-right:0;border-bottom:0.5px solid #E5E5E5}
.kp-panel--sheet .kp-c1{display:none}
.kp-panel--sheet .kp-hint{display:none}
.kp-panel--sheet .kp-foot{justify-content:center;padding:14px 16px}
.kp-panel--sheet .kp-foot a{white-space:nowrap}
/* ---- V2 mobile suggestions / recent / popular (sheet only) ---- */
.kp-sg{display:none}
.kp-sheet .kp-sg{display:block;padding:14px 16px 4px}
.kp-sg-sec{margin-bottom:14px}
.kp-sg-h{display:flex;align-items:center;justify-content:space-between;margin:0 0 8px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#1E1E1E;font-weight:500}
.kp-sg-clear{border:0;background:transparent;color:#1E1E1E;opacity:.5;font-size:11px;letter-spacing:.04em;text-transform:none;cursor:pointer;padding:2px 0}
.kp-sg-clear:hover{opacity:1;text-decoration:underline}
.kp-sgrow{display:flex;align-items:center;gap:11px;width:100%;box-sizing:border-box;padding:11px 6px;border:0;background:transparent;text-align:left;font:inherit;color:#1E1E1E;cursor:pointer;border-radius:8px;border-bottom:0.5px solid #F2F0EB}
.kp-sgrow:last-child{border-bottom:0}
.kp-sgrow:active{background:#FAFAFA}
.kp-sgrow svg{flex:0 0 auto;color:#1E1E1E;opacity:.55}
.kp-sgrow .kp-sgt{flex:1 1 auto;min-width:0;font-size:15px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kp-sgrow .kp-sgt mark{background:transparent;color:#1E1E1E;font-weight:600}
.kp-sgrow .kp-sgarrow{flex:0 0 auto;opacity:.4}
.kp-rec .kp-recx{flex:0 0 auto;border:0;background:transparent;color:#1E1E1E;opacity:.4;font-size:18px;line-height:1;padding:4px 6px;cursor:pointer;border-radius:6px}
.kp-rec .kp-recx:active{background:#F2F0EB;opacity:.9}
.kp-chips2{display:flex;flex-wrap:wrap;gap:8px}
.kp-sgchip{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid #E5E5E5;border-radius:8px;background:#fff;color:#1E1E1E;font-size:13px;font-weight:400;cursor:pointer;font-family:inherit}
.kp-sgchip:active{background:#FAFAFA;border-color:#1E1E1E}
.kp-sgchip svg{opacity:.5}
`;
    var st = document.createElement('style'); st.id = 'kp-search-css'; st.textContent = css; document.head.appendChild(st);
  }

  /* ---- BUILD UI -------------------------------------------------------- */
  var els = {};            // panel refs + pointers to the ACTIVE field
  var FIELDS = [];         // [{root, field, input, clear}]

  var FIELD_HTML =
      '<div class="kp-field">'
    + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#1E1E1E" stroke-width="1.7"/><path d="M20 20l-3.4-3.4" stroke="#1E1E1E" stroke-width="1.7" stroke-linecap="round"/></svg>'
    + '<input type="text" placeholder="Suche nach Tischplatte, Schreibtisch, Eiche …" autocomplete="off" aria-label="Suche">'
    + '<span class="kp-kbd">/</span>'
    + '<button class="kp-clear" aria-label="Leeren"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>'
    + '</div>';

  function buildPanel(){
    var panel = document.createElement('div'); panel.className = 'kp-panel';
    panel.innerHTML =
        '<div class="kp-cols">'
      +   '<div class="kp-col kp-c1"><p class="kp-eyebrow">Nach Raum</p><div data-kp-rooms></div>'
      +     '<p class="kp-eyebrow" style="margin-top:26px">Kategorien</p><div class="kp-chips" data-kp-cats></div></div>'
      +   '<div class="kp-col kp-c2"><p class="kp-eyebrow"><span data-kp-plabel>Bestseller</span><span class="kp-meta" data-kp-pmeta></span></p><div data-kp-products></div></div>'
      + '</div>'
      + '<div class="kp-foot"><span class="kp-hint">↑ ↓ navigieren · ↵ alle Treffer · ESC schließen</span>'
      +   '<a data-kp-all><span class="kp-u">Zu allen <span data-kp-count>0</span> Ergebnissen</span> →</a></div>';
    var scrim = document.createElement('div'); scrim.className = 'kp-scrim';
    document.body.appendChild(scrim); document.body.appendChild(panel);
    els.panel = panel; els.scrim = scrim;
    els.rooms = panel.querySelector('[data-kp-rooms]');
    els.cats = panel.querySelector('[data-kp-cats]');
    els.products = panel.querySelector('[data-kp-products]');
    els.plabel = panel.querySelector('[data-kp-plabel]');
    els.pmeta = panel.querySelector('[data-kp-pmeta]');
    els.count = panel.querySelector('[data-kp-count]');
    els.all = panel.querySelector('[data-kp-all]');
  }

  function buildField(mount){
    mount.classList.add('kp-search');
    // Neutralize the host slot (pre-styled fake search bar: border/padding/flex/max-width)
    mount.style.cssText += ';display:flex;align-items:center;border:0;padding:0;background:transparent;max-width:460px;min-width:0;min-height:0;height:auto;color:#1E1E1E;cursor:auto;overflow:visible;box-shadow:none;gap:0';
    mount.innerHTML = FIELD_HTML;
    var f = { root: mount, field: mount.querySelector('.kp-field'), input: mount.querySelector('input'), clear: mount.querySelector('.kp-clear') };
    FIELDS.push(f);
    return f;
  }
  function setActive(f){ els.root = f.root; els.field = f.field; els.input = f.input; }
  function mirror(v){ FIELDS.forEach(function(f){ if (f.input.value !== v) f.input.value = v; }); }
  function visibleField(){
    for (var i=0;i<FIELDS.length;i++){
      var r = FIELDS[i].field.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) return FIELDS[i];
    }
    return null;
  }

  /* ---- RENDER ---------------------------------------------------------- */
  var nav = [], ai = -1, activeRoom = null;

  function roomName(slug){ for (var i=0;i<IDX.rooms.length;i++){ if(IDX.rooms[i].s===slug) return IDX.rooms[i].n; } return null; }

  // Deep-link into the PLP's Finsweet CMS Filter via its field query params (kategorie/raume).
  function matchedCat(term){
    if (!term) return null;
    return IDX.cats.filter(function(c){ return norm(c.n) === norm(term); })[0]
        || IDX.cats.filter(function(c){ return norm(c.n).indexOf(norm(term)) > -1; })[0] || null;
  }
  function resultsURL(){
    var term = els.input.value.trim();
    var params = [];
    if (activeRoom){ var rn = roomName(activeRoom); if (rn) params.push('raume=' + encodeURIComponent(rn)); }
    var cat = matchedCat(term);
    if (cat) params.push('kategorie=' + encodeURIComponent(cat.n));
    return kpLP() + '/produkte' + (params.length ? '?' + params.join('&') : '');
  }

  function renderRooms(){
    els.rooms.innerHTML = IDX.rooms.map(function(r){
      var ic = r.icon || ROOM_FALLBACK_ICONS[r.s] || '';
      var on = activeRoom === r.s;
      return '<div class="kp-rrow'+(on?' kp-on':'')+'" data-kp-room="'+esc(r.s)+'">'
        + '<svg class="kp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+ic+'</svg>'
        + '<span class="kp-rn">'+esc(r.n)+'</span>'
        + '<svg class="kp-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></div>';
    }).join('');
  }
  function renderCats(term){
    els.cats.innerHTML = IDX.cats.map(function(c){
      var hit = !term || norm(c.n).indexOf(norm(term)) > -1;
      return '<span class="kp-chip'+(term&&hit?' kp-on':'')+(term&&!hit?' kp-dim':'')+'" data-kp-set="'+esc(c.n)+'">'
        + hl(c.n,term) + '<span class="kp-k">'+ (c.k||0) +'</span></span>';
    }).join('');
  }
  function matchProducts(term){
    var base = activeRoom ? IDX.products.filter(function(p){ return (p.rm||[]).indexOf(activeRoom) > -1; }) : IDX.products;
    if (!term){
      var bs = base.filter(function(p){ return p.bs; });
      if (bs.length < CFG.MAX_PRODUCTS){
        var rest = base.filter(function(p){ return !p.bs; });
        bs = bs.concat(rest.slice(0, CFG.MAX_PRODUCTS - bs.length));
      }
      return bs;
    }
    var n = norm(term);
    return base.filter(function(p){ return norm((p.n||'')+' '+(p.c||'')+' '+(p.sp||'')).indexOf(n) > -1; });
  }
  function renderProducts(term){
    var list = matchProducts(term);
    els.plabel.textContent = term ? 'Produkte' : (activeRoom ? roomName(activeRoom) : 'Bestseller');
    var total = activeRoom ? IDX.products.filter(function(p){ return (p.rm||[]).indexOf(activeRoom) > -1; }).length : IDX.products.length;
    els.pmeta.textContent = term ? (list.length + ' Treffer') : (total + ' Produkte');
    var html = list.slice(0, CFG.MAX_PRODUCTS).map(function(p, i){
      return '<a class="kp-prow kp-stg" href="'+CFG.PDP(p.s)+'" style="animation-delay:'+(i*22)+'ms" data-kp-nav>'
        + thumb(p)
        + '<div><div class="kp-pname">'+hl(p.n,term)+'</div>'
        + (p.sp ? '<div class="kp-pspec">'+esc(p.sp)+'</div>' : '')
        + '<div class="kp-pprice">'+(p.p?esc(p.p):'')+'</div></div>'
        + '<svg class="kp-go" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></a>';
    }).join('');
    if (term){
      var catHit = IDX.cats.filter(function(c){ return norm(c.n).indexOf(norm(term)) > -1; })[0];
      if (catHit && list.length < 3){
        html += '<a class="kp-catjump" href="'+kpLP()+'/produkte?kategorie='+encodeURIComponent(catHit.n)+'">'
          + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>'
          + 'Alle <b style="font-weight:600">'+esc(catHit.n)+'</b> ansehen<span class="kp-k">'+(catHit.k||0)+' Produkte →</span></a>';
      }
    }
    if (!html) html = '<div class="kp-muted">— keine Treffer für „'+esc(term)+'". Versuch ein Material oder Maß (z.&nbsp;B. „Eiche", „25 mm").</div>';
    els.products.innerHTML = html;
    nav = [].slice.call(els.products.querySelectorAll('.kp-prow'));
  }
  function renderCount(term){
    var n = term ? matchProducts(term).length
                 : (activeRoom ? IDX.products.filter(function(p){ return (p.rm||[]).indexOf(activeRoom) > -1; }).length : IDX.products.length);
    els.count.textContent = n;
    els.all.setAttribute('href', resultsURL());
  }
  function render(){
    var term = els.input.value.trim();
    for (var i=0;i<FIELDS.length;i++) FIELDS[i].root.classList.toggle('kp-has-q', term.length > 0);
    renderRooms(); renderCats(term); renderProducts(term); renderCount(term);
    if (sheetOpen) renderSuggest(term);
  }

  /* ---- INTERACTION ----------------------------------------------------- */
  var isOpen = false;
  function positionPanel(){
    var r = els.field.getBoundingClientRect();
    var vw = window.innerWidth, pad = 24;
    var w = Math.min(960, vw - pad * 2);
    var left = Math.min(r.left, vw - pad - w);
    left = Math.max(pad, left);
    els.panel.style.width = w + 'px';
    els.panel.style.left = left + 'px';
    els.panel.style.top = (r.bottom + 12) + 'px';
  }
  function open(){ if (isOpen) return; isOpen = true; positionPanel(); els.panel.classList.add('kp-open'); els.scrim.classList.add('kp-open'); }
  function close(){ isOpen = false; els.panel.classList.remove('kp-open'); els.scrim.classList.remove('kp-open'); }

  /* ---- MOBILE FULL-SCREEN SHEET (reuses the same panel) ---------------- */
  var SHEET = null, sheetOpen = false;
  function buildSheet(){
    var sheet = document.createElement('div'); sheet.className = 'kp-sheet';
    var top = document.createElement('div'); top.className = 'kp-sheet-top';
    var fieldWrap = document.createElement('div'); fieldWrap.className = 'kp-search'; fieldWrap.innerHTML = FIELD_HTML;
    var closeBtn = document.createElement('button'); closeBtn.className = 'kp-sheet-close'; closeBtn.setAttribute('aria-label', 'Schließen'); closeBtn.innerHTML = '&times;';
    top.appendChild(fieldWrap); top.appendChild(closeBtn);
    var body = document.createElement('div'); body.className = 'kp-sheet-body';
    var sg = document.createElement('div'); sg.className = 'kp-sg'; sg.setAttribute('data-kp-suggest','');
    body.appendChild(sg);
    sheet.appendChild(top); sheet.appendChild(body);
    document.body.appendChild(sheet);
    var f = { root: fieldWrap, field: fieldWrap.querySelector('.kp-field'), input: fieldWrap.querySelector('input'), clear: fieldWrap.querySelector('.kp-clear'), sheet: true };
    FIELDS.push(f);
    SHEET = { el: sheet, body: body, field: f, close: closeBtn, sg: sg };
    sg.addEventListener('click', function(e){
      var clr = e.target.closest('[data-kp-recclear]');
      if (clr){ recentRemoveAll(); renderSuggest(SHEET.field.input.value.trim()); return; }
      var rx = e.target.closest('[data-kp-recx]');
      if (rx){ e.stopPropagation(); recentRemove(rx.getAttribute('data-kp-recx')); renderSuggest(SHEET.field.input.value.trim()); return; }
      var row = e.target.closest('[data-kp-sgterm]');
      if (row){ var t = row.getAttribute('data-kp-sgterm'); mirror(t); recentAdd(t); ai=-1; render(); SHEET.field.input.focus(); }
    });
  }
  function openSheet(){
    if (sheetOpen || !SHEET) return; sheetOpen = true;
    activeRoom = null; ai = -1;
    SHEET.body.appendChild(els.panel);                 // move the shared panel into the sheet
    els.panel.style.cssText = '';                      // drop desktop fixed-position inline styles
    els.panel.classList.add('kp-open', 'kp-panel--sheet');
    setActive(SHEET.field);
    SHEET.el.classList.add('kp-open');
    document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden';
    render();
    setTimeout(function(){ SHEET.field.input.focus(); }, 60);
  }
  function closeSheet(){
    if (!sheetOpen) return; sheetOpen = false;
    SHEET.el.classList.remove('kp-open');
    els.panel.classList.remove('kp-open', 'kp-panel--sheet');
    document.body.appendChild(els.panel);              // return the panel to <body> for desktop
    document.documentElement.style.overflow = ''; document.body.style.overflow = '';
  }
  function reposition(){ var f = visibleField(); if (!f){ close(); return; } setActive(f); positionPanel(); }
  function highlight(){ nav.forEach(function(el,i){ el.classList.toggle('kp-active', i===ai); }); if (nav[ai]) nav[ai].scrollIntoView({block:'nearest'}); }

  /* Self-correcting vertical centering: measure each field's real position inside its
     header row and nudge it to the row's exact center (handles logo height, animated
     max-height and any inline padding the scroll script applies). */
  function headerRowOf(f){ return f.root.closest('.header_toprow, .header_scrolled, .header_mobile-row'); }
  function equalize(){
    for (var i=0;i<FIELDS.length;i++){
      var f = FIELDS[i], row = headerRowOf(f);
      if (!row) continue;
      var fr = f.field.getBoundingClientRect(), rr = row.getBoundingClientRect();
      if (rr.height < 8 || fr.height < 4) continue; // collapsed/hidden → skip
      var cur = f._ty || 0;
      var delta = ((rr.top + rr.bottom) / 2) - ((fr.top + fr.bottom) / 2) + cur;
      f._ty = delta;
      f.field.style.transform = Math.abs(delta) < 0.5 ? '' : 'translateY(' + delta.toFixed(1) + 'px)';
    }
  }
  var _eqRAF;
  function equalizeSoon(){ if (_eqRAF) cancelAnimationFrame(_eqRAF); _eqRAF = requestAnimationFrame(equalize); }

  function wire(){
    FIELDS.forEach(function(f){
      f.input.addEventListener('focus', function(){ setActive(f); if (!f.sheet) open(); });
      f.input.addEventListener('input', function(){ setActive(f); mirror(f.input.value); ai=-1; render(); });
      f.clear.addEventListener('click', function(){ setActive(f); mirror(''); ai=-1; render(); f.input.focus(); });
      if (f.sheet){
        f.input.addEventListener('keydown', function(e){
          if (e.key === 'Enter' && (f.input.value.trim() || activeRoom)){ recentAdd(f.input.value.trim()); window.location.href = resultsURL(); }
          if (e.key === 'Escape'){ if (f.input.value){ mirror(''); ai=-1; render(); } else closeSheet(); }
        });
      }
    });
    // Mobile: tapping the whole search bar (m-search-row) opens the full-screen sheet
    [].forEach.call(document.querySelectorAll('[data-mobile-trigger="search-open"]'), function(t){
      t.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); openSheet(); });
    });
    if (SHEET) SHEET.close.addEventListener('click', closeSheet);
    els.scrim.addEventListener('click', close);
    window.addEventListener('resize', function(){ equalizeSoon(); if (isOpen) reposition(); });
    window.addEventListener('scroll', function(){
      equalizeSoon();
      if (!isOpen) return;
      // Don't move the panel while scrolling (that caused it to jump). The panel is
      // position:fixed and the sticky field stays put, so they remain aligned.
      // Only close if the anchored field has scrolled out of view.
      var r = els.field.getBoundingClientRect();
      if (r.bottom < 4 || r.top > window.innerHeight - 4) close();
    }, true);
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && sheetOpen){ if (SHEET.field.input.value){ mirror(''); ai=-1; render(); } else closeSheet(); return; }
      if (e.key === '/' && (!document.activeElement || document.activeElement.tagName !== 'INPUT')){ e.preventDefault(); var f = visibleField() || FIELDS[0]; if (f){ setActive(f); f.input.focus(); open(); } }
      if (e.key === 'Escape'){ if (els.input.value){ mirror(''); ai=-1; render(); } else close(); }
      if (!isOpen) return;
      if (e.key === 'ArrowDown'){ e.preventDefault(); ai=Math.min(ai+1, nav.length-1); highlight(); }
      if (e.key === 'ArrowUp'){ e.preventDefault(); ai=Math.max(ai-1, -1); highlight(); }
      if (e.key === 'Enter'){
        if (ai > -1 && nav[ai]){ window.location.href = nav[ai].getAttribute('href'); }
        else if (els.input.value.trim() || activeRoom){ window.location.href = resultsURL(); }
      }
    });
    // room = toggle filter · category chip = set text filter (panel is on <body>)
    els.panel.addEventListener('click', function(e){
      if (sheetOpen && e.target.closest('a[href]')){ var q = els.input.value.trim(); if (q) recentAdd(q); }
      var room = e.target.closest('[data-kp-room]');
      if (room){
        var rs = room.getAttribute('data-kp-room');
        activeRoom = (activeRoom === rs) ? null : rs;
        ai=-1; render(); els.input.focus();
        return;
      }
      var set = e.target.closest('[data-kp-set]'); if (!set) return;
      var val = set.getAttribute('data-kp-set');
      mirror(els.input.value.trim() === val ? '' : val);
      ai=-1; render(); els.input.focus();
    });
    // click outside any field + panel closes
    document.addEventListener('mousedown', function(e){
      if (!isOpen) return;
      if (els.panel.contains(e.target)) return;
      for (var i=0;i<FIELDS.length;i++){ if (FIELDS[i].root.contains(e.target)) return; }
      close();
    });
  }

  /* ---- DATA LOAD ------------------------------------------------------- */
  function applyIndex(data){
    IDX.products = data.products || [];
    IDX.cats = data.cats || [];
    IDX.rooms = data.rooms || [];
    buildVocab();
  }
  function loadIndex(){
    try {
      var cached = sessionStorage.getItem(CFG.CACHE_KEY);
      if (cached){ applyIndex(JSON.parse(cached)); render(); }
    } catch(e){}
    var __self=(document.querySelector('script[src*="/dist/search.js"]')||{}).src||'';
    var __idx=__self?__self.replace(/search\.js(?:\?.*)?$/,'search-index.json'):CFG.INDEX_URL;
    return fetch(__idx, { credentials:'omit' })
      .then(function(r){ if(!r.ok) throw new Error('index '+r.status); return r.json(); })
      .then(function(data){
        applyIndex(data);
        try { sessionStorage.setItem(CFG.CACHE_KEY, JSON.stringify(data)); } catch(e){}
        render();
      })
      .catch(function(err){ console.warn('[kp-search] index load failed', err); });
  }

  /* ---- INIT ------------------------------------------------------------ */
  function init(){
    var seen = [], mounts = [];
    document.querySelectorAll(CFG.MOUNT + ', .header_scrolled-search').forEach(function(el){
      if (seen.indexOf(el) < 0){ seen.push(el); mounts.push(el); }
    });
    if (!mounts.length) return;
    injectCSS();
    buildPanel();
    mounts.forEach(buildField);
    buildSheet();
    setActive(FIELDS[0]);
    wire();
    render();      // renders empty-state from cache (if any) immediately
    loadIndex();   // then refreshes from network
    equalize();
    [120, 400, 900].forEach(function(ms){ setTimeout(equalize, ms); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(equalize);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.KPSearch = { version: '1.0.18', reload: loadIndex, _idx: IDX, center: function(){ equalize(); },
                      _suggest: function(t){ return suggest(t); }, _popular: function(){ return POPULAR; }, _recent: recentGet };
})();
