// ZenChat Service Worker v1.3 - Simple Notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

importScripts('https://unpkg.com/dexie@latest/dist/dexie.js');

const firebaseConfig = {
    apiKey: "AIzaSyDuPbl1-IEdxnDctJgELm_VAQoSrLvWEM8",
    authDomain: "olh-zenchat.firebaseapp.com",
    projectId: "olh-zenchat",
    storageBucket: "olh-zenchat.firebasestorage.app",
    messagingSenderId: "598009129757",
    appId: "1:598009129757:web:5c20c07e1864c88778cff4"
};

const db = new Dexie("ZenChatDB");
db.version(1).stores({ settings: "key" });

try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(async (payload) => {
        // Delivery Receipt Logic
        const messageId = payload.data?.messageId;
        if (messageId) {
            try {
                const tokenObj = await db.settings.get("token");
                const apiUrlObj = await db.settings.get("apiUrl");
                if (tokenObj?.value && apiUrlObj?.value) {
                    const baseUrl = apiUrlObj.value.replace(/\/$/, "");
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

        // Mask view-once media content
        if (payload.data?.isViewOnce === "true") {
            body = "Image - Sent a view-once media";
        }

        // Simple notification display
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

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            return clients.openWindow(event.notification.data?.url || '/');
        })
    );
});

// Clear notifications when the app is opened/focused
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CLEAR_NOTIFICATIONS') {
        self.registration.getNotifications().then((notifications) => {
            notifications.forEach((notification) => notification.close());
        });
    }
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        fetch(event.request).catch(function() {
            return new Response('You are offline.');
        })
    );
});
