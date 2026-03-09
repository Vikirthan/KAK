// =============================================
// AUTH HOOK — mirrors kakLogin/kakSetSession/kakGetSession from app.js
// =============================================
import { useNavigate } from 'react-router-dom';
import { KAK_USERS } from '../lib/types';
import type { User } from '../lib/types';

export function useAuth() {
    const navigate = useNavigate();

    const login = (uid: string, password: string): User | null => {
        const user = KAK_USERS[uid];
        if (user && user.password === password) {
            // Save session (same data as kakSetSession)
            localStorage.setItem('kak_session', JSON.stringify({
                uid: user.uid,
                username: uid, // the login key
                role: user.role,
                name: user.name,
                block: user.block || null,
                loggedInAt: new Date().toISOString(),
            }));
            return user;
        }
        return null;
    };

    const logout = () => {
        localStorage.removeItem('kak_session');
        navigate('/login');
    };

    const getSession = (): (User & { block?: string }) | null => {
        const session = localStorage.getItem('kak_session');
        if (!session) return null;
        try {
            return JSON.parse(session);
        } catch {
            return null;
        }
    };

    return { login, logout, getSession };
}
