import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';

const toISO = (d) => d.toISOString().slice(0, 10);

const getPresetDates = (preset) => {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: toISO(now), to: toISO(now) };
    case 'yesterday': {
      const y = new Date(now.getTime() - 86400000);
      return { from: toISO(y), to: toISO(y) };
    }
    case 'this_week': {
      const day = now.getDay() || 7;
      const mon = new Date(now.getTime() - (day - 1) * 86400000);
      return { from: toISO(mon), to: toISO(now) };
    }
    case 'this_month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toISO(first), to: toISO(now) };
    }
    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toISO(first), to: toISO(last) };
    }
    default:
      return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISO(now) };
  }
};

const formatTime12 = (timeStr) => {
  if (!timeStr) return '—';
  const parts = String(timeStr).split(':');
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const s = parts[2] ? `:${parts[2].slice(0, 2)}` : '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m}${s} ${ampm}`;
};

export default function EmployeeBiometricPunches() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [datePreset, setDatePreset] = useState('this_month');
  const [fromDate, setFromDate] = useState(() => getPresetDates('this_month').from);
  const [toDate, setToDate] = useState(() => getPresetDates('this_month').to);
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'table'

  // Data states
  const [timelineData, setTimelineData] = useState(null);
  const [rawPunches, setRawPunches] = useState([]);
  const [rawMeta, setRawMeta] = useState({ total: 0, page: 1, limit: 50 });
  const [rawPage, setRawPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Loading & Sync states
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bannerMsg, setBannerMsg] = useState(null);
  const [bannerTone, setBannerTone] = useState('success');

  const flash = (msg, tone = 'success') => {
    setBannerMsg(msg);
    setBannerTone(tone);
    setTimeout(() => setBannerMsg(null), 5000);
  };

  // 1. Load Employees & Departments for selection
  useEffect(() => {
    (async () => {
      try {
        const [empData, deptData] = await Promise.all([
          apiFetch('/hr/employees?limit=300'),
          apiFetch('/hr/departments'),
        ]);
        const empList = Array.isArray(empData) ? empData : empData?.rows || [];
        setEmployees(empList);
        setDepartments(Array.isArray(deptData) ? deptData : []);
        if (empList.length > 0 && !selectedEmpId) {
          setSelectedEmpId(String(empList[0].id));
        }
      } catch (err) {
        console.error('Failed to load initial employee list:', err);
      }
    })();
  }, []);

  // 2. Load Timeline Data when Employee or Date range changes
  const loadTimeline = useCallback(async () => {
    if (!selectedEmpId) return;
    try {
      setIsLoading(true);
      const res = await apiFetch(`/attendance/punches/employee/${selectedEmpId}?fromDate=${fromDate}&toDate=${toDate}`);
      setTimelineData(res);
    } catch (err) {
      flash(err.message || 'Failed to load employee punch history.', 'error');
      setTimelineData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEmpId, fromDate, toDate]);

  // 3. Load Raw Punches Table
  const loadRawTable = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(rawPage),
        limit: '50',
        fromDate,
        toDate,
      });
      if (selectedEmpId) params.set('employeeId', selectedEmpId);
      if (selectedDept) params.set('departmentId', selectedDept);
      if (searchTerm) params.set('search', searchTerm);

      const { data, meta } = await apiFetch(`/attendance/punches?${params.toString()}`, { withMeta: true });
      setRawPunches(Array.isArray(data) ? data : []);
      setRawMeta(meta || { total: 0, page: 1, limit: 50 });
    } catch (err) {
      flash(err.message || 'Failed to load raw punches table.', 'error');
      setRawPunches([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEmpId, selectedDept, fromDate, toDate, rawPage, searchTerm]);

  useEffect(() => {
    if (viewMode === 'timeline') {
      loadTimeline();
    } else {
      loadRawTable();
    }
  }, [viewMode, loadTimeline, loadRawTable]);

  // Handle Preset Changes
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const { from, to } = getPresetDates(preset);
    setFromDate(from);
    setToDate(to);
  };

  // Live Sync Trigger
  const handleSyncAll = async () => {
    try {
      setIsSyncing(true);
      const results = await apiFetch('/attendance/devices/sync-all', { method: 'POST' });
      const totalNew = Array.isArray(results) ? results.reduce((sum, r) => sum + (r.newPunchesInserted || 0), 0) : 0;
      flash(`Biometric sync complete! Downloaded ${totalNew} new punches from eSSL device(s).`);
      if (viewMode === 'timeline') loadTimeline();
      else loadRawTable();
    } catch (err) {
      flash('Sync failed. Please verify local eSSL device connection and IP address.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter employee dropdown by selected department
  const filteredEmployees = selectedDept
    ? employees.filter((e) => String(e.department_id) === String(selectedDept))
    : employees;

  // Compute metrics for the selected employee's period
  const totalPunches = timelineData?.punches?.length || 0;
  const summaries = timelineData?.summaries || [];
  const presentDays = summaries.filter((s) => s.status === 'present' || s.status === 'late_present').length;
  const lateDays = summaries.filter((s) => s.status === 'late_present' || s.late_minutes > 0).length;

  // Group raw punches by date string (YYYY-MM-DD)
  const punchesByDate = {};
  if (timelineData?.punches) {
    timelineData.punches.forEach((p) => {
      const d = p.punch_time.slice(0, 10);
      if (!punchesByDate[d]) punchesByDate[d] = [];
      punchesByDate[d].push(p);
    });
  }

  // Combine dates from summaries & punches (descending)
  const allDates = Array.from(
    new Set([...summaries.map((s) => s.attendance_date.slice(0, 10)), ...Object.keys(punchesByDate)])
  ).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-punch-report, #printable-punch-report * { visibility: visible; }
          #printable-punch-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Top Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            Staff &amp; Salary &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Employee Biometric Logs</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Inspect individual employee raw biometric device punches, timestamps, terminals, and shift matching.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncAll}
            disabled={isSyncing || isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Syncing eSSL…
              </>
            ) : (
              <>⚡ Sync Biometric Devices</>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            🖨️ Print Punch Report
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {bannerMsg && (
        <div
          className={`no-print p-3 rounded-xl text-xs font-semibold border ${
            bannerTone === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {bannerMsg}
        </div>
      )}

      {/* Filters Card */}
      <div className="no-print bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Department Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                const list = e.target.value
                  ? employees.filter((emp) => String(emp.department_id) === String(e.target.value))
                  : employees;
                if (list.length > 0) setSelectedEmpId(String(list[0].id));
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Employee Selector */}
          <div className="space-y-1 sm:col-span-1 lg:col-span-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select Staff Member</label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-blue-900 bg-white"
            >
              {filteredEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  [{e.employee_code || `EMP-${e.id}`}] {e.full_name} · {e.department_name || 'Staff'} ({e.designation_name || 'Member'})
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">View Mode</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden p-0.5 bg-gray-50 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`flex-1 py-1.5 rounded-md transition-colors ${
                  viewMode === 'timeline' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📅 Daily Timeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex-1 py-1.5 rounded-md transition-colors ${
                  viewMode === 'table' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📋 Raw Table
              </button>
            </div>
          </div>
        </div>

        {/* Date Range Selector & Quick Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date Presets:</span>
            {['today', 'yesterday', 'this_week', 'this_month', 'last_month'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetChange(p)}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] capitalize transition-colors ${
                  datePreset === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setDatePreset('custom'); }}
              className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800"
            />
            <span className="text-gray-400 font-bold">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setDatePreset('custom'); }}
              className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800"
            />
          </div>
        </div>
      </div>

      {/* Main Printable Canvas & Report */}
      <div id="printable-punch-report" className="space-y-6">
        
        {/* Printable Hospital Header (Only shows on print) */}
        <div className="hidden print:block border-b-2 border-blue-900 pb-3 text-center space-y-0.5">
          <h1 className="text-xl font-extrabold text-blue-900">NEHA HOSPITAL</h1>
          <p className="text-[11px] text-gray-700">47, South Park Street, Gobichettipalayam, Tamil Nadu - 638452</p>
          <div className="pt-1">
            <span className="inline-block bg-blue-900 text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase">
              Official Biometric Punch Attendance Record
            </span>
          </div>
        </div>

        {/* Selected Employee Summary Card */}
        {timelineData?.employee && (
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-bold text-lg text-emerald-400 shadow-inner">
                  {timelineData.employee.full_name?.charAt(0) || 'E'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-base tracking-wide">{timelineData.employee.full_name}</h2>
                    <span className="bg-emerald-500/20 text-emerald-300 font-mono text-[11px] px-2 py-0.5 rounded border border-emerald-400/30">
                      Code: {timelineData.employee.employee_code || '—'}
                    </span>
                  </div>
                  <div className="text-xs text-blue-200 mt-0.5 flex items-center gap-2">
                    <span>🏢 {timelineData.employee.department_name || 'Hospital Department'}</span>
                    <span>·</span>
                    <span>👔 {timelineData.employee.designation_name || 'Staff Role'}</span>
                  </div>
                </div>
              </div>

              {/* Shift info badge */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 text-xs text-right space-y-0.5">
                <div className="text-blue-300 text-[10px] font-bold uppercase tracking-wider">Assigned Shift</div>
                <div className="font-bold text-white">
                  {timelineData.employee.shift_name || 'Standard Shift'} (
                  {formatTime12(timelineData.employee.shift_start)} – {formatTime12(timelineData.employee.shift_end)})
                </div>
                {timelineData.employee.biometric_in_start && (
                  <div className="text-[10px] text-blue-200/80">
                    In Window: {timelineData.employee.biometric_in_start?.slice(0, 5)}–{timelineData.employee.biometric_in_end?.slice(0, 5)} | Out: {timelineData.employee.biometric_out_start?.slice(0, 5)}–{timelineData.employee.biometric_out_end?.slice(0, 5)}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-xs">
              <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                <span className="text-blue-300 text-[10px] font-bold uppercase block">Total Punches in Range</span>
                <span className="text-xl font-extrabold text-white">{totalPunches}</span>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                <span className="text-blue-300 text-[10px] font-bold uppercase block">Days Present</span>
                <span className="text-xl font-extrabold text-emerald-400">{presentDays} days</span>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                <span className="text-blue-300 text-[10px] font-bold uppercase block">Late Arrivals</span>
                <span className={`text-xl font-extrabold ${lateDays > 0 ? 'text-amber-400' : 'text-white'}`}>
                  {lateDays} {lateDays === 1 ? 'time' : 'times'}
                </span>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
                <span className="text-blue-300 text-[10px] font-bold uppercase block">Date Range</span>
                <span className="text-xs font-semibold text-gray-200 mt-1 block">
                  {new Date(fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – {new Date(toDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* View Mode 1: Daily Grouped Timeline View */}
        {viewMode === 'timeline' && (
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden space-y-0">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Daily Biometric Punch Log ({allDates.length} Days Recorded)
              </h2>
              <span className="text-[11px] text-gray-500 font-semibold">
                Showing all raw eSSL punches captured
              </span>
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-xs text-gray-400">Loading employee biometric punch logs…</div>
            ) : allDates.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-500 space-y-2">
                <div className="text-2xl">🔍</div>
                <div className="font-bold text-gray-700">No punches found for this date range</div>
                <p className="text-gray-400 max-w-sm mx-auto text-[11px]">
                  Ensure employee's <strong>Emp Code ({timelineData?.employee?.employee_code})</strong> is enrolled on the eSSL biometric terminal and punches have been synchronized.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {allDates.map((dateStr) => {
                  const dayPunches = punchesByDate[dateStr] || [];
                  const summary = summaries.find((s) => s.attendance_date.slice(0, 10) === dateStr);
                  const dateObj = new Date(dateStr);
                  const dayName = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
                  const dateFormatted = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                  return (
                    <div key={dateStr} className="p-4 hover:bg-gray-50/70 transition-colors space-y-3">
                      {/* Day Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-50 text-blue-900 border border-blue-200 font-extrabold text-xs px-2.5 py-1 rounded-lg">
                            {dayName}, {dateFormatted}
                          </div>
                          {summary && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                                summary.status === 'present'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : summary.status === 'late_present'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : summary.status === 'absent'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {summary.status?.replace(/_/g, ' ')}
                              {summary.late_minutes > 0 ? ` (${summary.late_minutes}m Late)` : ''}
                            </span>
                          )}
                        </div>

                        {/* Calculated Summary Timing */}
                        {summary && (
                          <div className="text-xs text-gray-600 flex items-center gap-3">
                            <span>
                              Calculated In: <strong className="text-gray-900">{formatTime12(summary.in_time)}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              Calculated Out: <strong className="text-gray-900">{formatTime12(summary.out_time)}</strong>
                            </span>
                            {summary.worked_minutes > 0 && (
                              <span className="bg-gray-100 px-2 py-0.5 rounded text-[11px] font-bold text-gray-800">
                                {Math.floor(summary.worked_minutes / 60)}h {summary.worked_minutes % 60}m
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Raw Punches Recorded on Biometric Machine */}
                      <div className="space-y-1.5 pl-1">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Raw eSSL Biometric Punches ({dayPunches.length}):
                        </div>
                        {dayPunches.length === 0 ? (
                          <div className="text-xs text-gray-400 italic">No physical biometric punch registered for this date.</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {dayPunches.map((p, idx) => {
                              const punchTime = p.punch_time.slice(11, 19);
                              const isFirst = idx === 0;
                              const isLast = idx === dayPunches.length - 1 && dayPunches.length > 1;

                              return (
                                <div
                                  key={p.id || idx}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-xs ${
                                    isFirst
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                      : isLast
                                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                                      : 'bg-gray-50 border-gray-200 text-gray-800'
                                  }`}
                                >
                                  <span>📟</span>
                                  <span className="font-extrabold font-mono">{formatTime12(punchTime)}</span>
                                  <span className="text-[10px] text-gray-400 font-normal">
                                    · {p.device_id || 'eSSL Device'}
                                  </span>
                                  {isFirst && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded">FIRST IN</span>}
                                  {isLast && <span className="text-[9px] font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.2 rounded">LAST OUT</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* View Mode 2: Full Raw Punch Table */}
        {viewMode === 'table' && (
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden space-y-0">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Raw Biometric Punches ({rawMeta.total} Total Punches)
              </h2>
              <div className="no-print">
                <input
                  type="text"
                  placeholder="Search code / device…"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setRawPage(1); }}
                  className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs bg-white"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-xs text-gray-400">Loading raw punch records…</div>
            ) : rawPunches.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-500">No raw punch rows matched the filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50/90 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5">Punch Timestamp</th>
                      <th className="text-left px-3 py-2.5">Emp Code</th>
                      <th className="text-left px-3 py-2.5">Staff Name</th>
                      <th className="text-left px-3 py-2.5">Department</th>
                      <th className="text-left px-3 py-2.5">Biometric Device</th>
                      <th className="text-center px-3 py-2.5">Type</th>
                      <th className="text-center px-3 py-2.5">Processed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rawPunches.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-bold font-mono text-gray-900">
                          {new Date(p.punch_time).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                          })}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-blue-700 font-mono">
                          {p.employee_code}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-gray-800">
                          {p.employee_name || <span className="text-amber-600 italic">Unlinked Code</span>}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500">
                          {p.department_name || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">
                          {p.device_id || 'eSSL Device'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                            {p.punch_type || 'punch'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {p.is_processed ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              ✓ Processed
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {rawMeta.total > rawMeta.limit && (
              <div className="no-print px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  Page {rawMeta.page} of {Math.ceil(rawMeta.total / rawMeta.limit)} ({rawMeta.total} records)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={rawPage <= 1}
                    onClick={() => setRawPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={rawPage * rawMeta.limit >= rawMeta.total}
                    onClick={() => setRawPage((p) => p + 1)}
                    className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
