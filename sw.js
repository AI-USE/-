'use strict';

// This event is triggered when a push message is received.
self.addEventListener('push', (event) => {
    console.log('Push message received:', event);
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            console.error('Push event data is not valid JSON:', e);
            data = { type: 'unknown' };
        }
    }

    let title = 'New Activity';
    let options = {
        body: 'Check the app for updates.',
        icon: 'icon.png',
        badge: 'badge.png',
        data: data // Pass the data to the notification click event
    };

    if (data.type === 'new_message') {
        title = 'New Message';
        options.body = 'You have a new message waiting.';
    } else if (data.type === 'ice_restart') {
        title = 'Reconnecting...';
        options.body = 'Attempting to re-establish a secure connection.';
        // This notification might not even be shown, but handled in the background.
    } else if (data.type === 'ice_restart_answer') {
        title = 'Connection Update';
        options.body = 'Connection details received.';
    }

    // The service worker remains active until the notification is shown.
    event.waitUntil(self.registration.showNotification(title, options));
});

// This event is triggered when a user clicks on the notification.
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    const notificationData = event.notification.data;
    event.notification.close();

    const promiseChain = clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        const focusedClient = clientList.find(client => client.focused);
        const client = focusedClient || (clientList.length > 0 ? clientList[0] : null);

        if (client) {
            // If the app is already open, focus it and send a message
            client.focus();
            if (notificationData) {
                 if (notificationData.type === 'ice_restart') {
                    console.log('Sending ICE restart offer to client');
                    client.postMessage({ type: 'ice_restart_offer', payload: notificationData });
                } else if (notificationData.type === 'ice_restart_answer') {
                    console.log('Sending ICE restart answer to client');
                    client.postMessage({ type: 'ice_restart_answer', payload: notificationData });
                }
            }
        } else {
            // If the app is not open, open it.
            // The app's own startup logic should handle checking for unread messages.
            clients.openWindow('/');
        }
    });

    event.waitUntil(promiseChain);
});
