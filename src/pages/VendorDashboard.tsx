import { useState, useEffect, useCallback } from 'react';
import { LogOut, X, Download, ZoomIn, Camera } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getComplaints, updateComplaint, deletePhotoFromSupabase } from '../services/complaintService';
import { getSupervisorRanking } from '../services/statService';
import type { Complaint } from '../lib/types';
import type { RankedSupervisor } from '../services/statService';

// ─── Photo Lightbox with Download ────────────────────────────────
function PhotoLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleDownload = async () => {
        try {
            const response = await fetch(src);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `KAK_VEND_${alt.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            window.open(src, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                    className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all" title="Download photo">
                    <Download size={22} className="text-white" />
                </button>
                <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all">
                    <X size={24} className="text-white" />
                </button>
            </div>
            <img src={src} alt={alt} className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
    );
}

// ─── Clickable Photo Thumbnail ───────────────────────────────────
function ClickablePhoto({ src, alt, label, className = '' }: { src: string; alt: string; label?: string; className?: string }) {
    const [lightbox, setLightbox] = useState(false);
    if (!src) return null;
    return (
        <div className={className}>
            {label && (
                <div className="flex items-center gap-1.5 mb-2">
                    <Camera size={12} className="text-white/30" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</p>
                </div>
            )}
            <div className="relative group cursor-pointer rounded-xl overflow-hidden border border-white/5 bg-white/5" style={{ minHeight: '80px' }}>
                <img src={src} alt={alt} className="w-full h-24 object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all rounded-xl flex items-center justify-center gap-2">
                    <ZoomIn size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    <span className="text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg">Zoom</span>
                </div>
            </div>
            {lightbox && <PhotoLightbox src={src} alt={alt} onClose={() => setLightbox(false)} />}
        </div>
    );
}

export default function VendorDashboard() {
    const { logout, getSession } = useAuth();
    const user = getSession();
    const [ranking, setRanking] = useState<RankedSupervisor[]>([]);
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [globalStats, setGlobalStats] = useState({ supervisors: 0, received: 0, ontime: 0, missed: 0, avgRating: '–', totalBP: 0 });

    const loadData = useCallback(async () => {
        try {
            const [r, c] = await Promise.all([getSupervisorRanking(), getComplaints()]);
            setRanking(r);
            setComplaints(c);

            // Calculate global stats (same as vendor.js calculateGlobalStats)
            let totalBP = 0, totalRatings = 0, ratingSum = 0;
            r.forEach((s: RankedSupervisor) => {
                totalBP += s.blackPoints;
                if (s.rating > 0) { totalRatings++; ratingSum += s.rating; }
            });
            const missedCount = c.filter((x: Complaint) => x.status === 'closed_overdue' || x.escalated).length;
            setGlobalStats({
                supervisors: r.length,
                received: c.length,
                ontime: c.filter((x: Complaint) => x.resolvedOnTime).length,
                missed: missedCount,
                avgRating: totalRatings > 0 ? (ratingSum / totalRatings).toFixed(1) : '–',
                totalBP,
            });
        } catch (err) { console.error('Vendor load error', err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, [loadData]);

    if (!user) return null;

    const disputes = complaints.filter((c: Complaint) => c.status === 'escalated_to_vendor');
    const flagged = ranking.filter((r: RankedSupervisor) => r.blackPoints >= 4);

    const vendorDecision = async (c: Complaint, action: 'clear' | 'warn') => {
        if (!confirm(`Are you sure you want to ${action === 'clear' ? 'Accept & Resolve' : 'Issue Warning'} for this ticket?`)) return;

        // Clear photos from storage
        if (c.photo) await deletePhotoFromSupabase(c.photo);
        const resPhoto = c.supervisorPhoto || c.resolutionPhoto;
        if (resPhoto) await deletePhotoFromSupabase(resPhoto);

        // Resolve complaint
        await updateComplaint(c.ticketId, {
            status: 'resolved',
            photo: undefined,
            supervisorPhoto: undefined,
            timeline: [...(c.timeline || []), {
                event: `Vendor Final Decision: ${action === 'clear' ? 'Accepted' : 'Warning Issued'}. Case Closed.`,
                time: new Date().toISOString(), by: user.uid,
            }],
        });
        alert('Final decision recorded and photos cleared.');
        await loadData();
    };

    if (loading) {
        return <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center"><div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;
    }

    return (
        <div className="min-h-screen bg-[#0f0f1a] text-white font-['Inter',sans-serif]">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 bg-[#161625]/80 backdrop-blur-xl border-b border-white/5 py-3 px-4 md:px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src="icon-192.png" alt="KAK" className="w-9 h-9 rounded-lg" />
                    <div>
                        <span className="text-lg font-bold tracking-tight">VENDOR MANAGER</span>
                        <span className="hidden sm:block text-[10px] text-white/40 uppercase tracking-widest">Global Oversight Panel</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-sm font-semibold">{user.name}</span>
                        <span className="text-[10px] text-white/40">UID: {user.uid}</span>
                    </div>
                    <button onClick={logout} className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-red-400 transition-colors"><LogOut size={18} /></button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto p-4 md:p-6">
                {/* Global Stats */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
                    {[
                        { label: 'Supervisors', value: globalStats.supervisors, color: 'text-indigo-400 bg-indigo-400/5 border-indigo-400/10' },
                        { label: 'Total Received', value: globalStats.received, color: 'text-cyan-400 bg-cyan-400/5 border-cyan-400/10' },
                        { label: 'Resolved On Time', value: globalStats.ontime, color: 'text-emerald-400 bg-emerald-400/5 border-emerald-400/10' },
                        { label: 'Missed', value: globalStats.missed, color: 'text-red-400 bg-red-500/5 border-red-500/10' },
                        { label: 'Avg Rating', value: globalStats.avgRating, color: 'text-amber-400 bg-amber-400/5 border-amber-400/10' },
                        { label: 'Total Black Points', value: globalStats.totalBP, color: 'text-white bg-white/[0.03] border-white/5' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className={`p-4 rounded-2xl border ${color}`}>
                            <div className="text-2xl font-black">{value}</div>
                            <div className="text-[9px] font-bold uppercase tracking-widest opacity-40 mt-1">{label}</div>
                        </div>
                    ))}
                </div>

                {/* Flagged Alerts */}
                {flagged.length > 0 && (
                    <div className="mb-8 space-y-3">
                        {flagged.map((sup) => (
                            <div key={sup.uid} className={`p-4 rounded-2xl flex items-center gap-3 border ${sup.blackPoints >= 5 ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'
                                }`}>
                                <span className="text-2xl">{sup.blackPoints >= 5 ? '🛑' : '⚠️'}</span>
                                <div className="flex-1">
                                    <div className={`font-bold text-sm ${sup.blackPoints >= 5 ? 'text-red-400' : 'text-amber-400'}`}>
                                        {sup.blackPoints >= 5 ? 'CRITICAL: Terminate or Suspend' : 'WARNING: High violations'} — {sup.name} ({sup.uid})
                                    </div>
                                    <div className="text-xs text-white/40">{sup.name} from Block {sup.block} has reached <b className="text-white/80">{sup.blackPoints} black points</b>. Immediate action required.</div>
                                </div>
                                <button className="bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-2 rounded-xl text-xs font-bold transition-all" onClick={() => alert(`Sending warning to ${sup.uid}...`)}>
                                    Contact Now
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Disputes */}
                {disputes.length > 0 && (
                    <section className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-black">⚖️ Escalated Disputes</h2>
                            <span className="text-[10px] font-bold bg-red-500/10 text-red-400 px-2.5 py-0.5 rounded-full border border-red-500/20">{disputes.length}</span>
                        </div>
                        <div className="space-y-3">
                            {disputes.map((c: Complaint) => (
                                <div key={c.ticketId} className="bg-[#161625]/80 border border-red-500/10 rounded-2xl p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <div className="text-xs text-white/40 mb-1">👷 Supervisor: <b className="text-white/80">{c.assignedSupervisor}</b></div>
                                            <div className="text-[10px] text-white/20 font-mono">Ticket: {c.ticketId}</div>
                                        </div>
                                        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold">{c.studentRating}⭐ Student Rating</span>
                                    </div>
                                    {c.description && <div className="text-xs text-white/30 italic p-2 bg-white/[0.02] rounded-lg mb-3">"{c.description}"</div>}
                                    <div className="flex gap-2 mb-3">
                                        {c.photo && <ClickablePhoto src={c.photo} alt="Complaint" label="Complaint" className="flex-1" />}
                                        {(c.supervisorPhoto || c.resolutionPhoto) && <ClickablePhoto src={(c.supervisorPhoto || c.resolutionPhoto)!} alt="Resolution" label="Resolution" className="flex-1" />}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => vendorDecision(c, 'clear')} className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 py-2 rounded-xl text-xs font-bold">✅ Accept & Clear</button>
                                        <button onClick={() => vendorDecision(c, 'warn')} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2 rounded-xl text-xs font-bold">🚩 Issue Warning (⚫)</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Ranking Table */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-black">📊 Supervisor Ranking</h2>
                        <span className="text-xs text-white/40">{ranking.length} supervisors</span>
                    </div>

                    {ranking.length === 0 ? (
                        <div className="py-12 text-center bg-white/[0.02] border border-dashed border-white/5 rounded-2xl text-white/30 text-sm italic">No supervisor data yet.</div>
                    ) : (
                        <div className="space-y-3">
                            {ranking.map((sup, index) => {
                                const bpClass = sup.blackPoints >= 4 ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : sup.blackPoints >= 2 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                                const stars = sup.rating > 0 ? '⭐'.repeat(Math.round(sup.rating)) : '';
                                const ratingDisplay = sup.rating > 0 ? sup.rating.toFixed(1) : '–';

                                return (
                                    <div key={sup.uid} className="bg-[#161625]/80 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                                        <span className="text-lg font-black text-white/30 w-8 text-center">#{index + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm">{sup.name}</div>
                                            <div className="text-xs text-white/40">Block {sup.block} · {sup.uid}</div>
                                        </div>
                                        <div className="text-center px-3">
                                            <div className="text-[9px] text-white/30 uppercase">Rating</div>
                                            <div className="text-sm font-bold">{ratingDisplay}</div>
                                            <div className="text-xs">{stars}</div>
                                        </div>
                                        <div className="text-center px-3">
                                            <div className="text-[9px] text-white/30 uppercase">Resolved</div>
                                            <div className="text-sm font-bold text-emerald-400">{sup.resolvedOnTime}</div>
                                        </div>
                                        <div className="text-center px-3">
                                            <div className="text-[9px] text-white/30 uppercase">Missed</div>
                                            <div className="text-sm font-bold text-red-400">{sup.missed}</div>
                                        </div>
                                        <div className="text-center px-3">
                                            <div className="text-[9px] text-white/30 uppercase">Total</div>
                                            <div className="text-sm font-bold">{sup.totalAssigned}</div>
                                        </div>
                                        <div className="text-center px-3">
                                            <div className="text-[9px] text-white/30 uppercase">Violations</div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${bpClass}`}>{sup.blackPoints} BP</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
