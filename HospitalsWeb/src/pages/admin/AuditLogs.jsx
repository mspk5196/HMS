import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../util/api';
import PageHeader from '../../components/PageHeader';
import {
  SearchIcon,
  SyncIcon,
  DownloadIcon,
  ClockIcon,
  UserIcon,
  LockIcon,
  CheckIcon,
  XIcon,
} from '../../components/Icons';

function ShieldIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.959 11.959 0 0112 2.714z" />
    </svg>
  );
}

function ServerIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.75 5.1a3 3 0 012.4-1.35h7.7a3 3 0 012.4 1.35l2.1 3.45a4.5 4.5 0 01.9 2.7" />
    </svg>
  );
}

const METHOD_COLORS = {
  GET: 'bg-blue-50 text-blue-700 border-blue-200',
  POST: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PUT: 'bg-amber-50 text-amber-700 border-amber-200',
  PATCH: 'bg-purple-50 text-purple-700 border-purple-200',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
};

function formatStatusBadge(status) {
  const code = parseInt(status, 10) || 0;
  if (code >= 200 && code < 300) {
    return { label: `${code} OK`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (code >= 300 && code < 400) {
    return { label: `${code} Redirect`, cls: 'bg-sky-50 text-sky-700 border-sky-200' };
  }
  if (code === 401) {
    return { label: '401 Unauthorized', cls: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold' };
  }
  if (code === 403) {
    return { label: '403 Forbidden', cls: 'bg-rose-50 text-rose-800 border-rose-200 font-semibold' };
  }
  if (code >= 400 && code < 500) {
    return { label: `${code} Client Err`, cls: 'bg-orange-50 text-orange-700 border-orange-200' };
  }
  if (code >= 500) {
    return { label: `${code} Server Err`, cls: 'bg-rose-600 text-white border-rose-700 font-bold' };
  }
  return { label: `${code}`, cls: 'bg-gray-100 text-gray-700 border-gray-200' };
}

function formatDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function timeAgo(v) {
  if (!v) return '';
  const diff = Date.now() - new Date(v).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function AuditLogs({ user }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [statusGroup, setStatusGroup] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0); // 0 = off, 15 = 15s, 30 = 30s

  // Selected row for detail drawer
  const [selectedLog, setSelectedLog] = useState(null);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch('/audit/stats');
      if (res?.success && res.data) {
        setStats(res.data);
      }
    } catch (_) {
      // Ignore background stats failures
    }
  }, []);

  // Fetch Logs
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', limit);
      if (search.trim()) params.set('search', search.trim());
      if (method) params.set('method', method);
      if (statusGroup) params.set('statusGroup', statusGroup);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await apiFetch(`/audit/logs?${params.toString()}`);
      if (res?.success && res.data) {
        setLogs(res.data.logs || []);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setErrorMsg(res?.message || 'Failed to load request audit logs');
      }
    } catch (e) {
      setErrorMsg(e.message || 'Error fetching audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, method, statusGroup, startDate, endDate]);

  // Initial load
  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [fetchLogs, fetchStats]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefreshInterval) return;
    const timer = setInterval(() => {
      fetchLogs();
      fetchStats();
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchLogs, fetchStats]);

  // Reset to page 1 on filter changes
  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setMethod('');
    setStatusGroup('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Export filtered logs to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['ID', 'Timestamp', 'Method', 'Endpoint', 'User', 'Role', 'Public IP', 'Device', 'Status Code', 'Latency (ms)'];
    const rows = logs.map((l) => [
      l.id,
      `"${formatDateTime(l.created_at)}"`,
      l.method,
      `"${l.endpoint}"`,
      `"${l.username || 'Anonymous'}"`,
      `"${l.role_name || 'Public'}"`,
      `"${l.ip_address}"`,
      `"${l.device_info || 'Unknown'}"`,
      l.status_code,
      l.response_time_ms || 0,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          category="Admin & Security"
          title="HTTP Request Audit Logs"
          subtitle="Real-time audit trail of all incoming requests with source public IP, client device, identity, and status code."
        />

        <div className="flex items-center gap-2">
          {/* Auto Refresh selector */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-xs text-xs text-gray-600">
            <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[11px] font-medium">Auto-refresh:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="text-xs font-semibold text-gray-800 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value={0}>Off</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>1m</option>
            </select>
          </div>

          {/* Manual Refresh */}
          <button
            onClick={() => {
              fetchLogs();
              fetchStats();
            }}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors disabled:opacity-50"
            title="Refresh logs"
          >
            <SyncIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-gray-500'}`} />
            <span>Refresh</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1b3b82] hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Compliance / Privacy Callout */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex items-start gap-3 shadow-xs">
        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldIcon className="w-4 h-4" />
        </div>
        <div className="text-xs text-blue-900 leading-relaxed">
          <span className="font-bold">Privacy &amp; Security Compliance Guard: </span>
          In strict compliance with healthcare data regulations and confidentiality standards, this audit trail records
          only network and security metadata (<strong>Who</strong>, <strong>From Where</strong>, <strong>When</strong>, <strong>Public IP / Device</strong>, and <strong>Status Code</strong>).
          <span className="font-semibold text-blue-950"> Request headers, request payload bodies, query data, and clinical patient details are strictly never logged or stored.</span>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      {stats?.today && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Today Requests</span>
            <div className="text-xl font-extrabold text-gray-900 mt-1">{stats.today.total.toLocaleString()}</div>
            <span className="text-[10px] text-gray-400">Total API hits</span>
          </div>

          <div className="bg-white border border-emerald-200/80 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">2xx Success</span>
            <div className="text-xl font-extrabold text-emerald-700 mt-1">{stats.today.success2xx.toLocaleString()}</div>
            <span className="text-[10px] text-emerald-600">Healthy responses</span>
          </div>

          <div className="bg-white border border-amber-200/80 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">4xx Client Err</span>
            <div className="text-xl font-extrabold text-amber-700 mt-1">{stats.today.clientErr4xx.toLocaleString()}</div>
            <span className="text-[10px] text-amber-600">Auth &amp; bad requests</span>
          </div>

          <div className="bg-white border border-rose-200/80 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">5xx Server Err</span>
            <div className="text-xl font-extrabold text-rose-700 mt-1">{stats.today.serverErr5xx.toLocaleString()}</div>
            <span className="text-[10px] text-rose-600">Backend exceptions</span>
          </div>

          <div className="bg-white border border-indigo-200/80 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">Unique IPs</span>
            <div className="text-xl font-extrabold text-indigo-700 mt-1">{stats.today.uniqueIps.toLocaleString()}</div>
            <span className="text-[10px] text-indigo-600">Distinct public IPs</span>
          </div>

          <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Avg Latency</span>
            <div className="text-xl font-extrabold text-gray-900 mt-1">{stats.today.avgLatencyMs || 0} ms</div>
            <span className="text-[10px] text-gray-400">Response speed</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[220px]">
            <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={handleFilterChange(setSearch)}
              placeholder="Search by endpoint, user, public IP, or device…"
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Method Filter */}
          <div className="w-32">
            <select
              value={method}
              onChange={handleFilterChange(setMethod)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value="">All Methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          {/* Status Group Filter */}
          <div className="w-40">
            <select
              value={statusGroup}
              onChange={handleFilterChange(setStatusGroup)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value="">All Status Codes</option>
              <option value="2xx">2xx (Success)</option>
              <option value="3xx">3xx (Redirect)</option>
              <option value="4xx">4xx (Client Error)</option>
              <option value="5xx">5xx (Server Error)</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={handleFilterChange(setStartDate)}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={handleFilterChange(setEndDate)}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Clear Filters */}
          {(search || method || statusGroup || startDate || endDate) && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1.5 rounded hover:bg-rose-50 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="cursor-pointer font-bold">✕</button>
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-3 px-4">When (Timestamp)</th>
                <th className="py-3 px-4">From Where (Endpoint)</th>
                <th className="py-3 px-4">By Whom (User &amp; Role)</th>
                <th className="py-3 px-4">Device &amp; Public IP</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Latency</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <RefreshIcon className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading request audit logs…</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <ShieldIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="font-semibold text-gray-600">No request audit logs found</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Try widening your search terms or clearing date filters.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const statusInfo = formatStatusBadge(log.status_code);
                  const methodClass = METHOD_COLORS[log.method] || 'bg-gray-100 text-gray-700 border-gray-200';
                  const isAnon = !log.user_id || log.username === 'Anonymous';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      {/* When */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-gray-800">{formatDateTime(log.created_at)}</div>
                        <span className="text-[10px] text-gray-400">{timeAgo(log.created_at)}</span>
                      </td>

                      {/* From Where */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${methodClass}`}>
                            {log.method}
                          </span>
                          <span className="font-mono text-xs text-gray-900 truncate max-w-xs md:max-w-sm" title={log.endpoint}>
                            {log.endpoint}
                          </span>
                        </div>
                      </td>

                      {/* By Whom */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${isAnon ? 'text-gray-500 italic' : 'text-gray-900'}`}>
                            {log.username || 'Anonymous'}
                          </span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium inline-block mt-0.5 ${
                          isAnon ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>
                          {log.role_name || 'Public'}
                        </span>
                      </td>

                      {/* Device & Public IP */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-gray-800">
                          <span>{log.ip_address}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 truncate max-w-xs" title={log.device_info || log.user_agent}>
                          {log.device_info || 'Unknown Device'}
                        </div>
                      </td>

                      {/* Status Code */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] border ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Latency */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-xs text-gray-600">
                        {log.response_time_ms !== null ? `${log.response_time_ms} ms` : '—'}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 bg-gray-50/80 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span>Showing {logs.length} of {totalCount.toLocaleString()} requests</span>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-gray-200 rounded px-1.5 py-0.5 bg-white text-xs cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 cursor-pointer text-xs font-semibold"
            >
              Previous
            </button>
            <span className="px-2 text-xs font-bold text-gray-800">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="px-3 py-1 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 cursor-pointer text-xs font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Metadata Detail Modal / Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50/50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  <ShieldIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Request Audit Metadata</h3>
                  <p className="text-[11px] text-gray-500">Record ID #{selectedLog.id} • {formatDateTime(selectedLog.created_at)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Endpoint Card */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">From Where (Request Endpoint)</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${METHOD_COLORS[selectedLog.method] || 'bg-gray-100 text-gray-700'}`}>
                    {selectedLog.method}
                  </span>
                  <span className="font-mono text-xs font-bold text-gray-900 break-all">{selectedLog.endpoint}</span>
                </div>
              </div>

              {/* Grid 2-col */}
              <div className="grid grid-cols-2 gap-3">
                {/* By Whom */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">By Whom</span>
                  <div className="text-xs font-bold text-gray-900">{selectedLog.username || 'Anonymous'}</div>
                  <div className="text-[11px] text-gray-500">Role: <span className="font-semibold text-gray-700">{selectedLog.role_name || 'Public'}</span></div>
                  {selectedLog.user_id && (
                    <div className="text-[10px] text-gray-400">User ID: #{selectedLog.user_id}</div>
                  )}
                </div>

                {/* Status & Latency */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Response Outcome</span>
                  <div>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] border font-bold ${formatStatusBadge(selectedLog.status_code).cls}`}>
                      {formatStatusBadge(selectedLog.status_code).label}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-600 mt-1">
                    Latency: <span className="font-mono font-bold text-gray-800">{selectedLog.response_time_ms} ms</span>
                  </div>
                </div>
              </div>

              {/* Device & Public IP Card */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Which Device &amp; Public IP</span>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Public IP Address:</span>
                  <span className="font-mono font-bold text-gray-900 bg-white border border-gray-200 px-2 py-0.5 rounded">
                    {selectedLog.ip_address}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Device Platform:</span>
                  <span className="font-semibold text-gray-800">{selectedLog.device_info || 'Unknown Device'}</span>
                </div>
                {selectedLog.user_agent && (
                  <div className="pt-2 border-t border-gray-200/80">
                    <span className="text-[10px] text-gray-400 block mb-0.5">Raw User Agent:</span>
                    <div className="font-mono text-[10px] text-gray-600 bg-white border border-gray-200 rounded p-2 break-all max-h-24 overflow-y-auto">
                      {selectedLog.user_agent}
                    </div>
                  </div>
                )}
              </div>

              {/* Security Policy Reminder */}
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <LockIcon className="w-3.5 h-3.5 text-amber-700" />
                  <span>Zero-Payload Audit Policy</span>
                </div>
                <p>
                  Request headers (including authentication tokens, cookies) and request payload bodies are strictly omitted from audit storage to prevent leakage of credentials or patient health records.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
