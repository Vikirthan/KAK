import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, Plus, QrCode, ClipboardList, CheckCircle2, AlertTriangle, Clock, Star, Camera, Info, Send, MapPin, Wrench, ZoomIn, X, ArrowLeft, ChevronRight, ShowerHead, BarChart3, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getComplaints, addComplaint, updateComplaint, uploadPhotoToSupabase, getStats } from '../services/complaintService';
import { sendPushToSupervisor } from '../services/pushService';
import { addRatingToStats } from '../services/statService';
import { STUDENT_PROFILES, BLOCK_OPTIONS, ISSUE_TYPES, STATUS_META, generateTicketId, formatDateTime, msUntil, formatCountdown } from '../lib/types';
import type { Complaint } from '../lib/types';

const QR_LOCATION_MAP: Record<string, string> = {
    B36F1: '36-2nd',
    B36F2: '36-3rd',
    B36F5: '36-5th',
};

function resolveQrToBlock(input: string): string | null {
    const raw = (input || '').trim();
    if (!raw) return null;

    // Case 1: Full URL payload like ...#/student?loc=B36F1 or ...?block=36-2nd
    try {
        const maybeUrl = new URL(raw);
        const hash = maybeUrl.hash || '';
        const queryPart = hash.includes('?') ? hash.split('?')[1] : maybeUrl.search.slice(1);
        const params = new URLSearchParams(queryPart);
        const loc = (params.get('loc') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const block = (params.get('block') || '').trim();
        if (loc && QR_LOCATION_MAP[loc]) return QR_LOCATION_MAP[loc];
        if (block && BLOCK_OPTIONS.some((o) => o.value === block)) return block;
    } catch {
        // Not a URL payload. Continue parsing as plain code/text.
    }

    // Case 2: Code payload like B36F1
    const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (QR_LOCATION_MAP[compact]) return QR_LOCATION_MAP[compact];

    // Case 3: Human-readable payload like "block-36-floor-2nd" or "Block 36 Level 5"
    const normalized = raw
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/_/g, '-')
        .replace(/level/g, 'floor')
        .replace(/[^a-z0-9-]/g, '');

    const match = normalized.match(/block-?(\d+).*floor-?(\d+|1st|2nd|3rd|5th)/);
    if (match) {
        const blockNo = match[1];
        const floor = match[2];
        const floorMap: Record<string, string> = {
            '1': '1st',
            '2': '2nd',
            '3': '3rd',
            '5': '5th',
            '1st': '1st',
            '2nd': '2nd',
            '3rd': '3rd',
            '5th': '5th',
        };
        const value = `${blockNo}-${floorMap[floor] || floor}`;
        if (BLOCK_OPTIONS.some((o) => o.value === value)) return value;
    }

    return null;
}

export default function StudentDashboard() {
    const { logout, getSession } = useAuth();
    const location = useLocation();
    const user = getSession();
    console.log('[DEBUG] StudentDashboard rendering for user:', user?.uid);
    const [view, setView] = useState<'dashboard' | 'form'>('dashboard');
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [globalStats, setGlobalStats] = useState({ total: 0, resolved: 0 });
    const [loading, setLoading] = useState(true);
    const [ratingModal, setRatingModal] = useState<{ show: boolean; ticketId: string | null }>({ show: false, ticketId: null });
    const [chosenRating, setChosenRating] = useState(0);
    const [ratingComment, setRatingComment] = useState('');
    const timerRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

    // Form state
    const [formData, setFormData] = useState({ name: '', regNo: '', phone: '', block: '', issueType: '', description: '' });
    const [photoData, setPhotoData] = useState<string | null>(null);
    const [declaration, setDeclaration] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState<{ ticketId: string } | null>(null);
    const [formStep, setFormStep] = useState(1);

    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            const [mine, global] = await Promise.all([
                getComplaints({ studentUID: user.uid }),
                getStats(),
            ]);
            setComplaints(mine);
            setGlobalStats(global);
        } catch (err) { console.error('Failed to load data', err); }
        finally { setLoading(false); }
    }, [user?.uid]);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 8000);
        return () => { clearInterval(interval); Object.values(timerRef.current).forEach(clearInterval); };
    }, [loadData]);

    // Pre-fill student info
    useEffect(() => {
        if (user) {
            const profile = STUDENT_PROFILES[user.uid];
            if (profile) setFormData(prev => ({ ...prev, name: profile.name, regNo: profile.regNo, phone: profile.phone }));
        }
    }, [user?.uid]);

    // QR/deep-link prefill: #/student?loc=B36F1 or #/student?block=36-2nd
    useEffect(() => {
        if (!user) return;

        const query = location.search || '';
        if (!query) return;

        const params = new URLSearchParams(query);
        const loc = params.get('loc') || '';
        const block = params.get('block') || '';
        const candidate = resolveQrToBlock(loc || block || query);
        if (!candidate) return;

        setFormData((prev) => ({ ...prev, block: candidate }));
        setView('form');
        setFormStep(2);
    }, [user?.uid, location.search]);

    if (!user) return null;

    const mine = complaints;
    const total = mine.length;
    const resolved = mine.filter((c: Complaint) => ['resolved', 'closed', 'ao_resolved'].includes(c.status)).length;
    const missed = mine.filter((c: Complaint) => ['pending_ao', 'closed_overdue', 'escalated_to_vendor'].includes(c.status)).length;
    const pending = mine.filter((c: Complaint) => ['pending_acceptance', 'pending_supervisor', 'pending_approval', 'pending_ao_review'].includes(c.status)).length;
    const globalTotal = globalStats.total;
    const globalResolved = globalStats.resolved;

    const needsRating = mine.find((c: Complaint) => c.status === 'pending_approval');

    // Greeting
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    const openForm = async () => {
        if (needsRating) {
            setRatingModal({ show: true, ticketId: needsRating.ticketId });
            return;
        }
        setView('form');
        setFormStep(1);
    };

    const handleScanQrClick = () => {
        const payload = window.prompt('Paste scanned QR value (URL or code):\nExamples: B36F1, B36F2, B36F5');
        if (!payload) return;

        const mapped = resolveQrToBlock(payload);
        if (!mapped) {
            alert('Invalid QR value. Use a valid KAK location QR.');
            return;
        }

        setFormData((prev) => ({ ...prev, block: mapped }));
        setView('form');
        setFormStep(2);
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { alert('Photo must be under 10 MB.'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoData(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('[DEBUG] Submit button clicked!');
        
        // Detailed validation logs
        if (!formData.name) console.warn('[DEBUG] Missing field: name');
        if (!formData.regNo) console.warn('[DEBUG] Missing field: regNo');
        if (!formData.phone) console.warn('[DEBUG] Missing field: phone');
        if (!formData.block) console.warn('[DEBUG] Missing field: block');
        if (!formData.issueType) console.warn('[DEBUG] Missing field: issueType');
        if (!photoData) console.warn('[DEBUG] Missing field: photoData');
        if (!declaration) console.warn('[DEBUG] Missing field: declaration');

        if (!formData.name || !formData.regNo || !formData.phone || !formData.block || !formData.issueType || !photoData || !declaration) {
            alert('Please fill all required fields, attach a photo, and confirm the declaration.');
            return;
        }
        setSubmitting(true);
        try {
            const ticketId = generateTicketId();
            const finalPhotoURL = await uploadPhotoToSupabase(photoData, `${ticketId}_issue.jpg`);
            const now = new Date();
            
            const blockNum = formData.block.split('-')[0];
            const assignedSupervisor = 'SUP-' + blockNum; 
            console.log('[DEBUG] Dynamic assignment to:', assignedSupervisor);

            const complaint: Complaint = {
                ticketId,
                studentUID: user.uid,
                studentName: formData.name,
                regNo: formData.regNo,
                phone: formData.phone,
                block: formData.block,
                issueType: formData.issueType,
                description: formData.description,
                photo: finalPhotoURL,
                status: 'pending_acceptance',
                submittedAt: now.toISOString(),
                acceptanceDeadline: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
                assignedSupervisor: assignedSupervisor,
                supervisorPhoto: null,
                studentApproved: false,
                escalated: false,
                timeline: [{ event: 'Complaint Registered - Awaiting Supervisor Acceptance', time: now.toISOString(), by: 'student' }],
            };
            await addComplaint(complaint);
            console.log('[DEBUG] Complaint added successfully. Triggering push for supervisor:', complaint.assignedSupervisor);

            // Trigger server-side push notification to supervisor (works even when app is closed)
            sendPushToSupervisor(complaint.assignedSupervisor, {
                ticketId: complaint.ticketId,
                issueType: complaint.issueType,
                block: complaint.block,
                studentName: complaint.studentName,
                description: complaint.description,
            })
                .then(res => console.log('[DEBUG] Push service result:', res))
                .catch(err => console.error('[DEBUG] Push service crash:', err));

            setSubmitSuccess({ ticketId });
            await loadData();
        } catch (err) {
            console.error('Submit failed', err);
            alert('Submission failed. Please try again.');
        } finally { setSubmitting(false); }
    };

    const handleApprove = (ticketId: string) => {
        setChosenRating(0);
        setRatingComment('');
        setRatingModal({ show: true, ticketId });
    };



    const submitRating = async () => {
        console.log('[DEBUG] submitRating started | Rating:', chosenRating, 'Ticket:', ratingModal.ticketId);
        if (!chosenRating || !ratingModal.ticketId) return;
        const c = mine.find((x: Complaint) => x.ticketId === ratingModal.ticketId);
        if (!c) return;

        if (chosenRating < 3) {
            await updateComplaint(ratingModal.ticketId, {
                status: 'pending_ao_review',
                studentRating: chosenRating,
                studentApproved: true,
                timeline: [...(c.timeline || []), { event: `Low Rating Review: Forwarded to AO Office (Rated ${chosenRating}/5)`, note: ratingComment, time: new Date().toISOString(), by: user.uid }],
            });
        } else {
            await updateComplaint(ratingModal.ticketId, {
                status: 'resolved',
                studentRating: chosenRating,
                studentApproved: true,
                timeline: [...(c.timeline || []), { event: `Resolution Approved by Student. Rated ${chosenRating}/5`, note: ratingComment, time: new Date().toISOString(), by: user.uid }],
            });
        }

        // Cleanup: Delete both issue photo and resolution photo from storage when closed
        import('../services/complaintService').then(({ deletePhotoFromSupabase }) => {
            if (c.photo) deletePhotoFromSupabase(c.photo).catch(e => console.error('SD: Photo clear fail', e));
            if (c.resolutionPhoto) deletePhotoFromSupabase(c.resolutionPhoto).catch(e => console.error('SD: ResPhoto clear fail', e));
        });

        await addRatingToStats(c.assignedSupervisor, chosenRating, ratingModal.ticketId);
        setRatingModal({ show: false, ticketId: null });
        await loadData();
    };

    const resetForm = () => {
        const profile = STUDENT_PROFILES[user.uid];
        setFormData({ name: profile?.name || '', regNo: profile?.regNo || '', phone: profile?.phone || '', block: '', issueType: '', description: '' });
        setPhotoData(null);
        setDeclaration(false);
        setSubmitSuccess(null);
        setFormStep(1);
    };

    if (loading && complaints.length === 0) {
        return (
            <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f0f1a] text-white font-['Inter',sans-serif]">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 bg-[#161625]/80 backdrop-blur-xl border-b border-white/5 py-3 px-4 md:px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src="icon-192.png" alt="KAK" className="w-9 h-9 rounded-lg" />
                    <div>
                        <span className="text-lg font-bold tracking-tight">KAK</span>
                        <span className="hidden sm:block text-[10px] text-white/40 uppercase tracking-widest">Hygiene System · LPU</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-sm font-semibold">{user.name}</span>
                        <span className="text-[10px] text-white/40">UID: {user.uid}</span>
                    </div>
                    <button onClick={logout} className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-red-400 transition-colors">
                        <LogOut size={18} />
                    </button>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto p-4 md:p-6">
                {/* === DASHBOARD VIEW === */}
                {view === 'dashboard' && !submitSuccess && (
                    <>
                        {/* Welcome Banner */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 p-6 bg-gradient-to-br from-indigo-600/10 to-transparent border border-indigo-500/10 rounded-2xl">
                            <div>
                                <h1 className="text-xl md:text-2xl font-black">Good {greet}, {user.name.split(' ')[0]}</h1>
                                <p className="text-white/40 text-sm mt-1">Here's a summary of your hygiene complaints at LPU.</p>
                            </div>
                            <div className="flex gap-2">
                                <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all" onClick={handleScanQrClick}>
                                    <QrCode size={16} /> Scan QR
                                </button>
                                <button className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20" onClick={openForm}>
                                    <Plus size={16} /> New Complaint
                                </button>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            {[
                                { label: 'My Complaints', value: total, icon: ClipboardList, color: 'text-indigo-400 bg-indigo-400/5 border-indigo-400/10' },
                                { label: 'Resolved On Time', value: resolved, icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-400/5 border-emerald-400/10' },
                                { label: 'Missed Deadline', value: missed, icon: AlertTriangle, color: 'text-red-400 bg-red-500/5 border-red-500/10' },
                                { label: 'In Progress', value: pending, icon: Clock, color: 'text-amber-400 bg-amber-400/5 border-amber-400/10' },
                            ].map(({ label, value, icon: Icon, color }) => (
                                <div key={label} className={`p-4 rounded-2xl border ${color} hover:bg-white/[0.02] transition-all`}>
                                    <Icon size={18} className="mb-2 opacity-60" />
                                    <div className="text-2xl font-black">{value}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">{label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Global Stats */}
                        <div className="flex items-center gap-4 p-4 mb-6 bg-purple-500/5 border border-purple-500/10 rounded-2xl">
                            <BarChart3 size={24} className="text-purple-400/60 flex-shrink-0" />
                            <div className="flex-1">
                                <h4 className="text-purple-400 text-[11px] font-bold uppercase tracking-wider">Global System Impact</h4>
                                <p className="text-white/40 text-xs">Real-time stats across all blocks and students.</p>
                            </div>
                            <div className="text-center px-4 border-l border-white/5">
                                <div className="text-lg font-black">{globalTotal}</div>
                                <div className="text-[9px] text-white/40 uppercase">Total Received</div>
                            </div>
                            <div className="text-center px-4 border-l border-white/5">
                                <div className="text-lg font-black text-emerald-400">{globalResolved}</div>
                                <div className="text-[9px] text-white/40 uppercase">Total Solved</div>
                            </div>
                        </div>

                        {/* Complaints List */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-black">My Complaints</h2>
                            <span className="text-xs bg-white/5 px-3 py-1 rounded-full text-white/40 font-bold">{total} total</span>
                        </div>

                        {mine.length === 0 ? (
                            <div className="py-16 text-center bg-white/[0.02] border border-dashed border-white/5 rounded-2xl">
                                <ShowerHead size={40} className="mx-auto mb-3 text-white/20" />
                                <h3 className="font-bold text-lg">No complaints yet</h3>
                                <p className="text-white/40 text-sm mt-1 mb-4">Spotted an issue? Tap below to report it instantly.</p>
                                <button onClick={openForm} className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 rounded-xl font-bold text-sm">
                                    <Plus size={16} className="inline mr-1" /> Raise a Complaint
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {[...mine].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).map((c: Complaint) => (
                                    <ComplaintCard key={c.ticketId} complaint={c} onApprove={handleApprove} timerRef={timerRef} />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* === FORM VIEW === */}
                {view === 'form' && !submitSuccess && (
                    <div className="max-w-2xl mx-auto">
                        <div className="flex items-center gap-3 mb-6">
                            <button onClick={() => { setView('dashboard'); resetForm(); }} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/60"><ArrowLeft size={20} /></button>
                            <div className="flex-1">
                                <h1 className="text-xl font-black">New Complaint</h1>
                                <p className="text-white/40 text-xs">Restroom hygiene issue report</p>
                            </div>
                            <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-3 py-1 rounded-full border border-indigo-500/20 flex items-center gap-1"><ChevronRight size={10} /> Student</span>
                        </div>

                        {/* Progress Steps */}
                        <div className="flex items-center gap-1 mb-6">
                            {['Your Info', 'Location', 'Photo', 'Submit'].map((label, i) => (
                                <div key={label} className="flex items-center gap-1 flex-1">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${i + 1 < formStep ? 'bg-emerald-500 border-emerald-500 text-white' :
                                        i + 1 === formStep ? 'bg-indigo-500 border-indigo-500 text-white' :
                                            'bg-white/5 border-white/10 text-white/30'
                                        }`}>
                                        {i + 1 < formStep ? '✓' : i + 1}
                                    </div>
                                    <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider hidden sm:block">{label}</span>
                                    {i < 3 && <div className="flex-1 h-px bg-white/5 mx-1" />}
                                </div>
                            ))}
                        </div>

                        {/* Info Box */}
                        <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl mb-6 text-xs text-amber-300/80">
                            <Clock size={16} className="text-amber-400/60 flex-shrink-0" />
                            <span>Your complaint is assigned to the block supervisor immediately. Issues must be resolved within <b>30 minutes</b> — otherwise it escalates to the AO Office automatically.</span>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Card 1: Student Info */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                                <p className="text-sm font-bold mb-4 flex items-center gap-2">Student Information <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full flex items-center gap-0.5"><Info size={8} /> Auto-filled</span></p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Full Name *</label>
                                        <input value={formData.name} readOnly className="w-full bg-white/[0.03] border border-white/5 rounded-lg py-2.5 px-3 text-sm text-white/60 cursor-not-allowed" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Registration No. *</label>
                                        <input value={formData.regNo} readOnly className="w-full bg-white/[0.03] border border-white/5 rounded-lg py-2.5 px-3 text-sm text-white/60 cursor-not-allowed" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Mobile Number *</label>
                                        <input value={formData.phone} readOnly className="w-full bg-white/[0.03] border border-white/5 rounded-lg py-2.5 px-3 text-sm text-white/60 cursor-not-allowed" />
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Location */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                                <p className="text-sm font-bold mb-4">Restroom Location</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Block – Floor *</label>
                                        <select value={formData.block} onChange={(e) => { setFormData(prev => ({ ...prev, block: e.target.value })); setFormStep(Math.max(formStep, 2)); }}
                                            className="w-full bg-white/[0.04] border border-white/5 rounded-lg py-2.5 px-3 text-sm text-white appearance-none outline-none focus:border-indigo-500/50">
                                            <option value="" disabled>— Select your block & floor —</option>
                                            {BLOCK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Issue Type *</label>
                                        <select value={formData.issueType} onChange={(e) => setFormData(prev => ({ ...prev, issueType: e.target.value }))}
                                            className="w-full bg-white/[0.04] border border-white/5 rounded-lg py-2.5 px-3 text-sm text-white appearance-none outline-none focus:border-indigo-500/50">
                                            <option value="" disabled>— Select issue type —</option>
                                            {ISSUE_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Brief Description <span className="text-white/20">(optional)</span></label>
                                    <textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value.slice(0, 300) }))}
                                        placeholder="Describe the issue briefly…" maxLength={300}
                                        className="w-full bg-white/[0.04] border border-white/5 rounded-lg py-2.5 px-3 text-sm text-white outline-none focus:border-indigo-500/50 min-h-[80px] resize-none" />
                                    <span className="text-[10px] text-white/20 block text-right">{formData.description.length} / 300</span>
                                </div>
                            </div>

                            {/* Card 3: Photo */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                                <p className="text-sm font-bold mb-4">Attach Photo Evidence</p>
                                {!photoData ? (
                                    <label className="flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-indigo-500/30 hover:bg-white/[0.02] transition-all">
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handlePhotoChange(e); setFormStep(Math.max(formStep, 3)); }} />
                                        <Camera size={32} className="text-white/20" />
                                        <span className="text-sm text-white/50">Tap to take a photo or upload from gallery</span>
                                        <span className="text-[10px] text-white/20">JPG, PNG, WEBP · Max 10 MB</span>
                                    </label>
                                ) : (
                                    <div className="relative">
                                        <img src={photoData} alt="Preview" className="w-full max-h-60 object-cover rounded-xl" />
                                        <button type="button" onClick={() => setPhotoData(null)} className="absolute top-2 right-2 bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"><X size={16} /></button>
                                    </div>
                                )}
                                <div className="flex items-start gap-2 mt-3 text-[10px] text-white/30">
                                    <Info size={12} className="flex-shrink-0 mt-0.5" />
                                    <span>After your issue is resolved and approved by you, the photo is permanently deleted from our servers.</span>
                                </div>
                            </div>

                            {/* Declaration */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" checked={declaration} onChange={(e) => { setDeclaration(e.target.checked); if (e.target.checked) setFormStep(4); }}
                                        className="mt-1 w-4 h-4 rounded border-white/10 bg-white/5 accent-indigo-500" />
                                    <span className="text-xs text-white/50 leading-relaxed">
                                        I confirm the information provided is accurate and this report is genuine. False reports may lead to disciplinary action.
                                    </span>
                                </label>
                            </div>

                            {/* Submit */}
                            <button type="submit" disabled={submitting}
                                onClick={() => {
                                    console.log('[DEBUG] Button clicked!');
                                    if (submitting) console.warn('[DEBUG] Button is DISABLED (currently submitting)');
                                }}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20">
                                {submitting ? (
                                    <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</>
                                ) : (
                                    <><Send size={16} /> Submit Complaint</>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* === SUCCESS VIEW === */}
                {submitSuccess && (
                    <div className="max-w-lg mx-auto text-center py-12">
                        <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-400" />
                        <h2 className="text-2xl font-black mb-2">Complaint Submitted!</h2>
                        <p className="text-white/40 text-sm mb-6">Your complaint has been forwarded to the block supervisor. You'll be notified once it's resolved.</p>
                        <div className="bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-xl font-mono font-black text-indigo-400 mb-8 inline-block">{submitSuccess.ticketId}</div>
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => { setSubmitSuccess(null); setView('dashboard'); resetForm(); }} className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 rounded-xl font-bold text-sm">View Dashboard</button>
                            <button onClick={() => { setSubmitSuccess(null); resetForm(); }} className="bg-white/5 hover:bg-white/10 border border-white/5 px-6 py-3 rounded-xl font-bold text-sm transition-all">Submit Another</button>
                        </div>
                    </div>
                )}
            </main>

            {/* Rating Modal */}
            {ratingModal.show && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-black mb-1 flex items-center gap-2"><Star size={20} className="text-amber-400" /> Rate the Resolution</h3>
                        <p className="text-white/40 text-sm mb-6">How satisfied are you with how the issue was resolved?</p>
                        <div className="flex justify-center gap-2 mb-4">
                            {[1, 2, 3, 4, 5].map(n => (
                                <button key={n} onClick={() => setChosenRating(n)}
                                    className={`transition-transform hover:scale-110 ${n <= chosenRating ? '' : 'opacity-30'}`}>
                                    <Star size={28} className={n <= chosenRating ? 'text-amber-400 fill-amber-400' : 'text-white/20'} />
                                </button>
                            ))}
                        </div>
                        <textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)}
                            placeholder="Any additional feedback? (Optional)" rows={3}
                            className="w-full bg-white/[0.04] border border-white/5 rounded-xl px-3 py-2 text-sm text-white outline-none resize-none mb-4" />
                        <div className="flex gap-3">
                            <button onClick={() => setRatingModal({ show: false, ticketId: null })} className="flex-1 bg-white/5 hover:bg-white/10 py-2.5 rounded-xl font-bold text-sm transition-all">Cancel</button>
                            <button onClick={submitRating} disabled={!chosenRating} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 rounded-xl font-bold text-sm disabled:opacity-30 transition-all">Submit Rating</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Complaint Card Component ──
function ComplaintCard({ complaint: c, onApprove, timerRef }: {
    complaint: Complaint;
    onApprove: (id: string) => void;
    timerRef: React.MutableRefObject<Record<string, ReturnType<typeof setInterval>>>;
}) {
    const meta = STATUS_META[c.status] || { label: c.status, cls: 'status-pending' };
    const block = c.block ? 'Block ' + c.block.replace('-', ' – Floor ') : '–';
    const [timerStr, setTimerStr] = useState('');

    useEffect(() => {
        const deadline = c.acceptanceDeadline || c.supervisorDeadline || c.aoDeadline;
        if (!deadline || !['pending_acceptance', 'pending_supervisor', 'pending_ao'].includes(c.status)) return;

        const update = () => {
            const ms = msUntil(deadline);
            if (ms <= 0) { setTimerStr('OVERDUE'); return; }
            setTimerStr(formatCountdown(ms));
        };
        update();
        const id = setInterval(update, 1000);
        timerRef.current[c.ticketId] = id;
        return () => clearInterval(id);
    }, [c.ticketId, c.status, c.acceptanceDeadline, c.supervisorDeadline, c.aoDeadline]);

    const statusColorClass = meta.cls === 'status-resolved' || meta.cls === 'status-closed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : meta.cls === 'status-escalated' || meta.cls === 'status-overdue' ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : meta.cls === 'status-approval' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';

    const timerDeadline = c.acceptanceDeadline || c.supervisorDeadline || c.aoDeadline;
    const timerMs = timerDeadline ? msUntil(timerDeadline) : null;
    const timerColor = timerMs !== null ? (timerMs < 5 * 60 * 1000 ? 'text-red-400' : timerMs < 15 * 60 * 1000 ? 'text-amber-400' : 'text-blue-400') : '';

    return (
        <div className="bg-[#161625]/80 border border-white/5 rounded-2xl p-5 hover:bg-[#1c1c2e] transition-all">
            <div className="flex items-start gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/10 flex items-center justify-center flex-shrink-0">
                    <Wrench size={18} className="text-indigo-400/60" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs text-white/40 flex items-center gap-1"><MapPin size={11} /> {block}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusColorClass}`}>{meta.label}</span>
                    </div>
                    {timerStr && <div className={`text-xs font-bold font-mono ${timerColor} mb-1 flex items-center gap-1`}><Clock size={11} /> {timerStr}</div>}
                    <div className="text-sm font-bold">{c.issueType}{c.description ? ` · ${c.description.slice(0, 60)}${c.description.length > 60 ? '…' : ''}` : ''}</div>
                    <div className="text-[10px] text-white/30 mt-1">Submitted: {formatDateTime(new Date(c.submittedAt))} <span className="ml-2 font-mono">{c.ticketId}</span></div>
                </div>
            </div>

            {/* Approve section for pending_approval */}
            {c.status === 'pending_approval' && (c.supervisorPhoto || c.resolutionPhoto) && (
                <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-xs text-amber-300 mb-3">
                        <AlertTriangle size={14} className="text-amber-400" />
                        <span>Supervisor has resolved your complaint. Please review the photo and approve.</span>
                    </div>
                    <div className="mb-3">
                        <div className="flex items-center gap-1.5 mb-2"><Camera size={12} className="text-white/30" /><span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Resolution Photo</span></div>
                        <StudentClickablePhoto src={c.supervisorPhoto || c.resolutionPhoto || ''} alt="Resolution photo" />
                    </div>
                    <button onClick={() => onApprove(c.ticketId)} className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
                        <CheckCircle2 size={16} /> Approve & Rate
                    </button>
                </div>
            )}

            {/* Rating display */}
            {c.studentRating && (
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5">
                    <Star size={14} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs text-amber-300 font-bold">Your Rating: {c.studentRating}/5</span>
                    <div className="flex gap-0.5 ml-1">{Array.from({ length: c.studentRating }).map((_, i) => <Star key={i} size={10} className="text-amber-400 fill-amber-400" />)}</div>
                </div>
            )}

            {/* AO Notes for Student */}
            {(() => {
                const aoNote = c.timeline?.find(t => t.note && t.by?.startsWith('AO'));
                if (!aoNote) return null;
                return (
                    <div className="mt-3 p-3.5 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <MessageSquare size={13} className="text-cyan-400/60" />
                            <span className="text-[10px] text-cyan-400/70 font-bold uppercase tracking-widest">AO Office Note</span>
                        </div>
                        <p className="text-sm text-white/60 leading-relaxed">"{aoNote.note}"</p>
                    </div>
                );
            })()}
        </div>
    );
}

// ── Student Clickable Photo ──
function StudentClickablePhoto({ src, alt }: { src: string; alt: string }) {
    const [lightbox, setLightbox] = useState(false);
    if (!src) return null;
    return (
        <>
            <div className="relative group cursor-pointer rounded-xl overflow-hidden border border-white/5" onClick={() => setLightbox(true)}>
                <img src={src} alt={alt} className="w-full max-h-48 object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2">
                    <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    <span className="text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg">Click to zoom</span>
                </div>
            </div>
            {lightbox && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
                    <button onClick={() => setLightbox(false)} className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all"><X size={22} className="text-white" /></button>
                    <img src={src} alt={alt} className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </>
    );
}
