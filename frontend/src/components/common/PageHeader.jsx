export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
