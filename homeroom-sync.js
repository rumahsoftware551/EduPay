// EduPay V4.6 - Wali Kelas Excel import + PostgreSQL synchronization
window.EDUPAY_HOMEROOM_SYNC={ready:false,syncing:false,last:null};
let homeroomImportRowsV46=[];

async function apiV46(path,options={}){
  if(typeof apiV40==='function')return apiV40(path,options);
  const r=await fetch(path,{method:options.method||'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:options.body?JSON.stringify(options.body):undefined,cache:'no-store'});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||`HTTP ${r.status}`);return d;
}
function teacherExternalV46(t){return String(t.serverExternalId??t.id)}
function homeroomPayloadV46(){
  const teacherMap=new Map(db.homeroomTeachers.map(t=>[Number(t.id),teacherExternalV46(t)]));
  return {
    teachers:db.homeroomTeachers.map(t=>({id:teacherExternalV46(t),nip:t.nip||'',name:t.name||'',phone:t.phone||'',email:t.email||'',active:t.active!==false})),
    classes:db.classes.map(c=>({id:String(c.id),name:c.name||'',level:c.level||'',academicYear:c.academicYear||'',active:c.active!==false,homeroomTeacherId:c.homeroomTeacherId?teacherMap.get(Number(c.homeroomTeacherId))||'':''}))
  };
}
async function syncHomeroomsV46({silent=false}={}){
  if(!session||session.role!=='admin'||window.EDUPAY_HOMEROOM_SYNC.syncing)return;
  window.EDUPAY_HOMEROOM_SYNC.syncing=true;
  try{
    const out=await apiV46('/api/v46/homerooms/sync',{method:'POST',body:homeroomPayloadV46()});
    window.EDUPAY_HOMEROOM_SYNC.last=new Date();
    if(!silent)toast(`${out.active||0} wali kelas aktif tersinkron ke database`);
    if(page==='homerooms')render();
  }catch(err){if(!silent)toast(err.message||'Sinkronisasi wali kelas gagal')}
  finally{window.EDUPAY_HOMEROOM_SYNC.syncing=false;}
}
function mergeServerHomeroomsV46(rows){
  let changed=false;
  (rows||[]).forEach(s=>{
    const ext=String(s.external_id??'');
    let local=db.homeroomTeachers.find(t=>String(t.serverExternalId??t.id)===ext);
    if(!local&&s.nip)local=db.homeroomTeachers.find(t=>String(t.nip||'')===String(s.nip));
    if(!local){
      let candidate=Number(ext);if(!Number.isFinite(candidate)||candidate<=0||db.homeroomTeachers.some(t=>Number(t.id)===candidate))candidate=nextIdV33(db.homeroomTeachers);
      local={id:candidate};db.homeroomTeachers.push(local);changed=true;
    }
    Object.assign(local,{serverExternalId:ext||String(local.id),nip:s.nip||'',name:s.name||'',phone:s.phone||'',email:s.email||'',active:s.active!==false});
    (s.classes||[]).forEach(sc=>{
      const lc=db.classes.find(c=>String(c.id)===String(sc.externalId))||db.classes.find(c=>String(c.name).trim().toLowerCase()===String(sc.name).trim().toLowerCase());
      if(lc&&Number(lc.homeroomTeacherId)!==Number(local.id)){lc.homeroomTeacherId=local.id;changed=true;}
    });
  });
  if(changed)save();
}
async function initializeHomeroomsV46(){
  if(!session||session.role!=='admin')return;
  try{
    const out=await apiV46('/api/v46/homerooms');
    if((out.homerooms||[]).length){mergeServerHomeroomsV46(out.homerooms);window.EDUPAY_HOMEROOM_SYNC.ready=true;if(page==='homerooms'||page==='classes')render();}
    else if(db.homeroomTeachers.length)await syncHomeroomsV46({silent:true});
  }catch(e){}
}

function homeroomsV46(){
  const rows=db.homeroomTeachers.slice().sort((a,b)=>(a.active===false)-(b.active===false)||String(a.name).localeCompare(String(b.name),'id'));
  const active=rows.filter(t=>t.active!==false).length;
  const syncText=window.EDUPAY_HOMEROOM_SYNC.syncing?'Menyinkronkan...':window.EDUPAY_HOMEROOM_SYNC.last?`Database tersinkron ${window.EDUPAY_HOMEROOM_SYNC.last.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`:'Siap disinkronkan ke PostgreSQL';
  return `<div class="page-head"><div><span class="page-kicker">Master Akademik</span><h2>Wali Kelas</h2><p>Kelola dan sinkronkan wali kelas aktif dengan database pusat.</p></div><div class="head-actions-v33 homeroom-actions-v46"><button class="btn btn-soft" onclick="downloadHomeroomTemplateV46()">↓ Template Excel</button><button class="btn btn-soft" onclick="openHomeroomImportV46()">⇧ Import Wali Kelas</button><button class="btn btn-soft" onclick="syncHomeroomsV46()">↻ Sinkronkan</button><button class="btn btn-primary" onclick="homeroomFormV35()">+ Tambah Wali Kelas</button></div></div>
  <div class="homeroom-sync-strip-v46"><span><b>${active}</b> wali kelas aktif</span><span>${esc(syncText)}</span></div>
  <div class="card">${rows.length?`<div class="table-wrap"><table class="table"><thead><tr><th>NIP / NIK</th><th>Nama</th><th>No HP</th><th>Email</th><th>Kelas Diampu</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map(t=>{const assigned=assignedClassNamesV35(t.id);return `<tr><td>${esc(t.nip||'-')}</td><td><b>${esc(t.name)}</b></td><td>${esc(t.phone||'-')}</td><td>${esc(t.email||'-')}</td><td>${assigned.length?assigned.map(x=>`<span class="class-chip-v35">${esc(x)}</span>`).join(' '):'<span class="muted-v35">Belum ditugaskan</span>'}</td><td>${activeTextV33(t.active)}</td><td><div class="row-actions-v33"><button class="btn btn-soft btn-sm" onclick="homeroomFormV35(${t.id})">Edit</button><button class="btn ${t.active===false?'btn-ghost':'btn-danger'} btn-sm" onclick="toggleHomeroomV35(${t.id})">${t.active===false?'Aktifkan':'Nonaktifkan'}</button></div></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty"><b>Belum ada wali kelas.</b><br>Gunakan Tambah Wali Kelas atau Import Excel.</div>'}</div>`;
}
views.homerooms=homeroomsV46;

function downloadHomeroomTemplateV46(){
  if(typeof XLSX==='undefined')return toast('Library Excel belum termuat');
  const wb=XLSX.utils.book_new();
  const sample=[{'NIP / NIK':'198801012020121001','Nama':'Budi Setiawan','No HP':'081234567890','Email':'budi@sekolah.sch.id','Kelas':db.classes.find(c=>c.active!==false)?.name||'X RPL 1'}];
  const ws=XLSX.utils.json_to_sheet(sample,{header:['NIP / NIK','Nama','No HP','Email','Kelas']});ws['!cols']=[{wch:24},{wch:28},{wch:18},{wch:30},{wch:20}];XLSX.utils.book_append_sheet(wb,ws,'Wali Kelas');
  const refs=XLSX.utils.json_to_sheet(db.classes.filter(c=>c.active!==false).map(c=>({Kelas:c.name,'Tahun Ajaran':c.academicYear||''})));refs['!cols']=[{wch:24},{wch:18}];XLSX.utils.book_append_sheet(wb,refs,'Referensi Kelas');
  XLSX.writeFile(wb,'Template-Import-Wali-Kelas-EduPay.xlsx');
}
function openHomeroomImportV46(){
  homeroomImportRowsV46=[];
  openCrudV33('Import Wali Kelas dari Excel',`<div class="import-guide-v34"><b>Kolom:</b><span>NIP / NIK, Nama, No HP, Email, Kelas</span><small>Kolom Kelas boleh dikosongkan. Jika diisi, namanya harus sama dengan master Kelas.</small></div><div class="upload-box"><b>Pilih file Excel / CSV</b><small>.xlsx, .xls, atau .csv</small><input type="file" accept=".xlsx,.xls,.csv" onchange="previewHomeroomExcelV46(this.files[0])"></div><div id="homeroomImportSummaryV46"></div><div id="homeroomImportPreviewV46"></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Batal</button><button id="commitHomeroomImportV46" type="button" class="btn btn-primary" onclick="commitHomeroomImportRowsV46()" disabled>Import Data Valid</button></div>`);
}
function pickHomeroomV46(row,names){for(const n of names){const k=Object.keys(row).find(x=>String(x).trim().toLowerCase()===n.toLowerCase());if(k!==undefined)return row[k]}return ''}
function previewHomeroomExcelV46(file){
  if(!file||typeof XLSX==='undefined')return;
  const reader=new FileReader();reader.onload=e=>{try{
    const wb=XLSX.read(e.target.result,{type:'array'}),data=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:'',raw:false});
    const fileNips=new Set(),fileClasses=new Set();
    homeroomImportRowsV46=data.map((r,i)=>{
      const nip=String(pickHomeroomV46(r,['NIP / NIK','NIP','NIK'])).trim(),name=String(pickHomeroomV46(r,['Nama','Nama Guru'])).trim(),phone=normalizePhoneV34(pickHomeroomV46(r,['No HP','No. HP','HP'])),email=String(pickHomeroomV46(r,['Email'])).trim(),kelas=String(pickHomeroomV46(r,['Kelas','Kelas Diampu'])).trim();
      const cls=kelas?db.classes.find(c=>String(c.name).trim().toLowerCase()===kelas.toLowerCase()):null,existing=nip?db.homeroomTeachers.find(t=>String(t.nip||'')===nip):null,errors=[];
      if(!name)errors.push('Nama kosong');if(nip&&fileNips.has(nip))errors.push('NIP/NIK duplikat di file');if(nip)fileNips.add(nip);
      if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))errors.push('Email tidak valid');
      if(kelas&&!cls)errors.push('Kelas tidak ditemukan');
      if(kelas&&fileClasses.has(kelas.toLowerCase()))errors.push('Kelas ganda di file');if(kelas)fileClasses.add(kelas.toLowerCase());
      if(cls&&cls.homeroomTeacherId&&(!existing||Number(cls.homeroomTeacherId)!==Number(existing.id)))errors.push('Kelas sudah memiliki wali kelas');
      return {row:i+2,nip,name,phone,email,kelas,classId:cls?.id||null,existingId:existing?.id||null,valid:errors.length===0,errors};
    });
    renderHomeroomImportV46(file.name);
  }catch(err){console.error(err);toast('File gagal dibaca. Gunakan Template Excel EduPay.')}};reader.readAsArrayBuffer(file);
}
function renderHomeroomImportV46(fileName){
  const valid=homeroomImportRowsV46.filter(r=>r.valid).length,invalid=homeroomImportRowsV46.length-valid;
  document.getElementById('homeroomImportSummaryV46').innerHTML=`<div class="import-summary-v34"><div><span>Total</span><b>${homeroomImportRowsV46.length}</b></div><div class="ok"><span>Valid</span><b>${valid}</b></div><div class="bad"><span>Bermasalah</span><b>${invalid}</b></div><div><span>File</span><b class="file-name-v34">${esc(fileName)}</b></div></div>`;
  document.getElementById('homeroomImportPreviewV46').innerHTML=`<div class="table-wrap homeroom-import-table-v46"><table class="table"><thead><tr><th>Baris</th><th>NIP/NIK</th><th>Nama</th><th>No HP</th><th>Email</th><th>Kelas</th><th>Validasi</th></tr></thead><tbody>${homeroomImportRowsV46.map(r=>`<tr class="${r.valid?'':'invalid-row-v34'}"><td>${r.row}</td><td>${esc(r.nip||'-')}</td><td><b>${esc(r.name||'-')}</b></td><td>${esc(r.phone||'-')}</td><td>${esc(r.email||'-')}</td><td>${esc(r.kelas||'-')}</td><td>${r.valid?`<span class="badge ok"><i></i>${r.existingId?'Update':'Baru'}</span>`:`<span class="import-error-v34">${esc(r.errors.join(', '))}</span>`}</td></tr>`).join('')}</tbody></table></div>`;
  const btn=document.getElementById('commitHomeroomImportV46');if(btn){btn.disabled=!valid;btn.textContent=`Import ${valid} Data Valid`;}
}
async function commitHomeroomImportRowsV46(){
  const rows=homeroomImportRowsV46.filter(r=>r.valid);if(!rows.length)return toast('Tidak ada data valid');if(!confirm(`Import ${rows.length} data wali kelas?`))return;
  rows.forEach(r=>{
    let t=r.existingId?byId(db.homeroomTeachers,r.existingId):null;
    if(!t){t={id:nextIdV33(db.homeroomTeachers),active:true};t.serverExternalId=String(t.id);db.homeroomTeachers.push(t);}
    Object.assign(t,{nip:r.nip,name:r.name,phone:r.phone,email:r.email,active:true});
    if(r.classId){db.classes.forEach(c=>{if(Number(c.homeroomTeacherId)===Number(t.id)&&Number(c.id)!==Number(r.classId))c.homeroomTeacherId=null;});byId(db.classes,r.classId).homeroomTeacherId=t.id;}
  });
  save();closeCrudV33();homeroomImportRowsV46=[];await syncHomeroomsV46({silent:true});render();toast(`${rows.length} wali kelas berhasil diimport dan disinkronkan`);
}

const baseSaveHomeroomV46=saveHomeroomV35;
saveHomeroomV35=function(e,id){baseSaveHomeroomV46(e,id);setTimeout(()=>syncHomeroomsV46({silent:true}),0)};
const baseToggleHomeroomV46=toggleHomeroomV35;
toggleHomeroomV35=function(id){baseToggleHomeroomV46(id);setTimeout(()=>syncHomeroomsV46({silent:true}),0)};
const baseSaveClassV46=saveClassV35;
saveClassV35=function(e,id){baseSaveClassV46(e,id);setTimeout(()=>syncHomeroomsV46({silent:true}),0)};
const baseToggleClassV46=toggleClassV35;
toggleClassV35=function(id){baseToggleClassV46(id);setTimeout(()=>syncHomeroomsV46({silent:true}),0)};

initializeHomeroomsV46();
render();
