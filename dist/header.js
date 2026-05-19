/*!
 * Kessler PRO · headerscroll v1.5.5
 * Grid-template-rows interpolation + position:sticky
 * Synthesis of 2026 best practices for smooth sticky-header state transitions
 *
 * KEY CHANGES from v1.5.4:
 *   - position: fixed → position: sticky (eliminates body.paddingTop sync entirely)
 *   - max-height transitions → grid-template-rows interpolation (no overshoot bug)
 *   - Removed: ResizeObserver (was the feedback-loop source during transitions)
 *   - Removed: body.paddingTop dynamic math (sticky handles layout naturally)
 *   - Removed: scroll-event polling on desktop → IntersectionObserver sentinel
 *   - All transitions unified: .3s cubic-bezier(.4,0,.2,1)
 *   - Kept: MutationObserver for .kp-icon-counter (separate concern, working)
 *   - Kept: Mobile 60/20-logic via RAF-throttled scroll (different needs than desktop)
 *
 * BROWSER SUPPORT (all baseline 2026):
 *   - grid-template-rows interpolation: Chrome 107+, Firefox 66+, Safari 16+
 *   - position: sticky: all evergreen since 2017
 *   - IntersectionObserver: all evergreen since 2017
 *   - overflow-anchor:none: Safari supports since 2019, 92%+ global
 *
 * RISK: position: sticky breaks if any ancestor has overflow:hidden/auto/scroll
 *       in the scroll-chain. If header doesn't visually stick, fall back to
 *       position:fixed and add one-shot body.paddingTop class-toggle.
 */
(function(){
  if(window.__kpHdrScrollV1)return;
  window.__kpHdrScrollV1=true;

  var hdr=document.querySelector('[data-header-version^="v2"]');
  if(!hdr)return;

  var ez='cubic-bezier(.4,0,.2,1)';

  // ─── CSS inject ────────────────────────────────────────────
  var st=document.createElement('style');
  st.textContent=[
    // Layout stability — prevents browser auto-scroll-readjust
    'html{overflow-anchor:none}',

    // Header v2 as sticky grid container
    '[data-header-version^="v2"]{',
      'position:sticky!important;top:0!important;z-index:100!important;',
      'background:#fff!important;width:100%!important;',
      'display:grid;',
      'grid-template-rows:auto auto auto 0fr;',
      'transition:grid-template-rows .3s '+ez,
    '}',

    // Promo-banner one-shot hide (Hem pattern) — first row collapses
    '[data-header-version^="v2"].kp-hdr-promo-hidden{grid-template-rows:0fr auto auto 0fr}',

    // Stuck state — promo + top + nav collapsed, scrolled-row revealed
    '[data-header-version^="v2"].kp-hdr-scrolled{grid-template-rows:0fr 0fr 0fr 1fr}',

    // Row containers — overflow clip + opacity fade
    '[data-header-part="promo-banner"],',
    '[data-header-part="top-row"],',
    '[data-header-part="nav-row"],',
    '[data-header-part="scrolled-row"]{',
      'overflow:hidden;transition:opacity .25s '+ez,
    '}',

    // Opacity fade-out when row collapses
    '.kp-hdr-promo-hidden [data-header-part="promo-banner"]{opacity:0}',
    '.kp-hdr-scrolled [data-header-part="top-row"],',
    '.kp-hdr-scrolled [data-header-part="nav-row"]{opacity:0}',

    // scrolled-row default hidden, visible only when stuck
    '[data-header-part="scrolled-row"]{opacity:0}',
    '.kp-hdr-scrolled [data-header-part="scrolled-row"]{opacity:1}',

    // Mobile row shrink (unchanged from v1.5.4, working)
    '[data-header-part="mobile-row"]{transition:min-height .15s '+ez+',padding-top .15s '+ez+',padding-bottom .15s '+ez+'}',
    '.kp-hdr-mobile-shrunk [data-header-part="mobile-row"]{min-height:48px;padding-top:8px;padding-bottom:8px}',

    // Icon counter styling (unchanged)
    '.m-icon-link{position:relative}',
    '.kp-icon-counter{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;background:#1e1e1e;color:#fff;font-size:10px;line-height:1;border-radius:8px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;font-weight:500}',

    // Hide logged-out wishlist link when logged-in shim sets it
    '[data-sf-link="login-from-wishlist"]{display:none}'
  ].join('');
  document.head.appendChild(st);

  // ─── Counter sync (unchanged from v1.5.4) ──────────────────
  function syncCount(c){
    if(!c||!c.classList||!c.classList.contains('kp-icon-counter'))return;
    var t=(c.textContent||'').trim();
    c.style.display=(t===''||t==='0')?'none':'flex';
  }
  function initCounters(){
    var cs=hdr.querySelectorAll('.kp-icon-counter');
    cs.forEach(syncCount);
    var mo=new MutationObserver(function(m){
      m.forEach(function(r){
        var c=r.target.classList&&r.target.classList.contains('kp-icon-counter')?r.target:r.target.parentElement;
        syncCount(c);
      });
    });
    cs.forEach(function(c){mo.observe(c,{childList:true,characterData:true,subtree:true})});
  }
  initCounters();

  // ─── Sentinel for IntersectionObserver-based state trigger ─
  var sent=document.createElement('div');
  sent.style.cssText='position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none';
  document.body.insertBefore(sent,document.body.firstChild);

  // ─── Breakpoint tracking via MediaQueryList.onchange ───────
  var promoHidden=false;
  var dq=matchMedia('(min-width:992px)');
  var desk=dq.matches;
  dq.onchange=function(e){desk=e.matches};

  // ─── Desktop sticky-state toggle ───────────────────────────
  // rootMargin -100px 0 0 0 → observer triggers when user scrolls past 100px
  new IntersectionObserver(function(entries){
    if(!desk)return;
    var stuck=!entries[0].isIntersecting;
    hdr.classList.toggle('kp-hdr-scrolled',stuck);
    if(stuck && !promoHidden){
      hdr.classList.add('kp-hdr-promo-hidden');
      promoHidden=true;
    }
  },{threshold:0,rootMargin:'-100px 0 0 0'}).observe(sent);

  // ─── Mobile 60/20-Logic (kept from v1.5.4) ─────────────────
  var t=false;
  addEventListener('scroll',function(){
    if(t)return; t=true;
    requestAnimationFrame(function(){
      if(!desk){
        var y=scrollY||pageYOffset;
        if(y>60){
          hdr.classList.add('kp-hdr-mobile-shrunk');
          if(!promoHidden){
            hdr.classList.add('kp-hdr-promo-hidden');
            promoHidden=true;
          }
        } else if(y<30){
          hdr.classList.remove('kp-hdr-mobile-shrunk');
        }
      }
      t=false;
    });
  },{passive:true});
})();
