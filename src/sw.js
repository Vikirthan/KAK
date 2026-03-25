import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();

// Precache resources (required for injectManifest)
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

const SUPABASE_URL = 'https://sokfowdozloaehjxflvv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNva2Zvd2RvemxvYWVoanhmbHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTczNzcsImV4cCI6MjA4NzMzMzM3N30.tlM6M-ZnvF1zBvFZTznDb_EOHNeRxNLlYT2RUC5hYDI';

let supervisorUID = null;
let pollInterval = null;
let seenTickets = new Set();
let pollingFallbackEnabled = true;

// Listen for messages from the main app
self.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'SET_SUPERVISOR_ID') {
        supervisorUID = event.data.uid;
        console.log('[SW] Monitoring initialized for:', supervisorUID);
        if (pollingFallbackEnabled) startPolling();
        return;
    }

    if (event.data.type === 'SET_POLLING_FALLBACK') {
        pollingFallbackEnabled = !!event.data.enabled;
        console.log('[SW] Polling fallback:', pollingFallbackEnabled ? 'ENABLED' : 'DISABLED', '| reason:', event.data.reason || 'n/a');
        if (pollingFallbackEnabled) startPolling();
        else stopPolling();
    }
});

function startPolling() {
    if (!pollingFallbackEnabled || !supervisorUID) return;
    if (pollInterval) clearInterval(pollInterval);
    checkComplaints();
    pollInterval = setInterval(checkComplaints, 15000);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

async function checkComplaints() {
    if (!supervisorUID || !pollingFallbackEnabled) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/complaints?assigned_supervisor=eq.${supervisorUID}&status=eq.pending_acceptance&select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        const data = await response.json();

        if (data && data.length > 0) {
            for (const complaint of data) {
                if (!seenTickets.has(complaint.ticket_id)) {
                    seenTickets.add(complaint.ticket_id);
                    await triggerAlarm(complaint);
                }
            }
        }
    } catch (err) {
        console.error('[SW] Background poll failed:', err);
    }
}

async function triggerAlarm(c) {
    const title = '🚨 INCOMING COMPLAINT: ' + c.issue_type;
    const options = {
        body: `Location: Block ${c.block}\nNew request from ${c.student_name}. Action Required!`,
        icon: '/KAK/icon-192.png',
        badge: '/KAK/icon-192.png',
        vibrate: [500, 100, 500, 100, 500, 100, 1000],
        tag: 'kak-emergency',
        requireInteraction: true,
        renotify: true,
        data: {
            url: '/KAK/#/incoming?ticket=' + c.ticket_id,
            ticketId: c.ticket_id
        },
        actions: [
            { action: 'accept', title: '✅ स्वीकार करें' },
            { action: 'open', title: '📟 OPEN' }
        ],
        silent: false,
    };

    // Show the notification
    await self.registration.showNotification(title, options);

    // Also try to message any open app windows to show the incoming call screen
    try {
        const windowClients = await clients.matchAll({ type: 'window' });
        for (const client of windowClients) {
            if (client.url.includes('/KAK/')) {
                client.postMessage({
                    type: 'INCOMING_COMPLAINT',
                    ticketId: c.ticket_id,
                    complaint: c
                });
            }
        }
    } catch (err) {
        console.log('[SW] Could not message clients:', err);
    }
}

// When notification is clicked — open the full-screen incoming call page
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const action = event.action;
    const notifData = event.notification.data || {};
    const ticketId = notifData.ticketId;
    const baseUrl = ticketId ? `/KAK/#/incoming?ticket=${encodeURIComponent(ticketId)}` : '/KAK/#/incoming';
    const targetUrl = action === 'accept' ? `${baseUrl}${ticketId ? '&accept=1' : '?accept=1'}` : (notifData.url || baseUrl);

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Try to find an existing KAK window and navigate it
            for (const client of windowClients) {
                if (client.url.includes('/KAK/') && 'focus' in client) {
                    // Navigate existing window to the incoming call screen
                    client.postMessage({
                        type: 'NAVIGATE_TO_INCOMING',
                        ticketId,
                        autoAccept: action === 'accept',
                    });
                    return client.focus();
                }
            }
            // No open window — open a new one to the incoming call page
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// Handle push event
self.addEventListener('push', (event) => {
    console.log('[SW] Push event received:', event);
    let data = {};
    if (event.data) {
        try { 
            data = event.data.json(); 
            console.log('[SW] Push data parsed:', data);
        } catch (e) { 
            console.error('[SW] Push data parse failed:', e);
            data = {}; 
        }
    }

    const ticketId = data.data?.ticketId;
    const defaultIncomingUrl = ticketId
        ? `/KAK/#/incoming?ticket=${encodeURIComponent(ticketId)}`
        : '/KAK/#/incoming';

    const title = data.title || '🚨 KAK ALERT';
    const options = {
        body: data.body || 'You have a new complaint.',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [500, 100, 500, 100, 500],
        requireInteraction: true,
        tag: ticketId ? `kak-ticket-${ticketId}` : 'kak-alert',
        renotify: true,
        data: {
            url: data.data?.url || defaultIncomingUrl,
            ticketId,
        },
        actions: [
            { action: 'accept', title: 'Accept' },
            { action: 'open', title: 'Open' },
        ],
    };

    console.log('[SW] Showing notification:', title, options);
    event.waitUntil(self.registration.showNotification(title, options));
});

// Log Service Worker activation
self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker activated and claiming clients');
    event.waitUntil(clients.claim());
});
