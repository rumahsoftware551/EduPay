// EduPay V5.0.1 - Stability hotfix for parent + guardian admin state
(function(){
  window.EDUPAY_PARENT_ERROR=null;
  window.EDUPAY_GUARDIANS_ERROR=null;

  function errorCardV501(message,retryFn){
    return `<div class="card"><div class="empty stability-error-v501"><b>Data belum dapat dimuat</b><span>${esc(message||'Terjadi masalah saat mengambil data dari server.')}</span><button class="btn btn-primary btn-sm" onclick="${retryFn}">Coba Lagi</button></div></div>`;
  }

  const oldRefreshParent=window.refreshParentStateV44;
  window.refreshParentStateV44=async function({silent=true,forceRender=true}={}){
    if(!session||session.role!=='parent'||window.EDUPAY_PARENT_LOADING)return null;
    window.EDUPAY_PARENT_LOADING=true;
    try{
      const sid=session.studentId?`?student_id=${encodeURIComponent(session.studentId)}`:'';
      const out=await apiV40('/api/v501/parent/state'+sid);
      const before=JSON.stringify(window.EDUPAY_PARENT_STATE);
      window.EDUPAY_PARENT_STATE=out;
      window.EDUPAY_PARENT_ERROR=null;
      session.studentIds=(out.students||[]).map(s=>Number(s.id));
      session.studentId=Number(out.studentId);
      session.guardianProfile=out.profile;
      localStorage.setItem(SESSION,JSON.stringify(session));
      if(forceRender&&before!==JSON.stringify(out))render();
      return out;
    }catch(err){
      window.EDUPAY_PARENT_ERROR=err.message||'Gagal mengambil data wali dari VPS';
      if(!silent)toast(window.EDUPAY_PARENT_ERROR);
      if(forceRender)render();
      return null;
    }finally{window.EDUPAY_PARENT_LOADING=false;}
  };

  const parentDashboardBeforeV501=window.parentDashboardV44;
  window.parentDashboardV44=function(){
    if(!window.EDUPAY_PARENT_STATE&&window.EDUPAY_PARENT_ERROR)return errorCardV501(window.EDUPAY_PARENT_ERROR,"refreshParentStateV44({silent:false})");
    return parentDashboardBeforeV501();
  };
  const myBillsBeforeV501=window.myBillsV44;
  window.myBillsV44=function(){
    if(!window.EDUPAY_PARENT_STATE&&window.EDUPAY_PARENT_ERROR)return errorCardV501(window.EDUPAY_PARENT_ERROR,"refreshParentStateV44({silent:false})");
    return myBillsBeforeV501();
  };
  views.dashboard=function(){return session?.role==='parent'?parentDashboardV44():dashboardV33();};
  views.mybills=function(){return session?.role==='parent'?myBillsV44():mybills();};

  window.submitTransferProofV44=async function(id){
    const f=document.getElementById('transferProofServerV44')?.files?.[0];if(!f)return toast('Pilih file bukti transfer terlebih dahulu');
    try{const out=await apiV40(`/api/v501/parent/bills/${id}/proof`,{method:'POST',body:{proofName:f.name}});closeCrudV33();await refreshParentStateV44({silent:true});toast(out.message||'Bukti dikirim');}catch(err){toast(err.message||'Gagal mengirim bukti')}
  };
  window.readNotificationV44=async function(id){try{await apiV40('/api/v501/parent/notifications/read',{method:'POST',body:{id}});await refreshParentStateV44({silent:true,forceRender:false});openNotificationsV44();render();}catch(err){toast(err.message||'Gagal memperbarui notifikasi')}};
  window.readAllNotificationsV44=async function(){try{await apiV40('/api/v501/parent/notifications/read',{method:'POST',body:{}});closeCrudV33();await refreshParentStateV44({silent:true});}catch(err){toast(err.message||'Gagal memperbarui notifikasi')}};

  window.refreshGuardiansV44=async function({silent=true}={}){
    if(!session||session.role!=='admin'||window.EDUPAY_GUARDIANS_LOADING)return null;
    window.EDUPAY_GUARDIANS_LOADING=true;
    try{
      const out=await apiV40('/api/v501/admin/guardians');
      window.EDUPAY_GUARDIANS_SERVER=out.guardians||[];
      window.EDUPAY_GUARDIANS_ERROR=null;
      if(page==='guardians')render();
      return out;
    }catch(err){
      window.EDUPAY_GUARDIANS_ERROR=err.message||'Gagal mengambil akun wali dari VPS';
      if(!silent)toast(window.EDUPAY_GUARDIANS_ERROR);
      if(page==='guardians')render();
      return null;
    }finally{window.EDUPAY_GUARDIANS_LOADING=false;}
  };
  window.refreshGuardiansV42=window.refreshGuardiansV44;

  const guardiansBeforeV501=window.guardiansV44;
  window.guardiansV44=function(){
    const users=window.EDUPAY_GUARDIANS_SERVER||[];
    if(!users.length&&window.EDUPAY_GUARDIANS_ERROR)return `<div class="page-head"><div><span class="page-kicker">Akses Orang Tua</span><h2>Akun Wali</h2><p>Status akun diambil langsung dari PostgreSQL.</p></div><button class="btn btn-soft" onclick="refreshGuardiansV44({silent:false})">↻ Refresh Server</button></div>${errorCardV501(window.EDUPAY_GUARDIANS_ERROR,"refreshGuardiansV44({silent:false})")}`;
    if(!users.length&&window.EDUPAY_GUARDIANS_LOADING)return '<div class="card"><div class="empty">Mengambil akun wali dari VPS...</div></div>';
    return guardiansBeforeV501();
  };
  views.guardians=window.guardiansV44;

  window.syncGuardianAccountsV36=async function(showToast=false){
    try{
      if(typeof syncAllServerV49==='function'&&session?.role==='admin')await syncAllServerV49({silent:true,refresh:false});
      const out=await apiV40('/api/v501/admin/guardians/sync',{method:'POST'});
      await refreshGuardiansV44({silent:true});
      if(showToast)toast(`Sinkron akun wali: ${out.created||0} baru, ${out.linked||0} relasi siswa`);
      return out;
    }catch(err){window.EDUPAY_GUARDIANS_ERROR=err.message||'Sinkronisasi akun wali gagal';if(showToast)toast(window.EDUPAY_GUARDIANS_ERROR);render();return null;}
  };

  window.saveGuardianGreetingV44=async function(e,id){
    e.preventDefault();
    try{await apiV40(`/api/v501/admin/guardians/${id}/profile`,{method:'POST',body:{salutation:guardianSalutationV44.value,nickname:guardianNicknameV44.value.trim()}});closeCrudV33();await refreshGuardiansV44({silent:true});toast('Sapaan wali disimpan');}
    catch(err){toast(err.message||'Gagal menyimpan sapaan')}
  };

  // Force one clean read after all previous version layers have loaded.
  if(session?.role==='parent')setTimeout(()=>refreshParentStateV44({silent:false,forceRender:true}),80);
  if(session?.role==='admin')setTimeout(()=>refreshGuardiansV44({silent:false}),80);
  render();
})();
