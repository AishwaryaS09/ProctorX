import { VIOLATION_META } from '../../utils/constants.js';

const BAR_COLORS = ['bg-brand-500', 'bg-red-500', 'bg-amber-500', 'bg-orange-500', 'bg-emerald-500', 'bg-violet-500'];

/**
 * Horizontal bar list, e.g. violations by type.
 */
export function BarList({ data = [], valueKey = 'count', max = null, colorKey = 'type' }) {
  const maxValue = max ?? Math.max(1, ...data.map((d) => d[valueKey]));

  return (
    <div className="space-y-3">
      {data.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No data yet.</p>}
      {data.map((d, i) => (
        <div key={d._id || d[colorKey] || i}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">{VIOLATION_META[d[colorKey]]?.label || d[colorKey]}</span>
            <span className="font-semibold text-slate-900">{d[valueKey]}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
              style={{ width: `${Math.max(2, (d[valueKey] / maxValue) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Vertical bar chart, e.g. sessions in the last 7 days.
 */
export function SimpleBarChart({ data = [], labelKey = '_id', valueKey = 'count' }) {
  const maxValue = Math.max(1, ...data.map((d) => d[valueKey]));
  return (
    <div className="flex h-44 items-end justify-between gap-2">
      {data.length === 0 && <p className="w-full py-10 text-center text-sm text-slate-400">No data yet.</p>}
      {data.map((d) => (
        <div key={d[labelKey]} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-semibold text-slate-700">{d[valueKey]}</span>
          <div
            className="w-full max-w-[36px] rounded-t-md bg-brand-500"
            style={{ height: `${Math.max(4, (d[valueKey] / maxValue) * 100)}%` }}
          />
          <span className="truncate text-[10px] text-slate-400">{d[labelKey].slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Face vs browser violation split.
 */
export function SplitBar({ face = 0, browser = 0 }) {
  const total = face + browser;
  const facePct = total ? Math.round((face / total) * 100) : 50;
  const browserPct = 100 - facePct;

  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full">
        <div className="bg-brand-500" style={{ width: `${facePct}%` }} />
        <div className="bg-red-500" style={{ width: `${browserPct}%` }} />
      </div>
      <div className="mt-3 flex gap-6 text-sm">
        <span className="flex items-center gap-2 text-slate-600">
          <span className="h-3 w-3 rounded-full bg-brand-500" /> Face violations ({face})
        </span>
        <span className="flex items-center gap-2 text-slate-600">
          <span className="h-3 w-3 rounded-full bg-red-500" /> Browser violations ({browser})
        </span>
      </div>
    </div>
  );
}
