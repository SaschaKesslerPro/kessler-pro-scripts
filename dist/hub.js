/*!
 * Kessler PRO · hub.js v1.0.0
 *
 * Phase 8.1 MVP — Customer-Data Hydration für Account-Pages.
 *
 * Scope v1.0.0:
 *   - Bootstrap + Auth-Token-Acquisition (mirror wunschliste.js pattern)
 *   - Single Customer-Query (firstName/lastName/emailAddress)
 *   - 3 DOM-Bindings via data-kph-bind:
 *       * greeting → Heading komplett-Replace mit Fallback
 *       * email    → Schwarze Card Email-Span
 *       * avatar   → Header Avatar-Initial (email[0].toUpperCase())
 *   - Loading / Ready / Error CSS-States via .kph-loading / .kph-ready / .kph-error
 *
 * Public API: window.KPH = { version, refresh, _debug }
 * Verbose toggle: window.__kpHubVerbose = false (before bootstrap) silences console.
 *
 * Future scope (Phase 8.2+):
 *   - data-kph-count="orders|wishlist|addresses"   → numeric counters
 *   - data-kph-card="order-current"                → aktuelle Bestellung
 *   - data-kph-list="orders" + data-kph-tpl=…      → Order-Liste
 *   - data-kph-show-if="orders.empty"              → Empty-State-Conditional
 *   - data-kph-action="logout"                     → Logout-Trigger
 */
(function(){
  if(window.__KPH_INIT)return;
  window.__KPH_INIT=true;

  var VERSION='1.0.0';
  var TOKEN_STORAGE_KEY='_sf_oauth_tokens';
  var SHOP_ID_FALLBACK='100010033498';
  var API_VERSION='2024-10';
  var POLL_INTERVAL_MS=500;
  var POLL_MAX=60; // 30s @ 500ms

  // -----------------------------------------------------------------
  // Logging
  // -----------------------------------------------------------------
  var LOG_BUFFER_MAX=120;
  var logs=[];
  if(window.__kpHubVerbose===undefined)window.__kpHubVerbose=true;

  function log(tag,msg,data){
    var entry={t:new Date().toISOString().slice(11,23),tag:tag,msg:msg};
    if(data!==undefined){
      try{entry.data=JSON.parse(JSON.stringify(data))}catch(e){entry.data=String(data)}
    }
    logs.push(entry);
    if(logs.length>LOG_BUFFER_MAX)logs.shift();
    if(window.__kpHubVerbose){
      try{console.log('[KPH]['+tag+']',msg,data!==undefined?data:'')}catch(e){}
    }
  }

  log('boot','v'+VERSION+' starting');

  // -----------------------------------------------------------------
  // OAuth token from Shopyflow's localStorage cache
  // (RAW token in Authorization header — no 'Bearer ' prefix)
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
        expiresAt:expiresAt,
        expired:expiresAt>0&&now>=expiresAt,
        msUntilExpiry:expiresAt-now
      };
    }catch(e){
      log('storage','token-parse-fail',{err:String(e)});
      return null;
    }
  }

  function resolveShopId(){
    try{
      var sf=window.shopyflow;
      if(sf&&sf.config){
        var sid=sf.config.shopId||sf.config.shop_id||sf.config.shopID;
        if(sid){
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
  function gql(query,token,opName){
    var ep=gqlEndpoint();
    log('gql',opName+' fetch start',{endpoint:ep,tokenPreview:token?token.slice(0,12)+'\u2026':'(none)'});
    return fetch(ep,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':token
      },
      body:JSON.stringify({query:query})
    }).then(function(r){
      log('gql',opName+' http',{status:r.status,ok:r.ok});
      return r.text().then(function(txt){
        try{
          var json=JSON.parse(txt);
          if(json.errors)log('gql',opName+' errors',json.errors);
          return {ok:r.ok,status:r.status,json:json};
        }catch(e){
          log('gql',opName+' parse-fail',{preview:txt.slice(0,300)});
          return {ok:false,status:r.status,json:null};
        }
      });
    }).catch(function(e){
      log('gql',opName+' network-fail',{err:String(e)});
      return {ok:false,status:0,json:null,err:String(e)};
    });
  }

  // Phase 8.1 query — minimal customer fields
  var CUSTOMER_QUERY_V1='{customer{id firstName lastName displayName emailAddress{emailAddress}}}';

  function fetchCustomer(token){
    return gql(CUSTOMER_QUERY_V1,token,'fetchCustomer').then(function(res){
      if(!res.ok)return null;
      var c=res.json&&res.json.data&&res.json.data.customer;
      if(!c){
        log('parse','no customer in response',res.json);
        return null;
      }
      log('parse','customer ok',{
        fields:Object.keys(c),
        firstName:c.firstName,
        hasEmail:!!(c.emailAddress&&c.emailAddress.emailAddress)
      });
      return c;
    });
  }

  // -----------------------------------------------------------------
  // Binding resolvers
  // -----------------------------------------------------------------
  var bindings={
    greeting:function(c){
      var fn=c&&c.firstName;
      return fn?'Willkommen zur\u00fcck, '+fn+'.':'Sch\u00f6n dich zu sehen.';
    },
    email:function(c){
      return c&&c.emailAddress&&c.emailAddress.emailAddress||'';
    },
    avatar:function(c){
      var em=c&&c.emailAddress&&c.emailAddress.emailAddress;
      return em?em[0].toUpperCase():'?';
    }
  };

  // -----------------------------------------------------------------
  // DOM rendering
  // -----------------------------------------------------------------
  function setStateClass(state){
    var nodes=document.querySelectorAll('[data-kph-bind]');
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      el.classList.remove('kph-loading','kph-ready','kph-error');
      el.classList.add('kph-'+state);
    }
  }

  function render(customer){
    var nodes=document.querySelectorAll('[data-kph-bind]');
    log('render','nodes found',{count:nodes.length});
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      var key=el.getAttribute('data-kph-bind');
      var resolver=bindings[key];
      if(!resolver){
        log('render','no resolver for key',{key:key});
        continue;
      }
      try{
        var val=resolver(customer);
        el.textContent=val;
        log('render',key+'="'+val+'"');
      }catch(e){
        log('render','resolver-fail',{key:key,err:String(e)});
      }
    }
    setStateClass('ready');
  }

  // -----------------------------------------------------------------
  // Init flow with token polling
  // -----------------------------------------------------------------
  var customerCtx=null;
  var pollCount=0;
  var pollTimer=null;
  var startTs=0;

  function attemptInit(){
    pollCount++;
    var tok=readSfTokens();
    if(tok&&!tok.expired&&tok.accessToken){
      clearInterval(pollTimer);pollTimer=null;
      log('auth','token acquired',{
        attempts:pollCount,
        elapsedMs:Date.now()-startTs,
        msUntilExpiry:tok.msUntilExpiry
      });
      return fetchCustomer(tok.accessToken).then(function(c){
        if(!c){
          log('init','customer null \u2014 setting error state');
          setStateClass('error');
          return;
        }
        customerCtx=c;
        render(c);
        log('done','init complete in '+(Date.now()-startTs)+'ms');
      });
    }
    if(pollCount>=POLL_MAX){
      clearInterval(pollTimer);pollTimer=null;
      log('auth','token timeout after '+(POLL_MAX*POLL_INTERVAL_MS)+'ms',{attempts:pollCount});
      setStateClass('error');
      return;
    }
  }

  function init(){
    startTs=Date.now();
    pollCount=0;
    setStateClass('loading');
    // First attempt immediate
    attemptInit();
    // Subsequent attempts every POLL_INTERVAL_MS
    if(!customerCtx&&!pollTimer){
      pollTimer=setInterval(attemptInit,POLL_INTERVAL_MS);
    }
  }

  // -----------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------
  window.KPH={
    version:VERSION,
    refresh:function(){
      log('api','refresh called');
      customerCtx=null;
      init();
    },
    _debug:function(){
      var tok=readSfTokens();
      return {
        version:VERSION,
        customerCtx:customerCtx,
        sfToken:tok?{
          present:true,
          expired:tok.expired,
          msUntilExpiry:tok.msUntilExpiry
        }:{present:false},
        endpoint:gqlEndpoint(),
        logs:logs.slice(-50)
      };
    }
  };

  // -----------------------------------------------------------------
  // Start
  // -----------------------------------------------------------------
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  }else{
    init();
  }
})();
