// EduPay V5.2 - Admin/Finance notifications + final navigation cleanup
(function(){
  window.EDUPAY_STAFF_NOTIFICATIONS=[];
  window.EDUPAY_STAFF_UNREAD=0;
  window.EDUPAY_STAFF_NOTIFY_LOADING=false;
  window.EDUPAY_STAFF_NOTIFY_TIMER=null;

  function isStaffV52(){return !!session&&['admin','finance'].includes(session.role)}

  // Final navigation: Migrasi Data is intentionally removed from normal operations.
  window.nav=function(){
    if(session.role==='admin')return [['dashboard','Dashboard'],['students','Data Siswa'],['guardians','Akun Wali'],['classes','Kelas'],['homerooms','Wali Kelas'],['fees','Jenis Pembayaran'],['bills','Tagihan'],['verification','Verifikasi Bukti'],['reports','Laporan']];
    if(session.role==='finance')return [['dashboard','Dashboard'],['payments','Pembayaran'],['verification','Verifikasi Bukti'],['reports','Laporan']];
    const items=[['dashboard','Beranda']];
    if((session.studentIds||[]).length>1)items.push(['children','Anak Saya']);
    items.push(['mybills','Tagihan Saya'],['history','Riwayat'],['profile','Profil']);
    return items;
  };

  window.refreshStaffNotificationsV52=async function({silent=true,forceRender=true}={}){
    if(!isStaffV52()||window.EDUPAY_STAFF_NOTIFY_LOADING)return null;
    window.EDUPAY_STAFF_NOTIFY_LOADING=true;
    try{
      const out=await apiV40('/api/v52/notifications');
      const oldUnread=Number(window.EDUPAY_STAFF_UNREAD||0);
      window.EDUPAY_STAFF_NOTIFICATIONS=out.notifications||[];
      window.EDUPAY_STAFF_UNREAD=Number(out.unreadCount||0);
      if(forceRender&&oldUnread!==window.EDUPAY_STAFF_UNREAD)render();
      return out;
    }catch(err){if(!silent)toast(err.message||'Gagal mengambil notifikasi');return null;}
    finally{window.EDUPAY_STAFF_NOTIFY_LOADING=false;}
  };

  function staffBellV52(){
    const unread=Number(window.EDUPAY_STAFF_UNREAD||0);
    return `<button class="icon-btn staff-bell-v52" onclick="openStaffNotificationsV52()" aria-label="Notifikasi Admin/Finance">🔔${unread?`<span class="notification-count-v44 staff-count-v52">${unread>99?'99+':unread}</span>`:''}</button>`;
  }

  const shellBeforeV52=window.shell;
  window.shell=function(content){
    let html=shellBeforeV52(content);
    if(isStaffV52())html=html.replace(/<button class="icon-btn">🔔[\s\S]*?<\/button>/,staffBellV52());
    return html;
  };

  window.openStaffNotificationsV52=async function(){
    if(!isStaffV52())return;
    await refreshStaffNotificationsV52({silent:true,forceRender:false});
    const items=window.EDUPAY_STAFF_NOTIFICATIONS||[];
    const unread=Number(window.EDUPAY_STAFF_UNREAD||0);
    openCrudV33('Notifikasi',`<div class="staff-notify-head-v52"><div><b>${unread} belum dibaca</b><span>Update operasional dari server EduPay.</span></div>${unread?'<button class="btn btn-soft btn-sm" onclick="readAllStaffNotificationsV52()">Tandai semua dibaca</button>':''}</div><div class="notification-list-v44 staff-notify-list-v52">${items.length?items.map(n=>`<button class="notification-item-v44 ${n.readAt?'':'unread'}" onclick="openStaffNotificationItemV52(${n.id})"><span class="notification-mark-v44"></span><div><b>${esc(n.title)}</b><p>${esc(n.message)}</p><small>${new Date(n.createdAt).toLocaleString('id-ID')}${n.studentName?' · '+esc(n.studentName):''}</small></div></button>`).join(''):'<div class="empty">Belum ada notifikasi.</div>'}</div>`);
  };

  window.markStaffNotificationV52=async function(id=0){
    try{await apiV40('/api/v52/notifications/read',{method:'POST',body:id?{id}:{}});await refreshStaffNotificationsV52({silent:true,forceRender:false});render();return true;}
    catch(err){toast(err.message||'Gagal memperbarui notifikasi');return false;}
  };

  window.openStaffNotificationItemV52=async function(id){
    const n=(window.EDUPAY_STAFF_NOTIFICATIONS||[]).find(x=>Number(x.id)===Number(id));
    await markStaffNotificationV52(id);
    closeCrudV33();
    if(n?.entityType==='bill'){page='verification';render();if(typeof refreshVerificationV502==='function')setTimeout(()=>refreshVerificationV502({silent:true}),0);}
  };

  window.readAllStaffNotificationsV52=async function(){
    const ok=await markStaffNotificationV52(0);if(ok){closeCrudV33();toast('Semua notifikasi ditandai dibaca')}
  };

  function startStaffNotificationPollingV52(){
    if(window.EDUPAY_STAFF_NOTIFY_TIMER){clearInterval(window.EDUPAY_STAFF_NOTIFY_TIMER);window.EDUPAY_STAFF_NOTIFY_TIMER=null;}
    if(!isStaffV52())return;
    refreshStaffNotificationsV52({silent:true});
    window.EDUPAY_STAFF_NOTIFY_TIMER=setInterval(()=>{if(!document.hidden&&isStaffV52())refreshStaffNotificationsV52({silent:true})},15000);
  }

  const loginBeforeV52=window.login;
  window.login=async function(e){await loginBeforeV52(e);if(isStaffV52())startStaffNotificationPollingV52();};
  const logoutBeforeV52=window.logout;
  window.logout=async function(){if(window.EDUPAY_STAFF_NOTIFY_TIMER){clearInterval(window.EDUPAY_STAFF_NOTIFY_TIMER);window.EDUPAY_STAFF_NOTIFY_TIMER=null;}window.EDUPAY_STAFF_NOTIFICATIONS=[];window.EDUPAY_STAFF_UNREAD=0;return logoutBeforeV52();};

  window.addEventListener('focus',()=>{if(isStaffV52())refreshStaffNotificationsV52({silent:true})});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&isStaffV52())refreshStaffNotificationsV52({silent:true})});

  if(page==='migration')page='dashboard';
  if(isStaffV52())startStaffNotificationPollingV52();
  render();
})();
