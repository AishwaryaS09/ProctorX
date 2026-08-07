import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api/admin.api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useSocket } from '../hooks/useSocket.js';
import StatCard from '../components/common/StatCard.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { BarList, SimpleBarChart, SplitBar } from '../components/admin/Charts.jsx';
import { SkeletonPage } from '../components/common/Skeleton.jsx';
import { formatDateTime } from '../utils/formatters.js';
import { UsersIcon, HistoryIcon, ActivityIcon, AlertIcon, ChartIcon } from '../components/common/icons.jsx';

export default function AdminDashboard() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { socket, connected } = useSocket();

  const load = useCallback(async () => {
    try {
      const { data: res } = await adminApi.dashboard();
      setData(res);
    } catch {
      toast('error', 'Could not load admin dashboard.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => load();
    socket.on('violation', refresh);
    socket.on('session_started', refresh);
    socket.on('session_ended', refresh);
    return () => {
      socket.off('violation', refresh);
      socket.off('session_started', refresh);
      socket.off('session_ended', refresh);
    };
  }, [socket, load]);

  if (loading) return <SkeletonPage />;
  if (!data) return <EmptyState title="No data" description="No analytics available." />;

  return (
    <div>
      <PageHeader
        title="Admin Overview"
        subtitle={connected ? 'Live via Socket.IO — updates in real time.' : 'Polling for updates.'}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={<UsersIcon className="h-5 w-5" />} label="Candidates" value={data.kpis.totalCandidates} />
        <StatCard icon={<HistoryIcon className="h-5 w-5" />} label="Sessions" value={data.kpis.totalSessions} />
        <StatCard icon={<ActivityIcon className="h-5 w-5" />} label="Active now" value={data.kpis.activeSessions} accent="text-emerald-600" />
        <StatCard icon={<AlertIcon className="h-5 w-5" />} label="Violations" value={data.kpis.totalViolations} accent="text-red-600" />
        <StatCard icon={<ChartIcon className="h-5 w-5" />} label="Avg trust" value={data.kpis.avgTrust} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Violations by type</h2>
          <BarList data={data.violationsByType} />
        </div>
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Sessions (last 7 days)</h2>
          <SimpleBarChart data={data.sessionsLast7Days} />
        </div>
        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Face vs browser violations</h2>
          <SplitBar face={data.split.face} browser={data.split.browser} />
        </div>
      </div>

      <div className="card mt-6 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Live sessions</h2>
          <Link to="/admin/sessions?status=ACTIVE" className="text-sm font-semibold text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        {data.activeSessions.length === 0 ? (
          <EmptyState title="No active sessions" description="Sessions started by candidates will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Exam</th>
                  <th>Started</th>
                  <th>Trust</th>
                  <th>Risk</th>
                  <th>Violations</th>
                </tr>
              </thead>
              <tbody>
                {data.activeSessions.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium text-slate-800">{s.candidateName}</td>
                    <td className="max-w-[220px] truncate text-slate-500">{s.examName}</td>
                    <td className="text-slate-500">{formatDateTime(s.startedAt)}</td>
                    <td className="font-semibold text-slate-900">{s.trustScore}</td>
                    <td><RiskBadge risk={s.riskLevel} /></td>
                    <td className="text-slate-500">{s.violationCount}</td>
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
