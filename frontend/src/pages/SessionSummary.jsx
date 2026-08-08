import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { examApi } from '../api/exam.api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import TrustMeter from '../components/ui/TrustMeter.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import SeverityBadge from '../components/ui/SeverityBadge.jsx';
import Badge from '../components/common/Badge.jsx';
import { SkeletonPage } from '../components/common/Skeleton.jsx';
import { formatDateTime, humanizeDuration } from '../utils/formatters.js';
import { VIOLATION_META } from '../utils/constants.js';

function StatCell({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
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

      <div className="card">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <TrustMeter score={summary.trustScore} />
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
            <StatCell label="Risk" value={<RiskBadge risk={summary.riskLevel} />} />
            <StatCell label="Violations" value={summary.violationCount} />
            <StatCell label="Status" value={summary.status} />
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-400">Exam</dt>
            <dd className="text-sm text-slate-800">{summary.examTitle}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-400">Duration</dt>
            <dd className="text-sm text-slate-800">{summary.duration}</dd>
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

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCell label="Face present" value={summary.facePresent} />
        <StatCell label="Face absent" value={summary.faceAbsent} />
        <StatCell label="Multiple faces" value={summary.faceMultiple} />
        <StatCell label="Looking away" value={summary.lookingAway} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCell label="Browser events" value={summary.browserEvents} />
        <StatCell label="Browser inactive" value={summary.browserInactive} />
        <StatCell label="Fullscreen exits" value={summary.fullscreenExits} />
        <StatCell label="Warnings" value={summary.warningCount} />
      </div>

      <div className="card mt-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Violations</h2>
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
                <Badge className="bg-amber-200 text-amber-800 ring-amber-600/20">{w.level}</Badge>
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
