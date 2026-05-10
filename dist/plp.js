/*!
 * kessler-pro-scripts / plp.js
 * Product Listing Page: filter drawer, sort, filter sections, cards, active filter pills.
 *
 * v1.0.14 additions:
 *   - product-card_content padding-bottom 10px → 4px (Designer-locked override)
 *
 * v1.0.13 additions:
 *   - Wrap desktop-only drawer/grid rules in @media(min-width:992px) so body-class
 *     specifity (body:not(.is-drawer-open) .plp-grid {repeat(4,1fr)}) no longer
 *     overrides mobile media queries. Fixes 4-cards-on-mobile bug.
 *   - Mobile shop-inner: display:block (no sidebar grid swallowing card column)
 *   - Mobile card-wrapper: reset width/max-width/min-width/flex-shrink to undo
 *     Designer-locked main-breakpoint calc(25%-12px)/300px/240px/0 values
 *   - Desktop card-wrapper: same reset wrapped in min-width:992px media
 *   - Mobile grid: 1 col (per Sascha) instead of 2 col, gap 24/20
 *
 * v1.0.5 additions:
 *   - Filter section collapse: CSS for .plp-filter-section.is-closed (was missing
 *     after CMS conversion — toggle JS was firing but visually no effect)
 *   - Custom checkbox styling: solid black when checked, no native checkmark
 *
 * v1.0.1 additions:
 *   - Hide scrollbar on .plp-drawer-inner (Chrome/Safari/Firefox/IE)
 *   - Force .plp-page-h1 weight 300 with !important (beats default-h1 tag style)
 *
 * v1.0.0 baseline:
 *   - filter button active state (body.is-drawer-open)
 *   - clear-all click handler in tags module
 */

(function () {
  'use strict';

  // -----------------------------------------------------------------
  // External loaders
  // -----------------------------------------------------------------

  function loadScript(src) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    document.head.appendChild(s);
  }

  // Finsweet CMS Attributes (load, filter, sort)
  window.fsAttributes = window.fsAttributes || [];
  loadScript('https://cdn.jsdelivr.net/npm/@finsweet/attributes-cmsload@1/cmsload.js');
  loadScript('https://cdn.jsdelivr.net/npm/@finsweet/attributes-cmsfilter@1/cmsfilter.js');
  loadScript('https://cdn.jsdelivr.net/npm/@finsweet/attributes-cmssort@1/cmssort.js');

  // -----------------------------------------------------------------
  // CSS injection (formerly plpcss)
  // -----------------------------------------------------------------

  function injectStyle(css) {
    var s = document.createElement('style');
    s.id = 'plpcss';
    s.textContent = css;
    document.head.appendChild(s);
  }

  injectStyle(
    /* Sort dropdown arrow */
    '#sort-select{background:#FAFAFA url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236A6A66\' stroke-width=\'1.6\'><path d=\'M6 9l6 6 6-6\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>") no-repeat right 10px center/14px}' +
      /* v1.0.13: Desktop-only layout rules wrapped in @media(min-width:992px) so body-class specifity does not override mobile rules */
      '@media(min-width:992px){' +
        'body:not(.is-drawer-open) .plp-shop-inner{grid-template-columns:0 1fr!important;gap:0!important}' +
        'body:not(.is-drawer-open) .plp-drawer{opacity:0;pointer-events:none;visibility:hidden}' +
        'body.is-drawer-open .plp-shop-inner{grid-template-columns:360px 1fr!important;gap:32px!important}' +
        'body.is-drawer-open .plp-grid{grid-template-columns:repeat(3,1fr)!important}' +
        'body:not(.is-drawer-open) .plp-grid{grid-template-columns:repeat(4,1fr)!important}' +
        /* v1.0.13: override Designer-locked main-breakpoint card-wrapper width/min/max/flex-shrink */
        '.product-card_wrapper{width:auto!important;max-width:none!important;min-width:0!important;flex-shrink:1!important;flex-basis:auto!important}' +
      '}' +
      /* v1.0.14: card-content reduced bottom padding (Designer-locked at 10px) */
      '.product-card_content{padding-bottom:4px!important}' +
      /* Empty/zero state hiding */
      '.plp-tags-row:empty{display:none}' +
      '.plp-clear-all.is-hidden,.plp-filter-btn-num:empty,.plp-filter-btn-num.is-zero{display:none}' +
      /* Card hover effects */
      '.plp-card:hover .plp-card-quickadd{opacity:1;transform:translateY(0)}' +
      '.plp-card-fav:hover{background:#fff;color:#0A0A0A}' +
      /* Drawer button hovers */
      '.plp-drawer-close:hover{background:#F2F2F2;color:#0A0A0A}' +
      '.plp-drawer-apply:hover{background:#1a1a1a}' +
      '.plp-drawer-clear:hover{border-color:#0A0A0A;color:#0A0A0A}' +
      /* Toolbar button hovers */
      '.plp-filter-btn:hover{background:#1a1a1a}' +
      '.plp-clear-all:hover{color:#0A0A0A}' +
      '.plp-tag-x:hover{color:#0A0A0A}' +
      /* Filter button ACTIVE state (drawer open) — NEW */
      'body.is-drawer-open .plp-filter-btn{background:#FFFFFF;color:#0A0A0A;border:1px solid #0A0A0A}' +
      'body.is-drawer-open .plp-filter-btn-num{background:#0A0A0A;color:#F2F0EB}' +
      /* Variant dot inner fill */
      '.plp-variant-dot::after{content:"";position:absolute;inset:1px;border-radius:50%;background:inherit}' +
      '.plp-variant-dot.is-active{border-color:#0A0A0A}' +
      '.stars-empty{color:#D4D4D4}' +
      /* Mobile breakpoint */
      '@media(max-width:991px){' +
        /* v1.0.13: shop-inner becomes block on mobile (no sidebar grid) */
        '.plp-shop-inner{display:block!important;grid-template-columns:none!important;gap:0!important}' +
        /* v1.0.13: reset card-wrapper sizing on mobile (cascades from main desktop calc/min/max) */
        '.product-card_wrapper{width:100%!important;max-width:none!important;min-width:0!important;flex-shrink:1!important;flex-basis:auto!important}' +
        '.plp-drawer{position:fixed!important;top:0!important;left:0;right:0;bottom:0;width:100%;max-height:100vh;background:#fff;z-index:9999;transform:translateX(-100%);transition:transform .3s;border-radius:0;display:block!important}' +
        'body.is-drawer-open .plp-drawer{transform:translateX(0)}' +
        'body.is-drawer-open{overflow:hidden}' +
        '.plp-drawer-inner{border:0;border-radius:0;height:100%;display:flex;flex-direction:column}' +
        /* v1.0.13: 1 card per row on mobile (Sascha override of mockup 2-col) */
        '.plp-grid{grid-template-columns:1fr!important;gap:24px!important}' +
      '}' +
      '@media(max-width:479px){.plp-grid{grid-template-columns:1fr!important;gap:20px!important}}'
  );

  // -----------------------------------------------------------------
  // v1.0.1 additions: drawer scrollbar hide + H1 weight override
  // -----------------------------------------------------------------

  injectStyle(
    /* Hide drawer-inner scrollbar on all browsers */
    '.plp-drawer-inner{scrollbar-width:none;-ms-overflow-style:none}' +
      '.plp-drawer-inner::-webkit-scrollbar{display:none;width:0;height:0;background:transparent}' +
      /* v1.0.7: also hide scrollbar on .plp-drawer parent + any scrolling children */
      '.plp-drawer,.plp-drawer-body,.plp-filter-list{scrollbar-width:none;-ms-overflow-style:none}' +
      '.plp-drawer::-webkit-scrollbar,.plp-drawer-body::-webkit-scrollbar,.plp-filter-list::-webkit-scrollbar{display:none;width:0;height:0;background:transparent}' +
      /* v1.0.8: price range slider */
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
      /* Force light weight on H1 — beats default-h1 tag style */
      '.plp-page-h1{font-weight:300!important}'
  );

  // -----------------------------------------------------------------
  // v1.0.5 additions: filter section collapse + custom checkbox style
  // -----------------------------------------------------------------

  injectStyle(
    /* Filter section collapse: hide body when section is closed */
    '.plp-filter-section.is-closed .plp-filter-body{display:none}' +
      /* Custom checkbox: solid black when checked, no native checkmark */
      '.plp-filter-checkbox{' +
        'appearance:none;-webkit-appearance:none;' +
        'width:16px;height:16px;' +
        'border:1.5px solid #999;border-radius:3px;' +
        'background-color:#fff;' +
        'cursor:pointer;flex-shrink:0;margin:0' +
      '}' +
      '.plp-filter-checkbox:checked{background-color:#0a0a0a;border-color:#0a0a0a}'
  );

  // -----------------------------------------------------------------
  // Drawer toggle (formerly plpdrawer)
  // -----------------------------------------------------------------

  (function initDrawer() {
    var $ = function (sel) {
      return document.querySelector(sel);
    };
    function open() {
      document.body.classList.add('is-drawer-open');
    }
    function close() {
      document.body.classList.remove('is-drawer-open');
    }
    function toggle() {
      document.body.classList.toggle('is-drawer-open');
    }

    function setup() {
      var btn = $('#filter-btn');
      var x = $('#drawer-close');
      var apply = $('#drawer-apply');
      var clear = $('#drawer-clear');
      if (!btn) return;

      var isMobile = function () {
        return window.innerWidth <= 991;
      };

      if (!isMobile()) open();

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        toggle();
      });

      if (x) {
        x.addEventListener('click', function (e) {
          e.preventDefault();
          close();
        });
      }

      if (apply) {
        apply.addEventListener('click', function (e) {
          e.preventDefault();
          if (isMobile()) close();
        });
      }

      if (clear) {
        clear.addEventListener('click', function (e) {
          e.preventDefault();
          var allClear = $('#clear-all');
          if (allClear) {
            allClear.click();
          } else {
            document
              .querySelectorAll(
                '.plp-filter-section input[type=checkbox]:checked,.plp-filter-section input[type=radio]:checked'
              )
              .forEach(function (i) {
                i.checked = false;
                i.dispatchEvent(new Event('change', { bubbles: true }));
              });
          }
        });
      }

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && document.body.classList.contains('is-drawer-open')) close();
      });

      window.addEventListener('resize', function () {
        if (!isMobile() && !document.body.classList.contains('is-drawer-open')) open();
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  })();

  // -----------------------------------------------------------------
  // v1.0.8: Price range slider (dual-knob)
  // Replaces the two .plp-filter-price-input fields with a visual slider.
  // Original inputs stay in DOM (display:none) so Finsweet can still
  // read/filter on them. Min/max/step come from data-min, data-max,
  // data-step on .plp-filter-price-row (defaults: 0, 500, 5).
  // -----------------------------------------------------------------

  (function initPriceSlider() {
    function setup() {
      var row = document.querySelector('.plp-filter-price-row');
      if (!row) return;
      if (row.getAttribute('data-k-slider') === '1') return;
      var inputs = row.querySelectorAll('.plp-filter-price-input');
      if (inputs.length !== 2) return;
      row.setAttribute('data-k-slider', '1');

      var min = parseInt(row.getAttribute('data-min'), 10);
      if (isNaN(min)) min = 0;
      var max = parseInt(row.getAttribute('data-max'), 10);
      if (isNaN(max)) max = 500;
      var step = parseInt(row.getAttribute('data-step'), 10);
      if (isNaN(step) || step < 1) step = 5;

      var fromInput = inputs[0];
      var toInput = inputs[1];

      if (!fromInput.getAttribute('fs-cmsfilter-range')) {
        fromInput.setAttribute('fs-cmsfilter-range', 'from');
        fromInput.setAttribute('fs-cmsfilter-field', 'preis-numerisch');
      }
      if (!toInput.getAttribute('fs-cmsfilter-range')) {
        toInput.setAttribute('fs-cmsfilter-range', 'to');
        toInput.setAttribute('fs-cmsfilter-field', 'preis-numerisch');
      }
      fromInput.value = min;
      toInput.value = max;

      var slider = document.createElement('div');
      slider.className = 'plp-price-slider';
      slider.innerHTML =
        '<div class="plp-price-labels">' +
          '<div class="plp-price-label-group">' +
            '<span class="plp-price-label-tag">Von</span>' +
            '<span class="plp-price-label-val" data-from-val>\u20AC ' + min + '</span>' +
          '</div>' +
          '<div class="plp-price-label-group plp-price-label-group--right">' +
            '<span class="plp-price-label-tag">Bis</span>' +
            '<span class="plp-price-label-val" data-to-val>\u20AC ' + max + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="plp-price-track" data-track>' +
          '<div class="plp-price-fill" data-fill></div>' +
          '<div class="plp-price-knob" data-knob="from" tabindex="0" role="slider" aria-label="Mindestpreis"></div>' +
          '<div class="plp-price-knob" data-knob="to" tabindex="0" role="slider" aria-label="H\u00F6chstpreis"></div>' +
        '</div>';
      row.insertBefore(slider, row.firstChild);

      var track = slider.querySelector('[data-track]');
      var fill = slider.querySelector('[data-fill]');
      var knobFrom = slider.querySelector('[data-knob="from"]');
      var knobTo = slider.querySelector('[data-knob="to"]');
      var fromVal = slider.querySelector('[data-from-val]');
      var toVal = slider.querySelector('[data-to-val]');

      var values = { from: min, to: max };

      function pct(v) { return ((v - min) / (max - min)) * 100; }
      function valFromX(clientX, rect) {
        var p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        var v = min + p * (max - min);
        return Math.round(v / step) * step;
      }

      function render() {
        var pFrom = pct(values.from);
        var pTo = pct(values.to);
        knobFrom.style.left = pFrom + '%';
        knobTo.style.left = pTo + '%';
        fill.style.left = pFrom + '%';
        fill.style.right = (100 - pTo) + '%';
        fromVal.textContent = '\u20AC ' + values.from;
        toVal.textContent = '\u20AC ' + values.to;
        knobFrom.setAttribute('aria-valuenow', values.from);
        knobTo.setAttribute('aria-valuenow', values.to);
      }

      function commit() {
        fromInput.value = values.from;
        toInput.value = values.to;
        fromInput.dispatchEvent(new Event('input', { bubbles: true }));
        fromInput.dispatchEvent(new Event('change', { bubbles: true }));
        toInput.dispatchEvent(new Event('input', { bubbles: true }));
        toInput.dispatchEvent(new Event('change', { bubbles: true }));
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
            if (which === 'from') values.from = Math.min(v, values.to - step);
            else values.to = Math.max(v, values.from + step);
            render();
          }
          function end() {
            knob.classList.remove('is-dragging');
            document.removeEventListener('mousemove', move);
            document.removeEventListener('touchmove', move);
            document.removeEventListener('mouseup', end);
            document.removeEventListener('touchend', end);
            commit();
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
          var amount = e.shiftKey ? step * 10 : step;
          if (which === 'from') values.from = Math.max(min, Math.min(values.to - step, values.from + dir * amount));
          else values.to = Math.min(max, Math.max(values.from + step, values.to + dir * amount));
          render();
          commit();
        };
      }

      knobFrom.addEventListener('mousedown', startDrag('from'));
      knobFrom.addEventListener('touchstart', startDrag('from'), { passive: false });
      knobTo.addEventListener('mousedown', startDrag('to'));
      knobTo.addEventListener('touchstart', startDrag('to'), { passive: false });
      knobFrom.addEventListener('keydown', arrowKeys('from'));
      knobTo.addEventListener('keydown', arrowKeys('to'));

      render();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }

    var debounce = null;
    new MutationObserver(function () {
      clearTimeout(debounce);
      debounce = setTimeout(setup, 200);
    }).observe(document.body, { childList: true, subtree: true });
  })();

  // -----------------------------------------------------------------
  // Sort dropdown + counter cleanup (formerly plpcleanup)
  // -----------------------------------------------------------------

  (function initCleanup() {
    function setup() {
      var sel = document.getElementById('sort-select');
      if (sel && sel.children.length === 0) {
        var opts = [
          ['recommended', 'Empfohlen'],
          ['name-asc', 'Name A\u2013Z'],
          ['name-desc', 'Name Z\u2013A'],
          ['price-asc', 'Preis aufsteigend'],
          ['price-desc', 'Preis absteigend']
        ];
        opts.forEach(function (o) {
          var op = document.createElement('option');
          op.value = o[0];
          op.textContent = o[1];
          sel.appendChild(op);
        });
      }

      var pag = document.querySelector('.w-pagination-wrapper');
      if (pag) pag.style.display = 'none';

      function updateCounter() {
        var items = document.querySelectorAll('#plp-grid .w-dyn-item:not(.w-dyn-empty)');
        var visible = 0;
        items.forEach(function (it) {
          if (it.offsetParent !== null) visible++;
        });

        var counter = document.querySelector('.plp-page-counter');
        if (counter) {
          var total = items.length;
          counter.innerHTML =
            '<b class="plp-page-counter-strong">' +
            total +
            '</b> Produkte verf\u00fcgbar \u00b7 <b class="plp-page-counter-strong">' +
            visible +
            '</b> ausgew\u00e4hlt nach Filter';
        }

        var btnNum = document.getElementById('filter-btn-num');
        if (btnNum) {
          var activeCount = document.querySelectorAll('.plp-filter-section input:checked').length;
          btnNum.textContent = activeCount;
          if (activeCount === 0) btnNum.classList.add('is-zero');
          else btnNum.classList.remove('is-zero');
        }
      }

      setTimeout(updateCounter, 500);
      setTimeout(updateCounter, 1500);

      document.addEventListener('change', function (e) {
        if (e.target.matches('.plp-filter-section input')) setTimeout(updateCounter, 100);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  })();

  // -----------------------------------------------------------------
  // Filter section toggle (formerly plpfilters v2.0.0)
  // -----------------------------------------------------------------

  (function initFilterSections() {
    function setup() {
      // Initial state: sections 4 (Breite), 5 (Tiefe), 6 (Dicke) closed
      var sections = document.querySelectorAll('.plp-filter-section');
      sections.forEach(function (sec, idx) {
        // Indexes 3, 4, 5 = sections 4, 5, 6
        if (idx >= 3 && idx <= 5) {
          sec.classList.add('is-closed');
        }
      });

      // Toggle click on head
      document.addEventListener('click', function (e) {
        var head = e.target.closest('.plp-filter-head');
        if (!head) return;
        var section = head.closest('.plp-filter-section');
        if (!section) return;
        section.classList.toggle('is-closed');
        var icon = head.querySelector('.plp-filter-head-icon');
        if (icon) icon.textContent = section.classList.contains('is-closed') ? '+' : '\u2212';
      });

      // Counter per section
      function updateSectionCounters() {
        document.querySelectorAll('.plp-filter-section').forEach(function (sec) {
          var counter = sec.querySelector('.plp-filter-head-counter');
          if (!counter) return;
          var checked = sec.querySelectorAll('input[type=checkbox]:checked').length;
          counter.textContent = checked > 0 ? '(' + checked + ')' : '';
        });
      }

      document.addEventListener('change', function (e) {
        if (e.target.matches('.plp-filter-section input')) {
          setTimeout(updateSectionCounters, 50);
        }
      });

      setTimeout(updateSectionCounters, 200);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  })();

  // -----------------------------------------------------------------
  // Card variants + price conversion (formerly plpcards)
  // -----------------------------------------------------------------

  (function initCards() {
    function init() {
      // Title pipe-split into title + sub
      document.querySelectorAll('.plp-card-title').forEach(function (el) {
        var t = el.textContent;
        if (t.indexOf('|') > 0) {
          var parts = t.split('|');
          el.textContent = parts[0].trim();
          var sub = el.parentElement.querySelector('.plp-card-sub');
          if (sub) sub.textContent = parts.slice(1).join(' \u00b7 ').trim();
        }
      });

      // PLN → EUR price conversion
      document.querySelectorAll('.plp-card-price').forEach(function (el) {
        var t = el.textContent;
        if (t.indexOf('z\u0142') >= 0) {
          var m = t.match(/[\d.,]+/);
          if (m) {
            var pln = parseFloat(m[0].replace(',', '.'));
            var eur = Math.round((pln / 4.3) * 100) / 100;
            el.textContent = '\u20ac ' + eur.toFixed(2).replace('.', ',');
          }
        }
      });

      // Star render (5 stars, fill based on rating)
      document.querySelectorAll('.plp-card-stars-glyph').forEach(function (el) {
        if (el.dataset.rendered) return;
        var rating = parseFloat(el.dataset.rating || el.textContent) || 4.5;
        var full = Math.floor(rating);
        var html = '';
        for (var i = 0; i < 5; i++) {
          html += i < full ? '\u2605' : '<span class="stars-empty">\u2605</span>';
        }
        el.innerHTML = html;
        el.dataset.rendered = '1';
      });

      // Variant dot color
      document.querySelectorAll('.plp-variant-dot').forEach(function (d) {
        if (d.dataset.bg) d.style.background = d.dataset.bg;
      });
    }

    document.addEventListener('click', function (e) {
      var dot = e.target.closest('.plp-variant-dot');
      if (dot) {
        var card = dot.closest('.plp-card');
        if (card) {
          card.querySelectorAll('.plp-variant-dot').forEach(function (x) {
            x.classList.remove('is-active');
          });
          dot.classList.add('is-active');
          var img = dot.dataset.image;
          var imgEl = card.querySelector('.plp-card-img');
          if (img && imgEl) imgEl.src = img;
        }
        return;
      }
      if (e.target.closest('.plp-card-quickadd') || e.target.closest('.plp-card-fav')) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

    // Re-init when CMS items appear/change
    var debounceTimer = null;
    new MutationObserver(function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(init, 150);
    }).observe(document.body, { childList: true, subtree: true });
  })();

  // -----------------------------------------------------------------
  // Active filter tag pills (formerly plptags)
  // Includes today's fix: clear-all handler
  // -----------------------------------------------------------------

  (function initTags() {
    function renderTags() {
      var row = document.getElementById('tags-row');
      if (!row) return;
      row.innerHTML = '';

      document
        .querySelectorAll('.plp-filter-section input[type=checkbox]:checked')
        .forEach(function (cb) {
          var labelContainer = cb.closest('label,.plp-filter-row');
          var label = labelContainer
            ? (labelContainer.querySelector('.plp-filter-label') || labelContainer).textContent.trim()
            : cb.value;
          if (!label) return;

          var tag = document.createElement('span');
          tag.className = 'plp-tag';
          tag.textContent = label;

          var x = document.createElement('span');
          x.className = 'plp-tag-x';
          x.textContent = '\u00d7';
          x.style.cursor = 'pointer';
          x.addEventListener('click', function (e) {
            e.stopPropagation();
            cb.checked = false;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
          });

          tag.appendChild(x);
          row.appendChild(tag);
        });

      var clearLink = document.getElementById('clear-all');
      if (clearLink) clearLink.classList.toggle('is-hidden', row.children.length === 0);
    }

    function clearAllFilters() {
      document
        .querySelectorAll('.plp-filter-section input[type=checkbox]:checked')
        .forEach(function (cb) {
          cb.checked = false;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    document.addEventListener('change', function (e) {
      if (e.target.matches && e.target.matches('.plp-filter-section input[type=checkbox]')) {
        setTimeout(renderTags, 50);
      }
    });

    // Clear-all click handler — NEW (was missing in plptags v1.0.0)
    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'clear-all') {
        e.preventDefault();
        clearAllFilters();
      }
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderTags);
    } else {
      setTimeout(renderTags, 200);
    }
  })();
})();
