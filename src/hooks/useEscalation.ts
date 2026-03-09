// =============================================
// ESCALATION ENGINE — Exact logic from app.js lines 400-460
// =============================================
import { getComplaints, updateComplaint } from '../services/complaintService';
import { addBlackPoint } from '../services/statService';
import { useEffect } from 'react';

/** Background escalation engine — runs in App component */
export function useEscalation() {
    useEffect(() => {
        const run = async () => {
            try {
                await runEscalationEngine();
            } catch (err) {
                console.error('[KAK-ESCALATION] Engine error:', err);
            }
        };
        run();
        const interval = setInterval(run, 10000);
        return () => clearInterval(interval);
    }, []);
}

async function runEscalationEngine() {
    const now = Date.now();
    const list = await getComplaints();

    for (const c of list) {
        // ── TIER 0: Acceptance Window (10 mins) ──
        if (c.status === 'pending_acceptance' && c.acceptanceDeadline) {
            if (now > new Date(c.acceptanceDeadline).getTime()) {
                await updateComplaint(c.ticketId, {
                    status: 'pending_supervisor',
                    autoAccepted: true,
                    supervisorDeadline: new Date(now + 30 * 60 * 1000).toISOString(),
                    timeline: [...(c.timeline || []), {
                        event: 'System AUTO-ACCEPTED: Supervisor failed to respond in 10 mins. Resolution timer started.',
                        time: new Date().toISOString(), by: 'system',
                    }],
                });
            }
        }

        // ── TIER 1: Resolution Window (30 mins) ──
        if (c.status === 'pending_supervisor' && c.supervisorDeadline) {
            if (now > new Date(c.supervisorDeadline).getTime()) {
                await updateComplaint(c.ticketId, {
                    status: 'pending_ao',
                    aoDeadline: new Date(now + 30 * 60 * 1000).toISOString(),
                    escalated: true,
                    timeline: [...(c.timeline || []), {
                        event: 'Escalated to AO: Supervisor missed 30m resolution window (⚫ 1st BP)',
                        time: new Date().toISOString(), by: 'system',
                    }],
                });
                await addBlackPoint(c.assignedSupervisor, c.ticketId + '_miss_resolution');
            }
        }

        // ── TIER 2: AO Overtime Window (Additional 30 mins) ──
        if (c.status === 'pending_ao' && c.aoDeadline && !c.aoMissedPointAwarded) {
            if (now > new Date(c.aoDeadline).getTime()) {
                await updateComplaint(c.ticketId, {
                    aoMissedPointAwarded: true,
                    status: 'closed_overdue',
                    timeline: [...(c.timeline || []), {
                        event: 'System Closed: Final 30m grace period missed (⚫ another BP)',
                        time: new Date().toISOString(), by: 'system',
                    }],
                });
                await addBlackPoint(c.assignedSupervisor, c.ticketId + '_miss_final');
            }
        }
    }
}
