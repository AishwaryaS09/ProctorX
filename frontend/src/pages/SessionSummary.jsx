import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { examApi } from '../api/exam.api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import SeverityBadge from '../components/ui/SeverityBadge.jsx';
import { SkeletonPage } from '../components/common/Skeleton.jsx';
import { formatDateTime } from '../utils/formatters.js';
import { VIOLATION_META } from '../utils/constants.js';

function StatCell({ label, value, tone }) {
  const color =
    tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-emerald-600' : 'text-slate-900';
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function CountCard({ label, value, active }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${active ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <p className={`text-2xl font-extrabold ${active ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

export default function SessionSummary() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await examApi.summary(id);
      setSummary(data);
    } catch (err) {
      toast('error', err.message || 'Could not load session summary.');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <SkeletonPage />;
  if (!summary) return null;

  const trustColor =
    summary.trustScore >= 85
      ? 'text-emerald-600'
      : summary.trustScore >= 60
        ? 'text-amber-600'
        : summary.trustScore >= 35
          ? 'text-orange-600'
          : 'text-red-600';

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Session Summary</h1>
          <p className="mt-1 text-sm text-slate-500">
            {summary.candidateName} · {summary.candidateId}
          </p>
        </div>
        <Link to="/history" className="btn-secondary">Back to history</Link>
      </div>

      {summary.autoEnded ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Examination automatically ended after reaching the maximum violation limit.
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Examination completed.
        </div>
      )}

      <div className="card">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Final Trust Score</p>
            <p className={`mt-1 text-6xl font-extrabold tracking-tight ${trustColor}`}>{summary.trustScore}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Risk: <RiskBadge risk={summary.riskLevel} />
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
            <StatCell label="Violations" value={summary.violationCount} tone={summary.violationCount ? 'red' : 'green'} />
            <StatCell label="Status" value={summary.status} />
            <StatCell label="Duration" value={summary.duration} />
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-400">Exam</dt>
            <dd className="text-sm text-slate-800">{summary.examTitle}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-400">Started</dt>
            <dd className="text-sm text-slate-800">{formatDateTime(summary.startTime)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-400">Ended</dt>
            <dd className="text-sm text-slate-800">{summary.endTime ? formatDateTime(summary.endTime) : 'In progress'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase text-slate-400">Remarks</dt>
            <dd className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{summary.remarks}</dd>
          </div>
        </dl>
      </div>

      <h2 className="mt-8 mb-3 text-base font-semibold text-slate-900">Violations</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CountCard label="Face Absent" value={summary.faceAbsent} active={summary.faceAbsent > 0} />
        <CountCard label="Multiple Faces" value={summary.faceMultiple} active={summary.faceMultiple > 0} />
        <CountCard label="Looking Away" value={summary.lookingAway} active={summary.lookingAway > 0} />
        <CountCard label="Browser Inactive" value={summary.browserInactive} active={summary.browserInactive > 0} />
        <CountCard label="Fullscreen Exits" value={summary.fullscreenExits} active={summary.fullscreenExits > 0} />
        <CountCard label="Total Violations" value={summary.totalViolations} active={summary.totalViolations > 0} />
      </div>

      <div className="card mt-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Timeline</h2>
        {!summary.timeline || summary.timeline.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No events recorded.</p>
        ) : (
          <ul className="space-y-1.5">
            {summary.timeline.map((e) => {
              const positive = e.tone === 'positive';
              return (
                <li
                  key={e.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                    positive ? 'bg-emerald-50' : 'bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        positive ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                      }`}
                    >
                      {positive ? '✓' : '!'}
                    </span>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        positive ? 'text-emerald-800' : 'text-red-700'
                      }`}
                    >
                      {e.label}
                    </span>
                    {typeof e.points === 'number' && (
                      <span className="text-[11px] font-semibold text-red-500">-{e.points} trust</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{e.message}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatDateTime(e.timestamp)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card mt-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Violation details</h2>
        {summary.violations.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No violations recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Points</th>
                  <th>Message</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {summary.violations.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium text-slate-800">{VIOLATION_META[v.type]?.label || v.type}</td>
                    <td><SeverityBadge severity={v.severity} /></td>
                    <td className="text-slate-600">-{v.points}</td>
                    <td className="max-w-[260px] truncate text-slate-500">{v.message}</td>
                    <td className="text-slate-500">{formatDateTime(v.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {summary.warnings.length > 0 && (
        <div className="card mt-6">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Warnings</h2>
          <ul className="space-y-2">
            {summary.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg bg-amber-50 p-3">
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-600/20">{w.level}</span>
                <span className="text-sm text-amber-900">{w.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {user?.role === 'admin' && (
        <p className="mt-4 text-center text-sm text-slate-500">
          Download the PDF report from the <Link to={`/admin/sessions/${id}`} className="font-semibold text-brand-600 hover:underline">admin session detail</Link>.
        </p>
      )}
    </div>
  );
}
