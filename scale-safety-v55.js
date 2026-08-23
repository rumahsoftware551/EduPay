// EduPay V5.5 runtime hardening for scale pages.
(function(){
  const V=window.EDUPAY_V55;if(!V)return;

  function trimLegacyCacheV55(){
    if(!session||!['admin','finance'].includes(session.role)||V.__cacheTrimmed)return;
    V.__cacheTrimmed=true;let changed=false;
    if((db.students||[]).length>100){db.students=[];changed=true}
    if((db.bills||[]).length>100){db.bills=[];changed=true}
    if((db.payments||[]).length>100){db.payments=[];changed=true}
    if(changed)try{save()}catch(e){}
  }

  window.sendBillWaSafeV55=function(id){
    const b=(V.bills.items||[]).find(x=>Number(x.id)===Number(id));if(!b)return toast('Tagihan tidak ditemukan');
    return openWhatsAppReminderV502(b.guardianPhone,b.guardianName,b.studentName,b.title,b.amount,b.due,b.status);
  };
  window.sendArrearWaSafeV55=function(id){
    const x=(V.reports.arrears.items||[]).find(r=>Number(r.id)===Number(id));if(!x)return toast('Data tunggakan tidak ditemukan');
    return openWhatsAppReminderV502(x.guardianPhone,x.guardianName,x.studentName,x.title,x.amount,x.due,x.status);
  };

  const billsBeforeSafe=views.bills;
  views.bills=function(){
    let html=billsBeforeSafe();
    const ids=(V.bills.items||[]).filter(b=>!['paid','cancelled'].includes(b.status)).map(b=>b.id);
    html=html.replace(/onclick="openWhatsAppReminderV502\([^\"]*\)"/g,()=>`onclick="sendBillWaSafeV55(${Number(ids.shift()||0)})"`);
    return html;
  };
  const reportsBeforeSafe=views.reports;
  views.reports=function(){
    let html=reportsBeforeSafe();const ids=(V.reports.arrears.items||[]).map(x=>x.id);
    html=html.replace(/onclick="openWhatsAppReminderV502\([^\"]*\)"/g,()=>`onclick="sendArrearWaSafeV55(${Number(ids.shift()||0)})"`);
    return html;
  };

  window.searchBillStudentV55=function(value){
    clearTimeout(window.__lookupTimerV55);const host=document.getElementById('billStudentResultsV55');if(!host)return;
    if(!String(value||'').trim()){host.innerHTML='<small>Ketik minimal 1 karakter lalu pilih siswa.</small>';return}
    window.__lookupTimerV55=setTimeout(async()=>{try{
      const out=await apiV40('/api/v1/scale/students/lookup?q='+encodeURIComponent(String(value).trim()));V.studentLookupResults=out.items||[];
      host.innerHTML=V.studentLookupResults.length?V.studentLookupResults.map(s=>`<button type="button" onclick="selectBillStudentV55(${Number(s.id)})"><b>${esc(s.name)}</b><span>${esc(s.nis)} · ${esc(s.className||'-')}</span></button>`).join(''):'<small>Siswa tidak ditemukan.</small>';
    }catch(e){host.innerHTML='<small>Gagal mencari siswa.</small>'}},250);
  };
  window.selectBillStudentV55=function(id){
    const s=(V.studentLookupResults||[]).find(x=>Number(x.id)===Number(id));if(!s)return;
    const hidden=document.getElementById('crudBillStudent'),search=document.getElementById('billStudentSearchV55'),host=document.getElementById('billStudentResultsV55');
    if(hidden)hidden.value=s.id;if(search)search.value=s.name;if(host)host.innerHTML=`<div class="selected-student-v55"><b>${esc(s.name)}</b><span>${esc(s.nis)} · ${esc(s.className||'-')}</span></div>`;
  };

  const logoutBeforeSafe=window.logout;
  window.logout=async function(){V.initialized=false;V.__cacheTrimmed=false;V.studentLookupResults=[];return logoutBeforeSafe()};
  const loginBeforeSafe=window.login;
  window.login=async function(e){V.initialized=false;const out=await loginBeforeSafe(e);setTimeout(trimLegacyCacheV55,0);return out};

  let tries=0;const timer=setInterval(()=>{tries++;if(session&&['admin','finance'].includes(session.role)){clearInterval(timer);trimLegacyCacheV55()}else if(tries>30)clearInterval(timer)},100);
})();
