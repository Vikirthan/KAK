// =============================================
// WEB PUSH NOTIFICATION SERVICE
// Handles push subscription, storage, and triggering
// =============================================
import { supabase } from '../lib/supabase';

// VAPID Public Key — generated for this project
const VAPID_PUBLIC_KEY = 'BAw8hGRsxIa7vnUcueqxTjh_RzK1ELyVSuXpXXdfdD7E8BQdRCkiIhjzoG12F_pAZmokLYPgezupdu1H4Fq41os';

// Convert URL-safe base64 to Uint8Array (needed for push subscription)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Subscribe the current browser to Web Push notifications.
 * Saves the subscription to Supabase so the server can send pushes later.
 */
export async function subscribeToPush(supervisorUID: string): Promise<boolean> {
    try {
        // Check support
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('[PUSH] Push notifications not supported in this browser');
            return false;
        }

        // Ensure notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('[PUSH] Notification permission denied');
            return false;
        }

        // Wait for service worker
        const registration = await navigator.serviceWorker.ready;

        // Check for existing subscription
        let subscription = await registration.pushManager.getSubscription();

        // If no subscription, create one
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
            });
            console.log('[PUSH] New push subscription created');
        } else {
            console.log('[PUSH] Using existing push subscription');
        }

        // Save subscription to Supabase
        const subscriptionJSON = subscription.toJSON();

        // Upsert the subscription (update if exists, insert if new)
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                supervisor_uid: supervisorUID,
                endpoint: subscriptionJSON.endpoint,
                keys_p256dh: subscriptionJSON.keys?.p256dh || '',
                keys_auth: subscriptionJSON.keys?.auth || '',
                subscription_json: JSON.stringify(subscriptionJSON),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'supervisor_uid',
            });

        if (error) {
            console.error('[PUSH] Failed to save subscription to Supabase:', error);
            // Try insert instead (in case upsert fails due to missing unique constraint)
            const { error: insertError } = await supabase
                .from('push_subscriptions')
                .insert({
                    supervisor_uid: supervisorUID,
                    endpoint: subscriptionJSON.endpoint,
                    keys_p256dh: subscriptionJSON.keys?.p256dh || '',
                    keys_auth: subscriptionJSON.keys?.auth || '',
                    subscription_json: JSON.stringify(subscriptionJSON),
                    updated_at: new Date().toISOString(),
                });
            if (insertError) {
                console.error('[PUSH] Insert also failed:', insertError);
                return false;
            }
        }

        console.log('[PUSH] ✅ Push subscription saved for:', supervisorUID);
        return true;
    } catch (err) {
        console.error('[PUSH] Subscription failed:', err);
        return false;
    }
}

/**
 * Send a push notification to a specific supervisor.
 * This calls the Supabase Edge Function which handles actual delivery.
 * 
 * If Edge Function is not deployed, it falls back to a direct notification attempt.
 */
export async function sendPushToSupervisor(
    supervisorUID: string,
    complaint: {
        ticketId: string;
        issueType: string;
        block: string;
        studentName: string;
        description?: string;
    }
): Promise<boolean> {
    try {
        // First, try Supabase Edge Function (server-side push)
        const supabaseUrl = 'https://sokfowdozloaehjxflvv.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNva2Zvd2RvemxvYWVoanhmbHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NTczNzcsImV4cCI6MjA4NzMzMzM3N30.tlM6M-ZnvF1zBvFZTznDb_EOHNeRxNLlYT2RUC5hYDI';
        
        const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
                supervisorUID,
                complaint,
            }),
        });

        if (response.ok) {
            console.log('[PUSH] ✅ Server push sent successfully');
            return true;
        }

        console.warn('[PUSH] Edge Function returned:', response.status, await response.text());
        return false;
    } catch (err) {
        console.error('[PUSH] Failed to send push:', err);
        return false;
    }
}
