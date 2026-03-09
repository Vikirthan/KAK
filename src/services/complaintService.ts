// =============================================
// COMPLAINT SERVICE — Exact logic from app.js
// =============================================
import { supabase } from '../lib/supabase';
import { mapFromDB, mapToDB } from '../lib/db-utils';
import type { Complaint } from '../lib/types';

/** Fetch all complaints from Supabase (ordered by created_at desc — same as original) */
export async function getComplaints(filter?: {
    studentUID?: string;
    assignedSupervisor?: string;
    status?: string;
}): Promise<Complaint[]> {
    let query = supabase.from('complaints').select('*').order('created_at', { ascending: false });

    if (filter?.studentUID) query = query.eq('student_uid', filter.studentUID);
    if (filter?.assignedSupervisor) query = query.eq('assigned_supervisor', filter.assignedSupervisor);
    if (filter?.status) query = query.eq('status', filter.status);

    const { data, error } = await query;
    if (error) {
        console.error('[KAK-DATA] Error fetching complaints:', error);
        return [];
    }

    console.log(`[KAK-LIVE] Fetched ${(data || []).length} raw rows from Supabase.`);
    return (data || []).map(mapFromDB);
}

/** Get complaints for a specific supervisor UID */
export async function getComplaintsForSupervisor(supUID: string): Promise<Complaint[]> {
    const all = await getComplaints();
    const filtered = all.filter((c: Complaint) => c.assignedSupervisor === supUID);
    console.log(`[KAK-DEBUG] Filtering for Supervisor: ${supUID} | Found: ${filtered.length} total: ${all.length}`);
    return filtered;
}

/** Get all escalated (pending_ao) complaints */
export async function getEscalatedComplaints(): Promise<Complaint[]> {
    const all = await getComplaints();
    return all.filter((c: Complaint) => c.status === 'pending_ao');
}

/** Add a new complaint to Supabase */
export async function addComplaint(complaint: Complaint): Promise<void> {
    const row = mapToDB(complaint);
    console.log('[KAK-DATA] Attempting Insert into Supabase:', row);
    const { error } = await supabase.from('complaints').insert([row]);
    if (error) {
        console.error('[KAK-DATA] Error adding complaint to Supabase:', error);
        throw error;
    }
}

/** Update a complaint in Supabase */
export async function updateComplaint(ticketId: string, patch: Partial<Complaint>): Promise<void> {
    const dbPatch = mapToDB(patch);
    const { error } = await supabase.from('complaints').update(dbPatch).eq('ticket_id', ticketId);
    if (error) console.error('[KAK-DATA] Error updating complaint:', error);
}

/** Upload a photo to Supabase Storage and return the public URL */
export async function uploadPhotoToSupabase(fileOrDataURL: string | File, fileName: string): Promise<string | null> {
    try {
        let blob: Blob;
        if (typeof fileOrDataURL === 'string' && fileOrDataURL.startsWith('data:')) {
            const res = await fetch(fileOrDataURL);
            blob = await res.blob();
        } else if (fileOrDataURL instanceof File) {
            blob = fileOrDataURL;
        } else {
            return fileOrDataURL;
        }

        const filePath = `${Date.now()}_${fileName}`;
        const { error } = await supabase.storage
            .from('hygiene-reports')
            .upload(filePath, blob, { contentType: blob.type });

        if (error) {
            console.error('[KAK-PHOTO] Upload error details:', error);
            throw error;
        }

        const { data: urlData } = supabase.storage
            .from('hygiene-reports')
            .getPublicUrl(filePath);

        console.log('[KAK-PHOTO] Upload success:', urlData.publicUrl);
        return urlData.publicUrl;
    } catch (err) {
        console.error('[KAK-PHOTO] Photo upload process failed:', err);
        return typeof fileOrDataURL === 'string' ? fileOrDataURL : null;
    }
}

/** Delete a photo from Supabase Storage */
export async function deletePhotoFromSupabase(publicURL: string): Promise<void> {
    if (!publicURL) return;
    try {
        const path = publicURL.split('/hygiene-reports/').pop();
        if (!path) return;
        const { error } = await supabase.storage.from('hygiene-reports').remove([path]);
        if (error) console.error('Error deleting photo:', error);
    } catch (err) {
        console.error('Photo deletion failed:', err);
    }
}

/** Get global stats */
export async function getStats(): Promise<{ total: number; resolved: number }> {
    const { data, error } = await supabase.from('complaints').select('status');
    if (error) return { total: 0, resolved: 0 };
    return {
        total: (data || []).length,
        resolved: (data || []).filter((c: { status: string }) => c.status === 'resolved' || c.status === 'closed' || c.status === 'ao_resolved').length,
    };
}
