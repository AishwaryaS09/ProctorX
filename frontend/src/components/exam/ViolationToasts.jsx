import { ExclamationTriangleIcon, CheckCircleIcon } from '../common/icons.jsx';
import { VIOLATION_META } from '../../utils/constants.js';

/**
 * Compact floating status popups over the camera feed.
 * - tone 'positive' (GREEN): informational status (Face Detected, Monitoring Active, ...)
 * - tone 'violation' (RED): a violation episode with number/remaining message.
 * They appear temporarily and auto-dismiss; they never cover the camera for long.
 */
export default function ViolationToasts({ notifications = [] }) {
  if (!notifications.length) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-5 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
      {notifications.map((n) => {
        const positive = n.tone === 'positive';
        return (
          <div
            key={n.id}
            className={`pointer-events-auto animate-pop rounded-xl border p-3 shadow-lg backdrop-blur-sm ${
              positive
                ? 'border-emerald-300 bg-emerald-50/95 shadow-emerald-900/10'
                : 'border-red-300 bg-red-50/95 shadow-red-900/10'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  positive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                }`}
              >
                {positive ? <CheckCircleIcon className="h-5 w-5" /> : <ExclamationTriangleIcon className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold uppercase tracking-wide ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
                  {n.title}
                </p>
                {n.sub && <p className="mt-0.5 text-sm font-semibold text-slate-800">{n.sub}</p>}
                {n.reason && <p className="mt-0.5 text-xs text-slate-600">{n.reason}</p>}
                {n.points > 0 && (
                  <p className="mt-1.5 inline-block rounded-md bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    Trust {n.from} → {n.to}
                    <span className="ml-1 text-red-600">(−{n.points})</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Referenced for parity with the violation meta labels if needed elsewhere.
export const violationLabel = (type, faceCount) =>
  type === 'MULTIPLE_FACES' && faceCount > 1 ? `${faceCount} FACES DETECTED` : (VIOLATION_META[type]?.label || type);
