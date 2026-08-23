// EduPay V5.4 - Remove obsolete manual-sync UX after Admin became server-first.
(function(){
  window.syncStudentsServerV47=async function({silent=false}={}){
    if(session?.role!=='admin')return null;
    const out=typeof refreshAdminStateV53==='function'?await refreshAdminStateV53({silent,forceRender:true}):null;
    if(!silent&&out)toast('Data siswa sudah menggunakan PostgreSQL sebagai sumber utama');
    return out;
  };
  window.syncHomeroomsV46=async function({silent=false}={}){
    if(session?.role!=='admin')return null;
    const out=typeof refreshAdminStateV53==='function'?await refreshAdminStateV53({silent,forceRender:true}):null;
    if(!silent&&out)toast('Data wali kelas sudah menggunakan PostgreSQL sebagai sumber utama');
    return out;
  };

  const homeroomsBeforeV54=views.homerooms;
  if(typeof homeroomsBeforeV54==='function')views.homerooms=function(){
    let html=homeroomsBeforeV54();
    html=html.replace('<button class="btn btn-soft" onclick="syncHomeroomsV46()">↻ Sinkronkan</button>','');
    html=html.replace('Kelola dan sinkronkan wali kelas aktif dengan database pusat.','Kelola wali kelas. Tambah, edit, import, dan status tersimpan langsung di PostgreSQL.');
    html=html.replace(/<div class="homeroom-sync-strip-v46">[\s\S]*?<\/div>/,'<div class="homeroom-sync-strip-v46"><span><b>Server-first</b> · PostgreSQL menjadi sumber data utama</span></div>');
    return html;
  };

  // No operational page is allowed to navigate back to the retired migration screen.
  const goBeforeCleanupV54=window.go;
  window.go=function(p,filter=null){if(p==='migration')p='dashboard';return goBeforeCleanupV54(p,filter)};
  if(page==='migration')page='dashboard';
  render();
})();
