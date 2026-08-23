// EduPay V4.1 - one-time backend setup wizard
(function(){
  const params=new URLSearchParams(location.search);
  if(params.get('setup')!=='1')return;

  function setupEsc(v){return esc(v)}
  function localPayload(){
    return {
      classes:(db.classes||[]).map(c=>({
        id:c.id,
        name:c.name,
        level:c.level||'',
        academicYear:c.academicYear||'2026/2027',
        active:c.active!==false
      })),
      students:(db.students||[]).map(s=>({
        id:s.id,
        nis:s.nis,
        name:s.name,
        className:className(s.classId),
        parent:s.parent||'',
        phone:s.phone||'',
        active:s.active!==false
      }))
    };
  }

  window.openBackendSetupV41=function(){
    const p=localPayload();
    openCrudV33('Setup Backend EduPay V4.1',`<div class="activation-note-v36"><b>Langkah satu kali.</b><br>Wizard ini membuat akun Admin/Finance production dan mengirim ${p.classes.length} kelas + ${p.students.length} siswa dari browser ini ke PostgreSQL.</div><form onsubmit="runBackendSetupV41(event)"><div><label>Bootstrap Key</label><input id="setupBootstrapV41" class="field" type="password" required autocomplete="off" placeholder="Ambil dari server"></div><div class="modal-grid"><div><label>Password Admin Baru</label><input id="setupAdminPassV41" class="field" type="password" required autocomplete="new-password" placeholder="Minimal 8 karakter"></div><div><label>Ulangi Password Admin</label><input id="setupAdminPass2V41" class="field" type="password" required autocomplete="new-password"></div><div><label>Password Finance Baru</label><input id="setupFinancePassV41" class="field" type="password" required autocomplete="new-password" placeholder="Minimal 8 karakter"></div><div><label>Ulangi Password Finance</label><input id="setupFinancePass2V41" class="field" type="password" required autocomplete="new-password"></div></div><div class="password-rules-v36">Password minimal 8 karakter dan harus berisi huruf besar, huruf kecil, dan angka.</div><div class="proof-note">Setelah berhasil, login sebagai Admin dan buka <b>Akun Wali → Sinkronkan Akun Wali</b>. Lalu rotasi bootstrap key di server.</div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Batal</button><button id="setupRunBtnV41" class="btn btn-primary">Mulai Migrasi</button></div></form>`)
  };

  window.runBackendSetupV41=async function(e){
    e.preventDefault();
    const bootstrap_key=setupBootstrapV41.value.trim();
    const admin_password=setupAdminPassV41.value;
    const finance_password=setupFinancePassV41.value;
    if(admin_password!==setupAdminPass2V41.value)return toast('Konfirmasi password Admin tidak sama');
    if(finance_password!==setupFinancePass2V41.value)return toast('Konfirmasi password Finance tidak sama');
    if(!validGuardianPasswordV36(admin_password)||!validGuardianPasswordV36(finance_password))return toast('Password belum memenuhi aturan keamanan');
    const btn=document.getElementById('setupRunBtnV41');
    if(btn){btn.disabled=true;btn.textContent='Memigrasikan...'}
    try{
      const p=localPayload();
      const out=await apiV40('/api/admin/bootstrap',{method:'POST',body:{bootstrap_key,admin_password,finance_password,classes:p.classes,students:p.students}});
      closeCrudV33();
      localStorage.removeItem(SESSION);session=null;page='dashboard';render();
      setTimeout(()=>openCrudV33('Migrasi Backend Berhasil',`<div class="invite-card-v36"><div class="invite-icon-v36">✓</div><div><b>Data inti sudah masuk PostgreSQL</b><p>${setupEsc(out.message||'Bootstrap data inti selesai')}</p></div></div><div class="activation-summary-v36"><div><span>Kelas</span><b>${p.classes.length}</b></div><div><span>Siswa</span><b>${p.students.length}</b></div><div><span>Akun</span><b>Admin + Finance</b></div></div><div class="proof-note"><b>Berikutnya:</b> login menggunakan password Admin baru → Akun Wali → Sinkronkan Akun Wali. Setelah itu rotasi bootstrap key.</div><div class="modal-actions"><button class="btn btn-primary" onclick="location.href=location.origin">Ke Halaman Login</button></div>`),100);
    }catch(err){toast(err.message||'Migrasi backend gagal');if(btn){btn.disabled=false;btn.textContent='Mulai Migrasi'}}
  };

  setTimeout(()=>{
    if(!session)openBackendSetupV41();
    else{session=null;localStorage.removeItem(SESSION);render();setTimeout(openBackendSetupV41,100)}
  },250);
})();
