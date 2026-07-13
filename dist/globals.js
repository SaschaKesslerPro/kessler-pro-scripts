/*!
 * kessler-pro-scripts / globals.js
 * Site-wide functionality: header, reviews, recently-viewed, etc.
 * v2.0.0 (13.07.2026): KP Mobile Sheet v2 (Bottom Sheet) — ersetzt den
 *   Side-Drawer, sobald [data-m2="overlay"] im DOM existiert. Altes
 *   Drawer-Modul deaktiviert sich dann selbst (Cutover-Schalter).
 */

(function () {
  'use strict';

  // -----------------------------------------------------------------
  // External script loaders (Webflow CDN)
  // -----------------------------------------------------------------

  function loadScript(src) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    document.head.appendChild(s);
  }

  // Judge.me reviews initializer
  loadScript(
    'https://cdn.prod.website-files.com/67fea16d9758f16a33bef722/689e5ba67671442434f3ca35/69b90df2bcbc73ba796f6b8c/judgemeinit-7.6.0.js'
  );

  // Recently-viewed: tracker + renderer
  loadScript(
    'https://cdn.prod.website-files.com/67fea16d9758f16a33bef722/689e5ba67671442434f3ca35/69b90df29bf64ba7c9115271/recentlyviewedtracker-1.6.0.js'
  );
  loadScript(
    'https://cdn.prod.website-files.com/67fea16d9758f16a33bef722/689e5ba67671442434f3ca35/69b90df205848ff660e39baf/recentlyviewedrender-1.6.0.js'
  );

  // PDP carousel header fix
  loadScript(
    'https://cdn.prod.website-files.com/67fea16d9758f16a33bef722/689e5ba67671442434f3ca35/69b90df3824c3dc3dbe32c1f/pdpcarouselheaderfix-1.6.0.js'
  );

  // -----------------------------------------------------------------
  // Inline CSS injections
  // -----------------------------------------------------------------

  function injectStyle(css) {
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  // PDP-Prozess-Bilder: korrekter Bildausschnitt (Default war oben-links -> zeigte Decke)
  injectStyle('.pdp_mat-img,.pdp_quote-img{background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important}');

  // PDP-Empfehlungen ("Das könnte dir auch gefallen"): native Recs-Liste als Grid begrenzen
  injectStyle(
    '.pdp_recs-head ~ .w-dyn-list .w-dyn-items{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}' +
    '.pdp_recs-head ~ .w-dyn-list .w-dyn-item{width:100%;min-width:0}' +
    '@media (max-width:991px){.pdp_recs-head ~ .w-dyn-list .w-dyn-items{grid-template-columns:repeat(3,1fr)}}' +
    '@media (max-width:767px){.pdp_recs-head ~ .w-dyn-list .w-dyn-items{grid-template-columns:repeat(2,1fr);gap:12px}}'
  );

  // Scrollbar-hide for product-grid carousel
  injectStyle(
    '.product-grid_wrapper{-ms-overflow-style:none!important;scrollbar-width:none!important}' +
      '.product-grid_wrapper::-webkit-scrollbar{display:none!important;height:0!important;width:0!important;background:transparent!important}' +
      '.product-grid_wrapper::-webkit-scrollbar-track{display:none!important}' +
      '.product-grid_wrapper::-webkit-scrollbar-thumb{display:none!important}'
  );

  // Rating fallback: 5-star outline if no review badge present
  injectStyle(
    '.product-card_rating-wrapper::before{content:"\\2606\\2606\\2606\\2606\\2606";font-size:13px;color:#ccc;letter-spacing:2px;display:block;line-height:1.4}' +
      '.product-card_rating-wrapper:has(.jdgm-prev-badge__stars)::before{display:none}'
  );

  // Hide empty material cards (slot without category set) — Räume detail
  // Native conditional-visibility unavailable on static template elements; API visibility-binding also unavailable.
  injectStyle(
    '.raum-material-card:has(.raum-material-card-name:empty){display:none!important}'
  );

  // Räume hero: inner CMS heading inherits global h1 color; force white inside the dark hero
  injectStyle(
    '.raum-hero-headline,.raum-hero-headline h1,.raum-hero-headline h2{color:#FFFFFF}'
  );

  // -----------------------------------------------------------------
  // Header: mega-menu hover + scroll behavior
  // -----------------------------------------------------------------

  (function initHeaderMega() {
    var w = document.querySelector('.header_wrapper');
    if (!w) return;

    injectStyle(
      /* v1.0.15: disable browser scroll-anchoring to prevent feedback-loop flicker */
      'body,html{overflow-anchor:none!important}' +
        /* Default state: header_scrolled is HIDDEN until is-scrolled class is added */
        '.header_wrapper:not(.is-scrolled) .header_scrolled{max-height:0!important;opacity:0!important;pointer-events:none!important;padding-top:0!important;padding-bottom:0!important;border-bottom-width:0!important;overflow:hidden!important}' +
        /* Scrolled state: hide promo/toprow/nav, show scrolled-row */
        '.header_wrapper.is-scrolled .header_promo,' +
        '.header_wrapper.is-scrolled .header_toprow,' +
        '.header_wrapper.is-scrolled .header_nav{max-height:0!important;padding-top:0!important;padding-bottom:0!important;opacity:0!important;pointer-events:none!important;border-bottom-width:0!important}' +
        '.header_wrapper.is-scrolled .header_promo{transform:translateY(-100%)!important}' +
        '.header_wrapper.is-scrolled .header_scrolled{max-height:100px!important;padding-top:12px!important;padding-bottom:12px!important;opacity:1!important;border-bottom-width:1px!important}'
    );

    var hT = w.querySelectorAll('[data-header-part="nav-row"] [data-mega-target]');
    var cT = w.querySelectorAll('[data-header-part="scrolled-row"] [data-mega-target]');
    var aT = w.querySelectorAll('[data-mega-target]');
    var megas = w.querySelectorAll('[data-mega]');
    var hideTimer = null;
    var openMega = null;

    function clearHide() {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    function closeAll() {
      megas.forEach(function (m) {
        m.style.display = 'none';
      });
      aT.forEach(function (x) {
        x.classList.remove('is-active');
      });
      openMega = null;
    }

    function scheduleClose() {
      clearHide();
      hideTimer = setTimeout(closeAll, 150);
    }

    function show(key, trigger) {
      clearHide();
      megas.forEach(function (m) {
        m.style.display = m.getAttribute('data-mega') === key ? 'grid' : 'none';
      });
      aT.forEach(function (x) {
        x.classList.remove('is-active');
      });
      if (trigger) trigger.classList.add('is-active');
      openMega = key;
    }

    hT.forEach(function (tr) {
      tr.addEventListener('mouseenter', function () {
        show(tr.getAttribute('data-mega-target'), tr);
      });
      tr.addEventListener('mouseleave', scheduleClose);
    });

    megas.forEach(function (m) {
      m.addEventListener('mouseenter', clearHide);
      m.addEventListener('mouseleave', scheduleClose);
    });

    cT.forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        e.preventDefault();
        var k = tr.getAttribute('data-mega-target');
        if (openMega === k) closeAll();
        else show(k, tr);
      });
    });

    document.addEventListener('click', function (e) {
      if (openMega && !w.contains(e.target)) closeAll();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });

    // v1.0.15: simple top vs scrolled — y === 0 is standard, y > 0 is sticky.
    // No hysteresis, no lock. rAF throttle handles fast scroll bursts.
    var headerScrolledState = false;
    var checkHeaderScroll = function () {
      var y = window.scrollY;
      if (!headerScrolledState && y > 0) {
        w.classList.add('is-scrolled');
        headerScrolledState = true;
      } else if (headerScrolledState && y === 0) {
        w.classList.remove('is-scrolled');
        headerScrolledState = false;
      }
    };
    var headerTicking = false;
    window.addEventListener(
      'scroll',
      function () {
        if (!headerTicking) {
          requestAnimationFrame(function () {
            checkHeaderScroll();
            headerTicking = false;
          });
          headerTicking = true;
        }
      },
      { passive: true }
    );
    checkHeaderScroll();
  })();

  // -----------------------------------------------------------------
  // Header: mobile drawer
  // -----------------------------------------------------------------

  (function initHeaderMobileDrawer() {
    var w = document.querySelector('.header_wrapper');
    if (!w) return;

    injectStyle(
      '.header_mobile-overlay.is-open{visibility:visible!important;pointer-events:auto!important}' +
        '.header_mobile-overlay.is-open .m-drawer-backdrop{background:rgba(10,10,10,.45)!important}' +
        '.header_mobile-overlay.is-open .m-drawer{transform:translateX(0)!important}' +
        '.header_mobile-row.is-scrolled .header_mobile-logo{position:static!important;height:36px!important;margin-left:4px!important;transform:none!important}'
    );

    var Q = w.querySelector.bind(w);
    var A = w.querySelectorAll.bind(w);
    // v2.0.0: neues Bottom-Sheet vorhanden? -> alter Drawer inaktiv (ov=null),
    // Scroll-Logik unten läuft weiter.
    var ov = document.querySelector('[data-m2="overlay"]') ? null : Q('.header_mobile-overlay');
    var bg = Q('.header_mobile-burger');
    var mr = Q('.header_mobile-row');

    function preventDefault(e) {
      e.preventDefault();
    }

    function setDrawer(open) {
      if (!ov) return;
      ov.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    }

    if (bg) {
      bg.addEventListener('click', function (e) {
        preventDefault(e);
        setDrawer(true);
      });
    }

    A('[data-mobile-trigger="drawer-close"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        preventDefault(e);
        setDrawer(false);
      });
    });

    A('[data-mobile-l2]').forEach(function (el) {
      el.addEventListener('click', preventDefault);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setDrawer(false);
    });

    if (mr) {
      // v1.0.15: simple top vs scrolled (matches desktop logic)
      var scrolledState = false;
      var checkScroll = function () {
        var y = window.scrollY;
        if (!scrolledState && y > 0) {
          mr.classList.add('is-scrolled');
          scrolledState = true;
        } else if (scrolledState && y === 0) {
          mr.classList.remove('is-scrolled');
          scrolledState = false;
        }
      };
      window.addEventListener('scroll', checkScroll, { passive: true });
      checkScroll();
    }
  })();

  // -----------------------------------------------------------------
  // Header: KP Mobile Sheet v2 (Bottom Sheet) — v2.0.0
  // Aktiv nur, wenn [data-m2="overlay"] existiert (Cutover-Schalter).
  // Zustände: closed | main | produkte | inspiration | service
  // -----------------------------------------------------------------

  (function initKpMobileSheetV2() {
    var ov = document.querySelector('[data-m2="overlay"]');
    if (!ov) return;

    injectStyle(
      // Mockup 1a: L2-Panels ohne Drag-Handle (Back-Bar übernimmt Kopf)
      '.m2-sheet.is-l2 .m2-handle{display:none}' +
        // Panel-Wechsel: sanfter Content-Fade
        '.m2-panel.is-active{animation:kpM2Fade .18s ease}' +
        '@keyframes kpM2Fade{from{opacity:.4}to{opacity:1}}'
    );

    var stack = ov.querySelector('.m2-stack');
    var backdrop = ov.querySelector('.m2-backdrop');
    var backBar = ov.querySelector('[data-m2-back]');
    var sheet = ov.querySelector('.m2-sheet');
    var body = ov.querySelector('.m2-body');
    var panels = ov.querySelectorAll('[data-m2-panel]');
    var burger = document.querySelector('.header_mobile-burger');
    var lastFocus = null;
    var totalsDone = false;

    function showPanel(key) {
      [].forEach.call(panels, function (p) {
        p.classList.toggle('is-active', p.getAttribute('data-m2-panel') === key);
      });
      var isL2 = key !== 'main';
      if (backBar) backBar.classList.toggle('is-visible', isL2);
      if (sheet) sheet.classList.toggle('is-l2', isL2);
      if (body) body.scrollTop = 0;
    }

    // "379 Artikel"-Summen live aus den gerenderten CMS-Counts
    function computeTotals() {
      if (totalsDone) return;
      var counts = ov.querySelectorAll('.m2-cat-count');
      if (!counts.length) return;
      var sum = 0;
      [].forEach.call(counts, function (c) {
        sum += parseInt((c.textContent || '').replace(/\D/g, ''), 10) || 0;
      });
      if (!sum) return;
      // Letzte Zahl im String ersetzen (lokalisierungssicher):
      var patchLast = function (el) {
        el.textContent = el.textContent.replace(/(\d+)(?!.*\d)/, String(sum));
      };
      [].forEach.call(ov.querySelectorAll('[data-m2-meta="produkte"]'), patchLast);
      [].forEach.call(ov.querySelectorAll('[data-m2-count="produkte"]'), patchLast);
      totalsDone = true;
    }

    // "Angemeldet · Vorname Nachname" — Name aus hub.js-Cache (kp_cust_name)
    function fillName() {
      var el = ov.querySelector('[data-m2-name]');
      if (!el) return;
      var n = '';
      try { n = localStorage.getItem('kp_cust_name') || ''; } catch (e) {}
      el.textContent = n ? ' · ' + n : '';
    }

    function setOpen(open) {
      ov.classList.toggle('is-open', open);
      if (backdrop) backdrop.classList.toggle('is-open', open);
      if (stack) stack.classList.toggle('is-open', open);
      ov.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) {
        lastFocus = document.activeElement;
        showPanel('main');
        computeTotals();
        fillName();
        if (sheet) {
          sheet.setAttribute('tabindex', '-1');
          sheet.focus({ preventScroll: true });
        }
      } else if (lastFocus && lastFocus.focus) {
        try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
        lastFocus = null;
      }
    }

    if (burger) {
      burger.addEventListener('click', function (e) {
        e.preventDefault();
        setOpen(true);
      });
    }

    // Delegierte Klicks im Overlay
    ov.addEventListener('click', function (e) {
      var t;
      if (e.target.closest('[data-m2-close]')) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.target.closest('[data-m2-back]')) {
        e.preventDefault();
        showPanel('main');
        return;
      }
      t = e.target.closest('[data-m2-open]');
      if (t) {
        e.preventDefault();
        showPanel(t.getAttribute('data-m2-open'));
        return;
      }
      // Suche im Sheet: search.js öffnet das Overlay (eigener Handler),
      // wir schließen nur das Sheet darunter.
      if (e.target.closest('[data-mobile-trigger="search-open"]')) {
        setOpen(false);
        return;
      }
      // Echte Navigation: Sheet schließen, Link läuft nativ weiter
      if (e.target.closest('a[href]:not([href="#"])')) {
        setOpen(false);
      }
    });

    // Tastatur: ESC schließt, Enter/Space auf role=button öffnet Panel
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.classList.contains('is-open')) {
        setOpen(false);
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute) {
        var k = e.target.getAttribute('data-m2-open');
        if (k) {
          e.preventDefault();
          showPanel(k);
        }
      }
    });
  })();

  // -----------------------------------------------------------------
  // Product Card Hover (v1.0.9) + Layout Tweaks (v1.0.10)
  // CSS inject for card-lift, cart-overlay slide-up,
  // and PLP grid spacing overrides
  // -----------------------------------------------------------------

  (function initPlpGridSizing() {
    if (window.__kesslerPlpGridInit) return;
    window.__kesslerPlpGridInit = true;
    if (document.getElementById('kessler-plp-grid-style')) return;
    var style = document.createElement('style');
    style.id = 'kessler-plp-grid-style';
    // v1.0.12 - Card-APPEARANCE liegt jetzt nativ im Webflow Designer (Component Variant Styles).
    // globals.js behaelt nur noch PLP-Grid-Sizing (Layout-Glue), kein Card-Aussehen mehr.
    style.textContent = '.plp-grid{gap:12px}.plp-grid .product-card_wrapper{width:100%;max-width:none;min-width:0}';
    document.head.appendChild(style);
  })();

  // -----------------------------------------------------------------
  // Storesynk Cart Glue (migrated 2026-06-20 from inline kesslercartmount v1.1.0)
  // 1) Move .cart-popup to <body> (escape the animated/opacity footer wrapper).
  // 2) Wire header cart icon click -> Shopyflow.openCart() (preventDefault).
  // -----------------------------------------------------------------
  (function initStoresynkCartGlue() {
    function mountToBody() {
      var c = document.querySelector('.cart-popup');
      if (c && c.parentElement !== document.body) {
        document.body.appendChild(c);
      }
    }
    function wireOpeners() {
      var els = document.querySelectorAll('a[aria-label="Warenkorb"], a[href$="/cart"]');
      els.forEach(function (el) {
        if (el.getAttribute('data-sfopen')) return;
        el.setAttribute('data-sfopen', '1');
        el.addEventListener('click', function (e) {
          var SF = window.Shopyflow || window.Storesynk;
          if (SF && typeof SF.openCart === 'function') {
            e.preventDefault();
            SF.openCart();
          }
        });
      });
    }
    function init() { mountToBody(); wireOpeners(); }
    if (document.readyState !== 'loading') { init(); }
    else { document.addEventListener('DOMContentLoaded', init); }
  })();

  // -----------------------------------------------------------------
  // Cart Count Badge (added 2026-06-21)
  // Mirrors Storesynk's cart line-item count (from the drawer's
  // [sf-cart-count] element, which Storesynk reliably populates) onto a
  // badge inside each header cart icon, styled identically to the wishlist
  // badge via the shared .kp-icon-counter class. We never add an
  // sf-cart-count node ourselves (avoids relying on Storesynk re-scanning
  // injected nodes) - we only read the canonical one and mirror it.
  // -----------------------------------------------------------------
  (function initCartCountBadge() {
    var CART_SEL = 'a[aria-label="Warenkorb"], a[href$="/cart"]';
    function ensureBadge(link) {
      var b = link.querySelector('.kp-icon-counter');
      if (!b) {
        b = document.createElement('span');
        b.className = 'kp-icon-counter';
        b.setAttribute('aria-hidden', 'true');
        link.appendChild(b);
      }
      b.setAttribute('data-kp-cart-counter', '1');
      return b;
    }
    function readCount() {
      var src = document.querySelector('[sf-cart-count]');
      if (!src) return 0;
      var n = parseInt((src.textContent || '').replace(/[^0-9]/g, ''), 10);
      return isNaN(n) ? 0 : n;
    }
    function sync() {
      var n = readCount();
      var links = document.querySelectorAll(CART_SEL);
      for (var i = 0; i < links.length; i++) {
        var b = ensureBadge(links[i]);
        if (n > 0) { b.textContent = n > 99 ? '99+' : String(n); b.style.display = ''; }
        else { b.textContent = ''; b.style.display = 'none'; }
      }
    }
    function attachObserver() {
      var src = document.querySelector('[sf-cart-count]');
      if (!src) return false;
      try {
        new MutationObserver(sync).observe(src, { childList: true, characterData: true, subtree: true });
      } catch (e) {}
      return true;
    }
    function init() {
      sync();
      var tries = 0;
      var t = setInterval(function () {
        tries++;
        sync();
        if (attachObserver() || tries > 40) clearInterval(t);
      }, 250);
      document.addEventListener('sf-cart-updated', sync);
      document.addEventListener('sf-cart-changed', sync);
    }
    if (document.readyState !== 'loading') { init(); }
    else { document.addEventListener('DOMContentLoaded', init); }
  })();

  // Wunschliste Variante-B Karten-Layout (Audit / Variante B)
  injectStyle(
    '/* Wunschliste -> Variante B (horizontale Zeile, Thumb links, Herz rechts) */.kp-wishlist-grid{grid-template-columns:repeat(auto-fill,minmax(440px,1fr))!important;gap:20px!important;align-items:start!important}.kp-wishlist-grid .kp-product-card{position:relative;display:grid;grid-template-columns:152px 1fr;grid-template-rows:auto auto auto 1fr;column-gap:18px;min-height:184px;background:#fff;border:1px solid #ece8e1;border-radius:16px;padding:16px;text-decoration:none;transition:box-shadow .25s,transform .25s}.kp-wishlist-grid .kp-product-card:hover{box-shadow:0 14px 34px rgba(43,39,36,.12);transform:translateY(-2px)}.kp-wishlist-grid .kp-product-image{position:relative;grid-column:1;grid-row:1/5;width:152px;height:152px;border-radius:12px;margin:0;background-size:cover;background-position:center;background-repeat:no-repeat;align-self:start}.kp-wishlist-grid .kp-product-image-bestseller{display:none!important}.kp-wishlist-grid .kp-product-name{grid-column:2;grid-row:1;margin:0 44px 0 0;font-size:16px;font-weight:600;line-height:1.35;color:#2b2724}.kp-wishlist-grid .kp-product-specs{grid-column:2;grid-row:2;display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0;padding:0}.kp-wishlist-grid .kp-wl-chip{font-family:Onest,system-ui,sans-serif!important;font-size:12px;font-weight:500;color:#6b655d;background:#f6f3ee;padding:5px 10px;border-radius:8px;line-height:1.3}.kp-wishlist-grid .kp-product-stars{grid-column:2;grid-row:3;margin:10px 0 0;font-size:13px}.kp-wishlist-grid .kp-product-price{grid-column:2;grid-row:4;align-self:end;margin:14px 0 0;font-size:22px;font-weight:700;letter-spacing:-.02em;color:#2b2724}.kp-wishlist-grid .kp-product-image-remove{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.94);box-shadow:0 1px 4px rgba(43,39,36,.12);display:flex;align-items:center;justify-content:center;color:#cf5b4e;cursor:pointer;z-index:3;transition:transform .15s,color .15s,background .15s}.kp-wishlist-grid .kp-product-image-remove svg{display:block;width:18px;height:18px}.kp-wishlist-grid .kp-product-image-remove:hover{background:#faf8f4;color:#b8463b}.kp-wishlist-grid .kp-product-image-remove:active{transform:scale(.86)}'
  );

  // -----------------------------------------------------------------
  // Locale-relative interne Links (Footer/native URL-Links).
  // Auf /pl-pl bzw. /en root-relative interne Links praefixen.
  // Sprachumschalter (hreflang), bereits-korrekte und bare "/"-Toggles
  // bleiben unangetastet.
  // Restored (Audit 7) — regressed out of globals.js after commit f072fa4a.
  // -----------------------------------------------------------------
  (function () {
    var m = (location.pathname || '').match(/^\/(pl-pl|en)(?=\/|$)/);
    if (!m) return;
    var pre = m[0];
    function fix() {
      var as = document.querySelectorAll('a[href^="/"]');
      for (var i = 0; i < as.length; i++) {
        var a = as[i];
        if (a.hasAttribute('hreflang')) continue;
        if (a.closest && a.closest('.locale-switcher_item')) continue;
        var h = a.getAttribute('href');
        if (!h || h === '/' || h.charAt(0) !== '/') continue;
        if (h.indexOf('//') === 0) continue;
        if (h.indexOf('/pl-pl') === 0 || h.indexOf('/en') === 0) continue;
        a.setAttribute('href', pre + h);
      }
    }
    if (document.readyState !== 'loading') { fix(); }
    else { document.addEventListener('DOMContentLoaded', fix); }
  })();


  // -----------------------------------------------------------------
  // Audit 4: make cart-drawer items clickable -> product PDP.
  // Storesynk cart rows (.cart-item-* [sf-cart-item]) carry no link;
  // map the item title -> slug via search-index.json (DE/PL/EN titles).
  // -----------------------------------------------------------------
  (function initCartItemLinks() {
    var INDEX = null, fetching = false;
    function selfBase() {
      var s = document.querySelector('script[src*="/dist/globals.js"]');
      return (s && s.src) ? s.src.replace(/globals\.js(?:\?.*)?$/, '') :
        'https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@main/dist/';
    }
    function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
    function lp() { return (location.pathname.match(/^\/(pl-pl|en)(?=\/|$)/) || [''])[0]; }
    function loadIndex(cb) {
      if (INDEX) { cb(); return; }
      if (fetching) return;
      fetching = true;
      fetch(selfBase() + 'search-index.json').then(function (r) { return r.json(); }).then(function (d) {
        INDEX = {};
        (d.products || []).forEach(function (p) {
          if (!p.s) return;
          INDEX[norm(p.n)] = p.s;
          if (p.nL) { if (p.nL.pl) INDEX[norm(p.nL.pl)] = p.s; if (p.nL.en) INDEX[norm(p.nL.en)] = p.s; }
        });
        cb();
      }).catch(function () { fetching = false; });
    }
    var SKIP = { 'nazwa produktu': 1, 'product name': 1, 'produktname': 1, '': 1 };
    function wire(item) {
      if (item.getAttribute('data-kp-linked')) return;
      var t = item.querySelector('.ci-title');
      if (!t) return;
      var key = norm(t.textContent);
      if (SKIP[key]) return;
      var slug = INDEX[key];
      if (!slug) return;
      item.setAttribute('data-kp-linked', '1');
      var url = lp() + '/products/' + slug;
      Array.prototype.slice.call(item.querySelectorAll('.ci-thumb, .ci-main')).forEach(function (el) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', function (e) {
          if (e.target.closest('.ci-remove')) return;
          window.location.href = url;
        });
      });
    }
    function wireAll() {
      var pop = document.querySelector('.cart-popup');
      if (!pop) return;
      var items = pop.querySelectorAll('[sf-cart-item]');
      if (!items.length) return;
      loadIndex(function () { Array.prototype.slice.call(pop.querySelectorAll('[sf-cart-item]')).forEach(wire); });
    }
    var to;
    function schedule() { clearTimeout(to); to = setTimeout(wireAll, 150); }
    function start() {
      var mo = new MutationObserver(schedule);
      mo.observe(document.body, { childList: true, subtree: true });
      schedule();
    }
    if (document.readyState !== 'loading') start();
    else document.addEventListener('DOMContentLoaded', start);
  })();

})();

/* --- KP Analytics Bridge v1.0 (GA4 dataLayer, 11.07.2026) ---
 * kpDL(name, ecommerce?, extra?) pusht GA4-konforme Events in den dataLayer.
 * Consent-Handling uebernimmt GTM/Consent Mode — hier wird IMMER gepusht. */
(function(){
  if(window.kpDL)return;
  window.dataLayer=window.dataLayer||[];
  window.kpDL=function(name,ecom,extra){
    try{
      if(ecom)window.dataLayer.push({ecommerce:null});
      var e={event:name};
      if(extra)for(var k in extra)e[k]=extra[k];
      if(ecom)e.ecommerce=ecom;
      window.dataLayer.push(e);
    }catch(err){}
  };
  window.kpCurrency=function(){
    try{var c=localStorage.getItem('_sf-currency');
      if(c){c=String(c).replace(/["']/g,'').trim();if(/^[A-Z]{3}$/.test(c))return c;}
    }catch(e){}
    return location.pathname.indexOf('/pl-pl')===0?'PLN':'EUR';
  };
  window.kpParsePrice=function(s){
    if(typeof s==='number')return s;
    if(!s)return 0;
    s=String(s).replace(/[^\d.,]/g,'');
    if(s.indexOf(',')>-1&&s.indexOf('.')>-1)s=s.replace(/\./g,'').replace(',','.');
    else s=s.replace(',','.');
    var f=parseFloat(s);return isNaN(f)?0:f;
  };
})();

/* --- KP generate_lead v1.0 (12.07.2026) ---
 * Pusht generate_lead in den dataLayer, wenn ein Webflow-Formular
 * erfolgreich abgesendet wurde (.w-form-done wird sichtbar).
 * Grund: Webflow submitted via AJAX (preventDefault) -> GTMs nativer
 * Form-Submit-Listener mit Validierungspruefung matcht nie zuverlaessig.
 * Erfolgszustand = reCAPTCHA bestanden + Server-OK -> saubere Leads. */
(function(){
  function visible(el){
    if(!el)return false;
    var cs=window.getComputedStyle(el);
    return cs.display!=='none'&&cs.visibility!=='hidden'&&el.offsetParent!==null;
  }
  function push(done){
    if(done.getAttribute('data-kp-lead'))return;
    done.setAttribute('data-kp-lead','1');
    var wrap=done.closest('.w-form'),form=wrap?wrap.querySelector('form'):null;
    var name=(form&&(form.getAttribute('data-name')||form.getAttribute('name')))||'Formular';
    if(window.kpDL)window.kpDL('generate_lead',null,{form_name:name});
  }
  function scan(){
    var els=document.querySelectorAll('.w-form-done');
    for(var i=0;i<els.length;i++){if(visible(els[i]))push(els[i]);}
  }
  function start(){
    if(!document.querySelector('.w-form-done'))return;
    var mo=new MutationObserver(scan);
    mo.observe(document.body,{attributes:true,attributeFilter:['style','class'],subtree:true,childList:true});
    scan();
  }
  if(document.readyState!=='loading')start();
  else document.addEventListener('DOMContentLoaded',start);
})();
