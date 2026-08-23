// EduPay V5.5.1 - unified VPS-backed dashboard state for Admin, Finance, and Parent.
(function(){
  window.EDUPAY_V551={loading:false,error:null,last:null,timer:null,data:null};
  const S=window.EDUPAY_V551;

  function reqId551(){return window.EDUPAY_V54?.lastRequestId||null}
  function error551(){
    const id=reqId551();
    return `<div class="card"><div class="empty stability-error-v501"><b>Dashboard belum dapat mengambil data VPS</b><span>${esc(S.error||'Terjadi masalah saat membaca PostgreSQL.')}</span>${id?`<small>Request ID: ${esc(id)}</small>`:''}<button class="btn btn-primary btn-sm" onclick="loadPortalStateV551({silent:false,forceRender:true})">Coba Lagi</button></div></div>`;
  }
  function loading551(){return '<div class="card"><div class="empty">Mengambil data terbaru langsung dari PostgreSQL...</div></div>'}

  function applyParent551(out){
    const st=out.parentState||{};
    window.EDUPAY_PARENT_STATE=st;
    if(session){
      session.studentIds=(st.students||[]).map(x=>Number(x.id));
      session.studentId=st.studentId?Number(st.studentId):null;
      session.guardianProfile=st.profile||null;
    }
  }
  function applyStaff551(out){
    if(window.EDUPAY_V55)window.EDUPAY_V55.dashboard=out.dashboard||null;
    window.EDUPAY_STAFF_DASHBOARD_V551=out.dashboard||null;
    window.EDUPAY_DATABASE_COUNTS_V551=out.databaseCounts||{};
    if(window.EDUPAY_V49){window.EDUPAY_V49.ready=true;window.EDUPAY_V49.error=null;window.EDUPAY_V49.lastPull=new Date();}
  }

  window.loadPortalStateV551=async function({silent=true,forceRender=true,studentId=null}={}){
    if(!session||S.loading)return null;
    S.loading=true;S.error=null;
    try{
      const sid=session.role==='parent'?(studentId||session.studentId):null;
      const path='/api/v1/portal/state'+(sid?`?student_id=${encodeURIComponent(sid)}`:'');
      const out=await apiV40(path);
      S.data=out;S.last=new Date();
      if(session.role==='parent')applyParent551(out);else applyStaff551(out);
      if(forceRender)render();
      return out;
    }catch(err){
      S.error=err.message||'Gagal mengambil data dari VPS';
      if(!silent)toast(`${S.error}${err.requestId?' · ID '+err.requestId:''}`);
      if(forceRender)render();
      return null;
    }finally{S.loading=false;}
  };

  function latestTable551(rows){
    if(!rows?.length)return '<div class="empty">Belum ada transaksi pembayaran.</div>';
    return `<div class="table-wrap"><table class="table" data-filter-v45="1"><thead><tr><th>Kwitansi</th><th>Tanggal</th><th>Siswa</th><th>Tagihan</th><th>Nominal</th><th>Metode</th></tr></thead><tbody>${rows.map(p=>`<tr><td><b>${esc(p.receipt||'-')}</b></td><td>${p.paidAt?new Date(p.paidAt).toLocaleString('id-ID'):'-'}</td><td>${esc(p.studentName||'-')}</td><td>${esc(p.title||'-')}</td><td>${rupiah(p.amount)}</td><td>${esc(p.method||'-')}${p.voided?' · VOID':''}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function staffDashboard551(){
    if(S.error&&!window.EDUPAY_STAFF_DASHBOARD_V551)return error551();
    const d=window.EDUPAY_STAFF_DASHBOARD_V551;
    if(!d){if(!S.loading)setTimeout(()=>loadPortalStateV551({silent:true}),0);return loading551();}
    const s=d.summary||{},counts=window.EDUPAY_DATABASE_COUNTS_V551||{};
    return `<div class="page-head"><div><span class="page-kicker">VPS LIVE · PostgreSQL</span><h2>Halo, ${esc((session?.name||'Pengguna').split(' ')[0])} 👋</h2><p>Dashboard dibaca langsung dari database VPS. Terakhir diperbarui ${S.last?S.last.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):'-'}.</p></div><button class="btn btn-soft" onclick="loadPortalStateV551({silent:false})">↻ Refresh VPS</button></div>
    <div class="grid stats">${stat('Total Tagihan',rupiah(s.totalBilled||0),'stat-blue')}${stat('Sudah Dibayar',rupiah(s.paid||0),'stat-green')}${stat('Belum Dibayar',rupiah(s.unpaid||0),'stat-red')}${stat('Perlu Verifikasi',Number(s.pendingCount||0),'stat-amber')}</div>
    <div class="scale-mini-stats-v55"><div><span>Penerimaan Hari Ini</span><b>${rupiah(s.today||0)}</b></div><div><span>Penerimaan Bulan Ini</span><b>${rupiah(s.month||0)}</b></div><div><span>Tunggakan Lewat Tempo</span><b>${Number(s.overdueCount||0)}</b></div><div><span>Siswa Aktif</span><b>${Number(s.activeStudents||0)}</b></div></div>
    <div class="card table-card"><div class="section-head"><div><h3>Transaksi Terbaru</h3><p>Database: ${Number(counts.students||0)} siswa · ${Number(counts.bills||0)} tagihan · ${Number(counts.payments||0)} pembayaran.</p></div></div>${latestTable551(d.latestPayments||[])}</div>`;
  }

  function parentStudent551(st){return (st.students||[]).find(x=>Number(x.id)===Number(st.studentId))||(st.students||[])[0]||null}
  function parentBillTable551(list){
    if(!list?.length)return '<div class="empty">Tidak ada tagihan aktif.</div>';
    return `<div class="table-wrap"><table class="table" data-filter-v45="1"><thead><tr><th>Tagihan</th><th>Jatuh Tempo</th><th>Nominal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${list.map(b=>`<tr><td><b>${esc(b.title)}</b></td><td>${esc(b.due||'-')}</td><td>${rupiah(b.amount)}</td><td>${typeof statusBadgeV44==='function'?statusBadgeV44(b.status):badge(b.status)}</td><td>${b.status==='unpaid'?`<button class="btn transfer-btn btn-sm" onclick="openTransferUploadV44(${Number(b.id)})">Transfer & Upload Bukti</button>`:b.status==='pending'?'<span class="badge warn"><i></i>Diproses</span>':b.status==='paid'?'<span class="badge ok"><i></i>Lunas</span>':'-'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function parentDashboard551(){
    if(S.error&&!window.EDUPAY_PARENT_STATE)return error551();
    const st=window.EDUPAY_PARENT_STATE;
    if(!st){if(!S.loading)setTimeout(()=>loadPortalStateV551({silent:true}),0);return loading551();}
    const student=parentStudent551(st),p=st.profile||{},s=st.summary||{};
    if(!student)return `<div class="page-head"><div><span class="page-kicker">Portal Orang Tua</span><h2>Halo, ${esc(p.name||session?.name||'Wali')}</h2><p>Akun berhasil login ke VPS.</p></div></div><div class="card"><div class="empty"><b>Belum ada siswa aktif yang terhubung ke akun ini.</b><br>Admin perlu menjalankan Perbarui Relasi Wali pada menu Akun Wali.</div></div>`;
    const greeting=`${p.salutation||'Bapak/Ibu'} ${p.nickname||String(p.name||session?.name||'Wali').split(' ')[0]}`;
    const active=(st.bills||[]).filter(b=>!['paid','cancelled'].includes(b.status));
    return `<div class="page-head"><div><span class="page-kicker">VPS LIVE · Portal Orang Tua</span><h2>Halo, ${esc(greeting)} 👋</h2><p>${esc(student.name||'-')} · ${esc(student.class_name||student.className||'-')}</p></div><button class="btn btn-soft" onclick="loadPortalStateV551({silent:false})">↻ Refresh</button></div>
    <div class="welcome-card"><div class="welcome-icon">✓</div><div><b>Terhubung langsung ke database sekolah</b><p>Status tagihan dan pembayaran berasal dari PostgreSQL VPS.</p></div></div>
    <div class="grid stats">${stat('Belum Bayar',rupiah(s.unpaid||0),'stat-red')}${stat('Sudah Dibayar',rupiah(s.paid||0),'stat-green')}${stat('Jumlah Tagihan',Number(s.count||0),'stat-blue')}${stat('Menunggu Verifikasi',rupiah(s.pending||0),'stat-amber')}</div>
    <div class="card"><div class="section-head"><div><h3>Tagihan Aktif</h3><p>Terakhir diperbarui ${S.last?S.last.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):'-'}.</p></div></div>${parentBillTable551(active)}</div>`;
  }

  views.dashboard=function(){return session?.role==='parent'?parentDashboard551():staffDashboard551()};

  // Make existing role refreshers converge on the same server endpoint for dashboard state.
  const parentRefreshBefore551=window.refreshParentStateV44;
  window.refreshParentStateV44=async function({silent=true,forceRender=true}={}){
    if(session?.role!=='parent')return null;
    const out=await loadPortalStateV551({silent,forceRender,studentId:session.studentId});
    return out?.parentState||null;
  };
  window.loadDashboardV55=async function({silent=true,forceRender=true}={}){
    if(!session||!['admin','finance'].includes(session.role))return null;
    const out=await loadPortalStateV551({silent,forceRender});return out?.dashboard||null;
  };

  const goBefore551=window.go;
  window.go=function(p,filter=null){const out=goBefore551(p,filter);if(p==='dashboard')setTimeout(()=>loadPortalStateV551({silent:true,forceRender:true}),0);return out};
  const loginBefore551=window.login;
  window.login=async function(e){const out=await loginBefore551(e);if(session)setTimeout(()=>loadPortalStateV551({silent:false,forceRender:true}),0);return out};
  const logoutBefore551=window.logout;
  window.logout=async function(){if(S.timer){clearInterval(S.timer);S.timer=null}S.data=null;S.error=null;S.last=null;window.EDUPAY_STAFF_DASHBOARD_V551=null;return logoutBefore551()};

  function start551(){
    if(S.timer){clearInterval(S.timer);S.timer=null}
    if(!session)return;
    loadPortalStateV551({silent:true,forceRender:true});
    S.timer=setInterval(()=>{if(!document.hidden&&session)loadPortalStateV551({silent:true,forceRender:page==='dashboard'})},15000);
  }
  let tries=0;const boot=setInterval(()=>{tries++;if(session){clearInterval(boot);start551()}else if(window.EDUPAY_V54?.sessionReady||tries>100)clearInterval(boot)},100);
  window.addEventListener('focus',()=>{if(session)loadPortalStateV551({silent:true,forceRender:page==='dashboard'})});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session)loadPortalStateV551({silent:true,forceRender:page==='dashboard'})});
})();
