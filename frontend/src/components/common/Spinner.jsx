export default function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-[3px]',
  };
  return (
    <div
      className={`${sizes[size]} ${className} animate-spin rounded-full border-slate-300 border-t-brand-600`}
      role="status"
      aria-label="Loading"
    />
  );
}
