/*!
 * kessler-pro-scripts / pdp.js
 *
 * v1.1.0 — GA4-Events: view_item, add_to_cart (11.07.2026)
 * Product Detail Page — PDP-specific logic.
 *
 * Audit 11 — Gallery: clicking a thumbnail shows that image as the main image.
 * The Webflow slider on the PDP does not respond to programmatic nav (dots/arrows
 * are inert because the nav is hidden), so instead of driving the slider we swap
 * the currently-displayed main <img> directly to the clicked thumbnail's image.
 * The active thumb gets an `.is-active` class for highlighting.
 */

(function () {
  'use strict';

  function injectStyle(css) {
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  injectStyle(
    '.pdp_gallery-thumbs .pdp_thumb{cursor:pointer}' +
      '.pdp_gallery-thumbs .pdp_thumb.is-active{outline:2px solid #1E1E1E;outline-offset:-2px}'
  );

  function initGallery() {
    var slider = document.querySelector('.pdp_gallery-main');
    var thumbWrap = document.querySelector('.pdp_gallery-thumbs');
    if (!slider || !thumbWrap) return;

    var thumbs = Array.prototype.slice.call(
      thumbWrap.querySelectorAll('.pdp_thumb')
    );
    if (thumbs.length < 2) return; // single image — nothing to switch

    var slides = Array.prototype.slice.call(
      slider.querySelectorAll('.w-slide')
    );

    // The <img> of the currently most-visible slide (fallback: first slide).
    function mainImage() {
      var best = null, bestOpacity = -1;
      for (var i = 0; i < slides.length; i++) {
        var o = parseFloat(getComputedStyle(slides[i]).opacity || '0');
        if (o > bestOpacity) { bestOpacity = o; best = slides[i]; }
      }
      var holder = best || slides[0] || slider;
      return holder ? holder.querySelector('img') : null;
    }

    function setActive(index) {
      for (var i = 0; i < thumbs.length; i++) {
        thumbs[i].classList.toggle('is-active', i === index);
      }
    }

    thumbs.forEach(function (thumb, i) {
      thumb.addEventListener('click', function (e) {
        e.preventDefault();
        var src = thumb.querySelector('img');
        var dest = mainImage();
        if (src && dest) {
          dest.src = src.src;
          if (src.srcset) dest.srcset = src.srcset;
          else dest.removeAttribute('srcset');
          if (src.getAttribute('alt')) dest.alt = src.getAttribute('alt');
        }
        setActive(i);
      });
    });

    setActive(0);
  }

  function initTracking() {
    if (!window.kpDL) { setTimeout(initTracking, 400); return; }
    try {
      var pidEl = document.querySelector('[sf-product]');
      var pid = pidEl ? String(pidEl.getAttribute('sf-product')) : (location.pathname.split('/').pop() || '');
      var h1 = document.querySelector('h1.pdp_title') || document.querySelector('h1');
      var name = h1 ? h1.textContent.trim() : document.title;
      var prEl = document.querySelector('.pdp_price');
      var price = prEl && window.kpParsePrice ? window.kpParsePrice(prEl.textContent) : 0;
      if (!window.__kpViewItem) {
        window.__kpViewItem = true;
        window.kpDL('view_item', { currency: window.kpCurrency ? window.kpCurrency() : 'EUR', value: price, items: [{ item_id: pid, item_name: name, price: price, quantity: 1 }] });
      }
      document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[sf-add-to-cart]');
        if (!btn || btn.closest('[data-kp-card]')) return; // Karten-Add macht plp.js
        var pr2 = prEl && window.kpParsePrice ? window.kpParsePrice(prEl.textContent) : price;
        window.kpDL('add_to_cart', { currency: window.kpCurrency ? window.kpCurrency() : 'EUR', value: pr2, items: [{ item_id: pid, item_name: name, price: pr2, quantity: 1 }] });
      }, true);
    } catch (eT) {}
  }

  function init() { initGallery(); initTracking(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
