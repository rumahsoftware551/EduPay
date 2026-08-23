// EduPay V4.8 - one-click LocalStorage -> VPS migration
(function(){
  window.EDUPAY_V48_STATUS=null;
  window.EDUPAY_V48_BUSY=false;

  try{menuIcons.migration='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h11"/><path d="m12 4 3 3-3 3"/><path d="M20 17H9"/><path d="m12 14-3 3 3 3"/><rect x="3" y="3" width="3" height="18" rx="1"/><rect x="18" y="3" width="3" height="18" rx="1"/></svg>';}catch(e){}

  const baseNavV48=nav;
  nav=function(){
    const items=baseNavV48();
    if(session?.role!=='admin'||items.some(x=>x[0]==='migration'))return items;
    const idx=items.findIndex(x=>x[0]==='reports');
    const out=items.slice();out.splice(idx>=0?idx:out.length,0,['migration','Migrasi Data']);return out;
  };

  function localCountsV48(){
    return {
      classes:Array.isArray(db.classes)?db.classes.length:0,
      homerooms:Array.isArray(db.homeroomTeachers)?db.homeroomTeachers.length:0,
      students:Array.isArray(db.students)?db.students.length:0,
      feeTypes:Array.isArray(db.feeTypes)?db.feeTypes.length:0,
      bills:Array.isArray(db.bills)?db.bills.length:0,
      payments:Array.isArray(db.payments)?db.payments.length:0
    };
  }
  function countBoxV48(label,local,server){return `<div class="migration-count-v48"><span>${esc(label)}</span><b>${local}</b><small>Local · VPS ${server??'-'}</small></div>`}
  function migrationV48(){
    const l=localCountsV48(),s=window.EDUPAY_V48_STATUS?.counts||{},last=window.EDUPAY_V48_STATUS?.lastMigration;
    return `<div class="page-head"><div><span class="page-kicker">Transisi ke PostgreSQL</span><h2>Migrasi Data Lokal → VPS</h2><p>Pindahkan seluruh data operasional dari LocalStorage browser ini ke database PostgreSQL EduPay.</p></div><button class="btn btn-soft" onclick="refreshMigrationStatusV48(false)">↻ Cek VPS</button></div>
    <div class="migration-warning-v48"><b>Jalankan dari browser yang selama ini menyimpan data EduPay.</b><span>Proses bersifat idempotent dan server melakukan rollback jika terjadi kegagalan. Password akun wali yang sudah aktif tidak ditimpa.</span></div>
    <div class="migration-grid-v48">${countBoxV48('Kelas',l.classes,s.classes)}${countBoxV48('Wali Kelas',l.homerooms,s.homerooms)}${countBoxV48('Siswa',l.students,s.students)}${countBoxV48('Jenis Pembayaran',l.feeTypes,s.feeTypes)}${countBoxV48('Tagihan',l.bills,s.bills)}${countBoxV48('Pembayaran',l.payments,s.payments)}${countBoxV48('Akun Wali','-',s.guardians)}</div>
    <div class="card migration-card-v48"><div><h3>Yang akan dipindahkan</h3><p>Master kelas, wali kelas, siswa & wali, jenis pembayaran, seluruh tagihan beserta statusnya, transaksi pembayaran, serta relasi akun wali–siswa.</p></div><div class="migration-proof-note-v48"><b>Catatan bukti transfer</b><span>LocalStorage hanya menyimpan nama/status file. File JPG/PDF fisiknya memang tidak pernah tersimpan di LocalStorage, sehingga file lama tidak dapat dipindahkan otomatis.</span></div>${last?`<div class="migration-last-v48"><span>Migrasi terakhir</span><b>${new Date(last.created_at).toLocaleString('id-ID')}</b></div>`:''}<div class="migration-actions-v48"><button class="btn btn-primary" onclick="startFullMigrationV48()" ${window.EDUPAY_V48_BUSY?'disabled':''}>${window.EDUPAY_V48_BUSY?'Sedang Migrasi...':'Migrasi Semua Data ke VPS'}</button></div></div>`;
  }

  async function fingerprintV48(payload){
    const text=JSON.stringify(payload);
    if(window.crypto?.subtle){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');}
    return String(text.length)+'-'+Date.now();
  }
  function payloadV48(){
    const classes=(db.classes||[]).map(c=>({...c}));
    const students=(db.students||[]).map(s=>({...s,className:className(s.classId)}));
    return {classes,homeroomTeachers:(db.homeroomTeachers||[]).map(t=>({...t})),students,feeTypes:(db.feeTypes||[]).map(f=>({...f})),bills:(db.bills||[]).map(b=>({...b})),payments:(db.payments||[]).map(p=>({...p}))};
  }

  window.refreshMigrationStatusV48=async function(silent=true){
    if(session?.role!=='admin')return;
    try{window.EDUPAY_V48_STATUS=await apiV40('/api/v48/admin/status');if(page==='migration')render();}
    catch(err){if(!silent)toast(err.message||'Gagal membaca status VPS');}
  };

  window.startFullMigrationV48=async function(){
    if(window.EDUPAY_V48_BUSY)return;
    const l=localCountsV48();
    const total=l.classes+l.homerooms+l.students+l.feeTypes+l.bills+l.payments;
    if(!total)return toast('Tidak ada data lokal untuk dimigrasikan');
    if(!confirm(`Migrasikan seluruh data lokal browser ini ke VPS?\n\nSiswa: ${l.students}\nTagihan: ${l.bills}\nPembayaran: ${l.payments}\n\nData server dengan identitas yang sama akan diperbarui.`))return;
    window.EDUPAY_V48_BUSY=true;render();
    try{
      const body=payloadV48();body.fingerprint=await fingerprintV48(body);
      const out=await apiV40('/api/v48/admin/migrate-all',{method:'POST',body});
      localStorage.setItem('edupay-v48-migrated',JSON.stringify({at:new Date().toISOString(),runId:out.runId,counts:out.counts}));
      await refreshMigrationStatusV48(true);
      if(typeof refreshGuardiansV44==='function')await refreshGuardiansV44({silent:true});
      openCrudV33('Migrasi Berhasil',`<div class="invite-card-v36"><div class="invite-icon-v36">✓</div><div><b>Seluruh data lokal sudah masuk PostgreSQL</b><p>Run #${out.runId}. Sekarang sinkronisasi server dapat menggunakan data VPS yang lengkap.</p></div></div><div class="migration-result-v48">${Object.entries(out.counts||{}).map(([k,v])=>`<div><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div><div class="proof-note">${esc(out.warning||'')}</div><div class="modal-actions"><button class="btn btn-primary" onclick="closeCrudV33();go('dashboard')">Selesai</button></div>`);
    }catch(err){toast(err.message||'Migrasi gagal. Data server di-rollback.');}
    finally{window.EDUPAY_V48_BUSY=false;if(page==='migration')render();}
  };

  views.migration=migrationV48;
  if(session?.role==='admin')setTimeout(()=>refreshMigrationStatusV48(true),250);
  render();
})();
