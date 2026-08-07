export function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card">
      <SkeletonBlock className="mb-3 h-4 w-1/3" />
      <SkeletonBlock className="h-8 w-2/3" />
      <SkeletonBlock className="mt-3 h-3 w-1/2" />
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i}>
                  <SkeletonBlock className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c}>
                    <SkeletonBlock className="h-3 w-20" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonTable />
    </div>
  );
}
