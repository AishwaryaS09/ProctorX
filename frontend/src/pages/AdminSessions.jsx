import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi } from '../api/admin.api.js';
import PageHeader from '../components/common/PageHeader.jsx';
import SearchInput from '../components/common/SearchInput.jsx';
import Pagination from '../components/common/Pagination.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import { SkeletonTable } from '../components/common/Skeleton.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { formatDateTime, humanizeDuration } from '../utils/formatters.js';
import { STATUS_STYLES } from '../utils/constants.js';

const STATUSES = ['ALL', 'ACTIVE', 'COMPLETED', 'ABANDONED'];

export default function AdminSessions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || 'ALL';
  const sort = searchParams.get('sort') || 'recent';

  const [page, setPage] = useState(parseInt(searchParams.get('page'), 10) || 1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await adminApi.sessions({
        page,
        limit: 10,
        status,
        search: debouncedSearch || undefined,
        sort,
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, status, sort, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const updateParams = (next) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) => {
      if (v === 'ALL' || v === '' || v === 'recent') params.delete(k);
      else params.set(k, v);
    });
    setSearchParams(params);
    setPage(1);
  };

  return (
    <div>
      <PageHeader title="Sessions" subtitle="Every monitored exam session." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by exam name…" className="sm:w-72" />
        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => updateParams({ status: s })}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                status === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 sm:ml-auto">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            className="input w-auto py-1.5"
          >
            <option value="recent">Newest first</option>
            <option value="trust">Lowest trust</option>
            <option value="duration">Longest duration</option>
          </select>
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={8} cols={8} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No sessions found" description="Try adjusting the filters." />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Exam</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Trust</th>
                  <th>Risk</th>
                  <th>Violations</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <p className="font-medium text-slate-800">{s.candidateName}</p>
                      <p className="text-xs text-slate-400">{s.candidateEmail}</p>
                    </td>
                    <td className="max-w-[200px] truncate text-slate-500">{s.examName}</td>
                    <td>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_STYLES[s.status]}`}>
                        {s.status}{s.autoEnded ? ' (auto)' : ''}
                      </span>
                    </td>
                    <td className="text-slate-500">{formatDateTime(s.startTime)}</td>
                    <td className="text-slate-500">{humanizeDuration(s.durationSeconds)}</td>
                    <td className="font-semibold text-slate-900">{s.trustScore}</td>
                    <td><RiskBadge risk={s.riskLevel} /></td>
                    <td className="text-slate-500">{s.violationCount}</td>
                    <td>
                      <Link to={`/admin/sessions/${s.id}`} className="text-sm font-semibold text-brand-600 hover:underline">
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.pagination.page}
            pages={data.pagination.pages}
            total={data.pagination.total}
            onChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
