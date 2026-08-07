import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import http from '../api/http.js';
import Spinner from '../components/common/Spinner.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import { formatDate } from '../utils/formatters.js';
import { UserIcon } from '../components/common/icons.jsx';

export default function Profile() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await http.put('/candidate/profile', { name, phone });
      await refresh();
      toast('success', 'Profile updated.');
    } catch (err) {
      toast('error', err.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" subtitle="Your account information." />

      <div className="card">
        <div className="mb-6 flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <UserIcon className="h-7 w-7" />
          </span>
          <div>
            <p className="text-lg font-semibold text-slate-900">{user?.name}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>

        <dl className="mb-6 grid grid-cols-1 gap-3 border-y border-slate-200 py-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-400">Role</dt>
            <dd className="capitalize text-slate-800">{user?.role}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-400">Candidate ID</dt>
            <dd className="text-slate-800">{user?.candidateId || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-400">Member since</dt>
            <dd className="text-slate-800">{formatDate(user?.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-400">Last login</dt>
            <dd className="text-slate-800">{formatDate(user?.lastLoginAt)}</dd>
          </div>
        </dl>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone</label>
            <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Spinner size="sm" /> : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
