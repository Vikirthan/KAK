import { useState, useEffect, useRef } from 'react';
import { MapPin, User, VolumeX, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getComplaintsForSupervisor, updateComplaint } from '../services/complaintService';
import { ISSUE_ICONS, ISSUE_HINDI, FLOOR_HINDI } from '../lib/types';
import type { Complaint } from '../lib/types';

/**
 * Full-screen Incoming Call page — like Swiggy's delivery partner alert.
 * This page is opened by the Service Worker (via notification click or direct message)
 * and shows a single incoming complaint with siren + vibration.
 */
export default function IncomingCall() {
    const navigate = useNavigate();
    const { getSession } = useAuth();
    const user = getSession();

    const [complaint, setComplaint] = useState<Complaint | null>(null);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const sirenRef = useRef<HTMLAudioElement | null>(null);
    const pulseRef = useRef<number>(0);
    const autoAcceptTriggeredRef = useRef(false);

    // Get ticket ID from URL if present
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const ticketIdFromUrl = urlParams.get('ticket');
    const autoAcceptFromUrl = urlParams.get('accept') === '1';

    // Initialize siren
    useEffect(() => {
        sirenRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3');
        sirenRef.current.loop = true;
        sirenRef.current.volume = 1.0;

        // Start siren immediately
        const playSiren = () => {
            sirenRef.current?.play().catch(e => {
                console.log('Siren blocked, waiting for interaction:', e);
                // On some devices, audio needs user gesture. Add click listener.
                const handler = () => {
                    sirenRef.current?.play().catch(() => {});
                    document.removeEventListener('click', handler);
                    document.removeEventListener('touchstart', handler);
                };
                document.addEventListener('click', handler);
                document.addEventListener('touchstart', handler);
            });
        };
        playSiren();

        // Vibrate continuously
        const vibrateLoop = () => {
            if ('vibrate' in navigator) {
                navigator.vibrate([500, 200, 500, 200, 500]);
            }
            pulseRef.current = window.setTimeout(vibrateLoop, 2000);
        };
        vibrateLoop();

        return () => {
            sirenRef.current?.pause();
            sirenRef.current = null;
            navigator.vibrate?.(0);
            clearTimeout(pulseRef.current);
        };
    }, []);

    // Load the pending complaint
    useEffect(() => {
        if (!user?.uid) {
            navigate('/login');
            return;
        }

        const loadComplaint = async () => {
            try {
                const all = await getComplaintsForSupervisor(user.uid);
                const pending = all.filter((c: Complaint) => c.status === 'pending_acceptance');

                if (pending.length === 0) {
                    // No pending complaints, go to dashboard
                    navigate('/supervisor');
                    return;
                }

                // If a specific ticket was requested, find it
                if (ticketIdFromUrl) {
                    const target = pending.find((c: Complaint) => c.ticketId === ticketIdFromUrl);
                    setComplaint(target || pending[0]);
                } else {
                    setComplaint(pending[0]);
                }
            } catch (err) {
                console.error('Failed to load complaint:', err);
            } finally {
                setLoading(false);
            }
        };

        loadComplaint();
    }, [user?.uid]);

    const stopSiren = () => {
        sirenRef.current?.pause();
        if (sirenRef.current) sirenRef.current.currentTime = 0;
        navigator.vibrate?.(0);
        clearTimeout(pulseRef.current);
    };

    const speakHindi = (c: Complaint) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();

        const issueHindi = ISSUE_HINDI[c.issueType] || c.issueType;
        const blockParts = c.block ? c.block.split('-') : [];
        const blockNum = blockParts[0] || c.block;
        const floorHindi = blockParts[1] ? (FLOOR_HINDI[blockParts[1]] || blockParts[1]) : '';
        const locationHindi = floorHindi ? `Block ${blockNum}, ${floorHindi}` : `Block ${blockNum}`;

        const hindiText = `ध्यान दीजिए। नई शिकायत आई है। समस्या: ${issueHindi}। जगह: ${locationHindi}। कृपया तुरंत जाएं और 30 मिनट में ठीक करें।`;

        const utterance = new SpeechSynthesisUtterance(hindiText);
        utterance.lang = 'hi-IN';
        utterance.rate = 0.85;
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const hindiVoice = voices.find(v => v.lang === 'hi-IN') || voices.find(v => v.lang.startsWith('hi'));
        if (hindiVoice) utterance.voice = hindiVoice;

        window.speechSynthesis.speak(utterance);
    };

    const handleAccept = async () => {
        if (!complaint || !user) return;
        setAccepting(true);
        stopSiren();

        try {
            const now = new Date();
            const deadline = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
            await updateComplaint(complaint.ticketId, {
                status: 'pending_supervisor',
                supervisorDeadline: deadline,
                timeline: [...(complaint.timeline || []), {
                    event: 'Complaint Accepted by Supervisor - 30m Resolution Timer Started',
                    time: now.toISOString(),
                    by: user.uid
                }],
            });

            // Speak briefing in Hindi after acceptance
            setTimeout(() => speakHindi(complaint), 500);

            // Navigate to dashboard after a short delay to let speech start
            setTimeout(() => navigate('/supervisor'), 2000);
        } catch (err) {
            console.error('Accept failed:', err);
            alert('Failed to accept. Please try again.');
            setAccepting(false);
        }
    };

    const handleSilence = () => {
        stopSiren();
        navigate('/supervisor');
    };

    // If user tapped notification "Accept", auto-accept after complaint is loaded.
    useEffect(() => {
        if (!autoAcceptFromUrl || !complaint || accepting || autoAcceptTriggeredRef.current) return;
        autoAcceptTriggeredRef.current = true;
        handleAccept();
    }, [autoAcceptFromUrl, complaint, accepting]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!complaint) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
                <p>No pending complaints. Redirecting...</p>
            </div>
        );
    }

    const issueHindi = ISSUE_HINDI[complaint.issueType] || complaint.issueType;
    const blockParts = complaint.block ? complaint.block.split('-') : [];
    const blockNum = blockParts[0] || complaint.block;
    const floorHindi = blockParts[1] ? (FLOOR_HINDI[blockParts[1]] || blockParts[1]) : '';

    return (
        <div className="fixed inset-0 z-[9999] bg-black overflow-hidden select-none" 
             style={{ touchAction: 'none' }}>
            
            {/* Animated Background Waves */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/15 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-cyan-500/20 rounded-full blur-[80px] animate-bounce" style={{ animationDuration: '2s' }} />
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-red-900/20 to-transparent animate-pulse" style={{ animationDuration: '1.5s' }} />
            </div>

            {/* Red Flashing Border */}
            <div className="absolute inset-0 border-4 border-red-500/60 animate-pulse pointer-events-none rounded-none" style={{ animationDuration: '0.8s' }} />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-between h-full py-8 px-6">
                
                {/* Top — Alert Badge */}
                <div className="flex flex-col items-center gap-2">
                    <div className="bg-red-500/20 border border-red-500/30 px-6 py-2 rounded-full animate-pulse">
                        <span className="text-red-400 text-sm font-black uppercase tracking-[0.3em]">
                            🚨 INCOMING COMPLAINT
                        </span>
                    </div>
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
                        तुरंत कार्रवाई आवश्यक
                    </p>
                </div>

                {/* Middle — Complaint Details */}
                <div className="flex flex-col items-center gap-6 w-full max-w-sm">
                    
                    {/* Pulsing Icon */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping" style={{ animationDuration: '1.5s' }} />
                        <div className="absolute -inset-4 bg-cyan-500/10 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="relative w-28 h-28 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-cyan-500/40">
                            <span className="text-5xl">{ISSUE_ICONS[complaint.issueType] || '📋'}</span>
                        </div>
                    </div>

                    {/* Issue Type */}
                    <div className="text-center">
                        <h1 className="text-3xl font-black text-white mb-1">{complaint.issueType}</h1>
                        <p className="text-xl text-cyan-400 font-bold">{issueHindi}</p>
                    </div>

                    {/* Details Card */}
                    <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-sm">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <MapPin size={18} className="text-cyan-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">जगह / Location</p>
                                    <p className="text-white font-bold text-lg">
                                        Block {blockNum}{floorHindi ? ` — ${floorHindi}` : ''}
                                    </p>
                                </div>
                            </div>

                            <div className="h-px bg-white/5" />

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <User size={18} className="text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Student</p>
                                    <p className="text-white font-bold">{complaint.studentName}</p>
                                </div>
                            </div>

                            {complaint.description && (
                                <>
                                    <div className="h-px bg-white/5" />
                                    <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5">
                                        <p className="text-sm text-white/50 italic">"{complaint.description}"</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom — Action Buttons */}
                <div className="w-full max-w-sm space-y-3">
                    {/* Accept Button — Big and Green */}
                    <button
                        onClick={handleAccept}
                        disabled={accepting}
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.97] py-5 rounded-2xl font-black text-xl transition-all shadow-2xl shadow-emerald-500/30 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {accepting ? (
                            <>
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>स्वीकार हो रहा है...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle size={24} />
                                <span>स्वीकार करें — ACCEPT</span>
                            </>
                        )}
                    </button>

                    {/* Silence Button */}
                    <button
                        onClick={handleSilence}
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 py-4 rounded-2xl font-bold text-base text-white/50 transition-all flex items-center justify-center gap-2"
                    >
                        <VolumeX size={18} />
                        <span>बंद करें — Silence</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
