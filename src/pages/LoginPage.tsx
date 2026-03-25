import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Clock, Camera, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { KAK_USERS, ROLE_META } from '../lib/types';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const [uid, setUid] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [detectedUser, setDetectedUser] = useState<{ name: string; icon: string; label: string } | null>(null);

    useEffect(() => {
        console.log('%c KAK PORTAL v2.1 - ACTIVE ', 'background: #222; color: #bada55; font-size: 20px;');
    }, []);

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
        if (!uid.trim()) { setError('Please enter your UID.'); return; }
        if (!password) { setError('Please enter your password.'); return; }

        setLoading(true);
        await new Promise(r => setTimeout(r, 800));

        const user = login(uid.trim(), password);
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
                    <p className="text-white/40 text-sm mb-8">Sign in with your UID and password to continue</p>

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

                    {/* Quick Access */}
                    <div className="mt-8 pt-6 border-t border-white/[0.06]">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">✦ Quick Access</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {[
                                { label: '🎓 Student', uid: '123' },
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
