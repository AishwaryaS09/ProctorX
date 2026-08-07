export default function StatCard({ icon, label, value, sub, accent = 'text-brand-600' }) {
  return (
    <div className="card flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      </div>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 ${accent}`}>
        {icon}
      </span>
    </div>
  );
}
