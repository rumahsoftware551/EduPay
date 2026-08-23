// EduPay V4.9 - PostgreSQL operational snapshot for Admin + Finance.
// LocalStorage remains only as a compatibility/offline cache during the transition.
(function(){
  window.EDUPAY_V49={loading:false,syncing:false,lastPull:null,lastPush:null,error:null,timer:null,ready:false,canonical:{}};

  function localOperationalCountV49(){return ['classes','students','feeTypes','bills','payments'].reduce((n,k)=>n+(Array.isArray(db[k])?db[k].length:0),0)}
  function serverOperationalCountV49(out){const c=out?.counts||{};return Number(c.classes||0)+Number(c.students||0)+Number(c.feeTypes||0)+Number(c.bills||0)+Number(c.payments||0)}
  function stateSignatureV49(){return JSON.stringify({classes:(db.classes||[]).map(x=>[x.id,x.name,x.active,x.homeroomTeacherId]),students:(db.students||[]).map(x=>[x.id,x.nis,x.name,x.classId,x.parent,x.phone,x.active]),fees:(db.feeTypes||[]).map(x=>[x.id,x.name,x.amount,x.period,x.active]),bills:(db.bills||[]).map(x=>[x.id,x.studentId,x.title,x.amount,x.due,x.status,x.paymentMethod,x.proofName]),payments:(db.payments||[]).map(x=>[x.id,x.billId,x.studentId,x.amount,x.method,x.date,x.receipt,x.voided])})}
  function mergeFinanceStudentCacheV49(bills){const map=new Map((db.students||[]).map(s=>[Number(s.id),s]));(bills||[]).forEach(b=>{const id=Number(b.studentId);if(!Number.isFinite(id))return;const old=map.get(id)||{id,nis:'',classId:null,parent:'',phone:'',active:true};old.name=b.studentName||old.name||`Siswa #${id}`;map.set(id,old)});db.students=[...map.values()]}

  function rowSigV49(type,x){
    const sig={
      classes:[x.id,x.name,x.level||'',x.academicYear||'',x.active!==false,x.homeroomTeacherId||null],
      homeroomTeachers:[x.id,x.nip||'',x.name,x.phone||'',x.email||'',x.active!==false],
      students:[x.id,x.nis,x.name,x.classId||null,x.parent||'',x.phone||'',x.active!==false],
      feeTypes:[x.id,x.name,Number(x.amount||0),x.period||'',x.active!==false],
      bills:[x.id,x.studentId,x.title,Number(x.amount||0),x.due||null,x.status,x.paymentMethod||null,x.proofName||null],
      payments:[x.id,x.billId,x.studentId,Number(x.amount||0),x.method,x.date||null,x.receipt,x.voided===true,x.voidedAt||null]
    }[type]||[x.id];
    return JSON.stringify(sig);
  }
  function snapshotCanonicalV49(){
    window.EDUPAY_V49.canonical={
      classes:(db.classes||[]).map(x=>({...x})),homeroomTeachers:(db.homeroomTeachers||[]).map(x=>({...x})),students:(db.students||[]).map(x=>({...x})),feeTypes:(db.feeTypes||[]).map(x=>({...x})),bills:(db.bills||[]).map(x=>({...x})),payments:(db.payments||[]).map(x=>({...x}))
    };
  }
  function diffRowsV49(type,current){
    const old=window.EDUPAY_V49.canonical?.[type]||[];
    const map=new Map(old.map(x=>[String(x.id),x]));
    return (current||[]).filter(x=>{const before=map.get(String(x.id));return !before||rowSigV49(type,x)!==rowSigV49(type,before)}).map(x=>({...x}));
  }

  function applyServerStateV49(out){
    if(!out?.ok)return false;const before=stateSignatureV49();
    if(session?.role==='admin'){if(Array.isArray(out.classes))db.classes=out.classes;if(Array.isArray(out.homeroomTeachers))db.homeroomTeachers=out.homeroomTeachers;if(Array.isArray(out.students))db.students=out.students;if(Array.isArray(out.feeTypes))db.feeTypes=out.feeTypes;}
    if(Array.isArray(out.bills)){db.bills=out.bills;mergeFinanceStudentCacheV49(out.bills)}
    if(Array.isArray(out.payments))db.payments=out.payments;
    save();snapshotCanonicalV49();return before!==stateSignatureV49();
  }

  window.refreshServerStateV49=async function({silent=true,forceRender=true}={}){
    if(!session||!['admin','finance'].includes(session.role)||window.EDUPAY_V49.loading||window.EDUPAY_V49.syncing)return null;
    window.EDUPAY_V49.loading=true;
    try{
      const out=await apiV40('/api/v49/state');
      if(serverOperationalCountV49(out)===0&&localOperationalCountV49()>0){window.EDUPAY_V49.ready=false;window.EDUPAY_V49.error='VPS masih kosong. Jalankan Migrasi Data terlebih dahulu.';if(!silent)toast(window.EDUPAY_V49.error);return out;}
      const changed=applyServerStateV49(out);window.EDUPAY_V49.lastPull=new Date();window.EDUPAY_V49.error=null;window.EDUPAY_V49.ready=true;if(forceRender&&changed)render();return out;
    }catch(err){window.EDUPAY_V49.ready=false;window.EDUPAY_V49.error=err.message||'Gagal mengambil data VPS';if(!silent)toast(window.EDUPAY_V49.error);return null}
    finally{window.EDUPAY_V49.loading=false}
  };

  function payloadV49(){
    return {
      classes:session?.role==='admin'?diffRowsV49('classes',db.classes):[],
      homeroomTeachers:session?.role==='admin'?diffRowsV49('homeroomTeachers',db.homeroomTeachers):[],
      students:session?.role==='admin'?diffRowsV49('students',db.students):[],
      feeTypes:session?.role==='admin'?diffRowsV49('feeTypes',db.feeTypes):[],
      bills:diffRowsV49('bills',db.bills),
      payments:diffRowsV49('payments',db.payments)
    };
  }
  function payloadCountV49(body){return Object.values(body).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0)}

  window.syncAllServerV49=async function({silent=false,refresh=true}={}){
    if(!session||!['admin','finance'].includes(session.role)||window.EDUPAY_V49.syncing)return null;
    if(!window.EDUPAY_V49.ready){await refreshServerStateV49({silent:true,forceRender:true});if(!window.EDUPAY_V49.ready){const msg=window.EDUPAY_V49.error||'Snapshot VPS belum siap. Sinkronisasi dibatalkan.';if(!silent)toast(msg);return null;}}
    const body=payloadV49();
    if(payloadCountV49(body)===0){if(refresh)await refreshServerStateV49({silent:true,forceRender:true});return {ok:true,noChanges:true,counts:{}};}
    window.EDUPAY_V49.syncing=true;window.EDUPAY_V49.error=null;
    try{
      const out=await apiV40('/api/v49/sync-all',{method:'POST',body});window.EDUPAY_V49.lastPush=new Date();window.EDUPAY_V49.syncing=false;if(refresh)await refreshServerStateV49({silent:true,forceRender:false});if(!silent)toast('Perubahan tersimpan dan tersinkron ke VPS');render();return out;
    }catch(err){window.EDUPAY_V49.error=err.message||'Sinkronisasi VPS gagal';toast(`PERINGATAN: ${window.EDUPAY_V49.error}`);return null}
    finally{window.EDUPAY_V49.syncing=false}
  };

  // V4.4 schedules a sync shortly after login. Before a canonical server snapshot exists it MUST pull, never push.
  window.syncOperationalV44=async function({silent=true}={}){if(!window.EDUPAY_V49.ready)return refreshServerStateV49({silent,forceRender:true});return syncAllServerV49({silent,refresh:true})};
  window.syncStudentsServerV47=async function({silent=false}={}){const out=window.EDUPAY_V49.ready?await syncAllServerV49({silent,refresh:true}):await refreshServerStateV49({silent,forceRender:true});return out?{students:db.students.length,missingGuardian:db.students.filter(s=>s.active!==false&&(!s.parent||!s.phone)).length}:null};
  window.syncHomeroomsV46=async function({silent=false}={}){if(!window.EDUPAY_V49.ready)return refreshServerStateV49({silent,forceRender:true});return syncAllServerV49({silent,refresh:true})};

  window.syncGuardianAccountsV36=async function(showToast=false){
    try{const pushed=await syncAllServerV49({silent:true,refresh:false});if(!pushed)throw new Error(window.EDUPAY_V49.error||'Gagal menyimpan master siswa');const out=await apiV40('/api/admin/guardians/sync',{method:'POST'});if(typeof refreshGuardiansV44==='function')await refreshGuardiansV44({silent:true});if(showToast)toast(`Sinkron akun wali selesai: ${out.created||0} baru, ${out.linked||0} relasi`);return out}
    catch(err){if(showToast)toast(err.message||'Sinkron akun wali gagal');return null}
  };

  // Previous modules already wrap students/classes/bills/payments. Fee type was the important missing sync.
  function wrapMutationV49(name){const old=window[name];if(typeof old!=='function'||old.__v49wrapped)return;const wrapped=function(...args){const result=old.apply(this,args);Promise.resolve(result).then(()=>setTimeout(()=>syncAllServerV49({silent:true,refresh:true}),40)).catch(err=>toast(err.message||'Operasi gagal'));return result};wrapped.__v49wrapped=true;window[name]=wrapped}
  ['saveFeeV33','toggleFeeV33'].forEach(wrapMutationV49);

  function syncIndicatorV49(){if(!session||!['admin','finance'].includes(session.role))return '';const s=window.EDUPAY_V49;if(s.syncing||s.loading)return '<div class="server-sync-v49 syncing"><i></i><span>Menyinkronkan…</span></div>';if(s.error)return `<button class="server-sync-v49 error" onclick="refreshServerStateV49({silent:false})" title="${esc(s.error)}"><i></i><span>Gagal sinkron</span></button>`;if(s.ready)return `<button class="server-sync-v49 ok" onclick="refreshServerStateV49({silent:false})" title="Klik untuk refresh dari VPS"><i></i><span>VPS tersinkron</span></button>`;return '<div class="server-sync-v49"><i></i><span>Memuat VPS…</span></div>'}
  const shellBeforeV49=shell;shell=function(content){let html=shellBeforeV49(content);const indicator=syncIndicatorV49();if(indicator)html=html.replace('<div class="top-actions">','<div class="top-actions">'+indicator);return html};

  function startServerPollingV49(){if(window.EDUPAY_V49.timer){clearInterval(window.EDUPAY_V49.timer);window.EDUPAY_V49.timer=null}if(!session||!['admin','finance'].includes(session.role))return;refreshServerStateV49({silent:true});window.EDUPAY_V49.timer=setInterval(()=>{if(!document.hidden&&session&&['admin','finance'].includes(session.role))refreshServerStateV49({silent:true})},15000)}
  const loginBeforeV49=login;login=async function(e){await loginBeforeV49(e);if(session&&['admin','finance'].includes(session.role)){await refreshServerStateV49({silent:false});startServerPollingV49()}};
  const logoutBeforeV49=logout;logout=async function(){if(window.EDUPAY_V49.timer){clearInterval(window.EDUPAY_V49.timer);window.EDUPAY_V49.timer=null}window.EDUPAY_V49.ready=false;window.EDUPAY_V49.canonical={};return logoutBeforeV49()};

  window.addEventListener('focus',()=>{if(session&&['admin','finance'].includes(session.role))refreshServerStateV49({silent:true})});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session&&['admin','finance'].includes(session.role))refreshServerStateV49({silent:true})});
  if(session&&['admin','finance'].includes(session.role))startServerPollingV49();render();
})();
