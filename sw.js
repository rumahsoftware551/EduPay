const CACHE='edupay-professional-v3.6';
const ASSETS=['./','./index.html','./style.css?v=3.6','./enhancements.css?v=3.6','./admin-crud.css?v=3.6','./excel-import.css?v=3.6','./class-homeroom.css?v=3.6','./guardian-accounts.css?v=3.6','./app.js?v=3.6','./enhancements.js?v=3.6','./admin-crud.js?v=3.6','./excel-import.js?v=3.6','./class-homeroom.js?v=3.6','./guardian-accounts.js?v=3.6','./assets/edupay-logo.svg?v=3.2','./manifest.json?v=3.6'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),
  self.clients.claim()
])));
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.mode==='navigate'){
    e.respondWith(fetch(req,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return r}).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(fetch(req,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy));return r}).catch(()=>caches.match(req)));
});
