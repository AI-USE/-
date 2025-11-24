'use strict';

class PushManager {
    constructor() {
        this.subscription = null;
        this.swRegistration = null;
    }

    /**
     * Initializes the service worker and push manager.
     */
    async initialize() {
        if (!('serviceWorker' in navigator && 'PushManager' in window)) {
            console.warn('Push messaging is not supported');
            return;
        }
        this.swRegistration = await navigator.serviceWorker.ready;
        console.log('Service Worker is ready.');
    }

    /**
     * Subscribes the user to push notifications.
     * @param {string} applicationServerKey The VAPID public key.
     * @returns {Promise<PushSubscription>} The push subscription object.
     */
    async subscribeUser(applicationServerKey) {
        if (!this.swRegistration) {
            await this.initialize();
        }

        const applicationServerKeyUint8 = this.urlBase64ToUint8Array(applicationServerKey);
        try {
            this.subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKeyUint8
            });
            console.log('User is subscribed:', this.subscription);
            return this.subscription;
        } catch (err) {
            console.error('Failed to subscribe the user: ', err);
            // This can fail if the user denies permission.
            if (Notification.permission === 'denied') {
                console.warn('Permission for notifications was denied');
            }
        }
    }

    /**
     * Gets the current push subscription.
     */
    async getSubscription() {
        if (!this.swRegistration) {
            await this.initialize();
        }
        this.subscription = await this.swRegistration.pushManager.getSubscription();
        return this.subscription;
    }

    /**
     * Helper function to convert a VAPID key.
     */
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    /**
     * Sends a push notification to a given subscription.
     * @param {PushSubscription} subscription The subscription object of the recipient.
     * @param {object} payload The data to send.
     * @param {string} workerUrl The URL of the push serverless function.
     */
    async sendNotification(subscription, payload, workerUrl) {
        try {
            const response = await fetch(workerUrl, {
                method: 'POST',
                body: JSON.stringify({ subscription, payload }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`Push server returned status ${response.status}`);
            }
            console.log('Push notification sent successfully.');
        } catch (error) {
            console.error('Error sending push notification:', error);
        }
    }
}
