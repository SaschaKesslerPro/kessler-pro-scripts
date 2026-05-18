/*!
 * Kessler PRO · wunschliste.js v1.2.1
 *
 * Changes vs v1.2.0:
 *   - FIX: Authorization header sends raw token (no Bearer prefix).
 *     Shopify Customer Account API expects raw shcat_* tokens despite token_type=bearer.
 *
 * Major changes vs v1.1.0:
 *   1. Token source switched: localStorage._sf_oauth_tokens.tokens.access_token
 *      (Shopyflow's getCustomer() only returns {id, email, tags} — no token —
 *       so we read OAuth tokens directly from where Shopyflow caches them.)
 *   2. Expiry-check via parsed.expiresAt (Date.now() comparison)
 *   3. storage-event listener for cross-tab reactive updates (logout / token refresh)
 *   4. Polling now scans localStorage instead of customer-object
 *   5. KPW._debug() exposes tokenInfo (expiresAt, msUntilExpiry, source) without
 *      leaking the access_token string itself
 *
 * Architecture:
 *   1. localStorage (kp_wl_v1) = source of truth for wishlist items
 *   2. Customer Account API Metafield (kessler.wishlist JSON) for cross-device sync
 *   3. Token acquired from localStorage._sf_oauth_tokens (Shopyflow OAuth cache)
 *   4. Universal-load (every page) for header counter
 *   5. DOM render only on .kp-wishlist-grid pages
 *
 * Public API unchanged: window.KPW = { get, has, add, remove, count, sync, _debug }
 * Toggle: window.__kpWlVerbose = false (before bootstrap) to silence console
 */
(function(){
  if(window.__kpWishlistV1)return;
  window.__kpWishlistV1=true;

  var KEY='kp_wl_v1';
  var TOKEN_STORAGE_KEY='_sf_oauth_tokens';
  var MF_NS='kessler';
  var MF_KEY='wishlist';
  var SYNC_DEBOUNCE=1500;
  var SHOP_ID_FALLBACK='100010033498';
  var API_VERSION='2024-10';

  // -----------------------------------------------------------------
  // Logging
  // -----------------------------------------------------------------
  var LOG_BUFFER_MAX=120;
  var logs=[];
  if(window.__kpWlVerbose===undefined)window.__kpWlVerbose=true;

  function log(tag,msg,data){
    var entry={t:new Date().toISOString().slice(11,23),tag:tag,msg:msg};
    if(data!==undefined){
      try{entry.data=JSON.parse(JSON.stringify(data))}catch(e){entry.data=String(data)}
    }
    logs.push(entry);
    if(logs.length>LOG_BUFFER_MAX)logs.shift();
    if(window.__kpWlVerbose){
      try{console.log('[KPW]['+tag+']',msg,data!==undefined?data:'')}catch(e){}
    }
  }

  log('boot','v1.2.1 starting');

  // -----------------------------------------------------------------
  // localStorage layer (wishlist items)
  // -----------------------------------------------------------------
  function read(){
    try{return JSON.parse(localStorage.getItem(KEY))||[]}catch(e){return[]}
  }
  function write(arr){
    try{localStorage.setItem(KEY,JSON.stringify(arr))}catch(e){
      log('storage','write-failed',{err:String(e)});
    }
  }
  function has(handle){
    return read().some(function(i){return i.h===handle});
  }
  function addItem(item){
    if(!item||!item.h)return false;
    var list=read();
    if(has(item.h))return false;
    item.t=item.t||Date.now();
    list.unshift(item);
    write(list);
    log('item','added',{h:item.h});
    emit();
    queueSync();
    return true;
  }
  function removeItem(handle){
    var before=read().length;
    var list=read().filter(function(i){return i.h!==handle});
    if(list.length===before)return false;
    write(list);
    log('item','removed',{h:handle});
    emit();
    queueSync();
    return true;
  }
  function count(){return read().length}

  function emit(){
    document.dispatchEvent(new CustomEvent('kpw:change',{detail:{items:read()}}));
  }

  // -----------------------------------------------------------------
  // OAuth token from Shopyflow's localStorage cache
  // -----------------------------------------------------------------
  function readSfTokens(){
    try{
      var raw=localStorage.getItem(TOKEN_STORAGE_KEY);
      if(!raw)return null;
      var parsed=JSON.parse(raw);
      if(!parsed||!parsed.tokens||!parsed.tokens.access_token)return null;
      var now=Date.now();
      var expiresAt=parsed.expiresAt||0;
      return {
        accessToken:parsed.tokens.access_token,
        tokenType:parsed.tokens.token_type||'bearer',
        refreshToken:parsed.tokens.refresh_token,
        expiresAt:expiresAt,
        expired:expiresAt>0&&now>=expiresAt,
        msUntilExpiry:expiresAt-now
      };
    }catch(e){
      log('storage','token-parse-fail',{err:String(e)});
      return null;
    }
  }

  // -----------------------------------------------------------------
  // Shopyflow runtime introspection (for shopId resolution + diagnostics)
  // -----------------------------------------------------------------
  function snapshotShopyflow(){
    var sf=window.shopyflow;
    if(!sf)return null;
    var snap={
      type:typeof sf,
      hasConfig:false,
      keys:[]
    };
    try{
      snap.keys=Object.keys(sf).slice(0,40);
      snap.hasConfig=!!sf.config;
      if(sf.config){
        snap.configKeys=Object.keys(sf.config).slice(0,20);
        var sid=sf.config.shopId||sf.config.shop_id||sf.config.shopID;
        if(sid){
          // shopId might be "gid://shopify/Shop/100010033498" — extract numeric
          var m=String(sid).match(/(\d+)$/);
          snap.shopId=m?m[1]:String(sid);
        }
      }
    }catch(e){snap.err=String(e)}
    return snap;
  }

  function resolveShopId(){
    try{
      var sf=window.shopyflow;
      if(sf&&sf.config){
        var sid=sf.config.shopId||sf.config.shop_id||sf.config.shopID;
        if(sid){
          // Extract trailing digits if it's a GID like "gid://shopify/Shop/100010033498"
          var m=String(sid).match(/(\d+)$/);
          if(m)return m[1];
        }
      }
    }catch(e){}
    return SHOP_ID_FALLBACK;
  }

  function gqlEndpoint(){
    return 'https://shopify.com/'+resolveShopId()+'/account/customer/api/'+API_VERSION+'/graphql';
  }

  // -----------------------------------------------------------------
  // GraphQL with telemetry
  // -----------------------------------------------------------------
  var customerCtx=null;
  var syncTimer=null;
  var pollTimer=null;
  var pollCount=0;
  var POLL_MAX=60; // 30s @ 500ms

  function gql(query,variables,token,opName){
    var ep=gqlEndpoint();
    log('gql',opName+' fetch start',{endpoint:ep,tokenPreview:token?token.slice(0,12)+'\u2026':'(none)'});
    return fetch(ep,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':token
      },
      body:JSON.stringify({query:query,variables:variables||{}})
    }).then(function(r){
      log('gql',opName+' http',{status:r.status,ok:r.ok});
      return r.text().then(function(txt){
        var preview=txt.slice(0,300);
        try{
          var json=JSON.parse(txt);
          if(json.errors)log('gql',opName+' errors',json.errors);
          return {ok:r.ok,status:r.status,json:json};
        }catch(e){
          log('gql',opName+' parse-fail',{preview:preview});
          return {ok:false,status:r.status,json:null,raw:preview};
        }
      });
    }).catch(function(e){
      log('gql',opName+' network-fail',{err:String(e)});
      return {ok:false,status:0,json:null,err:String(e)};
    });
  }

  function readMetafield(token){
    var q='query{customer{metafield(namespace:"'+MF_NS+'",key:"'+MF_KEY+'"){value}}}';
    return gql(q,null,token,'readMF').then(function(res){
      try{
        var v=res.json&&res.json.data&&res.json.data.customer&&res.json.data.customer.metafield&&res.json.data.customer.metafield.value;
        var list=v?JSON.parse(v):[];
        log('mf','read ok',{count:list.length});
        return list;
      }catch(e){
        log('mf','read parse-fail',{err:String(e)});
        return [];
      }
    });
  }

  function writeMetafield(token,list){
    var q='mutation($v:String!){metafieldsSet(metafields:[{namespace:"'+MF_NS+'",key:"'+MF_KEY+'",type:"json",value:$v}]){userErrors{message field}}}';
    return gql(q,{v:JSON.stringify(list)},token,'writeMF').then(function(res){
      try{
        var ue=res.json&&res.json.data&&res.json.data.metafieldsSet&&res.json.data.metafieldsSet.userErrors;
        if(ue&&ue.length)log('mf','write userErrors',ue);
        else if(res.ok)log('mf','write ok',{count:list.length});
      }catch(e){log('mf','write check-fail',{err:String(e)})}
      return res;
    });
  }

  function mergeNewer(a,b){
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

  function refreshTokenFromStorage(){
    // Re-read token from storage in case it rotated (e.g. silent refresh)
    var sfToken=readSfTokens();
    if(!sfToken){
      if(customerCtx){
        log('ctx','token disappeared from storage — clearing customerCtx');
        customerCtx=null;
      }
      return false;
    }
    if(sfToken.expired){
      log('ctx','token expired in storage',{expiresAt:sfToken.expiresAt});
      customerCtx=null;
      return false;
    }
    if(!customerCtx){
      customerCtx={token:sfToken.accessToken,source:'storage-fresh',expiresAt:sfToken.expiresAt};
    }else if(customerCtx.token!==sfToken.accessToken){
      log('ctx','token rotated, updating customerCtx');
      customerCtx.token=sfToken.accessToken;
      customerCtx.expiresAt=sfToken.expiresAt;
    }
    return true;
  }

  function sync(){
    if(!refreshTokenFromStorage()){
      log('sync','skipped \u2014 no valid token');
      return Promise.resolve(false);
    }
    log('sync','start',{msUntilExpiry:customerCtx.expiresAt-Date.now()});
    var local=read();
    return readMetafield(customerCtx.token).then(function(remote){
      var merged=mergeNewer(local,remote);
      var changed=merged.length!==local.length;
      if(changed){
        write(merged);
        emit();
        log('sync','local updated from remote',{newCount:merged.length});
      }
      return writeMetafield(customerCtx.token,merged).then(function(){
        log('sync','complete');
        return true;
      });
    }).catch(function(e){
      log('sync','threw',{err:String(e)});
      return false;
    });
  }

  function queueSync(){
    if(!customerCtx){
      var sfToken=readSfTokens();
      if(sfToken&&!sfToken.expired){
        customerCtx={token:sfToken.accessToken,source:'queueSync-pickup',expiresAt:sfToken.expiresAt};
        log('ctx','token picked up at queueSync');
      }else{
        log('sync','queueSync skipped \u2014 no token in storage');
        return;
      }
    }
    if(syncTimer)clearTimeout(syncTimer);
    syncTimer=setTimeout(function(){syncTimer=null;sync()},SYNC_DEBOUNCE);
  }

  // -----------------------------------------------------------------
  // Customer detection: storage poll + storage-event + legacy events
  // -----------------------------------------------------------------

  function pollProbe(){
    pollCount++;
    var sfToken=readSfTokens();
    if(!sfToken){
      if(pollCount===1||pollCount%10===0)log('poll','no oauth tokens in localStorage',{tick:pollCount});
      return;
    }
    if(sfToken.expired){
      if(pollCount===1||pollCount%10===0)log('poll','token expired in storage',{tick:pollCount,expiresAt:sfToken.expiresAt});
      return;
    }
    if(customerCtx&&customerCtx.token===sfToken.accessToken){
      // already have it
      stopPolling();
      return;
    }
    log('poll','token acquired from localStorage',{
      source:'poll',
      tick:pollCount,
      msUntilExpiry:sfToken.msUntilExpiry,
      tokenPreview:sfToken.accessToken.slice(0,12)+'\u2026'
    });
    customerCtx={token:sfToken.accessToken,source:'localStorage',expiresAt:sfToken.expiresAt};
    sync();
    stopPolling();
  }

  function startPolling(){
    if(pollTimer)return;
    pollTimer=setInterval(function(){
      if(pollCount>=POLL_MAX){stopPolling();return}
      pollProbe();
    },500);
    log('poll','started (500ms \u00d7 60 = 30s, watching localStorage)');
    // also probe immediately on start
    pollProbe();
  }

  function stopPolling(){
    if(pollTimer){
      clearInterval(pollTimer);
      pollTimer=null;
      log('poll','stopped',{tick:pollCount});
    }
  }

  // Cross-tab reactive: storage event fires when ANOTHER tab modifies localStorage
  function onStorageEvent(e){
    if(e.key!==TOKEN_STORAGE_KEY)return;
    log('storage-event','_sf_oauth_tokens changed in another tab');
    var sfToken=readSfTokens();
    if(sfToken&&!sfToken.expired){
      customerCtx={token:sfToken.accessToken,source:'storage-event',expiresAt:sfToken.expiresAt};
      log('storage-event','token acquired, syncing');
      sync();
    }else if(!sfToken){
      log('storage-event','tokens cleared (logout in another tab)');
      customerCtx=null;
    }
  }
  window.addEventListener('storage',onStorageEvent);

  // Legacy event listeners (kept for future compatibility — won't hurt if never fires)
  var LOGIN_EVENTS=[
    'shopyflow:customer-login','shopyflow:login','sf-customer-login',
    'shopyflow:customer:login','shopyflow:auth:login','sf:customer-login',
    'customer:login','customer-login','sf-login','login',
    'shopyflow:ready','shopyflow:init','shopyflow:customer-ready'
  ];
  var LOGOUT_EVENTS=[
    'shopyflow:customer-logout','shopyflow:logout','sf-customer-logout',
    'shopyflow:customer:logout','shopyflow:auth:logout','sf:customer-logout',
    'customer:logout','customer-logout','sf-logout','logout'
  ];

  function onLoginEvent(ev){
    log('event','fired: '+ev.type);
    // Don't trust event payload anymore — always re-read from storage
    var sfToken=readSfTokens();
    if(sfToken&&!sfToken.expired){
      customerCtx={token:sfToken.accessToken,source:'event:'+ev.type,expiresAt:sfToken.expiresAt};
      sync();
      stopPolling();
    }
  }

  function onLogoutEvent(ev){
    log('event','logout: '+ev.type);
    customerCtx=null;
  }

  LOGIN_EVENTS.forEach(function(ev){
    document.addEventListener(ev,onLoginEvent);
    window.addEventListener(ev,onLoginEvent);
  });
  LOGOUT_EVENTS.forEach(function(ev){
    document.addEventListener(ev,onLogoutEvent);
    window.addEventListener(ev,onLogoutEvent);
  });

  // -----------------------------------------------------------------
  // DOM rendering (wishlist page only)
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
    if(!tpl.dataset.kpTpl){
      tpl.dataset.kpTpl='1';
      tpl.style.display='none';
    }
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
          removeItem(item.h);
        });
      }
      grid.appendChild(card);
    });
  }

  function setCounter(){
    var n=count();
    document.querySelectorAll('[data-mobile-icon="wishlist"] .kp-icon-counter, .kp-wishlist-counter').forEach(function(c){
      c.textContent=n||'';
    });
  }

  // Universal toggle button (PDP/PLP heart icons, Phase 8)
  document.addEventListener('click',function(e){
    var btn=e.target.closest('[data-kp-wl-add]');
    if(!btn)return;
    e.preventDefault();
    e.stopPropagation();
    var d=btn.dataset;
    if(!d.handle)return;
    if(has(d.handle)){
      removeItem(d.handle);
      btn.classList.remove('is-active');
    }else{
      addItem({h:d.handle,n:d.name,s:d.specs,p:d.price,r:d.rating});
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

  function refresh(){
    setCounter();
    renderPage();
    syncToggleStates();
  }

  document.addEventListener('kpw:change',refresh);

  function init(){
    refresh();
    log('boot','DOM ready, starting polling');
    startPolling();
  }

  if(document.readyState!=='loading')init();
  else document.addEventListener('DOMContentLoaded',init);

  window.KPW={
    get:read,
    has:has,
    add:addItem,
    remove:removeItem,
    count:count,
    sync:sync,
    _debug:function(){
      var sfToken=readSfTokens();
      return{
        version:'1.2.1',
        customerCtx:customerCtx?{
          source:customerCtx.source,
          tokenPreview:customerCtx.token.slice(0,12)+'\u2026',
          expiresAt:customerCtx.expiresAt,
          msUntilExpiry:customerCtx.expiresAt-Date.now()
        }:null,
        sfToken:sfToken?{
          tokenType:sfToken.tokenType,
          expiresAt:sfToken.expiresAt,
          msUntilExpiry:sfToken.msUntilExpiry,
          expired:sfToken.expired,
          tokenLen:sfToken.accessToken.length
        }:null,
        list:read(),
        logs:logs.slice(),
        shopyflow:snapshotShopyflow(),
        resolvedEndpoint:gqlEndpoint(),
        pollState:{tick:pollCount,active:!!pollTimer}
      }
    }
  };
  log('boot','init complete');
})();
