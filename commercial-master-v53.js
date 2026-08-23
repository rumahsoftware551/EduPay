// EduPay V5.3 Commercial Core
// Server-first Admin CRUD + school profile. LocalStorage is cache only for Admin.
(function(){
  window.EDUPAY_V53={csrf:null,loading:false,school:null,lastRefresh:null,error:null};

  async function csrfV53(force=false){
    if(window.EDUPAY_V53.csrf&&!force)return window.EDUPAY_V53.csrf;
    const out=await apiV40('/api/v53/csrf');
    window.EDUPAY_V53.csrf=out.token;return out.token;
  }
  window.apiV53=async function(path,{method='GET',body=null}={}){
    const headers={'Content-Type':'application/json'};
    if(method!=='GET')headers['X-CSRF-Token']=await csrfV53();
    let res=await fetch(path,{method,credentials:'same-origin',headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
    let data={};try{data=await res.json()}catch(e){}
    if(res.status===419&&method!=='GET'){
      headers['X-CSRF-Token']=await csrfV53(true);
      res=await fetch(path,{method,credentials:'same-origin',headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});try{data=await res.json()}catch(e){data={}}
    }
    if(!res.ok)throw new Error(data.message||`HTTP ${res.status}`);return data;
  };

  function applyAdminStateV53(out){
    if(!out?.ok)return;
    if(Array.isArray(out.classes))db.classes=out.classes;
    if(Array.isArray(out.homeroomTeachers))db.homeroomTeachers=out.homeroomTeachers;
    if(Array.isArray(out.students))db.students=out.students;
    if(Array.isArray(out.feeTypes))db.feeTypes=out.feeTypes;
    if(Array.isArray(out.bills))db.bills=out.bills;
    window.EDUPAY_V53.school=out.school||window.EDUPAY_V53.school;
    window.EDUPAY_V53.lastRefresh=new Date();window.EDUPAY_V53.error=null;
    save();
  }
  window.refreshAdminStateV53=async function({silent=true,forceRender=true}={}){
    if(!session||session.role!=='admin'||window.EDUPAY_V53.loading)return null;
    window.EDUPAY_V53.loading=true;
    try{const out=await apiV53('/api/v53/admin/state');applyAdminStateV53(out);if(forceRender)render();return out}
    catch(err){window.EDUPAY_V53.error=err.message||'Gagal mengambil data master dari VPS';if(!silent)toast(window.EDUPAY_V53.error);return null}
    finally{window.EDUPAY_V53.loading=false}
  };
  async function doneV53(message){closeCrudV33();await refreshAdminStateV53({silent:true,forceRender:false});render();toast(message)}

  // Final navigation for Commercial Master.
  const navBeforeV53=window.nav;
  window.nav=function(){
    if(session?.role==='admin')return [['dashboard','Dashboard'],['students','Data Siswa'],['guardians','Akun Wali'],['classes','Kelas'],['homerooms','Wali Kelas'],['fees','Jenis Pembayaran'],['bills','Tagihan'],['verification','Verifikasi Bukti'],['reports','Laporan'],['settings','Pengaturan Sekolah']];
    return navBeforeV53();
  };
  menuIcons.settings='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>';

  function schoolV53(){return window.EDUPAY_V53.school||{}}
  function schoolNameV53(){return schoolV53().name||'Sekolah EduPay'}
  function supportV53(){return schoolV53().support_email||'rumahsoftwarenetwork551@gmail.com'}
  function appNameV53(){return schoolV53().app_name||'EduPay'}
  const shellBeforeV53=window.shell;
  window.shell=function(content){
    let html=shellBeforeV53(content);const s=schoolV53();
    html=html.replace(/<strong>EduPay<\/strong><span>School Finance<\/span>/,`<strong>${esc(appNameV53())}</strong><span>${esc(schoolNameV53())}</span>`);
    html=html.replace(/<div class="sidebar-help">[\s\S]*?<\/div><button class="sidebar-user"/,`<div class="sidebar-help"><div class="help-icon">?</div><div><b>Butuh bantuan?</b><small>Email support:</small><a href="mailto:${esc(supportV53())}" class="support-link-v53">${esc(supportV53())}</a></div></div><button class="sidebar-user"`);
    return html;
  };

  window.settingsV53=function(){
    const s=schoolV53();
    if(!s.id&&!window.EDUPAY_V53.loading)setTimeout(()=>refreshAdminStateV53({silent:true}),0);
    return `<div class="page-head"><div><span class="page-kicker">Commercial Master</span><h2>Pengaturan Sekolah</h2><p>Identitas ini disimpan di PostgreSQL sehingga instalasi EduPay dapat dipakai ulang untuk sekolah lain tanpa mengubah source.</p></div><div class="commercial-badge-v53">V5.3 · Server First</div></div>
    <form class="card school-settings-v53" onsubmit="saveSchoolSettingsV53(event)">
      <div class="settings-section-v53"><h3>Identitas Sekolah</h3><div class="modal-grid"><div class="span-2-v33"><label>Nama Sekolah</label><input id="setSchoolNameV53" class="field" required value="${esc(s.name||'')}"></div><div><label>NPSN</label><input id="setNpsnV53" class="field" value="${esc(s.npsn||'')}"></div><div><label>Nama Aplikasi</label><input id="setAppNameV53" class="field" value="${esc(s.app_name||'EduPay')}"></div><div class="span-2-v33"><label>Alamat</label><textarea id="setAddressV53" class="field">${esc(s.address||'')}</textarea></div><div><label>Telepon</label><input id="setPhoneV53" class="field" value="${esc(s.phone||'')}"></div><div><label>Email Sekolah</label><input id="setEmailV53" class="field" type="email" value="${esc(s.email||'')}"></div><div><label>Kepala Sekolah</label><input id="setPrincipalV53" class="field" value="${esc(s.principal_name||'')}"></div><div><label>Bendahara</label><input id="setTreasurerV53" class="field" value="${esc(s.treasurer_name||'')}"></div></div></div>
      <div class="settings-section-v53"><h3>Akademik Aktif</h3><div class="modal-grid"><div><label>Tahun Ajaran</label><input id="setYearV53" class="field" placeholder="2026/2027" value="${esc(s.academic_year_current||'')}"></div><div><label>Semester</label><select id="setSemesterV53" class="field"><option value="" ${!s.semester_current?'selected':''}>Pilih</option><option value="Ganjil" ${s.semester_current==='Ganjil'?'selected':''}>Ganjil</option><option value="Genap" ${s.semester_current==='Genap'?'selected':''}>Genap</option></select></div></div></div>
      <div class="settings-section-v53"><h3>Pembayaran & Support</h3><div class="modal-grid"><div><label>Bank</label><input id="setBankV53" class="field" value="${esc(s.bank_name||'')}"></div><div><label>No. Rekening</label><input id="setAccountV53" class="field" value="${esc(s.bank_account||'')}"></div><div><label>Atas Nama</label><input id="setAccountNameV53" class="field" value="${esc(s.bank_account_name||'')}"></div><div><label>Email Support</label><input id="setSupportV53" class="field" type="email" value="${esc(s.support_email||'rumahsoftwarenetwork551@gmail.com')}"></div><div class="span-2-v33"><label>Informasi QRIS</label><textarea id="setQrisV53" class="field" placeholder="Nama merchant / instruksi QRIS">${esc(s.qris_info||'')}</textarea></div><div class="span-2-v33"><label>URL Logo Sekolah</label><input id="setLogoV53" class="field" placeholder="Opsional, https://..." value="${esc(s.logo_url||'')}"><small class="field-help-v35">Upload logo private akan ditambahkan pada fase branding berikutnya. Untuk V5.3 dapat menggunakan URL logo HTTPS.</small></div></div></div>
      <div class="modal-actions"><button type="button" class="btn btn-soft" onclick="refreshAdminStateV53({silent:false})">↻ Muat Ulang VPS</button><button class="btn btn-primary">Simpan Pengaturan</button></div>
    </form>`;
  };
  views.settings=window.settingsV53;
  window.saveSchoolSettingsV53=async function(e){e.preventDefault();try{const out=await apiV53('/api/v53/admin/school',{method:'POST',body:{name:setSchoolNameV53.value.trim(),npsn:setNpsnV53.value.trim(),address:setAddressV53.value.trim(),phone:setPhoneV53.value.trim(),email:setEmailV53.value.trim(),principalName:setPrincipalV53.value.trim(),treasurerName:setTreasurerV53.value.trim(),bankName:setBankV53.value.trim(),bankAccount:setAccountV53.value.trim(),bankAccountName:setAccountNameV53.value.trim(),qrisInfo:setQrisV53.value.trim(),academicYear:setYearV53.value.trim(),semester:setSemesterV53.value,supportEmail:setSupportV53.value.trim(),appName:setAppNameV53.value.trim()||'EduPay',logoUrl:setLogoV53.value.trim()}});window.EDUPAY_V53.school=out.school;render();toast(out.message||'Pengaturan sekolah disimpan')}catch(err){toast(err.message||'Gagal menyimpan pengaturan sekolah')}};

  // Student CRUD: server first.
  window.saveStudentV33=async function(e,id){e.preventDefault();const body={nis:crudNis.value.trim(),name:crudStudentName.value.trim(),classId:Number(crudClassId.value),parent:crudParent.value.trim(),phone:crudPhone.value.trim()};try{const out=await apiV53(id?`/api/v53/admin/students/${id}`:'/api/v53/admin/students',{method:'POST',body});await doneV53(out.message||'Data siswa berhasil disimpan')}catch(err){toast(err.message||'Gagal menyimpan siswa')}};
  window.toggleStudentV33=async function(id){const s=byId(db.students,id);if(!s)return;const active=s.active===false;try{const out=await apiV53(`/api/v53/admin/students/${id}/status`,{method:'POST',body:{active}});await refreshAdminStateV53({silent:true,forceRender:false});render();toast(out.message)}catch(err){toast(err.message||'Gagal mengubah status siswa')}};
  window.commitStudentImportV34=async function(){const rows=importRowsV34.filter(r=>r.valid);if(!rows.length)return toast('Tidak ada data valid untuk diimport');if(!confirm(`Import ${rows.length} siswa langsung ke VPS?`))return;try{const out=await apiV53('/api/v53/admin/students/import',{method:'POST',body:{students:rows.map(r=>({nis:r.nis,name:r.name,classId:r.classId,parent:r.parent,phone:r.phone}))}});importRowsV34=[];await doneV53(`${out.created||0} siswa baru, ${out.updated||0} diperbarui`)}catch(err){toast(err.message||'Import siswa gagal')}};

  // Class CRUD: server first.
  window.saveClassV35=async function(e,id){e.preventDefault();const body={name:classNameV35.value.trim(),level:classLevelV35.value.trim(),academicYear:classYearV35.value.trim(),homeroomTeacherId:classTeacherV35.value?Number(classTeacherV35.value):null};try{const out=await apiV53(id?`/api/v53/admin/classes/${id}`:'/api/v53/admin/classes',{method:'POST',body});await doneV53(out.message||'Kelas berhasil disimpan')}catch(err){toast(err.message||'Gagal menyimpan kelas')}};
  window.toggleClassV35=async function(id){const c=byId(db.classes,id);if(!c)return;const active=c.active===false;try{const out=await apiV53(`/api/v53/admin/classes/${id}/status`,{method:'POST',body:{active}});await refreshAdminStateV53({silent:true,forceRender:false});render();toast(out.message)}catch(err){toast(err.message||'Gagal mengubah status kelas')}};

  // Homeroom CRUD/import: server first.
  window.saveHomeroomV35=async function(e,id){e.preventDefault();const body={nip:teacherNipV35.value.trim(),name:teacherNameV35.value.trim(),phone:teacherPhoneV35.value.trim(),email:teacherEmailV35.value.trim()};try{const out=await apiV53(id?`/api/v53/admin/homerooms/${id}`:'/api/v53/admin/homerooms',{method:'POST',body});await doneV53(out.message||'Wali kelas berhasil disimpan')}catch(err){toast(err.message||'Gagal menyimpan wali kelas')}};
  window.toggleHomeroomV35=async function(id){const t=byId(db.homeroomTeachers,id);if(!t)return;const active=t.active===false;try{const out=await apiV53(`/api/v53/admin/homerooms/${id}/status`,{method:'POST',body:{active}});await refreshAdminStateV53({silent:true,forceRender:false});render();toast(out.message)}catch(err){toast(err.message||'Gagal mengubah status wali kelas')}};
  window.commitHomeroomImportRowsV46=async function(){const rows=homeroomImportRowsV46.filter(r=>r.valid);if(!rows.length)return toast('Tidak ada data valid');if(!confirm(`Import ${rows.length} wali kelas langsung ke VPS?`))return;try{const out=await apiV53('/api/v53/admin/homerooms/import',{method:'POST',body:{teachers:rows.map(r=>({nip:r.nip,name:r.name,phone:r.phone,email:r.email,classId:r.classId||null}))}});homeroomImportRowsV46=[];await doneV53(`${out.created||0} wali kelas baru, ${out.updated||0} diperbarui`)}catch(err){toast(err.message||'Import wali kelas gagal')}};

  // Fee CRUD: server first.
  window.saveFeeV33=async function(e,id){e.preventDefault();const body={name:crudFeeName.value.trim(),amount:Number(crudFeeAmount.value),period:crudFeePeriod.value};try{const out=await apiV53(id?`/api/v53/admin/fee-types/${id}`:'/api/v53/admin/fee-types',{method:'POST',body});await doneV53(out.message||'Jenis pembayaran berhasil disimpan')}catch(err){toast(err.message||'Gagal menyimpan jenis pembayaran')}};
  window.toggleFeeV33=async function(id){const f=byId(db.feeTypes,id);if(!f)return;const active=f.active===false;try{const out=await apiV53(`/api/v53/admin/fee-types/${id}/status`,{method:'POST',body:{active}});await refreshAdminStateV53({silent:true,forceRender:false});render();toast(out.message)}catch(err){toast(err.message||'Gagal mengubah status jenis pembayaran')}};

  // Bill CRUD/mass: server first.
  window.saveBillV33=async function(e,id){e.preventDefault();const body={studentId:Number(crudBillStudent.value),title:crudBillTitle.value.trim(),amount:Number(crudBillAmount.value),due:crudBillDue.value};try{const out=await apiV53(id?`/api/v53/admin/bills/${id}`:'/api/v53/admin/bills',{method:'POST',body});await doneV53(out.message||'Tagihan berhasil disimpan')}catch(err){toast(err.message||'Gagal menyimpan tagihan')}};
  window.cancelBillV33=async function(id){if(!confirm('Batalkan tagihan ini?'))return;try{const out=await apiV53(`/api/v53/admin/bills/${id}/cancel`,{method:'POST',body:{}});await refreshAdminStateV53({silent:true,forceRender:false});render();toast(out.message)}catch(err){toast(err.message||'Gagal membatalkan tagihan')}};
  window.restoreBillV33=async function(id){try{const out=await apiV53(`/api/v53/admin/bills/${id}/restore`,{method:'POST',body:{}});await refreshAdminStateV53({silent:true,forceRender:false});render();toast(out.message)}catch(err){toast(err.message||'Gagal memulihkan tagihan')}};
  window.createMassBillV33=async function(e){e.preventDefault();const body={classId:massClassId.value,title:massTitle.value.trim(),amount:Number(massAmount.value),due:massDue.value};if(!confirm(`Buat tagihan “${body.title}” langsung di VPS?`))return;try{const out=await apiV53('/api/v53/admin/bills/mass',{method:'POST',body});await doneV53(`${out.created||0} tagihan dibuat${out.skipped?`, ${out.skipped} dilewati`:''}`)}catch(err){toast(err.message||'Gagal membuat tagihan massal')}};

  // Legacy sync becomes read-only for Admin. Finance keeps V4.9 behavior.
  const oldSyncAllV53=window.syncAllServerV49;
  window.syncAllServerV49=async function(opts={}){if(session?.role==='admin')return refreshAdminStateV53({silent:opts.silent!==false,forceRender:opts.refresh!==false});return oldSyncAllV53?oldSyncAllV53(opts):null};
  window.syncOperationalV44=async function({silent=true}={}){if(session?.role==='admin')return refreshAdminStateV53({silent,forceRender:true});if(oldSyncAllV53)return oldSyncAllV53({silent,refresh:true});};
  window.syncStudentsServerV47=async function({silent=false}={}){const out=await refreshAdminStateV53({silent,forceRender:true});return out?{students:db.students.length,missingGuardian:db.students.filter(s=>s.active!==false&&(!s.parent||!s.phone)).length}:null};
  window.syncHomeroomsV46=async function({silent=false}={}){const out=await refreshAdminStateV53({silent,forceRender:true});if(!silent&&out)toast('Data wali kelas dimuat dari PostgreSQL');return out};

  // Refresh after login and when returning to the app.
  const loginBeforeV53=window.login;
  window.login=async function(e){await loginBeforeV53(e);if(session?.role==='admin'){window.EDUPAY_V53.csrf=null;await refreshAdminStateV53({silent:false,forceRender:true});}};
  const logoutBeforeV53=window.logout;
  window.logout=async function(){window.EDUPAY_V53.csrf=null;window.EDUPAY_V53.school=null;return logoutBeforeV53();};
  window.addEventListener('focus',()=>{if(session?.role==='admin')refreshAdminStateV53({silent:true,forceRender:false})});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session?.role==='admin')refreshAdminStateV53({silent:true,forceRender:false})});

  if(session?.role==='admin')setTimeout(()=>refreshAdminStateV53({silent:true,forceRender:true}),120);
  render();
})();
