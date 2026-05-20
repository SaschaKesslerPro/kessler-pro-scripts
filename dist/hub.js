/*!
 * Kessler PRO · hub.js v1.1.2
 *
 * Phase 8.2 — Customer-Data Hydration mit Numeric Counters.
 *
 * v1.1.2 Patch (Δ gegen v1.1.1):
 *   + init() prüft jetzt auch fetchInFlight, bevor das Polling-Interval startet.
 *     v1.1.1 hatte den Guard nur in attemptInit() — Polling wurde trotzdem started
 *     und feuerte 500ms später ein zweites attemptInit, das nach Promise-Resolve
 *     fetchInFlight=false sah und einen 2. fetchCustomer Call auslöste.
 *
 * v1.1.1 Patch (unverändert):
 *   + fetchInFlight Guard in attemptInit() verhindert Re-Entry während Promise pending.
 *
 * Scope v1.1.0 (unverändert):
 *   + 3 DOM-Counts via data-kph-count:
 *       * orders    → customer.orders.nodes.length
 *       * wishlist  → JSON.parse(metafield.value).length
 *       * addresses → customer.addresses.nodes.length
 *     mit Singular/Plural-Label und Empty-State-Text aus countLabels.
 *   + Customer-Query erweitert um orders/addresses (id-only) + wishlist metafield.
 *   + STATE_SELECTOR jetzt '[data-kph-bind],[data-kph-count]' (loading/ready/error
 *     greift auch auf Count-Slots).
 *
 * Unverändert aus v1.0.0:
 *   - Bootstrap + Auth-Token-Acquisition (mirror wunschliste.js pattern)
 *   - 3 DOM-Bindings via data-kph-bind: greeting / email / avatar
 *   - Public API: window.KPH = { version, refresh, _debug }
 *   - Verbose toggle: window.__kpHubVerbose = false silences console.
 *
 * Future scope (Phase 8.3+):
 *   - data-kph-card="order-current"                → aktuelle Bestellung
 *   - data-kph-list="orders" + data-kph-tpl=…      → Order-Liste
 *   - data-kph-show-if="orders.empty"              → Empty-State-Conditional
 *   - data-kph-action="logout"                     → Logout-Trigger
 */
(function(){
  if(window.__KPH_INIT)return;
  window.__KPH_INIT=true;

  var VERSION='1.1.2';
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

  // Phase 8.2 query — customer + counts (id-only sub-selection minimizes cost)
  var CUSTOMER_QUERY_V11='{customer{'+
    'id firstName lastName displayName '+
    'emailAddress{emailAddress} '+
    'addresses(first:20){nodes{id}} '+
    'orders(first:50,sortKey:PROCESSED_AT,reverse:true){nodes{id}} '+
    'metafield(namespace:"kessler",key:"wishlist"){value}'+
  '}}';

  function fetchCustomer(token){
    return gql(CUSTOMER_QUERY_V11,token,'fetchCustomer').then(function(res){
      if(!res.ok)return null;
      var c=res.json&&res.json.data&&res.json.data.customer;
      if(!c){
        log('parse','no customer in response',res.json);
        return null;
      }
      log('parse','customer ok',{
        fields:Object.keys(c),
        firstName:c.firstName,
        hasEmail:!!(c.emailAddress&&c.emailAddress.emailAddress),
        ordersLen:c.orders&&c.orders.nodes?c.orders.nodes.length:0,
        addressesLen:c.addresses&&c.addresses.nodes?c.addresses.nodes.length:0,
        hasWishlistMf:!!(c.metafield&&c.metafield.value)
      });
      return c;
    });
  }

  // -----------------------------------------------------------------
  // Binding resolvers (text-replace via data-kph-bind)
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
  // Count resolvers + Labels (via data-kph-count)
  // -----------------------------------------------------------------
  var counters={
    orders:function(c){
      return c&&c.orders&&c.orders.nodes?c.orders.nodes.length:0;
    },
    wishlist:function(c){
      try{
        var v=c&&c.metafield&&c.metafield.value;
        if(!v)return 0;
        var arr=JSON.parse(v);
        return Array.isArray(arr)?arr.length:0;
      }catch(e){
        log('count','wishlist-parse-fail',{err:String(e)});
        return 0;
      }
    },
    addresses:function(c){
      return c&&c.addresses&&c.addresses.nodes?c.addresses.nodes.length:0;
    }
  };

  var countLabels={
    orders:   {singular:'Bestellung',                 plural:'Bestellungen',           empty:'Keine Bestellungen'},
    wishlist: {singular:'St\u00fcck gespeichert',     plural:'St\u00fccke gespeichert', empty:'Noch nichts gespeichert'},
    addresses:{singular:'Adresse',                    plural:'Adressen',                empty:'Noch keine Adresse'}
  };

  // -----------------------------------------------------------------
  // DOM rendering
  // -----------------------------------------------------------------
  var STATE_SELECTOR='[data-kph-bind],[data-kph-count]';

  function setStateClass(state){
    var nodes=document.querySelectorAll(STATE_SELECTOR);
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      el.classList.remove('kph-loading','kph-ready','kph-error');
      el.classList.add('kph-'+state);
    }
  }

  function renderBindings(customer){
    var nodes=document.querySelectorAll('[data-kph-bind]');
    log('render','bind nodes found',{count:nodes.length});
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      var key=el.getAttribute('data-kph-bind');
      var resolver=bindings[key];
      if(!resolver){
        log('render','no resolver for bind key',{key:key});
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
  }

  function renderCounts(customer){
    var nodes=document.querySelectorAll('[data-kph-count]');
    log('render','count nodes found',{count:nodes.length});
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      var key=el.getAttribute('data-kph-count');
      var resolver=counters[key];
      var labels=countLabels[key];
      if(!resolver||!labels){
        log('render','no resolver/labels for count key',{key:key});
        continue;
      }
      try{
        var n=resolver(customer);
        if(n===0){
          el.textContent=labels.empty;
        }else{
          var lbl=n===1?labels.singular:labels.plural;
          el.innerHTML='<span>'+n+'</span> '+lbl;
        }
        log('render','count '+key+'='+n);
      }catch(e){
        log('render','count-fail',{key:key,err:String(e)});
      }
    }
  }

  function render(customer){
    renderBindings(customer);
    renderCounts(customer);
    setStateClass('ready');
  }

  // -----------------------------------------------------------------
  // Init flow with token polling
  // -----------------------------------------------------------------
  var customerCtx=null;
  var fetchInFlight=false;
  var pollCount=0;
  var pollTimer=null;
  var startTs=0;

  function attemptInit(){
    pollCount++;
    var tok=readSfTokens();
    if(tok&&!tok.expired&&tok.accessToken&&!fetchInFlight){
      clearInterval(pollTimer);pollTimer=null;
      fetchInFlight=true;
      log('auth','token acquired',{
        attempts:pollCount,
        elapsedMs:Date.now()-startTs,
        msUntilExpiry:tok.msUntilExpiry
      });
      return fetchCustomer(tok.accessToken).then(function(c){
        fetchInFlight=false;
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
    // Subsequent attempts every POLL_INTERVAL_MS — only if first attempt did not already trigger a fetch
    if(!customerCtx&&!pollTimer&&!fetchInFlight){
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
      fetchInFlight=false;
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
