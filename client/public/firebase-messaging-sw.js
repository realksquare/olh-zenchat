importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyDuPbl1-IEdxnDctJgELm_VAQoSrLvWEM8",
    authDomain: "olh-zenchat.firebaseapp.com",
    projectId: "olh-zenchat",
    storageBucket: "olh-zenchat.firebasestorage.app",
    messagingSenderId: "598009129757",
    appId: "1:598009129757:web:5c20c07e1864c88778cff4"
};

try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(async (payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        
        // Aggregation logic
        const notifications = await self.registration.getNotifications();
        let count = 1;
        let title = payload.notification?.title || 'New Message';
        let body = payload.notification?.body || '';

        // If it's a view-once media, mask the content
        if (payload.data?.isViewOnce === "true") {
            body = "📷 Sent a view-once media";
        }

        const existingNotification = notifications.find(n => n.tag === 'zenchat-notif');
        if (existingNotification) {
            count = (existingNotification.data?.count || 1) + 1;
            title = 'ZenChat';
            body = `${count} new messages`;
            existingNotification.close();
        }

        const notificationOptions = {
            body: body,
            icon: '/favicon.svg',
            tag: 'zenchat-notif',
            renotify: true,
            data: {
                count: count,
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
