// EduPay V3.4 - Mass student import from Excel/CSV
let importRowsV34=[];

function studentsV34(){
  return `<div class="page-head"><div><span class="page-kicker">Master Data</span><h2>Master Siswa</h2><p>Kelola data siswa satu per satu atau import massal dari Excel.</p></div><div class="head-actions-v33"><button class="btn btn-soft" onclick="downloadStudentTemplateV34()">↓ Template Excel</button><button class="btn btn-soft" onclick="openStudentImportV34()">⇧ Import Excel</button><button class="btn btn-primary" onclick="studentFormV33()">+ Tambah Siswa</button></div></div>
  <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>NIS</th><th>Nama</th><th>Kelas</th><th>Wali</th><th>No HP</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${db.students.map(s=>`<tr><td>${esc(s.nis)}</td><td><b>${esc(s.name)}</b></td><td>${esc(className(s.classId))}</td><td>${esc(s.parent)}</td><td>${esc(s.phone)}</td><td>${activeTextV33(s.active)}</td><td><div class="row-actions-v33"><button class="btn btn-soft btn-sm" onclick="studentFormV33(${s.id})">Edit</button><button class="btn ${s.active===false?'btn-ghost':'btn-danger'} btn-sm" onclick="toggleStudentV33(${s.id})">${s.active===false?'Aktifkan':'Nonaktifkan'}</button></div></td></tr>`).join('')}</tbody></table></div></div>`
}

function ensureXlsxV34(){
  if(typeof XLSX==='undefined'){
    toast('Library Excel belum termuat. Refresh halaman dan coba lagi.');
    return false;
  }
  return true;
}

function downloadStudentTemplateV34(){
  if(!ensureXlsxV34())return;
  const rows=[
    {NIS:'25001',Nama:'Contoh Siswa',Kelas:db.classes[0]?.name||'X RPL 1','Nama Wali':'Contoh Wali','No HP':'081234567890'},
    {NIS:'25002',Nama:'Contoh Siswa 2',Kelas:db.classes[1]?.name||db.classes[0]?.name||'XI DKV 1','Nama Wali':'Contoh Wali 2','No HP':'081234567891'}
  ];
  const refs=db.classes.map(c=>({Kelas:c.name}));
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.json_to_sheet(rows,{header:['NIS','Nama','Kelas','Nama Wali','No HP']});
  ws['!cols']=[{wch:16},{wch:28},{wch:20},{wch:28},{wch:18}];
  XLSX.utils.book_append_sheet(wb,ws,'Data Siswa');
  const ref=XLSX.utils.json_to_sheet(refs.length?refs:[{Kelas:'Belum ada kelas'}]);
  ref['!cols']=[{wch:24}];
  XLSX.utils.book_append_sheet(wb,ref,'Referensi Kelas');
  XLSX.writeFile(wb,'Template-Import-Siswa-EduPay.xlsx');
}

function openStudentImportV34(){
  importRowsV34=[];
  openCrudV33('Import Siswa dari Excel',`<div class="import-guide-v34"><b>Format kolom wajib:</b><span>NIS, Nama, Kelas, Nama Wali, No HP</span><small>Nama kelas harus sama dengan kelas yang tersedia di EduPay. Gunakan tombol Template Excel agar format selalu benar.</small></div><div class="upload-box import-drop-v34"><b>Pilih file Excel / CSV</b><small>Format: .xlsx, .xls, atau .csv · maksimal disarankan 5.000 siswa per proses.</small><input id="studentExcelFileV34" type="file" accept=".xlsx,.xls,.csv" onchange="previewStudentExcelV34(this.files[0])"></div><div id="importSummaryV34"></div><div id="importPreviewV34"></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Batal</button><button id="commitImportBtnV34" type="button" class="btn btn-primary" onclick="commitStudentImportV34()" disabled>Import Data Valid</button></div>`);
}

function pickValueV34(row,names){
  const keys=Object.keys(row||{});
  for(const n of names){
    const found=keys.find(k=>String(k).trim().toLowerCase()===n.toLowerCase());
    if(found!==undefined)return row[found];
  }
  return '';
}

function normalizePhoneV34(v){
  if(v===null||v===undefined)return '';
  let s=String(v).trim();
  if(/^[0-9]+(?:\.0+)?$/.test(s))s=s.replace(/\.0+$/,'');
  if(s.startsWith('62'))s='0'+s.slice(2);
  return s;
}

function previewStudentExcelV34(file){
  if(!file||!ensureXlsxV34())return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:'array'});
      const first=wb.Sheets[wb.SheetNames[0]];
      const data=XLSX.utils.sheet_to_json(first,{defval:'',raw:false});
      if(!data.length){toast('File tidak memiliki data siswa');return}
      const seen=new Set();
      importRowsV34=data.map((r,i)=>{
        const nis=String(pickValueV34(r,['NIS'])).trim();
        const name=String(pickValueV34(r,['Nama','Nama Siswa'])).trim();
        const kelas=String(pickValueV34(r,['Kelas','Rombel'])).trim();
        const parent=String(pickValueV34(r,['Nama Wali','Wali','Orang Tua'])).trim();
        const phone=normalizePhoneV34(pickValueV34(r,['No HP','No. HP','Nomor HP','HP Wali']));
        const cls=db.classes.find(c=>String(c.name).trim().toLowerCase()===kelas.toLowerCase());
        const errors=[];
        if(!nis)errors.push('NIS kosong');
        if(!name)errors.push('Nama kosong');
        if(!kelas)errors.push('Kelas kosong'); else if(!cls)errors.push('Kelas tidak ditemukan');
        if(!parent)errors.push('Nama wali kosong');
        if(!phone)errors.push('No HP kosong');
        if(nis&&db.students.some(s=>String(s.nis).trim()===nis))errors.push('NIS sudah ada');
        if(nis&&seen.has(nis))errors.push('NIS duplikat di file');
        if(nis)seen.add(nis);
        return {row:i+2,nis,name,kelas,classId:cls?.id||null,parent,phone,valid:errors.length===0,errors};
      });
      renderImportPreviewV34(file.name);
    }catch(err){console.error(err);toast('File Excel gagal dibaca. Pastikan format sesuai template.')}
  };
  reader.readAsArrayBuffer(file);
}

function renderImportPreviewV34(fileName){
  const valid=importRowsV34.filter(x=>x.valid).length,invalid=importRowsV34.length-valid;
  document.getElementById('importSummaryV34').innerHTML=`<div class="import-summary-v34"><div><span>Total Baris</span><b>${importRowsV34.length}</b></div><div class="ok"><span>Siap Import</span><b>${valid}</b></div><div class="bad"><span>Bermasalah</span><b>${invalid}</b></div><div><span>File</span><b class="file-name-v34">${esc(fileName)}</b></div></div>`;
  document.getElementById('importPreviewV34').innerHTML=`<div class="import-preview-title-v34"><b>Preview & Validasi</b><span>${invalid?'Perbaiki baris merah sebelum diimport.':'Semua data valid dan siap diimport.'}</span></div><div class="table-wrap import-table-v34"><table class="table"><thead><tr><th>Baris</th><th>NIS</th><th>Nama</th><th>Kelas</th><th>Wali</th><th>No HP</th><th>Validasi</th></tr></thead><tbody>${importRowsV34.map(r=>`<tr class="${r.valid?'':'invalid-row-v34'}"><td>${r.row}</td><td>${esc(r.nis||'-')}</td><td><b>${esc(r.name||'-')}</b></td><td>${esc(r.kelas||'-')}</td><td>${esc(r.parent||'-')}</td><td>${esc(r.phone||'-')}</td><td>${r.valid?'<span class="badge ok"><i></i>Valid</span>':`<span class="import-error-v34">${esc(r.errors.join(', '))}</span>`}</td></tr>`).join('')}</tbody></table></div>`;
  const btn=document.getElementById('commitImportBtnV34');
  if(btn){btn.disabled=valid===0;btn.textContent=`Import ${valid} Data Valid`}
}

function commitStudentImportV34(){
  const rows=importRowsV34.filter(r=>r.valid);
  if(!rows.length)return toast('Tidak ada data valid untuk diimport');
  if(!confirm(`Import ${rows.length} siswa ke EduPay?`))return;
  let next=nextIdV33(db.students);
  rows.forEach(r=>db.students.push({id:next++,nis:r.nis,name:r.name,classId:r.classId,parent:r.parent,phone:r.phone,active:true,importedAt:new Date().toISOString()}));
  save();
  closeCrudV33();
  importRowsV34=[];
  render();
  toast(`${rows.length} siswa berhasil diimport`);
}

views.students=studentsV34;
render();
