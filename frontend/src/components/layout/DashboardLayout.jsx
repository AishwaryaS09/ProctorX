import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { initials } from '../../utils/formatters.js';
import {
  ShieldIcon,
  HomeIcon,
  HistoryIcon,
  ChartIcon,
  UsersIcon,
  AlertIcon,
  UserIcon,
  LogoutIcon,
} from '../common/icons.jsx';

function SidebarLink({ to, icon, children }) {
  return (
    <NavLink
      to={to}
      end={to === '/dashboard' || to === '/admin'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      {icon}
      {children}
    </NavLink>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const handleLogout = async () => {
    await logout();
    toast('success', 'Logged out successfully.');
    navigate('/login');
  };

  const candidateLinks = [
    { to: '/dashboard', icon: <HomeIcon className="h-5 w-5" />, label: 'Dashboard' },
    { to: '/history', icon: <HistoryIcon className="h-5 w-5" />, label: 'Session History' },
    { to: '/profile', icon: <UserIcon className="h-5 w-5" />, label: 'Profile' },
  ];

  const adminLinks = [
    { to: '/admin', icon: <HomeIcon className="h-5 w-5" />, label: 'Overview' },
    { to: '/admin/sessions', icon: <HistoryIcon className="h-5 w-5" />, label: 'Sessions' },
    { to: '/admin/candidates', icon: <UsersIcon className="h-5 w-5" />, label: 'Candidates' },
    { to: '/admin/violations', icon: <AlertIcon className="h-5 w-5" />, label: 'Violations' },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900">
        <Link to={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-2 px-5 py-5 font-extrabold text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
            <ShieldIcon className="h-5 w-5" />
          </span>
          ProctorX
        </Link>

        <nav className="flex-1 space-y-1 px-3">
          <p className="px-3 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {isAdmin ? 'Admin' : 'Candidate'}
          </p>
          {(isAdmin ? adminLinks : candidateLinks).map((l) => (
            <SidebarLink key={l.to} to={l.to} icon={l.icon}>
              {l.label}
            </SidebarLink>
          ))}
          {isAdmin && (
            <SidebarLink to="/dashboard" icon={<ChartIcon className="h-5 w-5" />}>
              Switch to Portal
            </SidebarLink>
          )}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
              {initials(user?.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white">
            <LogoutIcon className="h-5 w-5" />
            Log out
          </button>
        </div>
      </aside>

      <main className="ml-64 flex-1 bg-slate-50">
        <div className="mx-auto max-w-7xl p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
