/*!
 * kessler-pro-scripts / home.js
 * Homepage product carousel: scroll arrows, snap behavior.
 */

(function () {
  'use strict';

  function initCarousels() {
    document.querySelectorAll('.product-grid_wrapper').forEach(function (track) {
      if (track.dataset.k) return;
      track.dataset.k = 1;
      track.style.cssText = '';

      [].forEach.call(track.children, function (c) {
        c.style.cssText = '';
      });

      var wrap = track.parentElement;
      [].forEach.call(wrap.querySelectorAll(':scope>button'), function (b) {
        b.remove();
      });
      wrap.style.position = 'relative';

      function arrowSvg(points) {
        return (
          '<svg xmlns="http://www.w3.org/2000/svg" width=18 height=18 viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=2.5 stroke-linecap=round stroke-linejoin=round><polyline points="' +
          points +
          '"/></svg>'
        );
      }

      var btnBase =
        'position:absolute;top:50%;transform:translateY(-50%);width:36px;height:44px;border-radius:6px;background:#1a1a1a;color:#fff;border:0;cursor:pointer;z-index:20;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.22);transition:.15s;';

      var prev = document.createElement('button');
      var next = document.createElement('button');
      prev.setAttribute('data-k', 'p');
      next.setAttribute('data-k', 'n');
      prev.innerHTML = arrowSvg('15 18 9 12 15 6');
      next.innerHTML = arrowSvg('9 18 15 12 9 6');
      prev.style.cssText = btnBase + 'left:-18px';
      next.style.cssText = btnBase + 'right:-18px';
      wrap.appendChild(prev);
      wrap.appendChild(next);

      var cards = [].slice.call(track.querySelectorAll('.product-card_wrapper'));

      function getCurrent() {
        var s = track.scrollLeft;
        var best = 0;
        var dist = 1e9;
        cards.forEach(function (c, i) {
          var x = Math.abs(c.offsetLeft - s);
          if (x < dist) {
            dist = x;
            best = i;
          }
        });
        return best;
      }

      function updateButtons() {
        var atStart = track.scrollLeft <= 4;
        var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
        prev.style.opacity = atStart ? 0 : 1;
        prev.style.pointerEvents = atStart ? 'none' : 'auto';
        next.style.opacity = atEnd ? 0 : 1;
        next.style.pointerEvents = atEnd ? 'none' : 'auto';
      }

      next.onclick = function () {
        track.scrollTo({
          left: cards[Math.min(getCurrent() + 1, cards.length - 1)].offsetLeft,
          behavior: 'smooth'
        });
      };

      prev.onclick = function () {
        track.scrollTo({
          left: cards[Math.max(getCurrent() - 1, 0)].offsetLeft,
          behavior: 'smooth'
        });
      };

      track.addEventListener('scroll', updateButtons);
      updateButtons();
    });
  }

  if (document.readyState === 'loading') {
    addEventListener('DOMContentLoaded', function () {
      setTimeout(initCarousels, 250);
    });
  } else {
    setTimeout(initCarousels, 250);
  }
})();
