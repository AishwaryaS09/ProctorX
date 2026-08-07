import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { examApi } from '../api/exam.api.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Pagination from '../components/common/Pagination.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import { SkeletonTable } from '../components/common/Skeleton.jsx';
import { formatDateTime, humanizeDuration } from '../utils/formatters.js';
import { STATUS_STYLES } from '../utils/constants.js';
import { HistoryIcon } from '../components/common/icons.jsx';

export default function SessionHistory() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await examApi.history({ page, limit: 10 });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Session History" subtitle="All your monitored exam sessions." />

      {loading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon className="h-10 w-10" />}
          title="No sessions yet"
          description="Sessions you complete will appear here with full trust summaries."
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Trust</th>
                  <th>Risk</th>
                  <th>Violations</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td className="max-w-[220px] truncate font-medium text-slate-800">{s.examName}</td>
                    <td className="text-slate-500">{formatDateTime(s.startTime)}</td>
                    <td className="text-slate-500">{humanizeDuration(s.durationSeconds)}</td>
                    <td className="font-semibold text-slate-900">{s.trustScore}</td>
                    <td><RiskBadge risk={s.riskLevel} /></td>
                    <td className="text-slate-500">{s.violationCount}</td>
                    <td>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_STYLES[s.status]}`}>
                        {s.status}{s.autoEnded ? ' (auto)' : ''}
                      </span>
                    </td>
                    <td>
                      <Link to={`/sessions/${s.id}`} className="text-sm font-semibold text-brand-600 hover:underline">
                        Summary
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.pagination.page} pages={data.pagination.pages} total={data.pagination.total} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
