/*!
 * Kessler PRO · headerscroll v1.5.9
 * v1.5.8 + Mobile permanent shrunk + Logo links neben Burger
 *
 * CHANGES vs v1.5.8 (19.05.2026):
 *   - Mobile: permanent shrunk state (kein Toggle mehr) via @media (max-width:991px)
 *   - Mobile: Logo links via justify-content:flex-start + ersten Spacer ausblenden
 *   - Mobile scroll-handler-Branch deaktiviert (kein add/remove kp-hdr-mobile-shrunk mehr)
 *   - CSS-Regel '.kp-hdr-mobile-shrunk' entfernt (redundant)
 *
 * UNVERÄNDERT: Desktop-Logic 100%, ResizeObserver auf Mobile,
 *   Counter-Logic, position:fixed Sticky-Mechanik, promo-banner-Handling
 */
(function(){
  if(window.__kpHdrScrollV1)return;window.__kpHdrScrollV1=true;
  var hdr=document.querySelector('[data-header-version^="v2"]');
  if(!hdr)return;
  var ez='cubic-bezier(.4,0,.2,1)';
  var st=document.createElement('style');
  st.textContent=
    'html,body{overflow-anchor:none}'+
    '[data-header-version^="v2"]{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:100!important;background:#fff!important;width:100%!important}'+
    // ─── Desktop-only row transitions ──────────────────────────
    '@media (min-width:992px){'+
      '[data-header-part="top-row"]{transition:max-height .25s '+ez+',opacity .25s '+ez+',padding-top .25s '+ez+',padding-bottom .25s '+ez+';overflow:hidden;max-height:var(--kp-top-h,200px);opacity:1}'+
      '[data-header-part="nav-row"]{transition:max-height .25s '+ez+',opacity .25s '+ez+',padding-top .25s '+ez+',padding-bottom .25s '+ez+';overflow:hidden;max-height:var(--kp-nav-h,200px);opacity:1}'+
      '[data-header-part="scrolled-row"]{transition:max-height .25s '+ez+',opacity .25s '+ez+';overflow:hidden;max-height:0;opacity:0}'+
      '.kp-hdr-scrolled [data-header-part="top-row"],.kp-hdr-scrolled [data-header-part="nav-row"]{max-height:0;opacity:0;padding-top:0;padding-bottom:0}'+
      '.kp-hdr-scrolled [data-header-part="scrolled-row"]{max-height:var(--kp-scrolled-h,96px);opacity:1}'+
      'body{transition:padding-top .25s '+ez+'}'+
    '}'+
    // ─── Mobile-only: permanent shrunk + Logo links ────────────
    '@media (max-width:991px){'+
      '[data-header-part="mobile-row"]{min-height:48px!important;padding-top:8px!important;padding-bottom:8px!important;justify-content:flex-start!important}'+
      '[data-header-part="mobile-row"] > [class*="spacer"]:first-of-type,'+
      '[data-header-part="mobile-row"] > [class*="Spacer"]:first-of-type,'+
      '[data-header-part="mobile-row"] > div.spacer:first-of-type{display:none!important}'+
    '}'+
    // ─── Universal: promo-banner ───────────────────────────────
    '[data-header-part="promo-banner"]{transition:transform .25s '+ez+',opacity .25s '+ez+',max-height .25s '+ez+',padding-top .25s '+ez+',padding-bottom .25s '+ez+';overflow:hidden;max-height:var(--kp-promo-h,60px)}'+
    '.kp-hdr-promo-hidden [data-header-part="promo-banner"]{transform:translateY(-100%);opacity:0;max-height:0;padding-top:0;padding-bottom:0}'+
    // ─── Counter visibility ────────────────────────────────────
    '.m-icon-link{position:relative}'+
    '.kp-icon-counter{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;background:#1e1e1e;color:#fff;font-size:10px;line-height:1;border-radius:8px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;font-weight:500}'+
    '[data-sf-link="login-from-wishlist"]{display:none}';
  document.head.appendChild(st);

  // ─── State + breakpoint flag ────────────────────────────────
  var promoHidden=false,desk=window.matchMedia('(min-width:992px)').matches;
  var topH=80,navH=50,promoH=60,scrH=96;
  var setBodyPad;

  if(desk){
    // ─── Desktop: measure once + class-toggle setBodyPad ──────
    var topEl=hdr.querySelector('[data-header-part="top-row"]');
    var navEl=hdr.querySelector('[data-header-part="nav-row"]');
    var promoEl=hdr.querySelector('[data-header-part="promo-banner"]');
    topH=topEl?topEl.offsetHeight:80;
    navH=navEl?navEl.offsetHeight:50;
    promoH=promoEl?promoEl.offsetHeight:60;
    hdr.style.setProperty('--kp-top-h',topH+'px');
    hdr.style.setProperty('--kp-nav-h',navH+'px');
    hdr.style.setProperty('--kp-scrolled-h',scrH+'px');
    hdr.style.setProperty('--kp-promo-h',promoH+'px');

    setBodyPad=function(scrolled){
      var p=promoHidden?0:promoH;
      document.body.style.paddingTop=(scrolled?scrH:(p+topH+navH))+'px';
    };
    document.body.style.transition='padding-top 0s';
    setBodyPad(false);
    requestAnimationFrame(function(){requestAnimationFrame(function(){
      document.body.style.transition='';
    })});
  } else {
    // ─── Mobile: live sync (header is permanent compact now) ──
    setBodyPad=function(){document.body.style.paddingTop=hdr.offsetHeight+'px'};
    setBodyPad();
    if(window.ResizeObserver){
      new ResizeObserver(setBodyPad).observe(hdr);
    } else {
      window.addEventListener('load',setBodyPad);
      window.addEventListener('resize',setBodyPad);
    }
  }

  window.addEventListener('resize',function(){
    desk=window.matchMedia('(min-width:992px)').matches;
  },{passive:true});

  // ─── Cart/Wishlist counter visibility ───────────────────────
  function syncCount(c){if(!c||!c.classList||!c.classList.contains('kp-icon-counter'))return;var t=(c.textContent||'').trim();c.style.display=(t===''||t==='0')?'none':'flex'}
  function initCounters(){
    var cs=hdr.querySelectorAll('.kp-icon-counter');
    cs.forEach(syncCount);
    var mo=new MutationObserver(function(m){m.forEach(function(r){var c=r.target.classList&&r.target.classList.contains('kp-icon-counter')?r.target:r.target.parentElement;syncCount(c)})});
    cs.forEach(function(c){mo.observe(c,{childList:true,characterData:true,subtree:true})});
  }
  initCounters();

  // ─── Scroll handler (RAF-throttled) ─────────────────────────
  // Mobile: no scroll-actions — header permanent compact
  function fire(){
    var y=window.scrollY||window.pageYOffset;
    if(!desk)return;
    if(y>100){
      if(!hdr.classList.contains('kp-hdr-scrolled')){
        hdr.classList.add('kp-hdr-scrolled');
        if(!promoHidden){hdr.classList.add('kp-hdr-promo-hidden');promoHidden=true}
        setBodyPad(true);
      }
    } else if(y<10){
      if(hdr.classList.contains('kp-hdr-scrolled')){
        hdr.classList.remove('kp-hdr-scrolled');
        setBodyPad(false);
      }
    }
  }
  var t=false;
  window.addEventListener('scroll',function(){
    if(!t){requestAnimationFrame(function(){fire();t=false});t=true}
  },{passive:true});
})();
