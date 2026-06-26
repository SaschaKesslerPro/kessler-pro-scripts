/*!
 * kessler-pro-scripts / pdp.js
 * Product Detail Page — PDP-specific logic.
 *
 * Audit 11 — Gallery: thumbnail click drives the main Webflow slider
 * (clicked thumb becomes the main image). The slider's default nav
 * (.pdp_gallery-nav-hidden) is hidden via CSS; we drive the slider by
 * clicking its hidden nav dots, with an arrow-click fallback. The active
 * thumb gets an `.is-active` class for highlighting.
 */

(function () {
  'use strict';

  function injectStyle(css) {
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  // Minimal affordance + active-state styling for the thumbnails.
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

    function activeDotIndex() {
      var dots = Array.prototype.slice.call(
        slider.querySelectorAll('.w-slider-dot')
      );
      for (var i = 0; i < dots.length; i++) {
        if (dots[i].classList.contains('w-active')) return i;
      }
      return -1;
    }

    function goTo(index) {
      var dots = slider.querySelectorAll('.w-slider-dot');
      if (dots.length && dots[index]) {
        dots[index].click();
        return;
      }
      // Fallback: step with the slider arrows from the current slide.
      var current = activeDotIndex();
      if (current === -1) return;
      var steps = index - current;
      var arrow = slider.querySelector(
        steps > 0 ? '.w-slider-arrow-right' : '.w-slider-arrow-left'
      );
      if (!arrow) return;
      for (var s = 0; s < Math.abs(steps); s++) arrow.click();
    }

    function setActive(index) {
      for (var i = 0; i < thumbs.length; i++) {
        thumbs[i].classList.toggle('is-active', i === index);
      }
    }

    thumbs.forEach(function (thumb, i) {
      thumb.addEventListener('click', function (e) {
        e.preventDefault();
        goTo(i);
        setActive(i);
      });
    });

    setActive(0);

    // Keep the thumb highlight in sync if the slider is moved another way.
    var nav = slider.querySelector('.w-slider-nav');
    if (nav) {
      nav.addEventListener('click', function () {
        var idx = activeDotIndex();
        if (idx > -1) setActive(idx);
      });
    }
  }

  function init() {
    initGallery();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
