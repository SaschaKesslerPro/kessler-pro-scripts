/*!
 * Kessler PRO · wunschliste.js v1.1.0 — Diagnose-Pass
 *
 * Changes vs v1.0.0:
 *   1. Console-logging mit [KPW] prefix + 120-entry log-buffer in KPW._debug()
 *   2. Authorization header gets "Bearer " prefix (was: raw token)
 *   3. Customer-detection: 3 strategies in parallel — events (12 names) + polling
 *      window.shopyflow (500ms × 60 ticks = 30s) + window.shopyflow.config snapshot
 *   4. Shop-ID resolution: tries window.shopyflow.config.shopId first, falls back
 *      to hardcoded 100010033498
 *   5. GraphQL fetch wrapper logs status + parses errors + 300-char body preview
 *      on parse-fail
 *   6. KPW._debug() now returns {version, customerCtx, list, logs, shopyflow,
 *      resolvedEndpoint, pollState}
 *
 * Toggle: window.__kpWlVerbose = false   // before bootstrap loads, to silence console
 *
 * Public API unchanged: window.KPW = { get, has, add, remove, count, sync, _debug }
 */
(function(){
  if(window.__kpWishlistV1)return;
  window.__kpWishlistV1=true;

  var KEY='kp_wl_v1';
  var MF_NS='kessler';
  var MF_KEY='wishlist';
  var SYNC_DEBOUNCE=1500;
  var SHOP_ID_FALLBACK='100010033498';
  var API_VERSION='2024-10';

  // -----------------------------------------------------------------
  // Diagnostic logging
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

  log('boot','v1.1.0 starting');

  // -----------------------------------------------------------------
  // localStorage layer
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
  // Shopyflow runtime introspection
  // -----------------------------------------------------------------
  var customerCtx=null;
  var syncTimer=null;
  var pollTimer=null;
  var pollCount=0;
  var POLL_MAX=60; // 30s @ 500ms

  function snapshotShopyflow(){
    var sf=window.shopyflow;
    if(!sf)return null;
    var snap={
      type:typeof sf,
      keys:[],
      hasCustomer:false,
      hasConfig:false,
      hasGetCustomer:false
    };
    try{
      snap.keys=Object.keys(sf).slice(0,30);
      snap.hasCustomer=!!sf.customer;
      snap.hasConfig=!!sf.config;
      snap.hasGetCustomer=typeof sf.getCustomer==='function';
      if(sf.customer){
        snap.customerKeys=Object.keys(sf.customer).slice(0,20);
        snap.customerHasToken=!!(sf.customer.accessToken||sf.customer.token||sf.customer.customerAccessToken||sf.customer.access_token);
      }
      if(sf.config){
        snap.configKeys=Object.keys(sf.config).slice(0,20);
        snap.shopId=sf.config.shopId||sf.config.shop_id||sf.config.shopID||null;
      }
    }catch(e){snap.err=String(e)}
    return snap;
  }

  function resolveShopId(){
    try{
      var sf=window.shopyflow;
      if(sf&&sf.config){
        var id=sf.config.shopId||sf.config.shop_id||sf.config.shopID;
        if(id)return String(id);
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
  function gql(query,variables,token,opName){
    var ep=gqlEndpoint();
    log('gql',opName+' fetch start',{endpoint:ep,tokenPreview:token?token.slice(0,12)+'\u2026':'(none)'});
    return fetch(ep,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer '+token
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

  function sync(){
    if(!customerCtx||!customerCtx.token){
      log('sync','skipped \u2014 no customerCtx');
      return Promise.resolve(false);
    }
    log('sync','start');
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
    if(!customerCtx){log('sync','queueSync skipped \u2014 no ctx');return}
    if(syncTimer)clearTimeout(syncTimer);
    syncTimer=setTimeout(function(){syncTimer=null;sync()},SYNC_DEBOUNCE);
  }

  // -----------------------------------------------------------------
  // Customer-login detection: events + polling in parallel
  // -----------------------------------------------------------------
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

  function extractToken(payload){
    if(!payload)return null;
    var c=payload.detail||payload;
    if(!c||typeof c!=='object')return null;
    var token=c.accessToken||c.token||c.customerAccessToken||c.access_token;
    if(token)return token;
    if(c.customer){
      token=c.customer.accessToken||c.customer.token||c.customer.customerAccessToken||c.customer.access_token;
      if(token)return token;
    }
    if(c.data){
      token=c.data.accessToken||c.data.token||c.data.customerAccessToken;
      if(token)return token;
    }
    return null;
  }

  function describePayload(payload){
    if(!payload)return null;
    var c=payload.detail||payload;
    if(!c)return {empty:true};
    try{
      return {
        topKeys:Object.keys(c).slice(0,15),
        hasCustomer:!!c.customer,
        customerKeys:c.customer?Object.keys(c.customer).slice(0,15):null,
        tokenFound:!!extractToken(payload)
      };
    }catch(e){return {err:String(e)}}
  }

  function onLoginEvent(ev){
    log('event','fired: '+ev.type,describePayload(ev));
    var token=extractToken(ev);
    if(token){
      log('event','token acquired',{from:ev.type});
      customerCtx={token:token,source:ev.type};
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

  // Polling for window.shopyflow
  function pollProbe(){
    pollCount++;
    var sf=window.shopyflow;
    if(!sf){
      if(pollCount===1||pollCount%10===0)log('poll','no window.shopyflow yet',{tick:pollCount});
      return;
    }
    if(!window.__kpSfSnapped){
      window.__kpSfSnapped=true;
      log('poll','first shopyflow snapshot',snapshotShopyflow());
    }
    var customer=null;
    try{
      if(typeof sf.getCustomer==='function'){
        customer=sf.getCustomer();
        if(customer&&typeof customer.then==='function'){
          customer.then(function(c){processCustomer(c,'getCustomer-promise')}).catch(function(){});
          return;
        }
      }else if(sf.customer){
        customer=sf.customer;
      }
    }catch(e){log('poll','introspect err',{err:String(e)})}
    if(customer)processCustomer(customer,'poll');
  }

  function processCustomer(customer,source){
    if(!customer)return;
    var token=customer.accessToken||customer.token||customer.customerAccessToken||customer.access_token;
    if(!token){
      if(!window.__kpNoTokenLogged){
        window.__kpNoTokenLogged=true;
        log('poll','customer present but no token field',{
          source:source,
          keys:Object.keys(customer).slice(0,15)
        });
      }
      return;
    }
    if(customerCtx&&customerCtx.token===token)return;
    log('poll','token acquired',{source:source});
    customerCtx={token:token,source:source};
    sync();
    stopPolling();
  }

  function startPolling(){
    if(pollTimer)return;
    pollTimer=setInterval(function(){
      if(pollCount>=POLL_MAX){stopPolling();return}
      pollProbe();
    },500);
    log('poll','started (500ms \u00d7 60 = 30s)');
  }

  function stopPolling(){
    if(pollTimer){
      clearInterval(pollTimer);
      pollTimer=null;
      log('poll','stopped',{tick:pollCount});
    }
  }

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
      return{
        version:'1.1.0',
        customerCtx:customerCtx,
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
