import { ExclamationTriangleIcon } from '../common/icons.jsx';

const LEVELS = {
  1: { bg: 'bg-amber-50 border-amber-300 text-amber-800', label: 'First warning' },
  2: { bg: 'bg-orange-50 border-orange-300 text-orange-800', label: 'Second warning' },
  3: { bg: 'bg-red-50 border-red-300 text-red-800', label: 'Critical warning' },
};

export default function WarningBanner({ level, message }) {
  if (!level) return null;
  const s = LEVELS[level] || LEVELS[1];
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${s.bg}`}>
      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{s.label}</p>
        <p className="text-sm opacity-90">{message}</p>
      </div>
    </div>
  );
}
