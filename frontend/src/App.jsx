import { Routes, Route } from 'react-router-dom';

import PublicLayout from './components/layout/PublicLayout.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import AdminRoute from './components/common/AdminRoute.jsx';

import Home from './pages/Home.jsx';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Exam from './pages/Exam.jsx';
import SessionHistory from './pages/SessionHistory.jsx';
import SessionSummary from './pages/SessionSummary.jsx';
import Profile from './pages/Profile.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminSessions from './pages/AdminSessions.jsx';
import AdminSessionDetail from './pages/AdminSessionDetail.jsx';
import AdminCandidates from './pages/AdminCandidates.jsx';
import AdminViolations from './pages/AdminViolations.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/history" element={<SessionHistory />} />
          <Route path="/sessions/:id" element={<SessionSummary />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="/exam/:sessionId" element={<ProtectedRoute />}>
        <Route path="" element={<Exam />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AdminRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/sessions" element={<AdminSessions />} />
            <Route path="/admin/sessions/:id" element={<AdminSessionDetail />} />
            <Route path="/admin/candidates" element={<AdminCandidates />} />
            <Route path="/admin/violations" element={<AdminViolations />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
