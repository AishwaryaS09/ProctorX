import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  ShieldIcon,
  CameraIcon,
  ActivityIcon,
  AlertIcon,
  ChartIcon,
  ClockIcon,
  ArrowRightIcon,
} from '../components/common/icons.jsx';

const FEATURES = [
  {
    icon: <CameraIcon className="h-6 w-6" />,
    title: 'Live Face Monitoring',
    desc: 'Continuous webcam analysis detects absence, multiple faces and candidates looking away using OpenCV-powered AI.',
  },
  {
    icon: <ActivityIcon className="h-6 w-6" />,
    title: 'Browser Activity Tracking',
    desc: 'Tab switches, window unfocus, minimization and fullscreen exits are captured and scored automatically.',
  },
  {
    icon: <AlertIcon className="h-6 w-6" />,
    title: 'Trust Score & Risk Levels',
    desc: 'A 0–100 trust score decays per violation. Risk is graded LOW to CRITICAL with escalating warnings.',
  },
  {
    icon: <ChartIcon className="h-6 w-6" />,
    title: 'Admin Analytics',
    desc: 'Real-time dashboards, violation analytics, candidate reports and downloadable PDF session reports.',
  },
];

const STEPS = [
  { n: '01', title: 'Register', desc: 'Create your candidate account in seconds.' },
  { n: '02', title: 'Start Exam', desc: 'Allow camera and fullscreen access to begin monitoring.' },
  { n: '03', title: 'Get Proctored', desc: 'AI watches for suspicious behavior in real time.' },
  { n: '04', title: 'Review', desc: 'Receive a trust-scored summary with a full report.' },
];

export default function Home() {
  const { user } = useAuth();
  const cta = user
    ? { to: user.role === 'admin' ? '/admin' : '/dashboard', label: 'Go to Dashboard' }
    : { to: '/register', label: 'Get Started Free' };

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-20 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-200">
              <ShieldIcon className="h-4 w-4" />
              AI-Powered Examination Integrity
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-slate-900 sm:text-6xl">
              Proctor any exam with{' '}
              <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
                intelligent monitoring
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
              A full-stack platform that watches faces, tracks browser activity and scores every candidate in real time —
              built with React, Node.js, MongoDB and a dedicated FastAPI computer-vision service.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to={cta.to} className="btn-primary px-6 py-3 text-base">
                {cta.label}
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
              <Link to="/login" className="btn-secondary px-6 py-3 text-base">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card hover:border-brand-200 hover:shadow-md">
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                {f.icon}
              </span>
              <h3 className="text-base font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold text-white">How it works</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <p className="text-5xl font-extrabold text-brand-500/40">{s.n}</p>
                <h3 className="mt-3 text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex items-center justify-center gap-3 text-slate-400">
            <ClockIcon className="h-5 w-5" />
            <p className="text-sm">Frames analyzed every ~3 seconds · violations scored instantly · sessions auto-end at the safety threshold</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h2 className="text-3xl font-bold text-slate-900">Ready to take an exam?</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-500">
          Create an account, grant camera access and let ProctorX handle the rest.
        </p>
        <Link to={cta.to} className="btn-primary mt-6 px-8 py-3 text-base">
          {cta.label}
        </Link>
      </section>
    </div>
  );
}
