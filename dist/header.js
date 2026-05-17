/*!
 * Kessler PRO · headerscroll v1.5.1
 * v1.5.0 features + Counter-Badge-Position + Wishlist-Hide-LoggedOut + Counter-Zero-Hide
 *
 * v1.5.1 CHANGES:
 *   - Counter-Badge: position absolute top-right on .m-icon-link
 *   - Wishlist logged-out: hidden via [data-sf-link="login-from-wishlist"]
 *   - Counters with text '0' or empty: hidden via MutationObserver
 */
(function(){
  if(window.__kpHdrScrollV1)return;window.__kpHdrScrollV1=true;
  var hdr=document.querySelector('[data-header-version^="v2"]');
  if(!hdr)return;
  var st=document.createElement('style');
  st.textContent=
    '[data-header-part="scrolled-row"]{display:none}'+
    '.kp-hdr-scrolled [data-header-part="top-row"],'+
    '.kp-hdr-scrolled [data-header-part="nav-row"]{display:none}'+
    '.kp-hdr-scrolled [data-header-part="scrolled-row"]{display:flex}'+
    '[data-header-part="promo-banner"]{transition:transform .3s ease,opacity .3s ease,max-height .3s ease,padding .3s ease;overflow:hidden;max-height:60px}'+
    '.kp-hdr-promo-hidden [data-header-part="promo-banner"]{transform:translateY(-100%);opacity:0;max-height:0;padding-top:0;padding-bottom:0}'+
    '[data-header-part="mobile-row"]{transition:min-height .25s ease,padding .25s ease}'+
    '.kp-hdr-mobile-shrunk [data-header-part="mobile-row"]{min-height:48px;padding-top:8px;padding-bottom:8px}'+
    '.m-icon-link{position:relative}'+
    '.kp-icon-counter{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;background:#1e1e1e;color:#fff;font-size:10px;line-height:1;border-radius:8px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;font-weight:500}'+
    '[data-sf-link="login-from-wishlist"]{display:none}';
  document.head.appendChild(st);
  function syncCount(c){if(!c||!c.classList||!c.classList.contains('kp-icon-counter'))return;var t=(c.textContent||'').trim();c.style.display=(t===''||t==='0')?'none':'flex'}
  function initCounters(){
    var cs=hdr.querySelectorAll('.kp-icon-counter');
    cs.forEach(syncCount);
    var mo=new MutationObserver(function(m){m.forEach(function(r){var c=r.target.classList&&r.target.classList.contains('kp-icon-counter')?r.target:r.target.parentElement;syncCount(c)})});
    cs.forEach(function(c){mo.observe(c,{childList:true,characterData:true,subtree:true})});
  }
  initCounters();
  var lastY=0,promoHidden=false,desk=window.matchMedia('(min-width:992px)').matches;
  function fire(){
    var y=window.scrollY||window.pageYOffset;
    if(desk){
      if(y>100){hdr.classList.add('kp-hdr-scrolled');if(!promoHidden){hdr.classList.add('kp-hdr-promo-hidden');promoHidden=true}}
      else if(y<10){hdr.classList.remove('kp-hdr-scrolled')}
    }else{
      var d=y-lastY;
      if(d>0&&y>60){hdr.classList.add('kp-hdr-mobile-shrunk');if(!promoHidden){hdr.classList.add('kp-hdr-promo-hidden');promoHidden=true}}
      else if(d<-20){hdr.classList.remove('kp-hdr-mobile-shrunk')}
      lastY=y;
    }
  }
  var t=false;
  window.addEventListener('scroll',function(){
    if(!t){requestAnimationFrame(function(){fire();t=false});t=true}
  },{passive:true});
  window.addEventListener('resize',function(){
    desk=window.matchMedia('(min-width:992px)').matches;
  },{passive:true});
})();
