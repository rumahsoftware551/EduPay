// EduPay V5.0 - Parent payment history uses the PostgreSQL ledger.
(function(){
  window.EDUPAY_PARENT_PAYMENTS=[];
  window.EDUPAY_PARENT_PAYMENTS_LOADING=false;

  window.refreshParentPaymentsV50=async function({silent=true,forceRender=true}={}){
    if(!session||session.role!=='parent'||window.EDUPAY_PARENT_PAYMENTS_LOADING)return;
    const sid=Number(session.studentId);if(!sid)return;
    window.EDUPAY_PARENT_PAYMENTS_LOADING=true;
    try{
      const out=await apiV40(`/api/v50/parent/payments?student_id=${encodeURIComponent(sid)}`);
      const before=JSON.stringify(window.EDUPAY_PARENT_PAYMENTS);
      window.EDUPAY_PARENT_PAYMENTS=out.payments||[];
      if(forceRender&&page==='history'&&before!==JSON.stringify(window.EDUPAY_PARENT_PAYMENTS))render();
    }catch(err){if(!silent)toast(err.message||'Gagal mengambil riwayat pembayaran')}
    finally{window.EDUPAY_PARENT_PAYMENTS_LOADING=false;}
  };

  function historyV50(){
    const rows=window.EDUPAY_PARENT_PAYMENTS||[];
    if(window.EDUPAY_PARENT_PAYMENTS_LOADING&&!rows.length)return '<div class="card"><div class="empty">Mengambil riwayat pembayaran dari server...</div></div>';
    return `<div class="page-head"><div><span class="page-kicker">Ledger Pembayaran</span><h2>Riwayat Pembayaran</h2><p>Nomor kwitansi dan transaksi diambil langsung dari PostgreSQL sekolah.</p></div><button class="btn btn-soft" onclick="refreshParentPaymentsV50({silent:false})">↻ Refresh</button></div><div class="card">${rows.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Kwitansi</th><th>Tanggal</th><th>Tagihan</th><th>Nominal</th><th>Metode</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map(p=>`<tr><td><b>${esc(p.receipt)}</b></td><td>${new Date(p.paidAt).toLocaleDateString('id-ID')}</td><td>${esc(p.title)}</td><td>${rupiah(p.amount)}</td><td>${esc(p.method)}</td><td>${p.voided?'<span class="badge danger"><i></i>Dibatalkan</span>':'<span class="badge ok"><i></i>Valid</span>'}</td><td>${p.voided?'-':`<button class="btn btn-ghost btn-sm" onclick="showParentReceiptV50(${p.id})">Lihat Kwitansi</button>`}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada transaksi pembayaran.</div>'}</div>`;
  }

  window.showParentReceiptV50=function(id){
    const p=(window.EDUPAY_PARENT_PAYMENTS||[]).find(x=>Number(x.id)===Number(id));if(!p)return toast('Kwitansi tidak ditemukan');
    openCrudV33('Kwitansi Pembayaran',`<div class="receipt"><h2>EduPay School Finance</h2><p>Kwitansi Pembayaran</p><hr><div class="receipt-row"><span>No. Kwitansi</span><b>${esc(p.receipt)}</b></div><div class="receipt-row"><span>Tanggal</span><b>${new Date(p.paidAt).toLocaleString('id-ID')}</b></div><div class="receipt-row"><span>Tagihan</span><b>${esc(p.title)}</b></div><div class="receipt-row"><span>Metode</span><b>${esc(p.method)}</b></div><div class="receipt-row total"><span>Total</span><b>${rupiah(p.amount)}</b></div><small>Transaksi tercatat pada ledger pembayaran server EduPay.</small></div><div class="modal-actions"><button class="btn btn-primary" onclick="window.print()">Cetak</button><button class="btn btn-ghost" onclick="closeCrudV33()">Tutup</button></div>`);
  };

  views.history=historyV50;

  const goBeforeParentV50=go;
  go=function(p,filter=null){const result=goBeforeParentV50(p,filter);if(session?.role==='parent'&&p==='history')setTimeout(()=>refreshParentPaymentsV50({silent:true}),0);return result;};
  window.addEventListener('focus',()=>{if(session?.role==='parent'&&page==='history')refreshParentPaymentsV50({silent:true})});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session?.role==='parent'&&page==='history')refreshParentPaymentsV50({silent:true})});
  if(session?.role==='parent')setTimeout(()=>refreshParentPaymentsV50({silent:true,forceRender:false}),250);
  render();
})();
