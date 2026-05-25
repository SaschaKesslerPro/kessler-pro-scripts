/*!
 * Kessler PRO · hub.js v1.7.3
 *
 * v1.7.3 (Δ gegen v1.7.2):
 *   - P3: orderDetailUrl prefers human-readable o.name ("KP-2026-1004") over
 *     GID ("gid://shopify/Order/12345"). URL becomes /account/bestellung-detail?id=KP-2026-1004
 *     instead of the ugly encoded GID. Bestelldetail-Page already accepts both
 *     formats via getDetailOrder (findOrderByName + findOrderByGid).
 *
 * Phase 8.7 — Bestelldetail-Page Hydration (single-order detail view)
 *
 * v1.7.0 (Δ gegen v1.6.3):
 *   + CUSTOMER_QUERY_V14 → V15: erweitert um
 *       - subtotal{amount currencyCode}
 *       - totalShipping{amount currencyCode}
 *       - totalTax{amount currencyCode}
 *       - shippingAddress{formatted firstName lastName}
 *       - billingAddress{formatted firstName lastName}
 *       - lineItems(first:20) (war first:10) mit sku + variantTitle + price{amount currencyCode}
 *       - fulfillments(first:5) (war first:1) mit zusätzlich createdAt
 *   + Neue Helpers für Detail-Page-Hydration:
 *       - getOrderIdFromUrl() — URL ?id= param
 *       - findOrderByGid(c, gid) / findOrderByName(c, name)
 *       - getDetailOrder(c) — URL-resolved order (GID oder Name)
 *       - isOnOrderDetailPage() — /account/bestellung-detail*
 *       - resolveOrderContext(c) — context-aware: detail page → URL-order, sonst → latestOrder
 *       - formatDateShort(iso) — "12. Mai"
 *       - getTimelineSteps(order) — 4-Step state machine (received/production/shipped/delivered)
 *   + Modifiziert: order.hasEta, order.hasTracking showIfRules sind jetzt context-aware
 *     (resolveOrderContext statt direkt latestOrder). Auf Hub-Page identisches Verhalten,
 *     auf Bestelldetail-Page Detail-Order.
 *   + Neue showIfRules: order.hasTax, order.hasInvoice (always-false Stub für Phase 9 Sufio),
 *     order.hasPaymentMethod (always-false Stub, kein API-Field)
 *   + Neue Render-Funktionen:
 *       - renderOrderDetail(customer) — Master-Renderer für /account/bestellung-detail
 *       - applyOrderDetailBindingsGlobal(order) — walkt data-kph-bind-text/lines mit "order.*"-Keys
 *         outside template-clones, resolved gegen URL-Order
 *       - renderTimeline(order) — 4-Step state-machine, setzt --done/--current/--upcoming modifier
 *       - renderLineItemsList(order) — Template-Clone-Pattern für data-kph-list="lineItems"
 *       - applyLineItemBindings(root, item) — data-kph-bind-text="item.*" + data-kph-thumb (image/initials)
 *       - resolveOrderDetailField(order, key) — bindings für order.subtotalLabel etc.
 *       - resolveLineItemField(item, key) — bindings für item.title, item.variantTitle, etc.
 *       - wireReorderAction(order) — MVP-Stub (Alert + Redirect zu /produkte)
 *   + render() orchestrator erweitert um renderOrderDetail(customer) nach renderOrderList
 *   + In wireActions(): wireReorderAction integriert (Phase 9 echte Impl → cart.add per item)
 *
 * Phase 8.6c+ — Login-Required-State (Empty-State + Anmelde-Button-Pattern)
 *
 * v1.6.3 (Δ gegen v1.6.2):
 *   + Neue showIfRules: auth.guest (customer===null) + auth.user (customer!==null)
 *   + Neue renderGuest() Helper: renderShowIfs(null) + Pre-Hide removed + setStateClass('guest')
 *   + Poll-Timeout (POLL_MAX 60→12, 30s→6s) → renderGuest() statt setStateClass('error')
 *   + fetchCustomer null/fail → renderGuest() statt setStateClass('error')
 *   + setStateClass: 'kph-guest' in remove list
 *
 *   Pattern: Unauthenticated user sees "Bitte einloggen" Empty-State (data-kph-show-if="auth.guest"),
 *   authenticated user sees normal content (data-kph-show-if="auth.user"). Beide initial via
 *   Pre-Hide-CSS versteckt, renderShowIfs entscheidet. Empty-State enthält Button mit sf-login="1"
 *   → Shopyflow intercepts Click → OAuth-Flow → Shopify-Login → zurück.
 *
 * v1.6.2 (vorher):
 *   + CUSTOMER_QUERY: + customer.creationDate
 *   + Neue formatCreationDate(iso) — Same DE-format wie formatProcessedAt
 *   + Neue Binding-Key customer.creationDateFormatted → ersetzt static
 *     "12. März 2024" im Sub-Header
 *   + Pre-Hide-CSS: injizierter <style id="kph-prehide"> am IIFE-Top hidet
 *     alle [data-kph-show-if] sofort (verhindert 200ms Flash vor renderShowIfs).
 *     Wird in render() nach renderShowIfs() removed → JS-Entscheidungen greifen.
 *
 * v1.6.1 (vorher):
 *   + renderOrderList: setzt data-kph-order-bucket="production|shipped|completed|cancelled"
 *     auf jede gerenderte Card → filter-readable Persistence
 *   + Neue wireFilterPills() — Click-Handler auf [data-kph-filter] elements.
 *     Toggle kp-filter-pill--active. Idempotent via data-kph-filter-wired Guard.
 *   + Neue filterOrders(bucket) — show/hide order-cards basierend auf
 *     data-kph-order-bucket. "all" bucket = show everything.
 *   + render() orchestrator: wireFilterPills() nach renderOrderList()
 *
 * v1.6.0 (vorher):
 *   + CUSTOMER_QUERY_V14 → _V15:
 *       - orders.nodes erweitert um totalPrice{amount currencyCode}
 *         und lineItems(first:10){nodes{title quantity image{url altText}}}
 *   + Neue Order-Helpers:
 *       - formatPrice({amount,currencyCode}) — DE-Format mit EUR/PLN/GBP/USD
 *       - formatProcessedAt(iso) — "DD. Monat YYYY"
 *       - getLineItems / getOrderItemCount — safe getters mit quantity-sum
 *       - getThumbInitials(title) — first-2-chars first-word uppercase
 *       - orderStatusModifier(o) — CSS-Modifier "produktion|versendet|abgeschlossen|storniert"
 *       - orderBucket(o) — Filter-Bucket "production|shipped|completed|cancelled"
 *         (FULFILLED + > 30 days alt = completed, sonst shipped)
 *       - orderSummary(o) — "Item A + Item B [+N]" für .kp-order-name
 *       - orderMetaLine(o) — "2 Artikel · in Produktion"
 *       - countOrdersByBucket(c, bucket) — für 4 Filter-Pills
 *   + resolveOrderField(o,key) + applyOrderBindings(root,order)
 *     parallel zu Address-Funktionen (kein renderList-Refactor in 8.6a,
 *     reduziert Risiko an live Adressen-Page; Refactor Polish 8.6c)
 *   + Neue Bindings:
 *       - data-kph-bind="orders.count" für Sub-Header-Counter
 *       - data-kph-bind="orderCounts.all/production/shipped/completed"
 *         für 4 Filter-Pills (Active-Toggle-Logic kommt 8.6b)
 *   + Neue Binding-Attribute (item-scoped):
 *       - data-kph-bind-text="key" (gleich wie Address-Card)
 *       - data-kph-bind-href="key" (NEU — für Card-Link → detailUrl)
 *       - data-kph-status-class="kp-pill-status" (NEU — appended modifier
 *         basierend auf orderStatusModifier(order))
 *       - data-kph-thumbs="key" (NEU — custom thumb-strip rendering)
 *   + renderOrderThumbs(container,order) — first 3 lineItems als
 *     .kp-order-thumb (img wenn lineItem.image.url, sonst Initials),
 *     plus .kp-order-thumb--more "+N" Overflow
 *   + renderOrderList(customer) — Template-Clone-Pattern analog
 *     renderAddressList. Cleanup via [data-kph-rendered="order-card"]
 *   + render() orchestrator erweitert um renderOrderList(customer)
 *   + injectHubCSS() erweitert um .kp-order-thumb img Styling
 *
 * v1.5.1 Patch (Δ gegen v1.5.0):
 *   * renderShowIfs überspringt Elements innerhalb [data-kph-rendered] oder
 *     [data-kph-tpl] — diese item-scoped show-ifs werden korrekt von
 *     applyAddressBindings behandelt. Eliminiert "no rule for show-if"-
 *     Spam der mit Card-Count skaliert (2 Cards = 4 Warnings vorher, 0 jetzt).
 *
 * v1.5.0 (vorher):
 *   + 3 Address-Mutations (alle drei: defaultAddress:Boolean optional):
 *       * mutAddressCreate(token,fields,isDefault)
 *           → customerAddressCreate(address:CustomerAddressInput!,defaultAddress:Boolean)
 *       * mutAddressUpdate(token,addressId,fields,isDefault)
 *           → customerAddressUpdate(addressId:ID!,address:CustomerAddressInput,defaultAddress:Boolean)
 *       * mutAddressDelete(token,addressId)
 *           → customerAddressDelete(addressId:ID!)
 *     KEIN separater customerDefaultAddressUpdate nötig — defaultAddress-Param
 *     auf Update setzt eine bestehende Address als Default.
 *   + Modal-Form als JS-injected DOM (kein Designer-Setup):
 *       - injectAddressModal() baut <div data-kph-modal="address-form"> ans body
 *       - Backdrop + Dialog + Form-Grid mit allen CustomerAddressInput-Feldern
 *       - Country-Select mit 16 Top-Märkten (DE/PL + Nachbarn + Top-EU)
 *       - openAddressForm(mode,addr?) populates + shows
 *       - closeAddressForm() resets + hides
 *       - saveAddressForm() validates + dispatches Mutation + refresh
 *   + Action-Handler echt (waren Stubs in v1.4.0):
 *       - address-edit       → openAddressForm('edit', findAddress(addrId))
 *       - address-delete     → confirm() + mutAddressDelete + refresh
 *       - address-set-default → mutAddressUpdate(id,{},defaultAddress:true) + refresh
 *       - address-create     → openAddressForm('create')
 *   + findAddress(addrId) Helper — sucht Address in customerCtx.addresses.nodes
 *   + Token-Pre-Check vor jedem write (gleich wie saveProfile in 8.4)
 *   + Modal-CSS in injectHubCSS() erweitert (backdrop + dialog + form-grid)
 *
 * v1.4.0 (vorher):
 *   + CUSTOMER_QUERY_V14: addresses(first:20) erweitert von {nodes{id}} auf
 *     vollständiges Address-Schema {id firstName lastName company address1
 *     address2 city zip phoneNumber territoryCode zoneCode formatted province
 *     country}. Plus separate Top-Level defaultAddress{id} für Default-
 *     Detection per Vergleich (Customer Account API hat KEINEN isDefault-Flag
 *     pro Address-Node).
 *   + Neue Render-Engine `renderAddressList(customer)`:
 *       - Template-Discovery via [data-kph-tpl="address-card"] innerhalb
 *         [data-kph-list="addresses"]
 *       - Cleanup vorheriger Renders via [data-kph-rendered="address-card"]
 *       - Pro Address: cloneNode(true), removeAttribute(data-kph-tpl),
 *         set data-kph-rendered + data-kph-address-id, applyAddressBindings,
 *         insertBefore Add-Card (oder appendChild als fallback)
 *       - Default-Card kriegt zusätzlich Class kp-address-card--default
 *   + Item-Scoped Bindings (neu, kollisionsfrei zu globalen Bindings):
 *       - [data-kph-bind-text="fullName"|"company"|...] → textContent
 *       - [data-kph-bind-lines="formatted"] → child-divs pro Array-Eintrag
 *         + Phone als zusätzlicher Child (separat, nicht in formatted enthalten)
 *       - [data-kph-show-if="isDefault"|"!isDefault"] (logical NOT-Prefix)
 *         innerhalb Clones — werden item-scoped resolved, NICHT über
 *         globale showIfRules
 *   + injectHubCSS(): inline <style id="kph-css"> mit
 *     [data-kph-tpl]{display:none!important} — verhindert Template-Flash
 *     vor erstem Render. Beim Init aufgerufen, einmalig.
 *
 * v1.3.1 Patch (vorher):
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
 *   - Bucket-aware empty-state — skipped, pill counts already cover this
 *   - renderList Generic-Refactor + Pagination (Phase 8.7)
 *   - Bestelldetail-Page hydration (Phase 8.7)
 */
(function(){
  // Pre-Hide CSS: hides [data-kph-show-if] until renderShowIfs decides.
  // Removed in render() after renderShowIfs.
  (function injectPreHide(){
    if(document.getElementById('kph-prehide'))return;
    var s=document.createElement('style');
    s.id='kph-prehide';
    s.textContent='[data-kph-show-if]{display:none!important}';
    (document.head||document.documentElement).appendChild(s);
  })();
  if(window.__KPH_INIT)return;
  window.__KPH_INIT=true;

  var VERSION='1.7.3';
  var TOKEN_STORAGE_KEY='_sf_oauth_tokens';
  var SHOP_ID_FALLBACK='100010033498';
  var API_VERSION='2024-10';
  var POLL_INTERVAL_MS=500;
  var POLL_MAX=12; // 6s @ 500ms — was 60 (30s), reduced for snappier guest-state detection
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
  // Phase 8.5a — addresses(first:20) expanded to full Address schema + separate defaultAddress{id}
  // Phase 8.6a — orders extended with totalPrice + lineItems (für Order-Card-Liste)
  // Phase 8.7  — V15: order detail fields (subtotal, totalShipping, totalTax,
  //              shippingAddress, billingAddress, lineItems first:20 + sku + variantTitle + price,
  //              fulfillments first:5 + createdAt)
  var CUSTOMER_QUERY_V15='{customer{'+
    'id firstName lastName displayName creationDate '+
    'emailAddress{emailAddress marketingState} '+
    'defaultAddress{id} '+
    'addresses(first:20){nodes{'+
      'id firstName lastName company '+
      'address1 address2 city zip phoneNumber '+
      'territoryCode zoneCode '+
      'formatted province country'+
    '}} '+
    'orders(first:50,sortKey:PROCESSED_AT,reverse:true){nodes{'+
      'id name processedAt '+
      'financialStatus fulfillmentStatus '+
      'statusPageUrl '+
      'totalPrice{amount currencyCode} '+
      'subtotal{amount currencyCode} '+
      'totalShipping{amount currencyCode} '+
      'totalTax{amount currencyCode} '+
      'shippingAddress{formatted firstName lastName} '+
      'billingAddress{formatted firstName lastName} '+
      'lineItems(first:20){nodes{'+
        'title quantity sku variantTitle '+
        'price{amount currencyCode} '+
        'image{url altText}'+
      '}} '+
      'fulfillments(first:5){nodes{'+
        'status estimatedDeliveryAt createdAt '+
        'trackingInformation{number url company}'+
      '}}'+
    '}} '+
    'wishlistMf:metafield(namespace:"kessler",key:"wishlist"){value} '+
    'localeMf:metafield(namespace:"'+PROFILE_MF_NAMESPACE+'",key:"'+PROFILE_MF_LOCALE_KEY+'"){value type} '+
    'orderUpdatesMf:metafield(namespace:"'+PROFILE_MF_NAMESPACE+'",key:"'+PROFILE_MF_ORDER_UPDATES_KEY+'"){value type}'+
  '}}';

  function fetchCustomer(token){
    return gql(CUSTOMER_QUERY_V15,token,'fetchCustomer').then(function(res){
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
        defaultAddressId:c.defaultAddress&&c.defaultAddress.id||null,
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
    if(!o)return '#';
    // P3 v1.7.3: prefer human-readable name ("KP-2026-1004") over GID for URL.
    // Bestelldetail-Page's getDetailOrder accepts both via findOrderByName/Gid.
    var ref=o.name||o.id;
    if(!ref)return '#';
    return '/account/bestellung-detail?id='+encodeURIComponent(ref);
  }

  // -----------------------------------------------------------------
  // Phase 8.6a — Order list helpers (formatting, thumbs, status modifier, buckets)
  // -----------------------------------------------------------------
  function formatPrice(money){
    if(!money||money.amount==null)return '';
    var amt=parseFloat(money.amount);
    if(isNaN(amt))return '';
    var cc=money.currencyCode||'EUR';
    var formatted=amt.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
    if(cc==='EUR')return formatted+' \u20ac';
    if(cc==='PLN')return formatted+' z\u0142';
    if(cc==='GBP')return '\u00a3'+formatted;
    if(cc==='USD')return '$'+formatted;
    return formatted+' '+cc;
  }

  var MONTHS_DE=['Januar','Februar','M\u00e4rz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

  function formatProcessedAt(iso){
    if(!iso)return '';
    var d=new Date(iso);
    if(isNaN(d.getTime()))return '';
    var dd=String(d.getDate());if(dd.length<2)dd='0'+dd;
    return dd+'. '+MONTHS_DE[d.getMonth()]+' '+d.getFullYear();
  }

  function getLineItems(o){
    return o&&o.lineItems&&o.lineItems.nodes||[];
  }

  function getOrderItemCount(o){
    var items=getLineItems(o);
    var sum=0;
    for(var i=0;i<items.length;i++){
      sum+=Number(items[i].quantity)||0;
    }
    return sum;
  }

  function getThumbInitials(title){
    if(!title)return '?';
    var t=String(title);
    // Find first letter-sequence; excludes digits, ×, ÷, hyphens.
    // Range: A-Z, a-z, plus Latin-1 letters (À-Ö, Ø-ö, ø-ÿ) — Ü, Ä, Ö, ß all included.
    var m=t.match(/[A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff]+/);
    if(!m)return '?';
    return m[0].slice(0,2).toUpperCase();
  }

  // Returns CSS-modifier name (without prefix) — appended to data-kph-status-class prefix
  // Designer has: kp-pill-status--produktion | --versendet | --abgeschlossen
  // We map: storniert (refund/void) | versendet (fulfilled or partial) | produktion (otherwise)
  // "abgeschlossen" is bucket-only (FULFILLED + > 30 days) — used by filter, not pill
  function orderStatusModifier(o){
    if(!o)return '';
    var fs=o.financialStatus;
    var ff=o.fulfillmentStatus;
    if(fs==='REFUNDED'||fs==='VOIDED')return 'storniert';
    if(ff==='FULFILLED'||ff==='PARTIALLY_FULFILLED')return 'versendet';
    return 'produktion';
  }

  // Bucket for filter pills. FULFILLED + >30 days = "completed", sonst "shipped".
  function orderBucket(o){
    if(!o)return '';
    var fs=o.financialStatus;
    var ff=o.fulfillmentStatus;
    if(fs==='REFUNDED'||fs==='VOIDED')return 'cancelled';
    if(ff==='FULFILLED'){
      if(o.processedAt){
        var d=new Date(o.processedAt);
        if(!isNaN(d.getTime())){
          var daysAgo=(Date.now()-d.getTime())/86400000;
          if(daysAgo>30)return 'completed';
        }
      }
      return 'shipped';
    }
    if(ff==='PARTIALLY_FULFILLED')return 'shipped';
    return 'production';
  }

  function countOrdersByBucket(c,bucket){
    if(!c||!c.orders||!c.orders.nodes)return 0;
    var n=0;
    for(var i=0;i<c.orders.nodes.length;i++){
      if(orderBucket(c.orders.nodes[i])===bucket)n++;
    }
    return n;
  }

  // Order-summary text — used in .kp-order-name slot
  // 0 items → '' | 1 → title | 2 → "A + B" | 3+ → "A + B +N"
  function orderSummary(o){
    var items=getLineItems(o);
    if(items.length===0)return '';
    if(items.length===1)return items[0].title||'';
    if(items.length===2)return (items[0].title||'')+' + '+(items[1].title||'');
    return (items[0].title||'')+' + '+(items[1].title||'')+' +'+(items.length-2);
  }

  // Meta-line — used in .kp-order-meta slot
  function orderMetaLine(o){
    var n=getOrderItemCount(o);
    var statusLbl=orderStatusLabel(o);
    return n+' Artikel'+(statusLbl?' \u00b7 '+statusLbl:'');
  }

  // -----------------------------------------------------------------
  // Phase 8.7 — Bestelldetail helpers: URL routing, order lookup, formatting
  // -----------------------------------------------------------------
  function getOrderIdFromUrl(){
    try{
      var p=new URLSearchParams(location.search);
      return p.get('id');
    }catch(e){
      return null;
    }
  }

  function findOrderByGid(c,gid){
    if(!c||!c.orders||!c.orders.nodes||!gid)return null;
    for(var i=0;i<c.orders.nodes.length;i++){
      if(c.orders.nodes[i].id===gid)return c.orders.nodes[i];
    }
    return null;
  }

  function findOrderByName(c,name){
    if(!c||!c.orders||!c.orders.nodes||!name)return null;
    for(var i=0;i<c.orders.nodes.length;i++){
      if(c.orders.nodes[i].name===name)return c.orders.nodes[i];
    }
    return null;
  }

  function getDetailOrder(c){
    if(!c)return null;
    var idParam=getOrderIdFromUrl();
    if(!idParam)return null;
    // GID format: "gid://shopify/Order/12345" — Bestellungen-Liste in v1.6.x baut Links so
    if(idParam.indexOf('gid://')===0)return findOrderByGid(c,idParam);
    // Name format: "KP-2026-1004" — preferred URL-friendly form
    return findOrderByName(c,idParam);
  }

  function isOnOrderDetailPage(){
    return location.pathname.indexOf('/account/bestellung-detail')===0;
  }

  // Context-aware order resolution — Hub-Page uses latestOrder, Bestelldetail uses URL-Order.
  // Used by showIfRules order.hasEta, order.hasTracking, order.hasTax to work on both pages
  // with same attribute keys.
  function resolveOrderContext(c){
    if(!c)return null;
    if(isOnOrderDetailPage())return getDetailOrder(c);
    return latestOrder(c);
  }

  // "12. Mai" — short format (no year, no time)
  function formatDateShort(iso){
    if(!iso)return '';
    var d=new Date(iso);
    if(isNaN(d.getTime()))return '';
    return d.getDate()+'. '+MONTHS_DE[d.getMonth()];
  }

  // 4-Step state machine for Bestelldetail Timeline.
  // Returns array of {key, state, dateLabel, title, note}.
  // States: 'done' | 'current' | 'upcoming'
  function getTimelineSteps(order){
    if(!order)return [];
    var fStatus=(order.fulfillmentStatus||'').toUpperCase();
    var finStatus=(order.financialStatus||'').toUpperCase();
    var fulfillment=order.fulfillments&&order.fulfillments.nodes&&order.fulfillments.nodes[0]||null;
    var fulfillmentStatus=(fulfillment&&fulfillment.status||'').toUpperCase();

    var isDelivered=fulfillmentStatus==='DELIVERED';
    var isShipped=fStatus==='FULFILLED'||fStatus==='PARTIALLY_FULFILLED';
    var isPaid=finStatus==='PAID'||finStatus==='PARTIALLY_PAID';
    var isInProduction=!isShipped&&!isDelivered&&isPaid;

    var shippedDate=fulfillment&&fulfillment.createdAt||null;
    var etaIso=fulfillment&&fulfillment.estimatedDeliveryAt||null;

    return [
      {
        key:'received',
        state:'done',
        dateLabel:formatDateShort(order.processedAt),
        title:'Bestellung eingegangen',
        note:isPaid?'Zahlung best\u00e4tigt':'Wartet auf Zahlung'
      },
      {
        key:'production',
        state:isShipped||isDelivered?'done':(isInProduction?'current':'upcoming'),
        dateLabel:isInProduction?'seit '+formatDateShort(order.processedAt):'',
        title:'In der Werkstatt',
        note:'Tischplatte wird zugeschnitten und ge\u00f6lt'
      },
      {
        key:'shipped',
        state:isDelivered?'done':(isShipped?'current':'upcoming'),
        dateLabel:isShipped?formatDateShort(shippedDate):'',
        title:'Versendet',
        note:fulfillment&&fulfillment.trackingInformation&&fulfillment.trackingInformation.company
          ?fulfillment.trackingInformation.company
          :'DHL Speditionsversand \u00b7 2\u20134 Werktage'
      },
      {
        key:'delivered',
        state:isDelivered?'current':'upcoming',
        dateLabel:etaIso?'voraussichtlich \u00b7 '+formatDateShort(etaIso):'',
        title:'Geliefert',
        note:''
      }
    ];
  }

  // -----------------------------------------------------------------
  // Phase 8.7 — Bestelldetail field resolvers
  // -----------------------------------------------------------------
  function computeEstimatedShippingLabel(order){
    if(!order)return '';
    var fulfillment=order.fulfillments&&order.fulfillments.nodes&&order.fulfillments.nodes[0];
    if(fulfillment&&fulfillment.estimatedDeliveryAt){
      return 'Voraussichtlich versandt am '+formatProcessedAt(fulfillment.estimatedDeliveryAt);
    }
    if((order.fulfillmentStatus||'').toUpperCase()==='FULFILLED')return 'Versendet';
    return 'In Bearbeitung';
  }

  function formatShippingLabel(order){
    if(!order)return '';
    if(order.totalShipping&&parseFloat(order.totalShipping.amount)>0){
      return 'Spedition \u00b7 '+formatPrice(order.totalShipping);
    }
    return 'Versandkostenfrei';
  }

  function computeSubtotalLabel(order){
    if(!order)return '';
    if(order.subtotal)return formatPrice(order.subtotal);
    // Fallback: total - shipping - tax
    if(!order.totalPrice)return '';
    var total=parseFloat(order.totalPrice.amount)||0;
    var ship=order.totalShipping?parseFloat(order.totalShipping.amount)||0:0;
    var tax=order.totalTax?parseFloat(order.totalTax.amount)||0:0;
    var sub=total-ship-tax;
    return formatPrice({amount:String(sub),currencyCode:order.totalPrice.currencyCode});
  }

  function resolveOrderDetailField(order,key){
    if(!order)return '';
    switch(key){
      case 'name':                   return order.name||'';
      case 'processedAtLong':        return formatProcessedAt(order.processedAt);
      case 'estimatedShippingLabel': return computeEstimatedShippingLabel(order);
      case 'shippingAddressLines':   return order.shippingAddress&&order.shippingAddress.formatted||[];
      case 'billingAddressLines':{
        var b=order.billingAddress&&order.billingAddress.formatted;
        var s=order.shippingAddress&&order.shippingAddress.formatted;
        if(b&&b.length)return b;
        return s||[];
      }
      case 'shippingLabel':          return formatShippingLabel(order);
      case 'subtotalLabel':          return computeSubtotalLabel(order);
      case 'taxLabel':               return formatPrice(order.totalTax);
      case 'totalLabel':             return formatPrice(order.totalPrice);
      case 'paymentMethod':          return ''; // not in Customer Account API
      case 'trackingUrl':            return getTrackingUrl(order)||'';
      default:                       return '';
    }
  }

  function resolveLineItemField(item,key){
    if(!item)return '';
    switch(key){
      case 'title':         return item.title||'';
      case 'variantTitle':  return item.variantTitle||'';
      case 'sku':           return item.sku||'';
      case 'qtyLabel':      return 'Menge: '+(item.quantity||1);
      case 'priceLabel':    return item.price?formatPrice(item.price):'';
      case 'thumbInitials': return getThumbInitials(item.title);
      default:              return item[key]==null?'':String(item[key]);
    }
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
    // Phase 8.6c — Member-since (account creationDate, DE-format)
    'customer.memberSince':{kind:'text',resolve:function(c){
      return c&&c.creationDate?formatProcessedAt(c.creationDate):'';
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
    }},
    // Phase 8.6a — Bestellungen-Liste counters (Sub-Header + 4 Filter-Pills)
    'orders.count':{kind:'text',resolve:function(c){
      return counters.orders(c);
    }},
    'orderCounts.all':{kind:'text',resolve:function(c){
      return counters.orders(c);
    }},
    'orderCounts.production':{kind:'text',resolve:function(c){
      return countOrdersByBucket(c,'production');
    }},
    'orderCounts.shipped':{kind:'text',resolve:function(c){
      return countOrdersByBucket(c,'shipped');
    }},
    'orderCounts.completed':{kind:'text',resolve:function(c){
      return countOrdersByBucket(c,'completed');
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
      return !!(c&&c.orders&&c.orders.nodes&&c.orders.nodes.length===0);
    },
    'orders.notEmpty':function(c){
      return !!(c&&c.orders&&c.orders.nodes&&c.orders.nodes.length>0);
    },
    'wishlist.empty':function(c){
      return !!c&&counters.wishlist(c)===0;
    },
    'wishlist.notEmpty':function(c){
      return !!c&&counters.wishlist(c)>0;
    },
    'addresses.empty':function(c){
      return !!c&&counters.addresses(c)===0;
    },
    'addresses.notEmpty':function(c){
      return !!c&&counters.addresses(c)>0;
    },
    'order.hasEta':function(c){
      return !!getEtaIso(resolveOrderContext(c));
    },
    'order.hasTracking':function(c){
      return !!getTrackingUrl(resolveOrderContext(c));
    },
    // Phase 8.7 — Bestelldetail show-ifs (context-aware via resolveOrderContext)
    'order.hasTax':function(c){
      var o=resolveOrderContext(c);
      return !!(o&&o.totalTax&&parseFloat(o.totalTax.amount)>0);
    },
    'order.hasInvoice':function(c){
      // Phase 9: Sufio for Shopify integration via order.metafield(namespace:"sufio",key:"invoice_pdf_url")
      // V1: button always hidden
      return false;
    },
    'order.hasPaymentMethod':function(c){
      // Customer Account API does not expose payment method — Phase 9+ via Order-Status-Page-Scrape or metafield
      return false;
    },
    // Phase 8.6c+ — Auth-State (customer===null = guest, customer truthy = user)
    'auth.guest':function(c){
      return c===null;
    },
    'auth.user':function(c){
      return c!==null;
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
      el.classList.remove('kph-loading','kph-ready','kph-error','kph-guest');
      el.classList.add('kph-'+state);
    }
  }

  // Phase 8.6c+ — Guest-State (no token / no customer)
  function renderGuest(){
    renderShowIfs(null); // null-safe rules: auth.guest=true, auth.user=false, others=false
    var preHide=document.getElementById('kph-prehide');
    if(preHide&&preHide.parentNode)preHide.parentNode.removeChild(preHide);
    setStateClass('guest');
    log('render','guest state — auth-required UI shown');
  }

  function renderShowIfs(customer){
    var nodes=document.querySelectorAll('[data-kph-show-if]');
    var skipped=0;
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      // Skip item-scoped show-ifs (inside template or cloned items) —
      // those are resolved by applyAddressBindings against the item, not the customer.
      if(el.closest&&el.closest('[data-kph-rendered],[data-kph-tpl]')){
        skipped++;
        continue;
      }
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
    log('render','show-if nodes scanned',{total:nodes.length,skipped:skipped});
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
  // Phase 8.5a — Address list rendering (item-scoped)
  // -----------------------------------------------------------------
  function resolveAddressField(addr,key){
    if(!addr)return '';
    if(key==='fullName'){
      var fn=(addr.firstName||'').trim();
      var ln=(addr.lastName||'').trim();
      var name=(fn+' '+ln).replace(/\s+/g,' ').trim();
      if(name)return name;
      if(addr.company)return addr.company;
      return '\u2014';
    }
    if(key==='formatted')return addr.formatted||[];
    if(key==='phoneNumber')return addr.phoneNumber||'';
    if(key==='company')return addr.company||'';
    return addr[key]==null?'':String(addr[key]);
  }

  function applyAddressBindings(root,addr){
    // [data-kph-bind-text] — single text node
    var texts=root.querySelectorAll('[data-kph-bind-text]');
    for(var i=0;i<texts.length;i++){
      var tkey=texts[i].getAttribute('data-kph-bind-text');
      try{
        var tval=resolveAddressField(addr,tkey);
        texts[i].textContent=tval==null?'':String(tval);
      }catch(e){
        log('list','bind-text-fail',{key:tkey,err:String(e)});
      }
    }
    // [data-kph-bind-lines] — array → child divs + optional phone
    var lines=root.querySelectorAll('[data-kph-bind-lines]');
    for(var j=0;j<lines.length;j++){
      var lkey=lines[j].getAttribute('data-kph-bind-lines');
      var el=lines[j];
      el.innerHTML='';
      try{
        var arr=resolveAddressField(addr,lkey);
        if(Array.isArray(arr)){
          for(var k=0;k<arr.length;k++){
            var ln=document.createElement('div');
            ln.textContent=arr[k];
            el.appendChild(ln);
          }
        }
        // Phone is NOT included in `formatted` — render below if present
        if(addr.phoneNumber){
          var ph=document.createElement('div');
          ph.className='kp-address-card-phone';
          ph.style.marginTop='4px';
          ph.textContent=addr.phoneNumber;
          el.appendChild(ph);
        }
      }catch(e){
        log('list','bind-lines-fail',{key:lkey,err:String(e)});
      }
    }
    // [data-kph-show-if] — item-scoped: isDefault / !isDefault
    var sifs=root.querySelectorAll('[data-kph-show-if]');
    for(var m=0;m<sifs.length;m++){
      var sif=sifs[m].getAttribute('data-kph-show-if');
      var visible;
      if(sif==='isDefault')visible=!!addr.isDefault;
      else if(sif==='!isDefault')visible=!addr.isDefault;
      else continue; // Don't touch global show-ifs from item scope
      sifs[m].style.display=visible?'':'none';
    }
  }

  function renderAddressList(customer){
    var grid=document.querySelector('[data-kph-list="addresses"]');
    if(!grid){
      log('list','no address-list container on page');
      return;
    }
    // Phase 8.5c+d — inject modal DOM here so wireActions() catches its buttons
    injectAddressModal();
    var tpl=grid.querySelector('[data-kph-tpl="address-card"]');
    if(!tpl){
      log('list','no address-card template inside grid');
      return;
    }
    // Cleanup previous renders (re-render safe)
    var prev=grid.querySelectorAll('[data-kph-rendered="address-card"]');
    for(var i=0;i<prev.length;i++){
      prev[i].parentNode.removeChild(prev[i]);
    }
    var nodes=customer&&customer.addresses&&customer.addresses.nodes||[];
    var defaultId=customer&&customer.defaultAddress&&customer.defaultAddress.id||null;
    log('list','rendering addresses',{count:nodes.length,defaultId:defaultId});
    // Anchor: insert before Add-Card if present, else append to grid
    var addCard=grid.querySelector('[data-kph-action="address-create"]');
    for(var j=0;j<nodes.length;j++){
      var addr=nodes[j];
      addr.isDefault=(defaultId!=null&&addr.id===defaultId);
      var clone=tpl.cloneNode(true);
      clone.removeAttribute('data-kph-tpl');
      clone.setAttribute('data-kph-rendered','address-card');
      clone.setAttribute('data-kph-address-id',addr.id);
      if(addr.isDefault)clone.classList.add('kp-address-card--default');
      applyAddressBindings(clone,addr);
      if(addCard)grid.insertBefore(clone,addCard);
      else grid.appendChild(clone);
      log('list','card rendered',{id:addr.id,isDefault:addr.isDefault,name:resolveAddressField(addr,'fullName')});
    }
  }

  // -----------------------------------------------------------------
  // Phase 8.6a — Order list rendering (item-scoped, parallel to Address)
  // -----------------------------------------------------------------
  function resolveOrderField(o,key){
    if(!o)return '';
    switch(key){
      case 'name':                 return o.name||'';
      case 'processedAtFormatted': return formatProcessedAt(o.processedAt);
      case 'totalPrice':           return formatPrice(o.totalPrice);
      case 'statusLabel':          return orderStatusLabel(o);
      case 'statusModifier':       return orderStatusModifier(o);
      case 'lineItemsSummary':     return orderSummary(o);
      case 'metaLine':             return orderMetaLine(o);
      case 'detailUrl':            return orderDetailUrl(o);
      case 'trackingUrl':          return getTrackingUrl(o)||'';
      default:                     return o[key]==null?'':String(o[key]);
    }
  }

  function applyOrderBindings(root,order){
    // Helper: querySelectorAll + include root if matches (querySelectorAll excludes root)
    function self(sel){
      var nodes=root.querySelectorAll(sel);
      var arr=[];
      if(root.matches&&root.matches(sel))arr.push(root);
      for(var i=0;i<nodes.length;i++)arr.push(nodes[i]);
      return arr;
    }
    // [data-kph-bind-text] — text content (reused from address-pattern)
    var texts=self('[data-kph-bind-text]');
    for(var i=0;i<texts.length;i++){
      var tkey=texts[i].getAttribute('data-kph-bind-text');
      try{
        texts[i].textContent=String(resolveOrderField(order,tkey)||'');
      }catch(e){log('list','order-bind-text-fail',{key:tkey,err:String(e)})}
    }
    // [data-kph-bind-href] — Card link, tracking link (NEW in 8.6a)
    var hrefs=self('[data-kph-bind-href]');
    for(var j=0;j<hrefs.length;j++){
      var hkey=hrefs[j].getAttribute('data-kph-bind-href');
      try{
        var hval=resolveOrderField(order,hkey);
        hrefs[j].setAttribute('href',hval||'#');
      }catch(e){log('list','order-bind-href-fail',{key:hkey,err:String(e)})}
    }
    // [data-kph-status-class="kp-pill-status"] — append --{modifier}
    var statusEls=self('[data-kph-status-class]');
    for(var k=0;k<statusEls.length;k++){
      var prefix=statusEls[k].getAttribute('data-kph-status-class');
      var mod=resolveOrderField(order,'statusModifier');
      var cls=(statusEls[k].className||'').split(/\s+/);
      var kept=[];
      for(var l=0;l<cls.length;l++){
        if(cls[l]&&cls[l].indexOf(prefix+'--')!==0)kept.push(cls[l]);
      }
      if(mod)kept.push(prefix+'--'+mod);
      statusEls[k].className=kept.join(' ').replace(/\s+/g,' ').trim();
    }
    // [data-kph-thumbs] — custom thumb-strip rendering
    var thumbsCtns=self('[data-kph-thumbs]');
    for(var m=0;m<thumbsCtns.length;m++){
      renderOrderThumbs(thumbsCtns[m],order);
    }
  }

  function renderOrderThumbs(container,order){
    container.innerHTML='';
    var items=getLineItems(order);
    var maxShown=3;
    var shown=Math.min(items.length,maxShown);
    for(var i=0;i<shown;i++){
      var item=items[i];
      var t=document.createElement('div');
      t.className='kp-order-thumb';
      if(item.image&&item.image.url){
        var img=document.createElement('img');
        img.src=item.image.url;
        img.alt=item.image.altText||item.title||'';
        img.loading='lazy';
        t.appendChild(img);
        t.classList.add('kp-order-thumb--img');
      }else{
        t.textContent=getThumbInitials(item.title);
      }
      container.appendChild(t);
    }
    if(items.length>maxShown){
      var more=document.createElement('div');
      more.className='kp-order-thumb kp-order-thumb--more';
      more.textContent='+'+(items.length-maxShown);
      container.appendChild(more);
    }
  }

  function renderOrderList(customer){
    var list=document.querySelector('[data-kph-list="orders"]');
    if(!list){
      log('list','no order-list container on page');
      return;
    }
    var tpl=list.querySelector('[data-kph-tpl="order-card"]');
    if(!tpl){
      log('list','no order-card template inside list');
      return;
    }
    // Cleanup previous renders (re-render safe)
    var prev=list.querySelectorAll('[data-kph-rendered="order-card"]');
    for(var i=0;i<prev.length;i++){
      prev[i].parentNode.removeChild(prev[i]);
    }
    var nodes=customer&&customer.orders&&customer.orders.nodes||[];
    log('list','rendering orders',{count:nodes.length});
    for(var j=0;j<nodes.length;j++){
      var order=nodes[j];
      var clone=tpl.cloneNode(true);
      clone.removeAttribute('data-kph-tpl');
      clone.setAttribute('data-kph-rendered','order-card');
      clone.setAttribute('data-kph-order-id',order.id||'');
      clone.setAttribute('data-kph-order-bucket',orderBucket(order));
      applyOrderBindings(clone,order);
      // Insert after template (template stays hidden via [data-kph-tpl]{display:none} CSS)
      tpl.parentNode.appendChild(clone);
      log('list','order card rendered',{id:order.id,name:order.name,bucket:orderBucket(order)});
    }
  }

  // Phase 8.6b — Filter pills (click toggles active + filters cards by bucket)
  function wireFilterPills(){
    var pills=document.querySelectorAll('[data-kph-filter]');
    if(pills.length===0){
      return;
    }
    var newCount=0;
    for(var i=0;i<pills.length;i++){
      if(pills[i].getAttribute('data-kph-filter-wired'))continue;
      (function(pill){
        pill.addEventListener('click',function(e){
          if(e&&e.preventDefault)e.preventDefault();
          var bucket=pill.getAttribute('data-kph-filter');
          // Toggle active class — remove from all, add to clicked
          var all=document.querySelectorAll('[data-kph-filter]');
          for(var k=0;k<all.length;k++){
            all[k].classList.remove('kp-filter-pill--active');
          }
          pill.classList.add('kp-filter-pill--active');
          filterOrders(bucket);
          log('filter','clicked',{bucket:bucket});
        });
      })(pills[i]);
      pills[i].setAttribute('data-kph-filter-wired','1');
      newCount++;
    }
    log('filter','pills wired',{newWires:newCount,totalPills:pills.length});
  }

  function filterOrders(bucket){
    var cards=document.querySelectorAll('[data-kph-rendered="order-card"]');
    var shown=0;
    for(var i=0;i<cards.length;i++){
      var cardBucket=cards[i].getAttribute('data-kph-order-bucket')||'';
      var visible=(bucket==='all'||cardBucket===bucket);
      cards[i].style.display=visible?'':'none';
      if(visible)shown++;
    }
    log('filter','applied',{bucket:bucket,shown:shown,total:cards.length});
  }

  // -----------------------------------------------------------------
  // Phase 8.7 — Bestelldetail-Page rendering
  // -----------------------------------------------------------------
  function renderOrderDetail(customer){
    if(!isOnOrderDetailPage())return;
    if(!customer){
      log('detail','no customer — skip');
      return;
    }
    var order=getDetailOrder(customer);
    if(!order){
      var idParam=getOrderIdFromUrl();
      log('detail','order not found',{idParam:idParam,ordersAvailable:customer.orders&&customer.orders.nodes?customer.orders.nodes.length:0});
      // V1: bind elements stay empty. Phase 8.7-Polish: add "not found" empty state.
      return;
    }
    applyOrderDetailBindingsGlobal(order);
    renderTimeline(order);
    renderLineItemsList(order);
    wireReorderAction(order);
    log('detail','rendered',{name:order.name,id:order.id});
  }

  // Walks data-kph-bind-text and data-kph-bind-lines with "order.*" keys outside template clones,
  // resolves against the URL-detail order. Item-scoped clones are handled by applyLineItemBindings.
  // step.* keys are handled by renderTimeline.
  function applyOrderDetailBindingsGlobal(order){
    if(!order)return;
    var texts=document.querySelectorAll('[data-kph-bind-text]');
    for(var i=0;i<texts.length;i++){
      var el=texts[i];
      if(el.closest&&el.closest('[data-kph-rendered],[data-kph-tpl]'))continue;
      var key=el.getAttribute('data-kph-bind-text');
      if(!key||key.indexOf('order.')!==0)continue;
      try{
        var val=resolveOrderDetailField(order,key.substring(6));
        el.textContent=val==null?'':String(val);
      }catch(e){
        log('detail','bind-text-fail',{key:key,err:String(e)});
      }
    }
    var lines=document.querySelectorAll('[data-kph-bind-lines]');
    for(var j=0;j<lines.length;j++){
      var lEl=lines[j];
      if(lEl.closest&&lEl.closest('[data-kph-rendered],[data-kph-tpl]'))continue;
      var lKey=lEl.getAttribute('data-kph-bind-lines');
      if(!lKey||lKey.indexOf('order.')!==0)continue;
      lEl.innerHTML='';
      try{
        var arr=resolveOrderDetailField(order,lKey.substring(6));
        if(Array.isArray(arr)){
          for(var k=0;k<arr.length;k++){
            var ln=document.createElement('div');
            ln.textContent=arr[k];
            lEl.appendChild(ln);
          }
        }
      }catch(e){
        log('detail','bind-lines-fail',{key:lKey,err:String(e)});
      }
    }
    log('detail','global bindings applied');
  }

  function renderTimeline(order){
    var tl=document.querySelector('[data-kph-timeline]');
    if(!tl)return;
    var steps=getTimelineSteps(order);
    for(var i=0;i<steps.length;i++){
      var s=steps[i];
      var stepEl=tl.querySelector('[data-kph-step="'+s.key+'"]');
      if(!stepEl)continue;
      // Reset modifier classes, then add current state
      stepEl.classList.remove('kp-timeline-step--done','kp-timeline-step--current','kp-timeline-step--upcoming');
      stepEl.classList.add('kp-timeline-step--'+s.state);
      // Bind text via step.* keys
      var labelEl=stepEl.querySelector('[data-kph-bind-text="step.dateLabel"]');
      if(labelEl)labelEl.textContent=s.dateLabel||'';
      var titleEl=stepEl.querySelector('[data-kph-bind-text="step.title"]');
      if(titleEl)titleEl.textContent=s.title||'';
      var noteEl=stepEl.querySelector('[data-kph-bind-text="step.note"]');
      if(noteEl)noteEl.textContent=s.note||'';
    }
    log('detail','timeline rendered',{steps:steps.length});
  }

  function renderLineItemsList(order){
    var list=document.querySelector('[data-kph-list="lineItems"]');
    if(!list)return;
    var tpl=list.querySelector('[data-kph-tpl="line-item"]');
    if(!tpl){
      log('detail','no line-item template inside list');
      return;
    }
    // Cleanup previous renders (re-render safe)
    var prev=list.querySelectorAll('[data-kph-rendered="line-item"]');
    for(var i=0;i<prev.length;i++){
      prev[i].parentNode.removeChild(prev[i]);
    }
    var items=getLineItems(order);
    log('detail','rendering lineItems',{count:items.length});
    for(var j=0;j<items.length;j++){
      var item=items[j];
      var clone=tpl.cloneNode(true);
      clone.removeAttribute('data-kph-tpl');
      clone.setAttribute('data-kph-rendered','line-item');
      applyLineItemBindings(clone,item);
      tpl.parentNode.appendChild(clone);
    }
  }

  function applyLineItemBindings(root,item){
    if(!item)return;
    // data-kph-bind-text within clone — only item.* keys
    var texts=root.querySelectorAll('[data-kph-bind-text]');
    for(var i=0;i<texts.length;i++){
      var key=texts[i].getAttribute('data-kph-bind-text');
      if(!key||key.indexOf('item.')!==0)continue;
      try{
        var val=resolveLineItemField(item,key.substring(5));
        texts[i].textContent=val==null?'':String(val);
      }catch(e){
        log('detail','item-bind-fail',{key:key,err:String(e)});
      }
    }
    // data-kph-thumb — render image OR initials fallback
    var thumbs=root.querySelectorAll('[data-kph-thumb]');
    for(var j=0;j<thumbs.length;j++){
      var thumb=thumbs[j];
      thumb.innerHTML='';
      if(item.image&&item.image.url){
        var img=document.createElement('img');
        img.src=item.image.url;
        img.alt=item.image.altText||item.title||'';
        img.loading='lazy';
        img.style.width='100%';
        img.style.height='100%';
        img.style.objectFit='cover';
        thumb.appendChild(img);
        thumb.classList.add('kp-detail-item-thumb--img');
      }else{
        thumb.textContent=getThumbInitials(item.title);
        thumb.classList.remove('kp-detail-item-thumb--img');
      }
    }
  }

  function wireReorderAction(order){
    var btn=document.querySelector('[data-kph-action="reorder"]');
    if(!btn||btn.__kphWired)return;
    btn.__kphWired=true;
    btn.style.cursor='pointer';
    btn.addEventListener('click',function(ev){
      ev.preventDefault();
      // MVP-Stub: shopify-handle CMS-field aktuell null → echte Cart-Add nicht möglich.
      // Phase 9: shopyflow.cart.add({merchandiseId, quantity}) pro lineItem.
      alert('„Erneut bestellen" ist in Vorbereitung. Du findest unsere Produkte aktuell direkt im Shop \u2014 wir leiten dich weiter.');
      location.href='/produkte';
      log('action','reorder MVP-stub triggered',{orderName:order&&order.name});
    });
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
  // Phase 8.5b+c+d — Address mutations
  // -----------------------------------------------------------------
  // CustomerAddressInput fields (alle optional Strings):
  //   firstName, lastName, address1, address2, city, company,
  //   territoryCode, phoneNumber, zoneCode, zip
  // Mutation responses:
  //   customerAddress{id} + userErrors{field message code}
  function buildAddressInputLiteral(fields){
    var parts=[];
    var keys=['firstName','lastName','company','address1','address2','city','zip','phoneNumber','territoryCode','zoneCode'];
    for(var i=0;i<keys.length;i++){
      var k=keys[i];
      var v=fields[k];
      if(v==null||v==='')continue;
      parts.push(k+':"'+escGql(String(v))+'"');
    }
    return '{'+parts.join(',')+'}';
  }

  function mutAddressCreate(token,fields,isDefault){
    var addrLit=buildAddressInputLiteral(fields);
    var defLit=isDefault?',defaultAddress:true':'';
    var q='mutation{customerAddressCreate(address:'+addrLit+defLit+'){customerAddress{id} userErrors{field message code}}}';
    return gql(q,token,'mut.customerAddressCreate');
  }

  function mutAddressUpdate(token,addressId,fields,isDefault){
    var addrLit=buildAddressInputLiteral(fields);
    var hasFields=addrLit!=='{}';
    var defLit=(isDefault===true||isDefault===false)?(',defaultAddress:'+(isDefault?'true':'false')):'';
    var addrArg=hasFields?(',address:'+addrLit):'';
    var q='mutation{customerAddressUpdate(addressId:"'+escGql(addressId)+'"'+addrArg+defLit+'){customerAddress{id} userErrors{field message code}}}';
    return gql(q,token,'mut.customerAddressUpdate');
  }

  function mutAddressDelete(token,addressId){
    var q='mutation{customerAddressDelete(addressId:"'+escGql(addressId)+'"){deletedAddressId userErrors{field message code}}}';
    return gql(q,token,'mut.customerAddressDelete');
  }

  // -----------------------------------------------------------------
  // Phase 8.5c+d — Address modal form (DOM-injected, no Designer setup)
  // -----------------------------------------------------------------
  var COUNTRY_OPTIONS=[
    ['DE','Deutschland'],['PL','Polen'],['AT','Österreich'],['CH','Schweiz'],
    ['NL','Niederlande'],['BE','Belgien'],['LU','Luxemburg'],['FR','Frankreich'],
    ['IT','Italien'],['ES','Spanien'],['GB','Vereinigtes Königreich'],['IE','Irland'],
    ['CZ','Tschechien'],['SK','Slowakei'],['DK','Dänemark'],['SE','Schweden'],
    ['NO','Norwegen'],['FI','Finnland']
  ];

  function findAddress(addrId){
    if(!customerCtx||!customerCtx.addresses||!customerCtx.addresses.nodes)return null;
    var nodes=customerCtx.addresses.nodes;
    for(var i=0;i<nodes.length;i++){
      if(nodes[i].id===addrId)return nodes[i];
    }
    return null;
  }

  function buildCountrySelectHtml(){
    var opts='';
    for(var i=0;i<COUNTRY_OPTIONS.length;i++){
      var c=COUNTRY_OPTIONS[i];
      opts+='<option value="'+c[0]+'">'+c[1]+'</option>';
    }
    return opts;
  }

  function injectAddressModal(){
    if(document.getElementById('kph-address-modal'))return;
    var html=
      '<div id="kph-address-modal" class="kph-modal" data-kph-modal="address-form" style="display:none">'+
        '<div class="kph-modal-backdrop" data-kph-action="address-cancel"></div>'+
        '<div class="kph-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="kph-form-title">'+
          '<header class="kph-modal-head">'+
            '<h2 id="kph-form-title" data-kph-form-title>Neue Adresse</h2>'+
            '<button type="button" class="kph-modal-close" data-kph-action="address-cancel" aria-label="Schließen">×</button>'+
          '</header>'+
          '<div class="kph-form-grid">'+
            '<div class="kph-row-2">'+
              '<label class="kph-field"><span>Vorname *</span><input type="text" data-kph-field="firstName" required></label>'+
              '<label class="kph-field"><span>Nachname *</span><input type="text" data-kph-field="lastName" required></label>'+
            '</div>'+
            '<label class="kph-field"><span>Firma (optional)</span><input type="text" data-kph-field="company"></label>'+
            '<label class="kph-field"><span>Straße &amp; Hausnummer *</span><input type="text" data-kph-field="address1" required></label>'+
            '<label class="kph-field"><span>Adresszusatz (optional)</span><input type="text" data-kph-field="address2"></label>'+
            '<div class="kph-row-zip">'+
              '<label class="kph-field"><span>PLZ *</span><input type="text" data-kph-field="zip" required></label>'+
              '<label class="kph-field"><span>Stadt *</span><input type="text" data-kph-field="city" required></label>'+
            '</div>'+
            '<div class="kph-row-2">'+
              '<label class="kph-field"><span>Land *</span><select data-kph-field="territoryCode" required>'+buildCountrySelectHtml()+'</select></label>'+
              '<label class="kph-field"><span>Telefon (optional)</span><input type="tel" data-kph-field="phoneNumber"></label>'+
            '</div>'+
            '<label class="kph-checkbox" data-kph-default-wrapper><input type="checkbox" data-kph-field="isDefault"> <span>Als Standardadresse setzen</span></label>'+
          '</div>'+
          '<div class="kph-form-feedback" data-kph-form-feedback></div>'+
          '<footer class="kph-modal-foot">'+
            '<button type="button" class="kph-btn kph-btn-secondary" data-kph-action="address-cancel">Abbrechen</button>'+
            '<button type="button" class="kph-btn kph-btn-primary" data-kph-action="address-save">Speichern</button>'+
          '</footer>'+
        '</div>'+
      '</div>';
    var wrap=document.createElement('div');
    wrap.innerHTML=html;
    document.body.appendChild(wrap.firstChild);
    // ESC key closes modal
    document.addEventListener('keydown',function(ev){
      if(ev.key==='Escape'){
        var m=document.getElementById('kph-address-modal');
        if(m&&m.style.display!=='none')closeAddressForm();
      }
    });
    log('modal','injected');
  }

  function openAddressForm(mode,addr){
    injectAddressModal();
    var modal=document.getElementById('kph-address-modal');
    if(!modal)return;
    modal.setAttribute('data-kph-form-mode',mode);
    if(mode==='edit'&&addr){
      modal.setAttribute('data-kph-editing-id',addr.id);
    }else{
      modal.removeAttribute('data-kph-editing-id');
    }
    // Title
    var title=modal.querySelector('[data-kph-form-title]');
    if(title)title.textContent=mode==='edit'?'Adresse bearbeiten':'Neue Adresse';
    // Populate fields
    var fields=['firstName','lastName','company','address1','address2','city','zip','phoneNumber','territoryCode','zoneCode'];
    for(var i=0;i<fields.length;i++){
      var f=fields[i];
      var el=modal.querySelector('[data-kph-field="'+f+'"]');
      if(!el)continue;
      el.value=(mode==='edit'&&addr&&addr[f]!=null)?addr[f]:'';
    }
    if(mode==='create'){
      var ccEl=modal.querySelector('[data-kph-field="territoryCode"]');
      if(ccEl&&!ccEl.value)ccEl.value='DE';
    }
    // Default-Checkbox
    var defWrap=modal.querySelector('[data-kph-default-wrapper]');
    var defCb=modal.querySelector('[data-kph-field="isDefault"]');
    if(mode==='edit'&&addr&&addr.isDefault){
      // already default — hide checkbox to avoid no-op confusion
      if(defWrap)defWrap.style.display='none';
      if(defCb)defCb.checked=true;
    }else{
      if(defWrap)defWrap.style.display='';
      if(defCb)defCb.checked=false;
    }
    // Clear feedback
    setFormFeedback('','');
    setSaveBusy(false);
    // Show
    modal.style.display='';
    // Focus first input
    setTimeout(function(){
      var first=modal.querySelector('[data-kph-field="firstName"]');
      if(first)try{first.focus();}catch(e){}
    },50);
    log('modal','opened',{mode:mode,addrId:addr?addr.id:null});
  }

  function closeAddressForm(){
    var modal=document.getElementById('kph-address-modal');
    if(!modal)return;
    modal.style.display='none';
    modal.removeAttribute('data-kph-form-mode');
    modal.removeAttribute('data-kph-editing-id');
    log('modal','closed');
  }

  function readAddressForm(){
    var modal=document.getElementById('kph-address-modal');
    if(!modal)return null;
    var data={};
    var fields=['firstName','lastName','company','address1','address2','city','zip','phoneNumber','territoryCode','zoneCode'];
    for(var i=0;i<fields.length;i++){
      var f=fields[i];
      var el=modal.querySelector('[data-kph-field="'+f+'"]');
      data[f]=el?(el.value||'').trim():'';
    }
    var cb=modal.querySelector('[data-kph-field="isDefault"]');
    data.isDefault=!!(cb&&cb.checked);
    return data;
  }

  function validateAddressForm(data){
    var required=['firstName','lastName','address1','city','zip','territoryCode'];
    for(var i=0;i<required.length;i++){
      if(!data[required[i]])return 'Bitte fülle alle Pflichtfelder aus.';
    }
    return null;
  }

  function setFormFeedback(state,msg){
    var modal=document.getElementById('kph-address-modal');
    if(!modal)return;
    var el=modal.querySelector('[data-kph-form-feedback]');
    if(!el)return;
    el.className='kph-form-feedback';
    if(state)el.classList.add('kph-fb-'+state);
    el.textContent=msg||'';
    el.style.display=msg?'':'none';
  }

  function setSaveBusy(busy){
    var modal=document.getElementById('kph-address-modal');
    if(!modal)return;
    var btn=modal.querySelector('[data-kph-action="address-save"]');
    if(!btn)return;
    if(busy){
      btn.setAttribute('aria-busy','true');
      btn.style.pointerEvents='none';
      btn.style.opacity='0.6';
      btn.textContent='Speichere\u2026';
    }else{
      btn.removeAttribute('aria-busy');
      btn.style.pointerEvents='';
      btn.style.opacity='';
      btn.textContent='Speichern';
    }
  }

  function checkTokenForWrite(){
    var tok=readSfTokens();
    if(!tok||tok.expired){
      return {ok:false,msg:'Deine Sitzung ist abgelaufen. Bitte Seite neu laden.'};
    }
    if(tok.msUntilExpiry<TOKEN_MIN_MS_FOR_WRITE){
      return {ok:false,msg:'Deine Sitzung läuft gleich ab. Bitte Seite neu laden, um zu speichern.'};
    }
    return {ok:true,token:tok.accessToken};
  }

  function saveAddressForm(){
    var modal=document.getElementById('kph-address-modal');
    if(!modal)return;
    var mode=modal.getAttribute('data-kph-form-mode')||'create';
    var addrId=modal.getAttribute('data-kph-editing-id');
    var data=readAddressForm();
    var verr=validateAddressForm(data);
    if(verr){setFormFeedback('error',verr);return;}
    var tokCheck=checkTokenForWrite();
    if(!tokCheck.ok){setFormFeedback('error',tokCheck.msg);return;}
    setFormFeedback('info','Speichere…');
    setSaveBusy(true);
    var fields={
      firstName:data.firstName,lastName:data.lastName,
      company:data.company,address1:data.address1,address2:data.address2,
      city:data.city,zip:data.zip,phoneNumber:data.phoneNumber,
      territoryCode:data.territoryCode,zoneCode:data.zoneCode
    };
    var p;
    if(mode==='edit'&&addrId){
      // Only send isDefault if currently NOT default and checkbox is checked
      var current=findAddress(addrId);
      var alreadyDefault=current&&current.isDefault;
      var setDef=(!alreadyDefault&&data.isDefault)?true:undefined;
      p=mutAddressUpdate(tokCheck.token,addrId,fields,setDef);
    }else{
      p=mutAddressCreate(tokCheck.token,fields,data.isDefault);
    }
    p.then(function(res){
      var errs=extractUserErrors(res);
      if(errs.length){
        setSaveBusy(false);
        setFormFeedback('error','Fehler beim Speichern: '+errs.join(' · '));
        log('save','address mutation failed',{errs:errs});
        return;
      }
      log('save','address mutation ok',{mode:mode});
      // Close + refresh
      closeAddressForm();
      window.KPH.refresh();
    }).catch(function(e){
      setSaveBusy(false);
      setFormFeedback('error','Unerwarteter Fehler: '+String(e));
      log('save','address mutation exception',{err:String(e)});
    });
  }

  function deleteAddress(addrId){
    if(!addrId)return;
    if(!window.confirm('Adresse wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.'))return;
    var tokCheck=checkTokenForWrite();
    if(!tokCheck.ok){alert(tokCheck.msg);return;}
    log('action','address-delete starting',{id:addrId});
    mutAddressDelete(tokCheck.token,addrId).then(function(res){
      var errs=extractUserErrors(res);
      if(errs.length){
        alert('Fehler beim Löschen: '+errs.join(' · '));
        log('save','address-delete failed',{errs:errs});
        return;
      }
      log('save','address-delete ok');
      window.KPH.refresh();
    }).catch(function(e){
      alert('Unerwarteter Fehler: '+String(e));
    });
  }

  function setAddressAsDefault(addrId){
    if(!addrId)return;
    var tokCheck=checkTokenForWrite();
    if(!tokCheck.ok){alert(tokCheck.msg);return;}
    log('action','address-set-default starting',{id:addrId});
    mutAddressUpdate(tokCheck.token,addrId,{},true).then(function(res){
      var errs=extractUserErrors(res);
      if(errs.length){
        alert('Fehler: '+errs.join(' · '));
        log('save','set-default failed',{errs:errs});
        return;
      }
      log('save','set-default ok');
      window.KPH.refresh();
    }).catch(function(e){
      alert('Unerwarteter Fehler: '+String(e));
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
    // Save profile buttons
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
    // Phase 8.5b+c+d — Address actions (real handlers)
    wireAddressAction('address-edit',function(addrId){
      var addr=findAddress(addrId);
      if(!addr){log('action','edit-no-address',{id:addrId});return;}
      openAddressForm('edit',addr);
    });
    wireAddressAction('address-delete',function(addrId){
      deleteAddress(addrId);
    });
    wireAddressAction('address-set-default',function(addrId){
      setAddressAsDefault(addrId);
    });
    wireAddressAction('address-create',function(){
      openAddressForm('create',null);
    });
    wireAddressAction('address-cancel',function(){
      closeAddressForm();
    });
    wireAddressAction('address-save',function(){
      saveAddressForm();
    });
    log('action','wired',{toggles:toggles.length,saves:saves.length});
  }

  function wireAddressAction(actionName,handler){
    var els=document.querySelectorAll('[data-kph-action="'+actionName+'"]');
    for(var i=0;i<els.length;i++){
      var el=els[i];
      if(el.__kphWired)continue;
      el.__kphWired=true;
      el.style.cursor='pointer';
      el.addEventListener('click',function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        var card=ev.currentTarget.closest&&ev.currentTarget.closest('[data-kph-address-id]');
        var addrId=card?card.getAttribute('data-kph-address-id'):null;
        try{ handler(addrId,ev); }catch(e){ log('action','handler-fail',{action:actionName,err:String(e)}); }
      });
    }
  }

  function render(customer){
    renderShowIfs(customer);
    renderBindings(customer);
    renderCounts(customer);
    renderAddressList(customer);
    renderOrderList(customer);
    renderOrderDetail(customer);
    wireFilterPills();
    // Pre-hide CSS removed → JS show-if decisions now take effect
    var preHide=document.getElementById('kph-prehide');
    if(preHide&&preHide.parentNode)preHide.parentNode.removeChild(preHide);
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

  function injectHubCSS(){
    if(document.getElementById('kph-css'))return;
    var s=document.createElement('style');
    s.id='kph-css';
    s.textContent=[
      /* Template hide */
      '[data-kph-tpl]{display:none!important}',
      /* Modal */
      '.kph-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;font-family:inherit;font-feature-settings:inherit}',
      '.kph-modal-backdrop{position:absolute;inset:0;background:rgba(10,10,10,0.6);backdrop-filter:blur(2px)}',
      '.kph-modal-dialog{position:relative;background:#fff;border-radius:8px;width:100%;max-width:560px;max-height:calc(100vh - 48px);overflow:auto;box-shadow:0 24px 64px rgba(0,0,0,0.24);display:flex;flex-direction:column}',
      /* Modal header */
      '.kph-modal-head{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #e5e5e5}',
      '.kph-modal-head h2{margin:0;font-family:inherit;font-weight:500;font-size:18px;color:#0a0a0a;letter-spacing:-0.01em}',
      '.kph-modal-close{background:transparent;border:0;cursor:pointer;font-size:24px;line-height:1;color:#0a0a0a;padding:4px 8px;border-radius:4px;font-family:inherit}',
      '.kph-modal-close:hover{background:#f2f2f2}',
      /* Form grid */
      '.kph-form-grid{padding:20px 24px;display:flex;flex-direction:column;gap:14px}',
      '.kph-form-grid .kph-row-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
      '.kph-form-grid .kph-row-zip{display:grid;grid-template-columns:120px 1fr;gap:14px}',
      '@media (max-width:500px){.kph-form-grid .kph-row-2,.kph-form-grid .kph-row-zip{grid-template-columns:1fr}}',
      /* Form fields */
      '.kph-field{display:flex;flex-direction:column;gap:6px;font-family:inherit}',
      '.kph-field>span{font-family:inherit;font-size:12px;font-weight:500;color:#1e1e1e;letter-spacing:0.01em}',
      '.kph-field input,.kph-field select{font-family:inherit;font-feature-settings:inherit;font-size:14px;padding:10px 12px;border:1px solid #e5e5e5;border-radius:6px;background:#fff;color:#0a0a0a;outline:none;transition:border-color 0.15s}',
      '.kph-field input:focus,.kph-field select:focus{border-color:#1e1e1e}',
      '.kph-field select{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'><path d=\'M1 1l5 5 5-5\' stroke=\'%231e1e1e\' fill=\'none\' stroke-width=\'1.5\'/></svg>");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}',
      /* Checkbox row */
      '.kph-checkbox{display:flex;align-items:center;gap:10px;cursor:pointer;font-family:inherit;font-size:13px;color:#1e1e1e;user-select:none;padding-top:4px}',
      '.kph-checkbox input{cursor:pointer;width:16px;height:16px;accent-color:#0a0a0a}',
      /* Feedback */
      '.kph-form-feedback{padding:0 24px;font-family:inherit;font-size:13px;line-height:1.4}',
      '.kph-form-feedback.kph-fb-info{color:#1e1e1e}',
      '.kph-form-feedback.kph-fb-success{color:#1f5e2d}',
      '.kph-form-feedback.kph-fb-error{color:#a8302b}',
      /* Modal footer */
      '.kph-modal-foot{padding:16px 24px 20px;border-top:1px solid #e5e5e5;margin-top:auto;display:flex;justify-content:flex-end;gap:10px}',
      /* Buttons */
      '.kph-btn{font-family:inherit;font-feature-settings:inherit;font-size:14px;font-weight:500;padding:10px 18px;border-radius:6px;cursor:pointer;border:1px solid transparent;transition:opacity 0.15s,background-color 0.15s}',
      '.kph-btn-primary{background:#0a0a0a;color:#fff;border-color:#0a0a0a}',
      '.kph-btn-primary:hover{background:#1e1e1e}',
      '.kph-btn-secondary{background:#fff;color:#0a0a0a;border-color:#e5e5e5}',
      '.kph-btn-secondary:hover{background:#f2f2f2}',
      /* Phase 8.6a — order-thumb image variant (overrides Designer text-thumb styling) */
      '.kp-order-thumb--img{padding:0!important;overflow:hidden}',
      '.kp-order-thumb--img img{width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit}',
      /* Phase 8.7 — Bestelldetail timeline pseudo-elements (Designer cannot author ::before) */
      '.kp-timeline{position:relative;padding-left:24px}',
      '.kp-timeline::before{content:"";position:absolute;left:6px;top:8px;bottom:8px;width:1px;background:#E5E5E0}',
      '.kp-timeline-step{position:relative}',
      '.kp-timeline-step::before{content:"";position:absolute;left:-22px;top:10px;width:13px;height:13px;border-radius:50%;background:#FFFFFF;border:1px solid #999;box-sizing:border-box}',
      '.kp-timeline-step--done::before{background:#0A0A0A;border-color:#0A0A0A}',
      '.kp-timeline-step--current::before{background:#0A0A0A;border-color:#0A0A0A;box-shadow:0 0 0 4px #F0EFE9}',
      '.kp-timeline-step--upcoming .kp-timeline-step-title{color:#999}',
      /* Phase 8.7 — Bestelldetail item-thumb image variant */
      '.kp-detail-item-thumb--img{padding:0!important;overflow:hidden}',
      '.kp-detail-item-thumb--img img{width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit}'
    ].join('');
    (document.head||document.documentElement).appendChild(s);
  }

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
          log('init','customer null \u2014 entering guest state');
          renderGuest();
          return;
        }
        customerCtx=c;
        render(c);
        log('done','init complete in '+(Date.now()-startTs)+'ms');
      });
    }
    if(pollCount>=POLL_MAX){
      clearInterval(pollTimer);pollTimer=null;
      log('auth','token timeout after '+(POLL_MAX*POLL_INTERVAL_MS)+'ms \u2014 entering guest state',{attempts:pollCount});
      renderGuest();
      return;
    }
  }

  function init(){
    injectHubCSS();
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
