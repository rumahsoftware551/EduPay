// EduPay V5.6 - Final Commercial Master UI
(function(){
  window.EDUPAY_V56={brand:null,maintenance:null,readiness:null,loading:false};
  const V=window.EDUPAY_V56;

  async function api56(path,options={}){return apiV54('/api/v1/commercial'+path,options)}
  window.loadBrandingV56=async function(){
    try{const out=await apiV54('/api/v1/branding');V.brand=out;applyBrandV56();return out}catch(e){return null}
  };
  window.applyBrandV56=function(){
    const b=V.brand||{},app=b.appName||'EduPay',school=b.schoolName||'School Finance';
    document.title=`${app} · ${school}`;
    document.querySelectorAll('.sidebar-brand strong,.mobile-brand strong,.login-visual .brand h1').forEach(el=>el.textContent=app);
    document.querySelectorAll('.sidebar-brand span,.mobile-brand span,.login-visual .brand small').forEach(el=>{if(!el.closest('.nav-btn'))el.textContent=school});
    if(b.logoUrl){document.querySelectorAll('.logo-mark').forEach(el=>{el.classList.add('school-logo-v56');el.textContent='';el.style.backgroundImage=`url("${String(b.logoUrl).replaceAll('"','%22')}")`})}
  };

  window.loadCommercialV56=async function({forceRender=false}={}){
    if(!session||session.role!=='admin'||V.loading)return null;V.loading=true;
    try{const [m,r]=await Promise.all([api56('/admin/maintenance'),api56('/admin/readiness')]);V.maintenance=m;V.readiness=r;if(forceRender&&page==='settings')render();return m}catch(err){toast(err.message||'Gagal mengambil status Commercial Master');return null}finally{V.loading=false}
  };
  function size56(n){n=Number(n||0);if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;if(n<1073741824)return `${(n/1048576).toFixed(1)} MB`;return `${(n/1073741824).toFixed(2)} GB`}
  function date56(v){if(!v)return 'Belum tersedia';const d=new Date(v);return Number.isNaN(d.getTime())?'Belum tersedia':d.toLocaleString('id-ID')}
  function readinessRows56(){const r=V.readiness;if(!r)return '<div class="empty">Status kesiapan belum dimuat.</div>';return `<div class="readiness-score-v56 ${r.ready?'ready':''}"><strong>${Number(r.score||0)}%</strong><span>${r.ready?'Commercial readiness PASS':'Masih ada pemeriksaan wajib'}</span></div><div class="readiness-list-v56">${(r.checks||[]).map(c=>`<div><span class="readiness-dot-v56 ${c.pass?'pass':'fail'}">${c.pass?'✓':'!'}</span><div><b>${esc(c.label)}</b><small>${c.required?'Wajib':'Disarankan'}</small></div></div>`).join('')}</div>`}
  function commercialCardV56(){
    const m=V.maintenance||{},s=m.settings||{},backup=m.backup||{},restore=m.restoreVerification||{},storage=m.storage||{};
    if(!V.maintenance&&!V.loading)setTimeout(()=>loadCommercialV56({forceRender:true}),0);
    return `<section class="commercial-final-v56">
      <div class="commercial-title-v56"><div><span>V5.6 · Commercial Master</span><h3>Branding, Kwitansi & Backup</h3><p>Konfigurasi final disimpan di VPS dan berlaku tanpa mengubah source aplikasi.</p></div><button type="button" class="btn btn-soft" onclick="loadCommercialV56({forceRender:true})">↻ Refresh Status</button></div>
      <div class="commercial-grid-v56">
        <div class="card commercial-panel-v56"><h4>Logo Sekolah</h4><p>PNG/JPG/WebP maksimal 2 MB. Logo tampil pada login, sidebar, dan kwitansi.</p><form onsubmit="uploadSchoolLogoV56(event)"><input id="schoolLogoV56" class="field" type="file" accept="image/png,image/jpeg,image/webp" required><button class="btn btn-primary">Upload Logo</button></form>${s.logoUrl?`<img class="brand-preview-v56" src="${esc(s.logoUrl)}?v=${Date.now()}" alt="Logo sekolah">`:''}</div>
        <div class="card commercial-panel-v56"><h4>Format Kwitansi</h4><form onsubmit="saveCommercialSettingsV56(event)"><label>Prefix Nomor</label><input id="receiptPrefixV56" class="field" maxlength="16" value="${esc(s.receiptPrefix||'PAY')}" placeholder="PAY"><label>Footer Kwitansi</label><textarea id="receiptFooterV56" class="field" maxlength="500" placeholder="Contoh: Simpan kwitansi ini sebagai bukti pembayaran resmi.">${esc(s.receiptFooter||'')}</textarea><label>Retensi Backup (hari)</label><input id="backupRetentionV56" class="field" type="number" min="7" max="365" value="${Number(s.backupRetentionDays||30)}"><button class="btn btn-primary">Simpan Commercial Settings</button></form></div>
        <div class="card commercial-panel-v56"><h4>Backup Otomatis</h4><div class="maintenance-row-v56"><span>Backup terakhir</span><b>${backup.ok?'PASS':'Belum PASS'}</b></div><div class="maintenance-row-v56"><span>Waktu</span><b>${date56(backup.finished_at)}</b></div><div class="maintenance-row-v56"><span>Database backup</span><b>${size56(backup.database_bytes)}</b></div><div class="maintenance-row-v56"><span>Proof storage</span><b>${size56(storage.proofs?.bytes)}</b></div><small>Timer VPS berjalan setiap malam sekitar 02:15 dengan randomized delay.</small></div>
        <div class="card commercial-panel-v56"><h4>Restore Verification</h4><div class="maintenance-row-v56"><span>Status</span><b>${restore.ok?'PASS':'Belum diuji'}</b></div><div class="maintenance-row-v56"><span>Terakhir diuji</span><b>${date56(restore.finished_at)}</b></div><div class="maintenance-row-v56"><span>Data hasil restore</span><b>${Number(restore.students||0)} siswa · ${Number(restore.payments||0)} pembayaran</b></div><small>Restore rehearsal menggunakan database sementara dan tidak menyentuh database produksi.</small></div>
      </div>
      <div class="card commercial-readiness-v56"><div><h4>Commercial Readiness</h4><p>Semua pemeriksaan wajib harus PASS sebelum master dikloning ke sekolah lain.</p></div>${readinessRows56()}</div>
    </section>`;
  }

  const settingsBeforeV56=views.settings;
  views.settings=function(){return settingsBeforeV56()+commercialCardV56()};

  window.saveCommercialSettingsV56=async function(e){
    e.preventDefault();try{const out=await api56('/admin/settings',{method:'POST',body:{receiptPrefix:receiptPrefixV56.value.trim(),receiptFooter:receiptFooterV56.value.trim(),backupRetentionDays:Number(backupRetentionV56.value)}});toast(out.message||'Pengaturan disimpan');await loadCommercialV56({forceRender:true})}catch(err){toast(err.message||'Gagal menyimpan pengaturan')}
  };
  window.uploadSchoolLogoV56=async function(e){
    e.preventDefault();const f=document.getElementById('schoolLogoV56')?.files?.[0];if(!f)return toast('Pilih logo terlebih dahulu');if(f.size>2*1024*1024)return toast('Logo maksimal 2 MB');const fd=new FormData();fd.append('logo',f);
    try{const out=await apiV54('/api/v1/commercial/admin/logo',{method:'POST',body:fd});toast(out.message||'Logo berhasil disimpan');await loadBrandingV56();await loadCommercialV56({forceRender:true})}catch(err){toast(err.message||'Upload logo gagal')}
  };

  window.openOfficialReceiptV56=function(id){const n=Number(id);if(!n)return toast('ID kwitansi tidak valid');window.open(`/api/v1/commercial/receipts/${n}`,'_blank','noopener')};
  window.showParentReceiptV50=function(id){return openOfficialReceiptV56(id)};

  // Tambahkan tombol kwitansi resmi pada ledger Finance tanpa mengganti data source V5.5.
  const paymentsBeforeV56=views.payments;
  views.payments=function(){
    let html=paymentsBeforeV56();
    html=html.replace(/<button class="btn btn-danger btn-sm" onclick="voidPaymentV33\((\d+)\)">Void<\/button>/g,(m,id)=>`<button class="btn btn-soft btn-sm" onclick="openOfficialReceiptV56(${Number(id)})">Kwitansi</button>${m}`);
    return html;
  };

  const renderBeforeV56=window.render;
  window.render=function(){const out=renderBeforeV56();setTimeout(applyBrandV56,0);return out};
  const goBeforeV56=window.go;
  window.go=function(p,filter=null){const out=goBeforeV56(p,filter);if(p==='settings'&&session?.role==='admin')setTimeout(()=>loadCommercialV56({forceRender:true}),0);return out};

  loadBrandingV56();
  if(session?.role==='admin')setTimeout(()=>loadCommercialV56({forceRender:false}),400);
})();
