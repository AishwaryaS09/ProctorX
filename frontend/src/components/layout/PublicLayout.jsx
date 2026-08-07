import { Link, Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ShieldIcon, CameraIcon, UserIcon } from '../common/icons.jsx';

function Navbar() {
  const { user } = useAuth();
  const location = useLocation();

  const links = [
    { to: '/', label: 'Home' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/history', label: 'History' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-extrabold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <ShieldIcon className="h-5 w-5" />
          </span>
          ProctorX
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-900'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <Link to={user.role === 'admin' ? '/admin' : '/profile'} className="btn-secondary">
              <UserIcon className="h-4 w-4" />
              {user.name}
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn-secondary">
                Sign in
              </Link>
              <Link to="/register" className="btn-primary">
                <CameraIcon className="h-4 w-4" />
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row">
        <p>© {new Date().getFullYear()} ProctorX — AI-Powered Online Examination Monitoring</p>
        <p>React · Node.js · MongoDB · FastAPI</p>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
