/* kessler-pro-scripts/auth.js v1.0.23 — target Webflow's actually-rendered checkbox structure */
(function(){
  if(window.__kpAuthV1)return;
  window.__kpAuthV1=true;

  if(!document.getElementById('kp-auth-css')){
    var css=document.createElement('style');
    css.id='kp-auth-css';
    css.textContent=[
      /* Row outer wrapper */
      '.kp-checkbox-row{display:block !important;margin:0 !important;padding:0 !important}',
      '.kp-checkbox-row + .kp-checkbox-row{margin-top:14px !important}',

      /* Outer FormBlockLabel is the actual flex row (box + text) */
      '.kp-checkbox-row > label{display:flex !important;align-items:center !important;gap:12px !important;font-weight:400 !important;margin:0 !important;padding:0 !important;cursor:pointer;width:auto}',

      /* Hide the leftover empty placeholder div from API insertion */
      '.kp-checkbox-row > label > div:empty{display:none !important}',

      /* FormCheckboxWrapper - just holds the input, no padding */
      '.kp-checkbox-row .w-checkbox{padding-left:0 !important;margin:0 !important;flex-shrink:0 !important;display:inline-flex !important;align-items:center}',

      /* Hide the zero-width inner FormInlineLabel inside .w-checkbox */
      '.kp-checkbox-row .w-checkbox > .w-form-label{display:none !important}',

      /* Style the native checkbox itself as the brand box */
      '.kp-checkbox-row input[type="checkbox"]{-webkit-appearance:none !important;appearance:none !important;width:20px !important;height:20px !important;min-width:20px;border:1.5px solid #E5E5E5 !important;border-radius:4px !important;background-color:#FFFFFF !important;background-image:none !important;margin:0 !important;padding:0 !important;cursor:pointer !important;position:relative !important;opacity:1 !important;flex-shrink:0 !important;transition:all .15s ease;box-shadow:none !important}',
      '.kp-checkbox-row input[type="checkbox"]:checked{background-color:#1E1E1E !important;border-color:#1E1E1E !important}',
      '.kp-checkbox-row input[type="checkbox"]:checked::after{content:"";position:absolute;left:5px;top:1px;width:6px;height:11px;border-right:2px solid #FFFFFF;border-bottom:2px solid #FFFFFF;transform:rotate(45deg)}',
      '.kp-checkbox-row input[type="checkbox"]:focus{outline:none !important;box-shadow:0 0 0 3px rgba(30,30,30,.12) !important;border-color:#1E1E1E !important}',

      /* The outer FormInlineLabel with the real text — direct child of outer label, NOT inside w-checkbox */
      '.kp-checkbox-row > label > .w-form-label{font-size:14px !important;line-height:1.5 !important;color:#1E1E1E !important;font-weight:400 !important;flex:1;margin:0 !important;padding:0 !important;display:inline}'
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
