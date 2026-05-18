/*!
 * Kessler PRO · wunschliste.js v1.0.0
 *
 * Wishlist-System: localStorage primär, Shopify Customer Metafield als Sync-Layer
 *
 * Architektur:
 *   1. localStorage (kp_wl_v1) als Source of Truth — funktioniert für logged-out + immediate response
 *   2. Customer Account API Metafield (kessler.wishlist JSON) für persistent Cross-Device wenn logged-in
 *   3. Shopyflow customer:login event triggert merge + sync
 *   4. Universal-Loader (jede Page) für Header-Counter, DOM-Render nur wenn .kp-wishlist-grid existiert
 *
 * DOM-Hooks:
 *   .kp-wishlist-grid    → Container für Items (Template = erstes .kp-product-card child)
 *   .kp-empty            → Empty-State Toggle
 *   .kp-icon-counter     → Header Counter (innerhalb des Wishlist-Links)
 *   [data-kp-wl-add]     → Universal Toggle-Button (mit data-handle/name/specs/price/rating)
 *
 * Public API: window.KPW = { get, has, add, remove, count, sync }
 */
(function(){
  if(window.__kpWishlistV1)return;
  window.__kpWishlistV1=true;

  var KEY='kp_wl_v1';
  var MF_NS='kessler';
  var MF_KEY='wishlist';
  var SYNC_DEBOUNCE=1500;

  // -----------------------------------------------------------------
  // localStorage layer
  // -----------------------------------------------------------------
  function read(){
    try{return JSON.parse(localStorage.getItem(KEY))||[]}catch(e){return[]}
  }
  function write(arr){
    try{localStorage.setItem(KEY,JSON.stringify(arr))}catch(e){}
  }
  function has(handle){
    return read().some(function(i){return i.h===handle});
  }
  function add(item){
    if(!item||!item.h)return false;
    var list=read();
    if(has(item.h))return false;
    item.t=item.t||Date.now();
    list.unshift(item);
    write(list);
    emit();
    queueSync();
    return true;
  }
  function remove(handle){
    var before=read().length;
    var list=read().filter(function(i){return i.h!==handle});
    if(list.length===before)return false;
    write(list);
    emit();
    queueSync();
    return true;
  }
  function count(){return read().length}

  function emit(){
    document.dispatchEvent(new CustomEvent('kpw:change',{detail:{items:read()}}));
  }

  // -----------------------------------------------------------------
  // Customer Account API Metafield Sync
  // -----------------------------------------------------------------
  var customerCtx=null;  // { token, shopId } populated by shopyflow event
  var syncTimer=null;

  function getCustomer(){
    // Try Shopyflow public API surface (multiple fallbacks)
    try{
      if(window.shopyflow){
        var sf=window.shopyflow;
        if(typeof sf.getCustomer==='function')return sf.getCustomer();
        if(sf.customer)return sf.customer;
      }
    }catch(e){}
    return null;
  }

  function gqlEndpoint(){
    // Customer Account API GraphQL endpoint pattern (Shopify Headless)
    // Shop-ID from Shopify Headless app: 100010033498
    return 'https://shopify.com/100010033498/account/customer/api/2024-10/graphql';
  }

  function gql(query,variables,token){
    return fetch(gqlEndpoint(),{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':token
      },
      body:JSON.stringify({query:query,variables:variables||{}})
    }).then(function(r){return r.json()});
  }

  function readMetafield(token){
    var q='query{customer{metafield(namespace:"'+MF_NS+'",key:"'+MF_KEY+'"){value}}}';
    return gql(q,null,token).then(function(d){
      try{
        var v=d&&d.data&&d.data.customer&&d.data.customer.metafield&&d.data.customer.metafield.value;
        return v?JSON.parse(v):[];
      }catch(e){return[]}
    }).catch(function(){return[]});
  }

  function writeMetafield(token,list){
    var q='mutation($v:String!){metafieldsSet(metafields:[{namespace:"'+MF_NS+'",key:"'+MF_KEY+'",type:"json",value:$v}]){userErrors{message}}}';
    return gql(q,{v:JSON.stringify(list)},token).catch(function(){});
  }

  function mergeNewer(a,b){
    // Union by handle, newer timestamp wins
    var map={};
    function addList(L){
      L.forEach(function(i){
        if(!i||!i.h)return;
        var t=i.t||0;
        if(!map[i.h]||(map[i.h].t||0)<t)map[i.h]=i;
      });
    }
    addList(a||[]);addList(b||[]);
    var out=Object.keys(map).map(function(k){return map[k]});
    out.sort(function(a,b){return (b.t||0)-(a.t||0)});
    return out;
  }

  function sync(){
    if(!customerCtx||!customerCtx.token)return Promise.resolve(false);
    var local=read();
    return readMetafield(customerCtx.token).then(function(remote){
      var merged=mergeNewer(local,remote);
      write(merged);
      emit();
      return writeMetafield(customerCtx.token,merged).then(function(){return true});
    }).catch(function(){return false});
  }

  function queueSync(){
    if(!customerCtx)return;
    if(syncTimer)clearTimeout(syncTimer);
    syncTimer=setTimeout(function(){syncTimer=null;sync()},SYNC_DEBOUNCE);
  }

  // -----------------------------------------------------------------
  // Shopyflow login/logout event hooks
  // -----------------------------------------------------------------
  function onLogin(payload){
    try{
      var c=payload&&(payload.detail||payload);
      var token=c&&(c.accessToken||c.token||c.customerAccessToken);
      if(token){
        customerCtx={token:token};
        sync();
      }
    }catch(e){}
  }

  function onLogout(){
    customerCtx=null;
    // localStorage bleibt — User kann offline weiter Items sammeln
  }

  // Multiple event-name fallbacks (Shopyflow doc unklar)
  ['shopyflow:customer-login','shopyflow:login','sf-customer-login'].forEach(function(ev){
    document.addEventListener(ev,onLogin);
  });
  ['shopyflow:customer-logout','shopyflow:logout','sf-customer-logout'].forEach(function(ev){
    document.addEventListener(ev,onLogout);
  });

  // Probe for already-logged-in state (event might have fired before script load)
  function probeCustomer(){
    var c=getCustomer();
    if(c&&(c.accessToken||c.token)){
      customerCtx={token:c.accessToken||c.token};
      sync();
    }
  }

  // -----------------------------------------------------------------
  // DOM rendering (only on wishlist page)
  // -----------------------------------------------------------------
  function setStars(el,rating){
    if(!el||rating==null)return;
    var r=parseFloat(rating)||0;
    el.innerHTML='\u2605\u2605\u2605\u2605\u2605 '+r.toFixed(1).replace('.0','');
  }

  function renderPage(){
    var grid=document.querySelector('.kp-wishlist-grid');
    if(!grid)return;
    var tpl=grid.querySelector('.kp-product-card');
    if(!tpl)return;

    // Mark first card as template, hide it permanently
    if(!tpl.dataset.kpTpl){
      tpl.dataset.kpTpl='1';
      tpl.style.display='none';
    }

    // Wipe existing rendered items (siblings without data-kp-tpl)
    Array.prototype.slice.call(grid.querySelectorAll('.kp-product-card:not([data-kp-tpl])')).forEach(function(n){n.remove()});

    var list=read();
    var empty=document.querySelector('.kp-empty');
    if(empty)empty.style.display=list.length?'none':'';

    list.forEach(function(item){
      var card=tpl.cloneNode(true);
      delete card.dataset.kpTpl;
      card.style.display='';
      card.setAttribute('href','/produkte/'+item.h);

      var name=card.querySelector('.kp-product-name');
      if(name)name.textContent=item.n||'';
      var specs=card.querySelector('.kp-product-specs');
      if(specs)specs.textContent=item.s||'';
      var price=card.querySelector('.kp-product-price');
      if(price)price.textContent=item.p||'';
      setStars(card.querySelector('.kp-product-stars'),item.r);

      var removeBtn=card.querySelector('.kp-product-image-remove');
      if(removeBtn){
        removeBtn.addEventListener('click',function(e){
          e.preventDefault();
          e.stopPropagation();
          remove(item.h);
        });
      }
      grid.appendChild(card);
    });
  }

  // -----------------------------------------------------------------
  // Header counter (universal, every page)
  // -----------------------------------------------------------------
  function setCounter(){
    var n=count();
    // Target only counters inside wishlist-related links
    document.querySelectorAll('[data-mobile-icon="wishlist"] .kp-icon-counter, .kp-wishlist-counter').forEach(function(c){
      c.textContent=n||'';
    });
  }

  // -----------------------------------------------------------------
  // Universal toggle button (PDP/PLP heart icons)
  // -----------------------------------------------------------------
  document.addEventListener('click',function(e){
    var btn=e.target.closest('[data-kp-wl-add]');
    if(!btn)return;
    e.preventDefault();
    e.stopPropagation();
    var d=btn.dataset;
    if(!d.handle)return;
    if(has(d.handle)){
      remove(d.handle);
      btn.classList.remove('is-active');
    }else{
      add({h:d.handle,n:d.name,s:d.specs,p:d.price,r:d.rating});
      btn.classList.add('is-active');
    }
  });

  function syncToggleStates(){
    Array.prototype.slice.call(document.querySelectorAll('[data-kp-wl-add]')).forEach(function(b){
      if(!b.dataset.handle)return;
      if(has(b.dataset.handle))b.classList.add('is-active');
      else b.classList.remove('is-active');
    });
  }

  // -----------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------
  function refresh(){
    setCounter();
    renderPage();
    syncToggleStates();
  }

  document.addEventListener('kpw:change',refresh);

  if(document.readyState!=='loading'){
    refresh();
    probeCustomer();
  }else{
    document.addEventListener('DOMContentLoaded',function(){
      refresh();
      probeCustomer();
    });
  }

  // -----------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------
  window.KPW={
    get:read,
    has:has,
    add:add,
    remove:remove,
    count:count,
    sync:sync,
    _debug:function(){return{customerCtx:customerCtx,list:read()}}
  };
})();
