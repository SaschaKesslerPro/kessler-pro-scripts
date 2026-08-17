/*!
 * kessler-pro-scripts / pdp.js
 *
 * v1.4.0 — GA4-Konsistenz: document.title-Fallback entfernt, item_name ueber kpNorm,
 *          currency aus Preistext, add_to_cart entprellt (kpOnce 1200ms) (17.08.2026)
 * v1.1.0 — GA4-Events: view_item, add_to_cart (11.07.2026)
 * v1.2.0 — Galerie: Placeholder-Thumbs + Duplikat-Thumbs ausblenden (14.07.2026) [ENTFERNT in v1.3.0]
 * v1.3.0 — Galerie neu gebaut (Collection List + Multi-Image-Feld + verkettete Lightboxen,
 *          17.07.2026). Alte Slider/Thumb-Logik entfernt (Markup existiert nicht mehr).
 *          NEU: Webflows verkettete Lightbox öffnet immer beim 1. Bild — Klick auf
 *          Thumbnail N springt jetzt automatisch zum richtigen Bild.
 * Product Detail Page — PDP-specific logic.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Galerie: Klick auf dynamisches Thumbnail (Collection List, pro Bild
  // eine Lightbox, alle über gemeinsamen Gruppennamen "product-gallery"
  // verkettet) soll direkt beim angeklickten Bild starten. Webflow öffnet
  // verkettete Lightboxen nativ immer bei Slide 1 — wir klicken danach
  // programmatisch die "weiter"-Pfeile, bis der Index passt.
  // ---------------------------------------------------------------------
  function initDynamicGalleryJump() {
    var thumbWrap = document.querySelector('.pdp_gallery-thumbs-dynamic');
    if (!thumbWrap) return;

    var thumbLinks = Array.prototype.slice.call(
      thumbWrap.querySelectorAll('.pdp_gallery-thumb-dynamic a, .pdp_gallery-thumb-dynamic .w-lightbox')
    );
    if (!thumbLinks.length) return;

    thumbLinks.forEach(function (link, index) {
      link.addEventListener('click', function () {
        if (index === 0) return; // erstes Bild ist schon korrekt, kein Sprung nötig
        waitForLightbox(function (backdrop) {
          jumpToSlide(backdrop, index);
        });
      });
    });
  }

  function waitForLightbox(cb) {
    var attempts = 0;
    var poll = setInterval(function () {
      attempts++;
      var backdrop = document.querySelector('.w-lightbox-backdrop');
      if (backdrop) {
        clearInterval(poll);
        cb(backdrop);
      } else if (attempts > 40) {
        clearInterval(poll); // ~2s Timeout, Lightbox kam nicht — stillschweigend abbrechen
      }
    }, 50);
  }

  function jumpToSlide(backdrop, targetIndex) {
    var clicks = 0;
    function clickNext() {
      var nextBtn = backdrop.querySelector('.w-lightbox-right');
      if (!nextBtn) return;
      nextBtn.click();
      clicks++;
      if (clicks < targetIndex) setTimeout(clickNext, 120);
    }
    setTimeout(clickNext, 80); // kurze Pause, bis das Modal fertig gerendert ist
  }

  // ---------------------------------------------------------------------
  // GA4: view_item + add_to_cart
  // ---------------------------------------------------------------------
  function initTracking() {
    if (!window.kpDL) { setTimeout(initTracking, 400); return; }
    try {
      var pidEl = document.querySelector('[sf-product]');
      var pid = pidEl ? String(pidEl.getAttribute('sf-product')) : (location.pathname.split('/').pop() || '');
      var h1 = document.querySelector('h1.pdp_title') || document.querySelector('h1');
      // Kein document.title-Fallback mehr: der traegt den Seitentitel-Zusatz
      // ("| Kessler PRO") mit und spaltet das Produkt in GA4 in zwei Zeilen.
      var rawName = h1 ? h1.textContent : '';
      var name = window.kpNorm ? window.kpNorm(rawName) : String(rawName).trim();
      var prEl = document.querySelector('.pdp_price');
      var prTxt = prEl ? prEl.textContent : '';
      var price = window.kpParsePrice ? window.kpParsePrice(prTxt) : 0;
      var cur = function (t) {
        return window.kpCurrencyFrom ? window.kpCurrencyFrom(t)
             : (window.kpCurrency ? window.kpCurrency() : 'EUR');
      };
      if (!window.__kpViewItem) {
        window.__kpViewItem = true;
        window.kpDL('view_item', { currency: cur(prTxt), value: price, items: [{ item_id: pid, item_name: name, price: price, quantity: 1 }] });
      }
      document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[sf-add-to-cart]');
        if (!btn || btn.closest('[data-kp-card]')) return; // Karten-Add macht plp.js
        // Entprellung: Doppelklick auf denselben Artikel zaehlt einmal.
        // plp.js schuetzt sich ueber data-busy, hier gab es bislang nichts.
        if (window.kpOnce && !window.kpOnce('atc:' + pid, 1200)) return;
        var t2 = prEl ? prEl.textContent : prTxt;
        var pr2 = window.kpParsePrice ? window.kpParsePrice(t2) : price;
        window.kpDL('add_to_cart', { currency: cur(t2), value: pr2, items: [{ item_id: pid, item_name: name, price: pr2, quantity: 1 }] });
      }, true);
    } catch (eT) {}
  }

  function init() { initDynamicGalleryJump(); initTracking(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
