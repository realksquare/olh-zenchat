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

    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        const notificationTitle = payload.notification?.title || 'New Message';
        const notificationOptions = {
            body: payload.notification?.body,
            icon: '/favicon.svg'
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
} catch (e) {
    console.log(e);
}

self.addEventListener('fetch', function(event) {
    // Basic pass-through fetch handler to satisfy PWA requirements
    event.respondWith(
        fetch(event.request).catch(function() {
            return new Response('You are offline.');
        })
    );
});
