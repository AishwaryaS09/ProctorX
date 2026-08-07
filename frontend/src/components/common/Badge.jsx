export default function Badge({ children, className = 'bg-slate-100 text-slate-700 ring-slate-500/20' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${className}`}>
      {children}
    </span>
  );
}
