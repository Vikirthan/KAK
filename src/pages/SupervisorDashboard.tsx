import { useState, useEffect, useCallback, useRef } from 'react';
import { LogOut, Volume2, VolumeX, X, ZoomIn, MapPin, User, Phone, Clock, Camera, CheckCircle, AlertTriangle, CircleAlert, Star, Ban, ChevronRight, Zap, Bell, ShieldAlert, Download, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getComplaintsForSupervisor, updateComplaint, uploadPhotoToSupabase, getComplaints } from '../services/complaintService';
import { getSupStat, recordResolutionStats } from '../services/statService';
import { formatTime, formatDateTime, msUntil, formatCountdown, ISSUE_ICONS } from '../lib/types';
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
                    <p className="text-xs font-bold uppercase tracking-widest text-white/40">{label}</p>
                </div>
            )}
            <div className="relative group cursor-pointer rounded-xl overflow-hidden border border-white/5" onClick={() => setLightbox(true)}>
                <img src={src} alt={alt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all rounded-xl flex items-center justify-center gap-2">
                    <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    <span className="text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg">Click to zoom</span>
                </div>
            </div>
            {lightbox && <PhotoLightbox src={src} alt={alt} onClose={() => setLightbox(false)} />}
        </div>
    );
}

// ─── Premium Circular Timer ──────────────────────────────────────
function PremiumTimer({ ticketId, deadline, totalMs, timerRef, size = 'normal' }: {
    ticketId: string;
    deadline: string;
    totalMs: number;
    timerRef: React.MutableRefObject<Record<string, ReturnType<typeof setInterval>>>;
    size?: 'normal' | 'large';
}) {
    const [display, setDisplay] = useState('--:--');
    const [percent, setPercent] = useState(100);
    const [urgency, setUrgency] = useState<'ok' | 'warn' | 'danger' | 'overdue'>('ok');

    useEffect(() => {
        const update = () => {
            const ms = msUntil(deadline);
            if (ms <= 0) {
                setDisplay('OVERDUE');
                setPercent(0);
                setUrgency('overdue');
                return;
            }
            setDisplay(formatCountdown(ms));
            setPercent(Math.max(0, (ms / totalMs) * 100));
            setUrgency(ms < 2 * 60 * 1000 ? 'danger' : ms < 5 * 60 * 1000 ? 'warn' : 'ok');
        };
        update();
        const id = setInterval(update, 1000);
        timerRef.current[ticketId] = id;
        return () => clearInterval(id);
    }, [ticketId, deadline, totalMs]);

    const isLarge = size === 'large';
    const dim = isLarge ? 100 : 72;
    const stroke = isLarge ? 4 : 3;
    const radius = (dim - stroke * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - percent / 100);

    const colorMap = {
        ok: { ring: 'stroke-cyan-500', text: 'text-cyan-400', glow: 'shadow-cyan-500/20', bg: 'bg-cyan-500/5' },
        warn: { ring: 'stroke-amber-500', text: 'text-amber-400', glow: 'shadow-amber-500/20', bg: 'bg-amber-500/5' },
        danger: { ring: 'stroke-red-500', text: 'text-red-400', glow: 'shadow-red-500/30', bg: 'bg-red-500/5' },
        overdue: { ring: 'stroke-red-600', text: 'text-red-500', glow: 'shadow-red-600/40', bg: 'bg-red-500/10' },
    };
    const c = colorMap[urgency];

    return (
        <div className={`relative flex items-center justify-center ${c.bg} rounded-2xl p-2 shadow-lg ${c.glow} ${urgency === 'danger' || urgency === 'overdue' ? 'animate-pulse' : ''}`}>
            <svg width={dim} height={dim} className="transform -rotate-90">
                <circle cx={dim / 2} cy={dim / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
                <circle cx={dim / 2} cy={dim / 2} r={radius}
                    className={`${c.ring} transition-all duration-1000 ease-linear`}
                    strokeWidth={stroke} fill="none" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={dashOffset} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`${isLarge ? 'text-lg' : 'text-sm'} font-black font-mono ${c.text} tracking-tight`}>{display}</span>
                {urgency === 'overdue' ? (
                    <span className="text-[8px] text-red-400 font-bold uppercase">MISSED</span>
                ) : (
                    <span className="text-[8px] text-white/30 font-bold uppercase">remaining</span>
                )}
            </div>
        </div>
    );
}

// ─── Main Dashboard ──────────────────────────────────────────────
export default function SupervisorDashboard() {
    const { logout, getSession } = useAuth();
    const user = getSession();
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, resolved: 0, missed: 0, blackPoints: 0, avgRating: 0 });
    const [sirenOn, setSirenOn] = useState(true);
    const [resolveModal, setResolveModal] = useState<{ show: boolean; ticketId: string | null }>({ show: false, ticketId: null });
    const [explanationModal, setExplanationModal] = useState<Complaint | null>(null);
    const [resPhotoData, setResPhotoData] = useState<string | null>(null);
    const [resolving, setResolving] = useState(false);
    const [activeCall, setActiveCall] = useState<Complaint | null>(null);
    const [seenTickets, setSeenTickets] = useState<Set<string>>(new Set());
    const [isSpeaking, setIsSpeaking] = useState(false);
    const sirenRef = useRef<HTMLAudioElement | null>(null);
    const timerRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

    // Notification Permission
    const requestNotifications = async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Notification permission granted.');
            }
        }
    };

    useEffect(() => {
        requestNotifications();

        // Register UID with Service Worker for Background Monitoring
        if (user?.uid && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SET_SUPERVISOR_ID',
                uid: user.uid
            });
        }

        // Wake Lock to keep screen ON
        let wakeLock: any = null;
        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await (navigator as any).wakeLock.request('screen');
                    console.log('Wake Lock active');
                }
            } catch (err) { console.warn('Wake Lock failed', err); }
        };
        requestWakeLock();

        // Re-request on visibility change
        const handleVisibilityChange = () => {
            if (wakeLock !== null && document.visibilityState === 'visible') requestWakeLock();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            wakeLock?.release();
        };
    }, []);

    const sendBrowserNotification = (c: Complaint) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🚨 NEW KAK COMPLAINT', {
                body: `${c.issueType} at Block ${c.block}. Action Required!`,
                icon: '/KAK/icon-192.png',
                tag: c.ticketId,
                vibrate: [200, 100, 200]
            } as any);
        }
    };

    // Initialize siren audio
    useEffect(() => {
        sirenRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3'); // A loud alert sound
        sirenRef.current.loop = true;
        return () => {
            sirenRef.current?.pause();
            window.speechSynthesis.cancel();
        };
    }, []);

    const playSiren = () => {
        if (sirenOn && sirenRef.current) {
            sirenRef.current.currentTime = 0;
            sirenRef.current.play().catch(e => console.log('Siren play blocked:', e));
        }
    };

    const stopSiren = () => {
        if (sirenRef.current) {
            sirenRef.current.pause();
            sirenRef.current.currentTime = 0;
        }
    };

    const speakIssue = (c: Complaint) => {
        if (!window.speechSynthesis || isSpeaking) return;
        window.speechSynthesis.cancel();
        const text = `Incoming complaint: ${c.issueType}. Location: Block ${c.block}. Reported by ${c.studentName}. Issue details: ${c.description || 'No description provided'}.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            const all = await getComplaintsForSupervisor(user.uid);

            // Detect NEW unaccepted complaints for the "Call" UI
            const newUnaccepted = all.filter(c =>
                c.status === 'pending_acceptance' &&
                !seenTickets.has(c.ticketId)
            );

            if (newUnaccepted.length > 0 && !activeCall) {
                const latest = newUnaccepted[0];
                setActiveCall(latest);
                playSiren();
                speakIssue(latest);
                sendBrowserNotification(latest);

                // Mark all current unaccepted as "seen" to prevent duplicate triggers
                setSeenTickets(prev => {
                    const next = new Set(prev);
                    newUnaccepted.forEach(c => next.add(c.ticketId));
                    return next;
                });
            }

            setComplaints(all);
            const stat = await getSupStat(user.uid);
            setStats({
                total: all.length,
                resolved: all.filter((c: Complaint) => c.resolvedOnTime).length,
                missed: all.filter((c: Complaint) => c.status === 'pending_ao' || c.status === 'closed_overdue').length,
                blackPoints: stat.blackPoints || 0,
                avgRating: stat.avgRating || 0,
            });
        } catch (err) { console.error('Sup load error', err); }
        finally { setLoading(false); }
    }, [user?.uid, seenTickets, activeCall, sirenOn, isSpeaking]);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 5000);
        return () => { clearInterval(interval); Object.values(timerRef.current).forEach(clearInterval); };
    }, [loadData]);

    if (!user) return null;

    const unaccepted = complaints.filter((c: Complaint) => c.status === 'pending_acceptance');
    const active = complaints.filter((c: Complaint) => c.status === 'pending_supervisor');
    const approval = complaints.filter((c: Complaint) => c.status === 'pending_approval');
    const aoAlerts = complaints.filter((c: Complaint) => c.status === 'pending_ao' || c.status === 'closed_overdue');
    const resolved = complaints.filter((c: Complaint) => ['resolved', 'closed', 'pending_ao_review', 'reported_to_ao'].includes(c.status));
    const hasAutoAccepted = active.some((c: Complaint) => c.autoAccepted);

    const acceptComplaint = async (c: Complaint) => {
        const now = new Date();
        const deadline = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
        await updateComplaint(c.ticketId, {
            status: 'pending_supervisor',
            supervisorDeadline: deadline,
            timeline: [...(c.timeline || []), { event: 'Complaint Accepted by Supervisor - 30m Resolution Timer Started', time: now.toISOString(), by: user.uid }],
        });
        setExplanationModal({ ...c, supervisorDeadline: deadline });
        await loadData();
    };

    const openResolveModal = (ticketId: string) => {
        setResolveModal({ show: true, ticketId });
        setResPhotoData(null);
    };

    const handleResPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setResPhotoData(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const confirmResolve = async () => {
        if (!resPhotoData || !resolveModal.ticketId) { alert('Please attach a resolution photo.'); return; }
        setResolving(true);
        try {
            const finalPhotoURL = await uploadPhotoToSupabase(resPhotoData, `${resolveModal.ticketId}_resolution.jpg`);
            const now = new Date();
            const all = await getComplaints();
            const c = all.find((x: Complaint) => x.ticketId === resolveModal.ticketId);
            const onTime = c && c.supervisorDeadline ? msUntil(c.supervisorDeadline) > 0 : false;

            await updateComplaint(resolveModal.ticketId, {
                status: 'pending_approval',
                resolvedAt: now.toISOString(),
                resolutionPhoto: finalPhotoURL,
                resolvedOnTime: onTime,
                timeline: [...(c?.timeline || []), { event: 'Supervisor Marked Resolved — Pending student review', time: now.toISOString(), by: user.uid }],
            });
            await recordResolutionStats(user.uid, onTime);
            setResolveModal({ show: false, ticketId: null });
            await loadData();
        } catch (err) {
            console.error('Resolve failed:', err);
            alert('Photo upload failed. Please wait 5 seconds and try again.');
        } finally { setResolving(false); }
    };

    const handleCallAccept = async () => {
        if (!activeCall) return;
        stopSiren();
        window.speechSynthesis.cancel();
        await acceptComplaint(activeCall);
        setActiveCall(null);
    };

    const handleCallSilence = () => {
        stopSiren();
        window.speechSynthesis.cancel();
        setActiveCall(null);
    };

    if (loading && complaints.length === 0) {
        return (
            <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f0f1a] text-white font-['Inter',sans-serif]">
            {/* Incoming Call Overlay */}
            {activeCall && (
                <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
                    {/* Animated Pulsing Background */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[120px] animate-pulse" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/30 rounded-full blur-[80px] animate-bounce" style={{ animationDuration: '3s' }} />
                    </div>

                    <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full">
                        <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-cyan-500/40 animate-bounce">
                            <Phone size={48} className="text-white animate-pulse" />
                        </div>

                        <div className="mb-8">
                            <h2 className="text-3xl font-black mb-2 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                                NEW COMPLAINT ARRIVED
                            </h2>
                            <p className="text-white/60 font-bold uppercase tracking-[0.2em] text-sm">Priority Intervention Required</p>
                        </div>

                        <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 mb-10 backdrop-blur-md">
                            <div className="flex flex-col gap-4 mb-4">
                                <div className="flex items-center justify-center gap-3">
                                    <span className="text-4xl">{ISSUE_ICONS[activeCall.issueType] || '📋'}</span>
                                    <h3 className="text-2xl font-black">{activeCall.issueType}</h3>
                                </div>
                                <div className="h-px bg-white/10 w-full" />
                                <div className="grid grid-cols-2 gap-4 text-left">
                                    <div>
                                        <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Student</p>
                                        <p className="font-bold flex items-center gap-2"><User size={14} className="text-cyan-400" /> {activeCall.studentName}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Location</p>
                                        <p className="font-bold flex items-center gap-2"><MapPin size={14} className="text-cyan-400" /> Block {activeCall.block}</p>
                                    </div>
                                </div>
                                {activeCall.description && (
                                    <div className="mt-2 p-4 bg-white/[0.03] rounded-2xl text-sm italic text-white/50 border border-white/5">
                                        "{activeCall.description}"
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full">
                            <button
                                onClick={handleCallSilence}
                                className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                            >
                                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <VolumeX size={24} className="text-white/60" />
                                </div>
                                <span className="font-bold text-sm text-white/60">Silence</span>
                            </button>

                            <button
                                onClick={handleCallAccept}
                                className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-xl shadow-emerald-500/20 transition-all group animate-pulse"
                            >
                                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <CheckCircle size={24} className="text-white" />
                                </div>
                                <span className="font-bold text-sm text-white">Accept Now</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Navbar */}
            <nav className="sticky top-0 z-50 bg-[#161625]/80 backdrop-blur-xl border-b border-white/5 py-3 px-4 md:px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src="icon-192.png" alt="KAK" className="w-9 h-9 rounded-lg" />
                    <div>
                        <span className="text-lg font-bold tracking-tight">SUPERVISOR</span>
                        <span className="hidden sm:block text-[10px] text-white/40 uppercase tracking-widest">Block {user.block || '–'} Dashboard</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setSirenOn(!sirenOn)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${sirenOn ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-white/5 border-white/5 text-white/40'
                            }`}>
                        {sirenOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        {sirenOn ? 'Siren On' : 'Siren Off'}
                    </button>
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-sm font-semibold">{user.name}</span>
                        <span className="text-[10px] text-white/40">UID: {user.uid}</span>
                    </div>
                    <button onClick={logout} className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-red-400 transition-colors">
                        <LogOut size={18} />
                    </button>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto p-4 md:p-6">
                {/* Flagged Alert */}
                {stats.blackPoints >= 5 && (
                    <div className="mb-6 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 animate-pulse">
                        <ShieldAlert size={28} className="text-red-400 flex-shrink-0" />
                        <div>
                            <div className="text-red-400 font-bold text-base">FLAGGED: Performance Under Review</div>
                            <div className="text-red-300/60 text-sm">You have accumulated {stats.blackPoints} Black Points. Contact the AO Office immediately.</div>
                        </div>
                    </div>
                )}

                {/* Auto-Accept Alert */}
                {hasAutoAccepted && (
                    <div className="mb-6 p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-4 animate-pulse">
                        <Bell size={28} className="text-amber-400 flex-shrink-0" />
                        <div>
                            <div className="text-amber-400 font-bold text-base">AUTO-ACCEPTED TASKS</div>
                            <div className="text-amber-300/60 text-sm">You missed the 10-minute acceptance window. Tasks have been auto-accepted. Resolve NOW!</div>
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
                    {[
                        { label: 'Total Assigned', value: stats.total, icon: <ChevronRight size={16} className="text-indigo-400/40" />, color: 'text-indigo-400 bg-indigo-400/5 border-indigo-400/10' },
                        { label: 'Resolved On Time', value: stats.resolved, icon: <CheckCircle size={16} className="text-emerald-400/40" />, color: 'text-emerald-400 bg-emerald-400/5 border-emerald-400/10' },
                        { label: 'Missed / Escalated', value: stats.missed, icon: <AlertTriangle size={16} className="text-red-400/40" />, color: 'text-red-400 bg-red-500/5 border-red-500/10' },
                        { label: 'Black Points', value: stats.blackPoints, icon: <Ban size={16} className="text-white/20" />, color: 'text-white bg-white/[0.03] border-white/5' },
                        { label: 'Avg Rating', value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '–', icon: <Star size={16} className="text-amber-400/40" />, color: 'text-amber-400 bg-amber-400/5 border-amber-400/10' },
                    ].map(({ label, value, icon, color }) => (
                        <div key={label} className={`p-5 rounded-2xl border ${color}`}>
                            <div className="flex items-center justify-between mb-2">{icon}<span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{label}</span></div>
                            <div className="text-3xl font-black">{value}</div>
                        </div>
                    ))}
                </div>

                {/* ── ACCEPTANCE QUEUE ── */}
                <SupSection title="Acceptance Queue" badge={unaccepted.length} color="cyan" icon={<CircleAlert size={18} className="text-cyan-400" />}>
                    {unaccepted.length === 0 ? <EmptyState text="No new complaints awaiting acceptance" /> :
                        unaccepted.map((c: Complaint) => (
                            <div key={c.ticketId} className="bg-[#161625] border border-cyan-500/10 rounded-2xl overflow-hidden">
                                <div className="p-5">
                                    <div className="flex items-start gap-5">
                                        {/* Left: Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-3">
                                                <h3 className="text-lg font-black">{c.issueType}</h3>
                                                <span className="flex items-center gap-1 text-[10px] bg-cyan-500/10 text-cyan-400 px-2.5 py-1 rounded-full border border-cyan-500/20 font-bold">
                                                    <CircleAlert size={10} /> New Request
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-white/50 mb-3">
                                                <span className="flex items-center gap-1.5"><MapPin size={12} className="text-white/25" /> Block {c.block}</span>
                                                <span className="flex items-center gap-1.5"><User size={12} className="text-white/25" /> {c.studentName}</span>
                                                <span className="flex items-center gap-1.5"><Phone size={12} className="text-white/25" /> {c.phone || '–'}</span>
                                                <span className="flex items-center gap-1.5"><Clock size={12} className="text-white/25" /> Submitted: {formatTime(new Date(c.submittedAt))}</span>
                                            </div>
                                            {c.description && <div className="text-sm text-white/40 italic bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">"{c.description}"</div>}
                                            <span className="text-[11px] text-white/20 font-mono mt-2 block">{c.ticketId}</span>
                                        </div>

                                        {/* Right: Timer */}
                                        <div className="flex-shrink-0">
                                            {c.acceptanceDeadline && (
                                                <PremiumTimer ticketId={c.ticketId} deadline={c.acceptanceDeadline} totalMs={10 * 60 * 1000} timerRef={timerRef} size="large" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Photo Preview */}
                                    {c.photo && (
                                        <ClickablePhoto src={c.photo} alt="Student complaint" label="Student's Complaint Photo" className="mt-4 max-h-48 rounded-xl overflow-hidden" />
                                    )}
                                </div>

                                {/* Accept Button */}
                                <button onClick={() => acceptComplaint(c)}
                                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-4 font-bold text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/10">
                                    <Zap size={18} /> Accept & Start 30m Timer
                                </button>
                            </div>
                        ))}
                </SupSection>

                {/* ── ACTIVE TASKS ── */}
                <SupSection title="Active Tasks" badge={active.length} color="red" icon={<CircleAlert size={18} className="text-red-400" />}>
                    {active.length === 0 ? <EmptyState text="No active tasks" /> :
                        active.map((c: Complaint) => (
                            <div key={c.ticketId} className={`bg-[#161625] border rounded-2xl overflow-hidden ${c.autoAccepted ? 'border-amber-500/20 ring-2 ring-amber-500/10' : 'border-white/5'}`}>
                                <div className="p-5">
                                    <div className="flex items-start gap-5">
                                        {/* Left: Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-3">
                                                <h3 className="text-lg font-black">{c.issueType}</h3>
                                                {c.autoAccepted ? (
                                                    <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/20 font-bold animate-pulse">
                                                        <Bell size={10} /> AUTO-ACCEPTED
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full border border-red-500/20 font-bold">
                                                        <CircleAlert size={10} /> Active
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-white/50 mb-3">
                                                <span className="flex items-center gap-1.5"><MapPin size={12} className="text-white/25" /> Block {c.block}</span>
                                                <span className="flex items-center gap-1.5"><User size={12} className="text-white/25" /> {c.studentName}</span>
                                                <span className="flex items-center gap-1.5"><Phone size={12} className="text-white/25" /> {c.phone || '–'}</span>
                                                <span className="flex items-center gap-1.5"><ChevronRight size={12} className="text-white/25" /> Reg: {c.regNo || '–'}</span>
                                            </div>
                                            {c.description && <div className="text-sm text-white/40 italic bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">"{c.description}"</div>}
                                            <span className="text-[11px] text-white/20 font-mono mt-2 block">{c.ticketId}</span>
                                        </div>

                                        {/* Right: Timer */}
                                        <div className="flex-shrink-0">
                                            {c.supervisorDeadline && (
                                                <PremiumTimer ticketId={c.ticketId} deadline={c.supervisorDeadline} totalMs={30 * 60 * 1000} timerRef={timerRef} size="large" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Photo */}
                                    {c.photo && (
                                        <ClickablePhoto src={c.photo} alt="Student complaint" label="Student's Complaint Photo — Click to zoom" className="mt-4 max-h-52 rounded-xl overflow-hidden" />
                                    )}
                                </div>

                                {/* Resolve Button */}
                                <button onClick={() => openResolveModal(c.ticketId)}
                                    className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 py-4 font-bold text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10">
                                    <CheckCircle size={18} /> Mark as Resolved
                                </button>
                            </div>
                        ))}
                </SupSection>

                {/* ── AWAITING STUDENT APPROVAL ── */}
                <SupSection title="Awaiting Student Approval" badge={approval.length} color="amber" icon={<Clock size={18} className="text-amber-400" />}>
                    {approval.length === 0 ? <EmptyState text="No tasks awaiting student approval" /> :
                        approval.map((c: Complaint) => (
                            <div key={c.ticketId} className="bg-[#161625]/80 border border-white/5 rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-base">{c.issueType}</span>
                                    <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/20 font-bold">
                                        <Clock size={10} /> Awaiting Student
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-white/40 mb-2">
                                    <MapPin size={12} /> {c.block}
                                    <span className="text-white/10">·</span>
                                    <User size={12} /> {c.studentName}
                                    <span className="text-white/10">·</span>
                                    Resolved at {c.resolvedAt ? formatDateTime(new Date(c.resolvedAt)) : '–'}
                                </div>
                                {(c.resolutionPhoto || c.supervisorPhoto) && (
                                    <ClickablePhoto src={(c.resolutionPhoto || c.supervisorPhoto)!} alt="Your resolution" label="Your Resolution Photo" className="max-h-32 rounded-xl overflow-hidden mt-2" />
                                )}
                                <span className="text-[11px] text-white/20 font-mono mt-2 block">{c.ticketId}</span>
                            </div>
                        ))}
                </SupSection>

                {/* ── AO ESCALATIONS ── */}
                <SupSection title="AO Escalations" badge={aoAlerts.length} color="red" icon={<AlertTriangle size={18} className="text-red-400" />}>
                    {aoAlerts.length === 0 ? <EmptyState text="No escalations" /> :
                        aoAlerts.map((c: Complaint) => (
                            <div key={c.ticketId} className="bg-[#161625]/80 border border-red-500/10 rounded-2xl p-5">
                                <div className="flex items-start gap-5">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="font-bold text-base text-red-400 flex items-center gap-1.5"><AlertTriangle size={16} /> {c.issueType}</span>
                                            <span className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border font-bold ${c.status === 'closed_overdue' ? 'bg-white/5 text-white/60 border-white/10' : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                }`}>
                                                {c.status === 'closed_overdue' ? <><Ban size={10} /> Black Point</> : <><CircleAlert size={10} /> AO Handling</>}
                                            </span>
                                        </div>
                                        <div className="text-sm text-white/40 flex flex-wrap gap-x-3 items-center">
                                            <span className="flex items-center gap-1"><MapPin size={11} /> {c.block}</span>
                                            <span className="flex items-center gap-1"><User size={11} /> {c.studentName}</span>
                                            <span>Escalated at {c.aoAlertAt ? formatDateTime(new Date(c.aoAlertAt)) : '–'}</span>
                                        </div>
                                        {c.description && <div className="text-sm text-white/30 italic mt-2">"{c.description}"</div>}
                                        <span className="text-[11px] text-white/20 font-mono mt-2 block">{c.ticketId}</span>
                                    </div>
                                    {c.status === 'pending_ao' && c.aoDeadline && (
                                        <PremiumTimer ticketId={'ao-' + c.ticketId} deadline={c.aoDeadline} totalMs={30 * 60 * 1000} timerRef={timerRef} />
                                    )}
                                </div>
                            </div>
                        ))}
                </SupSection>

                {/* ── RESOLVED ── */}
                <SupSection title="Resolved" badge={resolved.length} color="emerald" icon={<CheckCircle size={18} className="text-emerald-400" />}>
                    {resolved.length === 0 ? <EmptyState text="No resolved complaints yet" /> :
                        resolved.map((c: Complaint) => (
                            <div key={c.ticketId} className="bg-[#161625]/80 border border-white/5 rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-base flex items-center gap-1.5"><CheckCircle size={16} className="text-emerald-400" /> {c.issueType}</span>
                                    <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 font-bold">
                                        <CheckCircle size={10} /> Resolved
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-white/40 mb-1">
                                    <MapPin size={12} /> {c.block}
                                    <span className="text-white/10">·</span>
                                    <User size={12} /> {c.studentName}
                                    <span className="text-white/10">·</span>
                                    {c.resolvedAt ? formatDateTime(new Date(c.resolvedAt)) : formatDateTime(new Date(c.submittedAt))}
                                </div>
                                {c.studentRating ? (
                                    <div className="flex items-center gap-1.5 text-sm text-amber-400 font-bold mt-1">
                                        <Star size={14} className="fill-amber-400" /> {c.studentRating}/5 by student
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-white/20 mt-1 italic">Rating pending from student.</div>
                                )}
                                {/* AO Notes for Supervisor */}
                                {(() => {
                                    const aoNote = c.timeline?.find(t => t.vendorNote);
                                    if (!aoNote) return null;
                                    return (
                                        <div className="mt-3 p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <MessageSquare size={13} className="text-indigo-400/60" />
                                                <span className="text-[10px] text-indigo-400/70 font-bold uppercase tracking-widest">AO Office Note — For You</span>
                                            </div>
                                            <p className="text-sm text-white/60 leading-relaxed">"{aoNote.vendorNote}"</p>
                                        </div>
                                    );
                                })()}
                                <span className="text-[11px] text-white/20 font-mono mt-2 block">{c.ticketId}</span>
                            </div>
                        ))}
                </SupSection>
            </main>

            {/* Resolve Modal */}
            {resolveModal.show && (
                // ... (existing resolve modal)
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-md">
                        <div className="flex items-center gap-2 mb-1"><Camera size={20} className="text-cyan-400" /><h3 className="text-lg font-black">Upload Resolution Photo</h3></div>
                        <p className="text-white/40 text-xs mb-1">Ticket: <span className="font-mono text-white/60">{resolveModal.ticketId}</span></p>
                        <p className="text-white/30 text-xs mb-4">Take a clear after-photo to prove the issue has been resolved.</p>

                        {!resPhotoData ? (
                            <label className="flex flex-col items-center justify-center gap-2 py-12 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-cyan-500/30 hover:bg-white/[0.02] transition-all mb-4">
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleResPhotoChange} />
                                <Camera size={36} className="text-white/20" />
                                <span className="text-sm text-white/50 font-bold">Tap to capture or upload resolution photo</span>
                                <span className="text-[10px] text-white/20">JPG, PNG, WEBP · Max 10 MB</span>
                            </label>
                        ) : (
                            <div className="relative mb-4">
                                <img src={resPhotoData} alt="Resolution" className="w-full max-h-48 object-cover rounded-xl" />
                                <button onClick={() => setResPhotoData(null)} className="absolute top-2 right-2 bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"><X size={16} /></button>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setResolveModal({ show: false, ticketId: null })} className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl font-bold text-sm transition-all">Cancel</button>
                            <button onClick={confirmResolve} disabled={resolving || !resPhotoData}
                                className="flex-1 bg-gradient-to-r from-emerald-600 to-cyan-600 py-3 rounded-xl font-bold text-sm disabled:opacity-30 transition-all flex items-center justify-center gap-2">
                                {resolving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</> : <><CheckCircle size={16} /> Confirm Resolved</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Post-Acceptance Explanation Modal */}
            {explanationModal && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-[#1a1a2e] border border-cyan-500/20 rounded-[32px] p-8 w-full max-w-xl shadow-2xl shadow-cyan-500/10">
                        <div className="flex flex-col items-center text-center mb-8">
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle size={32} className="text-emerald-400" />
                            </div>
                            <h3 className="text-2xl font-black mb-1">TASK INITIALIZED</h3>
                            <p className="text-white/40 text-sm">Follow instructions below for resolution</p>
                        </div>

                        <div className="space-y-6 mb-8">
                            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-3xl">{ISSUE_ICONS[explanationModal.issueType] || '📋'}</span>
                                    <div>
                                        <p className="text-[10px] text-white/30 uppercase font-black tracking-widest leading-none mb-1">Assigned Issue</p>
                                        <p className="text-xl font-black">{explanationModal.issueType}</p>
                                    </div>
                                </div>
                                <div className="h-px bg-white/5 mb-4" />
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-start gap-2.5">
                                        <MapPin size={16} className="text-cyan-400 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-0.5">Location</p>
                                            <p className="text-sm font-bold">Block {explanationModal.block}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <Clock size={16} className="text-amber-400 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-0.5">Time Limit</p>
                                            <p className="text-sm font-bold text-amber-400">30 Minutes</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                                <div className="flex items-center gap-2 mb-2 text-indigo-400">
                                    <Zap size={16} className="fill-indigo-400" />
                                    <span className="text-xs font-black uppercase tracking-widest">Resolution Steps</span>
                                </div>
                                <ul className="text-sm text-white/60 space-y-2 list-disc pl-4">
                                    <li>Go to <span className="text-white font-bold">Block {explanationModal.block}</span> immediately.</li>
                                    <li>Perform necessary repairs or cleaning for <span className="text-white font-bold">{explanationModal.issueType}</span>.</li>
                                    <li>Once fixed, click <span className="text-emerald-400 font-bold">"Mark as Resolved"</span>.</li>
                                    <li>You <span className="text-white font-bold underline">MUST</span> take a photo of the completed work.</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-4">
                            <div className="flex items-center gap-4 bg-white/5 px-6 py-3 rounded-2xl border border-white/5 w-full justify-between">
                                <span className="text-sm text-white/40 font-bold">Time remaining for resolution:</span>
                                {explanationModal.supervisorDeadline && (
                                    <PremiumTimer ticketId={`expl-${explanationModal.ticketId}`} deadline={explanationModal.supervisorDeadline} totalMs={30 * 60 * 1000} timerRef={timerRef} />
                                )}
                            </div>
                            <button onClick={() => setExplanationModal(null)}
                                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-4 rounded-2xl font-black text-lg transition-all shadow-xl shadow-cyan-500/20">
                                I UNDERSTAND, START NOW
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Sub-components ──

function SupSection({ title, badge, color, icon, children }: { title: string; badge: number; color: string; icon: React.ReactNode; children: React.ReactNode }) {
    const colorMap: Record<string, string> = {
        cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        red: 'bg-red-500/10 text-red-400 border-red-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    };
    return (
        <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">{icon}<h2 className="text-lg font-black">{title}</h2></div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${colorMap[color] || ''}`}>{badge}</span>
            </div>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="py-12 text-center bg-white/[0.02] border border-dashed border-white/5 rounded-2xl text-white/30 text-sm italic">
            {text}
        </div>
    );
}
