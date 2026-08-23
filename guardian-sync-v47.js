// EduPay V4.7 - ensure current class/student data reaches PostgreSQL before guardian-account sync
window.EDUPAY_STUDENT_SYNCING_V47=false;

function studentPayloadV47(){
  return (db.students||[]).map(s=>({
    id:s.id,
    nis:String(s.nis||'').trim(),
    name:String(s.name||'').trim(),
    classId:s.classId,
    className:className(s.classId),
    parent:String(s.parent||'').trim(),
    phone:String(s.phone||'').trim(),
    active:s.active!==false
  }));
}
function classPayloadV47(){
  return (db.classes||[]).map(c=>({
    id:c.id,
    name:String(c.name||'').trim(),
    level:String(c.level||'').trim(),
    academicYear:String(c.academicYear||'').trim(),
    active:c.active!==false
  }));
}

async function syncStudentsServerV47({silent=false}={}){
  if(!session||session.role!=='admin')return null;
  if(window.EDUPAY_STUDENT_SYNCING_V47)return null;
  window.EDUPAY_STUDENT_SYNCING_V47=true;
  try{
    const students=studentPayloadV47();
    const classes=classPayloadV47();
    if(!students.length)throw new Error('Data Siswa masih kosong. Tambahkan atau import siswa terlebih dahulu.');
    const missing=students.filter(s=>s.active&&(!s.parent||!s.phone));
    const out=await apiV40('/api/v47/admin/students/sync',{method:'POST',body:{classes,students}});
    if(!silent){
      const extra=missing.length?` · ${missing.length} siswa belum memiliki nama/no. HP wali`:'';
      toast(`Data siswa tersinkron: ${out.students||0} siswa${extra}`);
    }
    return {...out,missingGuardian:missing.length};
  }catch(err){if(!silent)toast(err.message||'Gagal sinkron data siswa');throw err;}
  finally{window.EDUPAY_STUDENT_SYNCING_V47=false;}
}

// Replace old guardian sync: student/class master must be synchronized first.
syncGuardianAccountsV36=async function(showToast=false){
  try{
    const studentSync=await syncStudentsServerV47({silent:true});
    const out=await apiV40('/api/admin/guardians/sync',{method:'POST'});
    await refreshGuardiansV44({silent:true});
    if(showToast){
      const total=(window.EDUPAY_GUARDIANS_SERVER||[]).length;
      const missing=studentSync?.missingGuardian||0;
      toast(`Sinkron selesai: ${studentSync?.students||0} siswa, ${total} akun wali${missing?` · ${missing} siswa belum lengkap data wali`:''}`);
    }
    return out;
  }catch(err){if(showToast)toast(err.message||'Sinkronisasi akun wali gagal');return null;}
};

async function showStudentServerStatusV47(){
  try{
    const out=await apiV40('/api/v47/admin/students/status');
    openCrudV33('Status Sinkronisasi Siswa',`<div class="activation-summary-v36"><div><span>Total di Server</span><b>${out.total||0}</b></div><div><span>Siswa Aktif</span><b>${out.active||0}</b></div><div><span>Memiliki No. HP Wali</span><b>${out.withGuardianPhone||0}</b></div></div><div class="proof-note">Akun wali hanya dapat dibuat untuk siswa aktif yang memiliki <b>Nama Wali</b> dan <b>No. HP Wali</b>.</div><div class="modal-actions"><button class="btn btn-primary" onclick="closeCrudV33()">Tutup</button></div>`);
  }catch(err){toast(err.message||'Gagal membaca status server')}
}

// Add an explicit server sync button to the Student page without changing its CRUD implementation.
const studentsBeforeV47=views.students;
views.students=function(){
  let html=studentsBeforeV47();
  const actions=`<button class="btn btn-soft" onclick="syncStudentsServerV47({silent:false})">↻ Sinkronkan Server</button><button class="btn btn-ghost" onclick="showStudentServerStatusV47()">Status Server</button>`;
  const marker='<button class="btn btn-primary" onclick="studentFormV33()">+ Tambah Siswa</button>';
  if(html.includes(marker))html=html.replace(marker,actions+marker);
  return html;
};

// After local student mutations, keep PostgreSQL updated automatically.
function wrapStudentSyncV47(name){
  const old=window[name];
  if(typeof old!=='function'||old.__v47wrapped)return;
  const wrapped=function(...args){
    const result=old.apply(this,args);
    Promise.resolve(result).finally(()=>setTimeout(()=>syncStudentsServerV47({silent:true}).catch(()=>{}),120));
    return result;
  };
  wrapped.__v47wrapped=true;window[name]=wrapped;
}
['saveStudentV33','toggleStudentV33','commitStudentImportV34'].forEach(wrapStudentSyncV47);

render();
