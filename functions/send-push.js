// Note: This is a more complete implementation for a Cloudflare Worker.
// It assumes you are using a tool like Wrangler to manage secrets (VAPID keys).
// It also conceptually uses the web-push library's logic.
// For a real deployment, you would bundle a proper web-push library.

import webpush from 'web-push';

export default {
    async fetch(request, env) {
        // CORS headers
        const headers = new Headers({
            'Access-Control-Allow-Origin': '*', // Be more specific in production
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers });
        }
        
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405, headers });
        }

        try {
            const { subscription, payload } = await request.json();

            if (!subscription || !subscription.endpoint) {
                return new Response('Invalid subscription object', { status: 400, headers });
            }

            // VAPID keys should be stored as secrets in the Worker's environment
            const vapidDetails = {
                subject: 'mailto:your-email@example.com', // Replace with your email
                publicKey: env.VAPID_PUBLIC_KEY,
                privateKey: env.VAPID_PRIVATE_KEY,
            };

            const options = {
                vapidDetails,
                TTL: 60 * 60 * 24 // 1 day in seconds
            };
            
            // The web-push library's sendNotification function
            // This would be replaced by the actual library call
            await webpush.sendNotification(
                subscription,
                JSON.stringify(payload),
                options
            );
            
            headers.set('Content-Type', 'application/json');
            return new Response(JSON.stringify({ message: 'Push sent successfully' }), { status: 200, headers });

        } catch (error) {
            console.error('Error sending push notification:', error);
            // Distinguish between client errors and server errors
            if (error.statusCode) { // Error from the push service
                 return new Response(JSON.stringify({ error: `Push service error: ${error.body}` }), { status: error.statusCode, headers });
            }
            headers.set('Content-Type', 'application/json');
            return new Response(JSON.stringify({ error: 'Failed to send push notification' }), { status: 500, headers });
        }
    }
};
