import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { useKid } from './hooks/useKid';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import PlanNew from './pages/PlanNew';
import PlanReview from './pages/PlanReview';
import PlanGrocery from './pages/PlanGrocery';
import Settings from './pages/Settings';
import './index.css';

function Nav() {
  const { kid } = useKid();
  return (
    <nav className="nav">
      <strong><Link to="/">🥪 Lunch Planner</Link></strong>
      {kid && <span className="muted">{kid.name}</span>}
      <Link to="/settings">Settings</Link>
    </nav>
  );
}

function StorageBanner() {
  const { storageError } = useApp();
  if (!storageError) return null;
  return <div className="error-banner">{storageError}</div>;
}

function RequireKid({ children }: { children: React.ReactNode }) {
  const { kids } = useApp();
  if (kids.length === 0) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <>
      <Nav />
      <StorageBanner />
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/" element={<RequireKid><Home /></RequireKid>} />
        <Route path="/plan/new" element={<RequireKid><PlanNew /></RequireKid>} />
        <Route path="/plan/review" element={<RequireKid><PlanReview /></RequireKid>} />
        <Route path="/plan/grocery" element={<RequireKid><PlanGrocery /></RequireKid>} />
        <Route path="/settings" element={<RequireKid><Settings /></RequireKid>} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
