import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Clock, Camera, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { KAK_USERS, ROLE_META } from '../lib/types';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        login,
        startStudentGoogleSignIn,
        getStudentGoogleEmail,
        verifyStudentAfterGoogle,
        clearStudentGoogleSession,
    } = useAuth();
    const [authMode, setAuthMode] = useState<'student' | 'staff'>('student');
    const [googleEmail, setGoogleEmail] = useState<string | null>(null);
    const [regNo, setRegNo] = useState('');
    const [phone, setPhone] = useState('');
    const [uid, setUid] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [detectedUser, setDetectedUser] = useState<{ name: string; icon: string; label: string } | null>(null);

    useEffect(() => {
        console.log('%c KAK PORTAL v2.1 - ACTIVE ', 'background: #222; color: #bada55; font-size: 20px;');
    }, []);

    useEffect(() => {
        const hydrateGoogleSession = async () => {
            const email = await getStudentGoogleEmail();
            if (email) {
                setGoogleEmail(email);
                setAuthMode('student');
            }
        };
        void hydrateGoogleSession();
    }, [getStudentGoogleEmail]);

    const handleUidChange = (val: string) => {
        setUid(val);
        setError('');
        const user = KAK_USERS[val.trim()];
        if (user) {
            const meta = ROLE_META[user.role];
            setDetectedUser({ name: user.name, icon: meta?.icon || '👤', label: meta?.label || user.role });
        } else {
            setDetectedUser(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const loginKey = uid.trim();

        const matched = KAK_USERS[loginKey];
        if (matched?.role === 'student') {
            setError('Students must use Google Sign-In, then verify Registration Number and Phone Number.');
            return;
        }

        if (!uid.trim()) { setError('Please enter your UID.'); return; }
        if (!password) { setError('Please enter your password.'); return; }

        setLoading(true);
        await new Promise(r => setTimeout(r, 800));

        const user = login(loginKey, password);
        if (!user) {
            setLoading(false);
            setError('Invalid UID or password. Please check and try again.');
            setPassword('');
            return;
        }

        // Redirect by role
        const routes: Record<string, string> = {
            student: '/student', supervisor: '/supervisor',
            ao: '/ao', vendor: '/vendor', admin: '/master',
        };
        if (user.role === 'student' && location.search) {
            navigate(`/student${location.search}`);
            return;
        }
        navigate(routes[user.role] || '/login');
    };

    const handleStudentGoogleSignIn = async () => {
        setError('');
        setLoading(true);
        try {
            await startStudentGoogleSignIn();
        } catch (err) {
            console.error(err);
            setError('Google sign-in failed. Please try again.');
            setLoading(false);
        }
    };

    const handleStudentVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regNo.trim()) {
            setError('Please enter your Registration Number.');
            return;
        }
        if (!phone.trim()) {
            setError('Please enter your Phone Number.');
            return;
        }

        setError('');
        setLoading(true);
        const result = await verifyStudentAfterGoogle(regNo, phone);
        if (!result.ok || !result.user) {
            setLoading(false);
            setError(result.message || 'Verification failed.');
            return;
        }

        if (location.search) {
            navigate(`/student${location.search}`);
            return;
        }
        navigate('/student');
    };

    const handleSwitchToStaff = () => {
        setAuthMode('staff');
        setError('');
    };

    const handleSwitchToStudent = () => {
        setAuthMode('student');
        setError('');
    };

    const handleUseDifferentGoogle = async () => {
        setError('');
        await clearStudentGoogleSession();
        setGoogleEmail(null);
        setRegNo('');
        setPhone('');
    };

    const quickFill = (uid: string) => {
        setUid(uid);
        handleUidChange(uid);
    };

    return (
        <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center p-4 font-['Inter',sans-serif] relative overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute w-[600px] h-[600px] bg-indigo-600/8 rounded-full blur-[120px] -top-32 -left-32 animate-pulse" />
                <div className="absolute w-[500px] h-[500px] bg-purple-600/6 rounded-full blur-[100px] -bottom-20 -right-20 animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[80px] top-1/2 left-1/2 animate-pulse" style={{ animationDelay: '4s' }} />
            </div>

            <div className="relative z-10 w-full max-w-[960px] grid md:grid-cols-[1.1fr_1fr] bg-[#111120]/90 backdrop-blur-xl border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl shadow-black/40">

                {/* Left Panel — Branding */}
                <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-indigo-950/50 to-transparent border-r border-white/[0.04]">
                    <div>
                        <div className="flex items-center gap-3 mb-10">
                            <img src="icon-192.png" alt="KAK Logo" className="w-12 h-12 rounded-xl" />
                            <div>
                                <span className="text-white text-lg font-black tracking-tight block">KAK</span>
                                <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Secure Portal
                                </span>
                            </div>
                        </div>

                        <h1 className="text-white text-[38px] font-black leading-[1.1] tracking-tight mb-6">
                            Clean Campus.<br />
                            <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                                Every Single Day.
                            </span>
                        </h1>
                        <p className="text-white/40 text-sm leading-relaxed max-w-[360px]">
                            A smart, responsive system to report, track and resolve restroom hygiene issues.
                        </p>
                    </div>

                    <div className="space-y-4 mt-8">
                        {[
                            { icon: Clock, title: '30-Minute Resolution', desc: 'Every complaint is tracked with auto-escalation triggers.' },
                            { icon: Camera, title: 'Real-Time Evidence', desc: 'Visual verification for both reported and resolved issues.' },
                            { icon: Shield, title: 'Privacy Guaranteed', desc: 'Photos are automatically deleted after approval.' },
                        ].map(({ icon: Icon, title, desc }) => (
                            <div key={title} className="flex items-start gap-3 text-white/50">
                                <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/10 mt-0.5">
                                    <Icon size={16} className="text-indigo-400" />
                                </div>
                                <div>
                                    <div className="text-white/80 text-sm font-bold">{title}</div>
                                    <div className="text-xs text-white/35 leading-relaxed">{desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="text-white/20 text-[11px] mt-6 flex items-center gap-1.5">
                        <span className="text-amber-500">⭐</span> Lovely Professional University
                    </div>
                </div>

                {/* Right Panel — Login Form */}
                <div className="p-8 md:p-10 flex flex-col justify-center">
                    {/* Mobile logo */}
                    <div className="md:hidden flex items-center gap-3 mb-8">
                        <img src="icon-192.png" alt="KAK Logo" className="w-10 h-10 rounded-lg" />
                        <span className="text-white font-black text-lg">KAK</span>
                    </div>

                    <h2 className="text-white text-2xl font-black mb-1">Welcome back</h2>
                    <p className="text-white/40 text-sm mb-6">Students use Google Sign-In. Staff use UID and password.</p>

                    <div className="grid grid-cols-2 gap-2 mb-6 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
                        <button
                            type="button"
                            onClick={handleSwitchToStudent}
                            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${authMode === 'student' ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white/80'}`}
                        >
                            Student
                        </button>
                        <button
                            type="button"
                            onClick={handleSwitchToStaff}
                            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${authMode === 'staff' ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white/80'}`}
                        >
                            Staff
                        </button>
                    </div>

                    {authMode === 'student' ? (
                        <form onSubmit={handleStudentVerify} className="space-y-5">
                            {!googleEmail ? (
                                <button
                                    type="button"
                                    onClick={handleStudentGoogleSignIn}
                                    disabled={loading}
                                    className="w-full bg-white text-slate-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-slate-400/50 border-t-slate-700 rounded-full animate-spin" />
                                            Connecting Google…
                                        </>
                                    ) : (
                                        <>
                                            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.651 32.657 29.193 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.27 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.27 4 24 4c-7.682 0-14.417 4.337-17.694 10.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.144 35.091 26.715 36 24 36c-5.172 0-9.617-3.319-11.283-7.946l-6.522 5.025C9.435 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.05 12.05 0 0 1-4.094 5.571h.003l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                                            Continue with Google
                                        </>
                                    )}
                                </button>
                            ) : (
                                <>
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-300 text-xs font-medium">
                                        Google account connected: {googleEmail}
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Registration Number</label>
                                        <input
                                            type="text"
                                            value={regNo}
                                            onChange={(e) => { setRegNo(e.target.value); setError(''); }}
                                            placeholder="Enter your registration number"
                                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3.5 px-4 text-white placeholder-white/20 text-sm outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Phone Number</label>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => { setPhone(e.target.value); setError(''); }}
                                            placeholder="Enter your phone number"
                                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3.5 px-4 text-white placeholder-white/20 text-sm outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Verifying…
                                            </>
                                        ) : (
                                            <><ArrowRight size={18} /> Verify and Continue</>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleUseDifferentGoogle}
                                        className="w-full text-white/60 hover:text-white text-xs font-medium"
                                    >
                                        Use a different Google account
                                    </button>
                                </>
                            )}

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs font-medium flex items-center gap-2">
                                    <span>⚠️</span> {error}
                                </div>
                            )}
                        </form>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* UID Field */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">UID</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                    </span>
                                    <input
                                        type="text"
                                        value={uid}
                                        onChange={(e) => handleUidChange(e.target.value)}
                                        placeholder="Enter your UID"
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-white/20 text-sm outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Password</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                    </span>
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                        placeholder="Enter your password"
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3.5 pl-12 pr-12 text-white placeholder-white/20 text-sm outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all"
                                    />
                                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                                        {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Role Detection */}
                            {detectedUser && (
                                <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-2.5 text-sm animate-in fade-in">
                                    <span className="text-lg">{detectedUser.icon}</span>
                                    <span className="text-indigo-300 text-xs">Signing in as <b>{detectedUser.label}</b>: {detectedUser.name}</span>
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs font-medium flex items-center gap-2">
                                    <span>⚠️</span> {error}
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Signing in…
                                    </>
                                ) : (
                                    <><ArrowRight size={18} /> Sign In</>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Quick Access */}
                    <div className="mt-8 pt-6 border-t border-white/[0.06]">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">✦ Quick Access</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {[
                                { label: '🔧 Supervisor', uid: 'sup' },
                                { label: '🏢 AO Office', uid: 'ao' },
                                { label: '👔 Vendor', uid: 'ven' },
                                { label: '👑 Admin', uid: 'Vikirthan' },
                            ].map(({ label, uid: u }) => (
                                <button
                                    key={u}
                                    onClick={() => quickFill(u)}
                                    className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg px-3 py-2 text-white/50 hover:text-white/80 transition-all text-left"
                                >
                                    {label}: <span className="text-white/30 font-mono">{u}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-white/20 mt-3 italic">Password for all: <code className="text-white/30">Viki</code></p>
                    </div>
                </div>
            </div>
        </div>
    );
}
