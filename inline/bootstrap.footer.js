/*!
 * kessler-pro-scripts / inline/bootstrap.footer.js
 * Pasted INLINE in the Webflow footer as registered script "kesslerbootstrap".
 *
 * Loads the jsDelivr-hosted dist/*.js files (commit-hash pinned via V).
 * Current applied version: 1.0.93  (dist commit c0228995a6851ab12c3f06994d20f1205ebd20bd)
 *
 * To update after changing dist/: set V to the new dist commit hash,
 * re-register a new kesslerbootstrap version, and add_site_script (footer).
 * search.js is pinned to its own commit via U().
 */
(function () {
  var V = '@c0228995a6851ab12c3f06994d20f1205ebd20bd',
      B = 'https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts' + V + '/dist/';
  function L(f) { var s = document.createElement('script'); s.src = B + f; s.async = true; document.head.appendChild(s); }
  function U(u) { var s = document.createElement('script'); s.src = u; s.async = true; document.head.appendChild(s); }
  L('globals.js');
  L('wunschliste.js');
  if (document.getElementById('plp-grid')) L('plp.js');
  if (document.querySelector('.product-grid_wrapper') && document.querySelector('.product-card_wrapper')) L('home.js');
  if (document.querySelector('.kp-auth')) L('auth.js');
  if (document.querySelector('[data-header-version^="v2"]')) L('header.js');
  if (location.pathname.indexOf('/account') === 0 || document.querySelector('[data-kph-bind],[data-kph-list]')) L('hub.js');
  if (document.querySelector('[data-kp-search],.header_scrolled-search,[data-mobile-trigger="search-open"]')) U('https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@72256260d01c75cc89c76f9e4ccfe8bc3f84c968/dist/search.js');
})();
