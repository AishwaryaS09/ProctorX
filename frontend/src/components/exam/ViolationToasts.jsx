import { ExclamationTriangleIcon } from '../common/icons.jsx';
import { VIOLATION_META } from '../../utils/constants.js';

/**
 * Stacked, auto-dismissing violation notifications shown during the exam.
 * Each card shows the violation number, type, reason, deduction and the
 * resulting trust score.
 */
export default function ViolationToasts({ notifications = [] }) {
  if (!notifications.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-3">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="pointer-events-auto rounded-xl border border-red-200 bg-white p-4 shadow-lg shadow-red-900/10"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-red-600">
                Violation #{n.number}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {VIOLATION_META[n.type]?.label || n.type}
              </p>
              <p className="text-xs text-slate-500">{n.reason || n.type}</p>
              <p className="mt-2 inline-block rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                Trust {n.from} → {n.to}
                {n.points > 0 && <span className="ml-1 text-red-600">(−{n.points})</span>}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
