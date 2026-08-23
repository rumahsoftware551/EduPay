// EduPay V4.3 - mobile shell improvements
const logoutIconV43='<span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg></span>';

shell=function(content){
  const items=nav();
  const pending=db.bills.filter(x=>x.status==='pending').length;
  const mobileItems=items.slice(0,4);
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand">${edupayLogo}<div><strong>EduPay</strong><span>School Finance</span></div></div>
      <div class="nav-title">Menu Utama</div>
      <div class="nav-list">${items.map(([p,l])=>`<button class="nav-btn ${page===p?'active':''}" onclick="go('${p}')">${navIcon(p)}<span>${l}</span>${p==='verification'&&pending?`<em>${pending}</em>`:''}</button>`).join('')}</div>
      <div class="sidebar-help"><div class="help-icon">?</div><div><b>Butuh bantuan?</b><small>Hubungi admin sekolah jika ada kendala pembayaran.</small></div></div>
      <button class="sidebar-user" onclick="logout()"><div class="avatar">${esc(session.name[0])}</div><div><b>${esc(session.name)}</b><span>${role()}</span></div><span>↪</span></button>
    </aside>
    <div class="content-shell">
      <header class="topbar"><div><div class="eyebrow">EduPay · ${role()}</div><div class="top-title">${items.find(x=>x[0]===page)?.[1]||'Dashboard'}</div></div><div class="top-actions"><button class="icon-btn">🔔${pending?'<span class="notification-dot"></span>':''}</button><div class="top-user"><div class="avatar">${esc(session.name[0])}</div><div class="name"><b>${esc(session.name)}</b><span>${role()}</span></div></div></div></header>
      <main class="main">${content}</main>
    </div>
    <nav class="mobile-nav" aria-label="Navigasi mobile">
      ${mobileItems.map(([p,l])=>`<button class="${page===p?'active':''}" onclick="go('${p}')">${navIcon(p)}<span>${l}</span></button>`).join('')}
      <button class="mobile-logout-btn" onclick="logout()" aria-label="Logout">${logoutIconV43}<span>Logout</span></button>
    </nav>
  </div>`;
};

render();
