import { formatDateTime } from '../../utils/formatters.js';
import { VIOLATION_META } from '../../utils/constants.js';

function kindColor(event) {
  if (event.kind === 'violation') return 'bg-red-100 text-red-700';
  if (event.kind === 'warning') return 'bg-amber-100 text-amber-700';
  if (event.kind === 'session') return 'bg-brand-100 text-brand-700';
  return 'bg-slate-100 text-slate-600';
}

export default function EventTimeline({ events = [] }) {
  if (!events.length) {
    return <p className="py-6 text-center text-sm text-slate-400">No events yet. Monitoring is active…</p>;
  }

  return (
    <ul className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
      {events.map((e) => {
        const label =
          e.kind === 'violation'
            ? (VIOLATION_META[e.type]?.label || e.type)
            : e.kind === 'warning'
              ? e.level
              : e.status || e.eventName || 'event';

        return (
          <li key={e.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3">
            <span className={`mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${kindColor(e)}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <span className="shrink-0 text-xs text-slate-400">{formatDateTime(e.createdAt)}</span>
              </div>
              {e.message && <p className="mt-0.5 text-sm text-slate-500">{e.message}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
