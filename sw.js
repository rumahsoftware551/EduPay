const CACHE='edupay-professional-v3.5';
const ASSETS=['./','./index.html','./style.css?v=3.5','./enhancements.css?v=3.5','./admin-crud.css?v=3.5','./excel-import.css?v=3.5','./class-homeroom.css?v=3.5','./app.js?v=3.5','./enhancements.js?v=3.5','./admin-crud.js?v=3.5','./excel-import.js?v=3.5','./class-homeroom.js?v=3.5','./assets/edupay-logo.svg?v=3.2','./manifest.json?v=3.5'];
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
