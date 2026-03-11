self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: 'New Complaint', body: 'New task assigned to you!' };

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/KAK/icon-192.png',
            badge: '/KAK/icon-192.png',
            vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40],
            data: {
                url: '/KAK/supervisor'
            }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
