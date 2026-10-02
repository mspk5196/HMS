import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../util/api';
import PageHeader from '../../components/PageHeader';
import { hasPermission } from '../../util/permissions';
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
  GET: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  POST: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  PUT: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  PATCH: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  DELETE: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
};

function formatStatusBadge(status) {
  const code = parseInt(status, 10) || 0;
  if (code >= 200 && code < 300) {
    return { label: `${code} OK`, cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' };
  }
  if (code >= 300 && code < 400) {
    return { label: `${code} Redirect`, cls: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800' };
  }
  if (code === 401) {
    return { label: '401 Unauthorized', cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800 font-semibold' };
  }
  if (code === 403) {
    return { label: '403 Forbidden', cls: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-400 border-rose-200 dark:border-rose-800 font-semibold' };
  }
  if (code >= 400 && code < 500) {
    return { label: `${code} Client Err`, cls: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' };
  }
  if (code >= 500) {
    return { label: `${code} Server Err`, cls: 'bg-rose-600 text-white border-rose-700 font-bold' };
  }
  return { label: `${code}`, cls: 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700' };
}

function parseISTDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  let str = String(v).trim();
  // If string format is "YYYY-MM-DD HH:mm:ss" without offset, treat as IST
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(str)) {
    if (!str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
      str = str.replace(' ', 'T') + '+05:30';
    }
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(v) {
  if (!v) return '—';
  const d = parseISTDate(v);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
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
  const d = parseISTDate(v);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${Math.max(0, sec)}s ago`;
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
      const statsData = res?.data || res;
      if (statsData) {
        setStats(statsData);
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
      const data = res?.data || res;
      if (data && Array.isArray(data.logs)) {
        setLogs(data.logs);
        setTotalCount(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setErrorMsg('Failed to load request audit logs');
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

  if (!hasPermission(user, 'audit.view')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm my-6">
        <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3">
          <LockIcon className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Access Denied</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1">
          You do not have permission to view HTTP request audit logs. Please contact your system administrator to update role permissions in Settings.
        </p>
      </div>
    );
  }

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
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 shadow-xs text-xs text-slate-600 dark:text-slate-400">
            <ClockIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span className="text-[11px] font-medium">Auto-refresh:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value={0} className="dark:bg-slate-900">Off</option>
              <option value={10} className="dark:bg-slate-900">10s</option>
              <option value={30} className="dark:bg-slate-900">30s</option>
              <option value={60} className="dark:bg-slate-900">1m</option>
            </select>
          </div>

          {/* Manual Refresh */}
          <button
            onClick={() => {
              fetchLogs();
              fetchStats();
            }}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors disabled:opacity-50"
            title="Refresh logs"
          >
            <SyncIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`} />
            <span>Refresh</span>
          </button>

          {/* Export CSV - Gated by audit.export permission */}
          {hasPermission(user, 'audit.export') && (
            <button
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Compliance / Privacy Callout */}
      <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-xl p-3.5 flex items-start gap-3 shadow-xs">
        <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldIcon className="w-4 h-4" />
        </div>
        <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          <span className="font-bold text-slate-900 dark:text-white">Privacy &amp; Security Compliance Guard: </span>
          In strict compliance with healthcare data regulations and confidentiality standards, this audit trail records
          only network and security metadata (<strong>Who</strong>, <strong>From Where</strong>, <strong>When</strong>, <strong>Public IP / Device</strong>, and <strong>Status Code</strong>).
          <span className="font-semibold text-emerald-800 dark:text-emerald-300"> Request headers, request payload bodies, query data, and clinical patient details are strictly never logged or stored.</span>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      {stats?.today && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Today Requests</span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{stats.today.total.toLocaleString()}</div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Total API hits</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/50 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">2xx Success</span>
            <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">{stats.today.success2xx.toLocaleString()}</div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-500">Healthy responses</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/50 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">4xx Client Err</span>
            <div className="text-xl font-extrabold text-amber-700 dark:text-amber-400 mt-1">{stats.today.clientErr4xx.toLocaleString()}</div>
            <span className="text-[10px] text-amber-600 dark:text-amber-500">Auth &amp; bad requests</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/50 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">5xx Server Err</span>
            <div className="text-xl font-extrabold text-rose-700 dark:text-rose-400 mt-1">{stats.today.serverErr5xx.toLocaleString()}</div>
            <span className="text-[10px] text-rose-600 dark:text-rose-500">Backend exceptions</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/50 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Unique IPs</span>
            <div className="text-xl font-extrabold text-indigo-700 dark:text-indigo-400 mt-1">{stats.today.uniqueIps.toLocaleString()}</div>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-500">Distinct public IPs</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Avg Latency</span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{stats.today.avgLatencyMs || 0} ms</div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Response speed</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[220px]">
            <SearchIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={handleFilterChange(setSearch)}
              placeholder="Search by endpoint, user, public IP, or device…"
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
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
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="" className="dark:bg-slate-900">All Methods</option>
              <option value="GET" className="dark:bg-slate-900">GET</option>
              <option value="POST" className="dark:bg-slate-900">POST</option>
              <option value="PUT" className="dark:bg-slate-900">PUT</option>
              <option value="PATCH" className="dark:bg-slate-900">PATCH</option>
              <option value="DELETE" className="dark:bg-slate-900">DELETE</option>
            </select>
          </div>

          {/* Status Group Filter */}
          <div className="w-40">
            <select
              value={statusGroup}
              onChange={handleFilterChange(setStatusGroup)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="" className="dark:bg-slate-900">All Status Codes</option>
              <option value="2xx" className="dark:bg-slate-900">2xx (Success)</option>
              <option value="3xx" className="dark:bg-slate-900">3xx (Redirect)</option>
              <option value="4xx" className="dark:bg-slate-900">4xx (Client Error)</option>
              <option value="5xx" className="dark:bg-slate-900">5xx (Server Error)</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={handleFilterChange(setStartDate)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={handleFilterChange(setEndDate)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Clear Filters */}
          {(search || method || statusGroup || startDate || endDate) && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-semibold px-2 py-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="cursor-pointer font-bold">✕</button>
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">When (Timestamp)</th>
                <th className="py-3 px-4">From Where (Endpoint)</th>
                <th className="py-3 px-4">By Whom (User &amp; Role)</th>
                <th className="py-3 px-4">Device &amp; Public IP</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Latency</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <SyncIcon className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                    <span>Loading request audit logs…</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <ShieldIcon className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">No request audit logs found</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Try widening your search terms or clearing date filters.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const statusInfo = formatStatusBadge(log.status_code);
                  const methodClass = METHOD_COLORS[log.method] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                  const isAnon = !log.user_id || log.username === 'Anonymous';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      {/* When */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{formatDateTime(log.created_at)}</div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{timeAgo(log.created_at)}</span>
                      </td>

                      {/* From Where */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${methodClass}`}>
                            {log.method}
                          </span>
                          <span className="font-mono text-xs text-slate-900 dark:text-slate-200 truncate max-w-xs md:max-w-sm" title={log.endpoint}>
                            {log.endpoint}
                          </span>
                        </div>
                      </td>

                      {/* By Whom */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${isAnon ? 'text-slate-500 dark:text-slate-400 italic' : 'text-slate-900 dark:text-slate-100'}`}>
                            {log.username || 'Anonymous'}
                          </span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium inline-block mt-0.5 ${
                          isAnon ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40'
                        }`}>
                          {log.role_name || 'Public'}
                        </span>
                      </td>

                      {/* Device & Public IP */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          <span>{log.ip_address}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-xs" title={log.device_info || log.user_agent}>
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
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-xs text-slate-600 dark:text-slate-400">
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
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/60 cursor-pointer transition-colors"
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
        <div className="p-3 bg-slate-50/90 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Showing {logs.length} of {totalCount.toLocaleString()} requests</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="flex items-center gap-1">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs cursor-pointer"
              >
                <option value={25} className="dark:bg-slate-900">25</option>
                <option value={50} className="dark:bg-slate-900">50</option>
                <option value={100} className="dark:bg-slate-900">100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              Previous
            </button>
            <span className="px-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Metadata Detail Modal / Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                  <ShieldIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Request Audit Metadata</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Record ID #{selectedLog.id} • {formatDateTime(selectedLog.created_at)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Endpoint Card */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">From Where (Request Endpoint)</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${METHOD_COLORS[selectedLog.method] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                    {selectedLog.method}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 break-all">{selectedLog.endpoint}</span>
                </div>
              </div>

              {/* Grid 2-col */}
              <div className="grid grid-cols-2 gap-3">
                {/* By Whom */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">By Whom</span>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{selectedLog.username || 'Anonymous'}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Role: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedLog.role_name || 'Public'}</span></div>
                  {selectedLog.user_id && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">User ID: #{selectedLog.user_id}</div>
                  )}
                </div>

                {/* Status & Latency */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Response Outcome</span>
                  <div>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] border font-bold ${formatStatusBadge(selectedLog.status_code).cls}`}>
                      {formatStatusBadge(selectedLog.status_code).label}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                    Latency: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedLog.response_time_ms} ms</span>
                  </div>
                </div>
              </div>

              {/* Device & Public IP Card */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Which Device &amp; Public IP</span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Public IP Address:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded">
                    {selectedLog.ip_address}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Device Platform:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLog.device_info || 'Unknown Device'}</span>
                </div>
                {selectedLog.user_agent && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block mb-0.5">Raw User Agent:</span>
                    <div className="font-mono text-[10px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 break-all max-h-24 overflow-y-auto">
                      {selectedLog.user_agent}
                    </div>
                  </div>
                )}
              </div>

              {/* Security Policy Reminder */}
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-950 dark:text-amber-100">
                  <LockIcon className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>Zero-Payload Audit Policy</span>
                </div>
                <p>
                  Request headers (including authentication tokens, cookies) and request payload bodies are strictly omitted from audit storage to prevent leakage of credentials or patient health records.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
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
