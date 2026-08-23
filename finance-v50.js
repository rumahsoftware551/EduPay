// EduPay V5.0 - Finance transactions are server-first and atomic.
(function(){
  window.EDUPAY_V50_BUSY=false;

  function billV50(id){return (db.bills||[]).find(b=>Number(b.id)===Number(id))}
  function paymentV50(id){return (db.payments||[]).find(p=>Number(p.id)===Number(id))}
  function billServerIdV50(id){const b=billV50(id);return Number(b?.serverId||b?.id||id)}
  function paymentServerIdV50(id){const p=paymentV50(id);return Number(p?.serverId||p?.id||id)}

  async function refreshAfterFinanceV50(message){
    if(typeof refreshServerStateV49==='function')await refreshServerStateV49({silent:true,forceRender:false});
    render();if(message)toast(message);
  }

  window.pay=async function(id,method='Cash'){
    if(window.EDUPAY_V50_BUSY)return;
    if(session?.role!=='finance')return toast('Pembayaran hanya dapat diproses oleh Finance/Bendahara');
    const b=billV50(id);if(!b)return toast('Tagihan tidak ditemukan');
    if(b.status==='paid')return toast('Tagihan sudah lunas');
    if(b.status==='cancelled')return toast('Tagihan sudah dibatalkan');
    const serverId=billServerIdV50(id);
    if(!Number.isFinite(serverId)||serverId<=0)return toast('ID tagihan server tidak valid. Refresh data VPS.');
    window.EDUPAY_V50_BUSY=true;
    try{
      const endpoint=(b.status==='pending'&&method==='Transfer')?`/api/v50/finance/bills/${serverId}/approve`:`/api/v50/finance/bills/${serverId}/pay`;
      const out=await apiV40(endpoint,{method:'POST',body:endpoint.endsWith('/pay')?{method}:{}});
      await refreshAfterFinanceV50(`${out.message||'Pembayaran berhasil'} · ${out.payment?.receipt||''}`.trim());
    }catch(err){toast(err.message||'Pembayaran gagal');if(typeof refreshServerStateV49==='function')await refreshServerStateV49({silent:true});}
    finally{window.EDUPAY_V50_BUSY=false;}
  };

  window.paySelected=async function(){
    const id=Number(document.getElementById('payBill')?.value),method=document.getElementById('payMethod')?.value||'Cash';
    if(!id)return toast('Pilih tagihan terlebih dahulu');
    return pay(id,method);
  };

  window.reject=function(id){
    const b=billV50(id);if(!b)return toast('Tagihan tidak ditemukan');
    if(b.status!=='pending')return toast('Tagihan tidak lagi menunggu verifikasi');
    openCrudV33('Tolak Bukti Pembayaran',`<form onsubmit="submitRejectV50(event,${Number(id)})"><div class="proof-note">${esc(b.studentName||studentName(b.studentId))} · <b>${esc(b.title)}</b> · ${rupiah(b.amount)}</div><div><label>Alasan Penolakan</label><textarea id="rejectReasonV50" class="field finance-reason-v50" required minlength="3" placeholder="Contoh: nominal tidak sesuai / bukti tidak terbaca"></textarea></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Batal</button><button class="btn btn-danger">Tolak Bukti</button></div></form>`);
  };

  window.submitRejectV50=async function(e,id){
    e.preventDefault();if(window.EDUPAY_V50_BUSY)return;
    const reason=document.getElementById('rejectReasonV50')?.value.trim()||'';if(reason.length<3)return toast('Alasan penolakan wajib diisi');
    const serverId=billServerIdV50(id);window.EDUPAY_V50_BUSY=true;
    try{const out=await apiV40(`/api/v50/finance/bills/${serverId}/reject`,{method:'POST',body:{reason}});closeCrudV33();await refreshAfterFinanceV50(out.message||'Bukti ditolak');}
    catch(err){toast(err.message||'Gagal menolak bukti');}
    finally{window.EDUPAY_V50_BUSY=false;}
  };

  window.voidPaymentV33=function(id){
    const p=paymentV50(id);if(!p)return toast('Transaksi tidak ditemukan');
    if(p.voided)return toast('Transaksi sudah dibatalkan');
    openCrudV33('Batalkan / Void Pembayaran',`<form onsubmit="submitVoidV50(event,${Number(id)})"><div class="proof-note">Kwitansi <b>${esc(p.receipt||'-')}</b> · ${rupiah(p.amount)} · ${esc(p.method||'-')}</div><div><label>Alasan Pembatalan</label><textarea id="voidReasonV50" class="field finance-reason-v50" required minlength="5" placeholder="Contoh: salah memilih siswa saat input pembayaran"></textarea><small class="field-help-v35">Void tidak menghapus transaksi. Kwitansi tetap tercatat di audit trail sebagai dibatalkan.</small></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Batal</button><button class="btn btn-danger">Void Pembayaran</button></div></form>`);
  };

  window.submitVoidV50=async function(e,id){
    e.preventDefault();if(window.EDUPAY_V50_BUSY)return;
    const reason=document.getElementById('voidReasonV50')?.value.trim()||'';if(reason.length<5)return toast('Alasan pembatalan wajib diisi minimal 5 karakter');
    const serverId=paymentServerIdV50(id);window.EDUPAY_V50_BUSY=true;
    try{const out=await apiV40(`/api/v50/finance/payments/${serverId}/void`,{method:'POST',body:{reason}});closeCrudV33();await refreshAfterFinanceV50(out.message||'Pembayaran dibatalkan');}
    catch(err){toast(err.message||'Void pembayaran gagal');}
    finally{window.EDUPAY_V50_BUSY=false;}
  };

  // Finance always refreshes server state before opening sensitive transaction pages.
  const goBeforeV50=go;
  go=function(p,filter=null){
    const result=goBeforeV50(p,filter);
    if(session?.role==='finance'&&['payments','verification','reports','dashboard'].includes(p)&&typeof refreshServerStateV49==='function')setTimeout(()=>refreshServerStateV49({silent:true}),0);
    return result;
  };

  render();
})();
