/*!
 * Kessler PRO · hub.js v1.2.0
 *
 * Phase 8.3 — Aktuelle Bestellung Card mit Status-Mapping, ETA, Tracking-Link.
 *
 * v1.2.0 Patch (Δ gegen v1.1.2):
 *   + CUSTOMER_QUERY_V12: orders.nodes erweitert um name/processedAt/financial+fulfillment
 *     Status/statusPageUrl/fulfillments(first:1){nodes{status,estimatedDeliveryAt,
 *     trackingInformation{number,url,company}}}. Query-Cost ~30/7500.
 *   + Neues data-kph-card="order-current" mit Bind-Slots:
 *       * data-kph-bind="order.name"     → Order-Number (textContent)
 *       * data-kph-bind="order.status"   → Status-Label (textContent)
 *       * data-kph-bind="order.eta"      → ETA "DD.MM.YYYY" (textContent)
 *       * data-kph-bind="order.link"     → /account/bestellung-detail?id=… (href)
 *       * data-kph-bind="order.tracking" → trackingInformation.url (href)
 *   + Neue Show-If-Mechanik via data-kph-show-if (initial display:none in Site CSS):
 *       * orders.empty / orders.notEmpty
 *       * wishlist.empty / wishlist.notEmpty
 *       * addresses.empty / addresses.notEmpty
 *       * order.hasEta / order.hasTracking
 *   + Bindings-Schema unified: {kind:'text'|'href', resolve:fn}.
 *     Rückwärts-kompatibel: greeting/email/avatar wurden auf neues Schema migriert.
 *   + STATE_SELECTOR erweitert um [data-kph-show-if].
 *   + Status-Label DE (Kessler-Brand, Manufaktur-Sprache):
 *       PAID + UNFULFILLED/IN_PROGRESS → "in Produktion"
 *       PAID + PARTIALLY_FULFILLED     → "teilweise versandt"
 *       PAID + FULFILLED               → "versandt"
 *       PAID + ON_HOLD                 → "vorgemerkt"
 *       REFUNDED / VOIDED              → "storniert"
 *       PARTIALLY_REFUNDED             → "teilrückerstattet"
 *       PENDING / AUTHORIZED           → "Zahlung in Bearbeitung"
 *       (fallback)                     → "in Bearbeitung"
 *
 * Unverändert aus v1.1.2:
 *   - Bootstrap + Auth-Token-Acquisition
 *   - 3 Counts (orders/wishlist/addresses) mit Singular/Plural/Empty-Labels
 *   - fetchInFlight Guard in attemptInit() + init() (Race-Condition Fix)
 *   - Public API: window.KPH = { version, refresh, _debug }
 *
 * Future scope (Phase 8.4+):
 *   - data-kph-list="orders" + data-kph-tpl=…  → Order-Liste auf /account/bestellungen
 *   - data-kph-action="logout"                 → Logout-Trigger
 *   - DHL-Webhook-Status (Phase 9+)            → "geliefert"-Detection via Order-Metafield
 */
(function(){
  if(window.__KPH_INIT)return;
  window.__KPH_INIT=true;

  var VERSION='1.2.0';
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

  // Phase 8.3 query — customer + counts + latest-order detail subset
  var CUSTOMER_QUERY_V12='{customer{'+
    'id firstName lastName displayName '+
    'emailAddress{emailAddress} '+
    'addresses(first:20){nodes{id}} '+
    'orders(first:50,sortKey:PROCESSED_AT,reverse:true){nodes{'+
      'id name processedAt '+
      'financialStatus fulfillmentStatus '+
      'statusPageUrl '+
      'fulfillments(first:1){nodes{'+
        'status estimatedDeliveryAt '+
        'trackingInformation{number url company}'+
      '}}'+
    '}} '+
    'metafield(namespace:"kessler",key:"wishlist"){value}'+
  '}}';

  function fetchCustomer(token){
    return gql(CUSTOMER_QUERY_V12,token,'fetchCustomer').then(function(res){
      if(!res.ok)return null;
      var c=res.json&&res.json.data&&res.json.data.customer;
      if(!c){
        log('parse','no customer in response',res.json);
        return null;
      }
      var latest=latestOrder(c);
      log('parse','customer ok',{
        fields:Object.keys(c),
        firstName:c.firstName,
        hasEmail:!!(c.emailAddress&&c.emailAddress.emailAddress),
        ordersLen:c.orders&&c.orders.nodes?c.orders.nodes.length:0,
        addressesLen:c.addresses&&c.addresses.nodes?c.addresses.nodes.length:0,
        hasWishlistMf:!!(c.metafield&&c.metafield.value),
        latestOrder:latest?{
          name:latest.name,
          financialStatus:latest.financialStatus,
          fulfillmentStatus:latest.fulfillmentStatus,
          hasEta:!!getEtaIso(latest),
          hasTracking:!!getTrackingUrl(latest)
        }:null
      });
      return c;
    });
  }

  // -----------------------------------------------------------------
  // Order helpers
  // -----------------------------------------------------------------
  function latestOrder(c){
    return c&&c.orders&&c.orders.nodes&&c.orders.nodes[0]||null;
  }

  function orderStatusLabel(o){
    if(!o)return '';
    var fs=o.financialStatus;
    var ff=o.fulfillmentStatus;
    if(fs==='REFUNDED'||fs==='VOIDED')return 'storniert';
    if(fs==='PARTIALLY_REFUNDED')return 'teilr\u00fcckerstattet';
    if(fs==='PENDING'||fs==='AUTHORIZED')return 'Zahlung in Bearbeitung';
    if(ff==='FULFILLED')return 'versandt';
    if(ff==='PARTIALLY_FULFILLED')return 'teilweise versandt';
    if(ff==='UNFULFILLED'||ff==='IN_PROGRESS')return 'in Produktion';
    if(ff==='ON_HOLD')return 'vorgemerkt';
    return 'in Bearbeitung';
  }

  function getEtaIso(o){
    try{
      return o&&o.fulfillments&&o.fulfillments.nodes&&o.fulfillments.nodes[0]&&o.fulfillments.nodes[0].estimatedDeliveryAt||null;
    }catch(e){return null}
  }

  function formatEta(iso){
    if(!iso)return '';
    var d=new Date(iso);
    if(isNaN(d.getTime()))return '';
    var dd=String(d.getDate());if(dd.length<2)dd='0'+dd;
    var mm=String(d.getMonth()+1);if(mm.length<2)mm='0'+mm;
    return dd+'.'+mm+'.'+d.getFullYear();
  }

  function getTrackingUrl(o){
    try{
      return o&&o.fulfillments&&o.fulfillments.nodes&&o.fulfillments.nodes[0]&&o.fulfillments.nodes[0].trackingInformation&&o.fulfillments.nodes[0].trackingInformation.url||null;
    }catch(e){return null}
  }

  function orderDetailUrl(o){
    if(!o||!o.id)return '#';
    return '/account/bestellung-detail?id='+encodeURIComponent(o.id);
  }

  // -----------------------------------------------------------------
  // Binding resolvers — unified schema {kind:'text'|'href', resolve:fn}
  // -----------------------------------------------------------------
  var bindings={
    // Phase 8.1 — hub text bindings
    'greeting':{kind:'text',resolve:function(c){
      var fn=c&&c.firstName;
      return fn?'Willkommen zur\u00fcck, '+fn+'.':'Sch\u00f6n dich zu sehen.';
    }},
    'email':{kind:'text',resolve:function(c){
      return c&&c.emailAddress&&c.emailAddress.emailAddress||'';
    }},
    'avatar':{kind:'text',resolve:function(c){
      var em=c&&c.emailAddress&&c.emailAddress.emailAddress;
      return em?em[0].toUpperCase():'?';
    }},
    // Phase 8.3 — order card slots
    'order.name':{kind:'text',resolve:function(c){
      var o=latestOrder(c);return o?o.name||'':'';
    }},
    'order.status':{kind:'text',resolve:function(c){
      return orderStatusLabel(latestOrder(c));
    }},
    'order.eta':{kind:'text',resolve:function(c){
      return formatEta(getEtaIso(latestOrder(c)));
    }},
    'order.link':{kind:'href',resolve:function(c){
      return orderDetailUrl(latestOrder(c));
    }},
    'order.tracking':{kind:'href',resolve:function(c){
      return getTrackingUrl(latestOrder(c))||'#';
    }}
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
  // Show-If rules (via data-kph-show-if; elements default display:none in Site CSS)
  // -----------------------------------------------------------------
  var showIfRules={
    'orders.empty':function(c){
      return !c||!c.orders||!c.orders.nodes||c.orders.nodes.length===0;
    },
    'orders.notEmpty':function(c){
      return !!(c&&c.orders&&c.orders.nodes&&c.orders.nodes.length>0);
    },
    'wishlist.empty':function(c){
      return counters.wishlist(c)===0;
    },
    'wishlist.notEmpty':function(c){
      return counters.wishlist(c)>0;
    },
    'addresses.empty':function(c){
      return counters.addresses(c)===0;
    },
    'addresses.notEmpty':function(c){
      return counters.addresses(c)>0;
    },
    'order.hasEta':function(c){
      return !!getEtaIso(latestOrder(c));
    },
    'order.hasTracking':function(c){
      return !!getTrackingUrl(latestOrder(c));
    }
  };

  // -----------------------------------------------------------------
  // DOM rendering
  // -----------------------------------------------------------------
  var STATE_SELECTOR='[data-kph-bind],[data-kph-count],[data-kph-show-if]';

  function setStateClass(state){
    var nodes=document.querySelectorAll(STATE_SELECTOR);
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      el.classList.remove('kph-loading','kph-ready','kph-error');
      el.classList.add('kph-'+state);
    }
  }

  function renderShowIfs(customer){
    var nodes=document.querySelectorAll('[data-kph-show-if]');
    log('render','show-if nodes found',{count:nodes.length});
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      var key=el.getAttribute('data-kph-show-if');
      var rule=showIfRules[key];
      if(!rule){
        log('render','no rule for show-if',{key:key});
        continue;
      }
      try{
        var visible=!!rule(customer);
        el.style.display=visible?'':'none';
        log('render','show-if '+key+'='+visible);
      }catch(e){
        log('render','show-if-fail',{key:key,err:String(e)});
      }
    }
  }

  function renderBindings(customer){
    var nodes=document.querySelectorAll('[data-kph-bind]');
    log('render','bind nodes found',{count:nodes.length});
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      var key=el.getAttribute('data-kph-bind');
      var b=bindings[key];
      if(!b){
        log('render','no resolver for bind key',{key:key});
        continue;
      }
      try{
        var val=b.resolve(customer);
        if(b.kind==='href'){
          el.setAttribute('href',val||'#');
          log('render',key+' href="'+(val||'#')+'"');
        }else{
          el.textContent=val;
          log('render',key+'="'+val+'"');
        }
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
    // Order: show-if first (sets display before content paint),
    // then bindings + counts populate visible content.
    renderShowIfs(customer);
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
    attemptInit();
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
        latestOrder:customerCtx?latestOrder(customerCtx):null,
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
