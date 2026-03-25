// =============================================
// KAK TYPES & CONSTANTS
// Migrated exactly from FINAL_KAK_PROJECT/js/app.js
// =============================================

export type UserRole = 'student' | 'supervisor' | 'ao' | 'vendor' | 'admin';

export type ComplaintStatus =
    | 'pending_acceptance'
    | 'pending_supervisor'
    | 'pending_approval'
    | 'pending_ao'
    | 'pending_ao_review'
    | 'reported_to_ao'
    | 'escalated_to_vendor'
    | 'closed_overdue'
    | 'resolved'
    | 'ao_resolved'
    | 'closed';

export interface User {
    uid: string;
    name: string;
    role: UserRole;
    block?: string;
    password?: string;
    redirectTo?: string;
}

// =============================================
// CREDENTIALS (All roles — same as app.js)
// =============================================
export const KAK_USERS: Record<string, User> = {
    // ---------- STUDENTS ----------
    '123': { password: 'Viki', role: 'student', name: 'Vikirthan T', uid: '123', redirectTo: '/student' },
    '456': { password: 'Viki', role: 'student', name: 'Arun Kumar S', uid: '456', redirectTo: '/student' },
    '789': { password: 'Viki', role: 'student', name: 'Priya Sharma', uid: '789', redirectTo: '/student' },

    // ---------- SUPERVISORS ----------
    'sup': { password: 'Viki', role: 'supervisor', name: 'Supervisor – Block 36', block: '36', uid: 'SUP-36', redirectTo: '/supervisor' },
    'sup2': { password: 'Viki', role: 'supervisor', name: 'Supervisor – Block 35', block: '35', uid: 'SUP-35', redirectTo: '/supervisor' },
    'sup3': { password: 'Viki', role: 'supervisor', name: 'Supervisor – Block 34', block: '34', uid: 'SUP-34', redirectTo: '/supervisor' },

    // ---------- AO OFFICE ----------
    'ao': { password: 'Viki', role: 'ao', name: 'AO Office – Block 36', block: '36', uid: 'AO-36', redirectTo: '/ao' },
    'ao35': { password: 'Viki', role: 'ao', name: 'AO Office – Block 35', block: '35', uid: 'AO-35', redirectTo: '/ao' },
    'ao34': { password: 'Viki', role: 'ao', name: 'AO Office – Block 34', block: '34', uid: 'AO-34', redirectTo: '/ao' },

    // ---------- VENDOR ----------
    'ven': { password: 'Viki', role: 'vendor', name: 'Vendor Manager', uid: 'VEN-001', redirectTo: '/vendor' },

    // ---------- MASTER ADMIN ----------
    'Vikirthan': { password: 'Viki', role: 'admin', name: 'Master Admin – Vikirthan', uid: 'ADMIN-01', redirectTo: '/master' },
};

// =============================================
// STUDENT PROFILES — pre-filled in complaint form
// =============================================
export const STUDENT_PROFILES: Record<string, { name: string; regNo: string; phone: string }> = {
    '123': { name: 'Vikirthan T', regNo: '12301234', phone: '9876543210' },
    '456': { name: 'Arun Kumar S', regNo: '45601234', phone: '9865432101' },
    '789': { name: 'Priya Sharma', regNo: '78901234', phone: '9754321089' },
};

// Role label & icon map
export const ROLE_META: Record<string, { label: string; icon: string; color: string }> = {
    student: { label: 'Student', icon: '🎓', color: '#6366f1' },
    supervisor: { label: 'Supervisor', icon: '🔧', color: '#06b6d4' },
    ao: { label: 'AO Office', icon: '🏢', color: '#f59e0b' },
    vendor: { label: 'Vendor Manager', icon: '👔', color: '#8b5cf6' },
    admin: { label: 'Master Admin', icon: '👑', color: '#ef4444' },
};

// Issue types and their icons
export const ISSUE_ICONS: Record<string, string> = {
    'Dirty/Unhygienic': '🚽',
    'Water Leakage': '💧',
    'Broken Fixture': '🔧',
    'Blocked Drain': '🚫',
    'No Water Supply': '❌',
    'Bad Odour': '😷',
    'Broken Door/Lock': '🔒',
    'Other': '📋',
};

// Hindi translations for issue types (for TTS voice announcements)
export const ISSUE_HINDI: Record<string, string> = {
    'Dirty/Unhygienic': 'गंदा या अस्वच्छ',
    'Water Leakage': 'पानी का रिसाव',
    'Broken Fixture': 'टूटा हुआ फिक्सचर',
    'Blocked Drain': 'नाली बंद है',
    'No Water Supply': 'पानी की सप्लाई नहीं है',
    'Bad Odour': 'बदबू आ रही है',
    'Broken Door/Lock': 'दरवाज़ा या ताला टूटा हुआ है',
    'Other': 'अन्य समस्या',
};

// Hindi floor labels
export const FLOOR_HINDI: Record<string, string> = {
    '2nd': 'दूसरी मंज़िल',
    '3rd': 'तीसरी मंज़िल',
    '5th': 'पाँचवीं मंज़िल',
};

// Status display config
export const STATUS_META: Record<string, { label: string; cls: string }> = {
    pending_acceptance: { label: '🆕 Awaiting Acceptance (10m)', cls: 'status-pending' },
    pending_supervisor: { label: '🕐 Resolution – Active (30m)', cls: 'status-active' },
    pending_approval: { label: '🔔 Action Required – Approve', cls: 'status-approval' },
    pending_ao: { label: '⚠️ Escalated – AO Office (30m)', cls: 'status-escalated' },
    pending_ao_review: { label: '🏢 AO Review Pending', cls: 'status-escalated' },
    reported_to_ao: { label: '🚨 Supervisor Reported', cls: 'status-escalated' },
    escalated_to_vendor: { label: '👮 Escalated to Vendor', cls: 'status-escalated' },
    closed_overdue: { label: '⚫ Closed – Overdue', cls: 'status-overdue' },
    resolved: { label: '✅ Resolved', cls: 'status-resolved' },
    ao_resolved: { label: '✅ Handled by AO', cls: 'status-resolved' },
    closed: { label: '✔ Closed', cls: 'status-closed' },
};

// Block-floor options for complaint form
export const BLOCK_OPTIONS = [
    { value: '36-2nd', label: 'Block 36 – Level 2' },
    { value: '36-3rd', label: 'Block 36 – Level 3' },
    { value: '36-5th', label: 'Block 36 – Level 5' },
    { value: '35-2nd', label: 'Block 35 – 2nd Floor' },
    { value: '35-3rd', label: 'Block 35 – 3rd Floor' },
    { value: '35-5th', label: 'Block 35 – 5th Floor' },
    { value: '34-2nd', label: 'Block 34 – 2nd Floor' },
    { value: '34-3rd', label: 'Block 34 – 3rd Floor' },
    { value: '34-5th', label: 'Block 34 – 5th Floor' },
];

export const ISSUE_TYPES = [
    { value: 'Dirty/Unhygienic', label: '🚽 Dirty / Unhygienic' },
    { value: 'Water Leakage', label: '💧 Water Leakage' },
    { value: 'Broken Fixture', label: '🔧 Broken Fixture' },
    { value: 'Blocked Drain', label: '🚫 Blocked Drain' },
    { value: 'No Water Supply', label: '❌ No Water Supply' },
    { value: 'Bad Odour', label: '😷 Bad Odour' },
    { value: 'Broken Door/Lock', label: '🔒 Broken Door / Lock' },
    { value: 'Other', label: '📋 Other' },
];

export interface TimelineEntry {
    event: string;
    time: string;
    by: string;
    note?: string;
    vendorNote?: string;
}

export interface Complaint {
    id?: string;
    ticketId: string;
    studentUID: string;
    studentName: string;
    regNo: string;
    phone: string;
    block: string;
    issueType: string;
    description: string;
    photo?: string | null;
    photoUrl?: string | null;
    status: ComplaintStatus;
    submittedAt: string;
    supervisorDeadline?: string;
    assignedSupervisor: string;
    supervisorPhoto?: string | null;
    resolutionPhoto?: string | null;
    studentApproved?: boolean;
    studentRating?: number;
    escalated?: boolean;
    timeline: TimelineEntry[];
    aoDeadline?: string;
    aoAlertAt?: string;
    aoMissedPointAwarded?: boolean;
    resolvedAt?: string;
    aoResolvedAt?: string;
    aoResolutionPhoto?: string | null;
    resolvedOnTime?: boolean;
    acceptanceDeadline?: string;
    autoAccepted?: boolean;
    studentComment?: string;
}

// =============================================
// UTILITY FUNCTIONS (from app.js)
// =============================================
export function generateTicketId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'KAK-';
    for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

export function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDateTime(date: Date): string {
    return date.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

export function msUntil(deadlineISO: string): number {
    return new Date(deadlineISO).getTime() - Date.now();
}

export function formatCountdown(ms: number): string {
    if (ms <= 0) return '00:00';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
