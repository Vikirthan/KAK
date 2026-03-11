import { useState, useEffect, useCallback } from 'react';
import { LogOut, RefreshCcw, Trash2, Search, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/types';

interface DBComplaint { id: string; ticket_id: string; block: string; issue_type: string; status: string; assigned_supervisor: string; student_rating: number; submitted_at: string; }
interface DBSupervisor { supervisor_uid: string; total_resolved: number; total_missed: number; black_points: number; avg_rating: number; }

export default function MasterAdmin() {
    const { logout, getSession } = useAuth();
    const user = getSession();
    const [complaints, setComplaints] = useState<DBComplaint[]>([]);
    const [supervisors, setSupervisors] = useState<DBSupervisor[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [wipeModal, setWipeModal] = useState(false);
    const [wipePassword, setWipePassword] = useState('');
    const [wipeError, setWipeError] = useState(false);
    const [wiping, setWiping] = useState(false);
    const [tab, setTab] = useState<'complaints' | 'supervisors'>('complaints');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: c } = await supabase.from('complaints').select('*').order('submitted_at', { ascending: false });
            if (c) setComplaints(c as DBComplaint[]);

            const { data: s } = await supabase.from('supervisor_stats').select('*');
            if (s) setSupervisors(s as DBSupervisor[]);
        } catch (err) { console.error('Admin load error', err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    if (!user) return null;

    const filtered = complaints.filter(c =>
        c.ticket_id?.toLowerCase().includes(search.toLowerCase()) ||
        c.block?.toString().includes(search) ||
        c.issue_type?.toLowerCase().includes(search.toLowerCase()) ||
        (c.assigned_supervisor && c.assigned_supervisor.toLowerCase().includes(search.toLowerCase()))
    );
    const activeCount = complaints.filter(c => !['resolved', 'closed', 'ao_resolved'].includes(c.status)).length;

    const deleteComplaint = async (id: string) => {
        if (!confirm('Delete this ticket permanently from database?')) return;
        const { error } = await supabase.from('complaints').delete().eq('id', id);
        if (error) alert('Delete failed: ' + error.message);
        else await loadData();
    };

    const resetSupervisorStats = async (uid: string) => {
        if (!confirm(`Reset all stats for ${uid}?`)) return;
        await supabase.from('supervisor_stats').update({
            total_resolved: 0, total_assigned: 0, total_missed: 0,
            total_escalated: 0, resolved_on_time: 0, black_points: 0,
            avg_rating: 0, black_point_tickets: [],
        }).eq('supervisor_uid', uid);
        await loadData();
    };

    const confirmWipe = async () => {
        if (wipePassword !== 'Viki') { setWipeError(true); return; }
        setWiping(true);
        try {
            const { error: cErr } = await supabase.from('complaints').delete().neq('ticket_id', '_none_');
            if (cErr) throw cErr;
            const { error: sErr } = await supabase.from('supervisor_stats').update({
                total_resolved: 0, total_assigned: 0, total_missed: 0,
                total_escalated: 0, resolved_on_time: 0, black_points: 0,
                avg_rating: 0, black_point_tickets: [],
            }).neq('supervisor_uid', '_none_');
            if (sErr) throw sErr;
            alert('NUCLEAR WIPE SUCCESSFUL. DATABASE IS RESET.');
            window.location.reload();
        } catch (err: unknown) {
            console.error('WIPE FAILED:', err);
            alert('WIPE FAILED: ' + (err instanceof Error ? err.message : String(err)));
            setWiping(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f0f1a] text-white font-['Inter',sans-serif]">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 bg-[#161625]/80 backdrop-blur-xl border-b border-white/5 py-3 px-4 md:px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src="icon-192.png" alt="KAK" className="w-9 h-9 rounded-lg" />
                    <div>
                        <span className="text-lg font-bold tracking-tight">MASTER ADMIN</span>
                        <span className="hidden sm:block text-[10px] text-white/40 uppercase tracking-widest">System Control Panel</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-sm font-semibold">{user.name}</span>
                        <span className="text-[10px] text-white/40">👑 Master Admin</span>
                    </div>
                    <button onClick={logout} className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-red-400 transition-colors"><LogOut size={18} /></button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 md:p-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                    <div className="p-4 rounded-2xl border border-indigo-400/10 bg-indigo-400/5">
                        <div className="text-2xl font-black text-indigo-400">{complaints.length}</div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 mt-1">Total Complaints</div>
                    </div>
                    <div className="p-4 rounded-2xl border border-amber-400/10 bg-amber-400/5">
                        <div className="text-2xl font-black text-amber-400">{activeCount}</div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 mt-1">Active Complaints</div>
                    </div>
                    <div className="p-4 rounded-2xl border border-cyan-400/10 bg-cyan-400/5">
                        <div className="text-2xl font-black text-cyan-400">{supervisors.length}</div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 mt-1">Total Supervisors</div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets, blocks, issues…"
                            className="w-full bg-white/[0.04] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-indigo-500/50" />
                    </div>
                    <button onClick={loadData} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all">
                        <RefreshCcw size={14} /> Refresh
                    </button>
                    <button onClick={() => { setWipeModal(true); setWipePassword(''); setWipeError(false); }}
                        className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-xl text-sm font-bold transition-all">
                        <AlertTriangle size={14} /> Nuclear Wipe
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-4 bg-white/[0.03] p-1 rounded-xl w-fit">
                    <button onClick={() => setTab('complaints')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'complaints' ? 'bg-indigo-500 text-white' : 'text-white/40 hover:text-white/60'}`}>
                        Complaints ({complaints.length})
                    </button>
                    <button onClick={() => setTab('supervisors')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'supervisors' ? 'bg-indigo-500 text-white' : 'text-white/40 hover:text-white/60'}`}>
                        Supervisors ({supervisors.length})
                    </button>
                </div>

                {/* Complaints Table */}
                {tab === 'complaints' && (
                    <div className="bg-[#161625]/50 border border-white/5 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5 text-[10px] text-white/40 uppercase tracking-widest">
                                        <th className="text-left p-3">Ticket</th>
                                        <th className="text-left p-3">Block</th>
                                        <th className="text-left p-3">Issue</th>
                                        <th className="text-left p-3">Status</th>
                                        <th className="text-left p-3">Supervisor</th>
                                        <th className="text-left p-3">Rating</th>
                                        <th className="text-left p-3">Date</th>
                                        <th className="text-center p-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={8} className="text-center py-8 text-white/30">Loading…</td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center py-8 text-white/30 italic">No complaints found</td></tr>
                                    ) : filtered.map(c => (
                                        <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                            <td className="p-3 font-mono text-indigo-400 text-xs">{c.ticket_id}</td>
                                            <td className="p-3 text-white/60">Block {c.block}</td>
                                            <td className="p-3">{c.issue_type}</td>
                                            <td className="p-3"><span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full">{(c.status || '').replace(/_/g, ' ')}</span></td>
                                            <td className="p-3 text-white/60">{c.assigned_supervisor || '—'}</td>
                                            <td className="p-3">{c.student_rating ? c.student_rating + ' ⭐' : '—'}</td>
                                            <td className="p-3 text-white/40 text-xs">{c.submitted_at ? formatDateTime(new Date(c.submitted_at)) : '–'}</td>
                                            <td className="p-3 text-center">
                                                <button onClick={() => deleteComplaint(c.id)} className="text-red-400 hover:text-red-300 transition-colors" title="Delete Ticket"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Supervisors Table */}
                {tab === 'supervisors' && (
                    <div className="bg-[#161625]/50 border border-white/5 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5 text-[10px] text-white/40 uppercase tracking-widest">
                                        <th className="text-left p-3">UID</th>
                                        <th className="text-left p-3">Total Resolved</th>
                                        <th className="text-left p-3">Total Missed</th>
                                        <th className="text-left p-3">Black Points</th>
                                        <th className="text-left p-3">Avg Rating</th>
                                        <th className="text-center p-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {supervisors.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-8 text-white/30 italic">No supervisor data</td></tr>
                                    ) : supervisors.map(s => (
                                        <tr key={s.supervisor_uid} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                            <td className="p-3 font-bold">{s.supervisor_uid}</td>
                                            <td className="p-3 text-emerald-400">{s.total_resolved}</td>
                                            <td className="p-3 text-red-400">{s.total_missed}</td>
                                            <td className="p-3">{s.black_points} ⚫</td>
                                            <td className="p-3">{s.avg_rating ? s.avg_rating + ' ⭐' : '—'}</td>
                                            <td className="p-3 text-center">
                                                <button onClick={() => resetSupervisorStats(s.supervisor_uid)} className="text-amber-400 hover:text-amber-300 transition-colors" title="Reset Stats">🔄</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* Wipe Modal */}
            {wipeModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1a1a2e] border border-red-500/20 rounded-2xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-black text-red-400 mb-1 flex items-center gap-2"><AlertTriangle size={20} /> Nuclear Database Wipe</h3>
                        <p className="text-white/40 text-xs mb-4">This will <b className="text-red-400">permanently delete ALL complaints</b> and reset ALL supervisor statistics. This action cannot be undone.</p>
                        <div className="mb-4">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Admin Password *</label>
                            <input type="password" value={wipePassword} onChange={(e) => { setWipePassword(e.target.value); setWipeError(false); }} placeholder="Enter admin password"
                                className="w-full bg-white/[0.04] border border-white/5 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-red-500/50" />
                            {wipeError && <div className="text-red-400 text-xs mt-1 font-bold flex items-center gap-1">⚠️ Wrong password. You are not authorized.</div>}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setWipeModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 py-2.5 rounded-xl font-bold text-sm">Cancel</button>
                            <button onClick={confirmWipe} disabled={wiping}
                                className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 py-2.5 rounded-xl font-bold text-sm disabled:opacity-30">
                                {wiping ? 'WIPING…' : '☢️ CONFIRM WIPE'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
