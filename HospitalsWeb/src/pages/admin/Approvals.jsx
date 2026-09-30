import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../util/api';
import PageHeader from '../../components/PageHeader';
import {
  CheckIcon,
  XIcon,
  ClockIcon,
  SearchIcon,
  UserIcon,
  BoltIcon,
  DocumentTextIcon,
} from '../../components/Icons';

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-rose-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm flex items-center justify-between ${cls}`}>
      <span>{msg}</span>
    </div>
  );
}

const displayDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

const STATUS_STYLE = {
  pending_level1: 'bg-amber-50 text-amber-700 border-amber-200',
  pending_level2: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
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
  const [viewDetailTarget, setViewDetailTarget] = useState(null);

  // Filters
  const [tab, setTab] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [searchQuery, setSearchQuery] = useState('');

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };
  const fail = (err, fallback) => {
    setErrorMsg(err?.message || fallback);
    setTimeout(() => setErrorMsg(''), 6000);
  };

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await apiFetch('/rbac/approvals/mine');
      setApprovals(Array.isArray(data) ? data : []);
    } catch (err) {
      fail(err, 'Failed to load approvals.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id) => {
    try {
      setBusyId(id);
      const res = await apiFetch(`/rbac/approvals/${id}/approve`, { method: 'POST' });
      flash(res.status === 'approved' ? 'Request approved and executed.' : 'Approved — forwarded to next approval level.');
      await load();
    } catch (err) {
      fail(err, 'Failed to approve request.');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id, reason) => {
    try {
      setBusyId(id);
      await apiFetch(`/rbac/approvals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      flash('Request has been rejected.');
      setRejectTarget(null);
      await load();
    } catch (err) {
      fail(err, 'Failed to reject request.');
    } finally {
      setBusyId(null);
    }
  };

  // Filter approvals based on tab and search
  const filteredApprovals = useMemo(() => {
    return approvals.filter((a) => {
      const isPending = a.status === 'pending_level1' || a.status === 'pending_level2';
      if (tab === 'pending' && !isPending) return false;
      if (tab === 'approved' && a.status !== 'approved') return false;
      if (tab === 'rejected' && a.status !== 'rejected') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const actionMatch = (a.action_label || '').toLowerCase().includes(q);
        const reqMatch = (a.requested_by_username || '').toLowerCase().includes(q);
        const statusMatch = (STATUS_LABEL[a.status] || '').toLowerCase().includes(q);
        if (!actionMatch && !reqMatch && !statusMatch) return false;
      }
      return true;
    });
  }, [approvals, tab, searchQuery]);

  const pendingCount = approvals.filter((a) => a.status === 'pending_level1' || a.status === 'pending_level2').length;
  const approvedCount = approvals.filter((a) => a.status === 'approved').length;
  const rejectedCount = approvals.filter((a) => a.status === 'rejected').length;

  return (
    <div className="space-y-6">
      <PageHeader
        category="Admin"
        title="Approvals"
        subtitle="Review and process administrative requests, fee waivers, attendance corrections, and approvals waiting on you."
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
            <ClockIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Pending Action</div>
            <div className="text-lg font-bold text-amber-600">{pendingCount}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
            <CheckIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Approved</div>
            <div className="text-lg font-bold text-emerald-600">{approvedCount}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm">
            <XIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Rejected</div>
            <div className="text-lg font-bold text-rose-600">{rejectedCount}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
            <DocumentTextIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Total Requests</div>
            <div className="text-lg font-bold text-gray-900">{approvals.length}</div>
          </div>
        </div>
      </div>

      {/* Control & Tab Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex rounded-lg bg-gray-100/80 p-1 text-xs font-semibold">
          <button
            onClick={() => setTab('pending')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              tab === 'pending' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Pending</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('approved')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              tab === 'approved' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setTab('rejected')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              tab === 'rejected' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
          <button
            onClick={() => setTab('all')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              tab === 'all' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            All History ({approvals.length})
          </button>
        </div>

        {/* Search Box */}
        <div className="relative min-w-[240px] flex-1 sm:flex-initial">
          <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, requester…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Main Approvals List */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              {tab === 'pending' ? 'Requests Awaiting Decision' : 'Approval Request History'}
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Authorized personnel can approve or reject with audit trail logging.
            </p>
          </div>
          <div className="text-[11px] font-semibold text-gray-400">
            Showing {filteredApprovals.length} requests
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-gray-400">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-2"></div>
            <div>Loading approval requests…</div>
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500">
            {tab === 'pending' ? 'Great! No requests waiting on your approval.' : 'No approval records found in this view.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredApprovals.map((a) => {
              const isPending = a.status === 'pending_level1' || a.status === 'pending_level2';
              return (
                <div key={a.id} className="p-4 hover:bg-gray-50/60 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-gray-900">{a.action_label || 'Administrative Action'}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[a.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABEL[a.status] || a.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1 font-medium text-gray-700">
                        <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span>Requested by <strong className="font-mono text-blue-700">{a.requested_by_username}</strong></span>
                      </span>
                      <span>·</span>
                      <span className="text-gray-400">Submitted {displayDateTime(a.created_at)}</span>
                      {a.reason && (
                        <>
                          <span>·</span>
                          <span className="text-gray-600 italic">"{a.reason}"</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => approve(a.id)}
                          disabled={busyId === a.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1 transition-colors"
                        >
                          <CheckIcon className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => setRejectTarget(a)}
                          disabled={busyId === a.id}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold px-3.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-50 flex items-center gap-1 transition-colors"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-gray-400 font-semibold px-2 py-1">
                        Completed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject Modal */}
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
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Reject Request</h3>
            <p className="text-[11px] text-gray-500">{approval.action_label}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded hover:bg-gray-100">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-700">Reason for rejection (mandatory)</label>
          <textarea
            rows="3"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please specify reason for audit log…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={busy || !reason.trim()}
            className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {busy ? 'Rejecting…' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </div>
  );
}
