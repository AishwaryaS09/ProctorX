import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api/admin.api.js';
import PageHeader from '../components/common/PageHeader.jsx';
import SearchInput from '../components/common/SearchInput.jsx';
import Pagination from '../components/common/Pagination.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import SeverityBadge from '../components/ui/SeverityBadge.jsx';
import { SkeletonTable } from '../components/common/Skeleton.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { formatDateTime } from '../utils/formatters.js';
import { VIOLATION_META } from '../utils/constants.js';
import { AlertIcon } from '../components/common/icons.jsx';

const TYPES = ['ALL', 'FACE_ABSENT', 'MULTIPLE_FACES', 'LOOKING_AWAY', 'TAB_CHANGED', 'WINDOW_UNFOCUSED', 'BROWSER_INACTIVE', 'BROWSER_MINIMIZED', 'FULLSCREEN_EXIT'];
const SEVERITIES = ['ALL', 'LOW', 'MEDIUM', 'HIGH'];

export default function AdminViolations() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const debouncedSearch = useDebounce(search, 350);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await adminApi.violations({
        page,
        limit: 10,
        type,
        severity,
        search: debouncedSearch || undefined,
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, type, severity, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Violations" subtitle="All recorded violations across sessions." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search messages…" className="w-full sm:w-72" />
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="input w-auto py-1.5">
          {TYPES.map((t) => (
            <option key={t} value={t}>{t === 'ALL' ? 'All types' : VIOLATION_META[t]?.label || t}</option>
          ))}
        </select>
        <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} className="input w-auto py-1.5">
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{s === 'ALL' ? 'All severities' : s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={<AlertIcon className="h-10 w-10" />} title="No violations found" description="Try adjusting the filters." />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Exam</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Points</th>
                  <th>Message</th>
                  <th>Time</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium text-slate-800">{v.candidateName}</td>
                    <td className="max-w-[180px] truncate text-slate-500">{v.examName}</td>
                    <td className="text-slate-700">{VIOLATION_META[v.type]?.label || v.type}</td>
                    <td><SeverityBadge severity={v.severity} /></td>
                    <td className="font-semibold text-slate-900">-{v.points}</td>
                    <td className="max-w-[240px] truncate text-slate-500">{v.message}</td>
                    <td className="text-slate-500">{formatDateTime(v.createdAt)}</td>
                    <td>
                      {v.sessionId && (
                        <Link to={`/admin/sessions/${v.sessionId}`} className="text-sm font-semibold text-brand-600 hover:underline">
                          Session
                        </Link>
                      )}
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
