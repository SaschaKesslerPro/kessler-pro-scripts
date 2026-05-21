/*!
 * Kessler PRO · hub.js v1.3.1
 *
 * Phase 8.4 — Profil & Einstellungen (Customer-Data Edit)
 *
 * v1.3.1 Patch (Δ gegen v1.3.0):
 *   * mutNewsletter: customer{emailAddress{…}} return-selection entfernt.
 *     CustomerEmailMarketing(Un)subscribePayload akzeptiert nur userErrors —
 *     customer-Field ist NICHT verfügbar (anders als customerUpdate).
 *     Fix für Fehler: "Field 'customer' doesn't exist on type
 *     'CustomerEmailMarketingUnsubscribePayload'".
 *
 * v1.3.0 (vorher):
 *   + CUSTOMER_QUERY_V13: erweitert um emailAddress.marketingState +
 *     2 metafield-Aliases (localeMf, orderUpdatesMf) im kessler_profile-Namespace.
 *     Wishlist-Metafield via Alias wishlistMf umbenannt (vorher: metafield singular).
 *   + 6 neue Profile-Bindings:
 *       * profile.firstName    → input.value (kind:'value')
 *       * profile.lastName     → input.value (kind:'value')
 *       * profile.email        → input.value + readOnly=true (kind:'value-readonly')
 *       * profile.locale       → select.value (kind:'select', default 'DE')
 *       * profile.newsletter   → DIV-toggle via .kp-toggle--on class (kind:'toggle')
 *       * profile.orderUpdates → DIV-toggle via .kp-toggle--on class (kind:'toggle')
 *   + Neue Render-kinds: 'value', 'value-readonly', 'select', 'toggle'
 *   + Toggle-Click-Handler für [data-kph-action="toggle"] (visuelles class-toggling)
 *   + Save-Action via [data-kph-action="save-profile"]:
 *       - Diff initial vs. current → nur geänderte Felder werden mutiert
 *       - Promise.all von bis zu 3 parallelen Mutations:
 *           customerUpdate(input:{firstName,lastName})           ← wenn name geändert
 *           customerEmailMarketing(Un)subscribe()                ← wenn newsletter geändert
 *           metafieldsSet([{owner,namespace,key,type,value},…])  ← wenn locale/orderUpdates geändert
 *       - Feedback via [data-kph-feedback] element (success/error)
 *   + Token-Pre-Check vor Save: wenn msUntilExpiry < 60s → Block + Reload-Banner
 *   + initialProfile snapshot bei render + neu nach erfolgreichem Save
 *
 * Unverändert aus v1.2.0:
 *   - Hub-Bindings (greeting, email, avatar, order.*) + show-if + counts
 *   - Auth-Token-Polling + fetchInFlight Guard
 *   - Public API: window.KPH = { version, refresh, _debug }
 *
 * Future scope:
 *   - Auto-Token-Refresh via OAuth refresh_token (Phase 8.4-Polish)
 *   - Adress-Management (Phase 8.5)
 *   - data-kph-list="orders" für /account/bestellungen (Phase 8.5)
 */
(function(){
  if(window.__KPH_INIT)return;
  window.__KPH_INIT=true;

  var VERSION='1.3.1';
  var TOKEN_STORAGE_KEY='_sf_oauth_tokens';
  var SHOP_ID_FALLBACK='100010033498';
  var API_VERSION='2024-10';
  var POLL_INTERVAL_MS=500;
  var POLL_MAX=60; // 30s @ 500ms
  var TOKEN_MIN_MS_FOR_WRITE=60000; // Minimum 60s remaining for write actions

  var PROFILE_MF_NAMESPACE='kessler_profile';
  var PROFILE_MF_LOCALE_KEY='locale';
  var PROFILE_MF_ORDER_UPDATES_KEY='order_updates';

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
  function gql(query,token,opName,variables){
    var ep=gqlEndpoint();
    log('gql',opName+' fetch start',{endpoint:ep,tokenPreview:token?token.slice(0,12)+'\u2026':'(none)'});
    var body={query:query};
    if(variables)body.variables=variables;
    return fetch(ep,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':token
      },
      body:JSON.stringify(body)
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

  // Phase 8.4 query — customer + counts + latest-order + profile fields + 3 metafield aliases
  var CUSTOMER_QUERY_V13='{customer{'+
    'id firstName lastName displayName '+
    'emailAddress{emailAddress marketingState} '+
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
    'wishlistMf:metafield(namespace:"kessler",key:"wishlist"){value} '+
    'localeMf:metafield(namespace:"'+PROFILE_MF_NAMESPACE+'",key:"'+PROFILE_MF_LOCALE_KEY+'"){value type} '+
    'orderUpdatesMf:metafield(namespace:"'+PROFILE_MF_NAMESPACE+'",key:"'+PROFILE_MF_ORDER_UPDATES_KEY+'"){value type}'+
  '}}';

  function fetchCustomer(token){
    return gql(CUSTOMER_QUERY_V13,token,'fetchCustomer').then(function(res){
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
        marketingState:c.emailAddress&&c.emailAddress.marketingState,
        ordersLen:c.orders&&c.orders.nodes?c.orders.nodes.length:0,
        addressesLen:c.addresses&&c.addresses.nodes?c.addresses.nodes.length:0,
        hasWishlistMf:!!(c.wishlistMf&&c.wishlistMf.value),
        localeMfValue:c.localeMf&&c.localeMf.value,
        orderUpdatesMfValue:c.orderUpdatesMf&&c.orderUpdatesMf.value,
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
  // Profile helpers
  // -----------------------------------------------------------------
  function getMarketingState(c){
    return c&&c.emailAddress&&c.emailAddress.marketingState||'';
  }

  function isSubscribed(c){
    return getMarketingState(c)==='SUBSCRIBED';
  }

  function getLocale(c){
    var v=c&&c.localeMf&&c.localeMf.value;
    if(v==='DE'||v==='PL'||v==='EN')return v;
    return 'DE'; // Default
  }

  function getOrderUpdatesEnabled(c){
    var v=c&&c.orderUpdatesMf&&c.orderUpdatesMf.value;
    if(v==='true')return true;
    if(v==='false')return false;
    return true; // Default opt-in
  }

  // -----------------------------------------------------------------
  // Binding resolvers — unified schema {kind, resolve}
  // kinds: 'text' | 'href' | 'value' | 'value-readonly' | 'select' | 'toggle'
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
    }},
    // Phase 8.4 — profile form bindings
    'profile.firstName':{kind:'value',resolve:function(c){
      return c&&c.firstName||'';
    }},
    'profile.lastName':{kind:'value',resolve:function(c){
      return c&&c.lastName||'';
    }},
    'profile.email':{kind:'value-readonly',resolve:function(c){
      return c&&c.emailAddress&&c.emailAddress.emailAddress||'';
    }},
    'profile.locale':{kind:'select',resolve:function(c){
      return getLocale(c);
    }},
    'profile.newsletter':{kind:'toggle',resolve:function(c){
      return isSubscribed(c);
    }},
    'profile.orderUpdates':{kind:'toggle',resolve:function(c){
      return getOrderUpdatesEnabled(c);
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
        var v=c&&c.wishlistMf&&c.wishlistMf.value;
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
  // Show-If rules
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
        }else if(b.kind==='value'){
          el.value=val==null?'':String(val);
          log('render',key+' value="'+el.value+'"');
        }else if(b.kind==='value-readonly'){
          el.value=val==null?'':String(val);
          el.readOnly=true;
          el.setAttribute('aria-readonly','true');
          log('render',key+' value="'+el.value+'" (readonly)');
        }else if(b.kind==='select'){
          el.value=val==null?'':String(val);
          log('render',key+' select="'+el.value+'"');
        }else if(b.kind==='toggle'){
          var on=!!val;
          if(on)el.classList.add('kp-toggle--on');
          else el.classList.remove('kp-toggle--on');
          log('render',key+' toggle='+on);
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

  // -----------------------------------------------------------------
  // Phase 8.4 — Profile state-tracking, actions, mutations
  // -----------------------------------------------------------------
  var initialProfileSnapshot=null;

  function snapshotProfile(customer){
    initialProfileSnapshot={
      firstName:customer&&customer.firstName||'',
      lastName:customer&&customer.lastName||'',
      locale:getLocale(customer),
      newsletter:isSubscribed(customer),
      orderUpdates:getOrderUpdatesEnabled(customer)
    };
    log('profile','initial snapshot',initialProfileSnapshot);
  }

  function readCurrentProfile(){
    var get=function(key,prop){
      var el=document.querySelector('[data-kph-bind="profile.'+key+'"]');
      if(!el)return null;
      return prop==='class'?el.classList.contains('kp-toggle--on'):el[prop];
    };
    return {
      firstName:(get('firstName','value')||'').trim(),
      lastName:(get('lastName','value')||'').trim(),
      locale:get('locale','value')||'DE',
      newsletter:get('newsletter','class'),
      orderUpdates:get('orderUpdates','class')
    };
  }

  function diffProfile(initial,current){
    var d={};
    if(initial.firstName!==current.firstName)d.firstName=current.firstName;
    if(initial.lastName!==current.lastName)d.lastName=current.lastName;
    if(initial.locale!==current.locale)d.locale=current.locale;
    if(initial.newsletter!==current.newsletter)d.newsletter=current.newsletter;
    if(initial.orderUpdates!==current.orderUpdates)d.orderUpdates=current.orderUpdates;
    return d;
  }

  function escGql(s){
    return String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
  }

  function mutCustomerUpdate(token,firstName,lastName){
    var input=[];
    if(firstName!=null)input.push('firstName:"'+escGql(firstName)+'"');
    if(lastName!=null)input.push('lastName:"'+escGql(lastName)+'"');
    var q='mutation{customerUpdate(input:{'+input.join(',')+'}){customer{firstName lastName} userErrors{field message code}}}';
    return gql(q,token,'mut.customerUpdate');
  }

  function mutNewsletter(token,subscribe){
    var op=subscribe?'customerEmailMarketingSubscribe':'customerEmailMarketingUnsubscribe';
    // CustomerEmailMarketing(Un)subscribePayload has no 'customer' field — only userErrors selectable.
    var q='mutation{'+op+'{userErrors{field message code}}}';
    return gql(q,token,'mut.'+op);
  }

  function mutMetafields(token,customerGid,fields){
    // fields: array of {key, type, value}
    var items=fields.map(function(f){
      return '{ownerId:"'+escGql(customerGid)+'",namespace:"'+PROFILE_MF_NAMESPACE+'",key:"'+escGql(f.key)+'",type:"'+escGql(f.type)+'",value:"'+escGql(f.value)+'"}';
    });
    var q='mutation{metafieldsSet(metafields:['+items.join(',')+']){metafields{id key namespace value} userErrors{field message code}}}';
    return gql(q,token,'mut.metafieldsSet');
  }

  function setFeedback(state,msg){
    var el=document.querySelector('[data-kph-feedback]');
    if(!el)return;
    el.classList.remove('kph-fb-success','kph-fb-error','kph-fb-info','kph-fb-hidden');
    el.classList.add('kph-fb-'+state);
    el.textContent=msg||'';
    el.style.display='';
    if(state==='success'){
      setTimeout(function(){
        el.classList.add('kph-fb-hidden');
        el.style.display='none';
      },3000);
    }
  }

  function setSaveBtnState(busy){
    var btns=document.querySelectorAll('[data-kph-action="save-profile"]');
    for(var i=0;i<btns.length;i++){
      var b=btns[i];
      if(busy){
        b.setAttribute('aria-busy','true');
        b.classList.add('kph-busy');
        b.style.pointerEvents='none';
        b.style.opacity='0.6';
      }else{
        b.removeAttribute('aria-busy');
        b.classList.remove('kph-busy');
        b.style.pointerEvents='';
        b.style.opacity='';
      }
    }
  }

  function extractUserErrors(res){
    // Walk through res.json.data.<op>.userErrors and res.json.errors
    var errs=[];
    if(res&&res.json){
      if(res.json.errors&&res.json.errors.length){
        res.json.errors.forEach(function(e){errs.push(e.message||'GraphQL-Fehler')});
      }
      if(res.json.data){
        Object.keys(res.json.data).forEach(function(k){
          var payload=res.json.data[k];
          if(payload&&payload.userErrors&&payload.userErrors.length){
            payload.userErrors.forEach(function(e){
              errs.push(e.message||(e.code+': '+(e.field||'').toString()));
            });
          }
        });
      }
    }
    if(!errs.length&&res&&!res.ok)errs.push('Netzwerkfehler (HTTP '+(res.status||0)+')');
    return errs;
  }

  function saveProfile(){
    if(!customerCtx){
      setFeedback('error','Keine Kundendaten geladen. Bitte Seite neu laden.');
      return;
    }
    var tok=readSfTokens();
    if(!tok||tok.expired){
      setFeedback('error','Deine Sitzung ist abgelaufen. Bitte Seite neu laden.');
      return;
    }
    if(tok.msUntilExpiry<TOKEN_MIN_MS_FOR_WRITE){
      setFeedback('error','Deine Sitzung l\u00e4uft gleich ab. Bitte Seite neu laden, um zu speichern.');
      return;
    }
    if(!initialProfileSnapshot){
      log('save','no snapshot \u2014 abort');
      return;
    }
    var current=readCurrentProfile();
    var diff=diffProfile(initialProfileSnapshot,current);
    var diffKeys=Object.keys(diff);
    log('save','diff',{diff:diff,count:diffKeys.length});

    // Validate required fields
    if(current.firstName.length===0||current.lastName.length===0){
      setFeedback('error','Vorname und Nachname d\u00fcrfen nicht leer sein.');
      return;
    }

    if(diffKeys.length===0){
      setFeedback('info','Keine \u00c4nderungen.');
      return;
    }

    setSaveBtnState(true);
    setFeedback('info','Speichere\u2026');

    var jobs=[];
    var token=tok.accessToken;

    if(diff.firstName!==undefined||diff.lastName!==undefined){
      jobs.push(mutCustomerUpdate(token,
        diff.firstName!==undefined?diff.firstName:current.firstName,
        diff.lastName!==undefined?diff.lastName:current.lastName
      ));
    }
    if(diff.newsletter!==undefined){
      jobs.push(mutNewsletter(token,diff.newsletter));
    }
    var mfFields=[];
    if(diff.locale!==undefined){
      mfFields.push({key:PROFILE_MF_LOCALE_KEY,type:'single_line_text_field',value:diff.locale});
    }
    if(diff.orderUpdates!==undefined){
      mfFields.push({key:PROFILE_MF_ORDER_UPDATES_KEY,type:'boolean',value:diff.orderUpdates?'true':'false'});
    }
    if(mfFields.length>0){
      jobs.push(mutMetafields(token,customerCtx.id,mfFields));
    }

    Promise.all(jobs).then(function(results){
      var allOk=true;
      var allErrs=[];
      results.forEach(function(r){
        if(!r.ok){allOk=false;}
        var errs=extractUserErrors(r);
        if(errs.length){allOk=false;allErrs=allErrs.concat(errs);}
      });
      setSaveBtnState(false);
      if(allOk){
        // Update snapshot to current (no more diffs until next edit)
        Object.keys(diff).forEach(function(k){initialProfileSnapshot[k]=current[k];});
        log('save','success',{updated:diffKeys});
        setFeedback('success','Gespeichert');
      }else{
        log('save','failure',{errors:allErrs});
        setFeedback('error','Fehler beim Speichern: '+(allErrs.join(' · ')||'Unbekannter Fehler'));
      }
    }).catch(function(e){
      setSaveBtnState(false);
      log('save','exception',{err:String(e)});
      setFeedback('error','Unerwarteter Fehler: '+String(e));
    });
  }

  // -----------------------------------------------------------------
  // Action handlers wiring
  // -----------------------------------------------------------------
  function wireActions(){
    // Toggle elements
    var toggles=document.querySelectorAll('[data-kph-action="toggle"]');
    for(var i=0;i<toggles.length;i++){
      var t=toggles[i];
      if(t.__kphWired)continue;
      t.__kphWired=true;
      t.style.cursor='pointer';
      t.setAttribute('role','switch');
      t.addEventListener('click',function(ev){
        ev.preventDefault();
        var el=ev.currentTarget;
        el.classList.toggle('kp-toggle--on');
        var on=el.classList.contains('kp-toggle--on');
        el.setAttribute('aria-checked',on?'true':'false');
        log('action','toggle',{key:el.getAttribute('data-kph-bind'),on:on});
      });
    }
    // Save buttons
    var saves=document.querySelectorAll('[data-kph-action="save-profile"]');
    for(var j=0;j<saves.length;j++){
      var s=saves[j];
      if(s.__kphWired)continue;
      s.__kphWired=true;
      s.addEventListener('click',function(ev){
        ev.preventDefault();
        saveProfile();
      });
    }
    log('action','wired',{toggles:toggles.length,saves:saves.length});
  }

  function render(customer){
    renderShowIfs(customer);
    renderBindings(customer);
    renderCounts(customer);
    snapshotProfile(customer);
    wireActions();
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
      initialProfileSnapshot=null;
      init();
    },
    save:saveProfile,
    _debug:function(){
      var tok=readSfTokens();
      return {
        version:VERSION,
        customerCtx:customerCtx,
        latestOrder:customerCtx?latestOrder(customerCtx):null,
        initialProfileSnapshot:initialProfileSnapshot,
        currentProfile:initialProfileSnapshot?readCurrentProfile():null,
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
