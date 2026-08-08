import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/dashboard.api.js';
import { useToast } from '../context/ToastContext.jsx';
import StatCard from '../components/common/StatCard.jsx';
import Spinner from '../components/common/Spinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import { SkeletonPage } from '../components/common/Skeleton.jsx';
import { formatDateTime, humanizeDuration } from '../utils/formatters.js';
import { STATUS_STYLES } from '../utils/constants.js';
import { HistoryIcon, ClockIcon, AlertIcon, ChartIcon, ShieldIcon, ArrowRightIcon } from '../components/common/icons.jsx';

export default function Dashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: stats } = await dashboardApi.candidate();
      setData(stats);
    } catch {
      toast('error', 'Could not load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const startExam = () => {
    setStarting(true);
    navigate('/exam/new');
  };

  if (loading) return <SkeletonPage />;
  if (!data) return <EmptyState title="No data" description="Dashboard is empty." />;

  return (
    <div>
      <PageHeader
        title="Candidate Dashboard"
        subtitle="Overview of your monitored sessions."
        actions={
          data.activeSession ? (
            <Link to={`/exam/${data.activeSession.id}`} className="btn-primary">
              <ShieldIcon className="h-4 w-4" />
              Resume active exam
            </Link>
          ) : (
            <button onClick={startExam} className="btn-primary" disabled={starting}>
              <ShieldIcon className="h-4 w-4" />
              {starting ? 'Starting…' : 'Start new exam'}
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<HistoryIcon className="h-5 w-5" />} label="Total sessions" value={data.totalSessions} />
        <StatCard icon={<ClockIcon className="h-5 w-5" />} label="Completed" value={data.completedSessions} />
        <StatCard icon={<AlertIcon className="h-5 w-5" />} label="Violations" value={data.totalViolations} accent="text-red-600" />
        <StatCard icon={<ChartIcon className="h-5 w-5" />} label="Avg trust score" value={data.avgTrust} />
      </div>

      {data.activeSession && (
        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Active session</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{data.activeSession.examName}</p>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
              Trust <strong className="text-slate-900">{data.activeSession.trustScore}</strong>
              <RiskBadge risk={data.activeSession.currentRisk} />
            </div>
          </div>
          <Link to={`/exam/${data.activeSession.id}`} className="btn-primary">
            Go to monitoring
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="card mt-6 overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Recent sessions</h2>
        </div>
        {data.recentSessions.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon className="h-10 w-10" />}
            title="No sessions yet"
            description="Start your first monitored exam to see results here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Date</th>
                  <th>Trust</th>
                  <th>Risk</th>
                  <th>Violations</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.recentSessions.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium text-slate-800">{s.examName}</td>
                    <td className="text-slate-500">{formatDateTime(s.createdAt)}</td>
                    <td className="font-semibold text-slate-900">{s.trustScore}</td>
                    <td><RiskBadge risk={s.riskLevel} /></td>
                    <td className="text-slate-500">{s.violationCount}</td>
                    <td>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_STYLES[s.status]}`}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      <Link to={`/sessions/${s.id}`} className="text-sm font-semibold text-brand-600 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
