// EduPay V5.4+ - Early API gateway shim.
// Loaded before compatibility modules so even legacy fetch() calls go through /api/v1.
(function(){
  const originalFetch=window.fetch.bind(window);window.EDUPAY_ORIGINAL_FETCH=originalFetch;
  let csrf=null;
  function split(path){const i=String(path).indexOf('?');return i<0?[String(path),'']:[String(path).slice(0,i),String(path).slice(i)]}
  function map(path){
    let [b,q]=split(path),m=b;
    if(b.startsWith('/api/v1/'))return b+q;
    if(b==='/api/health')m='/api/v1/health';
    else if(b.startsWith('/api/auth/'))m='/api/v1/auth/'+b.slice('/api/auth/'.length);
    else if(b==='/api/admin/bootstrap')m='/api/v1/admin/bootstrap';
    else if(b.startsWith('/api/admin/guardians/'))m='/api/v1/admin/guardians/'+b.slice('/api/admin/guardians/'.length);
    else if(b==='/api/admin/guardians')m='/api/v1/admin/guardians';
    else if(b==='/api/v44/parent/state'||b==='/api/v501/parent/state')m='/api/v1/parent/state';
    else if(b==='/api/v44/parent/notifications/read'||b==='/api/v501/parent/notifications/read')m='/api/v1/parent/notifications/read';
    else if(b.startsWith('/api/v44/admin/guardians/'))m='/api/v1/admin/guardians/'+b.slice('/api/v44/admin/guardians/'.length);
    else if(b==='/api/v44/admin/guardians'||b==='/api/v501/admin/guardians')m='/api/v1/admin/guardians';
    else if(b.startsWith('/api/v501/admin/guardians/'))m='/api/v1/admin/guardians/'+b.slice('/api/v501/admin/guardians/'.length);
    // V5.5: never allow compatibility code to pull/push a full browser snapshot.
    else if(b==='/api/v49/state')m='/api/v1/scale/compat/state';
    else if(b==='/api/v49/sync-all')m='/api/v1/scale/compat/sync-all';
    else if(b.startsWith('/api/v50/finance/'))m='/api/v1/finance/'+b.slice('/api/v50/finance/'.length);
    else if(b==='/api/v50/parent/payments')m='/api/v1/parent/payments';
    else if(b==='/api/v502/verification')m='/api/v1/verification';
    else if(b.startsWith('/api/v502/bills/'))m='/api/v1/verification/bills/'+b.slice('/api/v502/bills/'.length);
    else if(b.startsWith('/api/v51/parent/bills/'))m='/api/v1/parent/bills/'+b.slice('/api/v51/parent/bills/'.length);
    else if(b.startsWith('/api/v51/proofs/'))m='/api/v1/proofs/'+b.slice('/api/v51/proofs/'.length);
    else if(b==='/api/v52/notifications')m='/api/v1/staff/notifications';
    else if(b==='/api/v52/notifications/read')m='/api/v1/staff/notifications/read';
    else if(b==='/api/v53/csrf')m='/api/v1/csrf';
    else if(b==='/api/v53/health')m='/api/v1/health';
    // V5.5: legacy V5.3 state call is reduced to small master data only.
    else if(b==='/api/v53/admin/state')m='/api/v1/scale/admin/master';
    else if(b.startsWith('/api/v53/admin/'))m='/api/v1/admin/'+b.slice('/api/v53/admin/'.length);
    return m+q;
  }
  window.mapApiPathV54=map;
  async function token(force=false){if(csrf&&!force)return csrf;const r=await originalFetch('/api/v1/csrf',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||`HTTP ${r.status}`);csrf=d.token;return csrf}
  window.fetch=async function(input,init={}){
    const raw=typeof input==='string'?input:(input instanceof Request?input.url:String(input));
    const sameOrigin=raw.startsWith('/')||raw.startsWith(location.origin);
    if(!sameOrigin||!raw.includes('/api/'))return originalFetch(input,init);
    let path=raw.startsWith(location.origin)?raw.slice(location.origin.length):raw;path=map(path);
    const method=String(init.method||(input instanceof Request?input.method:'GET')).toUpperCase();
    const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));
    if(!['GET','HEAD','OPTIONS'].includes(method)&&!headers.has('X-CSRF-Token'))headers.set('X-CSRF-Token',await token());
    let res=await originalFetch(path,{...init,method,headers,credentials:init.credentials||'same-origin',cache:init.cache||'no-store'});
    if(res.status===419&&!['GET','HEAD','OPTIONS'].includes(method)){
      headers.set('X-CSRF-Token',await token(true));res=await originalFetch(path,{...init,method,headers,credentials:init.credentials||'same-origin',cache:'no-store'});
    }
    return res;
  };
  window.EDUPAY_GATEWAY_SHIM={map,csrf:token,originalFetch};
})();
