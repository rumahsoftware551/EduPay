// EduPay V4.0 - Server-side authentication bridge
window.EDUPAY_API_ENABLED = true;

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

const localLoginViewV40 = loginView;
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

const localGuardiansViewV40 = guardiansV36;
guardiansV36 = function(){
  const base=localGuardiansViewV40();
  return base.replace('↻ Sinkronkan dari Data Siswa','↻ Sinkronkan Akun Wali');
};
views.guardians=guardiansV36;

syncGuardianAccountsV36 = async function(showToast=false){
  try{
    const out=await apiV40('/api/admin/guardians/sync',{method:'POST'});
    if(showToast)toast(`Sinkronisasi server: ${out.created||0} akun baru, ${out.linked||0} relasi siswa`);
  }catch(err){if(showToast)toast(err.message||'Sinkronisasi gagal')}
};

createGuardianInviteV36 = async function(id,isReset=false){
  try{
    const out=await apiV40(`/api/admin/guardians/${id}/invite`,{method:'POST'});
    const message=`EduPay Sekolah\n\nHalo Bapak/Ibu ${out.name}.\nAkun portal pembayaran sekolah sudah tersedia.\n\nUsername: ${out.username}\nKode aktivasi: ${out.code}\nKode berlaku ${out.expires_hours||24} jam.\n\nBuka ${location.origin}, pilih “Aktivasi Akun Wali”, lalu buat password Anda sendiri.\n\nJangan bagikan kode aktivasi atau password kepada orang lain.`;
    openCrudV33(isReset?'Reset Akses Wali':'Undangan Akun Wali',`<div class="invite-card-v36"><div class="invite-icon-v36">✓</div><div><b>${isReset?'Kode reset berhasil dibuat':'Undangan siap dikirim'}</b><p>Undangan sekarang tersimpan di database server dan dapat digunakan dari perangkat lain.</p></div></div><textarea id="guardianInviteTextV36" class="invite-text-v36" readonly>${esc(message)}</textarea><div class="activation-summary-v36"><div><span>Username</span><b>${esc(out.username)}</b></div><div><span>Kode Aktivasi</span><b>${esc(out.code)}</b></div><div><span>Berlaku</span><b>${out.expires_hours||24} jam</b></div></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Tutup</button><button type="button" class="btn btn-primary" onclick="copyGuardianInviteV36()">Salin Undangan</button></div>`);
  }catch(err){toast(err.message||'Gagal membuat undangan')}
};

(async()=>{await refreshServerSessionV40();render()})();
