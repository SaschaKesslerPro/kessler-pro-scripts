/*!
 * kessler-pro-scripts / plp.js
 * Product Listing Page: filter drawer, sort, filter sections, cards, active filter pills.
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
      /* Layout: drawer open vs closed */
      'body:not(.is-drawer-open) .plp-shop-inner{grid-template-columns:0 1fr;gap:0}' +
      'body:not(.is-drawer-open) .plp-drawer{opacity:0;pointer-events:none;visibility:hidden}' +
      'body.is-drawer-open .plp-shop-inner{grid-template-columns:300px 1fr;gap:32px}' +
      'body.is-drawer-open .plp-grid{grid-template-columns:repeat(3,1fr)}' +
      'body:not(.is-drawer-open) .plp-grid{grid-template-columns:repeat(4,1fr)}' +
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
        '.plp-drawer{position:fixed!important;top:0!important;left:0;right:0;bottom:0;width:100%;max-height:100vh;background:#fff;z-index:9999;transform:translateX(-100%);transition:transform .3s;border-radius:0}' +
        'body.is-drawer-open .plp-drawer{transform:translateX(0)}' +
        'body.is-drawer-open{overflow:hidden}' +
        '.plp-drawer-inner{border:0;border-radius:0;height:100%;display:flex;flex-direction:column}' +
        '.plp-grid{grid-template-columns:repeat(2,1fr)!important;gap:16px}' +
      '}' +
      '@media(max-width:479px){.plp-grid{grid-template-columns:1fr!important}}'
  );

  // -----------------------------------------------------------------
  // v1.0.1 additions: drawer scrollbar hide + H1 weight override
  // -----------------------------------------------------------------

  injectStyle(
    /* Hide drawer-inner scrollbar on all browsers */
    '.plp-drawer-inner{scrollbar-width:none;-ms-overflow-style:none}' +
      '.plp-drawer-inner::-webkit-scrollbar{display:none;width:0;height:0;background:transparent}' +
      /* Force light weight on H1 — beats default-h1 tag style */
      '.plp-page-h1{font-weight:300!important}'
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
