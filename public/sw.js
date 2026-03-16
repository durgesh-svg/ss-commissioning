// SS Commissioning Service Worker
const CACHE_NAME = 'ss-commissioning-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip Supabase API calls — always go network
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request))
    return
  }

  // Network-first for navigation (HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(resp => {
          const clone = resp.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          return resp
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return resp
      })
    })
  )
})
