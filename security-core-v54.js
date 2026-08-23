// EduPay V5.4 - Security/Core consolidation layer.
(function(){
  window.EDUPAY_V54={csrf:null,poll:null,lastRequestId:null,sessionReady:false};
  try{localStorage.removeItem(SESSION)}catch(e){}

  function splitPathV54(path){const i=String(path).indexOf('?');return i<0?[String(path),'']:[String(path).slice(0,i),String(path).slice(i)]}
  window.mapApiPathV54=function(path){
    let [base,query]=splitPathV54(path),mapped=base;
    if(base.startsWith('/api/v1/'))return base+query;
    if(base.startsWith('/api/auth/'))mapped='/api/v1/auth/'+base.slice('/api/auth/'.length);
    else if(base.startsWith('/api/admin/guardians/'))mapped='/api/v1/admin/guardians/'+base.slice('/api/admin/guardians/'.length);
    else if(base==='/api/admin/guardians')mapped='/api/v1/admin/guardians';
    else if(base.startsWith('/api/v501/admin/guardians/'))mapped='/api/v1/admin/guardians/'+base.slice('/api/v501/admin/guardians/'.length);
    else if(base==='/api/v501/admin/guardians')mapped='/api/v1/admin/guardians';
    else if(base==='/api/v501/parent/state')mapped='/api/v1/parent/state';
    else if(base==='/api/v501/parent/notifications/read')mapped='/api/v1/parent/notifications/read';
    else if(base==='/api/v49/state')mapped='/api/v1/staff/state';
    else if(base==='/api/v49/sync-all')mapped='/api/v1/staff/sync-all';
    else if(base.startsWith('/api/v50/finance/'))mapped='/api/v1/finance/'+base.slice('/api/v50/finance/'.length);
    else if(base==='/api/v50/parent/payments')mapped='/api/v1/parent/payments';
    else if(base==='/api/v502/verification')mapped='/api/v1/verification';
    else if(base.startsWith('/api/v502/bills/'))mapped='/api/v1/verification/bills/'+base.slice('/api/v502/bills/'.length);
    else if(base.startsWith('/api/v51/proofs/'))mapped='/api/v1/proofs/'+base.slice('/api/v51/proofs/'.length);
    else if(base==='/api/v52/notifications')mapped='/api/v1/staff/notifications';
    else if(base==='/api/v52/notifications/read')mapped='/api/v1/staff/notifications/read';
    else if(base==='/api/v53/csrf')mapped='/api/v1/csrf';
    else if(base==='/api/v53/health')mapped='/api/v1/health';
    else if(base.startsWith('/api/v53/admin/'))mapped='/api/v1/admin/'+base.slice('/api/v53/admin/'.length);
    return mapped+query;
  };

  async function csrfV54(force=false){
    if(window.EDUPAY_V54.csrf&&!force)return window.EDUPAY_V54.csrf;
    const res=await fetch('/api/v1/csrf',{credentials:'same-origin',cache:'no-store',headers:{'Accept':'application/json'}});
    const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.message||`HTTP ${res.status}`);
    window.EDUPAY_V54.csrf=data.token;window.EDUPAY_V54.lastRequestId=res.headers.get('X-Request-ID')||data.requestId||null;return data.token;
  }
  window.csrfV54=csrfV54;

  window.apiV54=async function(path,{method='GET',body=null,headers={}}={}){
    const finalPath=mapApiPathV54(path),upper=String(method||'GET').toUpperCase(),h={'Accept':'application/json',...headers};
    if(body!==null&&!(body instanceof FormData))h['Content-Type']='application/json';
    if(!['GET','HEAD','OPTIONS'].includes(upper))h['X-CSRF-Token']=await csrfV54();
    const doFetch=()=>fetch(finalPath,{method:upper,credentials:'same-origin',headers:h,body:body===null?undefined:(body instanceof FormData?body:JSON.stringify(body)),cache:'no-store'});
    let res=await doFetch(),data={};try{data=await res.json()}catch(e){}
    window.EDUPAY_V54.lastRequestId=res.headers.get('X-Request-ID')||data.requestId||null;
    if(res.status===419&&!['GET','HEAD','OPTIONS'].includes(upper)){
      h['X-CSRF-Token']=await csrfV54(true);res=await doFetch();try{data=await res.json()}catch(e){data={}};window.EDUPAY_V54.lastRequestId=res.headers.get('X-Request-ID')||data.requestId||null;
    }
    if(!res.ok){const err=new Error(data.message||`HTTP ${res.status}`);err.status=res.status;err.requestId=window.EDUPAY_V54.lastRequestId;if(res.status===401&&!finalPath.endsWith('/auth/login')){session=null;try{localStorage.removeItem(SESSION)}catch(e){};render()}throw err;}
    return data;
  };

  // All legacy JSON helpers now use API v1 + global CSRF.
  window.apiV40=function(path,options={}){return apiV54(path,{method:options.method||'GET',body:options.body??null,headers:options.headers||{}})};
  window.apiV53=function(path,options={}){return apiV54(path,{method:options.method||'GET',body:options.body??null,headers:options.headers||{}})};

  // Session is server-authoritative; LocalStorage may never restore authorization.
  window.refreshServerSessionV40=async function(){
    try{const out=await apiV54('/api/v1/auth/me');session=out.user||null;window.EDUPAY_V54.sessionReady=true;try{localStorage.removeItem(SESSION)}catch(e){};render();return session}
    catch(e){session=null;window.EDUPAY_V54.sessionReady=true;try{localStorage.removeItem(SESSION)}catch(x){};render();return null}
  };

  const loginBeforeV54=window.login;
  window.login=async function(e){
    await loginBeforeV54(e);try{localStorage.removeItem(SESSION)}catch(x){}
    if(session){window.EDUPAY_V54.csrf=null;await csrfV54(true).catch(()=>null);await refreshRoleDataV54(true);}
  };
  const logoutBeforeV54=window.logout;
  window.logout=async function(){
    try{return await logoutBeforeV54()}finally{session=null;window.EDUPAY_V54.csrf=null;try{localStorage.removeItem(SESSION)}catch(e){};page='dashboard';render()}
  };

  // Real multipart upload also goes through CSRF + unified gateway.
  window.submitTransferProofV44=async function(id){
    const input=document.getElementById('transferProofServerV44'),f=input?.files?.[0];
    if(!f)return toast('Pilih file bukti transfer terlebih dahulu');
    if(f.size>5*1024*1024)return toast('Ukuran bukti maksimal 5 MB');
    if(!['image/jpeg','image/png','application/pdf'].includes(f.type))return toast('Format bukti harus JPG, PNG, atau PDF');
    const fd=new FormData();fd.append('proof',f);
    try{const out=await apiV54(`/api/v1/parent/bills/${Number(id)}/proof`,{method:'POST',body:fd});closeCrudV33();if(typeof refreshParentStateV44==='function')await refreshParentStateV44({silent:true,forceRender:false});render();toast(out.message||'Bukti pembayaran berhasil diunggah')}
    catch(err){toast(`${err.message||'Gagal mengunggah bukti'}${err.requestId?' · ID '+err.requestId:''}`)}
  };
  window.openProofV51=function(id){window.open(`/api/v1/proofs/${Number(id)}`,'_blank','noopener')};

  // Remove the old local session if any compatibility layer writes it again.
  window.addEventListener('storage',e=>{if(e.key===SESSION&&e.newValue)try{localStorage.removeItem(SESSION)}catch(x){}});

  window.refreshRoleDataV54=async function(force=false){
    if(!session)return;
    const jobs=[];
    if(session.role==='admin'&&typeof refreshAdminStateV53==='function')jobs.push(refreshAdminStateV53({silent:true,forceRender:false}));
    if(session.role==='admin'&&typeof refreshGuardiansV44==='function')jobs.push(refreshGuardiansV44({silent:true}));
    if(['admin','finance'].includes(session.role)&&typeof refreshStaffNotificationsV52==='function')jobs.push(refreshStaffNotificationsV52({silent:true,forceRender:false}));
    if(['admin','finance'].includes(session.role)&&page==='verification'&&typeof refreshVerificationV502==='function')jobs.push(refreshVerificationV502({silent:true,forceRender:false}));
    if(session.role==='parent'&&typeof refreshParentStateV44==='function')jobs.push(refreshParentStateV44({silent:true,forceRender:false}));
    if(session.role==='parent'&&page==='history'&&typeof refreshParentPaymentsV50==='function')jobs.push(refreshParentPaymentsV50({silent:true,forceRender:false}));
    await Promise.allSettled(jobs);try{localStorage.removeItem(SESSION)}catch(e){};if(force)render();
  };

  if(window.EDUPAY_V54.poll)clearInterval(window.EDUPAY_V54.poll);
  window.EDUPAY_V54.poll=setInterval(()=>{if(!document.hidden&&session)refreshRoleDataV54(false)},15000);
  window.addEventListener('focus',()=>{if(session)refreshRoleDataV54(false)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session)refreshRoleDataV54(false)});

  // Final bootstrap: discard any client session and ask the server.
  try{localStorage.removeItem(SESSION)}catch(e){}
  refreshServerSessionV40().then(()=>{if(session)refreshRoleDataV54(true)});
})();
