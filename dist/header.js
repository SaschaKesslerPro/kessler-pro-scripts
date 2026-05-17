/*!
 * Kessler PRO · headerscroll v1.5.2
 * v1.5.1 features + smooth transitions (max-height + opacity, no display toggle)
 *
 * v1.5.2 CHANGES:
 *   - Desktop: top-row/nav-row collapse via max-height+opacity (cubic-bezier .4,0,.2,1)
 *   - Desktop: scrolled-row expand via max-height+opacity (synced)
 *   - Mobile: row-shrink transition 200ms (was 250ms) with cubic-bezier
 *   - All transitions use single easing curve for visual consistency
 */
(function(){
  if(window.__kpHdrScrollV1)return;window.__kpHdrScrollV1=true;
  var hdr=document.querySelector('[data-header-version^="v2"]');
  if(!hdr)return;
  var ez='cubic-bezier(.4,0,.2,1)';
  var st=document.createElement('style');
  st.textContent=
    '[data-header-part="top-row"],[data-header-part="nav-row"]{transition:max-height .3s '+ez+',opacity .25s '+ez+',padding-top .3s '+ez+',padding-bottom .3s '+ez+';overflow:hidden;max-height:240px;opacity:1}'+
    '[data-header-part="scrolled-row"]{transition:max-height .3s '+ez+',opacity .25s '+ez+' .05s;overflow:hidden;max-height:0;opacity:0}'+
    '.kp-hdr-scrolled [data-header-part="top-row"],.kp-hdr-scrolled [data-header-part="nav-row"]{max-height:0;opacity:0;padding-top:0;padding-bottom:0}'+
    '.kp-hdr-scrolled [data-header-part="scrolled-row"]{max-height:96px;opacity:1}'+
    '[data-header-part="promo-banner"]{transition:transform .3s '+ez+',opacity .25s '+ez+',max-height .3s '+ez+',padding-top .3s '+ez+',padding-bottom .3s '+ez+';overflow:hidden;max-height:60px}'+
    '.kp-hdr-promo-hidden [data-header-part="promo-banner"]{transform:translateY(-100%);opacity:0;max-height:0;padding-top:0;padding-bottom:0}'+
    '[data-header-part="mobile-row"]{transition:min-height .2s '+ez+',padding-top .2s '+ez+',padding-bottom .2s '+ez+'}'+
    '.kp-hdr-mobile-shrunk [data-header-part="mobile-row"]{min-height:48px;padding-top:8px;padding-bottom:8px}'+
    '.kp-hdr-mobile-shrunk .header_mobile-logo,.kp-hdr-mobile-shrunk [data-header-part="mobile-row"] img{transition:max-height .2s '+ez+',transform .2s '+ez+'}'+
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
