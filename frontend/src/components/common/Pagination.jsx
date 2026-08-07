import { ChevronLeftIcon, ChevronRightIcon } from './icons.jsx';

export default function Pagination({ page, pages, total, onChange }) {
  if (pages <= 1) return null;

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row">
      <p className="text-sm text-slate-500">
        Page <span className="font-semibold text-slate-700">{page}</span> of {pages} · {total} total
      </p>
      <div className="flex items-center gap-2">
        <button className="btn-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeftIcon className="h-4 w-4" />
          Previous
        </button>
        <button className="btn-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
