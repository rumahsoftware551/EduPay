// EduPay V5.1 - Real transfer proof upload to private VPS storage
(function(){
  window.submitTransferProofV44=async function(id){
    const input=document.getElementById('transferProofServerV44');
    const f=input?.files?.[0];
    if(!f)return toast('Pilih file bukti transfer terlebih dahulu');
    if(f.size>5*1024*1024)return toast('Ukuran bukti maksimal 5 MB');
    if(!['image/jpeg','image/png','application/pdf'].includes(f.type))return toast('Format bukti harus JPG, PNG, atau PDF');
    const fd=new FormData();fd.append('proof',f);
    try{
      const res=await fetch(`/api/v51/parent/bills/${Number(id)}/proof`,{method:'POST',credentials:'same-origin',body:fd,cache:'no-store'});
      let out={};try{out=await res.json()}catch(e){}
      if(!res.ok)throw new Error(out.message||`HTTP ${res.status}`);
      closeCrudV33();
      await refreshParentStateV44({silent:true,forceRender:false});
      render();toast(out.message||'Bukti pembayaran berhasil diunggah');
    }catch(err){toast(err.message||'Gagal mengunggah bukti pembayaran')}
  };
  const oldOpen=window.openTransferUploadV44;
  window.openTransferUploadV44=function(id){
    const b=(window.EDUPAY_PARENT_STATE?.bills||[]).find(x=>Number(x.id)===Number(id));if(!b)return toast('Tagihan tidak ditemukan');
    openCrudV33('Upload Bukti Transfer',`<div class="proof-note">Tagihan: <b>${esc(b.title)}</b> · ${rupiah(b.amount)}</div><div class="upload-box"><b>Pilih bukti transfer</b><small>JPG, PNG, atau PDF · maksimal 5 MB. File disimpan private di VPS dan hanya dapat dibuka oleh wali terkait, Admin, atau Finance.</small><input id="transferProofServerV44" type="file" accept="image/jpeg,image/png,application/pdf"></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeCrudV33()">Batal</button><button type="button" class="btn btn-primary" onclick="submitTransferProofV44(${b.id})">Kirim Bukti</button></div>`);
  };
  render();
})();
