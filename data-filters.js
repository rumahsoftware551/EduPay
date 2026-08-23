// EduPay V4.5 - smart table filters, search, date range and pagination
(function(){
  const FILTERABLE_PAGES = {
    students:     {filters:['Kelas','Status'], search:'Cari NIS, nama siswa, wali, atau nomor HP...'},
    guardians:    {filters:['Status'], search:'Cari nama wali, username, atau siswa...'},
    classes:      {filters:['Tingkat','Tahun Ajaran','Status'], search:'Cari kelas atau wali kelas...'},
    homerooms:    {filters:['Kelas Diampu','Status'], search:'Cari NIP/NIK, nama guru, HP, atau email...'},
    fees:         {filters:['Periode','Status'], search:'Cari jenis pembayaran...'},
    bills:        {filters:['Status'], dateHeaders:['Jatuh Tempo'], search:'Cari siswa atau nama tagihan...'},
    payments:     {filters:['Metode','Status'], dateHeaders:['Tanggal'], search:'Cari kwitansi, siswa, atau metode...'},
    verification: {filters:['Metode'], search:'Cari siswa, tagihan, atau bukti pembayaran...'},
    reports:      {filters:['Status'], dateHeaders:['Tanggal','Jatuh Tempo'], search:'Cari data laporan...'},
    mybills:      {filters:['Status'], dateHeaders:['Jatuh Tempo'], search:'Cari tagihan...'},
    history:      {filters:['Metode'], dateHeaders:['Tanggal'], search:'Cari riwayat pembayaran...'}
  };

  const state = window.EDUPAY_TABLE_FILTERS = window.EDUPAY_TABLE_FILTERS || {};
  let mounting=false;

  function text(v){return String(v??'').replace(/\s+/g,' ').trim()}
  function norm(v){return text(v).toLocaleLowerCase('id-ID')}
  function escHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

  function currentPage(){
    try{return String(page||'')}catch(e){return ''}
  }

  function tableHeaders(table){
    const row=table.tHead?.rows?.[0];
    return row ? Array.from(row.cells).map(c=>text(c.textContent)) : [];
  }

  function findHeaderIndex(headers, wanted){
    const w=norm(wanted);
    return headers.findIndex(h=>{
      const n=norm(h);
      return n===w || n.includes(w) || w.includes(n);
    });
  }

  function cellText(row,index){
    if(index<0 || !row.cells[index])return '';
    return text(row.cells[index].textContent);
  }

  function parseDate(value){
    const s=text(value);
    if(!s)return null;
    let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
    m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
    const d=new Date(s);
    return Number.isNaN(d.getTime())?null:d;
  }

  function getRows(table){
    return table.tBodies?.[0] ? Array.from(table.tBodies[0].rows) : [];
  }

  function uniqueColumnValues(rows,index){
    if(index<0)return [];
    return [...new Set(rows.map(r=>cellText(r,index)).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'id',{numeric:true,sensitivity:'base'}));
  }

  function createOption(value,label){
    const o=document.createElement('option');
    o.value=value;o.textContent=label;return o;
  }

  function ensureState(key){
    return state[key]||(state[key]={q:'',selects:{},from:'',to:'',page:1,size:10});
  }

  function resetState(key){
    state[key]={q:'',selects:{},from:'',to:'',page:1,size:10};
  }

  function mountTable(table,config,tableIndex){
    if(!table || table.dataset.filterV45==='1')return;
    const rows=getRows(table);
    if(!rows.length)return;
    const headers=tableHeaders(table);
    if(!headers.length)return;

    const pg=currentPage();
    const key=`${pg}:${tableIndex}`;
    const s=ensureState(key);
    table.dataset.filterV45='1';

    const wrap=table.closest('.table-wrap');
    if(!wrap)return;
    const host=document.createElement('div');
    host.className='data-tools-v45';
    host.dataset.filterKey=key;

    const top=document.createElement('div');
    top.className='data-tools-main-v45';

    const searchWrap=document.createElement('label');
    searchWrap.className='data-search-v45';
    searchWrap.innerHTML='<span class="data-search-icon-v45">⌕</span>';
    const search=document.createElement('input');
    search.type='search'; search.className='field';
    search.placeholder=config.search||'Cari data...';
    search.value=s.q||'';
    search.setAttribute('aria-label','Cari data tabel');
    searchWrap.appendChild(search);
    top.appendChild(searchWrap);

    const filters=document.createElement('div');
    filters.className='data-filter-selects-v45';
    const selectMeta=[];
    (config.filters||[]).forEach(header=>{
      const idx=findHeaderIndex(headers,header);
      if(idx<0)return;
      const values=uniqueColumnValues(rows,idx);
      if(!values.length)return;
      const sel=document.createElement('select');
      sel.className='field data-select-v45';
      sel.setAttribute('aria-label',`Filter ${header}`);
      sel.appendChild(createOption('',`Semua ${header}`));
      values.forEach(v=>sel.appendChild(createOption(v,v)));
      sel.value=s.selects[header]||'';
      filters.appendChild(sel);
      selectMeta.push({header,index:idx,el:sel});
    });
    top.appendChild(filters);

    const dateHeaders=(config.dateHeaders||[]);
    let dateIndex=-1,dateHeader='';
    for(const h of dateHeaders){
      const idx=findHeaderIndex(headers,h);
      if(idx>=0){dateIndex=idx;dateHeader=h;break;}
    }
    let fromInput=null,toInput=null;
    if(dateIndex>=0){
      const dateWrap=document.createElement('div');
      dateWrap.className='data-date-range-v45';
      fromInput=document.createElement('input');
      fromInput.type='date';fromInput.className='field';fromInput.value=s.from||'';fromInput.title=`${dateHeader} mulai`;
      toInput=document.createElement('input');
      toInput.type='date';toInput.className='field';toInput.value=s.to||'';toInput.title=`${dateHeader} sampai`;
      dateWrap.append(fromInput,toInput);
      top.appendChild(dateWrap);
    }

    const reset=document.createElement('button');
    reset.type='button';reset.className='btn btn-ghost data-reset-v45';reset.textContent='Reset';
    top.appendChild(reset);

    const footer=document.createElement('div');
    footer.className='data-tools-footer-v45';
    const info=document.createElement('div');
    info.className='data-count-v45';
    const pager=document.createElement('div');
    pager.className='data-pagination-v45';
    const size=document.createElement('select');
    size.className='field data-size-v45';
    [10,25,50,100].forEach(n=>size.appendChild(createOption(String(n),`${n} / halaman`)));
    size.value=String(s.size||10);
    const prev=document.createElement('button');prev.type='button';prev.className='btn btn-ghost btn-sm';prev.textContent='‹';prev.title='Halaman sebelumnya';
    const pageInfo=document.createElement('span');pageInfo.className='data-page-info-v45';
    const next=document.createElement('button');next.type='button';next.className='btn btn-ghost btn-sm';next.textContent='›';next.title='Halaman berikutnya';
    pager.append(size,prev,pageInfo,next);
    footer.append(info,pager);
    host.append(top,footer);
    wrap.parentNode.insertBefore(host,wrap);

    function apply(){
      const query=norm(search.value);
      s.q=search.value;
      s.size=Number(size.value)||10;
      selectMeta.forEach(m=>s.selects[m.header]=m.el.value);
      s.from=fromInput?.value||'';s.to=toInput?.value||'';

      const from=s.from?new Date(`${s.from}T00:00:00`):null;
      const to=s.to?new Date(`${s.to}T23:59:59`):null;
      const matched=[];
      rows.forEach(row=>{
        let ok=!query || norm(row.textContent).includes(query);
        if(ok){
          for(const m of selectMeta){
            const selected=m.el.value;
            if(selected && cellText(row,m.index)!==selected){ok=false;break;}
          }
        }
        if(ok && dateIndex>=0 && (from||to)){
          const d=parseDate(cellText(row,dateIndex));
          if(!d || (from&&d<from) || (to&&d>to))ok=false;
        }
        if(ok)matched.push(row);
        row.style.display='none';
      });

      const total=matched.length;
      const pages=Math.max(1,Math.ceil(total/s.size));
      if(s.page>pages)s.page=pages;
      if(s.page<1)s.page=1;
      const start=(s.page-1)*s.size;
      const visible=matched.slice(start,start+s.size);
      visible.forEach(r=>r.style.display='');

      const shownStart=total?start+1:0;
      const shownEnd=Math.min(start+s.size,total);
      info.innerHTML=`Menampilkan <b>${shownStart}-${shownEnd}</b> dari <b>${total}</b> data`;
      pageInfo.textContent=`${s.page} / ${pages}`;
      prev.disabled=s.page<=1;next.disabled=s.page>=pages;
      host.classList.toggle('has-filter-v45',Boolean(query||Object.values(s.selects).some(Boolean)||s.from||s.to));
    }

    let timer=null;
    search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{s.page=1;apply()},120)});
    selectMeta.forEach(m=>m.el.addEventListener('change',()=>{s.page=1;apply()}));
    fromInput?.addEventListener('change',()=>{s.page=1;apply()});
    toInput?.addEventListener('change',()=>{s.page=1;apply()});
    size.addEventListener('change',()=>{s.page=1;apply()});
    prev.addEventListener('click',()=>{if(s.page>1){s.page--;apply();host.scrollIntoView({block:'nearest'})}});
    next.addEventListener('click',()=>{s.page++;apply();host.scrollIntoView({block:'nearest'})});
    reset.addEventListener('click',()=>{
      resetState(key);
      search.value='';selectMeta.forEach(m=>m.el.value='');if(fromInput)fromInput.value='';if(toInput)toInput.value='';size.value='10';
      Object.assign(s,state[key]);
      apply();
    });
    apply();
  }

  function mount(){
    if(mounting)return;
    mounting=true;
    try{
      const pg=currentPage();
      const config=FILTERABLE_PAGES[pg];
      if(!config)return;
      const tables=Array.from(document.querySelectorAll('.main .table-wrap table.table'));
      tables.forEach((table,i)=>mountTable(table,config,i));
    }finally{mounting=false;}
  }

  // Render is called throughout EduPay. Wrap it once so filters survive every CRUD/server refresh.
  if(typeof render==='function' && !window.EDUPAY_RENDER_FILTER_WRAPPED){
    const baseRender=render;
    render=function(...args){
      const out=baseRender.apply(this,args);
      queueMicrotask(mount);
      return out;
    };
    window.EDUPAY_RENDER_FILTER_WRAPPED=true;
  }

  // Async server updates can replace content outside a direct user navigation.
  const observer=new MutationObserver(()=>queueMicrotask(mount));
  const root=document.getElementById('app');
  if(root)observer.observe(root,{childList:true,subtree:true});
  queueMicrotask(mount);
})();
