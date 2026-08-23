// EduPay V4.4 - Parent realtime state, notifications and database-backed billing
window.EDUPAY_PARENT_STATE=null;
window.EDUPAY_PARENT_LOADING=false;
window.EDUPAY_PARENT_TIMER=null;
window.EDUPAY_OPERATIONAL_SYNCING=false;

function statusBadgeV44(status){
  if(status==='paid')return '<span class="badge ok"><i></i>Lunas</span>';
  if(status==='pending')return '<span class="badge warn"><i></i>Menunggu Verifikasi</span>';
  if(status==='cancelled')return '<span class="badge info"><i></i>Dibatalkan</span>';
  return '<span class="badge danger"><i></i>Belum Bayar</span>';
}

async function refreshParentStateV44({silent=true,forceRender=true}={}){
  if(!session||session.role!=='parent'||window.EDUPAY_PARENT_LOADING)return;
  window.EDUPAY_PARENT_LOADING=true;
  try{
    const sid=session.studentId?`?student_id=${encodeURIComponent(session.studentId)}`:'';
    const out=await apiV40('/api/v44/parent/state'+sid);
    const before=JSON.stringify(window.EDUPAY_PARENT_STATE);
    window.EDUPAY_PARENT_STATE=out;
    session.studentIds=(out.students||[]).map(s=>Number(s.id));
    session.studentId=Number(out.studentId);
    session.guardianProfile=out.profile;
    localStorage.setItem(SESSION,JSON.stringify(session));
    if(forceRender&&before!==JSON.stringify(out))render();
  }catch(err){if(!silent)toast(err.message||'Gagal memperbarui data wali')}
  finally{window.EDUPAY_PARENT_LOADING=false;}
}

function startParentPollingV44(){
  if(window.EDUPAY_PARENT_TIMER){clearInterval(window.EDUPAY_PARENT_TIMER);window.EDUPAY_PARENT_TIMER=null;}
  if(!session||session.role!=='parent')return;
  refreshParentStateV44({silent:true});
  window.EDUPAY_PARENT_TIMER=setInterval(()=>{
    if(!document.hidden&&session?.role==='parent')refreshParentStateV44({silent:true});
  },20000);
}

function parentStudentV44(state){return (state?.students||[]).find(s=>Number(s.id)===Number(state.studentId))||state?.students?.[0]||null;}

function parentDashboardV44(){
  const st=window.EDUPAY_PARENT_STATE;
  if(!st)return '<div class="card"><div class="empty">Mengambil tagihan terbaru dari server...</div></div>';
  const student=parentStudentV44(st),p=st.profile||{},s=st.summary||{};
  const greeting=`${p.salutation||'Bapak/Ibu'} ${p.nickname||String(p.name||'Wali').split(' ')[0]}`;
  const openBills=(st.bills||[]).filter(b=>!['paid','cancelled'].includes(b.status));
  return `<div class="page-head"><div><span class="page-kicker">Portal Orang Tua</span><h2>Halo, ${esc(greeting)} 👋</h2><p>${esc(student?.name||'-')} · ${esc(student?.class_name||student?.className||'-')}</p></div></div>
  <div class="welcome-card"><div class="welcome-icon">✓</div><div><b>Data pembayaran tersinkron dengan sekolah</b><p>Status tagihan diperbarui otomatis dari server setiap ada perubahan.</p></div></div>
  <div class="grid stats">${stat('Belum Bayar',rupiah(s.unpaid||0),'stat-red','mybills','unpaid')}${stat('Sudah Dibayar',rupiah(s.paid||0),'stat-green','history')}${stat('Jumlah Tagihan',s.count||0,'stat-blue','mybills','all')}${stat('Menunggu Verifikasi',s.pending||0,'stat-amber','mybills','pending')}</div>
  <div class="card"><div class="section-head"><div><h3>Tagihan Aktif</h3><p>Terakhir sinkron ${new Date(st.serverTime).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</p></div></div>${parentBillsTableV44(openBills)}</div>`;
}

function parentBillsTableV44(list){
  if(!list.length)return '<div class="empty">Tidak ada tagihan aktif.</div>';
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Tagihan</th><th>Jatuh Tempo</th><th>Nominal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${list.map(b=>`<tr><td><b>${esc(b.title)}</b></td><td>${esc(b.due||'-')}</td><td>${rupiah(b.amount)}</td><td>${statusBadgeV44(b.status)}</td><td>${b.status==='unpaid'?`<button class="btn transfer-btn btn-sm" onclick="openTransferUploadV44(${b.id})">Transfer & Upload Bukti</button>`:b.status==='pending'?'<span class="badge warn"><i></i>Diproses</span>':b.status==='paid'?'<span class="badge ok"><i></i>Lunas</span>':'-'}</td></tr>`).join('')}</tbody></table></div>`;
}

function myBillsV44(){
  const st=window.EDUPAY_PARENT_STATE;if(!st)return '<div class="card"><div class="empty">Memuat tagihan dari server...</div></div>';
  let list=(st.bills||[]).filter(b=>b.status!=='cancelled');
  if(edupayBillFilter==='unpaid')list=list.filter(b=>b.status==='unpaid');
  if(edupayBillFilter==='pending')list=list.filter(b=>b.status==='pending');
  if(edupayBillFilter==='paid')list=list.filter(b=>b.status==='paid');
  return `<div class="page-head"><div><h2>Tagihan Saya</h2><p>Status diambil langsung dari database sekolah.</p></div></div><div class="filter-bar"><button class="filter-chip ${edupayBillFilter==='all'?'active':''}" onclick="edupayBillFilter='all';render()">Semua</button><button class="filter-chip ${edupayBillFilter==='unpaid'?'active':''}" onclick="edupayBillFilter='unpaid';render()">Belum Bayar</button><button class="filter-chip ${edupayBillFilter==='pending'?'active':''}" onclick="edupayBillFilter='pending';render()">Menunggu Verifikasi</button><button class="filter-chip ${edupayBillFilter==='paid'?'active':''}" onclick="edupayBillFilter='paid';render()">Lunas</button></div><div class="card">${parentBillsTableV44(list)}</div>`;
}

function historyV44(){
  const st=window.EDUPAY_PARENT_STATE;if(!st)return '<div class="card"><div class="empty">Memuat riwayat...</div></div>';
  const rows=(st.bills||[]).filter(b=>b.status==='paid');
  return `<div class="page-head"><div><h2>Riwayat Pembayaran</h2><p>Tagihan yang sudah dikonfirmasi lunas oleh sekolah.</p></div></div><div class="card">${rows.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Tagihan</th><th>Nominal</th><th>Metode</th><th>Status</th></tr></thead><tbody>${rows.map(b=>`<tr><td><b>${esc(b.title)}</b></td><td>${rupiah(b.amount)}</td><td>${esc(b.paymentMethod||'-')}</td><td>${statusBadgeV44(b.status)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada pembayaran lunas.</div>'}</div>`;
}

function openTransferUploadV44(id){
  const b=(window.EDUPAY_PARENT_STATE?.bills||[]).find(x=>Number(x.id)===Number(id));if(!b)return toast('Tagihan tidak ditemukan');
  openCrudV33('Upload Bukti Transfer',`<div class="proof-note">Tagihan: <b>${esc(b.title)}</b> · ${rupiah(b.amount)}</div><div class="upload-box"><b>Pilih bukti transfer</b><small>JPG, PNG, atau PDF. Pada tahap ini status dan nama file tersimpan di database.</small><input id="transferProofServerV44" type="file" accept="image/jpeg,image/png,application/pdf"></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Batal</button><button type="button" class="btn btn-primary" onclick="submitTransferProofV44(${b.id})">Kirim Bukti</button></div>`);
}
async function submitTransferProofV44(id){
  const f=document.getElementById('transferProofServerV44')?.files?.[0];if(!f)return toast('Pilih file bukti transfer terlebih dahulu');
  try{const out=await apiV40(`/api/v44/parent/bills/${id}/proof`,{method:'POST',body:{proofName:f.name}});closeCrudV33();await refreshParentStateV44({silent:true});toast(out.message||'Bukti dikirim');}catch(err){toast(err.message||'Gagal mengirim bukti')}
}

async function openNotificationsV44(){
  if(session?.role!=='parent')return;
  await refreshParentStateV44({silent:true,forceRender:false});
  const st=window.EDUPAY_PARENT_STATE||{},items=st.notifications||[];
  openCrudV33('Notifikasi',`<div class="notification-list-v44">${items.length?items.map(n=>`<button class="notification-item-v44 ${n.read_at?'':'unread'}" onclick="readNotificationV44(${n.id})"><span class="notification-mark-v44"></span><div><b>${esc(n.title)}</b><p>${esc(n.message)}</p><small>${new Date(n.created_at).toLocaleString('id-ID')}</small></div></button>`).join(''):'<div class="empty">Belum ada notifikasi.</div>'}</div>${items.some(n=>!n.read_at)?'<div class="modal-actions"><button class="btn btn-soft" onclick="readAllNotificationsV44()">Tandai semua dibaca</button></div>':''}`);
}
async function readNotificationV44(id){try{await apiV40('/api/v44/parent/notifications/read',{method:'POST',body:{id}});await refreshParentStateV44({silent:true,forceRender:false});openNotificationsV44();render();}catch(e){}}
async function readAllNotificationsV44(){try{await apiV40('/api/v44/parent/notifications/read',{method:'POST',body:{}});closeCrudV33();await refreshParentStateV44({silent:true});}catch(e){}}

const shellBeforeV44=shell;
shell=function(content){
  let html=shellBeforeV44(content);
  if(session?.role==='parent'){
    const unread=Number(window.EDUPAY_PARENT_STATE?.unreadCount||0);
    const bell=`<button class="icon-btn notification-bell-v44" onclick="openNotificationsV44()" aria-label="Notifikasi">🔔${unread?`<span class="notification-count-v44">${unread>99?'99+':unread}</span>`:''}</button>`;
    html=html.replace(/<button class="icon-btn">🔔[\s\S]*?<\/button>/,bell);
  }
  return html;
};

async function syncOperationalV44({silent=true}={}){
  if(!session||!['admin','finance'].includes(session.role)||window.EDUPAY_OPERATIONAL_SYNCING)return;
  window.EDUPAY_OPERATIONAL_SYNCING=true;
  try{await apiV40('/api/v44/admin/operational/sync',{method:'POST',body:{bills:db.bills}});}catch(err){if(!silent)toast(err.message||'Gagal sinkron tagihan ke server')}finally{window.EDUPAY_OPERATIONAL_SYNCING=false;}
}
function wrapSyncV44(name){
  const old=window[name];if(typeof old!=='function'||old.__v44wrapped)return;
  const wrapped=function(...args){const result=old.apply(this,args);Promise.resolve(result).finally(()=>setTimeout(()=>syncOperationalV44({silent:true}),0));return result;};wrapped.__v44wrapped=true;window[name]=wrapped;
}
['saveBillV33','cancelBillV33','restoreBillV33','createMassBillV33','pay','reject','voidPaymentV33'].forEach(wrapSyncV44);

async function refreshGuardiansV44({silent=true}={}){
  if(!session||session.role!=='admin')return;
  try{const out=await apiV40('/api/v44/admin/guardians');window.EDUPAY_GUARDIANS_SERVER=out.guardians||[];if(page==='guardians')render();}catch(err){if(!silent)toast(err.message||'Gagal mengambil akun wali')}
}
refreshGuardiansV42=refreshGuardiansV44;

function guardiansV44(){
  const users=window.EDUPAY_GUARDIANS_SERVER||[];
  const counts={active:users.filter(u=>u.status==='active').length,invited:users.filter(u=>u.status==='invited').length,notInvited:users.filter(u=>u.status==='not_invited').length};
  return `<div class="page-head"><div><span class="page-kicker">Akses Orang Tua</span><h2>Akun Wali</h2><p>Atur sapaan/nama panggilan yang tampil pada portal wali.</p></div><button class="btn btn-soft" onclick="syncGuardianAccountsV36(true);setTimeout(()=>refreshGuardiansV44({silent:true}),300)">↻ Sinkronkan Akun Wali</button></div><div class="grid stats guardian-stats-v36">${stat('Total Akun',users.length,'stat-blue')}${stat('Aktif',counts.active,'stat-green')}${stat('Menunggu Aktivasi',counts.invited,'stat-amber')}${stat('Belum Diundang',counts.notInvited,'stat-red')}</div><div class="card">${users.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Wali</th><th>Username</th><th>Sapaan</th><th>Siswa</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${users.map(u=>`<tr><td><b>${esc(u.name)}</b><br><small>${esc(u.nickname||'Belum diatur')}</small></td><td>${esc(u.username)}</td><td>${esc(u.salutation||'Bapak/Ibu')}</td><td>${(u.students||[]).map(s=>`<span class="guardian-student-chip-v36">${esc(s.name)} · ${esc(s.className||'-')}</span>`).join(' ')||'-'}</td><td>${guardianStatusServerV42(u)}</td><td><div class="row-actions-v33"><button class="btn btn-soft btn-sm" onclick="editGuardianGreetingV44(${u.id})">Sapaan</button>${u.status==='active'?`<button class="btn btn-soft btn-sm" onclick="resetGuardianAccessV42(${u.id})">Reset Akses</button>`:u.status==='disabled'?'':`<button class="btn btn-primary btn-sm" onclick="createGuardianInviteV36(${u.id},false)">${u.status==='invited'?'Kirim Ulang':'Buat Undangan'}</button>`}<button class="btn ${u.status==='disabled'?'btn-ghost':'btn-danger'} btn-sm" onclick="toggleGuardianV42(${u.id},${u.status==='disabled'?'true':'false'})">${u.status==='disabled'?'Aktifkan':'Nonaktifkan'}</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada akun wali.</div>'}</div>`;
}
async function editGuardianGreetingV44(id){
  const u=(window.EDUPAY_GUARDIANS_SERVER||[]).find(x=>Number(x.id)===Number(id));if(!u)return;
  openCrudV33('Sapaan Portal Wali',`<form onsubmit="saveGuardianGreetingV44(event,${u.id})"><div class="modal-grid"><div><label>Sapaan</label><select id="guardianSalutationV44" class="field"><option value="Bapak" ${u.salutation==='Bapak'?'selected':''}>Bapak</option><option value="Ibu" ${u.salutation==='Ibu'?'selected':''}>Ibu</option></select></div><div><label>Nama Panggilan</label><input id="guardianNicknameV44" class="field" required value="${esc(u.nickname||String(u.name).split(' ')[0])}"></div></div><div class="proof-note">Contoh greeting: <b>Halo, Bapak Budi 👋</b></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Batal</button><button class="btn btn-primary">Simpan</button></div></form>`);
}
async function saveGuardianGreetingV44(e,id){e.preventDefault();try{await apiV40(`/api/v44/admin/guardians/${id}/profile`,{method:'POST',body:{salutation:guardianSalutationV44.value,nickname:guardianNicknameV44.value.trim()}});closeCrudV33();await refreshGuardiansV44({silent:true});toast('Sapaan wali disimpan');}catch(err){toast(err.message||'Gagal menyimpan sapaan')}}
views.guardians=guardiansV44;

const baseDashboardViewV44=views.dashboard;
views.dashboard=function(){return session?.role==='parent'?parentDashboardV44():baseDashboardViewV44();};
views.mybills=function(){return session?.role==='parent'?myBillsV44():mybills();};
views.history=function(){return session?.role==='parent'?historyV44():historyV33();};

const loginBeforeV44=login;
login=async function(e){await loginBeforeV44(e);if(session?.role==='parent')startParentPollingV44();else if(['admin','finance'].includes(session?.role))setTimeout(()=>syncOperationalV44({silent:true}),100);};
const logoutBeforeV44=logout;
logout=async function(){if(window.EDUPAY_PARENT_TIMER){clearInterval(window.EDUPAY_PARENT_TIMER);window.EDUPAY_PARENT_TIMER=null;}window.EDUPAY_PARENT_STATE=null;return logoutBeforeV44();};

window.addEventListener('focus',()=>{if(session?.role==='parent')refreshParentStateV44({silent:true});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session?.role==='parent')refreshParentStateV44({silent:true});});

if(session?.role==='parent')startParentPollingV44();
if(session?.role==='admin'){refreshGuardiansV44({silent:true});setTimeout(()=>syncOperationalV44({silent:true}),200);}
if(session?.role==='finance')setTimeout(()=>syncOperationalV44({silent:true}),200);
render();
