import { RISK_STYLES } from '../../utils/constants.js';

/**
 * Circular trust-score meter with a risk-based color.
 */
export default function TrustMeter({ score, size = 140 }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score || 0));
  const risk = clamped >= 85 ? 'LOW' : clamped >= 60 ? 'MEDIUM' : clamped >= 35 ? 'HIGH' : 'CRITICAL';
  const color = RISK_STYLES[risk].bar;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-extrabold text-slate-900">{clamped}</p>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Trust</p>
      </div>
    </div>
  );
}
