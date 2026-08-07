import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Spinner from '../components/common/Spinner.jsx';

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((err) => ({ ...err, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await login(form);
      toast('success', 'Login successful.');
      const from = location.state?.from;
      const target = from || (user.role === 'admin' ? '/admin' : '/dashboard');
      navigate(target);
    } catch (err) {
      const fieldErrors = err.data?.errors;
      if (Array.isArray(fieldErrors)) {
        const mapped = {};
        fieldErrors.forEach((fe) => {
          mapped[fe.field] = fe.message;
        });
        setErrors(mapped);
      }
      toast('error', err.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card">
        <h1 className="text-2xl font-bold text-slate-900">Sign in to ProctorX</h1>
        <p className="mt-1 text-sm text-slate-500">
          Candidates log in with email; admins use their username.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="identifier">Email or username</label>
            <input
              id="identifier"
              type="text"
              placeholder="jane@example.com"
              autoComplete="username"
              value={form.identifier}
              onChange={set('identifier')}
              className={`input ${errors.identifier ? 'border-red-400' : ''}`}
            />
            {errors.identifier && <p className="mt-1 text-xs text-red-600">{errors.identifier}</p>}
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={form.password}
              onChange={set('password')}
              className={`input ${errors.password ? 'border-red-400' : ''}`}
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>

          <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
            {submitting ? <Spinner size="sm" /> : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          New here?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
