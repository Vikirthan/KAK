// =============================================
// DB COLUMN MAPPING — Exact match from app.js DB_MAP
// =============================================
import type { Complaint } from './types';

// JS key → Supabase column
const DB_MAP: Record<string, string> = {
    id: 'id',
    ticketId: 'ticket_id',
    studentUID: 'student_uid',
    studentName: 'student_name',
    regNo: 'reg_no',
    phone: 'phone',
    block: 'block',
    issueType: 'issue_type',
    description: 'description',
    photo: 'photo_url',
    status: 'status',
    submittedAt: 'submitted_at',
    supervisorDeadline: 'supervisor_deadline',
    assignedSupervisor: 'assigned_supervisor',
    supervisorPhoto: 'supervisor_photo',
    resolutionPhoto: 'supervisor_photo', // alias — same column
    studentApproved: 'student_approved',
    studentRating: 'student_rating',
    escalated: 'escalated',
    timeline: 'timeline',
    aoDeadline: 'ao_deadline',
    aoAlertAt: 'ao_alert_at',
    aoMissedPointAwarded: 'ao_missed_point_awarded',
    resolvedAt: 'resolved_at',
    aoResolvedAt: 'ao_resolved_at',
    aoResolutionPhoto: 'ao_resolution_photo',
    resolvedOnTime: 'resolved_on_time',
    acceptanceDeadline: 'acceptance_deadline',
    autoAccepted: 'auto_accepted',
};

/** Map DB row → JS complaint object (same as app.js getComplaints mapping) */
export function mapFromDB(row: Record<string, unknown>): Complaint {
    return {
        id: row.id as string,
        ticketId: row.ticket_id as string,
        studentUID: row.student_uid as string,
        studentName: row.student_name as string,
        regNo: row.reg_no as string,
        phone: row.phone as string,
        block: row.block as string,
        issueType: row.issue_type as string,
        description: row.description as string,
        photo: row.photo_url as string | null,
        photoUrl: row.photo_url as string | null,
        status: row.status as Complaint['status'],
        submittedAt: row.submitted_at as string,
        supervisorDeadline: row.supervisor_deadline as string,
        assignedSupervisor: row.assigned_supervisor as string,
        supervisorPhoto: row.supervisor_photo as string | null,
        resolutionPhoto: row.supervisor_photo as string | null, // alias
        studentApproved: row.student_approved as boolean,
        studentRating: row.student_rating as number,
        escalated: row.escalated as boolean,
        timeline: (row.timeline as Complaint['timeline']) || [],
        aoDeadline: row.ao_deadline as string,
        aoAlertAt: row.ao_alert_at as string,
        aoMissedPointAwarded: row.ao_missed_point_awarded as boolean,
        resolvedAt: row.resolved_at as string,
        aoResolvedAt: row.ao_resolved_at as string,
        aoResolutionPhoto: row.ao_resolution_photo as string | null,
        resolvedOnTime: row.resolved_on_time as boolean,
        acceptanceDeadline: row.acceptance_deadline as string,
        autoAccepted: row.auto_accepted as boolean,
    };
}

/** Map JS patch → DB columns (same as app.js updateComplaint mapping) */
export function mapToDB(patch: Partial<Complaint>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const jsKey in patch) {
        const dbKey = DB_MAP[jsKey];
        if (dbKey) row[dbKey] = (patch as Record<string, unknown>)[jsKey];
    }
    return row;
}
