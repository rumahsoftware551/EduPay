// EduPay V5.6 Final UAT fixes: parent multi-child selector + VPS-backed profile
(function(){
  function parentState56(){return window.EDUPAY_PARENT_STATE||{};}
  function currentStudent56(){const st=parentState56(),id=Number(st.studentId||session?.studentId||0);return (st.students||[]).find(s=>Number(s.id)===id)||(st.students||[])[0]||null;}
  function selector56(){
    if(session?.role!=='parent')return '';
    const st=parentState56(),students=st.students||[];
    if(students.length<=1)return '';
    const selected=Number(st.studentId||session?.studentId||students[0]?.id||0);
    return `<div class="parent-child-switch-v56"><div><span>Data Anak</span><b>Pilih siswa yang ingin dilihat</b></div><select class="field" onchange="switchParentStudentV56(this.value)">${students.map(s=>`<option value="${Number(s.id)}" ${Number(s.id)===selected?'selected':''}>${esc(s.name)} · ${esc(s.className||s.class_name||'-')}</option>`).join('')}</select></div>`;
  }
  window.switchParentStudentV56=async function(id){
    const sid=Number(id);if(!sid||session?.role!=='parent')return;
    if(session)session.studentId=sid;
    if(typeof loadPortalStateV551==='function')await loadPortalStateV551({silent:false,forceRender:false,studentId:sid});
    if(page==='history'&&typeof refreshParentPaymentsV50==='function')await refreshParentPaymentsV50({silent:true,forceRender:false});
    render();
  };

  const dashboardBefore=views.dashboard;
  views.dashboard=function(){const html=dashboardBefore();return session?.role==='parent'?selector56()+html:html;};

  const myBillsBefore=views.mybills;
  views.mybills=function(){const html=myBillsBefore();return session?.role==='parent'?selector56()+html:html;};

  const historyBefore=views.history;
  views.history=function(){const html=historyBefore();return session?.role==='parent'?selector56()+html:html;};

  views.profile=function(){
    if(session?.role!=='parent')return '<div class="card"><div class="empty">Profil hanya tersedia untuk akun wali.</div></div>';
    const st=parentState56(),p=st.profile||{},student=currentStudent56(),students=st.students||[];
    if(!student)return `${selector56()}<div class="page-head"><div><h2>Profil Wali</h2><p>Data akun dibaca langsung dari VPS.</p></div></div><div class="card"><div class="empty">Belum ada siswa aktif yang terhubung.</div></div>`;
    return `${selector56()}<div class="page-head"><div><span class="page-kicker">Profil VPS</span><h2>Profil Wali</h2><p>Data akun dan siswa terhubung berasal dari PostgreSQL sekolah.</p></div></div><div class="profile-grid-v56"><div class="card profile-panel-v56"><h3>Orang Tua / Wali</h3><div class="profile-row-v56"><span>Nama</span><b>${esc(p.name||session?.name||'-')}</b></div><div class="profile-row-v56"><span>Sapaan</span><b>${esc(p.salutation||'Bapak/Ibu')}</b></div><div class="profile-row-v56"><span>Nama Panggilan</span><b>${esc(p.nickname||'-')}</b></div><div class="profile-row-v56"><span>Jumlah Anak Terhubung</span><b>${students.length}</b></div></div><div class="card profile-panel-v56"><h3>Siswa Dipilih</h3><div class="profile-row-v56"><span>Nama</span><b>${esc(student.name||'-')}</b></div><div class="profile-row-v56"><span>NIS</span><b>${esc(student.nis||'-')}</b></div><div class="profile-row-v56"><span>Kelas</span><b>${esc(student.className||student.class_name||'-')}</b></div><div class="profile-row-v56"><span>No. HP Wali</span><b>${esc(student.guardian_phone||'-')}</b></div></div></div>`;
  };
})();
