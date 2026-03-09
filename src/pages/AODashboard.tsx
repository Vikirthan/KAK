import { useState, useEffect, useCallback, useRef } from 'react';
import { LogOut, X, ZoomIn, Download, MapPin, User, Phone, Wrench, Calendar, MessageSquare, Camera, AlertTriangle, CircleAlert, Shield, CheckCircle, Clock, Star, ChevronRight, FileWarning, Ban, Building2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getComplaints, updateComplaint, uploadPhotoToSupabase, deletePhotoFromSupabase, getComplaintsForSupervisor } from '../services/complaintService';
import { getSupStat } from '../services/statService';
import { KAK_USERS, formatDateTime, msUntil, formatCountdown } from '../lib/types';
import type { Complaint } from '../lib/types';

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
            a.download = `KAK_${alt.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            window.open(src, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                    className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all" title="Download photo">
                    <Download size={22} className="text-white" />
                </button>
                <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all">
                    <X size={22} className="text-white" />
                </button>
            </div>
            <img src={src} alt={alt} className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
    );
}

// ─── Clickable Photo with Zoom Overlay ───────────────────────────
function ClickablePhoto({ src, alt, label, className = '' }: { src: string; alt: string; label?: string; icon?: React.ReactNode; className?: string }) {
    const [lightbox, setLightbox] = useState(false);
    if (!src) return null;
    return (
        <div className={className}>
            {label && (
                <div className="flex items-center gap-1.5 mb-2">
                    <Camera size={12} className="text-white/30" />
                    <p className="text-xs font-bold uppercase tracking-widest text-white/40">{label}</p>
                </div>
            )}
            <div className="relative group cursor-pointer rounded-xl overflow-hidden border border-white/5" onClick={() => setLightbox(true)}>
                <img src={src} alt={alt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2">
                    <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    <span className="text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg">Click to zoom</span>
                </div>
            </div>
            {lightbox && <PhotoLightbox src={src} alt={alt} onClose={() => setLightbox(false)} />}
        </div>
    );
}

// ─── Circular Timer ──────────────────────────────────────────────
function CircularTimer({ ticketId, deadline, totalMs, timerRef }: {
    ticketId: string; deadline: string; totalMs: number;
    timerRef: React.MutableRefObject<Record<string, ReturnType<typeof setInterval>>>;
}) {
    const [display, setDisplay] = useState('--:--');
    const [percent, setPercent] = useState(100);
    const [urgency, setUrgency] = useState<'ok' | 'warn' | 'danger' | 'overdue'>('ok');

    useEffect(() => {
        const update = () => {
            const ms = msUntil(deadline);
            if (ms <= 0) { setDisplay('OVERDUE'); setPercent(0); setUrgency('overdue'); return; }
            setDisplay(formatCountdown(ms));
            setPercent(Math.max(0, (ms / totalMs) * 100));
            setUrgency(ms < 2 * 60 * 1000 ? 'danger' : ms < 5 * 60 * 1000 ? 'warn' : 'ok');
        };
        update();
        const id = setInterval(update, 1000);
        timerRef.current[ticketId] = id;
        return () => clearInterval(id);
    }, [ticketId, deadline, totalMs]);

    const dim = 80; const stroke = 3.5;
    const radius = (dim - stroke * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - percent / 100);
    const colorMap = {
        ok: { ring: 'stroke-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/5' },
        warn: { ring: 'stroke-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/5' },
        danger: { ring: 'stroke-red-500', text: 'text-red-400', bg: 'bg-red-500/5' },
        overdue: { ring: 'stroke-red-600', text: 'text-red-500', bg: 'bg-red-500/10' },
    };
    const c = colorMap[urgency];

    return (
        <div className={`relative flex items-center justify-center ${c.bg} rounded-2xl p-2 ${urgency === 'danger' || urgency === 'overdue' ? 'animate-pulse' : ''}`}>
            <svg width={dim} height={dim} className="transform -rotate-90">
                <circle cx={dim / 2} cy={dim / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
                <circle cx={dim / 2} cy={dim / 2} r={radius} className={`${c.ring} transition-all duration-1000`}
                    strokeWidth={stroke} fill="none" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={dashOffset} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-sm font-black font-mono ${c.text}`}>{display}</span>
                <span className="text-[7px] text-white/30 font-bold uppercase">{urgency === 'overdue' ? 'MISSED' : 'remaining'}</span>
            </div>
        </div>
    );
}

// ─── Detail Grid ─────────────────────────────────────────────────
function DetailGrid({ c }: { c: Complaint }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm mt-3 p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
            <div className="flex items-center gap-2"><MapPin size={13} className="text-white/25 flex-shrink-0" /><span className="text-white/30">Block:</span> <span className="text-white/70 font-semibold">{c.block}</span></div>
            <div className="flex items-center gap-2"><User size={13} className="text-white/25 flex-shrink-0" /><span className="text-white/30">Student:</span> <span className="text-white/70 font-semibold">{c.studentName}</span></div>
            <div className="flex items-center gap-2"><Phone size={13} className="text-white/25 flex-shrink-0" /><span className="text-white/30">Phone:</span> <span className="text-white/70 font-semibold">{c.phone || '–'}</span></div>
            <div className="flex items-center gap-2"><Shield size={13} className="text-white/25 flex-shrink-0" /><span className="text-white/30">Supervisor:</span> <span className="text-white/70 font-semibold">{c.assignedSupervisor}</span></div>
            <div className="flex items-center gap-2"><Wrench size={13} className="text-white/25 flex-shrink-0" /><span className="text-white/30">Issue:</span> <span className="text-white/70 font-semibold">{c.issueType}</span></div>
            <div className="flex items-center gap-2"><Calendar size={13} className="text-white/25 flex-shrink-0" /><span className="text-white/30">Filed:</span> <span className="text-white/70 font-semibold">{formatDateTime(new Date(c.submittedAt))}</span></div>
            {c.description && (
                <div className="col-span-full mt-1 flex items-start gap-2">
                    <MessageSquare size={13} className="text-white/25 flex-shrink-0 mt-0.5" />
                    <div><span className="text-white/30">Description:</span><p className="text-white/60 italic mt-1 text-sm">"{c.description}"</p></div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
export default function AODashboard() {
    const { logout, getSession } = useAuth();
    const user = getSession();
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ escalated: 0, active: 0, aoResolved: 0, overdue: 0, review: 0 });
    const [perfStats, setPerfStats] = useState({ rating: 0, received: 0, ontime: 0, missed: 0, bp: 0 });
    const timerRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

    const [resolveModal, setResolveModal] = useState<{ show: boolean; ticketId: string | null }>({ show: false, ticketId: null });
    const [resPhotoData, setResPhotoData] = useState<string | null>(null);
    const [resolving, setResolving] = useState(false);
    const [reviewModal, setReviewModal] = useState<{ show: boolean; complaint: Complaint | null; type: 'clear' | 'forward' }>({ show: false, complaint: null, type: 'clear' });
    const [reviewVendorNote, setReviewVendorNote] = useState('');
    const [reviewStudentNote, setReviewStudentNote] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);

    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            let all = await getComplaints();
            if (user.block) all = all.filter((c: Complaint) => c.block && c.block.split('-')[0] === user.block);
            setComplaints(all);

            const active = all.filter((c: Complaint) => c.status === 'pending_ao');
            const resolved = all.filter((c: Complaint) => ['ao_resolved', 'resolved', 'closed'].includes(c.status));
            const overdue = all.filter((c: Complaint) => c.status === 'closed_overdue');
            const reviews = all.filter((c: Complaint) => c.status === 'pending_ao_review' || c.status === 'reported_to_ao');

            setStats({
                escalated: active.length + resolved.length + overdue.length + reviews.length,
                active: active.length, aoResolved: resolved.length, overdue: overdue.length, review: reviews.length,
            });

            if (user.block) {
                const sup = Object.values(KAK_USERS).find(u => u.role === 'supervisor' && u.block === user.block);
                if (sup) {
                    const stat = await getSupStat(sup.uid);
                    const supComplaints = await getComplaintsForSupervisor(sup.uid);
                    setPerfStats({
                        rating: stat.avgRating || 0, received: supComplaints.length,
                        ontime: supComplaints.filter((c: Complaint) => c.resolvedOnTime).length,
                        missed: supComplaints.filter((c: Complaint) => c.status === 'closed_overdue' || c.escalated).length,
                        bp: stat.blackPoints || 0,
                    });
                }
            }
        } catch (err) { console.error('AO load error', err); }
        finally { setLoading(false); }
    }, [user?.uid, user?.block]);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 10000);
        return () => { clearInterval(interval); Object.values(timerRef.current).forEach(clearInterval); };
    }, [loadData]);

    if (!user) return null;

    const active = complaints.filter((c: Complaint) => c.status === 'pending_ao');
    const resolved = complaints.filter((c: Complaint) => ['ao_resolved', 'resolved', 'closed'].includes(c.status));
    const overdue = complaints.filter((c: Complaint) => c.status === 'closed_overdue');
    const reviews = complaints.filter((c: Complaint) => c.status === 'pending_ao_review' || c.status === 'reported_to_ao');

    const openResolveModal = (ticketId: string) => { setResolveModal({ show: true, ticketId }); setResPhotoData(null); };
    const confirmAOResolve = async () => {
        if (!resPhotoData || !resolveModal.ticketId) return;
        setResolving(true);
        try {
            const finalPhotoURL = await uploadPhotoToSupabase(resPhotoData, `${resolveModal.ticketId}_ao_res.jpg`);
            const all = await getComplaints();
            const c = all.find((x: Complaint) => x.ticketId === resolveModal.ticketId);
            const now = new Date();
            await updateComplaint(resolveModal.ticketId, {
                status: 'ao_resolved', aoResolvedAt: now.toISOString(), aoResolutionPhoto: finalPhotoURL,
                timeline: [...(c?.timeline || []), { event: 'AO Office Marked Resolved', time: now.toISOString(), by: user.uid }],
            });
            setResolveModal({ show: false, ticketId: null });
            await loadData();
        } catch (err) { console.error('AO resolve failed:', err); alert('Failed. Please try again.'); }
        finally { setResolving(false); }
    };

    const reportSupervisor = async (c: Complaint) => {
        if (!confirm('Summon this supervisor? They will get a red alert.')) return;
        await updateComplaint(c.ticketId, {
            status: 'reported_to_ao',
            timeline: [...(c.timeline || []), { event: 'AO Summoned Supervisor: Low quality work. Meeting required.', time: new Date().toISOString(), by: user.uid }],
        });
        await loadData();
    };

    const openReviewModal = (c: Complaint, type: 'clear' | 'forward') => {
        setReviewModal({ show: true, complaint: c, type }); setReviewVendorNote(''); setReviewStudentNote('');
    };

    const confirmReview = async () => {
        if (!reviewModal.complaint) return;
        const c = reviewModal.complaint;
        if (reviewModal.type === 'forward' && !reviewVendorNote) { alert('Please add a note for the Vendor.'); return; }
        if (reviewModal.type === 'clear' && (!reviewVendorNote || !reviewStudentNote)) { alert('Please fill both notes.'); return; }
        setReviewSubmitting(true);
        try {
            if (reviewModal.type === 'forward') {
                await updateComplaint(c.ticketId, {
                    status: 'escalated_to_vendor',
                    timeline: [...(c.timeline || []), { event: 'AO Reported to Vendor: Major quality dispute.', note: reviewVendorNote, time: new Date().toISOString(), by: user.uid }],
                });
            } else {
                if (c.photo) await deletePhotoFromSupabase(c.photo);
                const resPhoto = c.resolutionPhoto || c.supervisorPhoto;
                if (resPhoto) await deletePhotoFromSupabase(resPhoto);
                await updateComplaint(c.ticketId, {
                    status: 'resolved', photo: undefined, supervisorPhoto: undefined,
                    timeline: [...(c.timeline || []), { event: 'AO Cleared Review: Issue resolved and photos deleted.', vendorNote: reviewVendorNote, note: reviewStudentNote, time: new Date().toISOString(), by: user.uid }],
                });
            }
            setReviewModal({ show: false, complaint: null, type: 'clear' });
            await loadData();
        } catch (err) { console.error('Review action failed:', err); }
        finally { setReviewSubmitting(false); }
    };

    if (loading && complaints.length === 0) {
        return <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center"><div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>;
    }

    return (
        <div className="min-h-screen bg-[#0f0f1a] text-white font-['Inter',sans-serif]">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 bg-[#161625]/80 backdrop-blur-xl border-b border-white/5 py-3 px-4 md:px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src="/icon-192.png" alt="KAK" className="w-9 h-9 rounded-lg" />
                    <div>
                        <span className="text-lg font-bold tracking-tight">AO OFFICE</span>
                        <span className="hidden sm:block text-[10px] text-white/40 uppercase tracking-widest">Block {user.block || '–'} · Management Console</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-sm font-semibold">{user.name}</span>
                        <span className="text-[10px] text-white/40">Access Level: Administrative</span>
                    </div>
                    <button onClick={logout} className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-red-400 transition-colors"><LogOut size={18} /></button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto p-4 md:p-6">
                {/* Overdue Banner */}
                {stats.overdue > 0 && (
                    <div className="mb-6 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4">
                        <Ban size={28} className="text-red-400 flex-shrink-0" />
                        <div>
                            <div className="text-red-400 font-bold text-base">{stats.overdue} Overdue Complaint(s)</div>
                            <div className="text-white/40 text-sm">Supervisor has accumulated Black Points for these.</div>
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
                    {[
                        { label: 'Total Escalated', value: stats.escalated, color: 'text-amber-400 bg-amber-400/5 border-amber-400/10', icon: <AlertTriangle size={16} className="text-amber-400/40" /> },
                        { label: 'Active Now', value: stats.active, color: 'text-cyan-400 bg-cyan-400/5 border-cyan-400/10', icon: <CircleAlert size={16} className="text-cyan-400/40" /> },
                        { label: 'AO Resolved', value: stats.aoResolved, color: 'text-emerald-400 bg-emerald-400/5 border-emerald-400/10', icon: <CheckCircle size={16} className="text-emerald-400/40" /> },
                        { label: 'Overdue', value: stats.overdue, color: 'text-red-400 bg-red-500/5 border-red-500/10', icon: <Ban size={16} className="text-red-400/40" /> },
                        { label: 'Quality Review', value: stats.review, color: 'text-purple-400 bg-purple-400/5 border-purple-400/10', icon: <FileWarning size={16} className="text-purple-400/40" /> },
                    ].map(({ label, value, color, icon }) => (
                        <div key={label} className={`p-5 rounded-2xl border ${color}`}>
                            <div className="flex items-center justify-between mb-2">{icon}<span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{label}</span></div>
                            <div className="text-3xl font-black">{value}</div>
                        </div>
                    ))}
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-10">

                        {/* Active Escalations */}
                        <Section title="Active Escalations" badge={active.length} icon={<CircleAlert size={18} className="text-red-400" />}>
                            {active.length === 0 ? <EmptyBox text="No active escalations" /> : active.map((c: Complaint) => (
                                <div key={c.ticketId} className="bg-[#161625] border border-amber-500/10 rounded-2xl overflow-hidden">
                                    <div className="p-5">
                                        <div className="flex items-start gap-5">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-lg font-black">{c.issueType}</h3>
                                                    <span className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full border border-red-500/20 font-bold">
                                                        <CircleAlert size={10} /> Requires Action
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-white/20 font-mono">{c.ticketId}</span>
                                            </div>
                                            {c.aoDeadline && <CircularTimer ticketId={c.ticketId} deadline={c.aoDeadline} totalMs={30 * 60 * 1000} timerRef={timerRef} />}
                                        </div>
                                        <DetailGrid c={c} />
                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <ClickablePhoto src={c.photo || ''} alt="Complaint photo" label="Before — Complaint" />
                                            <ClickablePhoto src={(c.resolutionPhoto || c.supervisorPhoto) || ''} alt="Resolution photo" label="After — Resolution" />
                                        </div>
                                    </div>
                                    <button onClick={() => openResolveModal(c.ticketId)}
                                        className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 py-4 font-bold text-base transition-all flex items-center justify-center gap-2">
                                        <CheckCircle size={18} /> Mark AO Resolved
                                    </button>
                                </div>
                            ))}
                        </Section>

                        {/* Quality Reviews */}
                        <Section title="Quality Reviews" badge={reviews.length} icon={<FileWarning size={18} className="text-purple-400" />}>
                            {reviews.length === 0 ? <EmptyBox text="No quality reviews pending" /> : reviews.map((c: Complaint) => {
                                const isReported = c.status === 'reported_to_ao';
                                return (
                                    <div key={c.ticketId} className="bg-[#161625] border border-purple-500/10 rounded-2xl overflow-hidden">
                                        <div className="p-5">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-lg font-black">Quality Review</h3>
                                                <div className="flex items-center gap-1 text-base font-bold text-amber-400">
                                                    <Star size={14} className="fill-amber-400" /> {c.studentRating || 0}/5
                                                </div>
                                                <span className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border font-bold ml-auto ${isReported ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                                    {isReported ? <><Ban size={10} /> Supervisor Reported</> : <><AlertTriangle size={10} /> Low Rating</>}
                                                </span>
                                            </div>
                                            <span className="text-[11px] text-white/20 font-mono">{c.ticketId}</span>
                                            <DetailGrid c={c} />
                                            <div className="grid grid-cols-2 gap-4 mt-4">
                                                <ClickablePhoto src={c.photo || ''} alt="Complaint photo" label="Before — Complaint Photo" className="min-h-[120px]" />
                                                <ClickablePhoto src={(c.resolutionPhoto || c.supervisorPhoto) || ''} alt="Resolution photo" label="After — Supervisor Resolution" className="min-h-[120px]" />
                                            </div>
                                            {c.studentComment && (
                                                <div className="mt-3 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-2">
                                                    <MessageSquare size={14} className="text-amber-400/50 flex-shrink-0 mt-0.5" />
                                                    <div><span className="text-[10px] text-amber-400/60 font-bold uppercase">Student Comment</span><p className="text-sm text-white/60 mt-1">"{c.studentComment}"</p></div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex border-t border-white/5">
                                            {!isReported && (
                                                <button onClick={() => reportSupervisor(c)}
                                                    className="flex-1 bg-red-500/5 hover:bg-red-500/15 text-red-400 py-3.5 text-sm font-bold transition-all border-r border-white/5 flex items-center justify-center gap-1.5">
                                                    <AlertTriangle size={14} /> Summon Supervisor
                                                </button>
                                            )}
                                            <button onClick={() => openReviewModal(c, 'forward')}
                                                className="flex-1 bg-purple-500/5 hover:bg-purple-500/15 text-purple-400 py-3.5 text-sm font-bold transition-all border-r border-white/5 flex items-center justify-center gap-1.5">
                                                <Building2 size={14} /> Report to Vendor
                                            </button>
                                            <button onClick={() => openReviewModal(c, 'clear')}
                                                className="flex-1 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400 py-3.5 text-sm font-bold transition-all flex items-center justify-center gap-1.5">
                                                <CheckCircle size={14} /> Clear & Resolve
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </Section>

                        {/* Resolved */}
                        <Section title="Resolved" badge={resolved.length} icon={<CheckCircle size={18} className="text-emerald-400" />}>
                            {resolved.length === 0 ? <EmptyBox text="No resolved cases" /> : resolved.slice(0, 10).map((c: Complaint) => (
                                <div key={c.ticketId} className="bg-[#161625]/80 border border-white/5 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-400" /><h3 className="font-bold text-base">{c.issueType}</h3></div>
                                        <span className="text-[11px] text-white/20 font-mono">{c.ticketId}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-white/40">
                                        <MapPin size={12} /> Block {c.block} <span className="text-white/10">·</span>
                                        <User size={12} /> {c.studentName} <span className="text-white/10">·</span>
                                        <Calendar size={12} /> {c.resolvedAt ? formatDateTime(new Date(c.resolvedAt)) : '–'}
                                    </div>
                                    {c.studentRating && <div className="flex items-center gap-1.5 text-sm text-amber-400 mt-2 font-bold"><Star size={14} className="fill-amber-400" /> Student Rated: {c.studentRating}/5</div>}
                                </div>
                            ))}
                        </Section>

                        {/* Overdue */}
                        <Section title="Overdue" badge={overdue.length} icon={<Ban size={18} className="text-red-400" />}>
                            {overdue.length === 0 ? <EmptyBox text="No overdue cases" /> : overdue.map((c: Complaint) => (
                                <div key={c.ticketId} className="bg-[#161625]/80 border border-red-500/10 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2"><Ban size={16} className="text-red-400" /><h3 className="font-bold text-base text-red-400">{c.issueType}</h3></div>
                                        <span className="flex items-center gap-1 text-[10px] bg-white/5 text-white/60 px-2.5 py-1 rounded-full font-bold"><Ban size={10} /> Overdue</span>
                                    </div>
                                    <DetailGrid c={c} />
                                    <span className="text-[11px] text-white/20 font-mono mt-2 block">{c.ticketId}</span>
                                </div>
                            ))}
                        </Section>
                    </div>

                    {/* Right — Supervisor Performance */}
                    <div className="space-y-6">
                        <div className="bg-[#161625]/50 border border-white/5 rounded-2xl p-6 sticky top-20">
                            <div className="flex items-center gap-2 mb-5">
                                <Shield size={14} className="text-white/30" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-white/40">Supervisor Performance</h3>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { label: 'Avg Rating', value: perfStats.rating > 0 ? perfStats.rating.toFixed(1) : '–', icon: <Star size={14} className="text-amber-400/50" />, suffix: perfStats.rating > 0 ? ' ★' : '', color: 'text-amber-400' },
                                    { label: 'Total Received', value: perfStats.received, icon: <ChevronRight size={14} className="text-white/20" />, suffix: '', color: '' },
                                    { label: 'Resolved On Time', value: perfStats.ontime, icon: <CheckCircle size={14} className="text-emerald-400/50" />, suffix: '', color: 'text-emerald-400' },
                                    { label: 'Missed / Escalated', value: perfStats.missed, icon: <AlertTriangle size={14} className="text-red-400/50" />, suffix: '', color: 'text-red-400' },
                                    { label: 'Black Points', value: perfStats.bp, icon: <Ban size={14} className="text-white/30" />, suffix: ' BP', color: '' },
                                ].map(({ label, value, icon, suffix, color }) => (
                                    <div key={label} className="flex justify-between text-sm items-center py-2 border-b border-white/[0.04] last:border-0">
                                        <div className="flex items-center gap-2 text-white/50">{icon}{label}</div>
                                        <span className={`font-bold text-base ${color}`}>{value}{suffix}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* AO Resolve Modal */}
            {resolveModal.show && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-md">
                        <div className="flex items-center gap-2 mb-1"><Camera size={20} className="text-amber-400" /><h3 className="text-lg font-black">AO Resolution Photo</h3></div>
                        <p className="text-white/40 text-xs mb-4">Ticket: <span className="font-mono text-white/60">{resolveModal.ticketId}</span></p>
                        {!resPhotoData ? (
                            <label className="flex flex-col items-center justify-center gap-2 py-12 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-amber-500/30 transition-all mb-4">
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => setResPhotoData(ev.target?.result as string); r.readAsDataURL(f); }} />
                                <Camera size={36} className="text-white/20" />
                                <span className="text-sm text-white/50 font-bold">Tap to capture resolution photo</span>
                                <span className="text-[10px] text-white/20">JPG, PNG, WEBP · Max 10 MB</span>
                            </label>
                        ) : (
                            <div className="relative mb-4"><img src={resPhotoData} alt="Resolution" className="w-full max-h-48 object-cover rounded-xl" /><button onClick={() => setResPhotoData(null)} className="absolute top-2 right-2 bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500"><X size={16} /></button></div>
                        )}
                        <div className="flex gap-3">
                            <button onClick={() => setResolveModal({ show: false, ticketId: null })} className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl font-bold text-sm">Cancel</button>
                            <button onClick={confirmAOResolve} disabled={resolving || !resPhotoData} className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 py-3 rounded-xl font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2">
                                {resolving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : <><CheckCircle size={16} /> Confirm Resolved</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {reviewModal.show && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-lg">
                        <div className="flex items-center gap-2 mb-1">
                            {reviewModal.type === 'forward' ? <Building2 size={20} className="text-purple-400" /> : <CheckCircle size={20} className="text-emerald-400" />}
                            <h3 className="text-lg font-black">{reviewModal.type === 'forward' ? 'Report to Vendor Manager' : 'Clear & Resolve Complaint'}</h3>
                        </div>
                        <p className="text-white/40 text-sm mb-4">Ticket: <span className="font-mono text-white/60">{reviewModal.complaint?.ticketId}</span></p>

                        <div className="space-y-4 mb-5">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-1.5">Note for Supervisor/Vendor *</label>
                                <textarea value={reviewVendorNote} onChange={(e) => setReviewVendorNote(e.target.value)} placeholder="Explain the quality issue…" rows={3}
                                    className="w-full bg-white/[0.04] border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none focus:border-indigo-500/50" />
                            </div>
                            {reviewModal.type === 'clear' && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-1.5">Note for Student *</label>
                                    <textarea value={reviewStudentNote} onChange={(e) => setReviewStudentNote(e.target.value)} placeholder="Explain to the student…" rows={3}
                                        className="w-full bg-white/[0.04] border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none focus:border-indigo-500/50" />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setReviewModal({ show: false, complaint: null, type: 'clear' })} className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl font-bold text-sm">Cancel</button>
                            <button onClick={confirmReview} disabled={reviewSubmitting}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2 ${reviewModal.type === 'forward' ? 'bg-gradient-to-r from-purple-600 to-violet-600' : 'bg-gradient-to-r from-emerald-600 to-cyan-600'}`}>
                                {reviewSubmitting ? 'Processing…' : reviewModal.type === 'forward' ? <><Building2 size={16} /> Report to Vendor</> : <><CheckCircle size={16} /> Clear & Resolve</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Layout ──
function Section({ title, badge, icon, children }: { title: string; badge: number; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <section>
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">{icon}<h2 className="text-lg font-black">{title}</h2></div>
                <span className="text-xs font-bold bg-white/5 text-white/40 px-3 py-1 rounded-full border border-white/5">{badge}</span>
            </div>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

function EmptyBox({ text }: { text: string }) {
    return <div className="py-12 text-center bg-white/[0.02] border border-dashed border-white/5 rounded-2xl text-white/30 text-sm italic">{text}</div>;
}
