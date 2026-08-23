const CACHE='edupay-professional-v4.8';
const ASSETS=['./','./index.html','./style.css?v=4.8','./enhancements.css?v=4.8','./admin-crud.css?v=4.8','./excel-import.css?v=4.8','./class-homeroom.css?v=4.8','./guardian-accounts.css?v=4.8','./mobile-ui.css?v=4.8','./realtime-parent.css?v=4.8','./data-filters.css?v=4.8','./homeroom-sync.css?v=4.8','./migration-v48.css?v=4.8','./app.js?v=4.8','./enhancements.js?v=4.8','./admin-crud.js?v=4.8','./excel-import.js?v=4.8','./class-homeroom.js?v=4.8','./guardian-accounts.js?v=4.8','./api-auth.js?v=4.8','./setup-v41.js?v=4.8','./mobile-ui.js?v=4.8','./realtime-parent.js?v=4.8','./data-filters.js?v=4.8','./homeroom-sync.js?v=4.8','./guardian-sync-v47.js?v=4.8','./migration-v48.js?v=4.8','./assets/edupay-logo.svg?v=3.2','./manifest.json?v=4.8'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),
  self.clients.claim()
])));
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.url.includes('/api/')){e.respondWith(fetch(req,{cache:'no-store'}));return;}
  if(req.mode==='navigate'){
    e.respondWith(fetch(req,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return r}).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(fetch(req,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy));return r}).catch(()=>caches.match(req)));
});
