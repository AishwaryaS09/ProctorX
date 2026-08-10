import { formatDateTime } from '../../utils/formatters.js';

/**
 * Simplified user-facing event log. Entries carry a `tone`:
 * - 'positive' (GREEN): Camera Permission Approved / Fullscreen Accepted /
 *   Monitoring Active / Face Detected
 * - 'violation' (RED): the violation episodes
 * Raw frame results, focus/blur/visibilitychange noise never reach this list.
 */
export default function EventTimeline({ events = [] }) {
  if (!events.length) {
    return <p className="py-6 text-center text-sm text-slate-400">No events yet. Monitoring is active…</p>;
  }

  return (
    <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
      {events.map((e) => {
        const positive = e.tone === 'positive';
        return (
          <li
            key={e.id}
            className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 ${
              positive ? 'bg-emerald-500/10' : 'bg-red-500/10'
            }`}
          >
            <span className={`text-xs font-semibold uppercase tracking-wide ${positive ? 'text-emerald-300' : 'text-red-300'}`}>
              {e.label}
            </span>
            <span className="shrink-0 text-[11px] text-slate-400">{formatDateTime(e.createdAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}
