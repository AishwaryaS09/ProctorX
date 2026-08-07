import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Spinner from '../components/common/Spinner.jsx';

const FIELDS = [
  { name: 'name', label: 'Full name', type: 'text', placeholder: 'Jane Doe', auto: 'name' },
  { name: 'email', label: 'Email address', type: 'email', placeholder: 'jane@example.com', auto: 'email' },
  { name: 'password', label: 'Password', type: 'password', placeholder: 'At least 8 characters', auto: 'new-password' },
  { name: 'confirmPassword', label: 'Confirm password', type: 'password', placeholder: 'Repeat password', auto: 'new-password' },
  { name: 'phone', label: 'Phone (optional)', type: 'tel', placeholder: '+1 555 000 1234', auto: 'tel' },
];

export default function Register() {
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({});
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
      const user = await register(form);
      toast('success', 'Registration successful. Welcome!');
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      const fieldErrors = err.data?.errors;
      if (Array.isArray(fieldErrors)) {
        const mapped = {};
        fieldErrors.forEach((fe) => {
          mapped[fe.field] = fe.message;
        });
        setErrors(mapped);
      }
      toast('error', err.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card">
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">Register as a candidate to start monitored exams.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          {FIELDS.map((f) => (
            <div key={f.name}>
              <label className="label" htmlFor={f.name}>{f.label}</label>
              <input
                id={f.name}
                type={f.type}
                placeholder={f.placeholder}
                autoComplete={f.auto}
                value={form[f.name] || ''}
                onChange={set(f.name)}
                className={`input ${errors[f.name] ? 'border-red-400' : ''}`}
              />
              {errors[f.name] && <p className="mt-1 text-xs text-red-600">{errors[f.name]}</p>}
            </div>
          ))}

          <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
            {submitting ? <Spinner size="sm" /> : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
