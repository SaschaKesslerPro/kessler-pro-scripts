/*!
 * Kessler PRO · headerscroll v1.5.7
 * v1.5.4 + minimal-invasive transition fixes (no structural CSS overrides)
 *
 * FIXES vs v1.5.4 (approved 19.05.2026 nach v1.5.5/v1.5.6 revert):
 *   1. max-height overshoot weg → measure actual row heights, write CSS vars
 *   2. ALL transition timings unified to .25s, opacity-delay removed
 *   3. ResizeObserver replaced with class-toggle-driven setBodyPad
 *   4. body.padding-top CSS transition added → synchronous with header shrink
 *
 * UNVERÄNDERT vs v1.5.4:
 *   - position:fixed!important + background:#fff!important (Designer-Sticky-Setup)
 *   - overflow-anchor:none auf html/body
 *   - Klassen-Toggle-Logic .kp-hdr-scrolled / .kp-hdr-promo-hidden / .kp-hdr-mobile-shrunk
 *   - Scroll-Thresholds 100/10 desktop, 60/30 mobile
 *   - Mobile-Row transition .15s (separate concern, not part of pain point)
 *   - Counter MutationObserver (.kp-icon-counter)
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
    '[data-header-part="top-row"]{transition:max-height .25s '+ez+',opacity .25s '+ez+',padding-top .25s '+ez+',padding-bottom .25s '+ez+';overflow:hidden;max-height:var(--kp-top-h,200px);opacity:1}'+
    '[data-header-part="nav-row"]{transition:max-height .25s '+ez+',opacity .25s '+ez+',padding-top .25s '+ez+',padding-bottom .25s '+ez+';overflow:hidden;max-height:var(--kp-nav-h,200px);opacity:1}'+
    '[data-header-part="scrolled-row"]{transition:max-height .25s '+ez+',opacity .25s '+ez+';overflow:hidden;max-height:0;opacity:0}'+
    '.kp-hdr-scrolled [data-header-part="top-row"],.kp-hdr-scrolled [data-header-part="nav-row"]{max-height:0;opacity:0;padding-top:0;padding-bottom:0}'+
    '.kp-hdr-scrolled [data-header-part="scrolled-row"]{max-height:var(--kp-scrolled-h,96px);opacity:1}'+
    '[data-header-part="promo-banner"]{transition:transform .25s '+ez+',opacity .25s '+ez+',max-height .25s '+ez+',padding-top .25s '+ez+',padding-bottom .25s '+ez+';overflow:hidden;max-height:var(--kp-promo-h,60px)}'+
    '.kp-hdr-promo-hidden [data-header-part="promo-banner"]{transform:translateY(-100%);opacity:0;max-height:0;padding-top:0;padding-bottom:0}'+
    '[data-header-part="mobile-row"]{transition:min-height .15s '+ez+',padding-top .15s '+ez+',padding-bottom .15s '+ez+'}'+
    '.kp-hdr-mobile-shrunk [data-header-part="mobile-row"]{min-height:48px;padding-top:8px;padding-bottom:8px}'+
    '.m-icon-link{position:relative}'+
    '.kp-icon-counter{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;background:#1e1e1e;color:#fff;font-size:10px;line-height:1;border-radius:8px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;font-weight:500}'+
    '[data-sf-link="login-from-wishlist"]{display:none}'+
    'body{transition:padding-top .25s '+ez+'}';
  document.head.appendChild(st);

  // ─── Measure actual row heights (no overshoot) ──────────────
  var topEl=hdr.querySelector('[data-header-part="top-row"]');
  var navEl=hdr.querySelector('[data-header-part="nav-row"]');
  var scrEl=hdr.querySelector('[data-header-part="scrolled-row"]');
  var promoEl=hdr.querySelector('[data-header-part="promo-banner"]');
  var topH=topEl?topEl.offsetHeight:80;
  var navH=navEl?navEl.offsetHeight:50;
  var promoH=promoEl?promoEl.offsetHeight:60;
  // Scrolled-row needs class temporarily to render (it's max-height:0 by default)
  hdr.classList.add('kp-hdr-scrolled');
  var scrH=scrEl?scrEl.offsetHeight:96;
  hdr.classList.remove('kp-hdr-scrolled');
  hdr.style.setProperty('--kp-top-h',topH+'px');
  hdr.style.setProperty('--kp-nav-h',navH+'px');
  hdr.style.setProperty('--kp-scrolled-h',scrH+'px');
  hdr.style.setProperty('--kp-promo-h',promoH+'px');

  // ─── State + breakpoint flag ────────────────────────────────
  var promoHidden=false,desk=window.matchMedia('(min-width:992px)').matches;

  // ─── Body padding-top synced with header state ──────────────
  function setBodyPad(scrolled){
    if(!desk){document.body.style.paddingTop=hdr.offsetHeight+'px';return}
    var p=promoHidden?0:promoH;
    document.body.style.paddingTop=(scrolled?scrH:(p+topH+navH))+'px';
  }
  // Initial snap (no transition for first set) then enable CSS transition
  document.body.style.transition='padding-top 0s';
  setBodyPad(false);
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    document.body.style.transition='';
  })});
  window.addEventListener('resize',function(){
    desk=window.matchMedia('(min-width:992px)').matches;
    setBodyPad(hdr.classList.contains('kp-hdr-scrolled'));
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
  function fire(){
    var y=window.scrollY||window.pageYOffset;
    if(desk){
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
    }else{
      if(y>60){
        if(!hdr.classList.contains('kp-hdr-mobile-shrunk')){
          hdr.classList.add('kp-hdr-mobile-shrunk');
          if(!promoHidden){hdr.classList.add('kp-hdr-promo-hidden');promoHidden=true}
          requestAnimationFrame(function(){setBodyPad(false)});
        }
      } else if(y<30){
        if(hdr.classList.contains('kp-hdr-mobile-shrunk')){
          hdr.classList.remove('kp-hdr-mobile-shrunk');
          requestAnimationFrame(function(){setBodyPad(false)});
        }
      }
    }
  }
  var t=false;
  window.addEventListener('scroll',function(){
    if(!t){requestAnimationFrame(function(){fire();t=false});t=true}
  },{passive:true});
})();
