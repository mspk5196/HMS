import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../util/api';
import { hasPermission } from '../../util/permissions';
import {
  SearchIcon,
  CheckIcon,
  XIcon,
  ClockIcon,
  TrashIcon,
  MapPinIcon,
  BoltIcon,
  UsersIcon,
  CalendarIcon,
  BuildingOfficeIcon,
} from '../../components/Icons';

const fmtMinutes = (m) => {
  const n = Number(m || 0);
  if (!n) return '0m';
  const h = Math.floor(n / 60);
  const rem = n % 60;
  return h ? `${h}h ${String(rem).padStart(2, '0')}m` : `${rem}m`;
};

const fmtTime12 = (t) => {
  if (!t) return '—';
  const str = String(t).trim();
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

export default function LateAttendanceFines({ departments = [], onError, onSuccess, user }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [deptFilter, setDeptFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('exceeded'); // 'exceeded' | 'all_late'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'fined'
  const [staffTypeFilter, setStaffTypeFilter] = useState('all'); // 'all' | 'doctors' | 'staff'

  // Data states
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  // Selection and fine customization map: { [employeeId]: { selected: boolean, days: number, amount: number, reason: string } }
  const [fineInputs, setFineInputs] = useState({});
  const [perDayFineRate, setPerDayFineRate] = useState(100);

  // Modals
  const [detailCandidate, setDetailCandidate] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Helper to check if a candidate is a doctor
  const isCandidateDoctor = useCallback((c) => {
    return Boolean(
      c.is_doctor === 1 ||
      c.is_doctor === true ||
      c.department_name?.toLowerCase().includes('medical') ||
      c.designation_name?.toLowerCase().includes('doctor') ||
      c.designation_name?.toLowerCase().includes('consultant') ||
      c.designation_name?.toLowerCase().includes('surgeon') ||
      c.full_name?.toLowerCase().startsWith('dr.') ||
      c.full_name?.toLowerCase().startsWith('dr ')
    );
  }, []);

  // 1. Fetch Candidates
  const loadCandidates = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
        filterMode,
      });
      if (deptFilter) params.set('departmentId', deptFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await apiFetch(`/attendance/late-fines/candidates?${params.toString()}`);
      const list = Array.isArray(res?.candidates) ? res.candidates : [];
      setCandidates(list);

      // Initialize fine inputs for newly loaded candidates
      setFineInputs((prev) => {
        const next = { ...prev };
        list.forEach((c) => {
          if (!next[c.employee_id]) {
            const defaultDays = c.total_late_days || 1;
            next[c.employee_id] = {
              selected: !c.has_active_fine, // default select if no active fine
              days: defaultDays,
              amount: defaultDays * perDayFineRate,
              reason: `Late attendance fine - ${month}/${year} (${defaultDays} late day(s), buffer exceeded)`,
            };
          }
        });
        return next;
      });
    } catch (err) {
      if (onError) onError(err, 'Failed to load late attendance candidates.');
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  }, [month, year, deptFilter, searchTerm, filterMode, perDayFineRate, onError]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // Handle default rate update across all or selected candidates
  const applyRateToAll = (newRate) => {
    const rate = Math.max(0, Number(newRate) || 0);
    setPerDayFineRate(rate);
    setFineInputs((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((empId) => {
        const days = next[empId].days || 1;
        next[empId].amount = days * rate;
      });
      return next;
    });
  };

  // Filter candidates locally for staff type and fine status
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const isDoc = isCandidateDoctor(c);
      if (staffTypeFilter === 'doctors' && !isDoc) return false;
      if (staffTypeFilter === 'staff' && isDoc) return false;

      if (statusFilter === 'pending' && c.has_active_fine) return false;
      if (statusFilter === 'fined' && !c.has_active_fine) return false;
      return true;
    });
  }, [candidates, staffTypeFilter, statusFilter, isCandidateDoctor]);

  // Selection handlers
  const handleToggleSelect = (empId) => {
    setFineInputs((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        selected: !prev[empId]?.selected,
      },
    }));
  };

  const handleSelectAll = (select = true) => {
    setFineInputs((prev) => {
      const next = { ...prev };
      filteredCandidates.forEach((c) => {
        if (!next[c.employee_id]) {
          next[c.employee_id] = {
            selected: select,
            days: c.total_late_days,
            amount: c.total_late_days * perDayFineRate,
            reason: `Late attendance fine - ${month}/${year}`,
          };
        } else {
          next[c.employee_id].selected = select;
        }
      });
      return next;
    });
  };

  const handleUpdateDays = (empId, days) => {
    const d = Math.max(1, Number(days) || 1);
    setFineInputs((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        days: d,
        amount: d * perDayFineRate,
      },
    }));
  };

  const handleUpdateAmount = (empId, amt) => {
    const a = Math.max(0, Number(amt) || 0);
    setFineInputs((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        amount: a,
      },
    }));
  };

  const handleUpdateReason = (empId, reason) => {
    setFineInputs((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        reason,
      },
    }));
  };

  // Selected counts and total amount
  const selectedCandidates = filteredCandidates.filter((c) => fineInputs[c.employee_id]?.selected);
  const totalFineAmount = selectedCandidates.reduce((sum, c) => {
    return sum + (Number(fineInputs[c.employee_id]?.amount) || 0);
  }, 0);

  // Submit Fines
  const handleSubmitFines = async () => {
    if (selectedCandidates.length === 0) {
      if (onError) onError(null, 'Please select at least one staff member to apply a fine.');
      return;
    }

    try {
      setIsApplying(true);
      const finesPayload = selectedCandidates.map((c) => ({
        employee_id: c.employee_id,
        amount: fineInputs[c.employee_id]?.amount || c.total_late_days * perDayFineRate,
        late_days: fineInputs[c.employee_id]?.days || c.total_late_days,
        reason: fineInputs[c.employee_id]?.reason || `Late attendance fine - ${month}/${year}`,
      }));

      const res = await apiFetch('/attendance/late-fines/apply', {
        method: 'POST',
        body: JSON.stringify({
          month,
          year,
          fines: finesPayload,
        }),
      });

      setShowConfirmModal(false);
      if (onSuccess) {
        onSuccess(
          `Successfully applied late attendance fines to ${res?.applied_count || selectedCandidates.length} staff members (Total ₹${res?.total_amount || totalFineAmount}).`
        );
      }
      await loadCandidates();
    } catch (err) {
      if (onError) onError(err, 'Failed to apply late attendance fines.');
    } finally {
      setIsApplying(false);
    }
  };

  // Cancel an existing fine
  const handleCancelFine = async (fineId) => {
    if (!window.confirm('Are you sure you want to cancel/remove this fine?')) return;
    try {
      setCancellingId(fineId);
      await apiFetch(`/attendance/late-fines/${fineId}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: 'Cancelled from Late Fines management' }),
      });
      if (onSuccess) onSuccess('Fine cancelled successfully.');
      await loadCandidates();
    } catch (err) {
      if (onError) onError(err, 'Failed to cancel fine.');
    } finally {
      setCancellingId(null);
    }
  };

  const monthName = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long' });

  return (
    <div className="space-y-6">
      {/* Policy Notice & Info Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-5 rounded-2xl text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-gray-950 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Manual Policy Control
            </span>
            <h2 className="text-base font-extrabold tracking-wide">Late Attendance Fine Management</h2>
          </div>
          <p className="text-xs text-blue-200 max-w-2xl leading-relaxed">
            Staff who kept biometric late and crossed their monthly grace buffer are listed below. You have total control to select who gets fined, adjust chargeable days, and set custom amounts (per day or flat).
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/15 text-xs text-right space-y-0.5 shrink-0">
          <div className="text-blue-300 text-[10px] font-bold uppercase tracking-wider">Zero Automatic Fines</div>
          <div className="font-bold text-emerald-400 flex items-center justify-end gap-1">
            <CheckIcon className="w-4 h-4 text-emerald-400" />
            <span>Strict Manual Approval</span>
          </div>
        </div>
      </div>

      {/* Top Filter & Period Selection Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Month Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Period Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString('en-IN', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900"
            />
          </div>

          {/* Department Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Department</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Staff Type (Doctor Filter) */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Staff Type</label>
            <select
              value={staffTypeFilter}
              onChange={(e) => setStaffTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white"
            >
              <option value="all">All Staff</option>
              <option value="doctors">Doctors Only (Medical)</option>
              <option value="staff">Non-Doctors / Staff Only</option>
            </select>
          </div>

          {/* Buffer Condition Mode */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Buffer Condition</label>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white"
            >
              <option value="exceeded">Buffer Limit Crossed</option>
              <option value="all_late">All Late Attendees</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Search Staff</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Name or Emp Code…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white placeholder-gray-400"
              />
              <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {/* Quick Filter Status Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status:</span>
            {[
              { value: 'all', label: `All (${candidates.length})` },
              { value: 'pending', label: `Pending Fine (${candidates.filter((c) => !c.has_active_fine).length})` },
              { value: 'fined', label: `Fine Already Applied (${candidates.filter((c) => c.has_active_fine).length})` },
            ].map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                  statusFilter === s.value ? 'bg-[#1e40af] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-gray-500 font-semibold">
            Showing records for <strong>{monthName} {year}</strong>
          </div>
        </div>
      </div>

      {/* Batch Actions & Fine Rate Controls */}
      <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-950">Fine Rate per Late Day:</span>
            <div className="flex items-center bg-white rounded-lg border border-amber-300 px-2 py-1 shadow-2xs">
              <span className="text-xs font-bold text-gray-500 mr-1">₹</span>
              <input
                type="number"
                min="0"
                step="10"
                value={perDayFineRate}
                onChange={(e) => applyRateToAll(e.target.value)}
                className="w-20 text-xs font-bold text-gray-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectAll(true)}
              className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer"
            >
              Select All Filtered
            </button>
            <button
              type="button"
              onClick={() => handleSelectAll(false)}
              className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] text-gray-500 font-semibold">
              Selected: <strong className="text-gray-900">{selectedCandidates.length}</strong> staff
            </div>
            <div className="text-sm font-extrabold text-rose-700">
              Total Fines: ₹{totalFineAmount.toLocaleString('en-IN')}
            </div>
          </div>

          {(!user || hasPermission(user, 'fine.apply_late_fines') || hasPermission(user, 'fine.create')) && (
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={selectedCandidates.length === 0 || isApplying}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <BoltIcon className="w-4 h-4 text-white" />
              <span>Apply Fines to Selected ({selectedCandidates.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Candidates List Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Late Attendance & Buffer Candidates ({filteredCandidates.length})
            </h3>
            <span className="text-[10px] text-gray-400 font-semibold">
              (Buffer remaining &lt;= 0 or used &gt;= limit)
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-gray-400">Loading late attendance records…</div>
        ) : filteredCandidates.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500 space-y-2">
            <div className="font-bold text-gray-700">No employees matched the selected filter criteria.</div>
            <p className="text-gray-400 text-[11px]">
              Either all employees stayed within their grace buffer, or filters excluded them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[950px]">
              <thead>
                <tr className="bg-gray-50/90 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="text-center px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        filteredCandidates.length > 0 &&
                        filteredCandidates.every((c) => fineInputs[c.employee_id]?.selected)
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-3">Staff Member</th>
                  <th className="text-center px-3 py-3">Monthly Buffer</th>
                  <th className="text-center px-3 py-3">Late Attendance</th>
                  <th className="text-center px-3 py-3">Breakdown</th>
                  <th className="text-center px-3 py-3">Chargeable Days</th>
                  <th className="text-center px-3 py-3">Fine Amount (₹)</th>
                  <th className="text-left px-3 py-3">Reason / Deduction Note</th>
                  <th className="text-center px-3 py-3">Fine Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCandidates.map((c) => {
                  const input = fineInputs[c.employee_id] || {
                    selected: false,
                    days: c.total_late_days,
                    amount: c.total_late_days * perDayFineRate,
                    reason: `Late attendance fine - ${month}/${year}`,
                  };

                  const isSelected = !!input.selected;
                  const isExhausted = c.buffer_remaining_minutes <= 0;

                  return (
                    <tr
                      key={c.employee_id}
                      className={`hover:bg-gray-50/70 transition-colors ${
                        isSelected ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(c.employee_id)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Staff Member */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                          <span>{c.full_name}</span>
                          <span className="text-[10px] font-mono font-normal text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            {c.employee_code}
                          </span>
                          {isCandidateDoctor(c) && (
                            <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 flex items-center gap-0.5">
                              🩺 Doctor
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {c.department_name}{c.designation_name ? ` · ${c.designation_name}` : ''} · <span className="capitalize">{c.shift_category?.replace(/_/g, ' ') || 'General'}</span>
                        </div>
                      </td>

                      {/* Monthly Buffer */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isExhausted
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {fmtMinutes(c.buffer_used_minutes)} / {fmtMinutes(c.buffer_allocated_minutes)}
                          </span>
                          <span className="text-[9px] text-gray-400">
                            {isExhausted ? 'Buffer Exhausted' : `${fmtMinutes(c.buffer_remaining_minutes)} left`}
                          </span>
                        </div>
                      </td>

                      {/* Late Attendance */}
                      <td className="px-3 py-3 text-center">
                        <div className="font-extrabold text-rose-600">
                          {c.total_late_days} day{c.total_late_days === 1 ? '' : 's'}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          {fmtMinutes(c.total_late_minutes)} total
                        </div>
                      </td>

                      {/* Breakdown Modal Trigger */}
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setDetailCandidate(c)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                        >
                          View Dates ({c.late_dates.length})
                        </button>
                      </td>

                      {/* Chargeable Days Input */}
                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          min="1"
                          max={c.total_late_days}
                          value={input.days ?? c.total_late_days}
                          onChange={(e) => handleUpdateDays(c.employee_id, e.target.value)}
                          className="w-16 text-center px-2 py-1 border border-gray-200 rounded-lg text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </td>

                      {/* Fine Amount (₹) */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center">
                          <span className="text-gray-400 font-bold mr-1">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={input.amount ?? c.total_late_days * perDayFineRate}
                            onChange={(e) => handleUpdateAmount(c.employee_id, e.target.value)}
                            className="w-20 text-center px-2 py-1 border border-rose-200 rounded-lg text-xs font-extrabold text-rose-700 bg-rose-50/30 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                          />
                        </div>
                      </td>

                      {/* Reason / Deduction Note */}
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={input.reason || ''}
                          onChange={(e) => handleUpdateReason(c.employee_id, e.target.value)}
                          placeholder="Reason note for payroll…"
                          className="w-full px-2.5 py-1 border border-gray-200 rounded-lg text-[11px] font-medium text-gray-800 bg-white"
                        />
                      </td>

                      {/* Existing Fine Status */}
                      <td className="px-3 py-3 text-center">
                        {c.has_active_fine ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                              <CheckIcon className="w-3 h-3" />
                              <span>Fined: ₹{c.active_fine_amount}</span>
                            </span>
                            {c.existing_fines.map((f) => (
                              (!user || hasPermission(user, 'fine.delete') || hasPermission(user, 'fine.waive_fine')) ? (
                                <button
                                  key={f.id}
                                  type="button"
                                  disabled={cancellingId === f.id}
                                  onClick={() => handleCancelFine(f.id)}
                                  className="text-[9px] font-bold text-rose-600 hover:underline cursor-pointer disabled:opacity-50"
                                >
                                  Cancel Fine
                                </button>
                              ) : null
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            Pending Fine
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Date Breakdown Drawer / Modal */}
      {detailCandidate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-gray-900">
                  Late In-Punch Dates — {detailCandidate.full_name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Emp Code: {detailCandidate.employee_code} · {detailCandidate.department_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailCandidate(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl text-xs flex items-center justify-between">
              <div>
                <span className="text-gray-500 font-medium">Monthly Buffer Used:</span>{' '}
                <strong className="text-rose-600">
                  {fmtMinutes(detailCandidate.buffer_used_minutes)} / {fmtMinutes(detailCandidate.buffer_allocated_minutes)}
                </strong>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Late Days:</span>{' '}
                <strong className="text-gray-900">{detailCandidate.total_late_days}</strong>
              </div>
            </div>

            <div className="overflow-y-auto divide-y divide-gray-100 flex-1 pr-1 space-y-1">
              {detailCandidate.late_dates.map((ld, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-gray-900">
                      {new Date(ld.attendance_date).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      First In: <strong className="text-gray-800">{fmtTime12(ld.first_in_time)}</strong>
                      {ld.last_out_time && (
                        <span> · Out: {fmtTime12(ld.last_out_time)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 font-bold px-2 py-0.5 rounded-full text-[11px]">
                      {fmtMinutes(ld.late_minutes)} Late
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailCandidate(null)}
                className="bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Execution Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <BoltIcon className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-gray-900">Confirm Late Attendance Fines</h3>
                <p className="text-xs text-gray-500">Review selected deductions before creating fine records</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Target Period:</span>
                <strong className="text-gray-900">{monthName} {year}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Staff Members Selected:</span>
                <strong className="text-blue-700">{selectedCandidates.length} employee(s)</strong>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-extrabold">
                <span className="text-gray-800">Total Deductions:</span>
                <span className="text-rose-600">₹{totalFineAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 italic">
              These fines will be recorded as active payroll deduction items for {monthName} {year}. They will appear on each employee's payslip and salary calculation.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isApplying}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitFines}
                disabled={isApplying}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isApplying ? 'Applying Fines…' : 'Confirm & Apply Fines'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
