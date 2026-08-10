import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { examApi } from '../api/exam.api.js';
import { monitorApi } from '../api/monitor.api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useSocket } from '../hooks/useSocket.js';
import CameraPreview from '../components/exam/CameraPreview.jsx';
import EventTimeline from '../components/exam/EventTimeline.jsx';
import ViolationToasts from '../components/exam/ViolationToasts.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import Spinner from '../components/common/Spinner.jsx';
import {
  VIOLATION_META,
  VIOLATION_THRESHOLD,
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

function CounterChip({ label, value, tone }) {
  const color =
    tone === 'red' ? 'text-red-300' : tone === 'amber' ? 'text-amber-300' : 'text-slate-200';
  return (
    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300 ring-1 ring-white/15">
      {label}: <span className={color}>{value}</span>
    </span>
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
  const [absentSeconds, setAbsentSeconds] = useState(0);
  const [trust, setTrust] = useState(100);
  const [risk, setRisk] = useState('LOW');
  const [violationCount, setViolationCount] = useState(0);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [counters, setCounters] = useState(ZERO_COUNTERS);
  const [autoEnded, setAutoEnded] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [aiDown, setAiDown] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_MINUTES * 60);

  const timeUpRef = useRef(false);
  const trustRef = useRef(100);
  const faceVisibleRef = useRef(false);
  const cameraReadyLoggedRef = useRef(false);
  const lastViolationIdRef = useRef(null);
  const autoEndedRef = useRef(false);
  const monitoringRef = useRef(true);
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

  const pushStatus = useCallback(
    (title, sub, opts = {}) => {
      setNotifications((prev) =>
        [
          {
            id: nextEventId(),
            tone: opts.tone || 'positive',
            title,
            sub,
            points: opts.points || 0,
            from: opts.from,
            to: opts.to,
            reason: opts.reason,
          },
          ...prev,
        ].slice(0, 5)
      );
    },
    []
  );

  const handleAutoEnded = useCallback(() => {
    if (autoEndedRef.current) return;
    autoEndedRef.current = true;
    monitoringRef.current = false;
    setAutoEnded(true);
    setPhase('ended');
    toast('warning', 'Maximum violations reached. Examination ended.');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (resolvedSessionId) {
      redirectTimer.current = setTimeout(() => navigate(`/sessions/${resolvedSessionId}`), 3500);
    }
  }, [navigate, resolvedSessionId, toast]);

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

      const title =
        v.violationType === 'MULTIPLE_FACES'
          ? v.faceCount && v.faceCount > 1
            ? `${v.faceCount} FACES DETECTED`
            : 'MULTIPLE FACES DETECTED'
          : VIOLATION_META[v.violationType]?.label || v.violationType;

      const count = v.violationCount || 1;
      const remaining = VIOLATION_THRESHOLD - count;
      const reason =
        remaining > 0
          ? `${remaining} more violation${remaining > 1 ? 's' : ''} will end your test.`
          : 'Maximum violations reached. Examination ended.';

      addEvent({ tone: 'violation', label: title, message: reason });
      pushStatus(title, `Violation ${count} of ${VIOLATION_THRESHOLD}`, {
        tone: 'violation',
        points: v.points,
        from: prevTrust,
        to: v.trustScore,
        reason,
      });
      if (v.autoEnded) handleAutoEnded();
    },
    [addEvent, pushStatus, handleAutoEnded]
  );

  // Centralised face-status handler used by both socket events and REST frames.
  // Shows the GREEN "Face Detected" popup only when a face is detected again
  // after not being visible (not on every frame).
  const handleFaceStatus = useCallback(
    (status, seconds) => {
      setFaceStatus(status);
      if (typeof seconds === 'number') setAbsentSeconds(seconds);
      if (status === 'PRESENT') {
        if (!faceVisibleRef.current) {
          faceVisibleRef.current = true;
          addEvent({ tone: 'positive', label: 'Face Detected', message: 'Face is visible.' });
          pushStatus('Face Detected');
        }
      } else if (status === 'LOOKING_AWAY') {
        faceVisibleRef.current = true;
      } else {
        faceVisibleRef.current = false;
      }
    },
    [addEvent, pushStatus]
  );

  // Auto-dismiss notifications (oldest first).
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
      handleFaceStatus(e.faceStatus, e.absentDurationSeconds);
      if (e.counters) setCounters(e.counters);
    };
    const onBrowserEvent = (e) => {
      if (e.counters) setCounters(e.counters);
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
  }, [socket, applyViolation, handleFaceStatus, handleAutoEnded]);

  // Browser activity monitoring (only while the exam is live).
  useEffect(() => {
    if (phase !== 'live') return undefined;

    const send = (payload) => {
      if (!monitoringRef.current) return; // already ending — skip any further events
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
      if (document.fullscreenElement) {
        send({ status: 'fullscreen_entered', eventName: 'fullscreenchange', detail: 'Fullscreen active' });
      } else {
        send({ status: 'fullscreen_exit', eventName: 'fullscreenchange', detail: 'Fullscreen exited' });
      }
    };

    const onBlur = () => {
      if (document.hidden) return; // tab switch already reported
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
    monitoringRef.current = true;
    setEnding(false);
    setAiDown(false);
    setFaceStatus(null);
    setAbsentSeconds(0);
    faceVisibleRef.current = false;
    timeUpRef.current = false;

    let id = resolvedSessionId;
    if (!id) {
      try {
        const { data } = await examApi.start({
          deviceInfo: {
            userAgent: navigator.userAgent,
            screenSize: `${window.screen.width}x${window.screen.height}`,
          },
          verified: { camera: cameraGranted, fullscreen: fullscreenGranted },
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

    addEvent({ tone: 'positive', label: 'Camera Permission Approved', message: 'Webcam access granted.' });
    addEvent({ tone: 'positive', label: 'Fullscreen Accepted', message: 'Fullscreen mode active.' });
    pushStatus('Camera Permission Approved');
    pushStatus('Fullscreen Accepted');
  };

  const handleCameraReady = useCallback(() => {
    if (cameraReadyLoggedRef.current) return;
    cameraReadyLoggedRef.current = true;
  }, []);

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
        addEvent({ tone: 'positive', label: 'Monitoring Active', message: 'Examination monitoring is now live.' });
        pushStatus('Monitoring Active');
        setPhase('live');
      }, 600 * INIT_MESSAGES.length + 1400)
    );
    return () => timers.forEach(clearTimeout);
  }, [phase, addEvent, pushStatus]);

  const handleFrame = useCallback(
    async (image) => {
      if (!resolvedSessionId || !monitoringRef.current) return;
      try {
        const { data } = await monitorApi.submitFrame({ sessionId: resolvedSessionId, image });
        if (data.aiUnavailable) {
          setAiDown(true);
          return;
        }
        setAiDown(false);
        handleFaceStatus(data.faceStatus, data.absentDurationSeconds);
        if (data.counters) setCounters(data.counters);
        if (data.violation) applyViolation(data.violation);
      } catch {
        // transient network error; keep going
      }
    },
    [resolvedSessionId, applyViolation, handleFaceStatus]
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
    monitoringRef.current = false;
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
        monitoringRef.current = true;
        setEnding(false);
      });
  }, [phase, timeLeft, resolvedSessionId, navigate, toast]);

  // End Test: stop monitoring first (browser listener cleanup happens when the
  // phase flips to 'ended'), then exit fullscreen so cleanup never counts as a
  // FULLSCREEN_EXIT violation.
  const endSession = async () => {
    if (ending) return;
    setEnding(true);
    monitoringRef.current = false;
    try {
      await examApi.end(resolvedSessionId);
      setPhase('ended');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      toast('success', 'Examination completed. Generating summary…');
      navigate(`/sessions/${resolvedSessionId}`);
    } catch (err) {
      toast('error', err.message || 'Could not end the session.');
      monitoringRef.current = true;
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

  const facePresent = faceStatus === 'PRESENT' || faceStatus === 'LOOKING_AWAY';
  const trustColor =
    trust >= 85 ? 'text-emerald-400' : trust >= 60 ? 'text-amber-400' : trust >= 35 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950">
      <ViolationToasts notifications={notifications} />
      {phase === 'initializing' && <InitOverlay stage={initStage} checks={initChecks} />}

      <CameraPreview
        className="absolute inset-0 h-full w-full"
        onFrame={handleFrame}
        faceStatus={faceStatus}
        active={phase === 'live'}
        onReady={handleCameraReady}
        overlay={false}
      />

      {/* Top bar: exam name / timer | trust + End Test */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto rounded-xl bg-slate-900/70 px-4 py-2 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {session?.examName || 'Examination'}
          </p>
          <p className="text-[11px] text-slate-400">
            {connected ? '● Live' : '○ Connecting'}
            {aiDown ? ' · AI offline' : ''}
          </p>
          {phase === 'live' && (
            <p
              className={`mt-1 font-mono text-lg font-bold ${
                timeLeft <= 300 ? 'text-red-300' : 'text-white'
              }`}
            >
              ⏱ {formatCountdown(timeLeft)}
            </p>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <span className="rounded-xl bg-slate-900/70 px-4 py-2 text-center backdrop-blur">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Trust</span>
            <span className={`text-lg font-extrabold ${trustColor}`}>{trust}</span>
          </span>
          {phase === 'live' && (
            <button className="btn-danger px-4 py-2" onClick={() => setConfirmEnd(true)} disabled={ending}>
              {ending ? 'Ending…' : 'End Test'}
            </button>
          )}
        </div>
      </div>

      {autoEnded && (
        <div className="absolute inset-x-0 top-16 z-30 text-center">
          <span className="rounded-full bg-red-500/20 px-4 py-1.5 text-xs font-semibold text-red-300 ring-1 ring-red-500/40 backdrop-blur">
            Maximum violations reached. Redirecting to summary…
          </span>
        </div>
      )}

      {/* Live status strip: Face Present + absence duration + violation counters */}
      {phase === 'live' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-3">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl bg-slate-900/70 px-3 py-2 backdrop-blur">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                facePresent
                  ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40'
                  : 'bg-red-500/15 text-red-300 ring-red-500/40'
              }`}
            >
              Face Present: {facePresent ? 'YES' : 'NO'}
            </span>
            {!facePresent && absentSeconds > 0 && (
              <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300 ring-1 ring-red-500/40">
                Face Absent: {absentSeconds}s
              </span>
            )}
            <span className="ml-1 text-[11px] text-slate-400">
              Risk: <span className={`font-semibold ${trustColor}`}>{risk}</span>
            </span>
          </div>

          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5 rounded-xl bg-slate-900/70 px-3 py-2 backdrop-blur">
            <CounterChip label="Absent" value={counters.faceAbsent} tone={counters.faceAbsent ? 'red' : ''} />
            <CounterChip label="Multiple" value={counters.faceMultiple} tone={counters.faceMultiple ? 'red' : ''} />
            <CounterChip label="Looking Away" value={counters.lookingAway} tone={counters.lookingAway ? 'amber' : ''} />
            <CounterChip label="Browser Inactive" value={counters.browserViolations} tone={counters.browserViolations ? 'red' : ''} />
            <CounterChip label="Fullscreen Exits" value={counters.fullscreenExits} tone={counters.fullscreenExits ? 'red' : ''} />
            <CounterChip label="Warnings" value={counters.warnings} tone={counters.warnings ? 'amber' : ''} />
            <CounterChip
              label="Violations"
              value={`${violationCount}/${VIOLATION_THRESHOLD}`}
              tone={violationCount ? 'red' : 'amber'}
            />
          </div>
        </div>
      )}

      {/* Collapsible event log (positive GREEN + violation RED only) */}
      {phase === 'live' && (
        <div className="absolute left-3 top-20 z-30 w-72 max-w-[calc(100vw-1.5rem)]">
          <button
            onClick={() => setShowLog((s) => !s)}
            className="rounded-lg bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-300 ring-1 ring-white/15 backdrop-blur"
          >
            {showLog ? 'Hide event log' : 'Event log'}
          </button>
          {showLog && (
            <div className="mt-2 rounded-xl bg-slate-900/80 p-2 backdrop-blur">
              <EventTimeline events={events} />
            </div>
          )}
        </div>
      )}

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
