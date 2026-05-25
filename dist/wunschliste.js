/*!
 * Kessler PRO · wunschliste.js v1.2.5
 *
 * Changes vs v1.2.4:
 *   - NEW: dynamic count label rendering on the wishlist page. Any element
 *     with [data-kpw-bind="count-label"] receives a freshly formatted
 *     "{N} Stück gespeichert · sortiert nach zuletzt hinzugefügt" string
 *     (proper singular/plural). At count=0 the element is hidden via
 *     display:none so the empty-state replaces it entirely.
 *
 * Changes vs v1.2.3:
 *   - FIX (CRITICAL): removeItem() was non-persistent. mergeNewer(local, remote)
 *     was a pure union — items removed locally were re-added from remote on the
 *     next sync. Now uses a tombstone pattern: removeItem writes {h,t,d:true}
 *     to localStorage instead of dropping the entry. Tombstones propagate to
 *     remote via writeMetafield so cross-device removes work too. mergeNewer
 *     GC-expires tombstones older than 30 days.
 *   - Storage format is backward compatible: existing live items without a `d`
 *     field continue to be treated as live. No migration required.
 *   - Internal helpers: live() returns the filtered live-only list. read() still
 *     returns the raw list (including tombstones) for sync transport.
 *
 * Changes vs v1.2.2:
 *   - FIX: Auth-state visibility toggle. Shopyflow doesn't set
 *     body[_sf-logged-in] / body[_sf-logged-out] for Shopify-hosted OAuth
 *     logins. We set these ourselves based on localStorage token presence,
 *     and inject CSS to hide the wrong .sf-logged-in/.sf-logged-out variant.
 *     Restores Avatar/Heart visibility for logged-in customers.
 *   - FIX: Race-condition first-write. If first sync runs before
 *     shopyflow.getCustomer() returns customer object, writeMF was skipped.
 *     Now scheduled retry-sync 3s later (one retry max per page lifecycle).
 *
 * Changes vs v1.2.1:
 *   - FIX: metafieldsSet mutation now includes ownerId (Customer GID).
 *     Required by Customer Account API metafieldsSet schema.
 *   - userErrors selection now includes 'code' field for clearer diagnostics.
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

  log('boot','v1.2.5 starting');

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
  // Live = non-tombstoned entries. Public-facing operations use this view.
  function live(){
    return read().filter(function(i){return i&&!i.d});
  }
  function has(handle){
    return read().some(function(i){return i.h===handle&&!i.d});
  }
  function addItem(item){
    if(!item||!item.h)return false;
    var raw=read();
    // Strip any prior entry (live OR tombstone) for this handle, then push fresh.
    var filtered=raw.filter(function(i){return i.h!==item.h});
    // If there was already a live entry, treat as no-op (preserve old behaviour).
    if(filtered.length!==raw.length){
      var hadLive=raw.some(function(i){return i.h===item.h&&!i.d});
      if(hadLive)return false;
    }
    item.t=item.t||Date.now();
    delete item.d;
    filtered.unshift(item);
    write(filtered);
    log('item','added',{h:item.h});
    emit();
    queueSync();
    return true;
  }
  function removeItem(handle){
    var raw=read();
    var hadLive=raw.some(function(i){return i.h===handle&&!i.d});
    if(!hadLive)return false;
    // Replace any entry for this handle with a tombstone {h,t,d:true}.
    var filtered=raw.filter(function(i){return i.h!==handle});
    filtered.push({h:handle,t:Date.now(),d:true});
    write(filtered);
    log('item','removed',{h:handle});
    emit();
    queueSync();
    return true;
  }
  function count(){return live().length}

  function emit(){
    document.dispatchEvent(new CustomEvent('kpw:change',{detail:{items:live()}}));
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

  function getCustomerGid(){
    try{
      if(window.shopyflow&&typeof window.shopyflow.getCustomer==='function'){
        var cust=window.shopyflow.getCustomer();
        if(cust&&cust.id)return cust.id;
      }
    }catch(e){}
    return null;
  }

  // -----------------------------------------------------------------
  // Auth-state body attribute management (Shopyflow compat shim)
  // -----------------------------------------------------------------
  // Shopyflow's docs convention is body[_sf-logged-in] / body[_sf-logged-out]
  // attributes which toggle visibility of .sf-logged-in / .sf-logged-out
  // elements via CSS. However Shopyflow does NOT set these attributes when
  // login happens via Shopify-hosted OAuth (Customer Account API).
  // We set them ourselves based on our authoritative source: localStorage
  // token presence + expiry.
  function injectAuthCSS(){
    if(document.getElementById('kp-auth-css'))return;
    var s=document.createElement('style');
    s.id='kp-auth-css';
    s.textContent='body[_sf-logged-in] .sf-logged-out{display:none!important}body[_sf-logged-out] .sf-logged-in{display:none!important}';
    (document.head||document.documentElement).appendChild(s);
  }
  function setAuthBody(loggedIn){
    try{
      var b=document.body;
      if(!b)return;
      if(loggedIn){
        b.setAttribute('_sf-logged-in','');
        b.removeAttribute('_sf-logged-out');
      }else{
        b.setAttribute('_sf-logged-out','');
        b.removeAttribute('_sf-logged-in');
      }
    }catch(e){}
  }
  function evalAuthState(){
    var t=readSfTokens();
    return !!(t&&!t.expired&&t.accessToken);
  }



  // -----------------------------------------------------------------
  // GraphQL with telemetry
  // -----------------------------------------------------------------
  var customerCtx=null;
  var syncTimer=null;
  var pollTimer=null;
  var pollCount=0;
  var POLL_MAX=60; // 30s @ 500ms
  var writeRetryTimer=null;
  var writeRetryUsed=false;

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
        var liveN=list.filter(function(i){return i&&!i.d}).length;
        var tombN=list.length-liveN;
        log('mf','read ok',{count:list.length,live:liveN,tombstones:tombN});
        return list;
      }catch(e){
        log('mf','read parse-fail',{err:String(e)});
        return [];
      }
    });
  }

  function writeMetafield(token,list){
    var ownerId=getCustomerGid();
    if(!ownerId){
      log('mf','write skipped \u2014 no customer GID available');
      return Promise.resolve({ok:false,status:0,json:null,skippedNoGid:true});
    }
    log('mf','write start',{ownerId:ownerId});
    var q='mutation($v:String!,$oid:ID!){metafieldsSet(metafields:[{namespace:"'+MF_NS+'",key:"'+MF_KEY+'",type:"json",ownerId:$oid,value:$v}]){userErrors{message field code}}}';
    return gql(q,{v:JSON.stringify(list),oid:ownerId},token,'writeMF').then(function(res){
      try{
        var ue=res.json&&res.json.data&&res.json.data.metafieldsSet&&res.json.data.metafieldsSet.userErrors;
        if(ue&&ue.length)log('mf','write userErrors',ue);
        else if(res.ok){
          var liveN=list.filter(function(i){return i&&!i.d}).length;
          var tombN=list.length-liveN;
          log('mf','write ok',{count:list.length,live:liveN,tombstones:tombN});
        }
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
    var TOMBSTONE_TTL_MS=30*24*3600*1000;
    var now=Date.now();
    var out=Object.keys(map).map(function(k){return map[k]}).filter(function(i){
      // Drop tombstones older than TTL — GC step
      if(i&&i.d){
        return (now-(i.t||0))<TOMBSTONE_TTL_MS;
      }
      return true;
    });
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
      return writeMetafield(customerCtx.token,merged).then(function(wRes){
        if(wRes&&wRes.skippedNoGid&&!writeRetryUsed&&!writeRetryTimer){
          writeRetryUsed=true;
          log('sync','scheduling retry in 3s \u2014 waiting for customer GID');
          writeRetryTimer=setTimeout(function(){
            writeRetryTimer=null;
            log('sync','retry firing (GID was missing earlier)');
            sync();
          },3000);
        }
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
    setAuthBody(true);
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
      setAuthBody(true);
      log('storage-event','token acquired, syncing');
      sync();
    }else if(!sfToken){
      log('storage-event','tokens cleared (logout in another tab)');
      customerCtx=null;
      setAuthBody(false);
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
      setAuthBody(true);
      sync();
      stopPolling();
    }
  }

  function onLogoutEvent(ev){
    log('event','logout: '+ev.type);
    customerCtx=null;
    setAuthBody(false);
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
    var list=live();
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

  function renderCountLabel(){
    var n=count();
    var nodes=document.querySelectorAll('[data-kpw-bind="count-label"]');
    if(!nodes.length)return;
    var label='';
    if(n===1)label='1 Stück gespeichert \u00b7 sortiert nach zuletzt hinzugef\u00fcgt';
    else if(n>1)label=n+' St\u00fccke gespeichert \u00b7 sortiert nach zuletzt hinzugef\u00fcgt';
    Array.prototype.slice.call(nodes).forEach(function(el){
      el.textContent=label;
      el.style.display=n>0?'':'none';
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
    renderCountLabel();
    renderPage();
    syncToggleStates();
  }

  document.addEventListener('kpw:change',refresh);

  function init(){
    injectAuthCSS();
    setAuthBody(evalAuthState());
    refresh();
    log('boot','DOM ready, starting polling');
    startPolling();
  }

  if(document.readyState!=='loading')init();
  else document.addEventListener('DOMContentLoaded',init);

  window.KPW={
    get:live,
    has:has,
    add:addItem,
    remove:removeItem,
    count:count,
    sync:sync,
    _debug:function(){
      var sfToken=readSfTokens();
      var raw=read();
      var liveN=raw.filter(function(i){return i&&!i.d}).length;
      return{
        version:'1.2.5',
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
        liveCount:liveN,
        tombstoneCount:raw.length-liveN,
        list:raw,
        logs:logs.slice(),
        shopyflow:snapshotShopyflow(),
        resolvedEndpoint:gqlEndpoint(),
        pollState:{tick:pollCount,active:!!pollTimer}
      }
    }
  };
  log('boot','init complete');
})();
