/* kessler-pro-scripts/auth.js v1.0.21 — type-switch + native Webflow custom-checkbox styled as brand box */
(function(){
  if(window.__kpAuthV1)return;
  window.__kpAuthV1=true;

  if(!document.getElementById('kp-auth-css')){
    var css=document.createElement('style');
    css.id='kp-auth-css';
    css.textContent=[
      /* Row layout */
      '.kp-checkbox-row{display:block}',
      '.kp-checkbox-row + .kp-checkbox-row{margin-top:16px}',

      /* The w-checkbox label is the clickable container */
      '.kp-checkbox-row .w-checkbox{padding-left:0;margin-bottom:0;display:flex;align-items:flex-start;gap:12px;cursor:pointer}',

      /* Style Webflow custom visual div as brand box */
      '.kp-checkbox-row .w-checkbox-input--inputType-custom{width:20px;height:20px;min-width:20px;border:1.5px solid #E5E5E5;border-radius:4px;margin:0;margin-top:1px;background-color:#FFFFFF;background-image:none;transition:all .15s ease;position:relative;box-shadow:none;flex-shrink:0}',
      '.kp-checkbox-row .w-checkbox-input--inputType-custom.w--redirected-checked{background-color:#1E1E1E;border-color:#1E1E1E;background-image:none}',
      '.kp-checkbox-row .w-checkbox-input--inputType-custom.w--redirected-checked::after{content:"";position:absolute;left:5px;top:1px;width:6px;height:11px;border-right:2px solid #FFFFFF;border-bottom:2px solid #FFFFFF;transform:rotate(45deg)}',
      '.kp-checkbox-row .w-checkbox-input--inputType-custom.w--redirected-focus{box-shadow:0 0 0 3px rgba(30,30,30,.12);border-color:#1E1E1E}',

      /* Label text */
      '.kp-checkbox-row .w-form-label{font-size:14px;line-height:1.5;color:#1E1E1E;padding-left:0;margin-bottom:0;flex:1;cursor:pointer}'
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
})();
