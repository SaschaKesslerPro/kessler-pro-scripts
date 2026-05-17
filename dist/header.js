/*!
 * Kessler PRO · headerscroll v1.5.0
 * Sticky-Shrink + Promo-Banner-Hide (Hem-Pattern) + Mobile 60/20 Scroll-Handler
 * Target: Header-v2 (data-header-version^="v2")
 * Detection: passive, idempotent, RAF-throttled
 * Char-count target: ~1700 (inline limit 2000)
 *
 * INSTALLATION: add_inline_site_script
 *   displayName: kessler-header-scroll
 *   version: 1.5.0
 *   location: footer
 *
 * COMPATIBILITY:
 *   - Orthogonal zu Mobile-Drawer-Script (data-mobile-trigger)
 *   - Orthogonal zu kesslerbootstrap Loader (eigener Slot)
 *   - Beachtet Designer-Lock: nur Klassen togglen + minimal CSS
 *
 * CLASS-NAMING (kp-* convention):
 *   .kp-hdr-scrolled         Desktop sticky-shrink-State
 *   .kp-hdr-promo-hidden     Promo-Banner einmalig versteckt (Hem-Pattern)
 *   .kp-hdr-mobile-shrunk    Mobile-Row shrunk-State
 *
 * BREAKPOINT:
 *   Desktop ab 992px (main+)  → kp-hdr-scrolled
 *   Mobile < 992px            → kp-hdr-mobile-shrunk via 60/20-Logik
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
    '.kp-hdr-mobile-shrunk [data-header-part="mobile-row"]{min-height:48px;padding-top:8px;padding-bottom:8px}';
  document.head.appendChild(st);
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
