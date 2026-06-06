// ZenChat Service Worker v1.5 - Notifications + Cache Control
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

importScripts('https://unpkg.com/dexie@4.0.8/dist/dexie.js');

const CACHE_NAME = 'zenchat-v2.2';

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
db.version(4).stores({
    chats: "_id, updatedAt, lastMessage._id",
    messages: "_id, chatId, createdAt, senderId",
    settings: "key",
    outbox: "++id, chatId, createdAt",
    keys: "key",
});
db.version(5).stores({
    chats: "_id, updatedAt, lastMessage._id",
    messages: "_id, chatId, createdAt, senderId",
    settings: "key",
    outbox: "++id, chatId, createdAt",
    keys: "key",
    vault: "id, name, type, size, date",
});
db.version(6).stores({
    chats: "_id, updatedAt, lastMessage._id",
    messages: "_id, chatId, createdAt, senderId",
    settings: "key",
    outbox: "++id, chatId, createdAt",
    keys: "key",
    vault: "id, name, type, size, date",
    pendingMediaOutbox: "++id, chatId, createdAt",
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

        let newTitle = payload.data?.title || payload.notification?.title || 'New Message';
        let newBody = payload.data?.body || payload.notification?.body || '';

        if (payload.data?.isViewOnce === "true") {
            newBody = "Image - Sent a view-once media";
        }

        const notifications = await self.registration.getNotifications({ tag: 'zenchat-notif' });
        
        if (notifications.length > 0) {
            let senders = new Set([newTitle]);
            let existingBodies = [];
            let totalMessages = 1;
            
            notifications.forEach(n => {
                if (n.data?.senderName) {
                    senders.add(n.data.senderName);
                } else if (n.title !== 'ZenChat') {
                    senders.add(n.title);
                }
                
                if (n.data?.messages) {
                    existingBodies = existingBodies.concat(n.data.messages);
                } else if (n.title !== 'ZenChat') {
                    existingBodies.push(n.body);
                }
                
                totalMessages += (n.data?.msgCount || 1);
                n.close();
            });

            existingBodies.push(newBody);
            
            let finalTitle, finalBody;
            if (senders.size === 1) {
                finalTitle = Array.from(senders)[0];
                finalBody = existingBodies.slice(-4).join('\n');
            } else {
                finalTitle = 'ZenChat';
                finalBody = `${totalMessages} new messages from ${senders.size} chats`;
            }
            
            return self.registration.showNotification(finalTitle, {
                body: finalBody,
                icon: '/logo192.png',
                badge: '/logo192.png',
                tag: 'zenchat-notif',
                renotify: true,
                silent: false,
                data: {
                    url: '/',
                    senderName: senders.size === 1 ? finalTitle : null,
                    messages: senders.size === 1 ? existingBodies : [],
                    msgCount: totalMessages
                }
            });
        }

        const notificationOptions = {
            body: newBody,
            icon: '/logo192.png',
            badge: '/logo192.png',
            tag: 'zenchat-notif',
            renotify: true,
            silent: false,
            data: {
                url: payload.fcmOptions?.link || payload.data?.url || '/',
                senderName: newTitle,
                messages: [newBody],
                msgCount: 1
            }
        };

        return self.registration.showNotification(newTitle, notificationOptions);
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

    // Extract chatId from notification data (set for text message notifications)
    const chatId = event.notification.data?.chatId || event.notification.data?.url?.split('chatId=')[1]?.split('&')[0];
    const targetUrl = chatId
        ? `/?chatId=${encodeURIComponent(chatId)}&focus=1`
        : (event.notification.data?.url || '/');

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                // Find a focused client, otherwise pick the first one
                const client = clientList.find(c => c.focused) || clientList[0];
                // Post message so the running app can navigate to the correct chat
                if (chatId) {
                    client.postMessage({ type: 'OPEN_CHAT', chatId });
                }
                return client.focus();
            }
            // App not open — open a new window with chatId in URL
            return clients.openWindow(targetUrl);
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

// PWA Background Sync API Handler
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-zenchat-messages') {
        event.waitUntil(flushOutboxInBackground());
    }
});

async function flushOutboxInBackground() {
    try {
        const queued = await db.outbox.orderBy("createdAt").toArray();
        if (!queued || queued.length === 0) return;

        const tokenObj = await db.settings.get("token");
        const apiUrlObj = await db.settings.get("apiUrl");
        
        if (!tokenObj?.value) return;
        
        const rawUrl = apiUrlObj?.value || "";
        const baseUrl = rawUrl.replace(/\/$/, "");

        const response = await fetch(`${baseUrl}/api/chats/offline-sync`, {
            method: 'POST',
            body: JSON.stringify({ messages: queued }),
            headers: {
                'Authorization': `Bearer ${tokenObj.value}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            console.log("[SW] Background sync completed successfully!");
            await db.outbox.clear();
        } else {
            console.error("[SW] Background sync response not OK:", response.status);
        }
    } catch (err) {
        console.error("[SW] Background sync failed:", err);
    }
}
