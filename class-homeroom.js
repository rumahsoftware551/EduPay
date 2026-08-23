// EduPay V3.5 - Master Kelas & Wali Kelas
(function(){
  let dirty=false;
  if(!Array.isArray(db.homeroomTeachers)){db.homeroomTeachers=[];dirty=true}
  db.classes.forEach(c=>{
    if(typeof c.active==='undefined'){c.active=true;dirty=true}
    if(typeof c.academicYear==='undefined'){c.academicYear='2026/2027';dirty=true}
    if(typeof c.level==='undefined'){c.level=String(c.name||'').split(' ')[0]||'';dirty=true}
    if(typeof c.homeroomTeacherId==='undefined'){c.homeroomTeacherId=null;dirty=true}
  });
  if(dirty)save();
})();

menuIcons.classes='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V5l7-3 7 3v16"/><path d="M9 9h2M9 13h2M9 17h2M15 9h2M15 13h2M15 17h2"/></svg>';
menuIcons.homerooms='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="7" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4h6v10h-6"/><path d="M18 8h2"/></svg>';

function nav(){
  if(session.role==='admin')return [['dashboard','Dashboard'],['students','Data Siswa'],['classes','Kelas'],['homerooms','Wali Kelas'],['fees','Jenis Pembayaran'],['bills','Tagihan'],['reports','Laporan']];
  if(session.role==='finance')return [['dashboard','Dashboard'],['payments','Pembayaran'],['verification','Verifikasi Bukti'],['reports','Laporan']];
  return [['dashboard','Beranda'],['mybills','Tagihan Saya'],['history','Riwayat'],['profile','Profil']];
}

function teacherNameV35(id){return byId(db.homeroomTeachers,id)?.name||'Belum ditentukan'}
function classStudentCountV35(id){return db.students.filter(s=>Number(s.classId)===Number(id)&&s.active!==false).length}
function assignedClassNamesV35(teacherId){return db.classes.filter(c=>Number(c.homeroomTeacherId)===Number(teacherId)&&c.active!==false).map(c=>c.name)}

function classesV35(){
  const rows=db.classes.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'id'));
  return `<div class="page-head"><div><span class="page-kicker">Master Akademik</span><h2>Kelas</h2><p>Kelola kelas, tingkat, tahun ajaran, jumlah siswa, dan wali kelas.</p></div><button class="btn btn-primary" onclick="classFormV35()">+ Tambah Kelas</button></div>
  <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Kelas</th><th>Tingkat</th><th>Tahun Ajaran</th><th>Wali Kelas</th><th>Siswa Aktif</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.level||'-')}</td><td>${esc(c.academicYear||'-')}</td><td>${c.homeroomTeacherId?`<span class="teacher-chip-v35">${esc(teacherNameV35(c.homeroomTeacherId))}</span>`:'<span class="muted-v35">Belum ditentukan</span>'}</td><td><b>${classStudentCountV35(c.id)}</b></td><td>${activeTextV33(c.active)}</td><td><div class="row-actions-v33"><button class="btn btn-soft btn-sm" onclick="classFormV35(${c.id})">Edit</button><button class="btn ${c.active===false?'btn-ghost':'btn-danger'} btn-sm" onclick="toggleClassV35(${c.id})">${c.active===false?'Aktifkan':'Nonaktifkan'}</button></div></td></tr>`).join('')}</tbody></table></div></div>`
}

function classFormV35(id=null){
  const c=id?byId(db.classes,id):null;
  const teachers=db.homeroomTeachers.filter(t=>t.active!==false);
  openCrudV33(c?'Edit Kelas':'Tambah Kelas',`<form onsubmit="saveClassV35(event,${id||'null'})"><div class="modal-grid"><div class="span-2-v33"><label>Nama Kelas</label><input id="classNameV35" class="field" required placeholder="Contoh: X RPL 1 / Kelas 1A" value="${esc(c?.name||'')}"></div><div><label>Tingkat</label><input id="classLevelV35" class="field" required placeholder="Contoh: X / 1 / 7" value="${esc(c?.level||'')}"></div><div><label>Tahun Ajaran</label><input id="classYearV35" class="field" required placeholder="2026/2027" value="${esc(c?.academicYear||'2026/2027')}"></div><div class="span-2-v33"><label>Wali Kelas</label><select id="classTeacherV35" class="field"><option value="">Belum ditentukan</option>${teachers.map(t=>`<option value="${t.id}" ${Number(c?.homeroomTeacherId)===Number(t.id)?'selected':''}>${esc(t.name)}${t.nip?' — '+esc(t.nip):''}</option>`).join('')}</select><small class="field-help-v35">Satu wali kelas hanya dapat ditugaskan pada satu kelas aktif.</small></div></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Batal</button><button class="btn btn-primary">Simpan Kelas</button></div></form>`)
}

function saveClassV35(e,id){
  e.preventDefault();
  const name=classNameV35.value.trim(),level=classLevelV35.value.trim(),academicYear=classYearV35.value.trim(),homeroomTeacherId=classTeacherV35.value?Number(classTeacherV35.value):null;
  if(db.classes.some(c=>String(c.name).trim().toLowerCase()===name.toLowerCase()&&String(c.academicYear||'').trim()===academicYear&&Number(c.id)!==Number(id)))return toast('Nama kelas sudah ada pada tahun ajaran tersebut');
  if(homeroomTeacherId){const used=db.classes.find(c=>Number(c.homeroomTeacherId)===homeroomTeacherId&&c.active!==false&&Number(c.id)!==Number(id));if(used)return toast(`Wali kelas sudah ditugaskan di ${used.name}`)}
  if(id){Object.assign(byId(db.classes,id),{name,level,academicYear,homeroomTeacherId})}else{db.classes.push({id:nextIdV33(db.classes),name,level,academicYear,homeroomTeacherId,active:true})}
  save();closeCrudV33();render();toast('Data kelas berhasil disimpan');
}

function toggleClassV35(id){
  const c=byId(db.classes,id);if(!c)return;
  if(c.active!==false){const count=classStudentCountV35(id);if(count)return toast(`Kelas masih memiliki ${count} siswa aktif`);c.active=false}else c.active=true;
  save();render();toast(c.active===false?'Kelas dinonaktifkan':'Kelas diaktifkan kembali');
}

function homeroomsV35(){
  const rows=db.homeroomTeachers.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'id'));
  return `<div class="page-head"><div><span class="page-kicker">Master Akademik</span><h2>Wali Kelas</h2><p>Kelola data guru wali kelas dan lihat kelas yang sedang diampu.</p></div><button class="btn btn-primary" onclick="homeroomFormV35()">+ Tambah Wali Kelas</button></div>
  <div class="card">${rows.length?`<div class="table-wrap"><table class="table"><thead><tr><th>NIP / NIK</th><th>Nama</th><th>No HP</th><th>Email</th><th>Kelas Diampu</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map(t=>{const assigned=assignedClassNamesV35(t.id);return `<tr><td>${esc(t.nip||'-')}</td><td><b>${esc(t.name)}</b></td><td>${esc(t.phone||'-')}</td><td>${esc(t.email||'-')}</td><td>${assigned.length?assigned.map(x=>`<span class="class-chip-v35">${esc(x)}</span>`).join(' '):'<span class="muted-v35">Belum ditugaskan</span>'}</td><td>${activeTextV33(t.active)}</td><td><div class="row-actions-v33"><button class="btn btn-soft btn-sm" onclick="homeroomFormV35(${t.id})">Edit</button><button class="btn ${t.active===false?'btn-ghost':'btn-danger'} btn-sm" onclick="toggleHomeroomV35(${t.id})">${t.active===false?'Aktifkan':'Nonaktifkan'}</button></div></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty"><b>Belum ada wali kelas.</b><br>Tambahkan guru wali kelas lalu hubungkan melalui menu Kelas.</div>'}</div>`
}

function homeroomFormV35(id=null){
  const t=id?byId(db.homeroomTeachers,id):null;
  openCrudV33(t?'Edit Wali Kelas':'Tambah Wali Kelas',`<form onsubmit="saveHomeroomV35(event,${id||'null'})"><div class="modal-grid"><div><label>NIP / NIK</label><input id="teacherNipV35" class="field" placeholder="Opsional" value="${esc(t?.nip||'')}"></div><div><label>Nama Guru</label><input id="teacherNameV35" class="field" required value="${esc(t?.name||'')}"></div><div><label>No HP</label><input id="teacherPhoneV35" class="field" placeholder="08xxxxxxxxxx" value="${esc(t?.phone||'')}"></div><div><label>Email</label><input id="teacherEmailV35" class="field" type="email" placeholder="guru@sekolah.sch.id" value="${esc(t?.email||'')}"></div></div><div class="proof-note">Penugasan kelas dilakukan melalui menu <b>Kelas</b> agar relasi siswa, kelas, dan wali kelas tetap konsisten.</div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Batal</button><button class="btn btn-primary">Simpan Wali Kelas</button></div></form>`)
}

function saveHomeroomV35(e,id){
  e.preventDefault();
  const nip=teacherNipV35.value.trim(),name=teacherNameV35.value.trim(),phone=teacherPhoneV35.value.trim(),email=teacherEmailV35.value.trim();
  if(nip&&db.homeroomTeachers.some(t=>String(t.nip).trim()===nip&&Number(t.id)!==Number(id)))return toast('NIP/NIK sudah digunakan');
  if(id){Object.assign(byId(db.homeroomTeachers,id),{nip,name,phone,email})}else{db.homeroomTeachers.push({id:nextIdV33(db.homeroomTeachers),nip,name,phone,email,active:true})}
  save();closeCrudV33();render();toast('Data wali kelas berhasil disimpan');
}

function toggleHomeroomV35(id){
  const t=byId(db.homeroomTeachers,id);if(!t)return;
  if(t.active!==false){const assigned=assignedClassNamesV35(id);if(assigned.length)return toast(`Masih menjadi wali kelas ${assigned.join(', ')}`);t.active=false}else t.active=true;
  save();render();toast(t.active===false?'Wali kelas dinonaktifkan':'Wali kelas diaktifkan kembali');
}

views.classes=classesV35;
views.homerooms=homeroomsV35;
render();
