import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import AODashboard from './pages/AODashboard';
import VendorDashboard from './pages/VendorDashboard';
import MasterAdmin from './pages/MasterAdmin';
import IncomingCall from './pages/IncomingCall';
import { useAuth } from './hooks/useAuth';
import { useEscalation } from './hooks/useEscalation';
import PwaInstallPrompt from './components/PwaInstallPrompt';

function App() {
  const { getSession } = useAuth();
  const session = getSession();
  const location = useLocation();
  const loginRedirectPath = `/login${location.search || ''}`;

  // Run escalation from one privileged role to avoid duplicate client-side writes.
  useEscalation(session?.role === 'admin');

  // Global Service Worker message listener for navigation
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'NAVIGATE_TO_INCOMING') {
          const tid = event.data.ticketId;
          const autoAccept = !!event.data.autoAccept;
          console.log('[App] Received NAVIGATE_TO_INCOMING from SW for ticket:', tid);
          if (tid) {
            window.location.hash = autoAccept ? `#/incoming?ticket=${tid}&accept=1` : `#/incoming?ticket=${tid}`;
          } else {
            window.location.hash = autoAccept ? '#/incoming?accept=1' : '#/incoming';
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', handler);
      return () => navigator.serviceWorker.removeEventListener('message', handler);
    }
  }, []);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/student"
          element={session?.role === 'student' ? <StudentDashboard /> : <Navigate to={loginRedirectPath} />}
        />
        <Route
          path="/supervisor"
          element={session?.role === 'supervisor' ? <SupervisorDashboard /> : <Navigate to={loginRedirectPath} />}
        />
        {/* Full-screen Incoming Call page — opened by Service Worker notification */}
        <Route
          path="/incoming"
          element={session?.role === 'supervisor' ? <IncomingCall /> : <Navigate to={loginRedirectPath} />}
        />
        <Route
          path="/ao"
          element={session?.role === 'ao' ? <AODashboard /> : <Navigate to={loginRedirectPath} />}
        />
        <Route
          path="/vendor"
          element={session?.role === 'vendor' ? <VendorDashboard /> : <Navigate to={loginRedirectPath} />}
        />
        <Route
          path="/master"
          element={session?.role === 'admin' ? <MasterAdmin /> : <Navigate to={loginRedirectPath} />}
        />

        {/* Default route */}
        <Route path="/" element={<Navigate to={session ? (session.redirectTo || `/${session.role}`) : "/login"} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
      <PwaInstallPrompt />
    </>
  );
}

export default App;
