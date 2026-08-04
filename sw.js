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
