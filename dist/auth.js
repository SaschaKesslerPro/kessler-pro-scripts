/* kessler-pro-scripts/auth.js v1.0.17 — B2C/B2B type-switch + form-checkbox sync */
(function(){
  if(window.__kpAuthV1)return;
  window.__kpAuthV1=true;

  /* Inject auth-page CSS overrides for Webflow Form-Checkbox visuals */
  if(!document.getElementById('kp-auth-css')){
    var css=document.createElement('style');
    css.id='kp-auth-css';
    css.textContent=[
      '.kp-checkbox-row .w-form-label{display:none}',
      '.kp-checkbox-row .w-checkbox{padding-left:0;margin-bottom:0;display:flex;align-items:center;flex-shrink:0}',
      '.kp-checkbox-row .w-checkbox-input--inputType-custom{width:18px;height:18px;border:1.5px solid #E5E5E5;border-radius:4px;margin:0;background-color:#FFFFFF;transition:all .15s ease;position:relative;box-shadow:none}',
      '.kp-checkbox-row .w-checkbox-input--inputType-custom.w--redirected-checked{background-color:#1E1E1E;border-color:#1E1E1E;background-image:none}',
      '.kp-checkbox-row .w-checkbox-input--inputType-custom.w--redirected-checked::after{content:"";position:absolute;left:4px;top:1px;width:6px;height:10px;border-right:1.5px solid #FFFFFF;border-bottom:1.5px solid #FFFFFF;transform:rotate(45deg)}',
      '.kp-checkbox-row .w-checkbox-input--inputType-custom.w--redirected-focus{box-shadow:0 0 0 3px rgba(30,30,30,.12);border-color:#1E1E1E}'
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

  /* Click on outer span/text -> toggle checkbox and sync Webflow visual state */
  document.addEventListener('click',function(e){
    if(e.target.tagName==='A')return;
    var row=e.target.closest('.kp-checkbox-row');
    if(!row)return;
    if(e.target.closest('.w-checkbox'))return;
    var input=row.querySelector('input[type="checkbox"]');
    if(!input)return;
    input.checked=!input.checked;
    var visual=row.querySelector('.w-checkbox-input');
    if(visual)visual.classList.toggle('w--redirected-checked',input.checked);
    input.dispatchEvent(new Event('change',{bubbles:true}));
  });
})();
