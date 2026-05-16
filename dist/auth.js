/* kessler-pro-scripts/auth.js v1.0.24 — work WITH Designer styles, transparent-label trick */
(function(){
  if(window.__kpAuthV1)return;
  window.__kpAuthV1=true;

  if(!document.getElementById('kp-auth-css')){
    var css=document.createElement('style');
    css.id='kp-auth-css';
    css.textContent=[
      /* Make Webflow's auto-wrapped FormBlockLabel transparent to flex layout
         so kp-checkbox-row's existing Designer flex/gap/margin-bottom works as intended */
      '.kp-checkbox-row > label{display:contents}',

      /* Hide the leftover empty placeholder div from API insertion */
      '.kp-checkbox-row > label > div:empty{display:none}',

      /* FormCheckboxWrapper — inline holder for the input, no extra spacing */
      '.kp-checkbox-row .w-checkbox{padding:0;margin:0;display:inline-flex;align-items:center;flex-shrink:0}',

      /* Hide the empty zero-width inner FormInlineLabel inside w-checkbox */
      '.kp-checkbox-row .w-checkbox > .w-form-label{display:none}',

      /* Style the native input as brand box (no appearance, brand colors, checkmark via ::after) */
      '.kp-checkbox-row input[type="checkbox"]{-webkit-appearance:none;appearance:none;width:20px;height:20px;min-width:20px;border:1.5px solid #E5E5E5;border-radius:4px;background-color:#FFFFFF;background-image:none;margin:0;padding:0;cursor:pointer;position:relative;transition:all .15s ease;flex-shrink:0;box-shadow:none}',
      '.kp-checkbox-row input[type="checkbox"]:checked{background-color:#1E1E1E;border-color:#1E1E1E}',
      '.kp-checkbox-row input[type="checkbox"]:checked::after{content:"";position:absolute;left:5px;top:1px;width:6px;height:11px;border-right:2px solid #FFFFFF;border-bottom:2px solid #FFFFFF;transform:rotate(45deg)}',
      '.kp-checkbox-row input[type="checkbox"]:focus{outline:none;box-shadow:0 0 0 3px rgba(30,30,30,.12);border-color:#1E1E1E}',

      /* The text FormInlineLabel — reset Webflow default font-weight:bold, become flex:1 */
      '.kp-checkbox-row > label > .w-form-label{font-weight:400;margin:0;padding:0;flex:1}'
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
