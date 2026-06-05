importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDDhsNp4JjWFlxIt1mTGnaG5jp4DG2iKCA",
  authDomain: "srijana-ganesh-chat.firebaseapp.com",
  projectId: "srijana-ganesh-chat",
  storageBucket: "srijana-ganesh-chat.firebasestorage.app",
  messagingSenderId: "129095462200",
  appId: "1:129095462200:web:52101681f15086651e65cd",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Hello Babe 💗';
  const body  = payload.notification?.body  || 'You have a new message';
  self.registration.showNotification(title, {
    body,
    icon:    '/logo192.png',
    badge:   '/logo192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag:     'hello-babe-message',
    renotify: true,
    data:    payload.data || {},
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});