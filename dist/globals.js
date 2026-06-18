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

  (function initProductCardD() {
    if (window.__kesslerCardDInit) return;
    window.__kesslerCardDInit = true;
    if (document.getElementById('kessler-card-d-style')) return;
    var style = document.createElement('style');
    style.id = 'kessler-card-d-style';
    // v1.0.11 - Product Card -> Variante D (Bild-Fokus): Preis-Overlay aufs Bild,
    // Herz oben rechts aufs Bild, fester Warenkorb-Button im Body, keine Spec-Zeile.
    // Scoped unter .product-card_root -> schlaegt Carpenters-Basis + flat !important (wunschliste.js).
    style.textContent = [
      '.product-card_wrapper{cursor:pointer;background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important}',
      '.plp-grid{gap:12px}',
      '.plp-grid .product-card_wrapper{width:100%;max-width:none;min-width:0}',
      '.product-card_root{position:relative;display:flex;flex-direction:column;background:#FFFFFF;border:1px solid #E5E5E5;border-radius:8px;overflow:hidden;transition:transform .25s ease,box-shadow .25s ease}',
      '.product-card_root:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(30,30,30,.12)}',
      '.product-card_root .product-card_image-wrapper{position:relative;aspect-ratio:1/1;overflow:hidden;background:#F2F0EB;border-radius:0}',
      '.product-card_root .product-card_image{width:100%;height:100%;object-fit:cover;display:block}',
      '.product-card_root .product-card_badge{position:absolute;top:12px;left:12px;z-index:2;background:rgba(255,255,255,.82);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:#1E1E1E;border-radius:8px}',
      '.product-card_root .kp-wl-toggle{position:absolute;top:12px;right:12px;z-index:3;width:38px;height:38px;border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 2px 9px rgba(30,30,30,.14);display:flex;align-items:center;justify-content:center;border:0;color:#1E1E1E;transition:transform .15s ease,background .15s ease}',
      '.product-card_root .kp-wl-toggle:hover{background:#fff;transform:scale(1.06)}',
      '.product-card_root .kp-wl-toggle:active{transform:scale(.86)}',
      '.product-card_root .kp-wl-toggle svg{width:19px;height:19px}',
      '.product-card_root .kp-wl-toggle.is-active{color:#cf5b4e}',
      '.product-card_root .product-card_price{position:absolute!important;left:12px;bottom:12px;top:auto;right:auto;z-index:2;margin:0;padding:7px 12px;background:#1E1E1E;border-radius:8px}',
      '.product-card_root .product-card_price,.product-card_root .product-card_price *{color:#FFFFFF!important;font-size:15px;font-weight:600;line-height:1.1;letter-spacing:-.01em}',
      '.product-card_root .product-card_content{padding:14px!important;display:flex;flex-direction:column;gap:12px}',
      '.product-card_root .product-card_title{margin:0;font-size:15px;font-weight:500;line-height:1.35;color:#1E1E1E}',
      '.product-card_root .product-card_rating-wrapper{margin:0}',
      '.product-card_root .product-card_cart-overlay{position:relative!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;display:flex!important;align-items:center;justify-content:center;gap:8px;width:100%;opacity:1!important;transform:none!important;pointer-events:auto!important;margin:0;padding:12px 16px;background:#1E1E1E;border:0;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;z-index:4;cursor:pointer;transition:filter .2s ease}',
      '.product-card_root .product-card_cart-overlay:hover{filter:brightness(1.25)}',
      '.product-card_root .product-card_cart-overlay svg{width:18px;height:18px}',
      '.product-card_root .product-card_cart-overlay,.product-card_root .product-card_cart-overlay *{color:#FFFFFF!important}',
      '.product-card_root .product-card_overlay-link{z-index:1}',
      '@media (max-width:479px){.product-card_root .product-card_content{padding:12px!important;gap:10px}.product-card_root .product-card_cart-overlay{padding:11px 14px}.product-card_root .product-card_title{font-size:14px}}'
    ].join('');
    document.head.appendChild(style);
  })();
})();
