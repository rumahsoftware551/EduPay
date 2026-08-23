// EduPay V4.2 - Server-side authentication & guardian admin bridge
window.EDUPAY_API_ENABLED = true;
window.EDUPAY_GUARDIANS_SERVER = [];
window.EDUPAY_GUARDIANS_LOADING = false;

async function apiV40(path, options={}){
  const res = await fetch(path, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: {'Content-Type':'application/json', ...(options.headers||{})},
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store'
  });
  let data={};
  try{data=await res.json()}catch(e){}
  if(!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

login = async function(e){
  e.preventDefault();
  const u=username.value.trim(), p=password.value;
  try{
    const out=await apiV40('/api/auth/login',{method:'POST',body:{username:u,password:p}});
    session=out.user;
    localStorage.setItem(SESSION,JSON.stringify(session));
    page='dashboard';render();toast('Login berhasil');
  }catch(err){toast(err.message||'Login gagal')}
};

logout = async function(){
  try{await apiV40('/api/auth/logout',{method:'POST'})}catch(e){}
  session=null;localStorage.removeItem(SESSION);page='dashboard';render();
};

activateGuardianV36 = async function(e){
  e.preventDefault();
  const username=activatePhoneV36.value.trim(), code=activateCodeV36.value.trim(), password=activatePasswordV36.value, password2=activatePassword2V36.value;
  if(password!==password2)return toast('Konfirmasi password tidak sama');
  try{
    const out=await apiV40('/api/auth/activate',{method:'POST',body:{username,code,password}});
    closeCrudV33();render();toast(out.message||'Akun berhasil diaktifkan');
  }catch(err){toast(err.message||'Aktivasi gagal')}
};

async function refreshServerSessionV40(){
  try{
    const out=await apiV40('/api/auth/me');
    if(out.user){session=out.user;localStorage.setItem(SESSION,JSON.stringify(session));}
    else if(session){session=null;localStorage.removeItem(SESSION);}
  }catch(e){}
}

function guardianStatusServerV42(u){
  if(u.status==='disabled')return '<span class="badge danger"><i></i>Nonaktif</span>';
  if(u.locked_until && new Date(u.locked_until).getTime()>Date.now())return '<span class="badge danger"><i></i>Terkunci</span>';
  if(u.status==='active')return '<span class="badge ok"><i></i>Aktif</span>';
  if(u.status==='invited')return '<span class="badge warn"><i></i>Menunggu Aktivasi</span>';
  return '<span class="badge info"><i></i>Belum Diundang</span>';
}

async function refreshGuardiansV42({silent=false}={}){
  if(!session || session.role!=='admin')return;
  if(window.EDUPAY_GUARDIANS_LOADING)return;
  window.EDUPAY_GUARDIANS_LOADING=true;
  try{
    const out=await apiV40('/api/admin/guardians');
    window.EDUPAY_GUARDIANS_SERVER=out.guardians||[];
    if(page==='guardians')render();
  }catch(err){if(!silent)toast(err.message||'Gagal mengambil data akun wali')}
  finally{window.EDUPAY_GUARDIANS_LOADING=false;}
}

function guardiansV36(){
  const users=window.EDUPAY_GUARDIANS_SERVER||[];
  const counts={
    active:users.filter(u=>u.status==='active').length,
    invited:users.filter(u=>u.status==='invited').length,
    notInvited:users.filter(u=>u.status==='not_invited').length,
    disabled:users.filter(u=>u.status==='disabled').length
  };
  const loading=!users.length&&window.EDUPAY_GUARDIANS_LOADING;
  const rows=users.map(u=>{
    const students=(u.students||[]).map(s=>`<span class="guardian-student-chip-v36">${esc(s.name)} · ${esc(s.className||'-')}</span>`).join(' ')||'<span class="muted-v35">Tidak ada siswa aktif</span>';
    const inviteDate=u.last_invite_at?new Date(u.last_invite_at).toLocaleString('id-ID'):'-';
    let primary='';
    if(u.status==='active')primary=`<button class="btn btn-soft btn-sm" onclick="resetGuardianAccessV42(${u.id})">Reset Akses</button>`;
    else if(u.status==='disabled')primary='';
    else primary=`<button class="btn btn-primary btn-sm" onclick="createGuardianInviteV36(${u.id},false)">${u.status==='invited'?'Kirim Ulang':'Buat Undangan'}</button>`;
    const toggle=`<button class="btn ${u.status==='disabled'?'btn-ghost':'btn-danger'} btn-sm" onclick="toggleGuardianV42(${u.id},${u.status==='disabled'?'true':'false'})">${u.status==='disabled'?'Aktifkan':'Nonaktifkan'}</button>`;
    return `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.username)}</td><td>${students}</td><td>${guardianStatusServerV42(u)}</td><td>${inviteDate}</td><td><div class="row-actions-v33">${primary}${toggle}</div></td></tr>`;
  }).join('');
  setTimeout(()=>refreshGuardiansV42({silent:true}),0);
  return `<div class="page-head"><div><span class="page-kicker">Akses Orang Tua</span><h2>Akun Wali</h2><p>Status akun diambil langsung dari PostgreSQL.</p></div><button class="btn btn-soft" onclick="syncGuardianAccountsV36(true)">↻ Sinkronkan Akun Wali</button></div>
  <div class="guardian-rule-v36"><b>Rules akun wali:</b><span>Username memakai nomor HP wali · password dibuat sendiri saat aktivasi · kode aktivasi berlaku 24 jam · akun aktif tidak dapat dibuatkan undangan baru · reset akses memakai aksi khusus.</span></div>
  <div class="grid stats guardian-stats-v36">${stat('Total Akun',users.length,'stat-blue')}${stat('Aktif',counts.active,'stat-green')}${stat('Menunggu Aktivasi',counts.invited,'stat-amber')}${stat('Belum Diundang',counts.notInvited,'stat-red')}</div>
  <div class="card">${loading?'<div class="empty">Memuat data akun wali dari server...</div>':users.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Wali</th><th>Username</th><th>Siswa Terhubung</th><th>Status</th><th>Undangan Terakhir</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">Belum ada akun wali di server. Klik Sinkronkan Akun Wali.</div>'}</div>`;
}
views.guardians=guardiansV36;

syncGuardianAccountsV36 = async function(showToast=false){
  try{
    const out=await apiV40('/api/admin/guardians/sync',{method:'POST'});
    await refreshGuardiansV42({silent:true});
    if(showToast)toast(`Sinkronisasi server: ${out.created||0} akun baru, ${out.linked||0} relasi siswa`);
  }catch(err){if(showToast)toast(err.message||'Sinkronisasi gagal')}
};

function inviteMessageV42(out, reset=false){
  return `EduPay Sekolah\n\nHalo Bapak/Ibu ${out.name}.\n${reset?'Akses akun Anda sedang direset.':'Akun portal pembayaran sekolah sudah tersedia.'}\n\nUsername: ${out.username}\nKode aktivasi: ${out.code}\nKode berlaku ${out.expires_hours||24} jam.\n\nBuka ${location.origin}, pilih “Aktivasi Akun Wali”, lalu buat password Anda sendiri.\n\nJangan bagikan kode aktivasi atau password kepada orang lain.`;
}
function showInviteModalV42(out,reset=false){
  const message=inviteMessageV42(out,reset);
  openCrudV33(reset?'Reset Akses Wali':'Undangan Akun Wali',`<div class="invite-card-v36"><div class="invite-icon-v36">✓</div><div><b>${reset?'Kode reset berhasil dibuat':'Undangan siap dikirim'}</b><p>Status tersimpan di database server dan dapat digunakan dari perangkat lain.</p></div></div><textarea id="guardianInviteTextV36" class="invite-text-v36" readonly>${esc(message)}</textarea><div class="activation-summary-v36"><div><span>Username</span><b>${esc(out.username)}</b></div><div><span>Kode Aktivasi</span><b>${esc(out.code)}</b></div><div><span>Berlaku</span><b>${out.expires_hours||24} jam</b></div></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Tutup</button><button type="button" class="btn btn-primary" onclick="copyGuardianInviteV36()">Salin Pesan</button></div>`);
}

createGuardianInviteV36 = async function(id,isReset=false){
  if(isReset)return resetGuardianAccessV42(id);
  try{
    const out=await apiV40(`/api/admin/guardians/${id}/invite`,{method:'POST'});
    await refreshGuardiansV42({silent:true});
    showInviteModalV42(out,false);
  }catch(err){toast(err.message||'Gagal membuat undangan')}
};

async function resetGuardianAccessV42(id){
  if(!confirm('Reset akses akan menonaktifkan password lama dan wali harus membuat password baru. Lanjutkan?'))return;
  try{
    const out=await apiV40(`/api/admin/guardians/${id}/reset`,{method:'POST'});
    await refreshGuardiansV42({silent:true});
    showInviteModalV42(out,true);
  }catch(err){toast(err.message||'Gagal mereset akses')}
}

async function toggleGuardianV42(id,enable){
  const msg=enable?'Aktifkan kembali akun wali ini?':'Nonaktifkan akun wali ini? Wali tidak dapat login sampai akun diaktifkan kembali.';
  if(!confirm(msg))return;
  try{
    await apiV40(`/api/admin/guardians/${id}/status`,{method:'POST',body:{enabled:enable}});
    await refreshGuardiansV42({silent:true});
    toast(enable?'Akun wali diaktifkan':'Akun wali dinonaktifkan');
  }catch(err){toast(err.message||'Gagal mengubah status akun')}
}

window.addEventListener('focus',()=>{if(session?.role==='admin'&&page==='guardians')refreshGuardiansV42({silent:true})});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session?.role==='admin'&&page==='guardians')refreshGuardiansV42({silent:true})});

(async()=>{await refreshServerSessionV40();if(session?.role==='admin')await refreshGuardiansV42({silent:true});render()})();
