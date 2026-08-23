// EduPay V3.6 - Guardian account rules & activation workflow
// Client-side prototype only. Production must move credentials/tokens to a server-side database with password hashing.

function normalizeGuardianPhoneV36(value){
  let s=String(value??'').trim().replace(/[\s()-]/g,'');
  if(s.startsWith('+62'))s='0'+s.slice(3);
  else if(s.startsWith('62'))s='0'+s.slice(2);
  return s;
}
function nextUserIdV36(){return db.users.length?Math.max(...db.users.map(x=>Number(x.id)||0))+1:1}
function uniqV36(arr){return [...new Set((arr||[]).map(Number).filter(Boolean))]}
function guardianStatusLabelV36(u){
  if(u.guardianStatus==='disabled')return '<span class="badge danger"><i></i>Nonaktif</span>';
  if(u.lockedUntil&&Number(u.lockedUntil)>Date.now())return '<span class="badge danger"><i></i>Terkunci</span>';
  if(u.guardianStatus==='active')return '<span class="badge ok"><i></i>Aktif</span>';
  if(u.guardianStatus==='invited')return '<span class="badge warn"><i></i>Menunggu Aktivasi</span>';
  return '<span class="badge info"><i></i>Belum Diundang</span>';
}
function linkedStudentsV36(u){return uniqV36(u.studentIds?.length?u.studentIds:[u.studentId]).map(id=>byId(db.students,id)).filter(Boolean)}

function syncGuardianAccountsV36(showToast=false){
  const groups=new Map();
  db.students.filter(s=>s.active!==false).forEach(s=>{
    const phone=normalizeGuardianPhoneV36(s.phone);
    if(!phone)return;
    if(!groups.has(phone))groups.set(phone,[]);
    groups.get(phone).push(s);
  });
  let created=0,updated=0;
  groups.forEach((students,phone)=>{
    let u=db.users.find(x=>x.role==='parent'&&normalizeGuardianPhoneV36(x.username)===phone);
    if(!u){
      u={id:nextUserIdV36()+created,name:students[0].parent||'Wali Murid',username:phone,password:null,role:'parent',guardianStatus:'not_invited',studentIds:[],studentId:students[0].id,failedAttempts:0,lockedUntil:null};
      db.users.push(u);created++;
    }
    const ids=uniqV36(students.map(s=>s.id));
    const changed=JSON.stringify(uniqV36(u.studentIds))!==JSON.stringify(ids)||u.username!==phone;
    u.username=phone;
    u.name=students[0].parent||u.name||'Wali Murid';
    u.studentIds=ids;
    if(!ids.includes(Number(u.studentId)))u.studentId=ids[0]||null;
    if(!u.guardianStatus)u.guardianStatus=u.password?'active':'not_invited';
    if(typeof u.failedAttempts!=='number')u.failedAttempts=0;
    if(typeof u.lockedUntil==='undefined')u.lockedUntil=null;
    if(changed)updated++;
  });
  save();
  if(showToast)toast(`Sinkronisasi selesai: ${created} akun baru, ${updated} akun diperbarui`);
}

syncGuardianAccountsV36(false);

menuIcons.guardians='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="4"/><path d="M2 21a6 6 0 0 1 12 0"/><rect x="15" y="4" width="7" height="13" rx="2"/><path d="M18.5 14h.01"/></svg>';
menuIcons.children='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="3"/><path d="M2 21a6 6 0 0 1 12 0"/><path d="M12 21a5 5 0 0 1 10 0"/></svg>';

function nav(){
  if(session.role==='admin')return [['dashboard','Dashboard'],['students','Data Siswa'],['guardians','Akun Wali'],['classes','Kelas'],['homerooms','Wali Kelas'],['fees','Jenis Pembayaran'],['bills','Tagihan'],['reports','Laporan']];
  if(session.role==='finance')return [['dashboard','Dashboard'],['payments','Pembayaran'],['verification','Verifikasi Bukti'],['reports','Laporan']];
  const items=[['dashboard','Beranda']];
  if((session.studentIds||[]).length>1)items.push(['children','Anak Saya']);
  items.push(['mybills','Tagihan Saya'],['history','Riwayat'],['profile','Profil']);
  return items;
}

function guardiansV36(){
  const users=db.users.filter(u=>u.role==='parent').slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'id'));
  const counts={active:users.filter(u=>u.guardianStatus==='active').length,invited:users.filter(u=>u.guardianStatus==='invited').length,notInvited:users.filter(u=>!u.guardianStatus||u.guardianStatus==='not_invited').length};
  return `<div class="page-head"><div><span class="page-kicker">Akses Orang Tua</span><h2>Akun Wali</h2><p>Satu nomor HP = satu akun wali. Satu akun dapat terhubung ke beberapa siswa.</p></div><button class="btn btn-soft" onclick="syncGuardianAccountsV36(true);render()">↻ Sinkronkan dari Data Siswa</button></div>
  <div class="guardian-rule-v36"><b>Rules akun wali:</b><span>Username memakai nomor HP wali · password dibuat sendiri saat aktivasi · kode aktivasi berlaku 24 jam · 5 kali gagal login mengunci akun selama 15 menit · admin tidak dapat melihat password wali.</span></div>
  <div class="grid stats guardian-stats-v36">${stat('Total Akun',users.length,'stat-blue')}${stat('Aktif',counts.active,'stat-green')}${stat('Menunggu Aktivasi',counts.invited,'stat-amber')}${stat('Belum Diundang',counts.notInvited,'stat-red')}</div>
  <div class="card">${users.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Wali</th><th>Username</th><th>Siswa Terhubung</th><th>Status</th><th>Undangan</th><th>Aksi</th></tr></thead><tbody>${users.map(u=>{const students=linkedStudentsV36(u);return `<tr><td><b>${esc(u.name)}</b></td><td>${esc(normalizeGuardianPhoneV36(u.username))}</td><td>${students.length?students.map(s=>`<span class="guardian-student-chip-v36">${esc(s.name)} · ${esc(className(s.classId))}</span>`).join(' '):'<span class="muted-v35">Tidak ada siswa aktif</span>'}</td><td>${guardianStatusLabelV36(u)}</td><td>${u.lastInviteAt?new Date(u.lastInviteAt).toLocaleString('id-ID'):'-'}</td><td><div class="row-actions-v33">${u.guardianStatus==='active'?`<button class="btn btn-soft btn-sm" onclick="createGuardianInviteV36(${u.id},true)">Reset Akses</button>`:`<button class="btn btn-primary btn-sm" onclick="createGuardianInviteV36(${u.id},false)">${u.guardianStatus==='invited'?'Kirim Ulang':'Buat Undangan'}</button>`}<button class="btn ${u.guardianStatus==='disabled'?'btn-ghost':'btn-danger'} btn-sm" onclick="toggleGuardianV36(${u.id})">${u.guardianStatus==='disabled'?'Aktifkan':'Nonaktifkan'}</button></div></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">Belum ada akun wali. Pastikan Data Siswa memiliki nama wali dan nomor HP.</div>'}</div>`;
}

function randomActivationCodeV36(){
  if(window.crypto?.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);return String(100000+(a[0]%900000));}
  return String(Math.floor(100000+Math.random()*900000));
}
function createGuardianInviteV36(id,isReset=false){
  const u=byId(db.users,id);if(!u||u.role!=='parent')return;
  if(!linkedStudentsV36(u).length)return toast('Akun wali belum terhubung ke siswa aktif');
  const code=randomActivationCodeV36();
  u.activationCode=code;
  u.activationExpiresAt=Date.now()+24*60*60*1000;
  u.lastInviteAt=new Date().toISOString();
  u.guardianStatus='invited';
  u.failedAttempts=0;u.lockedUntil=null;
  if(isReset)u.password=null;
  save();render();
  const studentNames=linkedStudentsV36(u).map(s=>s.name).join(', ');
  const message=`EduPay Sekolah\n\nHalo Bapak/Ibu ${u.name}.\nAkun portal pembayaran untuk ${studentNames} sudah tersedia.\n\nUsername: ${normalizeGuardianPhoneV36(u.username)}\nKode aktivasi: ${code}\nKode berlaku 24 jam.\n\nBuka ${location.origin}, pilih “Aktivasi Akun Wali”, lalu buat password Anda sendiri.\n\nJangan bagikan kode aktivasi atau password kepada orang lain.`;
  openCrudV33(isReset?'Reset Akses Wali':'Undangan Akun Wali',`<div class="invite-card-v36"><div class="invite-icon-v36">✓</div><div><b>${isReset?'Kode reset berhasil dibuat':'Undangan siap dikirim'}</b><p>Salin pesan berikut dan kirim melalui kanal resmi sekolah/WhatsApp.</p></div></div><textarea id="guardianInviteTextV36" class="invite-text-v36" readonly>${esc(message)}</textarea><div class="activation-summary-v36"><div><span>Username</span><b>${esc(normalizeGuardianPhoneV36(u.username))}</b></div><div><span>Kode Aktivasi</span><b>${code}</b></div><div><span>Berlaku</span><b>24 jam</b></div></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Tutup</button><button type="button" class="btn btn-primary" onclick="copyGuardianInviteV36()">Salin Undangan</button></div>`);
}
async function copyGuardianInviteV36(){
  const text=document.getElementById('guardianInviteTextV36')?.value||'';
  try{await navigator.clipboard.writeText(text);toast('Undangan disalin')}catch(e){const el=document.getElementById('guardianInviteTextV36');el?.select();document.execCommand('copy');toast('Undangan disalin')}
}
function toggleGuardianV36(id){
  const u=byId(db.users,id);if(!u||u.role!=='parent')return;
  if(u.guardianStatus==='disabled'){u.guardianStatus=u.password?'active':'not_invited';toast('Akun wali diaktifkan kembali')}else{if(!confirm('Nonaktifkan akun wali ini? Wali tidak dapat login sampai akun diaktifkan kembali.'))return;u.guardianStatus='disabled';u.lockedUntil=null;toast('Akun wali dinonaktifkan')}
  save();render();
}

const baseLoginViewV36=loginView;
loginView=function(){
  let html=baseLoginViewV36();
  const tools=`<div class="guardian-login-tools-v36"><button type="button" onclick="openGuardianActivationV36()"><b>Aktivasi Akun Wali</b><span>Buat password pertama kali</span></button><button type="button" onclick="guardianForgotHelpV36()"><b>Lupa Password?</b><span>Hubungi admin untuk reset akses</span></button></div>`;
  return html.replace('<div class="demo-card">',tools+'<div class="demo-card">');
};

function openGuardianActivationV36(){
  openCrudV33('Aktivasi Akun Wali',`<form onsubmit="activateGuardianV36(event)"><div class="activation-note-v36">Gunakan nomor HP dan kode aktivasi yang dikirim oleh sekolah. Password dibuat oleh wali sendiri dan tidak ditampilkan kepada admin.</div><div><label>Nomor HP / Username</label><input id="activatePhoneV36" class="field" required placeholder="08xxxxxxxxxx"></div><div><label>Kode Aktivasi</label><input id="activateCodeV36" class="field activation-code-input-v36" required inputmode="numeric" maxlength="6" placeholder="6 digit"></div><div class="modal-grid"><div><label>Password Baru</label><input id="activatePasswordV36" class="field" type="password" required placeholder="Minimal 8 karakter"></div><div><label>Ulangi Password</label><input id="activatePassword2V36" class="field" type="password" required placeholder="Ulangi password"></div></div><div class="password-rules-v36">Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka.</div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Batal</button><button class="btn btn-primary">Aktifkan Akun</button></div></form>`);
}
function validGuardianPasswordV36(p){return p.length>=8&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/[0-9]/.test(p)}
function activateGuardianV36(e){
  e.preventDefault();
  const phone=normalizeGuardianPhoneV36(activatePhoneV36.value),code=activateCodeV36.value.trim(),p=activatePasswordV36.value,p2=activatePassword2V36.value;
  const u=db.users.find(x=>x.role==='parent'&&normalizeGuardianPhoneV36(x.username)===phone);
  if(!u)return toast('Akun wali tidak ditemukan');
  if(u.guardianStatus==='disabled')return toast('Akun dinonaktifkan. Hubungi admin sekolah.');
  if(u.guardianStatus!=='invited'||!u.activationCode)return toast('Belum ada undangan aktivasi yang aktif');
  if(Number(u.activationExpiresAt)<Date.now())return toast('Kode aktivasi sudah kedaluwarsa. Minta admin mengirim ulang.');
  if(String(u.activationCode)!==code)return toast('Kode aktivasi tidak sesuai');
  if(!validGuardianPasswordV36(p))return toast('Password belum memenuhi ketentuan keamanan');
  if(p!==p2)return toast('Konfirmasi password tidak sama');
  u.password=p;u.guardianStatus='active';u.activationCode=null;u.activationExpiresAt=null;u.activatedAt=new Date().toISOString();u.failedAttempts=0;u.lockedUntil=null;
  save();closeCrudV33();render();toast('Akun berhasil diaktifkan. Silakan login.')
}
function guardianForgotHelpV36(){
  openCrudV33('Lupa Password Wali',`<div class="activation-note-v36"><b>Untuk keamanan akun:</b><br>Wali tidak menerima password baru dari admin. Admin hanya membuat <b>kode reset akses</b>, kemudian wali membuat password baru sendiri melalui menu Aktivasi Akun Wali.</div><div class="modal-actions"><button class="btn btn-primary" onclick="closeCrudV33()">Mengerti</button></div>`)
}

login=function(e){
  e.preventDefault();
  let u=username.value.trim(),p=password.value;
  const normalized=normalizeGuardianPhoneV36(u);
  let f=db.users.find(x=>x.username===u)||db.users.find(x=>x.role==='parent'&&normalizeGuardianPhoneV36(x.username)===normalized);
  if(!f)return toast('Username atau password salah');
  if(f.role==='parent'){
    if(f.guardianStatus==='disabled')return toast('Akun wali dinonaktifkan. Hubungi admin sekolah.');
    if(f.guardianStatus!=='active')return toast('Akun wali belum diaktivasi. Gunakan kode aktivasi dari sekolah.');
    if(f.lockedUntil&&Number(f.lockedUntil)>Date.now()){const min=Math.ceil((Number(f.lockedUntil)-Date.now())/60000);return toast(`Akun terkunci. Coba lagi sekitar ${min} menit.`)}
    if(f.password!==p){f.failedAttempts=Number(f.failedAttempts||0)+1;if(f.failedAttempts>=5){f.lockedUntil=Date.now()+15*60*1000;f.failedAttempts=0}save();return toast(f.lockedUntil?'Terlalu banyak percobaan. Akun dikunci 15 menit.':'Username atau password salah')}
    f.failedAttempts=0;f.lockedUntil=null;save();
    const ids=uniqV36(f.studentIds?.length?f.studentIds:[f.studentId]).filter(id=>byId(db.students,id)?.active!==false);
    if(!ids.length)return toast('Akun belum terhubung ke siswa aktif');
    session={...f,studentIds:ids,studentId:ids.includes(Number(f.studentId))?Number(f.studentId):ids[0]};
  }else{
    if(f.password!==p)return toast('Username atau password salah');
    session=f;
  }
  localStorage.setItem(SESSION,JSON.stringify(session));page='dashboard';render();
};

function childrenV36(){
  const ids=uniqV36(session.studentIds?.length?session.studentIds:[session.studentId]);
  const students=ids.map(id=>byId(db.students,id)).filter(Boolean);
  return `<div class="page-head"><div><span class="page-kicker">Portal Orang Tua</span><h2>Anak Saya</h2><p>Satu akun wali dapat digunakan untuk seluruh anak yang terhubung.</p></div></div><div class="children-grid-v36">${students.map(s=>`<button class="child-card-v36 ${Number(session.studentId)===Number(s.id)?'active':''}" onclick="switchStudentV36(${s.id})"><div class="child-avatar-v36">${esc(s.name[0])}</div><div><b>${esc(s.name)}</b><span>${esc(s.nis)} · ${esc(className(s.classId))}</span>${Number(session.studentId)===Number(s.id)?'<em>Sedang dipilih</em>':'<em>Lihat tagihan anak ini →</em>'}</div></button>`).join('')}</div>`;
}
function switchStudentV36(id){
  const ids=uniqV36(session.studentIds||[]);if(!ids.includes(Number(id)))return;
  session.studentId=Number(id);localStorage.setItem(SESSION,JSON.stringify(session));page='dashboard';render();toast(`Menampilkan data ${studentName(id)}`);
}

views.guardians=guardiansV36;
views.children=childrenV36;
render();
