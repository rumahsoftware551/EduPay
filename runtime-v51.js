// EduPay V5.1 runtime bridge - keep latest features active across logout/login without full reload
(function(){
  function adminBillsRuntimeV51(){
    const rows=(db.bills||[]).slice().sort((a,b)=>Number(b.id)-Number(a.id));
    return `<div class="page-head"><div><span class="page-kicker">Penagihan</span><h2>Tagihan Siswa</h2><p>Kelola tagihan dan kirim reminder WhatsApp kepada wali.</p></div><div class="head-actions-v33"><button class="btn btn-soft" onclick="massBillFormV33()">Buat Massal</button><button class="btn btn-primary" onclick="billFormV33()">+ Tambah Tagihan</button></div></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Siswa</th><th>Tagihan</th><th>Jatuh Tempo</th><th>Nominal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map(b=>{const s=(db.students||[]).find(x=>Number(x.id)===Number(b.studentId))||{};const wa=!['paid','cancelled'].includes(b.status)?`<button class="btn btn-wa-v502 btn-sm" ${s.phone?'':`disabled title="No. HP wali kosong"`} onclick="sendBillWaV51(${b.id})">WA Reminder</button>`:'';const edit=b.status!=='paid'&&b.status!=='cancelled'?`<button class="btn btn-soft btn-sm" onclick="billFormV33(${b.id})">Edit</button><button class="btn btn-danger btn-sm" onclick="cancelBillV33(${b.id})">Batalkan</button>`:b.status==='cancelled'?`<button class="btn btn-ghost btn-sm" onclick="restoreBillV33(${b.id})">Pulihkan</button>`:'<span class="locked-v33">Terkunci setelah lunas</span>';return `<tr><td><b>${esc(s.name||b.studentName||studentName(b.studentId))}</b><br><small>${esc(s.parent||'Wali belum diisi')}</small></td><td><b>${esc(b.title)}</b></td><td>${esc(b.due||'-')}</td><td>${rupiah(b.amount)}</td><td>${billBadgeV33(b.status)}</td><td><div class="row-actions-v33">${wa}${edit}</div></td></tr>`}).join('')}</tbody></table></div></div>`;
  }
  const billsFallbackV51=views.bills;
  views.bills=function(){return session?.role==='admin'?adminBillsRuntimeV51():typeof billsFallbackV51==='function'?billsFallbackV51():''};

  const loginBeforeRuntimeV51=login;
  login=async function(e){await loginBeforeRuntimeV51(e);if(session&&['admin','finance'].includes(session.role)){if(typeof refreshVerificationV502==='function')await refreshVerificationV502({silent:true,forceRender:false});if(typeof startParentPollingV44==='function'&&session.role==='parent')startParentPollingV44();if(typeof window.EDUPAY_V502_TIMER!=='undefined'){if(window.EDUPAY_V502_TIMER)clearInterval(window.EDUPAY_V502_TIMER);window.EDUPAY_V502_TIMER=setInterval(()=>{if(!document.hidden&&page==='verification'&&session&&['admin','finance'].includes(session.role))refreshVerificationV502({silent:true})},15000)}render();}}
  const logoutBeforeRuntimeV51=logout;
  logout=async function(){if(window.EDUPAY_V502_TIMER){clearInterval(window.EDUPAY_V502_TIMER);window.EDUPAY_V502_TIMER=null}window.EDUPAY_V502_ITEMS=[];window.EDUPAY_V502_ERROR=null;return logoutBeforeRuntimeV51()};
  render();
})();
