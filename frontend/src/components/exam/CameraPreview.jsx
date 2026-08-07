import { useEffect, useRef, useState } from 'react';
import { CameraIcon } from '../common/icons.jsx';
import { FACE_STATUS_META } from '../../utils/constants.js';

/**
 * Webcam preview with a frame-capture loop.
 * Captures a JPEG frame every `intervalMs` and hands the base64 data URL to
 * `onFrame`. The actual analysis happens on the backend (Node -> Python).
 */
export default function CameraPreview({ onFrame, faceStatus = null, intervalMs = 3000 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (err) {
        setError(err.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Unable to access the camera.');
      }
    }

    start();

    return () => {
      cancelled = true;
      stopCapture();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    const width = video.videoWidth || 320;
    const height = video.videoHeight || 240;
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);
    try {
      onFrame(canvas.toDataURL('image/jpeg', 0.7));
    } catch {
      // ignore capture failures
    }
  };

  const startCapture = () => {
    stopCapture();
    intervalRef.current = setInterval(captureFrame, intervalMs);
  };

  const stopCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (ready) startCapture();
    return stopCapture;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, intervalMs]);

  const meta = FACE_STATUS_META[faceStatus] || null;

  return (
    <div className="relative overflow-hidden rounded-xl bg-slate-900">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
          <CameraIcon className="h-10 w-10" />
          <p className="text-sm">Starting camera…</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <CameraIcon className="h-10 w-10 text-slate-500" />
          <p className="text-sm text-red-400">{error}</p>
          <p className="text-xs text-slate-400">Grant camera permission and reload the page.</p>
        </div>
      )}

      {ready && meta && (
        <div className="absolute inset-x-0 bottom-0 flex justify-between p-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${meta.badge}`}>
            {meta.label}
          </span>
          <span className="rounded-full bg-slate-900/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
            ● LIVE
          </span>
        </div>
      )}
    </div>
  );
}
