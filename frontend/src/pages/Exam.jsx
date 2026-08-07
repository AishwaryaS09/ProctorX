import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { examApi } from '../api/exam.api.js';
import { monitorApi } from '../api/monitor.api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useSocket } from '../hooks/useSocket.js';
import CameraPreview from '../components/exam/CameraPreview.jsx';
import WarningBanner from '../components/exam/WarningBanner.jsx';
import EventTimeline from '../components/exam/EventTimeline.jsx';
import LiveStatCard from '../components/exam/LiveStatCard.jsx';
import TrustMeter from '../components/ui/TrustMeter.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import Spinner from '../components/common/Spinner.jsx';
import { FACE_STATUS_META, EXAM_DURATION_MINUTES } from '../utils/constants.js';
import { formatCountdown } from '../utils/formatters.js';
import { CameraIcon } from '../components/common/icons.jsx';

let eventSeq = 0;
const nextEventId = () => `e${Date.now()}_${(eventSeq += 1)}`;

export default function Exam() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('consent');
  const [faceStatus, setFaceStatus] = useState(null);
  const [browserStatus, setBrowserStatus] = useState('ACTIVE');
  const [trust, setTrust] = useState(100);
  const [risk, setRisk] = useState('LOW');
  const [violationCount, setViolationCount] = useState(0);
  const [warning, setWarning] = useState(null);
  const [events, setEvents] = useState([]);
  const [autoEnded, setAutoEnded] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [aiDown, setAiDown] = useState(false);
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_MINUTES * 60);
  const timeUpRef = useRef(false);

  const { socket, connected } = useSocket(phase === 'live' ? sessionId : null);
  const redirectTimer = useRef(null);

  const addEvent = useCallback((event) => {
    setEvents((prev) => [
      { id: nextEventId(), createdAt: new Date().toISOString(), ...event },
      ...prev,
    ].slice(0, 200));
  }, []);

  const applyViolation = useCallback(
    (v) => {
      if (v.trustScore !== undefined) setTrust(v.trustScore);
      if (v.riskLevel) setRisk(v.riskLevel);
      if (v.violationCount !== undefined) setViolationCount(v.violationCount);
      if (v.warningLevel) {
        const level = parseInt(v.warningLevel.replace('WARNING_', ''), 10) || 1;
        setWarning({ level, message: v.warningMessage || 'Suspicious activity detected.' });
        addEvent({ kind: 'warning', level: v.warningLevel, message: v.warningMessage });
      }
      addEvent({
        kind: 'violation',
        type: v.violationType,
        message: `${v.violationType} detected (-${v.points} trust)`,
      });
      if (v.autoEnded) handleAutoEnded();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addEvent]
  );

  const handleAutoEnded = useCallback(() => {
    setAutoEnded(true);
    setPhase('ended');
    toast('warning', 'Session auto-ended after too many violations.');
    if (sessionId) {
      redirectTimer.current = setTimeout(() => navigate(`/sessions/${sessionId}`), 4000);
    }
  }, [navigate, sessionId, toast]);

  useEffect(() => {
    async function init() {
      try {
        const { data } = await examApi.active();
        if (!data) {
          toast('error', 'No active session found.');
          navigate('/dashboard');
          return;
        }
        if (data.sessionId !== sessionId) {
          toast('error', 'Session mismatch.');
          navigate('/dashboard');
          return;
        }
        if (data.status !== 'ACTIVE') {
          navigate(`/sessions/${sessionId}`);
          return;
        }
        setSession(data);
        setTrust(data.trustScore);
        setRisk(data.riskLevel);
        setViolationCount(data.violationCount);
        if (data.startTime) {
          const endsAt = new Date(data.startTime).getTime() + EXAM_DURATION_MINUTES * 60 * 1000;
          setTimeLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
        }
      } catch {
        toast('error', 'Could not load the active session.');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    }
    init();
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [sessionId, navigate, toast]);

  // Socket-driven live updates.
  useEffect(() => {
    if (!socket) return undefined;
    const onViolation = (v) => applyViolation(v);
    const onSessionUpdate = (s) => {
      setTrust(s.trustScore);
      setRisk(s.riskLevel);
      setViolationCount(s.violationCount);
    };
    const onFaceEvent = (e) => {
      setFaceStatus(e.faceStatus);
      addEvent({ kind: 'face', status: e.faceStatus, message: e.remark });
    };
    const onBrowserEvent = (e) => {
      setBrowserStatus(e.status || e.eventName || 'ACTIVE');
      addEvent({ kind: 'browser', status: e.status, eventName: e.eventName, message: e.detail });
    };
    const onSessionEnded = (e) => {
      if (e.autoEnded) {
        setAutoEnded(true);
        handleAutoEnded();
      }
    };

    socket.on('violation', onViolation);
    socket.on('session_update', onSessionUpdate);
    socket.on('face_event', onFaceEvent);
    socket.on('browser_event', onBrowserEvent);
    socket.on('session_ended', onSessionEnded);
    return () => {
      socket.off('violation', onViolation);
      socket.off('session_update', onSessionUpdate);
      socket.off('face_event', onFaceEvent);
      socket.off('browser_event', onBrowserEvent);
      socket.off('session_ended', onSessionEnded);
    };
  }, [socket, applyViolation, addEvent, handleAutoEnded]);

  // Browser activity monitoring.
  useEffect(() => {
    if (phase !== 'live') return undefined;

    const send = (payload) => {
      monitorApi.submitBrowserEvent({ sessionId, ...payload }).catch(() => {});
    };

    const onVisibility = () => {
      if (document.hidden) {
        const minimized = window.outerHeight < 120;
        send(minimized
          ? { status: 'minimized', eventName: 'visibilitychange', detail: 'Window minimized' }
          : { status: 'tab_hidden', eventName: 'visibilitychange', detail: 'Tab hidden' });
      } else {
        send({ status: 'tab_visible', eventName: 'visibilitychange', detail: 'Tab visible' });
      }
    };

    const onFullscreen = () => {
      if (!document.fullscreenElement) {
        send({ status: 'fullscreen_exit', eventName: 'fullscreenchange', detail: 'Fullscreen exited' });
      }
    };

    const onBlur = () => send({ status: 'window_blur', eventName: 'blur', detail: 'Window lost focus' });
    const onFocus = () => send({ status: 'active', eventName: 'focus', detail: 'Window focused' });

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [phase, sessionId]);

  const startMonitoring = async () => {
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // fullscreen is optional on some browsers
    }
    setPhase('live');
  };

  const handleFrame = useCallback(
    async (image) => {
      try {
        const { data } = await monitorApi.submitFrame({ sessionId, image });
        if (data.aiUnavailable) {
          setAiDown(true);
          return;
        }
        setAiDown(false);
        setFaceStatus(data.faceStatus);
        if (data.violation) {
          applyViolation(data.violation);
        }
      } catch {
        // transient network error; keep going
      }
    },
    [sessionId, applyViolation]
  );

  const endSession = async () => {
    setEnding(true);
    try {
      await examApi.end(sessionId);
      toast('success', 'Session ended. Generating summary…');
      navigate(`/sessions/${sessionId}`);
    } catch (err) {
      toast('error', err.message || 'Could not end the session.');
      setEnding(false);
    }
  };

  // Countdown ticker while the session is live.
  useEffect(() => {
    if (phase !== 'live') return undefined;
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Auto-end once the allotted time runs out.
  useEffect(() => {
    if (phase !== 'live' || timeLeft > 0 || timeUpRef.current) return undefined;
    timeUpRef.current = true;
    setEnding(true);
    toast('info', 'Time limit reached. Ending the session automatically…');
    examApi
      .end(sessionId, { finalRemarks: 'Session ended: time limit reached.' })
      .then(() => navigate(`/sessions/${sessionId}`))
      .catch((err) => {
        toast('error', err.message || 'Could not end the session.');
        timeUpRef.current = false;
        setEnding(false);
      });
  }, [phase, timeLeft, sessionId, navigate, toast]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (phase === 'consent') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
        <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <CameraIcon className="h-7 w-7" />
          </div>
          <h1 className="text-center text-xl font-bold text-slate-900">Monitoring consent</h1>
          <p className="mt-2 text-center text-sm text-slate-500">{session?.examName}</p>

          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            <li className="flex gap-2"><span className="text-brand-600">•</span> Your webcam will be analysed every ~3 seconds for face presence.</li>
            <li className="flex gap-2"><span className="text-brand-600">•</span> Tab switches, window unfocus and fullscreen exits are recorded.</li>
            <li className="flex gap-2"><span className="text-brand-600">•</span> Violations reduce your trust score; repeated violations end the exam.</li>
            <li className="flex gap-2"><span className="text-brand-600">•</span> You must remain in fullscreen for the duration of the exam.</li>
          </ul>

          <button onClick={startMonitoring} className="btn-primary mt-8 w-full py-3">
            Grant access & start monitoring
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary mt-2 w-full">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const faceMeta = FACE_STATUS_META[faceStatus];

  return (
    <div className="min-h-screen bg-slate-900 p-4 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">{session?.examName}</h1>
            <p className="text-xs text-slate-400">
              Session {sessionId} · Live monitoring {connected ? '●' : '○'} {aiDown ? '· AI offline' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {autoEnded && (
              <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300 ring-1 ring-red-500/40">
                Auto-ended · redirecting to summary…
              </span>
            )}
            {phase === 'live' && (
              <button className="btn-danger" onClick={() => setConfirmEnd(true)} disabled={ending}>
                {ending ? 'Ending…' : 'End session'}
              </button>
            )}
          </div>
        </div>

        {warning && !autoEnded && <WarningBanner level={warning.level} message={warning.message} />}
        {autoEnded && (
          <WarningBanner level={3} message="This session was auto-ended after the violation threshold was reached. You will be redirected to your summary." />
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CameraPreview onFrame={handleFrame} faceStatus={faceStatus} />
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <LiveStatCard label="Face" value={faceStatus ? faceMeta?.label : '—'} accent={faceMeta ? 'text-slate-900' : 'text-slate-400'} />
              <LiveStatCard label="Browser" value={browserStatus.replace(/_/g, ' ')} accent="text-slate-900" />
              <LiveStatCard label="Violations" value={violationCount} accent={violationCount > 0 ? 'text-red-600' : 'text-emerald-600'} />
              <LiveStatCard label="Connection" value={connected ? 'Live' : 'Polling'} accent={connected ? 'text-emerald-600' : 'text-amber-500'} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="card flex flex-col items-center gap-3">
              <TrustMeter score={trust} />
              <RiskBadge risk={risk} />
            </div>
            <div className="card">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Event log</h2>
              <EventTimeline events={events} />
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={endSession}
        title="End this session?"
        message="Ending the session will stop monitoring immediately and open your summary report."
        confirmLabel="End session"
        danger
      />
    </div>
  );
}
