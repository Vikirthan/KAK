// =============================================
// AUTH HOOK — mirrors kakLogin/kakSetSession/kakGetSession from app.js
// =============================================
import { useNavigate } from 'react-router-dom';
import { KAK_USERS } from '../lib/types';
import { STUDENT_GOOGLE_EMAILS, STUDENT_PROFILES } from '../lib/types';
import type { User } from '../lib/types';
import { supabase } from '../lib/supabase';

interface StudentDirectoryRecord {
    student_uid: string;
    reg_no: string;
    phone: string;
    name: string | null;
    is_active: boolean | null;
}

interface GoogleSessionIdentity {
    email: string;
    authUserId: string;
    displayName: string;
}

const extractOAuthCodeFromUrl = (): string | null => {
    // Supabase may return OAuth code in query string or in hash-based route query.
    const fromSearch = new URLSearchParams(window.location.search).get('code');
    if (fromSearch) return fromSearch;

    const hash = window.location.hash || '';
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return null;

    const hashQuery = hash.slice(queryIndex + 1);
    return new URLSearchParams(hashQuery).get('code');
};

export function useAuth() {
    const navigate = useNavigate();

    const setSession = (payload: Record<string, unknown>) => {
        localStorage.setItem('kak_session', JSON.stringify(payload));
    };

    const login = (uid: string, password: string): User | null => {
        const user = KAK_USERS[uid];
        // Students must use Google flow + profile verification.
        if (user?.role === 'student') return null;
        if (user && user.password === password) {
            // Save session (same data as kakSetSession)
            setSession({
                uid: user.uid,
                username: uid, // the login key
                role: user.role,
                name: user.name,
                block: user.block || null,
                loggedInAt: new Date().toISOString(),
            });
            return user;
        }
        return null;
    };

    const startStudentGoogleSignIn = async (): Promise<void> => {
        const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.hash || '#/login'}`;
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                queryParams: { prompt: 'select_account' },
            },
        });
        if (error) throw error;
    };

    const getStudentGoogleEmail = async (): Promise<string | null> => {
        const { data, error } = await supabase.auth.getSession();
        if (!error && data.session?.user?.email) {
            return data.session.user.email.toLowerCase();
        }

        const code = extractOAuthCodeFromUrl();
        if (!code) return null;

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
            console.error('[AUTH] OAuth code exchange failed:', exchangeError.message);
            return null;
        }

        const { data: exchangedData, error: exchangedSessionError } = await supabase.auth.getSession();
        if (exchangedSessionError) return null;
        return exchangedData.session?.user?.email?.toLowerCase() || null;
    };

    const getStudentGoogleIdentity = async (): Promise<GoogleSessionIdentity | null> => {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.user?.email) return null;

        const email = data.session.user.email.toLowerCase();
        const authUserId = data.session.user.id;
        const displayName = (data.session.user.user_metadata?.full_name as string | undefined)
            || (data.session.user.user_metadata?.name as string | undefined)
            || 'Student';

        return { email, authUserId, displayName };
    };

    const getStudentFromDirectory = async (email: string): Promise<StudentDirectoryRecord | null> => {
        const { data, error } = await supabase
            .from('student_profiles')
            .select('student_uid, reg_no, phone, name, is_active')
            .ilike('email', email)
            .maybeSingle<StudentDirectoryRecord>();

        if (error) {
            // Fallback to static in-code mapping when DB table is not ready.
            console.warn('[AUTH] student_profiles lookup failed, using fallback mapping:', error.message);
            return null;
        }

        return data || null;
    };

    const createStudentInDirectory = async (
        identity: GoogleSessionIdentity,
        regNo: string,
        phone: string,
    ): Promise<StudentDirectoryRecord | null> => {
        const payload = {
            email: identity.email,
            student_uid: identity.authUserId,
            name: identity.displayName,
            reg_no: regNo.trim(),
            phone: phone.replace(/\D/g, ''),
            is_active: true,
        };

        const { data, error } = await supabase
            .from('student_profiles')
            .insert(payload)
            .select('student_uid, reg_no, phone, name, is_active')
            .single<StudentDirectoryRecord>();

        if (error) {
            console.error('[AUTH] Unable to create student profile:', error.message);
            return null;
        }

        return data;
    };

    const verifyStudentAfterGoogle = async (
        regNo: string,
        phone: string,
    ): Promise<{ ok: boolean; message?: string; user?: User }> => {
        const identity = await getStudentGoogleIdentity();
        if (!identity) {
            return { ok: false, message: 'Google session not found. Please sign in with Google again.' };
        }

        const reg = regNo.trim();
        const mobile = phone.replace(/\D/g, '');

        // 1) Prefer dynamic student resolution from Supabase.
        let directoryRecord = await getStudentFromDirectory(identity.email);
        if (!directoryRecord) {
            // First login for a new student: persist entered details.
            directoryRecord = await createStudentInDirectory(identity, reg, mobile);
            if (!directoryRecord) {
                return { ok: false, message: 'Unable to create student profile. Please try again.' };
            }
        }

        if (directoryRecord) {
            if (directoryRecord.is_active === false) {
                return { ok: false, message: 'This student account is inactive. Contact admin.' };
            }

            const directoryPhone = (directoryRecord.phone || '').replace(/\D/g, '');
            if (directoryRecord.reg_no !== reg || directoryPhone !== mobile) {
                return { ok: false, message: 'Registration number or phone number does not match our records.' };
            }

            const mappedUser = KAK_USERS[directoryRecord.student_uid];
            const user: User = mappedUser && mappedUser.role === 'student'
                ? mappedUser
                : {
                    uid: directoryRecord.student_uid,
                    role: 'student',
                    name: directoryRecord.name || 'Student',
                    redirectTo: '/student',
                };

            setSession({
                uid: user.uid,
                username: user.uid,
                role: user.role,
                name: user.name,
                block: user.block || null,
                email: identity.email,
                authProvider: 'google',
                loggedInAt: new Date().toISOString(),
            });
            return { ok: true, user };
        }

        // 2) Temporary fallback to static mapping in code.
        const uid = STUDENT_GOOGLE_EMAILS[identity.email];
        if (!uid) {
            return { ok: false, message: 'This Google account is not registered for student access.' };
        }

        const profile = STUDENT_PROFILES[uid];
        const profileMobile = (profile?.phone || '').replace(/\D/g, '');
        if (!profile || profile.regNo !== reg || profileMobile !== mobile) {
            return { ok: false, message: 'Registration number or phone number does not match our records.' };
        }

        const user = KAK_USERS[uid];
        if (!user || user.role !== 'student') {
            return { ok: false, message: 'Student role mapping failed. Contact admin.' };
        }

        setSession({
            uid: user.uid,
            username: uid,
            role: user.role,
            name: user.name,
            block: user.block || null,
            email: identity.email,
            authProvider: 'google',
            loggedInAt: new Date().toISOString(),
        });
        return { ok: true, user };
    };

    const clearStudentGoogleSession = async () => {
        await supabase.auth.signOut();
    };

    const logout = () => {
        localStorage.removeItem('kak_session');
        void supabase.auth.signOut();
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

    return {
        login,
        logout,
        getSession,
        startStudentGoogleSignIn,
        getStudentGoogleEmail,
        verifyStudentAfterGoogle,
        clearStudentGoogleSession,
    };
}
