import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminApi } from '../api/admin.api.js';
import http from '../api/http.js';
import { useToast } from '../context/ToastContext.jsx';
import TrustMeter from '../components/ui/TrustMeter.jsx';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import SeverityBadge from '../components/ui/SeverityBadge.jsx';
import Badge from '../components/common/Badge.jsx';
import Spinner from '../components/common/Spinner.jsx';
import { SkeletonPage } from '../components/common/Skeleton.jsx';
import { formatDateTime, humanizeDuration } from '../utils/formatters.js';
import { VIOLATION_META } from '../utils/constants.js';
import { DocumentIcon } from '../components/common/icons.jsx';

export default function AdminSessionDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('violations');
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await adminApi.sessionDetail(id);
      setDetail(data);
    } catch (err) {
      toast('error', err.message || 'Could not load session detail.');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const res = await http.get(`/admin/sessions/${id}/report`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast('success', 'Report downloaded.');
    } catch {
      toast('error', 'Could not download the report.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <SkeletonPage />;
  if (!detail) return null;

  const s = detail.session;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Session Detail</h1>
          <p className="mt-1 text-sm text-slate-500">{s.examName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/sessions" className="btn-secondary">Back</Link>
          <button className="btn-primary" onClick={downloadReport} disabled={downloading}>
            <DocumentIcon className="h-4 w-4" />
            {downloading ? 'Generating…' : 'Download PDF report'}
          </button>
        </div>
      </div>

      <div className="card flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <TrustMeter score={s.trustScore} />
        <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
          <div>
            <p className="text-2xl font-bold text-slate-900">{s.violationCount}</p>
            <p className="text-xs font-medium uppercase text-slate-400">Violations</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{humanizeDuration(s.durationSeconds)}</p>
            <p className="text-xs font-medium uppercase text-slate-400">Duration</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{s.status}</p>
            <p className="text-xs font-medium uppercase text-slate-400">Status</p>
          </div>
          <div className="flex items-center justify-center">
            <RiskBadge risk={s.riskLevel} />
          </div>
        </div>
      </div>

      {s.finalRemarks && (
        <div className="card mt-4 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">{s.finalRemarks}</p>
        </div>
      )}

      <div className="card mt-6 p-0">
        <div className="flex gap-1 border-b border-slate-200 px-4 pt-3">
          {[
            ['violations', `Violations (${detail.violations.length})`],
            ['warnings', `Warnings (${detail.warnings.length})`],
            ['face', `Face events (${detail.faceEvents.length})`],
            ['browser', `Browser events (${detail.browserEvents.length})`],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto p-4">
          {tab === 'violations' &&
            (detail.violations.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No violations.</p>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Points</th>
                    <th>Message</th>
                    <th>Warning</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.violations.map((v) => (
                    <tr key={v.id}>
                      <td className="font-medium text-slate-800">{VIOLATION_META[v.type]?.label || v.type}</td>
                      <td><SeverityBadge severity={v.severity} /></td>
                      <td className="text-slate-600">-{v.points}</td>
                      <td className="max-w-[280px] truncate text-slate-500">{v.message}</td>
                      <td>{v.warningLevel ? <Badge className="bg-amber-100 text-amber-700 ring-amber-600/20">WARNING_{v.warningLevel}</Badge> : '—'}</td>
                      <td className="text-slate-500">{formatDateTime(v.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {tab === 'warnings' &&
            (detail.warnings.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No warnings issued.</p>
            ) : (
              <ul className="space-y-2">
                {detail.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-lg bg-amber-50 p-3">
                    <Badge className="bg-amber-200 text-amber-800 ring-amber-600/20">{w.level}</Badge>
                    <div>
                      <p className="text-sm text-amber-900">{w.message}</p>
                      <p className="text-xs text-amber-700">{formatDateTime(w.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'face' &&
            (detail.faceEvents.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No face events.</p>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Faces</th>
                    <th>Confidence</th>
                    <th>Remark</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.faceEvents.map((e) => (
                    <tr key={e.id}>
                      <td className="font-medium text-slate-800">{e.faceStatus}</td>
                      <td className="text-slate-600">{e.faceCount}</td>
                      <td className="text-slate-600">{e.confidence ? `${Math.round(e.confidence * 100)}%` : '—'}</td>
                      <td className="max-w-[300px] truncate text-slate-500">{e.remark}</td>
                      <td className="text-slate-500">{formatDateTime(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {tab === 'browser' &&
            (detail.browserEvents.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No browser events.</p>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Event</th>
                    <th>Detail</th>
                    <th>Violation</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.browserEvents.map((e) => (
                    <tr key={e.id}>
                      <td className="font-medium text-slate-800">{e.status || '—'}</td>
                      <td className="text-slate-600">{e.eventName || '—'}</td>
                      <td className="max-w-[280px] truncate text-slate-500">{e.detail || '—'}</td>
                      <td>
                        {e.isViolation ? (
                          <Badge className="bg-red-100 text-red-700 ring-red-600/20">Yes</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 ring-emerald-600/20">No</Badge>
                        )}
                      </td>
                      <td className="text-slate-500">{formatDateTime(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      </div>

      {downloading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="flex items-center gap-3 rounded-xl bg-white px-6 py-4">
            <Spinner /> <span className="text-sm text-slate-700">Generating PDF report…</span>
          </div>
        </div>
      )}
    </div>
  );
}
