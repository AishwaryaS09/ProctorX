import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-7xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-500">The page you are looking for doesn’t exist or has been moved.</p>
      <Link to="/" className="btn-primary mt-6">Back to home</Link>
    </div>
  );
}
