/*!
 * kessler-pro-scripts / plp.js
 * Product Listing Page — client-rendered grid + faceted filtering.
 *
 * v2.1.0 — robuste Cart-Verdrahtung (21.06.2026)
 *   - Add-to-Cart deterministisch via fetchProduct(pid)->Variant->addToCart
 *     (kein sf-product/refetch mehr -> keine Race-Condition, keine Shopyflow-Warnungen).
 *
 * v2.0.0 — FULL REWRITE (21.06.2026)
 *   - Finsweet entfernt (cmsload/cmsfilter/cmssort raus).
 *   - Grid wird komplett client-seitig aus dist/plp-filterdata.json gerendert
 *     (loest Webflow-100-Karten-Cap; voller Katalog, skaliert).
 *     JSON wird FRISCH von @main geladen (stuendlich per GitHub Action regeneriert),
 *     NICHT vom commit-gepinnten Bootstrap-Pfad -> neue CMS-Produkte erscheinen
 *     automatisch.
 *   - Add-to-Cart: Karten tragen sf-product + sf-add-to-cart="1"; nach dem Render
 *     EIN Shopyflow.refetch() -> Shopyflow verdrahtet alle Karten nativ.
 *   - Wunschliste: kp-wl-toggle + data-*; bindet per Delegation, kpw:change nach Render.
 *   - Faceted Filter-Engine (OR innerhalb Sektion, AND ueber Sektionen):
 *     Kategorie, Raeume, Farbe, Breite/Tiefe/Dicke (rund -> Durchmesser), Preis.
 *   - Tote Optionen (0 Produkte global) ausgeblendet; Live-Counts je Option.
 *   - Pills, Counter, Clear-All, Sort an echte Filterung gehaengt.
 */
(function () {
  'use strict';

  var DATA_URL =
    'https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@main/dist/plp-filterdata.json';

  function injectStyle(css, id) {
    var s = document.createElement('style');
    s.id = id || 'plpcss';
    s.textContent = css;
    document.head.appendChild(s);
  }

  injectStyle(
    '#sort-select{background:#FAFAFA url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236A6A66\' stroke-width=\'1.6\'><path d=\'M6 9l6 6 6-6\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>") no-repeat right 10px center/14px}' +
      '@media(min-width:992px){' +
        'body:not(.is-drawer-open) .plp-shop-inner{grid-template-columns:0 1fr!important;gap:0!important}' +
        'body:not(.is-drawer-open) .plp-drawer{opacity:0;pointer-events:none;visibility:hidden}' +
        'body.is-drawer-open .plp-shop-inner{grid-template-columns:360px 1fr!important;gap:32px!important}' +
        'body.is-drawer-open .plp-grid{grid-template-columns:repeat(3,1fr)!important}' +
        'body:not(.is-drawer-open) .plp-grid{grid-template-columns:repeat(4,1fr)!important}' +
        '.product-card_wrapper{width:auto!important;max-width:none!important;min-width:0!important;flex-shrink:1!important;flex-basis:auto!important}' +
      '}' +
      '.product-card_content{padding-bottom:4px!important}' +
      '.product-card_wrapper.is-hidden{display:none!important}' +
      '.plp-filter-option.is-hidden,.w-dyn-item.is-hidden{display:none!important}' +
      '.plp-filter-count{font-feature-settings:"tnum";color:#9a9a96}' +
      '.plp-tags-row:empty{display:none}' +
      '.plp-clear-all.is-hidden,.plp-filter-btn-num:empty,.plp-filter-btn-num.is-zero{display:none}' +
      '.plp-drawer-close:hover{background:#F2F2F2;color:#0A0A0A}' +
      '.plp-drawer-apply:hover{background:#1a1a1a}' +
      '.plp-drawer-clear:hover{border-color:#0A0A0A;color:#0A0A0A}' +
      '.plp-filter-btn:hover{background:#1a1a1a}' +
      '.plp-clear-all:hover{color:#0A0A0A}' +
      '.plp-tag-x:hover{color:#0A0A0A}' +
      'body.is-drawer-open .plp-filter-btn{background:#FFFFFF;color:#0A0A0A;border:1px solid #0A0A0A}' +
      'body.is-drawer-open .plp-filter-btn-num{background:#0A0A0A;color:#F2F0EB}' +
      '@media(max-width:991px){' +
        '.plp-shop-inner{display:block!important;grid-template-columns:none!important;gap:0!important}' +
        '.product-card_wrapper{width:100%!important;max-width:none!important;min-width:0!important;flex-shrink:1!important;flex-basis:auto!important}' +
        '.plp-drawer{position:fixed!important;top:0!important;left:0;right:0;bottom:0;width:100%;max-height:100vh;background:#fff;z-index:9999;transform:translateX(-100%);transition:transform .3s;border-radius:0;display:block!important}' +
        'body.is-drawer-open .plp-drawer{transform:translateX(0)}' +
        'body.is-drawer-open{overflow:hidden}' +
        '.plp-drawer-inner{border:0;border-radius:0;height:100%;display:flex;flex-direction:column}' +
        '.plp-grid{grid-template-columns:1fr!important;gap:24px!important}' +
      '}' +
      '@media(max-width:479px){.plp-grid{grid-template-columns:1fr!important;gap:20px!important}}'
  );

  injectStyle(
    '.plp-drawer-inner{scrollbar-width:none;-ms-overflow-style:none}' +
      '.plp-drawer-inner::-webkit-scrollbar{display:none;width:0;height:0;background:transparent}' +
      '.plp-drawer,.plp-drawer-body,.plp-filter-list{scrollbar-width:none;-ms-overflow-style:none}' +
      '.plp-drawer::-webkit-scrollbar,.plp-drawer-body::-webkit-scrollbar,.plp-filter-list::-webkit-scrollbar{display:none;width:0;height:0;background:transparent}' +
      '.plp-filter-price-input,.plp-filter-price-sep{display:none!important}' +
      '.plp-price-slider{padding:8px 0;width:100%;box-sizing:border-box}' +
      '.plp-price-labels{display:flex;justify-content:space-between;margin-bottom:14px}' +
      '.plp-price-label-group--right{text-align:right}' +
      '.plp-price-label-tag{display:block;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#999;font-weight:500}' +
      '.plp-price-label-val{display:block;font-size:14px;font-weight:500;color:#0A0A0A;margin-top:2px;font-feature-settings:"tnum"}' +
      '.plp-price-track{position:relative;height:4px;background:#E5E3DD;border-radius:2px;margin:12px 8px}' +
      '.plp-price-fill{position:absolute;top:0;bottom:0;background:#0A0A0A;border-radius:2px}' +
      '.plp-price-knob{position:absolute;top:50%;width:18px;height:18px;background:#fff;border:2px solid #0A0A0A;border-radius:50%;transform:translate(-50%,-50%);cursor:grab;touch-action:none;outline:none;transition:box-shadow .12s;box-sizing:border-box}' +
      '.plp-price-knob:hover,.plp-price-knob:focus-visible{box-shadow:0 0 0 6px rgba(10,10,10,0.08)}' +
      '.plp-price-knob.is-dragging{cursor:grabbing;box-shadow:0 0 0 8px rgba(10,10,10,0.12)}' +
      '.plp-page-h1{font-weight:300!important}'
  );

  injectStyle(
    '.plp-filter-section.is-closed .plp-filter-body{display:none}' +
      '.plp-filter-checkbox{appearance:none;-webkit-appearance:none;width:16px;height:16px;border:1.5px solid #999;border-radius:3px;background-color:#fff;cursor:pointer;flex-shrink:0;margin:0}' +
      '.plp-filter-checkbox:checked{background-color:#0a0a0a;border-color:#0a0a0a}'
  );

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var LOC = (function () {
    var l = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (l.indexOf('pl') === 0) return 'pl';
    if (l.indexOf('en') === 0) return 'en';
    var pth = location.pathname.toLowerCase();
    if (pth.indexOf('/pl-pl') === 0 || pth.indexOf('/pl/') === 0) return 'pl';
    if (pth.indexOf('/en') === 0) return 'en';
    return 'de';
  })();
  function money(n) { if (n == null) return ''; var s = n.toFixed(2).replace('.', ','); return LOC === 'pl' ? s + '\u00a0z\u0142' : s + '\u00a0\u20ac'; }
  function eur(n) { return money(n); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function effW(p) { return p.breite != null ? p.breite : p.durchmesser; }
  function effD(p) { return p.tiefe != null ? p.tiefe : p.durchmesser; }

  var HEART_SVG =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block" class="inline-svg-0"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
  var CART_SVG =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="product-card_cart-overlay-icon inline-svg-0" style="display:block"><path d="M2 3h2.5l3.5 14h11l3.5-11H6.5"></path><circle cx="9" cy="20" r="1.5"></circle><circle cx="18" cy="20" r="1.5"></circle></svg>';

  var PRODUCTS = [];
  var NODE_BY_SLUG = {};
  var SECTIONS = [];
  var PRICE = { min: 0, max: 500, from: 0, to: 500, reset: null };
  var SORT = 'default';

  function cardHTML(p) {
    var price = p.priceRaw || money(p.price);
    var badge = p.bestseller ? 'Bestseller' : '';
    return (
      '<div role="listitem" class="product-card_wrapper w-dyn-item" data-kp-card="1" data-slug="' + esc(p.slug) + '" data-pid="' + esc(p.pid) + '">' +
        '<div class="product-card_root">' +
          '<div class="product-card_image-wrapper">' +
            '<img src="' + esc(p.img) + '" loading="lazy" alt="" class="product-card_image"/>' +
            '<div class="product-card_badge badge-sm">' + esc(badge) + '</div>' +
            '<a data-rating="" class="kp-wl-toggle w-button" data-price="' + esc(price) + '" data-handle="' + esc(p.slug) + '" href="#" data-kp-wl-add="1" data-name="' + esc(p.title) + '" aria-label="Zur Wunschliste hinzuf\u00fcgen" data-specs="">' + HEART_SVG + '</a>' +
            '<div class="product-card_price"><p class="paragraph-4">' + esc(price) + '</p></div>' +
          '</div>' +
          '<div class="product-card_content card-d-pad">' +
            '<h3 class="product-card_title">' + esc(p.title) + '</h3>' +
            '<div class="product-card_rating-wrapper"><div class="w-embed"></div></div>' +
            '<a href="#" class="product-card_cart-overlay w-inline-block">' + CART_SVG + '<div>Warenkorb</div></a>' +
          '</div>' +
          '<a href="/products/' + esc(p.slug) + '" class="product-card_overlay-link w-inline-block"></a>' +
        '</div>' +
      '</div>'
    );
  }

  function renderGrid() {
    var items = $('#plp-grid .w-dyn-items') || $('#plp-grid .plp-grid') || $('#plp-grid');
    if (!items) return;
    var html = '';
    for (var i = 0; i < PRODUCTS.length; i++) html += cardHTML(PRODUCTS[i]);
    items.innerHTML = html;
    NODE_BY_SLUG = {};
    $all('[data-kp-card]', items).forEach(function (n) { NODE_BY_SLUG[n.getAttribute('data-slug')] = n; });
    try { document.dispatchEvent(new Event('kpw:change')); } catch (e) {}
  }

  // -----------------------------------------------------------------
  // Cart: deterministisch via fetchProduct(pid) -> Variant -> addToCart
  // (Shopyflow verdrahtet client-injizierte sf-product-Karten nicht zuverlaessig
  //  -> wir umgehen den DOM-Scan/refetch komplett.)
  // -----------------------------------------------------------------
  var VARIANT_CACHE = {}; // pid -> numerische Variant-id | null (nicht im Storefront)

  function variantFor(pid) {
    if (Object.prototype.hasOwnProperty.call(VARIANT_CACHE, pid)) {
      return Promise.resolve(VARIANT_CACHE[pid]);
    }
    if (!window.Shopyflow || typeof window.Shopyflow.fetchProduct !== 'function') {
      return Promise.resolve(null);
    }
    return window.Shopyflow.fetchProduct(pid).then(function (fp) {
      var v = fp && fp.variants && fp.variants[0];
      var num = (v && v.id) ? String(v.id).split('/').pop() : null;
      VARIANT_CACHE[pid] = num;
      return num;
    }).catch(function () { VARIANT_CACHE[pid] = null; return null; });
  }

  function setupCart() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.product-card_cart-overlay');
      if (!btn) return;
      var card = btn.closest('[data-kp-card]');
      if (!card) return;
      e.preventDefault();
      e.stopPropagation();
      if (btn.getAttribute('data-busy') === '1') return;
      var pid = card.getAttribute('data-pid');
      if (!pid) return;
      btn.setAttribute('data-busy', '1');
      variantFor(pid).then(function (num) {
        if (!num) { btn.removeAttribute('data-busy'); return; } // nicht im Storefront -> no-op
        return window.Shopyflow.addToCart({ lineItems: [{ merchandiseId: num, quantity: 1 }] })
          .then(function () { try { window.Shopyflow.openCart(); } catch (e2) {} });
      }).then(function () { btn.removeAttribute('data-busy'); })
        .catch(function () { btn.removeAttribute('data-busy'); });
    });
  }

  function buildIndex() {
    SECTIONS = [];
    $all('.plp-filter-section').forEach(function (sec) {
      var opts = $all('.plp-filter-option', sec);
      var field = null;
      opts.forEach(function (o) { var f = o.getAttribute('fs-cmsfilter-field'); if (f && !field) field = f; });
      if (!field || !opts.length) return;
      var optionEls = opts.map(function (o) {
        var labelEl = $('.plp-filter-label', o);
        return {
          el: o,
          checkbox: $('input[type=checkbox]', o),
          countEl: $('.plp-filter-count', o),
          labelEl: labelEl,
          value: labelEl ? labelEl.textContent.trim() : '',
          _global: 0
        };
      });
      SECTIONS.push({ field: field, options: optionEls, headCounter: $('.plp-filter-head-counter', sec) });
    });
  }

  function optMatch(field, value, p) {
    switch (field) {
      case 'kategorie': return p.kategorie === value;
      case 'raume':     return p.raume.indexOf(value) >= 0;
      case 'farbe':     return p.farben.indexOf(value) >= 0;
      case 'breite-cm': return effW(p) === parseFloat(value);
      case 'tiefe-cm':  return effD(p) === parseFloat(value);
      case 'dicke-mm':  return p.dicke === parseFloat(value);
      default:          return false;
    }
  }

  function activeOf(section) {
    var vals = [];
    section.options.forEach(function (o) { if (o.checkbox && o.checkbox.checked) vals.push(o.value); });
    return vals;
  }

  function passes(p, excludeSection, includePrice) {
    for (var i = 0; i < SECTIONS.length; i++) {
      var s = SECTIONS[i];
      if (s === excludeSection) continue;
      var act = activeOf(s);
      if (!act.length) continue;
      var ok = false;
      for (var j = 0; j < act.length; j++) { if (optMatch(s.field, act[j], p)) { ok = true; break; } }
      if (!ok) return false;
    }
    if (includePrice && (PRICE.from > PRICE.min || PRICE.to < PRICE.max)) {
      if (p.price == null || p.price < PRICE.from || p.price > PRICE.to) return false;
    }
    return true;
  }

  function apply() {
    var shown = 0;
    for (var i = 0; i < PRODUCTS.length; i++) {
      var p = PRODUCTS[i];
      var node = NODE_BY_SLUG[p.slug];
      if (!node) continue;
      var vis = passes(p, null, true);
      node.classList.toggle('is-hidden', !vis);
      if (vis) shown++;
    }
    SECTIONS.forEach(function (s) {
      s.options.forEach(function (o) {
        var c = 0;
        for (var k = 0; k < PRODUCTS.length; k++) {
          var p = PRODUCTS[k];
          if (optMatch(s.field, o.value, p) && passes(p, s, true)) c++;
        }
        if (o.countEl) o.countEl.textContent = c ? '(' + c + ')' : '';
        o.el.classList.toggle('is-hidden', o._global === 0);
        o.el.style.opacity = (c === 0 && o._global > 0) ? '0.4' : '';
      });
      var checked = s.options.filter(function (o) { return o.checkbox && o.checkbox.checked; }).length;
      if (s.headCounter) s.headCounter.textContent = checked ? '(' + checked + ')' : '';
    });
    renderPills();
    updateCounter(shown);
    updateFilterBtnNum();
    applySort();
  }

  function computeGlobalCounts() {
    SECTIONS.forEach(function (s) {
      s.options.forEach(function (o) {
        var c = 0;
        for (var k = 0; k < PRODUCTS.length; k++) { if (optMatch(s.field, o.value, PRODUCTS[k])) c++; }
        o._global = c;
      });
    });
  }

  function updateCounter(shown) {
    var el = $('.plp-page-counter');
    if (!el) return;
    var total = PRODUCTS.length;
    el.textContent = (shown === total) ? total + ' Produkte' : shown + ' von ' + total + ' Produkten';
  }

  function updateFilterBtnNum() {
    var num = $('#filter-btn-num');
    if (!num) return;
    var active = 0;
    SECTIONS.forEach(function (s) { active += activeOf(s).length; });
    if (PRICE.from > PRICE.min || PRICE.to < PRICE.max) active++;
    num.textContent = active ? active : '';
    num.classList.toggle('is-zero', active === 0);
  }

  function renderPills() {
    var row = $('#tags-row');
    if (!row) return;
    row.innerHTML = '';
    SECTIONS.forEach(function (s) {
      s.options.forEach(function (o) {
        if (!(o.checkbox && o.checkbox.checked)) return;
        row.appendChild(pill(o.value, function () { o.checkbox.checked = false; apply(); }));
      });
    });
    if (PRICE.from > PRICE.min || PRICE.to < PRICE.max) {
      row.appendChild(pill(eur(PRICE.from) + '\u2013' + eur(PRICE.to), function () { if (PRICE.reset) PRICE.reset(); }));
    }
    var clear = $('#clear-all');
    if (clear) clear.classList.toggle('is-hidden', row.children.length === 0);
  }
  function pill(text, onX) {
    var tag = document.createElement('span');
    tag.className = 'plp-tag';
    tag.textContent = text;
    var x = document.createElement('span');
    x.className = 'plp-tag-x';
    x.textContent = '\u00d7';
    x.style.cursor = 'pointer';
    x.addEventListener('click', function (e) { e.stopPropagation(); onX(); });
    tag.appendChild(x);
    return tag;
  }

  function clearAll() {
    SECTIONS.forEach(function (s) {
      s.options.forEach(function (o) { if (o.checkbox) o.checkbox.checked = false; });
    });
    if (PRICE.reset) PRICE.reset(true);
    apply();
  }

  function applySort() {
    if (SORT === 'default') return;
    var items = $('#plp-grid .w-dyn-items') || $('#plp-grid .plp-grid');
    if (!items) return;
    var order = PRODUCTS.slice();
    order.sort(function (a, b) {
      if (SORT === 'price-asc') return (a.price || 0) - (b.price || 0);
      if (SORT === 'price-desc') return (b.price || 0) - (a.price || 0);
      if (SORT === 'name-asc') return a.title.localeCompare(b.title, 'de');
      if (SORT === 'name-desc') return b.title.localeCompare(a.title, 'de');
      return 0;
    });
    order.forEach(function (p) { var n = NODE_BY_SLUG[p.slug]; if (n) items.appendChild(n); });
  }

  function setupSort() {
    var sel = $('#sort-select');
    if (!sel) return;
    var opts = [
      ['default', 'Empfohlen'],
      ['price-asc', 'Preis aufsteigend'],
      ['price-desc', 'Preis absteigend'],
      ['name-asc', 'Name A\u2013Z'],
      ['name-desc', 'Name Z\u2013A']
    ];
    sel.innerHTML = '';
    opts.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o[0]; op.textContent = o[1];
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () { SORT = sel.value; apply(); });
  }

  function setupPriceSlider() {
    var row = $('.plp-filter-price-row');
    if (!row || row.getAttribute('data-k-slider') === '1') return;
    row.setAttribute('data-k-slider', '1');
    var prices = PRODUCTS.map(function (p) { return p.price; }).filter(function (v) { return v != null; });
    if (!prices.length) return;
    PRICE.min = Math.floor(Math.min.apply(null, prices) / 10) * 10;
    PRICE.max = Math.ceil(Math.max.apply(null, prices) / 10) * 10;
    PRICE.from = PRICE.min; PRICE.to = PRICE.max;
    var step = 5;

    var slider = document.createElement('div');
    slider.className = 'plp-price-slider';
    slider.innerHTML =
      '<div class="plp-price-labels">' +
        '<div class="plp-price-label-group"><span class="plp-price-label-tag">Von</span><span class="plp-price-label-val" data-from-val></span></div>' +
        '<div class="plp-price-label-group plp-price-label-group--right"><span class="plp-price-label-tag">Bis</span><span class="plp-price-label-val" data-to-val></span></div>' +
      '</div>' +
      '<div class="plp-price-track" data-track>' +
        '<div class="plp-price-fill" data-fill></div>' +
        '<div class="plp-price-knob" data-knob="from" tabindex="0" role="slider" aria-label="Mindestpreis"></div>' +
        '<div class="plp-price-knob" data-knob="to" tabindex="0" role="slider" aria-label="H\u00f6chstpreis"></div>' +
      '</div>';
    row.parentNode.insertBefore(slider, row.nextSibling);

    var track = $('[data-track]', slider), fill = $('[data-fill]', slider);
    var knobFrom = $('[data-knob="from"]', slider), knobTo = $('[data-knob="to"]', slider);
    var fromVal = $('[data-from-val]', slider), toVal = $('[data-to-val]', slider);

    function pct(v) { return ((v - PRICE.min) / (PRICE.max - PRICE.min)) * 100; }
    function valFromX(x, rect) {
      var pp = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      var v = PRICE.min + pp * (PRICE.max - PRICE.min);
      return Math.round(v / step) * step;
    }
    function render() {
      var pf = pct(PRICE.from), pt = pct(PRICE.to);
      knobFrom.style.left = pf + '%'; knobTo.style.left = pt + '%';
      fill.style.left = pf + '%'; fill.style.width = (pt - pf) + '%';
      fromVal.textContent = eur(PRICE.from); toVal.textContent = eur(PRICE.to);
    }
    function startDrag(which) {
      return function (e) {
        e.preventDefault();
        var knob = which === 'from' ? knobFrom : knobTo;
        knob.classList.add('is-dragging');
        var rect = track.getBoundingClientRect();
        function move(ev) {
          var x = ev.touches ? ev.touches[0].clientX : ev.clientX;
          var v = valFromX(x, rect);
          if (which === 'from') PRICE.from = Math.min(v, PRICE.to - step);
          else PRICE.to = Math.max(v, PRICE.from + step);
          if (PRICE.from < PRICE.min) PRICE.from = PRICE.min;
          if (PRICE.to > PRICE.max) PRICE.to = PRICE.max;
          render();
        }
        function end() {
          knob.classList.remove('is-dragging');
          document.removeEventListener('mousemove', move);
          document.removeEventListener('touchmove', move);
          document.removeEventListener('mouseup', end);
          document.removeEventListener('touchend', end);
          apply();
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('mouseup', end);
        document.addEventListener('touchend', end);
      };
    }
    function arrowKeys(which) {
      return function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        var dir = e.key === 'ArrowLeft' ? -1 : 1;
        var amt = e.shiftKey ? step * 10 : step;
        if (which === 'from') PRICE.from = Math.max(PRICE.min, Math.min(PRICE.to - step, PRICE.from + dir * amt));
        else PRICE.to = Math.min(PRICE.max, Math.max(PRICE.from + step, PRICE.to + dir * amt));
        render(); apply();
      };
    }
    knobFrom.addEventListener('mousedown', startDrag('from'));
    knobFrom.addEventListener('touchstart', startDrag('from'), { passive: false });
    knobTo.addEventListener('mousedown', startDrag('to'));
    knobTo.addEventListener('touchstart', startDrag('to'), { passive: false });
    knobFrom.addEventListener('keydown', arrowKeys('from'));
    knobTo.addEventListener('keydown', arrowKeys('to'));

    PRICE.reset = function (silent) { PRICE.from = PRICE.min; PRICE.to = PRICE.max; render(); if (!silent) apply(); };
    render();
  }

  function setupDrawer() {
    var btn = $('#filter-btn'), x = $('#drawer-close'), apl = $('#drawer-apply'), clr = $('#drawer-clear');
    function close() { document.body.classList.remove('is-drawer-open'); }
    function toggle() { document.body.classList.toggle('is-drawer-open'); }
    if (btn) btn.addEventListener('click', function (e) { e.preventDefault(); toggle(); });
    if (x) x.addEventListener('click', function (e) { e.preventDefault(); close(); });
    if (apl) apl.addEventListener('click', function (e) { e.preventDefault(); close(); });
    if (clr) clr.addEventListener('click', function (e) { e.preventDefault(); clearAll(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function setupSections() {
    $all('.plp-filter-section').forEach(function (sec, idx) {
      if (idx > 0 && !sec.querySelector('.plp-filter-price-row')) sec.classList.add('is-closed');
    });
    document.addEventListener('click', function (e) {
      var head = e.target.closest('.plp-filter-head');
      if (!head) return;
      var sec = head.closest('.plp-filter-section');
      if (!sec) return;
      sec.classList.toggle('is-closed');
      var icon = head.querySelector('.plp-filter-head-icon');
      if (icon) icon.textContent = sec.classList.contains('is-closed') ? '+' : '\u2212';
    });
  }

  function wireEvents() {
    document.addEventListener('change', function (e) {
      if (e.target.matches && e.target.matches('.plp-filter-section input[type=checkbox]')) apply();
    });
    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'clear-all') { e.preventDefault(); clearAll(); }
    });
    document.addEventListener('click', function (e) {
      var wl = e.target.closest && e.target.closest('.kp-wl-toggle');
      if (wl) e.preventDefault();
    });
  }

  function boot() {
    setupDrawer();
    setupSections();
    setupSort();
    fetch(DATA_URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        PRODUCTS = (data && data.products) || [];
        PRODUCTS.forEach(function (p) {
          if (p.titleByLoc) p.title = p.titleByLoc[LOC] || p.titleByLoc.de || p.title;
          if (p.priceRawByLoc) p.priceRaw = p.priceRawByLoc[LOC] || p.priceRawByLoc.de || p.priceRaw;
          if (p.priceByLoc) { var pv = p.priceByLoc[LOC]; p.price = (pv == null ? p.priceByLoc.de : pv); }
        });
        renderGrid();
        buildIndex();
        computeGlobalCounts();
        setupPriceSlider();
        wireEvents();
        setupCart();
        apply();
      })
      .catch(function (err) {
        if (window.console) console.warn('[plp] Filterdaten konnten nicht geladen werden:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
