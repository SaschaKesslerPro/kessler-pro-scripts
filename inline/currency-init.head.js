/*!
 * kessler-pro-scripts / inline/currency-init.head.js
 * Pasted INLINE in the Webflow <head> as registered script "kesslercurrency".
 *
 * Sets the Storesynk presentment market to Germany (EUR) by default so the
 * cart drawer matches the site + checkout currency. A visitor who already
 * chose a currency (via a currency selector) is respected (guarded).
 *
 * Must run synchronously, before Storesynk init -> inline <head>, not jsDelivr.
 * No IP geolocation -> no tracking -> no cookie consent needed.
 *
 * The registered inline version is the minified one-liner below.
 */
try {
  if (!localStorage.getItem('_sf-country')) {
    localStorage.setItem('_sf-country', 'DE');
  }
} catch (e) {}
