const SUPABASE_URL = 'https://sokfowdozloaehjxflvv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNva2Zvd2RvemxvYWVoanhmbHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTczNzcsImV4cCI6MjA4NzMzMzM3N30.tlM6M-ZnvF1zBvFZTznDb_EOHNeRxNLlYT2RUC5hYDI';

let supervisorUID = null;
let pollInterval = null;
let seenTickets = new Set();

// Listen for messages from the main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_SUPERVISOR_ID') {
        supervisorUID = event.data.uid;
        console.log('[SW] Monitoring initialized for:', supervisorUID);
        startPolling();
    }
});

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);

    // Poll every 10 seconds for brand new complaints
    pollInterval = setInterval(checkComplaints, 10000);
}

async function checkComplaints() {
    if (!supervisorUID) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/complaints?assigned_supervisor=eq.${supervisorUID}&status=eq.pending_acceptance&select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        const data = await response.json();

        if (data && data.length > 0) {
            data.forEach(complaint => {
                if (!seenTickets.has(complaint.ticket_id)) {
                    seenTickets.add(complaint.ticket_id);
                    triggerAlarm(complaint);
                }
            });
        }
    } catch (err) {
        console.error('[SW] Background poll failed:', err);
    }
}

function triggerAlarm(c) {
    const title = '🚨 INCOMING COMPLAINT: ' + c.issue_type;
    const options = {
        body: `Location: Block ${c.block}\nNew request from ${c.student_name}. Action Required!`,
        icon: '/KAK/icon-192.png',
        badge: '/KAK/icon-192.png',
        vibrate: [500, 110, 500, 110, 450, 110, 200, 110],
        tag: 'call-' + c.ticket_id,
        requireInteraction: true, // Key: Keeps notification on screen until user acts
        data: {
            url: '/KAK/#/supervisor'
        },
        actions: [
            { action: 'open', title: '📟 OPEN DASHBOARD' }
        ]
    };

    self.registration.showNotification(title, options);
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            // If app is already open, focus it
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url.includes('/KAK/') && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not open, open it
            if (clients.openWindow) {
                return clients.openWindow('/KAK/supervisor');
            }
        })
    );
});

// Keep SW alive - basic self-ping
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});
