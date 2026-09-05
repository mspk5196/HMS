import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import PageHeader from '../../components/PageHeader';

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm ${cls}`}>{msg}</div>;
}

const displayDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const STATUS_LABEL = {
  pending_level1: 'Awaiting Level 1',
  pending_level2: 'Awaiting Level 2',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function Approvals() {
  const [approvals, setApprovals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await apiFetch('/rbac/approvals/mine');
      setApprovals(data);
    } catch (err) {
      fail(err, 'Failed to load approvals.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    try {
      setBusyId(id);
      const res = await apiFetch(`/rbac/approvals/${id}/approve`, { method: 'POST' });
      flash(res.status === 'approved' ? 'Approved and executed.' : 'Approved — sent to the next approval level.');
      await load();
    } catch (err) {
      fail(err, 'Failed to approve.');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id, reason) => {
    try {
      setBusyId(id);
      await apiFetch(`/rbac/approvals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
      flash('Rejected.');
      setRejectTarget(null);
      await load();
    } catch (err) {
      fail(err, 'Failed to reject.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        category="Admin"
        title="Approvals"
        subtitle="Requests waiting on your approval."
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : approvals.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">Nothing waiting on you right now.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {approvals.map((a) => (
              <div key={a.id} className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-gray-900">{a.action_label}</div>
                  <div className="text-[11px] text-gray-500">
                    Requested by <span className="font-semibold text-gray-700">{a.requested_by_username}</span> · {displayDateTime(a.created_at)}
                  </div>
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    {STATUS_LABEL[a.status] || a.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => approve(a.id)}
                    disabled={busyId === a.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectTarget(a)}
                    disabled={busyId === a.id}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold px-3.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {rejectTarget && (
        <RejectModal
          approval={rejectTarget}
          busy={busyId === rejectTarget.id}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => reject(rejectTarget.id, reason)}
        />
      )}
    </div>
  );
}

function RejectModal({ approval, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-gray-100">
        <h3 className="text-base font-bold text-gray-900">Reject — {approval.action_label}</h3>
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-700">Reason (optional)</label>
          <textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs" />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={busy}
            className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
