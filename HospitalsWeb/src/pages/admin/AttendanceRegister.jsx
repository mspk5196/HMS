import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../util/api';
import { hasPermission } from '../../util/permissions';
import EmployeePicker from '../../components/EmployeePicker';
import HospitalHeaderBanner from '../../components/HospitalHeaderBanner';
import {
  SearchIcon,
  DownloadIcon,
  PrintIcon,
  CalendarIcon,
  ClockIcon,
  CheckIcon,
  XIcon,
  BuildingOfficeIcon,
  UsersIcon,
  SyncIcon,
  PlusIcon,
} from '../../components/Icons';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present (Full Day)' },
  { value: 'late_present', label: 'Late Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'on_leave', label: 'On Leave (Approved)' },
  { value: 'lop', label: 'Loss of Pay (LOP)' },
  { value: 'week_off', label: 'Week Off' },
  { value: 'holiday', label: 'Holiday' },
];

const fmtTime12 = (v) => {
  if (!v) return '—';
  const str = String(v).trim();
  const timePart = str.includes('T')
    ? str.split('T')[1]?.replace(/Z$/, '')
    : str.includes(' ')
    ? str.split(' ')[1]
    : str;

  const parts = timePart.split(':');
  if (parts.length >= 2) {
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }
  return str;
};

const getDaysArray = (fromDate, toDate) => {
  const days = [];
  const curr = new Date(fromDate);
  const end = new Date(toDate);
  while (curr <= end) {
    days.push(curr.toISOString().slice(0, 10));
    curr.setDate(curr.getDate() + 1);
  }
  return days;
};

export default function AttendanceRegister({ departments = [], onError, onSuccess, user }) {
  const canManualMark = hasPermission(user, 'attendance.manual_mark');
  const canRecalculate = hasPermission(user, 'attendance.recalculate');
  const now = new Date();
  const [viewType, setViewType] = useState('monthly'); // 'monthly' | 'weekly' | 'custom'
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  
  // Custom & Weekly range
  const [fromDate, setFromDate] = useState(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [toDate, setToDate] = useState(() => {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'present' | 'absent' | 'late_present' | 'on_leave' | 'missed_punch'

  // Data & State
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPunches, setIsProcessingPunches] = useState(false);
  const [markingModal, setMarkingModal] = useState(null); // { employee_id, employee_name, employee_code, department_name, shift_category, date, status, in_time, out_time, reason, is_manually_marked, manually_marked_by, manually_marked_at, manual_marking_reason, marked_by_user_name, existingRecord }
  const [isSavingManual, setIsSavingManual] = useState(false);

  /** Open Manual Attendance Marking Modal for any cell */
  const openMarkModalForCell = (emp, date, dayRec) => {
    let defaultIn = '';
    let defaultOut = '';
    if (dayRec?.first_in_time) {
      const s = String(dayRec.first_in_time).trim();
      defaultIn = s.includes('T') ? s.split('T')[1].slice(0, 5) : s.includes(' ') ? s.split(' ')[1].slice(0, 5) : s.slice(0, 5);
    }
    if (dayRec?.last_out_time) {
      const s = String(dayRec.last_out_time).trim();
      defaultOut = s.includes('T') ? s.split('T')[1].slice(0, 5) : s.includes(' ') ? s.split(' ')[1].slice(0, 5) : s.slice(0, 5);
    }

    const st = dayRec?.status || 'present';
    if (!defaultIn && (st === 'present' || st === 'late_present')) defaultIn = '08:00';
    if (!defaultOut && (st === 'present' || st === 'late_present')) defaultOut = '18:00';

    setMarkingModal({
      employee_id: emp.employee_id,
      employee_name: emp.full_name,
      employee_code: emp.employee_code,
      department_name: emp.department_name,
      shift_category: emp.shift_category,
      date,
      status: st,
      in_time: defaultIn,
      out_time: defaultOut,
      reason: dayRec?.manual_marking_reason || '',
      is_manually_marked: dayRec?.is_manually_marked || 0,
      manually_marked_by: dayRec?.manually_marked_by || null,
      manually_marked_at: dayRec?.manually_marked_at || null,
      manual_marking_reason: dayRec?.manual_marking_reason || '',
      marked_by_user_name: dayRec?.marked_by_user_name || '',
      existingRecord: dayRec || null,
    });
  };

  /** Save Manual Attendance */
  const handleSaveManual = async (e) => {
    if (e) e.preventDefault();
    if (!markingModal?.employee_id) {
      if (onError) onError(null, 'Please select a staff member.');
      return;
    }
    if (!canManualMark) {
      if (onError) onError(null, 'You do not have permission to manually mark attendance.');
      return;
    }
    if (!markingModal?.date) {
      if (onError) onError(null, 'Please select an attendance date.');
      return;
    }
    if (!markingModal?.reason || !markingModal.reason.trim()) {
      if (onError) onError(null, 'Reason for manual attendance marking is mandatory.');
      return;
    }

    try {
      setIsSavingManual(true);
      const res = await apiFetch('/attendance/mark', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(markingModal.employee_id),
          date: markingModal.date,
          status: markingModal.status,
          in_time: markingModal.in_time ? `${markingModal.date} ${markingModal.in_time.length === 5 ? markingModal.in_time + ':00' : markingModal.in_time}` : null,
          out_time: markingModal.out_time ? `${markingModal.date} ${markingModal.out_time.length === 5 ? markingModal.out_time + ':00' : markingModal.out_time}` : null,
          reason: markingModal.reason.trim(),
        }),
      });
      if (onSuccess) {
        if (res?.isPendingApproval) {
          onSuccess(`Manual attendance submitted for approval (Pending Review).`);
        } else {
          onSuccess(`Manual attendance saved successfully for ${markingModal.employee_name || 'Staff'} on ${markingModal.date}!`);
        }
      }
      setMarkingModal(null);
      await loadRegister();
    } catch (err) {
      if (onError) onError(err, 'Failed to save manual attendance.');
    } finally {
      setIsSavingManual(false);
    }
  };

  // Handle period selector changes
  useEffect(() => {
    if (viewType === 'monthly') {
      const y = selectedYear;
      const m = selectedMonth;
      const lastDay = new Date(y, m, 0).getDate();
      setFromDate(`${y}-${String(m).padStart(2, '0')}-01`);
      setToDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    } else if (viewType === 'weekly') {
      const curr = new Date();
      const day = curr.getDay() || 7;
      const mon = new Date(curr.getTime() - (day - 1) * 86400000);
      const sun = new Date(mon.getTime() + 6 * 86400000);
      setFromDate(mon.toISOString().slice(0, 10));
      setToDate(sun.toISOString().slice(0, 10));
    }
  }, [viewType, selectedYear, selectedMonth]);

  const loadRegister = useCallback(async () => {
    if (!fromDate || !toDate) return;
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        fromDate,
        toDate,
      });
      if (deptFilter) params.set('departmentId', deptFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await apiFetch(`/attendance/register?${params.toString()}`);
      setData(res?.data || res || null);
    } catch (err) {
      if (onError) onError(err, 'Failed to load attendance register');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, deptFilter, searchTerm, statusFilter, onError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRegister();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadRegister]);

  /** Process biometric punches across the selected month, week, or custom date range */
  const handleProcessPunches = async () => {
    if (!fromDate || !toDate) return;
    try {
      setIsProcessingPunches(true);
      const res = await apiFetch('/attendance/process', {
        method: 'POST',
        body: JSON.stringify({ fromDate, toDate }),
      });
      if (onSuccess) {
        if (res?.isPendingApproval) {
          onSuccess('Punch recalculation submitted for approval (Pending Review).');
        } else {
          const processedCount = res?.data?.processed ?? res?.processed ?? 0;
          const datesCount = res?.data?.datesProcessed ?? res?.datesProcessed ?? 0;
          onSuccess(
            `Successfully processed punches across ${datesCount} day(s) (${fromDate} to ${toDate})! ${processedCount} daily summaries generated/updated.`
          );
        }
      }
      await loadRegister();
    } catch (err) {
      if (onError) onError(err, 'Failed to process biometric punches.');
    } finally {
      setIsProcessingPunches(false);
    }
  };

  // List of calendar days in range
  const dateColumns = useMemo(() => {
    if (!fromDate || !toDate) return [];
    return getDaysArray(fromDate, toDate);
  }, [fromDate, toDate]);

  // Export CSV
  const handleExportCSV = () => {
    if (!data || !data.rows || !data.rows.length) return;
    const headers = ['Emp Code', 'Name', 'Department', 'Designation', ...dateColumns.map(d => d.slice(5)), 'Present', 'Late', 'Absent', 'Leaves', 'Worked Hours', 'Att %'];
    const csvRows = [headers.join(',')];

    for (const r of data.rows) {
      const rowVals = [
        `"${r.employee_code}"`,
        `"${r.full_name}"`,
        `"${r.department_name || ''}"`,
        `"${r.designation_name || ''}"`,
      ];
      for (const d of dateColumns) {
        const dayRec = r.days[d];
        const st = dayRec?.status === 'present' ? 'P' : dayRec?.status === 'late_present' ? 'L' : dayRec?.status === 'absent' ? 'A' : dayRec?.status === 'on_leave' ? 'LV' : dayRec?.status === 'week_off' ? 'WO' : dayRec?.status === 'holiday' ? 'HD' : '-';
        rowVals.push(`"${st}"`);
      }
      rowVals.push(r.metrics.present_days);
      rowVals.push(r.metrics.late_days);
      rowVals.push(r.metrics.absent_days);
      rowVals.push(r.metrics.leave_days + r.metrics.lop_days);
      rowVals.push(r.metrics.total_worked_hours);
      rowVals.push(`${r.metrics.attendance_percentage}%`);
      csvRows.push(rowVals.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_Register_${fromDate}_to_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  const overall = data?.overallMetrics || {
    total_present_days: 0,
    total_late_days: 0,
    total_absent_days: 0,
    total_leave_days: 0,
    total_worked_hours: '0.0',
    avg_attendance_percentage: 0,
  };

  const rows = data?.rows || [];

  const currentDeptName = departments.find(d => String(d.id) === String(deptFilter))?.name || 'All Departments';

  const statusFilterName = {
    all: 'All Records',
    present: 'Present Only',
    late_present: 'Late Present Only',
    absent: 'Absent Only',
    on_leave: 'On Leave / LOP',
    missed_punch: 'Missed Punches',
  }[statusFilter] || 'All Records';

  const periodDescription = viewType === 'monthly'
    ? `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][selectedMonth - 1]} ${selectedYear} (${fromDate} to ${toDate})`
    : `${fromDate} to ${toDate}`;

  const printGeneratedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div>
      {/* ═══════════════════════════════════════════════════════════════
          SCREEN VIEW (Interactive UI - Hidden when printing)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-4 print:hidden">
        {/* ── Filter & Control Bar ── */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Period selector */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setViewType('monthly')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                viewType === 'monthly' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly Register
            </button>
            <button
              type="button"
              onClick={() => setViewType('weekly')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                viewType === 'weekly' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setViewType('custom')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                viewType === 'custom' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleProcessPunches}
              disabled={isLoading || isProcessingPunches}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title={`Read biometric punches and generate/update daily attendance summaries for ${
                viewType === 'monthly'
                  ? `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][selectedMonth - 1]} ${selectedYear}`
                  : viewType === 'weekly'
                  ? 'this week'
                  : 'the selected date range'
              } (${fromDate} to ${toDate})`}
            >
              {isProcessingPunches ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Processing Punches…</span>
                </>
              ) : (
                <>
                  <SyncIcon className="w-3.5 h-3.5 text-white" />
                  <span>
                    Process Punches ({viewType === 'monthly' ? 'Month' : viewType === 'weekly' ? 'Week' : 'Custom Range'})
                  </span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMarkingModal({
                employee_id: '',
                employee_name: '',
                employee_code: '',
                department_name: '',
                shift_category: '',
                date: fromDate || new Date().toISOString().slice(0, 10),
                status: 'present',
                in_time: '08:00',
                out_time: '18:00',
                reason: '',
                is_manually_marked: 0,
              })}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Mark attendance manually for any staff member"
            >
              <PlusIcon className="w-3.5 h-3.5 text-white" />
              <span>Mark Attendance</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isLoading || rows.length === 0}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <DownloadIcon className="w-4 h-4 text-gray-500" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || rows.length === 0}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <PrintIcon className="w-4 h-4 text-gray-500" />
              <span>Print Register</span>
            </button>
          </div>
        </div>

        {/* Dynamic Dates & Query Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2 border-t border-gray-100">
          {/* Monthly Month/Year Selector */}
          {viewType === 'monthly' ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Month</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Year</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </>
          )}

          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Dept</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present Only</option>
              <option value="late_present">Late Present Only</option>
              <option value="absent">Absent Only</option>
              <option value="on_leave">On Leave / LOP</option>
              <option value="missed_punch">Missed Punches</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <SearchIcon className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff name or code…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* ── Top Summary Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3 rounded-xl border border-gray-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Active Staff</div>
          <div className="text-xl font-extrabold text-gray-900 mt-1">{data?.totalEmployees || 0}</div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Avg Attendance</div>
          <div className="text-xl font-extrabold text-emerald-700 mt-1">{overall.avg_attendance_percentage}%</div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-blue-100 bg-blue-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Total Present</div>
          <div className="text-xl font-extrabold text-blue-700 mt-1">{overall.total_present_days} <span className="text-xs font-normal text-gray-500">days</span></div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-amber-100 bg-amber-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Late Arrivals</div>
          <div className="text-xl font-extrabold text-amber-700 mt-1">{overall.total_late_days}</div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-rose-100 bg-rose-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Absent / Leave</div>
          <div className="text-xl font-extrabold text-rose-700 mt-1">{overall.total_absent_days + overall.total_leave_days}</div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-purple-100 bg-purple-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Total Hours</div>
          <div className="text-xl font-extrabold text-purple-700 mt-1">{overall.total_worked_hours} <span className="text-xs font-normal text-gray-500">hrs</span></div>
        </div>
      </div>

      {/* ── Legend Bar ── */}
      <div className="bg-white px-4 py-2.5 rounded-xl border border-gray-200/80 shadow-xs flex flex-wrap items-center justify-between text-xs gap-2">
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-gray-600">
          <span className="font-bold text-gray-400 uppercase">Legend:</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px]">P</span> Present</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-amber-500 text-white font-bold flex items-center justify-center text-[10px]">L</span> Late</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-rose-500 text-white font-bold flex items-center justify-center text-[10px]">A</span> Absent</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-blue-500 text-white font-bold flex items-center justify-center text-[10px]">LV</span> Leave/LOP</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-gray-300 text-gray-700 font-bold flex items-center justify-center text-[10px]">WO</span> Week Off</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-purple-500 text-white font-bold flex items-center justify-center text-[10px]">HD</span> Holiday</span>
        </div>
        <div className="text-[11px] text-gray-400">
          Showing {rows.length} employee{rows.length === 1 ? '' : 's'} · {fromDate} to {toDate}
        </div>
      </div>

      {/* ── Register Table Matrix ── */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
            <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Loading Attendance Register…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500">
            No attendance records found matching the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-xs border-b border-gray-200 text-gray-600 text-[10px] uppercase font-bold tracking-wider select-none">
                <tr>
                  <th className="sticky left-0 z-30 bg-gray-50 px-3 py-2.5 text-left border-r border-gray-200 min-w-[200px] shadow-xs">
                    Staff Member
                  </th>
                  <th className="px-2 py-2.5 text-left border-r border-gray-200 min-w-[100px]">
                    Department
                  </th>
                  {dateColumns.map((d) => {
                    const dayNum = parseInt(d.slice(8), 10);
                    const dt = new Date(d);
                    const dayName = dt.toLocaleDateString('en-US', { weekday: 'narrow' });
                    const isSun = dt.getDay() === 0;
                    return (
                      <th
                        key={d}
                        className={`px-1 py-1.5 text-center border-r border-gray-200/80 min-w-[32px] ${
                          isSun ? 'bg-amber-50/50 text-amber-700' : ''
                        }`}
                        title={d}
                      >
                        <div className="text-[10px] leading-tight">{dayNum}</div>
                        <div className="text-[8px] font-normal text-gray-400">{dayName}</div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-2.5 text-center bg-emerald-50 text-emerald-800 border-l border-r border-gray-200 min-w-[40px]">P</th>
                  <th className="px-2 py-2.5 text-center bg-amber-50 text-amber-800 border-r border-gray-200 min-w-[40px]">L</th>
                  <th className="px-2 py-2.5 text-center bg-rose-50 text-rose-800 border-r border-gray-200 min-w-[40px]">A</th>
                  <th className="px-2 py-2.5 text-center bg-blue-50 text-blue-800 border-r border-gray-200 min-w-[40px]">LV</th>
                  <th className="px-2 py-2.5 text-center bg-purple-50 text-purple-800 border-r border-gray-200 min-w-[50px]">Hours</th>
                  <th className="px-2 py-2.5 text-center bg-gray-100 text-gray-900 min-w-[48px]">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, idx) => (
                  <tr key={r.employee_id} className={`hover:bg-blue-50/40 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/30' : 'bg-white'}`}>
                    {/* Sticky Employee column */}
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2 border-r border-gray-200 shadow-xs">
                      <div className="font-bold text-gray-900 flex items-center justify-between">
                        <span className="truncate max-w-[140px]" title={r.full_name}>{r.full_name}</span>
                        <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1 py-0.5 rounded ml-1">
                          {r.employee_code}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[180px]">
                        {r.designation_name || r.shift_category || 'Staff'}
                      </div>
                    </td>

                    {/* Department */}
                    <td className="px-2 py-2 text-gray-600 border-r border-gray-200 truncate max-w-[120px]" title={r.department_name}>
                      {r.department_name || '—'}
                    </td>

                    {/* Matrix Day Badges */}
                    {dateColumns.map((d) => {
                      const dayRec = r.days[d];
                      if (!dayRec) {
                        return (
                          <td
                            key={d}
                            onClick={() => openMarkModalForCell(r, d, null)}
                            className="px-0.5 py-1 text-center border-r border-gray-100 text-gray-300 hover:bg-blue-100/60 cursor-pointer group transition-colors"
                            title={`Click to mark attendance for ${r.full_name} on ${d}`}
                          >
                            <span className="text-[10px] font-normal text-gray-300 group-hover:text-blue-600 group-hover:font-bold transition-all">·</span>
                          </td>
                        );
                      }

                      let bg = 'bg-emerald-500 text-white';
                      let label = 'P';
                      if (dayRec.status === 'late_present') {
                        bg = 'bg-amber-500 text-white';
                        label = 'L';
                      } else if (dayRec.status === 'absent') {
                        bg = 'bg-rose-500 text-white';
                        label = 'A';
                      } else if (dayRec.status === 'on_leave' || dayRec.status === 'lop') {
                        bg = 'bg-blue-500 text-white';
                        label = 'LV';
                      } else if (dayRec.status === 'week_off') {
                        bg = 'bg-gray-200 text-gray-600';
                        label = 'WO';
                      } else if (dayRec.status === 'holiday') {
                        bg = 'bg-purple-500 text-white';
                        label = 'HD';
                      }

                      const inTimeStr = fmtTime12(dayRec.first_in_time);
                      const outTimeStr = fmtTime12(dayRec.last_out_time);
                      const isManual = !!dayRec.is_manually_marked;
                      let tooltip = `${r.full_name} (${d})\nStatus: ${dayRec.status}\nIn: ${inTimeStr}\nOut: ${outTimeStr}\nWorked: ${(Number(dayRec.worked_minutes || 0) / 60).toFixed(1)}h`;
                      if (isManual) {
                        tooltip += `\n[MANUALLY MARKED by ${dayRec.marked_by_user_name || 'Admin'}${dayRec.manually_marked_at ? ' on ' + new Date(dayRec.manually_marked_at).toLocaleDateString('en-IN') : ''}]\nReason: ${dayRec.manual_marking_reason || 'N/A'}`;
                      }

                      return (
                        <td
                          key={d}
                          className="px-0.5 py-1 text-center border-r border-gray-100 relative"
                          title={tooltip}
                        >
                          <span
                            onClick={() => openMarkModalForCell(r, d, dayRec)}
                            className={`relative inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-extrabold cursor-pointer transition-transform hover:scale-110 shadow-2xs ${bg}`}
                          >
                            {label}
                            {isManual && (
                              <span
                                className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-600 ring-1.5 ring-white"
                                title={`Manually marked by ${dayRec.marked_by_user_name || 'Admin'}`}
                              />
                            )}
                          </span>
                        </td>
                      );
                    })}

                    {/* Summary Totals */}
                    <td className="px-2 py-2 text-center font-bold text-emerald-700 bg-emerald-50/50 border-l border-r border-gray-200">
                      {r.metrics.present_days}
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-amber-700 bg-amber-50/50 border-r border-gray-200">
                      {r.metrics.late_days}
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-rose-700 bg-rose-50/50 border-r border-gray-200">
                      {r.metrics.absent_days}
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-blue-700 bg-blue-50/50 border-r border-gray-200">
                      {r.metrics.leave_days + r.metrics.lop_days}
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-purple-700 bg-purple-50/50 border-r border-gray-200">
                      {r.metrics.total_worked_hours}h
                    </td>
                    <td className="px-2 py-2 text-center font-extrabold text-gray-900 bg-gray-50/80">
                      {r.metrics.attendance_percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Attendance Details & Manual Marking Modal ── */}
      {markingModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveManual}
            className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-blue-50/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  <CalendarIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-gray-900">
                    {markingModal.existingRecord ? 'Edit Attendance (Manual Override)' : 'Mark Attendance Manually'}
                  </h3>
                  <div className="text-xs text-gray-500">
                    {markingModal.date ? new Date(markingModal.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : 'Select Date'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMarkingModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Staff Member Picker / Info */}
              {markingModal.employee_id && markingModal.employee_name ? (
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{markingModal.employee_name}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Code: <span className="font-mono font-semibold text-gray-700">{markingModal.employee_code}</span> · Dept: <span className="font-semibold text-gray-700">{markingModal.department_name || 'General'}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
                    {markingModal.shift_category || 'Staff'}
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <EmployeePicker
                    value={markingModal.employee_id}
                    onChange={(id, emp) => {
                      setMarkingModal((m) => ({
                        ...m,
                        employee_id: id,
                        employee_name: emp?.full_name || '',
                        employee_code: emp?.employee_code || '',
                        department_name: emp?.department_name || '',
                        shift_category: emp?.shift_category || '',
                      }));
                    }}
                    label="Select Staff Member"
                    required={true}
                  />
                </div>
              )}

              {/* Date Input if not pre-locked or allowing adjustment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    Attendance Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={markingModal.date}
                    onChange={(e) => setMarkingModal((m) => ({ ...m, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>

                {/* Status Selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={markingModal.status}
                    onChange={(e) => setMarkingModal((m) => ({ ...m, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Existing Biometric punches strip if available */}
              {markingModal.existingRecord && (markingModal.existingRecord.first_in_time || markingModal.existingRecord.last_out_time) && (
                <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100/80">
                  <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                    Recorded Biometric Punches
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-1.5 rounded-lg border border-blue-100">
                      <span className="block text-[9px] text-gray-400">First In</span>
                      <strong className="text-xs text-gray-800 font-mono">{fmtTime12(markingModal.existingRecord.first_in_time)}</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-blue-100">
                      <span className="block text-[9px] text-gray-400">Last Out</span>
                      <strong className="text-xs text-gray-800 font-mono">{fmtTime12(markingModal.existingRecord.last_out_time)}</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-blue-100">
                      <span className="block text-[9px] text-gray-400">Worked</span>
                      <strong className="text-xs text-blue-700">{(Number(markingModal.existingRecord.worked_minutes || 0) / 60).toFixed(1)}h</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Audit Log Banner if previously marked manually */}
              {!!markingModal.is_manually_marked && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <div className="font-bold flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Previously Marked Manually
                    </span>
                    <span className="text-[10px] text-amber-700 font-normal">
                      by <strong className="font-bold">{markingModal.marked_by_user_name || 'Admin'}</strong>
                      {markingModal.manually_marked_at && ` on ${new Date(markingModal.manually_marked_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}`}
                    </span>
                  </div>
                  {markingModal.manual_marking_reason && (
                    <div className="text-[11px] text-amber-800/90 italic bg-amber-100/50 p-2 rounded-lg mt-1">
                      "{markingModal.manual_marking_reason}"
                    </div>
                  )}
                </div>
              )}

              {/* In and Out Times */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    In Time {markingModal.status === 'present' || markingModal.status === 'late_present' ? '(Optional)' : ''}
                  </label>
                  <input
                    type="time"
                    value={markingModal.in_time}
                    onChange={(e) => setMarkingModal((m) => ({ ...m, in_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    Out Time {markingModal.status === 'present' || markingModal.status === 'late_present' ? '(Optional)' : ''}
                  </label>
                  <input
                    type="time"
                    value={markingModal.out_time}
                    onChange={(e) => setMarkingModal((m) => ({ ...m, out_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Mandatory Reason for Manual Marking */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider block">
                    Reason for Manual Marking <span className="text-rose-500 font-extrabold">* (Mandatory)</span>
                  </label>
                  <span className="text-[10px] text-gray-400">Required for audit trail</span>
                </div>
                <textarea
                  rows={3}
                  value={markingModal.reason}
                  onChange={(e) => setMarkingModal((m) => ({ ...m, reason: e.target.value }))}
                  placeholder="Enter detailed reason (e.g., On-duty hospital work, biometric scanner failure, approved half-day permission, emergency coverage)..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  required
                />
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-100 text-[11px] text-blue-800 flex items-start gap-2">
                <CheckIcon className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-blue-700/90 leading-tight">
                  Marking attendance manually will update the staff member's worked hours and attendance status. All manual actions are recorded with your user credentials for compliance.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setMarkingModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingManual || !markingModal.employee_id || !markingModal.reason?.trim()}
                className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-bold px-5 py-2 rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingManual ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Saving…</span>
                  </>
                ) : (
                  <span>Save Attendance</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          OFFICIAL PRINT DOCUMENT (Rendered ONLY in window.print())
          ═══════════════════════════════════════════════════════════════ */}
      <div className="hidden print:block w-full text-black bg-white font-sans text-[8pt] leading-tight">
        {/* Hospital Official Letterhead */}
        <HospitalHeaderBanner
          variant="report"
          documentTitle="STAFF ATTENDANCE REGISTER"
          documentMeta={
            <div className="text-[7pt] text-gray-600 print:text-black mt-1">
              Printed: <strong className="text-black font-bold">{printGeneratedAt}</strong>
            </div>
          }
        />

        {/* Document Metadata Strip */}
        <div className="bg-gray-100 border border-gray-400 rounded px-2.5 py-1 mb-2 flex items-center justify-between text-[7.5pt]">
          <div>
            <span className="text-gray-600 uppercase font-bold text-[7pt]">Period: </span>
            <strong className="font-extrabold text-black">{periodDescription}</strong>
          </div>
          <div>
            <span className="text-gray-600 uppercase font-bold text-[7pt]">Department: </span>
            <strong className="font-extrabold text-black">{currentDeptName}</strong>
          </div>
          <div>
            <span className="text-gray-600 uppercase font-bold text-[7pt]">Filter: </span>
            <strong className="font-bold text-black">{statusFilterName}</strong>
          </div>
          <div>
            <span className="text-gray-600 uppercase font-bold text-[7pt]">Total Staff: </span>
            <strong className="font-extrabold text-black">{rows.length} Staff Member{rows.length === 1 ? '' : 's'}</strong>
          </div>
        </div>

        {/* Executive Summary Metrics Table */}
        <div className="border border-gray-400 rounded mb-2.5 p-1.5 bg-gray-50/70">
          <div className="text-[7pt] font-bold text-gray-700 uppercase tracking-wider mb-1">
            Monthly Attendance &amp; Worked Hours Summary
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[7.5pt]">
            <div className="border-r border-gray-300 pr-1">
              <span className="block text-[6.5pt] text-gray-500 uppercase font-semibold">Active Staff</span>
              <strong className="text-[9.5pt] font-extrabold text-black">{data?.totalEmployees || rows.length}</strong>
            </div>
            <div className="border-r border-gray-300 pr-1">
              <span className="block text-[6.5pt] text-gray-500 uppercase font-semibold">Avg Attendance</span>
              <strong className="text-[9.5pt] font-extrabold text-black">{overall.avg_attendance_percentage}%</strong>
            </div>
            <div className="border-r border-gray-300 pr-1">
              <span className="block text-[6.5pt] text-gray-500 uppercase font-semibold">Present Days</span>
              <strong className="text-[9.5pt] font-extrabold text-black">{overall.total_present_days}</strong>
            </div>
            <div className="border-r border-gray-300 pr-1">
              <span className="block text-[6.5pt] text-gray-500 uppercase font-semibold">Late Entries</span>
              <strong className="text-[9.5pt] font-extrabold text-black">{overall.total_late_days}</strong>
            </div>
            <div className="border-r border-gray-300 pr-1">
              <span className="block text-[6.5pt] text-gray-500 uppercase font-semibold">Absent Days</span>
              <strong className="text-[9.5pt] font-extrabold text-black">{overall.total_absent_days}</strong>
            </div>
            <div className="border-r border-gray-300 pr-1">
              <span className="block text-[6.5pt] text-gray-500 uppercase font-semibold">Leave / LOP</span>
              <strong className="text-[9.5pt] font-extrabold text-black">{overall.total_leave_days}</strong>
            </div>
            <div>
              <span className="block text-[6.5pt] text-gray-500 uppercase font-semibold">Total Worked Hrs</span>
              <strong className="text-[9.5pt] font-extrabold text-black">{overall.total_worked_hours} hrs</strong>
            </div>
          </div>
        </div>

        {/* Full Register Matrix Table */}
        <table className="w-full border-collapse border border-black text-[7pt] mb-2.5">
          <thead>
            <tr className="bg-gray-200 border-b border-black text-[6.5pt] uppercase font-bold text-black text-center">
              <th className="border border-black px-1 py-1 w-[20px] text-center">#</th>
              <th className="border border-black px-1 py-1 w-[40px] text-left">Code</th>
              <th className="border border-black px-1 py-1 min-w-[95px] text-left">Staff Name</th>
              <th className="border border-black px-1 py-1 min-w-[70px] text-left">Dept / Role</th>
              {dateColumns.map((d) => {
                const dayNum = parseInt(d.slice(8), 10);
                const dt = new Date(d);
                const dayName = dt.toLocaleDateString('en-US', { weekday: 'narrow' });
                const isSun = dt.getDay() === 0;
                return (
                  <th
                    key={d}
                    className={`border border-black px-0.5 py-0.5 text-center ${
                      isSun ? 'bg-gray-300 font-extrabold' : ''
                    }`}
                  >
                    <div>{dayNum}</div>
                    <div className="text-[5.5pt] font-normal">{dayName}</div>
                  </th>
                );
              })}
              <th className="border border-black px-0.5 py-1 w-[18px] bg-gray-100 font-extrabold" title="Present">P</th>
              <th className="border border-black px-0.5 py-1 w-[18px] bg-gray-100 font-extrabold" title="Late">L</th>
              <th className="border border-black px-0.5 py-1 w-[18px] bg-gray-100 font-extrabold" title="Absent">A</th>
              <th className="border border-black px-0.5 py-1 w-[18px] bg-gray-100 font-extrabold" title="Leave">LV</th>
              <th className="border border-black px-0.5 py-1 w-[20px] bg-gray-100 font-extrabold" title="Week Off">WO</th>
              <th className="border border-black px-0.5 py-1 w-[28px] bg-gray-100 font-extrabold" title="Worked Hours">Hrs</th>
              <th className="border border-black px-0.5 py-1 w-[26px] bg-gray-100 font-extrabold" title="Attendance Percentage">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              let woCount = 0;
              for (const d of dateColumns) {
                if (r.days[d]?.status === 'week_off') woCount++;
              }
              return (
                <tr key={r.employee_id} className="border-b border-gray-400 break-inside-avoid">
                  <td className="border border-black px-1 py-0.5 text-center text-gray-700 font-medium">
                    {idx + 1}
                  </td>
                  <td className="border border-black px-1 py-0.5 font-mono text-[6.5pt] font-bold text-black">
                    {r.employee_code}
                  </td>
                  <td className="border border-black px-1 py-0.5 font-bold text-black text-left whitespace-nowrap overflow-hidden">
                    {r.full_name}
                  </td>
                  <td className="border border-black px-1 py-0.5 text-[6.5pt] text-gray-800 text-left whitespace-nowrap overflow-hidden">
                    {r.department_name || '—'} {r.designation_name ? `· ${r.designation_name}` : ''}
                  </td>
                  {dateColumns.map((d) => {
                    const dayRec = r.days[d];
                    const isSun = new Date(d).getDay() === 0;
                    if (!dayRec) {
                      return (
                        <td
                          key={d}
                          className={`border border-black px-0.5 py-0.5 text-center text-[6.5pt] text-gray-400 ${
                            isSun ? 'bg-gray-100' : ''
                          }`}
                        >
                          -
                        </td>
                      );
                    }

                    let code = 'P';
                    let cellClass = 'font-bold text-black';
                    if (dayRec.status === 'late_present') {
                      code = 'L';
                      cellClass = 'font-extrabold text-amber-900 bg-amber-50';
                    } else if (dayRec.status === 'absent') {
                      code = 'A';
                      cellClass = 'font-extrabold text-rose-900 bg-rose-50';
                    } else if (dayRec.status === 'on_leave' || dayRec.status === 'lop') {
                      code = 'LV';
                      cellClass = 'font-bold text-blue-900 bg-blue-50';
                    } else if (dayRec.status === 'week_off') {
                      code = 'WO';
                      cellClass = 'font-normal text-gray-600 bg-gray-100';
                    } else if (dayRec.status === 'holiday') {
                      code = 'HD';
                      cellClass = 'font-bold text-purple-900 bg-purple-50';
                    }

                    return (
                      <td
                        key={d}
                        className={`border border-black px-0.5 py-0.5 text-center text-[6.5pt] ${cellClass}`}
                      >
                        {code}
                      </td>
                    );
                  })}
                  <td className="border border-black px-0.5 py-0.5 text-center font-bold text-black bg-gray-50">
                    {r.metrics.present_days}
                  </td>
                  <td className="border border-black px-0.5 py-0.5 text-center font-bold text-black bg-gray-50">
                    {r.metrics.late_days}
                  </td>
                  <td className="border border-black px-0.5 py-0.5 text-center font-bold text-black bg-gray-50">
                    {r.metrics.absent_days}
                  </td>
                  <td className="border border-black px-0.5 py-0.5 text-center font-bold text-black bg-gray-50">
                    {r.metrics.leave_days + r.metrics.lop_days}
                  </td>
                  <td className="border border-black px-0.5 py-0.5 text-center font-medium text-gray-700 bg-gray-50">
                    {woCount}
                  </td>
                  <td className="border border-black px-0.5 py-0.5 text-center font-bold text-black bg-gray-50">
                    {r.metrics.total_worked_hours}
                  </td>
                  <td className="border border-black px-0.5 py-0.5 text-center font-extrabold text-black bg-gray-100">
                    {r.metrics.attendance_percentage}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Legend & Compliance Footer Note */}
        <div className="border border-gray-400 rounded px-2 py-1 mb-4 flex items-center justify-between text-[6.5pt] text-gray-700 bg-gray-50">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-black uppercase">Legend:</span>
            <span><strong>P</strong> = Present</span>
            <span><strong>L</strong> = Late Present</span>
            <span><strong>A</strong> = Absent</span>
            <span><strong>LV</strong> = Leave / LOP</span>
            <span><strong>WO</strong> = Week Off</span>
            <span><strong>HD</strong> = Holiday</span>
          </div>
          <div>
            Note: All shift hours and attendance logs are verified against hospital biometric device records.
          </div>
        </div>

        {/* Official Signatures & Verification Block for physical filing */}
        <div className="pt-2 border-t-2 border-black grid grid-cols-3 gap-6 text-center text-[7.5pt] break-inside-avoid">
          <div>
            <div className="h-8"></div>
            <div className="border-t border-black pt-1">
              <strong className="block text-black font-bold uppercase">PREPARED BY</strong>
              <span className="text-[6.5pt] text-gray-600 block">HR / Attendance In-Charge</span>
              <span className="text-[6pt] text-gray-500 block">Signature &amp; Date</span>
            </div>
          </div>
          <div>
            <div className="h-8"></div>
            <div className="border-t border-black pt-1">
              <strong className="block text-black font-bold uppercase">VERIFIED BY</strong>
              <span className="text-[6.5pt] text-gray-600 block">HR Manager / Accounts</span>
              <span className="text-[6pt] text-gray-500 block">Signature &amp; Date</span>
            </div>
          </div>
          <div>
            <div className="h-8"></div>
            <div className="border-t border-black pt-1">
              <strong className="block text-black font-bold uppercase">APPROVED BY</strong>
              <span className="text-[6.5pt] text-gray-600 block">Medical Superintendent / Director</span>
              <span className="text-[6pt] text-gray-500 block">Official Seal &amp; Signature</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
