// ZenChat Service Worker v1.5 - Notifications + Cache Control
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

importScripts('https://unpkg.com/dexie@4.0.8/dist/dexie.js');

const CACHE_NAME = 'zenchat-v2.0';

const firebaseConfig = {
    apiKey: "AIzaSyDuPbl1-IEdxnDctJgELm_VAQoSrLvWEM8",
    authDomain: "olh-zenchat.firebaseapp.com",
    projectId: "olh-zenchat",
    storageBucket: "olh-zenchat.firebasestorage.app",
    messagingSenderId: "598009129757",
    appId: "1:598009129757:web:5c20c07e1864c88778cff4"
};

const db = new Dexie("ZenChatDB");
db.version(2).stores({
    chats: "_id, updatedAt, lastMessage._id",
    messages: "_id, chatId, createdAt, senderId",
    settings: "key",
});
db.version(3).stores({
    chats: "_id, updatedAt, lastMessage._id",
    messages: "_id, chatId, createdAt, senderId",
    settings: "key",
    outbox: "++id, chatId, createdAt",
});

try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(async (payload) => {
        const messageId = payload.data?.messageId;
        if (messageId) {
            try {
                const tokenObj = await db.settings.get("token");
                if (tokenObj?.value) {
                    const apiUrlObj = await db.settings.get("apiUrl");
                    const rawUrl = apiUrlObj?.value || "";
                    const baseUrl = rawUrl.replace(/\/$/, "");
                    
                    fetch(`${baseUrl}/api/messages/${messageId}/delivered`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${tokenObj.value}`,
                            'Content-Type': 'application/json'
                        }
                    }).catch(e => console.log("[SW] Delivery ping failed", e));
                }
            } catch (err) {
                console.log("[SW] Error accessing IDB", err);
            }
        }

        let title = payload.notification?.title || 'New Message';
        let body = payload.notification?.body || '';

        if (payload.data?.isViewOnce === "true") {
            body = "Image - Sent a view-once media";
        }

        const notificationOptions = {
            body: body,
            icon: '/favicon.svg',
            badge: '/favicon.svg',
            tag: 'zenchat-notif',
            renotify: true,
            silent: false,
            data: {
                url: payload.fcmOptions?.link || payload.data?.url || '/'
            }
        };

        return self.registration.showNotification(title, notificationOptions);
    });
} catch (e) {
    console.log(e);
}


const SHELL_URLS = ['/', '/manifest.json', '/favicon.svg'];

// Pre-cache app shell on install for instant first paint
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) client = clientList[i];
                }
                return client.focus();
            }
            return clients.openWindow(event.notification.data?.url || '/');
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CLEAR_NOTIFICATIONS') {
        self.registration.getNotifications().then((notifications) => {
            notifications.forEach((n) => n.close());
        });
    }
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Activate: wipe old caches, claim clients immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);

    // Never intercept API or socket calls
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;
    // Never intercept cross-origin requests (Firebase, Cloudinary, etc.)
    if (url.origin !== self.location.origin) return;

    const isNavigation = event.request.mode === 'navigate';
    const isStaticAsset = url.pathname.startsWith('/assets/') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.woff2') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.webp');

    if (isStaticAsset) {
        // Cache-First: static assets are content-hashed, safe to serve instantly from cache
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => new Response('', { status: 503 }));
            })
        );
        return;
    }

    // Network-First for navigation + other same-origin requests, fall back to cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.status === 200 && isNavigation) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request).then((res) => res || caches.match('/') || new Response('Offline', { status: 503 })))
    );
});
