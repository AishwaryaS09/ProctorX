import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/admin.api.js';
import PageHeader from '../components/common/PageHeader.jsx';
import SearchInput from '../components/common/SearchInput.jsx';
import Pagination from '../components/common/Pagination.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { SkeletonTable } from '../components/common/Skeleton.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { formatDate } from '../utils/formatters.js';
import { UsersIcon } from '../components/common/icons.jsx';

export default function AdminCandidates() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await adminApi.candidates({
        page,
        limit: 10,
        search: debouncedSearch || undefined,
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Candidates" subtitle="Registered candidates and their activity." />
      <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email or ID…" className="mb-4 w-full sm:w-80" />

      {loading ? (
        <SkeletonTable rows={8} cols={6} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={<UsersIcon className="h-10 w-10" />} title="No candidates found" description="Registered candidates will appear here." />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Candidate ID</th>
                  <th>Registered</th>
                  <th>Last login</th>
                  <th>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-slate-800">{c.name}</td>
                    <td className="text-slate-500">{c.email}</td>
                    <td className="font-mono text-xs text-slate-600">{c.candidateId || '—'}</td>
                    <td className="text-slate-500">{formatDate(c.createdAt)}</td>
                    <td className="text-slate-500">{c.lastLoginAt ? formatDate(c.lastLoginAt) : 'Never'}</td>
                    <td className="font-semibold text-slate-900">{c.totalSessions}</td>
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
