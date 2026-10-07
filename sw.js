// Service worker mínimo de Kobu.
// Objetivo: cumplir el requisito técnico de Android/Chrome para que la PWA
// se instale como app real (sin la barra de dirección visible), y dar un
// respaldo offline básico. No cachea agresivamente: siempre intenta traer
// la versión más nueva de la red primero, para no tapar las actualizaciones
// que ya maneja el aviso de "nueva versión" de Kobu.
const CACHE_NAME = 'kobu-shell-v1';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(APP_SHELL).catch(function(){ /* algún archivo puede no existir, no pasa nada */ });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function(res){
      if(res && res.status === 200){
        const clone = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(e.request, clone); });
      }
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(cached){
        return cached || caches.match('./index.html');
      });
    })
  );
});

// Notificaciones push (Firebase Cloud Messaging).
// El Apps Script manda payloads "solo datos" (sin campo notification), así
// este handler tiene control total sobre cómo se arma y se ve la notificación,
// y evita el problema de notificaciones duplicadas.
self.addEventListener('push', function(e){
  let payload = {};
  try{ payload = e.data ? e.data.json() : {}; }catch(err){ payload = {}; }
  const data = payload.data || payload || {};
  const title = data.title || 'Kobu';
  const body = data.body || '';
  const screen = data.screen || 'home';
  e.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: { screen: screen }
    })
  );
});

self.addEventListener('notificationclick', function(e){
  const isCookTimer = e.notification.data && e.notification.data.type==='cook-timer';
  if(isCookTimer && (e.action==='cook-pause' || e.action==='cook-resume' || e.action==='cook-stop')){
    // Pausar/reanudar mantienen la notificación (se actualiza sola desde la app);
    // detener sí la cierra ahora mismo.
    if(e.action==='cook-stop') e.notification.close();
    e.waitUntil(
      self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(clientsArr){
        for(let i=0;i<clientsArr.length;i++){
          const c = clientsArr[i];
          c.postMessage({ type:'kobu-cook-timer-action', action: e.action });
        }
        if(!clientsArr.length && self.clients.openWindow){
          return self.clients.openWindow('./index.html?goto=home');
        }
      })
    );
    return;
  }
  e.notification.close();
  const screen = (e.notification.data && e.notification.data.screen) || 'home';
  e.waitUntil(
    self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(clientsArr){
      for(let i=0;i<clientsArr.length;i++){
        const c = clientsArr[i];
        if('focus' in c){
          c.postMessage({ type:'kobu-notification-nav', screen: screen });
          return c.focus();
        }
      }
      if(self.clients.openWindow){
        return self.clients.openWindow('./index.html?goto='+encodeURIComponent(screen));
      }
    })
  );
});
