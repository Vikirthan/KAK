// =============================================
// SUPABASE EDGE FUNCTION: send-push
// Updated with more logging and better encryption handling
// =============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'qL5LqrnXE1KwFaYFMB5ZMUK26qUHjZA-LGv2DDLlkdM';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || 'BAw8hGRsxIa7vnUcueqxTjh_RzK1ELyVSuXpXXdfdD7E8BQdRCkiIhjzoG12F_pAZmokLYPgezupdu1H4Fq41os';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:vikirthan@kak.lpu.edu';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://sokfowdozloaehjxflvv.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

console.log('[DEBUG] Function send-push starting up...');

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            },
        });
    }

    try {
        const body = await req.json();
        const { supervisorUID, complaint } = body;

        console.log(`[DEBUG] Received push request for UID: ${supervisorUID}, Ticket: ${complaint?.ticketId}`);

        if (!supervisorUID || !complaint) {
            return new Response(
                JSON.stringify({ error: 'Missing supervisorUID or complaint' }),
                { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
            );
        }

        // Get supervisor's push subscription from DB
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: subData, error: subError } = await supabase
            .from('push_subscriptions')
            .select('subscription_json')
            .eq('supervisor_uid', supervisorUID);

        if (subError) {
            console.error('[ERROR] DB error:', subError);
            return new Response(
                JSON.stringify({ error: 'Database error', details: subError }),
                { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
            );
        }

        if (!subData || subData.length === 0) {
            console.warn(`[WARN] No push subscription found for supervisor: ${supervisorUID}`);
            return new Response(
                JSON.stringify({ error: 'No push subscription found for supervisor' }),
                { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
            );
        }

        console.log(`[DEBUG] Found ${subData.length} subscriptions. Sending...`);

        // Send push to all subscriptions for this supervisor
        const results = [];
        for (const row of subData) {
            const subscription = JSON.parse(row.subscription_json);

            // Payload structure matching what sw.js expects
            const payload = JSON.stringify({
                title: `🚨 INCOMING: ${complaint.issueType}`,
                body: `Block ${complaint.block} — ${complaint.studentName}`,
                data: {
                    url: `/KAK/#/incoming?ticket=${complaint.ticketId}`,
                    ticketId: complaint.ticketId,
                    issueType: complaint.issueType,
                    block: complaint.block,
                },
            });

            try {
                const pushResult = await sendWebPush(subscription, payload);
                results.push({ endpoint: subscription.endpoint, success: pushResult });
                console.log(`[DEBUG] Push to ${subscription.endpoint.substring(0, 30)}...: ${pushResult ? 'SUCCESS' : 'FAILED'}`);
            } catch (pushErr) {
                console.error(`[ERROR] Push failed for ${subscription.endpoint}:`, pushErr);
                results.push({ endpoint: subscription.endpoint, success: false, error: String(pushErr) });
            }
        }

        return new Response(
            JSON.stringify({ success: true, results }),
            { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
    } catch (err) {
        console.error('[CRITICAL] Function processing error:', err);
        return new Response(
            JSON.stringify({ error: String(err) }),
            { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
    }
});

/**
 * Send a Web Push notification using the Web Push protocol.
 */
async function sendWebPush(subscription: any, payload: string): Promise<boolean> {
    const endpoint = subscription.endpoint;

    // Create JWT for VAPID
    const vapidHeaders = await createVapidHeaders(endpoint);

    // Encrypt the payload
    const encrypted = await encryptPayload(
        subscription.keys.p256dh,
        subscription.keys.auth,
        new TextEncoder().encode(payload)
    );

    // Send the push message
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': vapidHeaders.authorization,
            'Crypto-Key': vapidHeaders.cryptoKey,
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            'TTL': '86400',
            'Urgency': 'high',
        },
        body: encrypted,
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`[ERROR] Push endpoint returned ${response.status}:`, text);
        return false;
    }

    return true;
}

// ─── HELPER FUNCTIONS (VAPID & CRYPTO) ───

async function createVapidHeaders(endpoint: string) {
    const audience = new URL(endpoint).origin;
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (12 * 60 * 60);

    const header = { typ: 'JWT', alg: 'ES256' };
    const claimSet = {
        aud: audience,
        exp,
        sub: VAPID_SUBJECT,
    };

    const headerB64 = base64urlEncode(JSON.stringify(header));
    const claimB64 = base64urlEncode(JSON.stringify(claimSet));
    const unsignedToken = `${headerB64}.${claimB64}`;

    const key = await crypto.subtle.importKey(
        'jwk',
        {
            kty: 'EC',
            crv: 'P-256',
            d: VAPID_PRIVATE_KEY,
            x: base64urlEncode(base64urlDecode(VAPID_PUBLIC_KEY).slice(1, 33)),
            y: base64urlEncode(base64urlDecode(VAPID_PUBLIC_KEY).slice(33, 65)),
        },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        new TextEncoder().encode(unsignedToken)
    );

    const signatureB64 = base64urlEncode(new Uint8Array(signature));
    const jwt = `${unsignedToken}.${signatureB64}`;

    return {
        authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        cryptoKey: `p256ecdsa=${VAPID_PUBLIC_KEY}`,
    };
}

async function encryptPayload(p256dhKey: string, authKey: string, payload: Uint8Array): Promise<Uint8Array> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const subscriberKey = base64urlDecode(p256dhKey);
    const subscriberAuth = base64urlDecode(authKey);
    
    const localKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    );
    
    const subscriberPubKey = await crypto.subtle.importKey(
        'raw',
        subscriberKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
    );
    
    const sharedSecret = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: subscriberPubKey },
        localKeyPair.privateKey,
        256
    );
    
    const localPubKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
    const localPubKeyBytes = new Uint8Array(localPubKeyRaw);
    
    const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
    const prk = await hkdfExtract(subscriberAuth, new Uint8Array(sharedSecret));
    const ikm = await hkdfExpand(prk, concatBuffers(
        new TextEncoder().encode('WebPush: info\0'),
        subscriberKey,
        localPubKeyBytes
    ), 32);
    
    const prk2 = await hkdfExtract(salt, ikm);
    const contentEncryptionKey = await hkdfExpand(prk2, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdfExpand(prk2, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);
    
    const paddedPayload = new Uint8Array(payload.length + 2);
    paddedPayload.set(payload);
    paddedPayload[payload.length] = 2;
    paddedPayload[payload.length + 1] = 0;
    
    const key = await crypto.subtle.importKey(
        'raw',
        contentEncryptionKey,
        'AES-GCM',
        false,
        ['encrypt']
    );
    
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        key,
        paddedPayload
    );
    
    const recordSize = new Uint8Array(4);
    new DataView(recordSize.buffer).setUint32(0, encrypted.byteLength + 86);
    
    const header = concatBuffers(
        salt,
        recordSize,
        new Uint8Array([localPubKeyBytes.length]),
        localPubKeyBytes
    );
    
    return concatBuffers(header, new Uint8Array(encrypted));
}

function base64urlEncode(data: string | Uint8Array | ArrayBuffer): string {
    let bytes: Uint8Array;
    if (typeof data === 'string') bytes = new TextEncoder().encode(data);
    else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else bytes = data;
    
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
    const padding = '='.repeat((4 - (str.length % 4)) % 4);
    const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const array = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) array[i] = rawData.charCodeAt(i);
    return array;
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
        result.set(buf, offset);
        offset += buf.length;
    }
    return result;
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const result = await crypto.subtle.sign('HMAC', key, ikm);
    return new Uint8Array(result);
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const infoWithCounter = concatBuffers(info, new Uint8Array([1]));
    const result = await crypto.subtle.sign('HMAC', key, infoWithCounter);
    return new Uint8Array(result).slice(0, length);
}
