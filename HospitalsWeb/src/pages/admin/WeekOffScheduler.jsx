import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../util/api';
import {
  CalendarIcon,
  SearchIcon,
  CheckIcon,
  XIcon,
  SyncIcon,
  UserIcon,
} from '../../components/Icons';

const WEEKDAYS = [
  { day: 0, label: 'Sunday' },
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
];

const SHIFT_BADGES = {
  day: 'bg-amber-50 text-amber-700 border-amber-200',
  night: 'bg-purple-50 text-purple-700 border-purple-200',
  general: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function WeekOffScheduler({ departments = [], user }) {
  const [mode, setMode] = useState('group'); // 'group' | 'individual'
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  // Filter state for group
  const [deptFilter, setDeptFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [employees, setEmployees] = useState([]);
  const [selectedEmpIds, setSelectedEmpIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Group assignment form
  const [assignType, setAssignType] = useState('weekday'); // 'weekday' | 'specific_dates'
  const [chosenWeekday, setChosenWeekday] = useState(0); // 0 = Sunday
  const [specificDates, setSpecificDates] = useState([]);
  const [newDateInput, setNewDateInput] = useState('');

  // Individual mode state
  const [singleEmp, setSingleEmp] = useState(null);
  const [singleOffDates, setSingleOffDates] = useState(new Set());
  const [isSingleLoading, setIsSingleLoading] = useState(false);

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Load non-roster employees
  const loadEmployees = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const params = new URLSearchParams({
        month: String(selectedMonth),
        year: String(selectedYear),
      });
      if (deptFilter) params.set('departmentId', deptFilter);
      if (shiftFilter) params.set('shiftCategory', shiftFilter);

      const res = await apiFetch(`/hr/week-offs/non-roster-employees?${params.toString()}`);
      const list = Array.isArray(res) ? res : res?.data || [];
      setEmployees(list);

      // Auto-select first in individual mode if none selected
      setSingleEmp((prev) => {
        if (!prev && list.length > 0) return list[0];
        if (prev) {
          const updated = list.find((e) => e.employee_id === prev.employee_id);
          return updated || list[0] || null;
        }
        return null;
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load employees for week-off scheduling');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, deptFilter, shiftFilter]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Load individual employee calendar when singleEmp or month changes
  const loadIndividualCalendar = useCallback(async (empId) => {
    if (!empId) return;
    try {
      setIsSingleLoading(true);
      const res = await apiFetch(
        `/hr/week-offs/employee/${empId}?month=${selectedMonth}&year=${selectedYear}`
      );
      const data = res?.data || res || {};
      const dates = Array.isArray(data.week_off_dates) ? data.week_off_dates : [];
      setSingleOffDates(new Set(dates));
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load employee week-off dates');
    } finally {
      setIsSingleLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (singleEmp?.employee_id) {
      loadIndividualCalendar(singleEmp.employee_id);
    }
  }, [singleEmp?.employee_id, loadIndividualCalendar]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.full_name?.toLowerCase().includes(q) ||
        e.employee_code?.toLowerCase().includes(q) ||
        e.department_name?.toLowerCase().includes(q) ||
        e.role_name?.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  // Toggle selection of employee in group mode
  const toggleSelectEmp = (id) => {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedEmpIds(new Set(filteredEmployees.map((e) => e.employee_id)));
  };

  const deselectAll = () => {
    setSelectedEmpIds(new Set());
  };

  // Compute all dates in selected month for chosen weekday (e.g. all Sundays)
  const computedWeekdayDates = useMemo(() => {
    const dates = [];
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(selectedYear, selectedMonth - 1, day);
      if (d.getDay() === Number(chosenWeekday)) {
        const iso = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dates.push(iso);
      }
    }
    return dates;
  }, [selectedMonth, selectedYear, chosenWeekday]);

  // Apply group week-offs
  const handleApplyGroupWeekOffs = async (isWeekOff = true) => {
    const empIds = Array.from(selectedEmpIds);
    if (empIds.length === 0) {
      setErrorMsg('Please select at least one employee from the list.');
      return;
    }

    const datesToApply = assignType === 'weekday' ? computedWeekdayDates : specificDates;
    if (datesToApply.length === 0) {
      setErrorMsg('Please specify at least one date or choose a valid weekday pattern.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await apiFetch('/hr/week-offs/group', {
        method: 'POST',
        body: JSON.stringify({
          employeeIds: empIds,
          dates: datesToApply,
          isWeekOff,
        }),
      });

      flash(
        `${isWeekOff ? 'Assigned' : 'Cleared'} week-offs for ${empIds.length} staff across ${datesToApply.length} dates.`
      );
      loadEmployees();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update group week-offs');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle single date for individual employee
  const handleToggleSingleDate = async (dateStr) => {
    if (!singleEmp?.employee_id) return;
    const isCurrentlyOff = singleOffDates.has(dateStr);
    const newStatus = !isCurrentlyOff;

    // Optimistic UI update
    setSingleOffDates((prev) => {
      const next = new Set(prev);
      if (newStatus) next.add(dateStr);
      else next.delete(dateStr);
      return next;
    });

    try {
      await apiFetch(`/hr/week-offs/employee/${singleEmp.employee_id}`, {
        method: 'POST',
        body: JSON.stringify({
          date: dateStr,
          is_week_off: newStatus,
        }),
      });

      flash(`${newStatus ? 'Marked' : 'Unmarked'} ${dateStr} as Week-Off for ${singleEmp.full_name}`);
      loadEmployees();
    } catch (err) {
      // Revert optimistic update
      setSingleOffDates((prev) => {
        const next = new Set(prev);
        if (isCurrentlyOff) next.add(dateStr);
        else next.delete(dateStr);
        return next;
      });
      setErrorMsg(err.message || 'Failed to update week-off for this date');
    }
  };

  // Add specific date chip
  const handleAddSpecificDate = () => {
    if (!newDateInput) return;
    if (!specificDates.includes(newDateInput)) {
      setSpecificDates((prev) => [...prev, newDateInput].sort());
    }
    setNewDateInput('');
  };

  const handleRemoveSpecificDate = (d) => {
    setSpecificDates((prev) => prev.filter((x) => x !== d));
  };

  // Calendar days generation for Individual view
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(selectedYear, selectedMonth - 1, day);
      const iso = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({ day, iso, dayOfWeek, isSunday: d.getDay() === 0 });
    }
    return days;
  }, [selectedMonth, selectedYear]);

  return (
    <div className="space-y-5">
      {/* Top Banner & Control Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <CalendarIcon className="w-5 h-5" />
              </span>
              <h2 className="text-base font-bold text-gray-900">Non-Roster Week-Off Scheduler</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Configure scheduled paid rest days (Week-Offs) for Fixed Day, Fixed Night, and General shift staff. Day &amp; Night staff are scheduled via the Duty Roster.
            </p>
          </div>

          {/* Month/Year selector & Mode Switcher */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('group')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  mode === 'group' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Group Assignment
              </button>
              <button
                type="button"
                onClick={() => setMode('individual')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  mode === 'individual' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Individual Calendar
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2000, i).toLocaleString('en-US', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
              >
                {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={loadEmployees}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-gray-200 transition-colors cursor-pointer"
              title="Refresh staff and week-offs"
            >
              <SyncIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700 font-bold ml-2 cursor-pointer">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─────────────────────────── MODE A: GROUP ASSIGNMENT ─────────────────────────── */}
      {mode === 'group' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Staff Selection Table (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden flex flex-col">
            {/* Filter Bar */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <div className="relative flex-1">
                  <SearchIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search name, code, or role…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={shiftFilter}
                  onChange={(e) => setShiftFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg font-medium text-gray-700 focus:outline-none cursor-pointer"
                >
                  <option value="">All Shifts (Day/Night/General)</option>
                  <option value="day">Fixed Day Shift</option>
                  <option value="night">Fixed Night Shift</option>
                  <option value="general">General Shift</option>
                </select>

                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg font-medium text-gray-700 focus:outline-none cursor-pointer"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Select Actions */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  Select All ({filteredEmployees.length})
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
              <span className="font-semibold text-gray-700">
                {selectedEmpIds.size} of {filteredEmployees.length} Selected
              </span>
            </div>

            {/* Employee Table */}
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredEmployees.length > 0 &&
                          filteredEmployees.every((e) => selectedEmpIds.has(e.employee_id))
                        }
                        onChange={(e) => (e.target.checked ? selectAll() : deselectAll())}
                        className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Shift</th>
                    <th className="py-2.5 px-3">Department &amp; Role</th>
                    <th className="py-2.5 px-3 text-right">Week-Offs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-400">
                        <SyncIcon className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                        Loading staff…
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-400">
                        No employees found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isSelected = selectedEmpIds.has(emp.employee_id);
                      const badgeCls = SHIFT_BADGES[emp.shift_category] || 'bg-gray-100 text-gray-700';
                      return (
                        <tr
                          key={emp.employee_id}
                          onClick={() => toggleSelectEmp(emp.employee_id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50/80'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectEmp(emp.employee_id)}
                              className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-gray-900 block">{emp.full_name}</span>
                            <span className="text-[11px] text-gray-400">#{emp.employee_code}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${badgeCls}`}>
                              {emp.shift_category?.replace(/_/g, ' ') || 'General'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-gray-800 font-medium block">{emp.department_name}</span>
                            <span className="text-[11px] text-gray-400">{emp.role_name || 'Staff'}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-extrabold text-[11px] ${
                                emp.week_offs_taken >= (emp.week_offs_entitled || 4)
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {emp.week_offs_taken} / {emp.week_offs_entitled || 4}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Group Action Card (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                Apply Week-Offs to Selected Staff ({selectedEmpIds.size})
              </h3>

              {/* Assignment Method Picker */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                  Assignment Pattern
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignType('weekday')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      assignType === 'weekday'
                        ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-bold text-xs text-gray-900 block">Recurring Weekday</span>
                    <span className="text-[11px] text-gray-500">Every Sunday, Monday, etc.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignType('specific_dates')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      assignType === 'specific_dates'
                        ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-bold text-xs text-gray-900 block">Specific Dates</span>
                    <span className="text-[11px] text-gray-500">Pick exact calendar dates</span>
                  </button>
                </div>
              </div>

              {/* Method A: Choose Day of Week */}
              {assignType === 'weekday' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    Choose Weekly Off Day
                  </label>
                  <select
                    value={chosenWeekday}
                    onChange={(e) => setChosenWeekday(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {WEEKDAYS.map((w) => (
                      <option key={w.day} value={w.day}>
                        Every {w.label}
                      </option>
                    ))}
                  </select>

                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                    <span className="font-bold text-gray-700 block mb-1">
                      Dates affected in {new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'long' })} {selectedYear}:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {computedWeekdayDates.map((d) => (
                        <span key={d} className="px-2 py-0.5 bg-blue-100/70 text-blue-800 rounded font-semibold text-[11px]">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Method B: Specific Dates */}
              {assignType === 'specific_dates' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    Pick Specific Calendar Dates
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newDateInput}
                      onChange={(e) => setNewDateInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddSpecificDate}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
                    >
                      + Add
                    </button>
                  </div>

                  <div className="min-h-[60px] p-2.5 bg-gray-50 rounded-xl border border-gray-100 flex flex-wrap gap-1.5">
                    {specificDates.length === 0 ? (
                      <span className="text-xs text-gray-400 italic">No specific dates added yet.</span>
                    ) : (
                      specificDates.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800"
                        >
                          {d}
                          <button
                            type="button"
                            onClick={() => handleRemoveSpecificDate(d)}
                            className="text-gray-400 hover:text-rose-600 cursor-pointer font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isSubmitting || selectedEmpIds.size === 0}
                  onClick={() => handleApplyGroupWeekOffs(true)}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors flex items-center justify-center gap-2"
                >
                  <CheckIcon className="w-4 h-4" />
                  Apply Week-Offs to Selected ({selectedEmpIds.size})
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || selectedEmpIds.size === 0}
                  onClick={() => handleApplyGroupWeekOffs(false)}
                  className="w-full py-2 px-4 bg-white hover:bg-rose-50 border border-gray-200 hover:border-rose-200 text-gray-600 hover:text-rose-600 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Remove Week-Offs from Selected ({selectedEmpIds.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────── MODE B: INDIVIDUAL EMPLOYEE CALENDAR ─────────────────────────── */}
      {mode === 'individual' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Employee Selector (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 flex flex-col space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Employee</h3>

            <div className="relative">
              <SearchIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Filter employee…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="overflow-y-auto max-h-[520px] space-y-1.5 pr-1">
              {filteredEmployees.map((emp) => {
                const isSelected = singleEmp?.employee_id === emp.employee_id;
                return (
                  <button
                    key={emp.employee_id}
                    type="button"
                    onClick={() => setSingleEmp(emp)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-400 shadow-xs'
                        : 'bg-white border-gray-200/80 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-gray-900 block">{emp.full_name}</span>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                        {emp.shift_category}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-gray-500">
                      <span>{emp.department_name}</span>
                      <span className="font-bold text-blue-700">
                        {emp.week_offs_taken} / {emp.week_offs_entitled || 4} Off
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Month Calendar Matrix (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 space-y-4">
            {singleEmp ? (
              <>
                {/* Employee Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50/40 rounded-xl border border-blue-100 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-blue-600" />
                      <span className="font-extrabold text-sm text-gray-900">{singleEmp.full_name}</span>
                      <span className="text-xs text-gray-400 font-semibold">#{singleEmp.employee_code}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                        {singleEmp.shift_category} Shift
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {singleEmp.department_name} · {singleEmp.role_name || 'Staff Member'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-gray-500 block uppercase font-bold tracking-wider">
                        Week-Offs Taken
                      </span>
                      <span className="text-lg font-black text-gray-900">
                        {singleOffDates.size}{' '}
                        <span className="text-xs font-semibold text-gray-400">
                          / {singleEmp.week_offs_entitled || 4} Days
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Calendar Instruction */}
                <p className="text-xs text-gray-500">
                  Click any date tile to toggle between <strong>Week Off (Paid Rest)</strong> and <strong>Working Duty</strong>. Changes are saved automatically.
                </p>

                {/* Interactive Calendar Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {calendarDays.map((cell) => {
                    const isOff = singleOffDates.has(cell.iso);
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        onClick={() => handleToggleSingleDate(cell.iso)}
                        className={`p-3 rounded-xl border flex flex-col justify-between min-h-[85px] cursor-pointer transition-all ${
                          isOff
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/20'
                            : 'bg-white dark:bg-[#141d2e] border-slate-200 dark:border-slate-800 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`text-xs font-black ${
                              isOff ? 'text-white' : cell.isSunday ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {cell.day}
                          </span>
                          <span className={`text-[10px] uppercase font-bold ${isOff ? 'text-slate-300' : 'text-gray-400'}`}>
                            {cell.dayOfWeek}
                          </span>
                        </div>

                        <div className="w-full mt-2">
                          {isOff ? (
                            <span className="block text-center text-[10px] font-extrabold uppercase tracking-wider py-1 bg-white/20 rounded-md text-white">
                              Week Off
                            </span>
                          ) : (
                            <span className="block text-center text-[10px] font-semibold text-gray-400 py-1 bg-gray-50 rounded-md">
                              Working
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-gray-400">
                <p className="font-semibold text-gray-600">No employee selected</p>
                <p className="text-xs mt-1">Please select an employee from the left panel to configure their calendar.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
