// EduPay V5.8 - mobile payment/billing history without horizontal swiping.
(function(){
  const ROLE_PAGES={
    admin:new Set(['dashboard','bills','reports']),
    finance:new Set(['dashboard','payments','verification','reports']),
    parent:new Set(['dashboard','mybills','history'])
  };

  function currentPageIsPaymentRelatedV58(){
    if(!session?.role)return false;
    return ROLE_PAGES[session.role]?.has(page)===true;
  }

  function normalizeLabelV58(value){
    return String(value||'Detail').replace(/\s+/g,' ').trim()||'Detail';
  }

  window.enhancePaymentTablesV58=function(){
    if(!currentPageIsPaymentRelatedV58())return;
    const root=document.querySelector('.main');
    if(!root)return;

    root.querySelectorAll('.table-wrap').forEach(wrap=>{
      const table=wrap.querySelector('table.table');
      if(!table)return;
      const headers=Array.from(table.querySelectorAll('thead th')).map(th=>normalizeLabelV58(th.textContent));
      if(!headers.length)return;

      wrap.classList.add('mobile-payment-table');
      table.querySelectorAll('tbody tr').forEach(row=>{
        Array.from(row.children).forEach((cell,index)=>{
          if(cell.tagName!=='TD')return;
          cell.dataset.label=headers[index]||'Detail';
        });
      });
    });
  };

  const renderBeforeV58=window.render;
  if(typeof renderBeforeV58==='function'){
    window.render=function(){
      const out=renderBeforeV58.apply(this,arguments);
      requestAnimationFrame(()=>window.enhancePaymentTablesV58());
      return out;
    };
  }

  window.addEventListener('resize',()=>window.enhancePaymentTablesV58(),{passive:true});
  requestAnimationFrame(()=>window.enhancePaymentTablesV58());
})();
