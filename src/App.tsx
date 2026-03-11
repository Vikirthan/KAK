import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import AODashboard from './pages/AODashboard';
import VendorDashboard from './pages/VendorDashboard';
import MasterAdmin from './pages/MasterAdmin';
import { useAuth } from './hooks/useAuth';
import { useEscalation } from './hooks/useEscalation';
import PwaInstallPrompt from './components/PwaInstallPrompt';

function App() {
  const { getSession } = useAuth();
  const session = getSession();

  // Background escalation engine (same logic as original app.js)
  useEscalation();

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/student"
          element={session?.role === 'student' ? <StudentDashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/supervisor"
          element={session?.role === 'supervisor' ? <SupervisorDashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/ao"
          element={session?.role === 'ao' ? <AODashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/vendor"
          element={session?.role === 'vendor' ? <VendorDashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/master"
          element={session?.role === 'admin' ? <MasterAdmin /> : <Navigate to="/login" />}
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
