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
import ViolationToasts from '../components/exam/ViolationToasts.jsx';
import TrustMeter from '../components/ui/TrustMeter.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import Spinner from '../components/common/Spinner.jsx';
import {
  FACE_STATUS_META,
  VIOLATION_META,
  EXAM_DURATION_MINUTES,
  EXAM_INSTRUCTIONS,
} from '../utils/constants.js';
import { formatCountdown } from '../utils/formatters.js';
import { CameraIcon } from '../components/common/icons.jsx';

let eventSeq = 0;
const nextEventId = () => `e${Date.now()}_${(eventSeq += 1)}`;

const ZERO_COUNTERS = {
  facePresent: 0,
  faceAbsent: 0,
  faceMultiple: 0,
  lookingAway: 0,
  browserViolations: 0,
  fullscreenExits: 0,
  warnings: 0,
  violations: 0,
};

const INIT_MESSAGES = [
  'Initializing AI Monitoring…',
  'Synchronizing Browser Monitoring…',
  'Preparing Examination Environment…',
];

const INIT_CHECKS = [
  'Browser Activity Monitoring Started',
  'AI Face Monitoring Started',
  'Event Logging Started',
  'Examination Monitoring Active',
];

function StatusCell({ label, value, ok }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`mt-1 text-sm font-bold ${ok ? 'text-emerald-600' : 'text-slate-600'}`}>
        {ok ? '✓ ' : ''}{value}
      </span>
    </div>
  );
}

function InitOverlay({ stage, checks }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/90 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <h2 className="text-center text-lg font-bold text-slate-900">Preparing Examination Environment</h2>
        <div className="mt-6 space-y-3">
          {INIT_MESSAGES.map((msg, i) => {
            const idx = i + 1;
            return (
              <div key={msg} className="flex items-center gap-3 text-sm">
                {stage > idx ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-600">✓</span>
                ) : stage === idx ? (
                  <Spinner size="sm" className="shrink-0" />
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-200" />
                )}
                <span className={stage >= idx ? 'text-slate-800' : 'text-slate-400'}>{msg}</span>
              </div>
            );
          })}
          {stage > INIT_MESSAGES.length && (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              {checks.map((c) => (
                <div key={c} className="flex items-center gap-3 text-sm font-medium text-emerald-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-600">✓</span>
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Exam() {
  const { sessionId: paramId } = useParams();
  const isNew = paramId === 'new';
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState(null);
  const [resolvedSessionId, setResolvedSessionId] = useState(isNew ? null : paramId);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState('instructions');
  const [fullscreenGranted, setFullscreenGranted] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [verifyError, setVerifyError] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const [initStage, setInitStage] = useState(0);
  const [initChecks, setInitChecks] = useState([]);

  const [faceStatus, setFaceStatus] = useState(null);
  const [browserStatus, setBrowserStatus] = useState('ACTIVE');
  const [trust, setTrust] = useState(100);
  const [risk, setRisk] = useState('LOW');
  const [violationCount, setViolationCount] = useState(0);
  const [warning, setWarning] = useState(null);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [counters, setCounters] = useState(ZERO_COUNTERS);
  const [autoEnded, setAutoEnded] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [aiDown, setAiDown] = useState(false);
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_MINUTES * 60);

  const timeUpRef = useRef(false);
  const trustRef = useRef(100);
  const lastLoggedFaceRef = useRef(null);
  const cameraReadyLoggedRef = useRef(false);
  const lastViolationIdRef = useRef(null);
  const autoEndedRef = useRef(false);
  const redirectTimer = useRef(null);

  const { socket, connected } = useSocket(phase === 'live' ? resolvedSessionId : null);

  useEffect(() => {
    trustRef.current = trust;
  }, [trust]);

  const addEvent = useCallback((event) => {
    setEvents((prev) => [
      { id: nextEventId(), createdAt: new Date().toISOString(), ...event },
      ...prev,
    ].slice(0, 200));
  }, []);

  const handleAutoEnded = useCallback(() => {
    if (autoEndedRef.current) return;
    autoEndedRef.current = true;
    setAutoEnded(true);
    setPhase('ended');
    addEvent({ kind: 'session', status: 'Exam Ended', message: 'Session auto-ended after excessive violations.' });
    toast('warning', 'Session auto-ended after too many violations.');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (resolvedSessionId) {
      redirectTimer.current = setTimeout(() => navigate(`/sessions/${resolvedSessionId}`), 4000);
    }
  }, [navigate, resolvedSessionId, toast, addEvent]);

  const applyViolation = useCallback(
    (v) => {
      if (!v || typeof v.violationType !== 'string') return;
      if (v.violationId && lastViolationIdRef.current === v.violationId) return;
      if (v.violationId) lastViolationIdRef.current = v.violationId;

      const prevTrust = trustRef.current;
      setTrust(v.trustScore);
      if (v.riskLevel) setRisk(v.riskLevel);
      if (v.violationCount !== undefined) setViolationCount(v.violationCount);
      if (v.counters) setCounters(v.counters);
      if (v.warningLevel) {
        const level = parseInt(String(v.warningLevel).replace('WARNING_', ''), 10) || 1;
        setWarning({ level, message: v.warningMessage || 'Suspicious activity detected.' });
        addEvent({ kind: 'warning', level: v.warningLevel, message: v.warningMessage });
      }
      addEvent({
        kind: 'violation',
        type: v.violationType,
        message: `${VIOLATION_META[v.violationType]?.label || v.violationType} detected (-${v.points} trust) · ${prevTrust} → ${v.trustScore}`,
      });
      setNotifications((prev) => [
        {
          id: nextEventId(),
          number: v.violationCount,
          type: v.violationType,
          points: v.points,
          reason: v.warningMessage || `${VIOLATION_META[v.violationType]?.label || v.violationType}`,
          from: prevTrust,
          to: v.trustScore,
        },
        ...prev,
      ].slice(0, 5));
      if (v.autoEnded) handleAutoEnded();
    },
    [addEvent, handleAutoEnded]
  );

  // Auto-dismiss violation notifications (oldest first).
  useEffect(() => {
    if (!notifications.length) return undefined;
    const t = setTimeout(() => setNotifications((prev) => prev.slice(0, -1)), 6000);
    return () => clearTimeout(t);
  }, [notifications]);

  // Load the active session (or detect one when arriving via /exam/new).
  useEffect(() => {
    async function init() {
      try {
        const { data } = await examApi.active();
        if (data && data.status === 'ACTIVE') {
          setResolvedSessionId(data.sessionId);
          setSession({ examName: data.examName });
          setTrust(data.trustScore);
          setRisk(data.riskLevel);
          setViolationCount(data.violationCount || 0);
          if (data.counters) setCounters(data.counters);
          if (data.startTime) {
            const endsAt = new Date(data.startTime).getTime() + EXAM_DURATION_MINUTES * 60 * 1000;
            setTimeLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
          }
          if (!isNew && data.sessionId !== paramId) {
            toast('error', 'Session mismatch.');
            navigate('/dashboard');
            return;
          }
          // An active session already exists (resume or duplicate start) —
          // skip the instructions screen and re-initialize monitoring.
          setPhase('initializing');
        } else if (!isNew) {
          toast('error', 'No active session found.');
          navigate('/dashboard');
        }
      } catch {
        if (!isNew) {
          toast('error', 'Could not load the active session.');
          navigate('/dashboard');
        }
      } finally {
        setLoading(false);
      }
    }
    init();
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [isNew, paramId, navigate, toast]);

  // Socket-driven live updates.
  useEffect(() => {
    if (!socket) return undefined;
    const onViolation = (v) => applyViolation(v);
    const onSessionUpdate = (s) => {
      setTrust(s.trustScore);
      setRisk(s.riskLevel);
      setViolationCount(s.violationCount);
      if (s.counters) setCounters(s.counters);
    };
    const onFaceEvent = (e) => {
      setFaceStatus(e.faceStatus);
      if (e.counters) setCounters(e.counters);
      if (lastLoggedFaceRef.current !== e.faceStatus) {
        lastLoggedFaceRef.current = e.faceStatus;
        addEvent({ kind: 'face', status: e.faceStatus, message: e.remark });
      }
    };
    const onBrowserEvent = (e) => {
      setBrowserStatus(e.status || e.eventName || 'ACTIVE');
      if (e.counters) setCounters(e.counters);
      if (e.isViolation || (e.status && e.status !== 'active' && e.status !== 'tab_visible')) {
        addEvent({ kind: 'browser', status: e.status, eventName: e.eventName, message: e.detail });
      }
    };
    const onSessionEnded = (e) => {
      if (e.autoEnded) handleAutoEnded();
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

  // Browser activity monitoring (only while the exam is live).
  useEffect(() => {
    if (phase !== 'live') return undefined;

    const send = (payload) => {
      monitorApi
        .submitBrowserEvent({ sessionId: resolvedSessionId, ...payload })
        .then(({ data }) => {
          if (data?.counters) setCounters(data.counters);
          if (data?.violation) applyViolation(data.violation);
        })
        .catch(() => {});
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

    const onBlur = () => {
      if (document.hidden) return; // tab switch already reported as TAB_CHANGED
      send({ status: 'window_blur', eventName: 'blur', detail: 'Window lost focus' });
    };
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
  }, [phase, resolvedSessionId, applyViolation]);

  // Mandatory fullscreen + camera verification before the exam starts.
  const startVerification = async () => {
    if (verifying) return;
    setVerifyError(null);
    setFullscreenGranted(false);
    setCameraGranted(false);
    setVerifying(true);

    try {
      if (typeof document.documentElement.requestFullscreen !== 'function') {
        throw new Error('fullscreen');
      }
      await document.documentElement.requestFullscreen();
      if (!document.fullscreenElement) throw new Error('fullscreen');
    } catch {
      setVerifyError('Fullscreen permission is required.');
      setVerifying(false);
      return;
    }
    setFullscreenGranted(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setVerifyError('Camera permission is required.');
      setCameraGranted(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setFullscreenGranted(false);
      setVerifying(false);
      return;
    }
    setCameraGranted(true);

    // Re-confirm fullscreen is still active (candidate may have pressed Esc).
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        setVerifyError('Fullscreen permission is required.');
        setFullscreenGranted(false);
        setVerifying(false);
        return;
      }
    }

    setVerifying(false);
    beginExam();
  };

  // Official exam start: initialise the session and prepare monitoring.
  const beginExam = async () => {
    setPhase('initializing');
    setInitStage(0);
    setInitChecks([]);
    setEvents([]);
    setNotifications([]);
    setAutoEnded(false);
    autoEndedRef.current = false;
    setEnding(false);
    setAiDown(false);
    setFaceStatus(null);
    setBrowserStatus('ACTIVE');
    setWarning(null);
    lastLoggedFaceRef.current = null;
    timeUpRef.current = false;

    let id = resolvedSessionId;
    if (!id) {
      try {
        const { data } = await examApi.start({
          deviceInfo: {
            userAgent: navigator.userAgent,
            screenSize: `${window.screen.width}x${window.screen.height}`,
          },
        });
        id = data.sessionId;
        setResolvedSessionId(id);
        setSession({ examName: data.examName });
        setTrust(data.trustScore);
        setRisk(data.riskLevel);
        setViolationCount(0);
        setCounters(ZERO_COUNTERS);
        setTimeLeft(EXAM_DURATION_MINUTES * 60);
      } catch (err) {
        toast('error', err.message || 'Could not start the exam.');
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        setPhase('instructions');
        return;
      }
    }

    addEvent({ kind: 'session', status: 'Exam Started', message: 'Examination session initialized.' });
  };

  const handleCameraReady = useCallback(() => {
    if (cameraReadyLoggedRef.current) return;
    cameraReadyLoggedRef.current = true;
    addEvent({ kind: 'session', status: 'Camera Started', message: 'Webcam stream initialized.' });
  }, [addEvent]);

  // Delayed monitoring start: sequential status messages, then go live.
  useEffect(() => {
    if (phase !== 'initializing') return undefined;
    const timers = [];
    INIT_MESSAGES.forEach((_, i) => {
      timers.push(setTimeout(() => setInitStage(i + 1), 600 * (i + 1)));
    });
    timers.push(
      setTimeout(() => setInitStage(INIT_MESSAGES.length + 1), 600 * INIT_MESSAGES.length + 600)
    );
    timers.push(
      setTimeout(() => setInitChecks(INIT_CHECKS), 600 * INIT_MESSAGES.length + 900)
    );
    timers.push(
      setTimeout(() => {
        addEvent({ kind: 'session', status: 'AI Monitoring Started', message: 'AI face monitoring is active.' });
        addEvent({ kind: 'session', status: 'Browser Monitoring Started', message: 'Browser activity is being logged.' });
        addEvent({ kind: 'session', status: 'Event Logging Started', message: 'All monitoring events are recorded.' });
        addEvent({ kind: 'session', status: 'Monitoring Active', message: 'Examination monitoring is now live.' });
        setPhase('live');
      }, 600 * INIT_MESSAGES.length + 1400)
    );
    return () => timers.forEach(clearTimeout);
  }, [phase, addEvent]);

  const handleFrame = useCallback(
    async (image) => {
      if (!resolvedSessionId) return;
      try {
        const { data } = await monitorApi.submitFrame({ sessionId: resolvedSessionId, image });
        if (data.aiUnavailable) {
          setAiDown(true);
          return;
        }
        setAiDown(false);
        setFaceStatus(data.faceStatus);
        if (data.counters) setCounters(data.counters);
        if (data.violation) applyViolation(data.violation);
      } catch {
        // transient network error; keep going
      }
    },
    [resolvedSessionId, applyViolation]
  );

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
      .end(resolvedSessionId, { finalRemarks: 'Session ended: time limit reached.' })
      .then(() => {
        setPhase('ended');
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        navigate(`/sessions/${resolvedSessionId}`);
      })
      .catch((err) => {
        toast('error', err.message || 'Could not end the session.');
        timeUpRef.current = false;
        setEnding(false);
      });
  }, [phase, timeLeft, resolvedSessionId, navigate, toast]);

  const endSession = async () => {
    setEnding(true);
    addEvent({ kind: 'session', status: 'Exam Ended', message: 'Session ended by candidate.' });
    try {
      await examApi.end(resolvedSessionId);
      setPhase('ended');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      toast('success', 'Session ended. Generating summary…');
      navigate(`/sessions/${resolvedSessionId}`);
    } catch (err) {
      toast('error', err.message || 'Could not end the session.');
      setEnding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (phase === 'instructions' || phase === 'verifying') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-xl">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <CameraIcon className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">EXAM INSTRUCTIONS</h1>
            <p className="mt-1 text-sm text-slate-500">
              {session?.examName || 'Certified Software Engineering Assessment'}
            </p>
          </div>

          <ul className="mt-6 space-y-2.5 text-sm text-slate-600">
            {EXAM_INSTRUCTIONS.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-600">✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <StatusCell
              label="Camera"
              value={verifying ? (cameraGranted ? 'Granted' : 'Requesting…') : 'Waiting...'}
              ok={cameraGranted}
            />
            <StatusCell
              label="Fullscreen"
              value={verifying ? (fullscreenGranted ? 'Active' : 'Requesting…') : 'Waiting...'}
              ok={fullscreenGranted}
            />
          </div>

          {verifyError && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-center text-sm font-medium text-red-700">
              {verifyError}
            </p>
          )}

          <button
            onClick={startVerification}
            disabled={verifying}
            className="btn-primary mt-6 w-full py-3"
          >
            {verifying ? 'Verifying permissions…' : 'Start Examination'}
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary mt-2 w-full">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const faceMeta = FACE_STATUS_META[faceStatus];
  const showCamera = phase === 'initializing' || phase === 'live';

  return (
    <div className="min-h-screen bg-slate-900 p-4 lg:p-6">
      <ViolationToasts notifications={notifications} />
      {phase === 'initializing' && <InitOverlay stage={initStage} checks={initChecks} />}

      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">{session?.examName || 'Examination'}</h1>
            <p className="text-xs text-slate-400">
              Session {resolvedSessionId} · {connected ? '● Live' : '○ Connecting'} {aiDown ? '· AI offline' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {phase === 'live' && (
              <span
                className={`rounded-lg px-3 py-1.5 font-mono text-sm font-bold ring-1 ${
                  timeLeft <= 300
                    ? 'bg-red-500/20 text-red-300 ring-red-500/40'
                    : 'bg-white/10 text-emerald-300 ring-white/20'
                }`}
              >
                ⏱ {formatCountdown(timeLeft)}
              </span>
            )}
            {autoEnded && (
              <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300 ring-1 ring-red-500/40">
                Auto-ended · redirecting to summary…
              </span>
            )}
            {phase === 'live' && (
              <button className="btn-danger" onClick={() => setConfirmEnd(true)} disabled={ending}>
                {ending ? 'Ending…' : 'End Examination'}
              </button>
            )}
          </div>
        </div>

        {warning && !autoEnded && <WarningBanner level={warning.level} message={warning.message} />}
        {autoEnded && (
          <WarningBanner level={3} message="This session was auto-ended after the violation threshold was reached. You will be redirected to your summary." />
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <LiveStatCard label="Face Present" value={counters.facePresent} accent="text-emerald-600" />
          <LiveStatCard label="Face Absent" value={counters.faceAbsent} accent={counters.faceAbsent ? 'text-red-600' : 'text-slate-900'} />
          <LiveStatCard label="Looking Away" value={counters.lookingAway} accent={counters.lookingAway ? 'text-amber-600' : 'text-slate-900'} />
          <LiveStatCard label="Multiple Faces" value={counters.faceMultiple} accent={counters.faceMultiple ? 'text-orange-600' : 'text-slate-900'} />
          <LiveStatCard label="Browser Violations" value={counters.browserViolations} accent={counters.browserViolations ? 'text-red-600' : 'text-slate-900'} />
          <LiveStatCard label="Fullscreen Exits" value={counters.fullscreenExits} accent={counters.fullscreenExits ? 'text-red-600' : 'text-slate-900'} />
          <LiveStatCard label="Warnings" value={counters.warnings} accent={counters.warnings ? 'text-amber-600' : 'text-slate-900'} />
          <LiveStatCard label="Total Violations" value={counters.violations} accent={counters.violations ? 'text-red-600' : 'text-emerald-600'} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {showCamera && (
              <CameraPreview
                onFrame={handleFrame}
                faceStatus={faceStatus}
                active={phase === 'live'}
                onReady={handleCameraReady}
              />
            )}
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <LiveStatCard label="Face" value={faceStatus ? faceMeta?.label : '—'} accent="text-slate-900" />
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
        title="End this examination?"
        message="Ending the exam will stop monitoring immediately, release the camera and open your summary report."
        confirmLabel="End examination"
        danger
      />
    </div>
  );
}
