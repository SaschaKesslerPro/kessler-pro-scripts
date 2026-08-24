/* Kessler PRO — Consent Bridge v1.0.0
   Reicht die auf der Webflow-Seite (Cookiebot) getroffene Consent-Entscheidung
   an den Shopify-Checkout weiter, damit dort nicht erneut gefragt wird.
   Doku: https://shopify.dev/docs/api/customer-privacy
   Diagnose im Browser: window.KP_CONSENT_DEBUG = true; vor dem Laden setzen. */
(function () {
  'use strict';
  var CFG = {
    api: 'https://cdn.shopify.com/shopifycloud/consent-tracking-api/v0.1/consent-tracking-api.js',
    checkoutRootDomain: 'checkout.kessler-pro.com',
    storefrontRootDomain: 'kessler-pro.com',
    storefrontAccessToken: '412ec64ed0b4546aa69f2ed2ee574441'
  };
  function log() {
    if (!window.KP_CONSENT_DEBUG) return;
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[KP-Consent]');
    console.log.apply(console, a);
  }
  var apiReady = false, pending = null;

  function loadApi(cb) {
    if (window.Shopify && window.Shopify.customerPrivacy) { apiReady = true; return cb(); }
    var s = document.createElement('script');
    s.src = CFG.api;
    s.async = true;
    s.onload = function () {
      apiReady = !!(window.Shopify && window.Shopify.customerPrivacy);
      log('API geladen:', apiReady);
      cb();
    };
    s.onerror = function () { console.warn('[KP-Consent] Shopify Consent API nicht ladbar'); };
    document.head.appendChild(s);
  }

  function readCookiebot() {
    var c = window.Cookiebot && window.Cookiebot.consent;
    if (!c) return null;
    return {
      analytics: !!c.statistics,
      marketing: !!c.marketing,
      preferences: !!c.preferences,
      sale_of_data: !!c.marketing
    };
  }

  function push(state) {
    if (!state) return;
    if (!apiReady) { pending = state; return; }
    var payload = {
      analytics: state.analytics,
      marketing: state.marketing,
      preferences: state.preferences,
      sale_of_data: state.sale_of_data,
      headlessStorefront: true,
      checkoutRootDomain: CFG.checkoutRootDomain,
      storefrontRootDomain: CFG.storefrontRootDomain,
      storefrontAccessToken: CFG.storefrontAccessToken
    };
    try {
      window.Shopify.customerPrivacy.setTrackingConsent(payload, function (res) {
        if (res && res.error) console.warn('[KP-Consent] Fehler:', res.error);
        else log('übertragen:', payload.analytics, payload.marketing,
                 '| gespeichert:', window.Shopify.customerPrivacy.currentVisitorConsent());
      });
    } catch (e) { console.warn('[KP-Consent] Ausnahme:', e); }
  }

  function sync() { push(readCookiebot()); }

  ['CookiebotOnAccept', 'CookiebotOnDecline', 'CookiebotOnConsentReady'].forEach(function (ev) {
    window.addEventListener(ev, sync, false);
  });

  loadApi(function () {
    if (pending) { var p = pending; pending = null; push(p); }
    else sync();
  });

  window.KP_consentSync = sync;
})();
