/*!
 * kessler-pro-scripts / globals.js
 * Site-wide functionality: header, reviews, recently-viewed, etc.
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
    var ov = Q('.header_mobile-overlay');
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

  // -----------------------------------------------------------------
  // Locale-relative interne Links (Footer/native URL-Links).
  // Auf /pl-pl bzw. /en root-relative interne Links praefixen.
  // Sprachumschalter (hreflang), bereits-korrekte und bare "/"-Toggles
  // bleiben unangetastet.
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

})();
