// EduPay V5.0.2 - Shared proof verification + WhatsApp reminder actions
(function(){
  window.EDUPAY_V502_ITEMS=[];
  window.EDUPAY_V502_LOADING=false;
  window.EDUPAY_V502_ERROR=null;
  window.EDUPAY_V502_TIMER=null;

  menuIcons.verification=menuIcons.verification||'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16v18H4z"/><path d="M8 8h8M8 12h5"/><path d="m8 17 2 2 5-5"/></svg>';

  // Final navigation definition: Verifikasi Bukti is visible for both Admin and Finance.
  window.nav=function(){
    if(session.role==='admin')return [['dashboard','Dashboard'],['students','Data Siswa'],['guardians','Akun Wali'],['classes','Kelas'],['homerooms','Wali Kelas'],['fees','Jenis Pembayaran'],['bills','Tagihan'],['verification','Verifikasi Bukti'],['migration','Migrasi Data'],['reports','Laporan']];
    if(session.role==='finance')return [['dashboard','Dashboard'],['payments','Pembayaran'],['verification','Verifikasi Bukti'],['reports','Laporan']];
    const items=[['dashboard','Beranda']];if((session.studentIds||[]).length>1)items.push(['children','Anak Saya']);items.push(['mybills','Tagihan Saya'],['history','Riwayat'],['profile','Profil']);return items;
  };

  function waNumberV502(value){
    let s=String(value||'').replace(/\D/g,'');
    if(s.startsWith('0'))s='62'+s.slice(1);else if(s.startsWith('8'))s='62'+s;return s;
  }
  function statusTextV502(status){return status==='pending'?'Menunggu Verifikasi':status==='paid'?'Lunas':status==='cancelled'?'Dibatalkan':'Belum Bayar'}
  function waUrlV502(phone,message){const n=waNumberV502(phone);return n?`https://wa.me/${n}?text=${encodeURIComponent(message)}`:''}
  window.openWhatsAppReminderV502=function(phone,guardian,student,title,amount,due,status='unpaid'){
    const n=waNumberV502(phone);if(!n)return toast('Nomor WhatsApp wali belum tersedia');
    const who=guardian?`Bapak/Ibu ${guardian}`:'Bapak/Ibu Wali Murid';
    let text=`Yth. ${who},\n\nKami dari sekolah menginformasikan tagihan atas nama *${student}*:\n\nTagihan: *${title}*\nNominal: *${rupiah(Number(amount||0))}*\nStatus: *${statusTextV502(status)}*`;
    if(due)text+=`\nJatuh tempo: *${due}*`;
    if(status==='unpaid')text+='\n\nMohon dapat melakukan pembayaran melalui portal EduPay. Jika sudah melakukan pembayaran, silakan abaikan pesan ini atau unggah bukti pembayaran melalui portal.';
    else if(status==='pending')text+='\n\nBukti pembayaran sudah kami terima dan sedang menunggu proses verifikasi. Pesan ini dapat digunakan bila Bapak/Ibu perlu menghubungi petugas sekolah.';
    text+='\n\nTerima kasih.\nEduPay School Finance';
    window.open(waUrlV502(n,text),'_blank','noopener');
  };

  window.refreshVerificationV502=async function({silent=true,forceRender=true}={}){
    if(!session||!['admin','finance'].includes(session.role)||window.EDUPAY_V502_LOADING)return null;
    window.EDUPAY_V502_LOADING=true;
    try{
      const out=await apiV40('/api/v502/verification');
      window.EDUPAY_V502_ITEMS=out.items||[];window.EDUPAY_V502_ERROR=null;
      if(forceRender&&page==='verification')render();return out;
    }catch(err){window.EDUPAY_V502_ERROR=err.message||'Gagal mengambil antrean verifikasi';if(!silent)toast(window.EDUPAY_V502_ERROR);if(forceRender&&page==='verification')render();return null;}
    finally{window.EDUPAY_V502_LOADING=false;}
  };

  function verificationViewV502(){
    const items=window.EDUPAY_V502_ITEMS||[];
    setTimeout(()=>refreshVerificationV502({silent:true,forceRender:true}),0);
    return `<div class="page-head"><div><span class="page-kicker">Kontrol Pembayaran</span><h2>Verifikasi Bukti Transfer</h2><p>Antrean yang sama untuk Admin dan Finance, langsung dari PostgreSQL.</p></div><button class="btn btn-soft" onclick="refreshVerificationV502({silent:false})">↻ Refresh</button></div>
      <div class="verification-note-v502"><b>${items.length} bukti menunggu pemeriksaan</b><span>Terima/Tolak diproses langsung di server dan tercatat pada audit log. Tombol WA membuka WhatsApp wali.</span></div>
      <div class="card">${window.EDUPAY_V502_ERROR?`<div class="empty"><b>Gagal memuat antrean</b><br>${esc(window.EDUPAY_V502_ERROR)}<br><br><button class="btn btn-primary btn-sm" onclick="refreshVerificationV502({silent:false})">Coba Lagi</button></div>`:window.EDUPAY_V502_LOADING&&!items.length?'<div class="empty">Mengambil bukti transfer dari server...</div>':items.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Siswa / Wali</th><th>Tagihan</th><th>Bukti</th><th>Nominal</th><th>Dikirim</th><th>Aksi</th></tr></thead><tbody>${items.map(b=>`<tr><td><b>${esc(b.studentName)}</b><br><small>${esc(b.className||'-')} · ${esc(b.guardianName||'Wali belum diisi')}</small></td><td><b>${esc(b.title)}</b><br><small>Jatuh tempo: ${esc(b.due||'-')}</small></td><td><span class="proof-file-v502">${esc(b.proofName||'Nama file tidak tersedia')}</span><br><small>File fisik private storage akan diaktifkan pada Proof Storage.</small></td><td>${rupiah(b.amount)}</td><td>${b.updatedAt?new Date(b.updatedAt).toLocaleString('id-ID'):'-'}</td><td><div class="action-stack-v502"><button class="btn btn-primary btn-sm" onclick="approveProofV502(${b.id})">✓ Terima</button><button class="btn btn-danger btn-sm" onclick="rejectProofV502(${b.id})">✕ Tolak</button><button class="btn btn-wa-v502 btn-sm" ${b.guardianPhone?'':`disabled title="No. HP wali kosong"`} onclick='openWhatsAppReminderV502(${JSON.stringify(b.guardianPhone||'')},${JSON.stringify(b.guardianName||'')},${JSON.stringify(b.studentName)},${JSON.stringify(b.title)},${Number(b.amount||0)},${JSON.stringify(b.due||'')},"pending")'>WA Wali</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><b>Tidak ada bukti yang menunggu verifikasi.</b><br>Antrean akan diperbarui otomatis ketika wali mengirim bukti transfer.</div>'}</div>`;
  }
  views.verification=verificationViewV502;

  window.approveProofV502=async function(id){
    if(!confirm('Terima bukti ini dan nyatakan tagihan lunas?'))return;
    try{const out=await apiV40(`/api/v502/bills/${Number(id)}/approve`,{method:'POST',body:{}});toast(`${out.message||'Pembayaran diterima'}${out.receipt?' · '+out.receipt:''}`);await refreshVerificationV502({silent:true,forceRender:false});if(typeof refreshServerStateV49==='function')await refreshServerStateV49({silent:true,forceRender:false});render();}
    catch(err){toast(err.message||'Verifikasi gagal');await refreshVerificationV502({silent:true});}
  };
  window.rejectProofV502=function(id){
    const b=(window.EDUPAY_V502_ITEMS||[]).find(x=>Number(x.id)===Number(id));if(!b)return toast('Data bukti tidak ditemukan');
    openCrudV33('Tolak Bukti Transfer',`<form onsubmit="submitRejectProofV502(event,${Number(id)})"><div class="proof-note"><b>${esc(b.studentName)}</b> · ${esc(b.title)} · ${rupiah(b.amount)}</div><div><label>Alasan Penolakan</label><textarea id="reasonRejectV502" class="field finance-reason-v50" required minlength="3" placeholder="Contoh: nominal tidak sesuai / bukti kurang jelas"></textarea></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Batal</button><button class="btn btn-danger">Tolak Bukti</button></div></form>`);
  };
  window.submitRejectProofV502=async function(e,id){e.preventDefault();const reason=document.getElementById('reasonRejectV502')?.value.trim()||'';if(reason.length<3)return toast('Alasan penolakan wajib diisi');try{const out=await apiV40(`/api/v502/bills/${Number(id)}/reject`,{method:'POST',body:{reason}});closeCrudV33();toast(out.message||'Bukti ditolak');await refreshVerificationV502({silent:true,forceRender:false});if(typeof refreshServerStateV49==='function')await refreshServerStateV49({silent:true,forceRender:false});render();}catch(err){toast(err.message||'Gagal menolak bukti')}};

  // Admin bill page keeps all CRUD actions and adds a WhatsApp reminder per unpaid/pending bill.
  function billsViewV502(){
    const rows=(db.bills||[]).slice().sort((a,b)=>Number(b.id)-Number(a.id));
    return `<div class="page-head"><div><span class="page-kicker">Penagihan</span><h2>Tagihan Siswa</h2><p>Kelola tagihan dan kirim reminder WhatsApp kepada wali.</p></div><div class="head-actions-v33"><button class="btn btn-soft" onclick="massBillFormV33()">Buat Massal</button><button class="btn btn-primary" onclick="billFormV33()">+ Tambah Tagihan</button></div></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Siswa</th><th>Tagihan</th><th>Jatuh Tempo</th><th>Nominal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map(b=>{const s=(db.students||[]).find(x=>Number(x.id)===Number(b.studentId))||{};const wa=!['paid','cancelled'].includes(b.status)?`<button class="btn btn-wa-v502 btn-sm" ${s.phone?'':`disabled title="No. HP wali kosong"`} onclick='openWhatsAppReminderV502(${JSON.stringify(s.phone||'')},${JSON.stringify(s.parent||'')},${JSON.stringify(s.name||b.studentName||'Siswa')},${JSON.stringify(b.title)},${Number(b.amount||0)},${JSON.stringify(b.due||'')},${JSON.stringify(b.status)})'>WA Reminder</button>`:'';const edit=b.status!=='paid'&&b.status!=='cancelled'?`<button class="btn btn-soft btn-sm" onclick="billFormV33(${b.id})">Edit</button><button class="btn btn-danger btn-sm" onclick="cancelBillV33(${b.id})">Batalkan</button>`:b.status==='cancelled'?`<button class="btn btn-ghost btn-sm" onclick="restoreBillV33(${b.id})">Pulihkan</button>`:'<span class="locked-v33">Terkunci setelah lunas</span>';return `<tr><td><b>${esc(s.name||b.studentName||studentName(b.studentId))}</b><br><small>${esc(s.parent||'Wali belum diisi')}</small></td><td><b>${esc(b.title)}</b></td><td>${esc(b.due||'-')}</td><td>${rupiah(b.amount)}</td><td>${billBadgeV33(b.status)}</td><td><div class="row-actions-v33">${wa}${edit}</div></td></tr>`}).join('')}</tbody></table></div></div>`;
  }
  if(session?.role==='admin')views.bills=billsViewV502;

  function startV502Polling(){if(window.EDUPAY_V502_TIMER){clearInterval(window.EDUPAY_V502_TIMER);window.EDUPAY_V502_TIMER=null}if(!session||!['admin','finance'].includes(session.role))return;window.EDUPAY_V502_TIMER=setInterval(()=>{if(!document.hidden&&page==='verification')refreshVerificationV502({silent:true})},15000)}
  window.addEventListener('focus',()=>{if(session&&['admin','finance'].includes(session.role)&&page==='verification')refreshVerificationV502({silent:true})});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session&&['admin','finance'].includes(session.role)&&page==='verification')refreshVerificationV502({silent:true})});
  startV502Polling();
  if(session&&['admin','finance'].includes(session.role))setTimeout(()=>refreshVerificationV502({silent:true,forceRender:page==='verification'}),120);
  render();
})();
