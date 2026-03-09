// =============================================
// SUPERVISOR STATS & BLACK POINTS (DB SYNC)
// Exact logic from app.js lines 462-587
// =============================================
import { supabase } from '../lib/supabase';
import { KAK_USERS } from '../lib/types';
import type { User } from '../lib/types';
import { getComplaintsForSupervisor } from './complaintService';

export interface SupStat {
    supUID: string;
    blackPoints: number;
    blackPointTickets: string[];
    totalResolved: number;
    totalAssigned: number;
    totalMissed: number;
    totalEscalated: number;
    resolvedOnTime: number;
    avgRating: number;
}

const STATS_DB_MAP: Record<string, string> = {
    blackPoints: 'black_points',
    totalResolved: 'total_resolved',
    totalAssigned: 'total_assigned',
    totalMissed: 'total_missed',
    totalEscalated: 'total_escalated',
    resolvedOnTime: 'resolved_on_time',
    avgRating: 'avg_rating',
    blackPointTickets: 'black_point_tickets',
};

export async function getSupStat(supUID: string): Promise<SupStat> {
    const { data, error } = await supabase
        .from('supervisor_stats')
        .select('*')
        .eq('supervisor_uid', supUID)
        .single();

    if (error || !data) {
        return {
            supUID,
            blackPoints: 0,
            blackPointTickets: [],
            totalResolved: 0,
            totalAssigned: 0,
            totalMissed: 0,
            totalEscalated: 0,
            resolvedOnTime: 0,
            avgRating: 0,
        };
    }

    return {
        supUID: data.supervisor_uid,
        blackPoints: data.black_points || 0,
        totalResolved: data.total_resolved || 0,
        totalAssigned: data.total_assigned || 0,
        totalMissed: data.total_missed || 0,
        totalEscalated: data.total_escalated || 0,
        resolvedOnTime: data.resolved_on_time || 0,
        avgRating: parseFloat(data.avg_rating || 0),
        blackPointTickets: data.black_point_tickets || [],
    };
}

export async function updateSupStat(supUID: string, patch: Partial<Record<string, unknown>>): Promise<void> {
    const dbPatch: Record<string, unknown> = {};
    for (const jsKey in patch) {
        const dbKey = STATS_DB_MAP[jsKey];
        if (dbKey) dbPatch[dbKey] = patch[jsKey];
    }

    const { error } = await supabase
        .from('supervisor_stats')
        .upsert({ supervisor_uid: supUID, ...dbPatch, updated_at: new Date().toISOString() });

    if (error) console.error('[KAK-STATS] Error updating stats:', error);
}

export async function addBlackPoint(supUID: string, ticketId: string): Promise<void> {
    const stat = await getSupStat(supUID);
    if (stat.blackPointTickets.includes(ticketId)) return;

    await updateSupStat(supUID, {
        blackPoints: (stat.blackPoints || 0) + 1,
        blackPointTickets: [...(stat.blackPointTickets || []), ticketId],
        totalMissed: (stat.totalMissed || 0) + 1,
    });
}

export async function addRatingToStats(supUID: string, _rating: number, _ticketId: string): Promise<void> {
    const complaints = await getComplaintsForSupervisor(supUID);
    const rated = complaints.filter((c) => (c.studentRating || 0) > 0);

    const totalRating = rated.reduce((sum, c) => sum + (c.studentRating || 0), 0);
    const newAvg = rated.length > 0 ? (totalRating / rated.length).toFixed(1) : String(_rating);

    await updateSupStat(supUID, {
        avgRating: parseFloat(newAvg),
        totalResolved: complaints.filter((c) => c.status === 'resolved' || c.status === 'closed').length,
    });
}

export async function recordResolutionStats(supUID: string, onTime: boolean): Promise<void> {
    const stat = await getSupStat(supUID);
    const patch: Record<string, unknown> = {};
    if (onTime) patch.resolvedOnTime = (stat.resolvedOnTime || 0) + 1;
    patch.totalResolved = (stat.totalResolved || 0) + 1;
    await updateSupStat(supUID, patch);
}

export interface RankedSupervisor {
    uid: string;
    name: string;
    block: string;
    blackPoints: number;
    resolvedOnTime: number;
    totalAssigned: number;
    missed: number;
    rating: number;
    flagged: boolean;
}

/** Supervisor ranking: sorted by rating desc, black points asc, missed asc */
export async function getSupervisorRanking(): Promise<RankedSupervisor[]> {
    const { data, error } = await supabase
        .from('supervisor_stats')
        .select('*')
        .order('avg_rating', { ascending: false });

    if (error || !data) return [];

    return data.map((s) => {
        const matchedUser = Object.values(KAK_USERS).find((u: User) => u.uid === s.supervisor_uid);
        return {
            uid: s.supervisor_uid,
            name: matchedUser?.name || s.supervisor_uid,
            block: s.supervisor_uid.split('-')[1] || '?',
            blackPoints: s.black_points || 0,
            resolvedOnTime: s.resolved_on_time || 0,
            totalAssigned: s.total_assigned || 0,
            missed: s.total_missed || 0,
            rating: parseFloat(s.avg_rating || 0),
            flagged: (s.black_points || 0) >= 5,
        };
    }).sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        if (a.blackPoints !== b.blackPoints) return a.blackPoints - b.blackPoints;
        return a.missed - b.missed;
    });
}
