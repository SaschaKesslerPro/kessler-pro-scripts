/* kessler-pro-scripts/auth.js v1.0.18 — type-switch + custom checkbox visuals */
(function(){
  if(window.__kpAuthV1)return;
  window.__kpAuthV1=true;

  /* Inject auth-page CSS: hide Webflow visuals, style native input as brand checkbox */
  if(!document.getElementById('kp-auth-css')){
    var css=document.createElement('style');
    css.id='kp-auth-css';
    css.textContent=[
      /* Row layout: center-align box and text, spacing between rows */
      '.kp-checkbox-row{display:flex;align-items:center;gap:12px}',
      '.kp-checkbox-row + .kp-checkbox-row{margin-top:16px}',
      '.kp-checkbox-row > span{flex:1;font-size:14px;line-height:1.5;color:#1E1E1E}',

      /* Kill Webflow defaults */
      '.kp-checkbox-row .w-form-label{display:none}',
      '.kp-checkbox-row .w-checkbox-input--inputType-custom{display:none !important}',
      '.kp-checkbox-row .w-checkbox{padding-left:0;margin-bottom:0;display:flex;align-items:center;flex-shrink:0}',

      /* Native checkbox as brand box */
      '.kp-checkbox-row input[type="checkbox"]{position:relative !important;width:20px !important;height:20px !important;opacity:1 !important;-webkit-appearance:none;appearance:none;border:1.5px solid #E5E5E5;border-radius:4px;background-color:#FFFFFF;cursor:pointer;margin:0;padding:0;transition:all .15s ease;flex-shrink:0;z-index:1}',
      '.kp-checkbox-row input[type="checkbox"]:checked{background-color:#1E1E1E;border-color:#1E1E1E}',
      '.kp-checkbox-row input[type="checkbox"]:checked::before{content:"";position:absolute;left:5px;top:1px;width:6px;height:11px;border-right:2px solid #FFFFFF;border-bottom:2px solid #FFFFFF;transform:rotate(45deg)}',
      '.kp-checkbox-row input[type="checkbox"]:focus{outline:none;box-shadow:0 0 0 3px rgba(30,30,30,.12);border-color:#1E1E1E}'
    ].join('');
    document.head.appendChild(css);
  }

  /* B2C/B2B type-switch toggle */
  document.addEventListener('click',function(e){
    var opt=e.target.closest('.kp-type-option');
    if(!opt)return;
    var sw=opt.closest('.kp-type-switch');
    if(!sw)return;
    sw.querySelectorAll('.kp-type-option').forEach(function(o){
      o.classList.remove('kp-type-option--active');
    });
    opt.classList.add('kp-type-option--active');
    var type=opt.getAttribute('data-customer-type');
    document.querySelectorAll('.kp-b2b-only').forEach(function(f){
      f.style.display=(type==='b2b')?'block':'none';
    });
  });

  /* Click on outer span/text -> toggle checkbox (link clicks skipped) */
  document.addEventListener('click',function(e){
    if(e.target.tagName==='A')return;
    var row=e.target.closest('.kp-checkbox-row');
    if(!row)return;
    if(e.target.tagName==='INPUT')return;
    var input=row.querySelector('input[type="checkbox"]');
    if(!input)return;
    input.checked=!input.checked;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  });
})();
