import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiFetch } from '../../../util/api';
import { hasPermission } from '../../../util/permissions';
import PageHeader from '../../../components/PageHeader';
import ConfigureShiftTimingModal from './ConfigureShiftTimingModal';

/* ─── Professional SVG Icons ─── */
const SunIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
  </svg>
);

const MoonIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
  </svg>
);

const ClockIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const LockClosedIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const ArrowsRightLeftIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-9L21 7.5m0 0L16.5 3M21 7.5H7.5" />
  </svg>
);

const ChevronLeftIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRightIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const SparklesIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

const BoltIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);

const CheckIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const PencilSquareIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

const BuildingOffice2Icon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5h.75m-.75 3h.75m-.75 3h.75" />
  </svg>
);

const UserGroupIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
  </svg>
);

const InformationCircleIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  </svg>
);

const GearIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const XMarkIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SearchIcon = ({ className = 'w-4 h-4', ...props }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const DAY_LABELS = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];

/** Timezone-safe local date string (YYYY-MM-DD) for India (IST). */
const getTodayISO = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

/** Wednesday-based start of the week containing an ISO date. */
const startOfWeek = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay();
  const daysSinceWed = (dow - 3 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceWed);
  return d.toISOString().slice(0, 10);
};

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const monthLabel = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

export default function WeeklyRoster({ departments = [], onBack, user }) {
  const canBulkSave = hasPermission(user, 'hr_roster.bulk_save') || hasPermission(user, 'hr_roster.save_day');
  const canEditShift = hasPermission(user, 'hr_shift.edit');
  const today = useMemo(() => getTodayISO(), []);
  const tableContainerRef = useRef(null);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [grid, setGrid] = useState(null);
  // Key: `${employeeId}|${date}` -> { is_week_off: bool, start_time: 'HH:MM', end_time: 'HH:MM', is_night_shift: bool }
  const [draft, setDraft] = useState({});
  const [swapPick, setSwapPick] = useState(null); // { employeeId, date, employeeName }
  const [editingCellKey, setEditingCellKey] = useState(null);
  const [showTimingModal, setShowTimingModal] = useState(false);

  // Duty Transfer / Replacement modal state
  const [transferModal, setTransferModal] = useState(null); // { emp, date, cell }
  const [replacements, setReplacements] = useState([]);
  const [loadingReplacements, setLoadingReplacements] = useState(false);
  const [selectedReplacementId, setSelectedReplacementId] = useState('');
  const [transferReason, setTransferReason] = useState('Sudden absence / Leave coverage');
  const [isTransferring, setIsTransferring] = useState(false);

  // Batch Apply Modal / Drawer state
  const [batchEmp, setBatchEmp] = useState(null);
  const [batchForm, setBatchForm] = useState({
    start_time: '09:00',
    end_time: '17:00',
    is_night_shift: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const rolesForDept = (departments.find((d) => String(d.id) === String(deptFilter))?.roles) || [];

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const params = new URLSearchParams({ weekStart });
      if (deptFilter) params.set('departmentId', deptFilter);
      if (roleFilter) params.set('staffRoleId', roleFilter);

      const data = await apiFetch(`/hr/roster/week?${params.toString()}`);

      // Seed the draft from stored roster entries
      const seeded = {};
      for (const e of data.entries) {
        const isNight =
          e.is_night_shift !== undefined && e.is_night_shift !== null
            ? Boolean(e.is_night_shift)
            : e.custom_start_time
            ? String(e.custom_start_time).slice(0, 2) >= '18'
            : false;

        seeded[`${e.employee_id}|${e.roster_date}`] = {
          is_week_off: Boolean(e.is_week_off),
          start_time: e.custom_start_time ? String(e.custom_start_time).slice(0, 5) : '',
          end_time: e.custom_end_time ? String(e.custom_end_time).slice(0, 5) : '',
          is_night_shift: isNight,
        };
      }
      setGrid(data);
      setDraft(seeded);
      setSwapPick(null);
      setEditingCellKey(null);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load the weekly roster.');
      setGrid(null);
    } finally {
      setIsLoading(false);
    }
  }, [weekStart, deptFilter, roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const getCell = (employeeId, date) =>
    draft[`${employeeId}|${date}`] || {
      is_week_off: false,
      start_time: '',
      end_time: '',
      is_night_shift: false,
    };

  const updateCell = (employeeId, date, updates) => {
    setDraft((prev) => {
      const current = prev[`${employeeId}|${date}`] || {
        is_week_off: false,
        start_time: '',
        end_time: '',
        is_night_shift: false,
      };
      return {
        ...prev,
        [`${employeeId}|${date}`]: { ...current, ...updates },
      };
    });
  };

  /** Smooth horizontal scroll shortcuts */
  const scrollTable = (direction) => {
    if (!tableContainerRef.current) return;
    const scrollAmount = 450;
    tableContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const scrollToDay = (dayIndex) => {
    if (!tableContainerRef.current) return;
    if (dayIndex === 0) {
      tableContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (dayIndex === 'end') {
      tableContainerRef.current.scrollTo({ left: tableContainerRef.current.scrollWidth, behavior: 'smooth' });
    } else {
      const targetLeft = dayIndex * 170;
      tableContainerRef.current.scrollTo({ left: targetLeft, behavior: 'smooth' });
    }
  };

  /**
   * Apply custom duty hours across all days for an employee
   */
  const handleApplyBatch = (e) => {
    e.preventDefault();
    if (!batchEmp || !grid) return;

    if (!batchForm.start_time || !batchForm.end_time) {
      setErrorMsg('Please specify both start and end times.');
      return;
    }

    let count = 0;
    setDraft((prev) => {
      const next = { ...prev };
      for (const d of grid.days) {
        next[`${batchEmp.employee_id}|${d}`] = {
          is_week_off: false,
          start_time: batchForm.start_time,
          end_time: batchForm.end_time,
          is_night_shift: Boolean(batchForm.is_night_shift),
        };
        count++;
      }
      return next;
    });

    const shiftName = batchForm.is_night_shift ? 'Night Shift' : 'Day Shift';
    flash(`Applied ${shiftName} (${batchForm.start_time} – ${batchForm.end_time}) across the week for ${batchEmp.full_name}.`);
    setBatchEmp(null);
  };

  /**
   * Mark days as Week Off
   */
  const fillRowOff = (emp) => {
    if (!grid) return;
    let count = 0;
    setDraft((prev) => {
      const next = { ...prev };
      for (const d of grid.days) {
        next[`${emp.employee_id}|${d}`] = {
          is_week_off: true,
          start_time: '',
          end_time: '',
          is_night_shift: false,
        };
        count++;
      }
      return next;
    });
    if (count > 0) {
      flash(`Marked days as Week Off for ${emp.full_name}.`);
    } else {
      setErrorMsg('No days in this week to update.');
    }
  };

  /**
   * Clear employee row
   */
  const clearRow = (emp) => {
    if (!grid) return;
    let count = 0;
    setDraft((prev) => {
      const next = { ...prev };
      for (const d of grid.days) {
        next[`${emp.employee_id}|${d}`] = {
          is_week_off: false,
          start_time: '',
          end_time: '',
          is_night_shift: false,
        };
        count++;
      }
      return next;
    });
    if (count > 0) {
      flash(`Cleared duties for this week for ${emp.full_name}.`);
    } else {
      setErrorMsg('No current or upcoming days in this week to clear.');
    }
  };

  /**
   * Shift breakdown summary per employee (continuous night or day shifts fully supported)
   */
  const employeeShiftStats = useMemo(() => {
    if (!grid) return {};
    const stats = {};
    for (const emp of grid.employees) {
      let dayCount = 0;
      let nightCount = 0;
      let offCount = 0;
      let unassignedCount = 0;

      for (const d of grid.days) {
        const c = getCell(emp.employee_id, d);
        if (c.is_week_off) {
          offCount++;
        } else if (c.start_time && c.end_time) {
          if (c.is_night_shift) nightCount++;
          else dayCount++;
        } else {
          unassignedCount++;
        }
      }

      stats[emp.employee_id] = {
        dayCount,
        nightCount,
        offCount,
        unassignedCount,
        totalWorked: dayCount + nightCount,
      };
    }
    return stats;
  }, [grid, draft]);

  /**
   * Day coverage summary: count Day staff and Night staff rostered on each day
   */
  const dayCoverageStats = useMemo(() => {
    if (!grid) return {};
    const coverage = {};
    for (const d of grid.days) {
      let dayStaff = 0;
      let nightStaff = 0;
      let offStaff = 0;

      for (const emp of grid.employees) {
        const c = getCell(emp.employee_id, d);
        if (c.is_week_off) {
          offStaff++;
        } else if (c.start_time && c.end_time) {
          if (c.is_night_shift) nightStaff++;
          else dayStaff++;
        }
      }

      coverage[d] = { dayStaff, nightStaff, offStaff };
    }
    return coverage;
  }, [grid, draft]);

  /**
   * Filtered employee list based on search term
   */
  const displayedEmployees = useMemo(() => {
    if (!grid?.employees) return [];
    if (!searchQuery.trim()) return grid.employees;
    const q = searchQuery.toLowerCase().trim();
    return grid.employees.filter((emp) => {
      const name = String(emp.full_name || '').toLowerCase();
      const code = String(emp.employee_code || '').toLowerCase();
      const role = String(emp.role_name || '').toLowerCase();
      const phone = String(emp.phone || emp.mobile || '').toLowerCase();
      return name.includes(q) || code.includes(q) || role.includes(q) || phone.includes(q);
    });
  }, [grid?.employees, searchQuery]);

  /**
   * Save duty roster — sends all configured and modified days in the week
   */
  const handleSave = async () => {
    if (!grid) return;
    try {
      setIsSaving(true);
      setErrorMsg('');

      const rows = [];
      for (const emp of grid.employees) {
        for (const d of grid.days) {
          const c = getCell(emp.employee_id, d);
          if (c.is_week_off) {
            rows.push({
              employee_id: emp.employee_id,
              roster_date: d,
              is_week_off: true,
              custom_start_time: null,
              custom_end_time: null,
              is_night_shift: false,
            });
          } else if (c.start_time && c.end_time) {
            rows.push({
              employee_id: emp.employee_id,
              roster_date: d,
              is_week_off: false,
              custom_start_time: c.start_time.length === 5 ? `${c.start_time}:00` : c.start_time,
              custom_end_time: c.end_time.length === 5 ? `${c.end_time}:00` : c.end_time,
              is_night_shift: Boolean(c.is_night_shift),
            });
          }
        }
      }

      if (!rows.length) {
        setErrorMsg('Nothing to save for this week.');
        return;
      }

      const result = await apiFetch('/hr/roster/bulk', {
        method: 'POST',
        body: JSON.stringify({ weekStart: grid.weekStart, rows }),
      });

      if (result?.isPendingApproval) {
        flash('Roster modifications submitted for approval (Pending Review).');
      } else {
        flash(`Successfully saved ${result.saved} duty assignments.`);
      }
      await load();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save duty roster.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle shift swap between two staff members on the same date
   */
  const handleSwapClick = (employeeId, date, employeeName) => {
    if (!swapPick) {
      setSwapPick({ employeeId, date, employeeName });
      return;
    }

    if (swapPick.employeeId === employeeId && swapPick.date === date) {
      setSwapPick(null);
      return;
    }

    if (swapPick.date !== date) {
      setErrorMsg('Swaps must be between two staff members on the exact same date.');
      setSwapPick(null);
      return;
    }

    const keyA = `${swapPick.employeeId}|${date}`;
    const keyB = `${employeeId}|${date}`;

    setDraft((prev) => ({
      ...prev,
      [keyA]: prev[keyB] || { is_week_off: false, start_time: '', end_time: '', is_night_shift: false },
      [keyB]: prev[keyA] || { is_week_off: false, start_time: '', end_time: '', is_night_shift: false },
    }));

    flash(`Swapped duty between ${swapPick.employeeName} and ${employeeName} for ${monthLabel(date)}. Click "Save Duty Roster" to commit.`);
    setSwapPick(null);
  };

  /** Open Duty Transfer modal to reassign duty to replacement staff */
  const openTransferModal = async (emp, date, cell) => {
    setTransferModal({ emp, date, cell });
    setSelectedReplacementId('');
    setTransferReason('Sudden absence / Emergency duty cover');
    setReplacements([]);
    try {
      setLoadingReplacements(true);
      const params = new URLSearchParams({
        dutyDate: date,
        departmentId: emp.department_id ? String(emp.department_id) : '',
        excludeEmployeeId: String(emp.employee_id),
      });
      const res = await apiFetch(`/hr/roster/transfer-duty/eligible-replacements?${params.toString()}`);
      const list = Array.isArray(res) ? res : res?.data || [];
      setReplacements(list);
      // Auto select first eligible colleague if available
      if (list.length > 0) {
        setSelectedReplacementId(String(list[0].employee_id));
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load replacement staff');
    } finally {
      setLoadingReplacements(false);
    }
  };

  /** Commit the duty transfer */
  const handleTransferDutySubmit = async (e) => {
    e.preventDefault();
    if (!transferModal || !selectedReplacementId) {
      setErrorMsg('Please select a replacement staff member.');
      return;
    }

    try {
      setIsTransferring(true);
      setErrorMsg('');
      const repEmp = replacements.find((r) => String(r.employee_id) === String(selectedReplacementId));

      await apiFetch('/hr/roster/transfer-duty', {
        method: 'POST',
        body: JSON.stringify({
          fromEmployeeId: transferModal.emp.employee_id,
          toEmployeeId: Number(selectedReplacementId),
          dutyDate: transferModal.date,
          reason: transferReason,
        }),
      });

      flash(`Duty transferred from ${transferModal.emp.full_name} to ${repEmp?.full_name || 'replacement staff'} for ${monthLabel(transferModal.date)}.`);
      setTransferModal(null);
      await load();
    } catch (err) {
      setErrorMsg(err.message || 'Duty transfer failed.');
    } finally {
      setIsTransferring(false);
    }
  };

  const isCurrentWeek = grid && grid.days[0] <= today && grid.days[6] >= today;
  const [isProcessingPunches, setIsProcessingPunches] = useState(false);

  const handleProcessPunches = async () => {
    if (!grid?.weekStart) return;
    try {
      setIsProcessingPunches(true);
      setErrorMsg('');
      const res = await apiFetch('/attendance/process', {
        method: 'POST',
        body: JSON.stringify({
          fromDate: grid.weekStart,
          toDate: grid.weekEnd,
        }),
      });
      flash(`Punches processed successfully for ${grid.weekStart} to ${grid.weekEnd}. Attendance status updated.`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to process punches for this week.');
    } finally {
      setIsProcessingPunches(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Toast Alerts */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold px-4 py-3 rounded-xl shadow-xs flex items-center gap-2 animate-fadeIn">
          <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold px-4 py-3 rounded-xl shadow-xs flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <InformationCircleIcon className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="text-rose-500 hover:text-rose-800 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Professional Page Header */}
      <PageHeader
        category="Staff & Salary"
        title="Weekly Duty Roster"
        subtitle={
          grid ? (
            <span className="flex items-center gap-2 text-xs text-gray-500 font-medium">
              <span>Cycle:</span>
              <strong className="text-gray-800 font-bold">Wednesday to Tuesday</strong>
              <span>({monthLabel(grid.weekStart)} – {monthLabel(grid.weekEnd)})</span>
              {isCurrentWeek ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span> Active Current Week
                </span>
              ) : grid.days[6] < today ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                  <CalendarIcon className="w-3 h-3 text-slate-500" /> Past Week
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                  <CalendarIcon className="w-3 h-3 text-blue-600" /> Upcoming Week
                </span>
              )}
            </span>
          ) : null
        }
        onBack={onBack}
        actions={
          <div className="flex items-center gap-2.5">
            {canEditShift && (
              <button
                type="button"
                onClick={() => setShowTimingModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Configure hospital-wide standard shift hours and monthly buffer limits"
              >
                <GearIcon className="w-3.5 h-3.5 text-gray-500" />
                <span>Configure Shift Timings</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleProcessPunches}
              disabled={isProcessingPunches || isSaving || isLoading || !grid?.employees?.length}
              className="flex items-center gap-1.5 bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xs cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Process biometric punches for this roster week to calculate attendance status based on assigned shifts"
            >
              <BoltIcon className="w-4 h-4" />
              <span>{isProcessingPunches ? 'Processing Punches…' : 'Process Punches'}</span>
            </button>
            {canBulkSave && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isLoading || !grid?.employees?.length}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-xs cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckIcon className="w-4 h-4" />
                <span>{isSaving ? 'Saving…' : 'Save Duty Roster'}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Roster Controls & Navigation Card */}
      <div className="bg-white dark:bg-[#111726] p-4 rounded-xl border border-gray-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Week Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg shadow-2xs border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 p-0.5">
              <button
                type="button"
                onClick={() => setWeekStart((w) => addDays(w, -7))}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                title="Previous Week"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5" />
                <span>Prev Week</span>
              </button>
              <div className="w-[1px] bg-gray-200 dark:bg-slate-700 my-1"></div>
              <button
                type="button"
                onClick={() => setWeekStart((w) => addDays(w, 7))}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                title="Next Week"
              >
                <span>Next Week</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1 bg-white dark:bg-slate-900/60">
              <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={weekStart}
                onChange={(e) => e.target.value && setWeekStart(startOfWeek(e.target.value))}
                className="text-xs font-semibold text-gray-900 dark:text-slate-100 bg-transparent focus:outline-none cursor-pointer"
                title="Pick week start date (Wednesday)"
              />
            </div>

            <button
              type="button"
              onClick={() => setWeekStart(startOfWeek(today))}
              className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1"
            >
              <ClockIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Current Week</span>
            </button>
          </div>

          {/* Department and Role Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <BuildingOffice2Icon className="w-3.5 h-3.5 text-gray-400" />
                <span>Dept</span>
              </span>
              <select
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setRoleFilter('');
                }}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <UserGroupIcon className="w-3.5 h-3.5 text-gray-400" />
                <span>Role</span>
              </span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                disabled={!deptFilter}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">All roles</option>
                {rolesForDept.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roleName}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search staff / ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-44"
              />
              <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Legend Strip */}
        <div className="pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
            <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mr-1">
              Shift Types:
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
              <SunIcon className="w-3.5 h-3.5 text-blue-600" /> Day Shift
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold">
              <MoonIcon className="w-3.5 h-3.5 text-indigo-600" /> Night Shift
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              🏖️ Week Off (WO)
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              <CalendarIcon className="w-3 h-3 text-slate-500" /> Past Day (Editable before payroll lock)
            </span>
          </div>

          <div className="text-[11px] text-gray-500 flex items-center gap-1">
            <InformationCircleIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>Set start &amp; end times freely. Lateness is governed by the monthly buffer limit.</span>
          </div>
        </div>

        {/* Shift Swap Notification Banner */}
        {swapPick && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between text-xs text-amber-900 animate-fadeIn">
            <div className="flex items-center gap-2">
              <ArrowsRightLeftIcon className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Shift Swap in Progress:</strong> Pick a second employee on{' '}
                <strong>{monthLabel(swapPick.date)}</strong> to swap duties with{' '}
                <strong>{swapPick.employeeName}</strong>.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSwapPick(null)}
              className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer flex items-center gap-1"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              <span>Cancel Swap</span>
            </button>
          </div>
        )}
      </div>

      {/* Day Quick Navigation & Horizontal Scroll Controls Bar */}
      {grid && grid.employees.length > 0 && (
        <div className="bg-white dark:bg-[#111726] text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-800 p-2.5 px-4 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded-md">
              ⚡ Quick Day Jump
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px] hidden sm:inline">
              Jump instantly to configure any day without scrolling:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollToDay(0)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 shadow-2xs border border-slate-200 dark:border-white/10"
              title="Jump to Start of Week (Wednesday)"
            >
              <span>⏮️ Start (Wed)</span>
            </button>

            {/* Individual Day Buttons */}
            {grid.days.map((d, idx) => {
              const isToday = d === today;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => scrollToDay(idx)}
                  className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer border ${
                    isToday
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                  }`}
                  title={`Jump to ${DAY_LABELS[idx]} (${monthLabel(d).slice(0, 6)})`}
                >
                  <span>{DAY_LABELS[idx]}</span>
                  {isToday && <span className="ml-1 text-[8px] uppercase font-black">★</span>}
                </button>
              );
            })}

            {/* Jump to Last Day Button */}
            <button
              type="button"
              onClick={() => scrollToDay('end')}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] transition-all cursor-pointer flex items-center gap-1 shadow-xs border border-emerald-700 ml-1"
              title="Jump immediately to Tuesday & Summary (Last Day of Week)"
            >
              <span>Last Day (Tue) ⏭️</span>
            </button>

            {/* Scroll Left & Right buttons */}
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200 dark:border-white/20">
              <button
                type="button"
                onClick={() => scrollTable('left')}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white flex items-center justify-center cursor-pointer transition-colors border border-slate-200 dark:border-white/10"
                title="Scroll Left"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollTable('right')}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white flex items-center justify-center cursor-pointer transition-colors border border-slate-200 dark:border-white/10"
                title="Scroll Right"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid Content Container with Contained Scroll and Sticky Headers */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-12 text-center text-xs text-gray-400">
          <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="font-semibold text-gray-600">Loading duty roster…</p>
        </div>
      ) : !grid || grid.employees.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-12 text-center text-xs text-gray-500 space-y-2">
          <p className="font-bold text-gray-800 text-sm">No Day &amp; Night Shift Staff Found</p>
          <p className="text-gray-400 max-w-md mx-auto leading-relaxed">
            There are no employees configured with the Day &amp; Night shift model under this department/role filter.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden flex flex-col">
          {/* Scrollable Table Viewport with fixed max-height & sticky header */}
          <div
            ref={tableContainerRef}
            className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] bg-white relative scroll-smooth focus:outline-none"
          >
            <table className="w-full min-w-[1300px] text-xs border-collapse">
              {/* Table Column Headers (Sticky Top) */}
              <thead className="sticky top-0 z-30 bg-gray-50 border-b border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3.5 font-bold text-gray-800 uppercase tracking-wider text-[11px] sticky top-0 left-0 bg-gray-100 z-40 min-w-[240px] max-w-[240px] border-r border-gray-200 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.08)]">
                    Employee Details
                  </th>

                  {grid.days.map((d, i) => {
                    const isToday = d === today;
                    const isPast = d < today;
                    const coverage = dayCoverageStats[d] || { dayStaff: 0, nightStaff: 0, offStaff: 0 };

                    return (
                      <th
                        key={d}
                        className={`px-2 py-3 text-center min-w-[155px] transition-colors border-l border-gray-200/60 dark:border-slate-800 ${
                          isToday
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-b-2 border-b-emerald-600'
                            : isPast
                            ? 'bg-slate-100/90 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400'
                            : 'bg-gray-50/95 dark:bg-slate-900/40 text-gray-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          {isToday && (
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.2 rounded-full bg-emerald-600 text-white tracking-wider mb-0.5 shadow-xs">
                              TODAY
                            </span>
                          )}
                          {isPast && (
                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-0.5">
                              <CalendarIcon className="w-2.5 h-2.5" /> Past
                            </span>
                          )}
                          <div className={`font-extrabold text-[12px] ${isToday ? 'text-emerald-900 dark:text-emerald-300' : isPast ? 'text-slate-600 dark:text-slate-400' : 'text-gray-800 dark:text-slate-200'}`}>
                            {DAY_LABELS[i]}
                          </div>
                          <div className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold">{monthLabel(d).slice(0, 6)}</div>

                          {/* Day Shift Coverage Counters */}
                          <div className="mt-1 flex items-center gap-1.5 text-[9px] font-bold">
                            <span className="inline-flex items-center gap-0.5 text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded" title="Staff scheduled for Day Shift">
                              <SunIcon className="w-2.5 h-2.5 text-blue-600" /> {coverage.dayStaff}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded" title="Staff scheduled for Night Shift">
                              <MoonIcon className="w-2.5 h-2.5 text-indigo-600" /> {coverage.nightStaff}
                            </span>
                          </div>
                        </div>
                      </th>
                    );
                  })}

                  <th className="px-3 py-3.5 font-bold text-gray-700 uppercase tracking-wider text-[11px] text-center min-w-[125px] border-l border-gray-200/60 bg-gray-50/95 sticky top-0 right-0 z-30">
                    Week Summary
                  </th>
                </tr>
              </thead>

              {/* Table Rows */}
              <tbody className="divide-y divide-gray-100">
                {displayedEmployees.map((emp) => {
                  const stats = employeeShiftStats[emp.employee_id] || {
                    dayCount: 0,
                    nightCount: 0,
                    offCount: 0,
                    unassignedCount: 0,
                    totalWorked: 0,
                  };

                  return (
                    <tr key={emp.employee_id} className="hover:bg-blue-50/20 transition-colors group">
                      {/* Employee Info & Row Quick Actions (Sticky Left Column) */}
                      <td className="px-4 py-3.5 sticky left-0 bg-white group-hover:bg-slate-50/95 z-20 min-w-[240px] max-w-[240px] border-r border-gray-200 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.08)] align-top">
                        <div className="font-bold text-gray-900 text-xs">{emp.full_name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          {emp.employee_code} · <span className="font-sans text-gray-600 font-medium">{emp.role_name || 'Staff'}</span>
                        </div>

                        {/* Batch Apply Actions */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setBatchEmp(emp);
                                setBatchForm({
                                  start_time: '09:00',
                                  end_time: '17:00',
                                  is_night_shift: false,
                                });
                              }}
                              className="inline-flex items-center gap-1 text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md hover:bg-blue-100 cursor-pointer transition-colors shadow-2xs"
                              title="Set custom start/end time and shift type across upcoming days for this employee"
                            >
                              <SparklesIcon className="w-3 h-3 text-blue-600" />
                              <span>Apply to Week</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => fillRowOff(emp)}
                              className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md hover:bg-amber-100 cursor-pointer transition-colors shadow-2xs"
                              title="Mark remaining upcoming days as Week Off"
                            >
                              🏖️ Off
                            </button>
                            <button
                              type="button"
                              onClick={() => clearRow(emp)}
                              className="text-[9px] font-semibold text-gray-400 hover:text-rose-600 underline cursor-pointer transition-colors ml-0.5"
                              title="Clear duty for upcoming days"
                            >
                              Clear
                            </button>
                          </div>
                      </td>

                      {/* Day Cells */}
                      {grid.days.map((d) => {
                        const cell = getCell(emp.employee_id, d);
                        const isPast = d < today;
                        const isToday = d === today;
                        const cellKey = `${emp.employee_id}|${d}`;
                        const isCustomEditing = editingCellKey === cellKey;
                        const isPicked =
                          swapPick &&
                          swapPick.employeeId === emp.employee_id &&
                          swapPick.date === d;

                        return (
                          <td
                            key={d}
                            className={`px-2 py-2.5 align-top border-l border-gray-100 ${
                              isToday ? 'bg-blue-50/20' : isPast ? 'bg-slate-50/40' : ''
                            }`}
                          >
                            {/* Interactive Day Cell: Option to Enter Start/End Time and Toggle Day vs Night Shift */}
                            <div
                              className={`p-2.5 rounded-xl border transition-all shadow-2xs space-y-2 ${
                                isPicked
                                  ? 'bg-amber-100/80 border-amber-400 ring-2 ring-amber-400/40'
                                  : cell.is_week_off
                                  ? 'bg-amber-50/80 border-amber-200 hover:border-amber-300'
                                  : cell.start_time && cell.end_time && !isCustomEditing
                                  ? cell.is_night_shift
                                    ? 'bg-indigo-50/70 border-indigo-200 hover:border-indigo-300'
                                    : 'bg-blue-50/70 border-blue-200 hover:border-blue-300'
                                  : 'bg-white border-dashed border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {cell.is_week_off ? (
                                /* State 1: Week Off */
                                <div className="space-y-1.5 text-center py-1">
                                  <div className="inline-block font-extrabold text-[10px] text-amber-900 bg-amber-200/70 px-2.5 py-0.5 rounded-full shadow-2xs">
                                    WEEK OFF
                                  </div>
                                  <div className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateCell(emp.employee_id, d, {
                                          is_week_off: false,
                                          start_time: '09:00',
                                          end_time: '17:00',
                                          is_night_shift: false,
                                        });
                                        setEditingCellKey(cellKey);
                                      }}
                                      className="text-[9px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                                      title="Assign custom work hours"
                                    >
                                      + Set Duty Hours
                                    </button>
                                  </div>
                                </div>
                              ) : cell.start_time && cell.end_time && !isCustomEditing ? (
                                /* State 2: Assigned Duty (Display Card with 1-click Toggle & Edit) */
                                <div className="space-y-1.5">
                                  <div
                                    className={`px-2 py-1.5 rounded-lg text-center flex flex-col items-center justify-center ${
                                      cell.is_night_shift
                                        ? 'bg-indigo-100/70 text-indigo-950 border border-indigo-200/60'
                                        : 'bg-blue-100/70 text-blue-950 border border-blue-200/60'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide">
                                      {cell.is_night_shift ? (
                                        <MoonIcon className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                                      ) : (
                                        <SunIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      )}
                                      <span>{cell.is_night_shift ? 'Night Shift' : 'Day Shift'}</span>
                                    </div>
                                    <div className="font-mono font-bold text-[11px] text-gray-900 mt-0.5">
                                      {cell.start_time} – {cell.end_time}
                                    </div>
                                  </div>

                                  {/* Action Bar */}
                                  <div className="flex items-center justify-between gap-1 pt-0.5">
                                    {/* Shift Type Switcher */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateCell(emp.employee_id, d, {
                                          is_night_shift: !cell.is_night_shift,
                                        })
                                      }
                                      className="inline-flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 cursor-pointer shadow-2xs"
                                      title={`Switch to ${cell.is_night_shift ? 'Day Shift' : 'Night Shift'}`}
                                    >
                                      {cell.is_night_shift ? (
                                        <>
                                          <SunIcon className="w-2.5 h-2.5 text-amber-600" />
                                          <span>To Day</span>
                                        </>
                                      ) : (
                                        <>
                                          <MoonIcon className="w-2.5 h-2.5 text-indigo-600" />
                                          <span>To Night</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setEditingCellKey(cellKey)}
                                      className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 cursor-pointer shadow-2xs flex items-center gap-0.5"
                                      title="Change duty start/end hours"
                                    >
                                      <PencilSquareIcon className="w-2.5 h-2.5 text-gray-500" />
                                      <span>Edit</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateCell(emp.employee_id, d, {
                                          is_week_off: true,
                                          start_time: '',
                                          end_time: '',
                                        })
                                      }
                                      className="text-[8px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-900 hover:bg-amber-200 rounded cursor-pointer"
                                      title="Mark as Week Off"
                                    >
                                      WO
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* State 3: Enter Start Time, End Time, and Select Day vs Night Shift */
                                <div className="space-y-1.5">
                                  {/* Start & End Time Inputs */}
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="time"
                                        value={cell.start_time || ''}
                                        onChange={(e) =>
                                          updateCell(emp.employee_id, d, {
                                            is_week_off: false,
                                            start_time: e.target.value,
                                          })
                                        }
                                        className="w-full text-[10px] font-bold p-1 border border-gray-300 rounded-md text-center bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="Start"
                                        title="Duty Start Time"
                                      />
                                      <span className="text-[10px] text-gray-400 font-bold">–</span>
                                      <input
                                        type="time"
                                        value={cell.end_time || ''}
                                        onChange={(e) =>
                                          updateCell(emp.employee_id, d, {
                                            is_week_off: false,
                                            end_time: e.target.value,
                                          })
                                        }
                                        className="w-full text-[10px] font-bold p-1 border border-gray-300 rounded-md text-center bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="End"
                                        title="Duty End Time"
                                      />
                                    </div>
                                  </div>

                                  {/* Shift Type Selector Toggle: Day vs Night */}
                                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-gray-100 rounded-lg border border-gray-200">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateCell(emp.employee_id, d, {
                                          is_night_shift: false,
                                        })
                                      }
                                      className={`flex items-center justify-center gap-1 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${
                                        !cell.is_night_shift
                                          ? 'bg-white text-blue-800 shadow-2xs border border-blue-200'
                                          : 'text-gray-500 hover:text-gray-900'
                                      }`}
                                    >
                                      <SunIcon className={`w-3 h-3 ${!cell.is_night_shift ? 'text-amber-500' : 'text-gray-400'}`} />
                                      <span>Day</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateCell(emp.employee_id, d, {
                                          is_night_shift: true,
                                        })
                                      }
                                      className={`flex items-center justify-center gap-1 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${
                                        cell.is_night_shift
                                          ? 'bg-indigo-900 text-white shadow-2xs'
                                          : 'text-gray-500 hover:text-gray-900'
                                      }`}
                                    >
                                      <MoonIcon className={`w-3 h-3 ${cell.is_night_shift ? 'text-indigo-200' : 'text-gray-400'}`} />
                                      <span>Night</span>
                                    </button>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center justify-between text-[9px] text-gray-600 bg-gray-50 px-1.5 py-1 rounded border border-gray-200">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateCell(emp.employee_id, d, {
                                          is_week_off: true,
                                          start_time: '',
                                          end_time: '',
                                        })
                                      }
                                      className="text-[8px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 cursor-pointer"
                                      title="Set as Week Off"
                                    >
                                      🏖️ Set WO
                                    </button>
                                    {cell.start_time && cell.end_time && (
                                      <button
                                        type="button"
                                        onClick={() => setEditingCellKey(null)}
                                        className="text-[10px] text-blue-700 font-bold hover:underline cursor-pointer px-1.5 py-0.5 bg-blue-50 rounded"
                                      >
                                        ✓ Done
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Shift Swap Action Button */}
                              <div className="mt-1.5 flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSwapClick(emp.employee_id, d, emp.full_name)}
                                  disabled={isSaving}
                                  className={`w-full flex items-center justify-center gap-1 text-[9px] font-bold rounded py-0.5 cursor-pointer transition-all disabled:opacity-40 ${
                                    isPicked
                                      ? 'bg-amber-500 text-white shadow-xs animate-pulse'
                                      : 'text-gray-400 hover:text-gray-800 hover:bg-gray-100 border border-transparent hover:border-gray-200'
                                  }`}
                                  title="Swap duty hours with another person on the same date"
                                >
                                  <ArrowsRightLeftIcon className="w-3 h-3" />
                                  <span>{isPicked ? 'PICKED FOR SWAP' : 'Swap'}</span>
                                </button>

                                {!cell.is_week_off && (
                                  <button
                                    type="button"
                                    onClick={() => openTransferModal(emp, d, cell)}
                                    disabled={isSaving}
                                    className="w-full flex items-center justify-center gap-1 text-[9px] font-bold rounded py-0.5 cursor-pointer transition-all text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200/60"
                                    title="Transfer duty or assign replacement staff if this employee takes leave or is absent"
                                  >
                                    <UserGroupIcon className="w-3 h-3 text-indigo-500" />
                                    <span>Cover Duty</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}

                      {/* Employee Summary Stats Column */}
                      <td className="px-3 py-3.5 text-center border-l border-gray-100 align-top">
                        <div className="space-y-1.5">
                          {/* Continuous shift breakdown */}
                          <div className="font-bold text-gray-900 text-xs">
                            {stats.totalWorked} Shifts
                          </div>
                          <div className="text-[10px] font-semibold text-gray-500 flex flex-col gap-1 items-center">
                            {stats.dayCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 border border-blue-200/60 px-1.5 py-0.5 rounded-md font-bold">
                                <SunIcon className="w-3 h-3 text-blue-600" />
                                <span>{stats.dayCount} Day</span>
                              </span>
                            )}
                            {stats.nightCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded-md font-bold">
                                <MoonIcon className="w-3 h-3 text-indigo-600" />
                                <span>{stats.nightCount} Night</span>
                              </span>
                            )}
                            {stats.offCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md font-bold">
                                🏖️ {stats.offCount} Off
                              </span>
                            )}
                          </div>

                          <div className="pt-1.5 border-t border-gray-100">
                            <div
                              className={`font-bold text-[10px] ${
                                emp.week_offs_entitled > 0 &&
                                emp.week_offs_taken > emp.week_offs_entitled
                                  ? 'text-rose-600'
                                  : 'text-gray-700'
                              }`}
                            >
                              WO: {emp.week_offs_taken} / {emp.week_offs_entitled || '—'}
                            </div>
                            <div className="text-[9px] text-gray-400">entitled/mo</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Guide Strip */}
          <div className="px-4 py-3 border-t border-gray-100 text-[11px] text-gray-500 flex flex-wrap items-center justify-between gap-4 bg-gray-50/50">
            <div className="flex flex-wrap items-center gap-4">
              <span>• <strong>Previous Days:</strong> Locked automatically to protect attendance integrity.</span>
              <span>• <strong>Custom Shifts:</strong> Enter custom start &amp; end times freely and choose Day or Night shift.</span>
              <span>• <strong>Continuous Shifts:</strong> Continuous night or day shifts are fully supported across all 7 days.</span>
            </div>
            <div className="font-semibold text-gray-600">
              Active staff: {grid.employees.length}
            </div>
          </div>
        </div>
      )}

      {/* Batch Schedule Modal for an Employee */}
      {batchEmp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Apply Duty Across Upcoming Days</h3>
                  <p className="text-[11px] text-gray-500">{batchEmp.full_name} ({batchEmp.employee_code})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchEmp(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyBatch} className="p-5 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                Set custom start and end time and select Day or Night shift. This will be applied to all current and upcoming days in this week. Past days will remain locked.
              </p>

              {/* Time Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={batchForm.start_time}
                    onChange={(e) => setBatchForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={batchForm.end_time}
                    onChange={(e) => setBatchForm((f) => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Day vs Night Selector */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1.5">
                  Shift Category
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setBatchForm((f) => ({ ...f, is_night_shift: false }))}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      !batchForm.is_night_shift
                        ? 'bg-white text-blue-900 shadow-xs border border-blue-200'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <SunIcon className={`w-4 h-4 ${!batchForm.is_night_shift ? 'text-amber-500' : 'text-gray-400'}`} />
                    <span>Day Shift</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchForm((f) => ({ ...f, is_night_shift: true }))}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      batchForm.is_night_shift
                        ? 'bg-indigo-900 text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <MoonIcon className={`w-4 h-4 ${batchForm.is_night_shift ? 'text-indigo-200' : 'text-gray-400'}`} />
                    <span>Night Shift</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setBatchEmp(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#1e40af] hover:bg-[#1c399b] rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Apply to Upcoming Days
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duty Transfer / Shift Replacement Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <UserGroupIcon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Transfer / Cover Duty</h3>
                  <p className="text-[11px] text-gray-500">Reassign shift to another staff member when an employee takes leave or is absent.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransferModal(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferDutySubmit} className="space-y-4">
              {/* Shift & Employee Context */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Scheduled Employee:</span>
                  <span className="font-extrabold text-gray-900">
                    {transferModal.emp.full_name} (#{transferModal.emp.employee_code})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Duty Date:</span>
                  <span className="font-bold text-blue-800">{monthLabel(transferModal.date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Duty Timing:</span>
                  <span className="font-mono font-bold text-gray-800">
                    {transferModal.cell.start_time || '08:30'} – {transferModal.cell.end_time || '18:30'}
                    {transferModal.cell.is_night_shift ? ' (Night Shift)' : ' (Day Shift)'}
                  </span>
                </div>
              </div>

              {/* Select Replacement Staff */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-700 uppercase">
                  Select Replacement Staff Member *
                </label>
                {loadingReplacements ? (
                  <div className="p-3 text-center text-xs text-gray-400 border border-gray-200 rounded-xl bg-gray-50">
                    Loading available colleagues…
                  </div>
                ) : replacements.length === 0 ? (
                  <div className="p-3 text-center text-xs text-amber-700 border border-amber-200 rounded-xl bg-amber-50">
                    No colleagues available from this department on this date.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedReplacementId}
                    onChange={(e) => setSelectedReplacementId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {replacements.map((r) => {
                      const statusTag = r.is_on_leave ? '⚠️ On Approved Leave' : r.is_week_off ? '🏖️ On Week-Off (Eligible for Comp-Off / Extra Pay)' : 'Available (No Duty)';
                      return (
                        <option key={r.employee_id} value={r.employee_id}>
                          {r.full_name} (#{r.employee_code}) — {statusTag}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-700 uppercase">
                  Reason for Transfer / Coverage *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sudden medical emergency / Leave cover / Unannounced absent"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Sudden Medical Leave', 'Unannounced Absence', 'Emergency Ward Coverage', 'Leave Cover'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTransferReason(preset)}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-[10px] text-gray-600 font-semibold cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Explanatory Notice */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-800 leading-relaxed">
                <strong>What happens automatically:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>{transferModal.emp.full_name} is relieved of duty for this day (marked leave/absent).</li>
                  <li>The replacement staff member is assigned this shift timing on the duty roster.</li>
                  <li>Their biometric punches will validate against this shift window.</li>
                </ul>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setTransferModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTransferring || !selectedReplacementId}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isTransferring ? 'Transferring…' : 'Confirm & Transfer Duty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configure Shift Timings Modal */}
      <ConfigureShiftTimingModal
        isOpen={showTimingModal}
        onClose={() => setShowTimingModal(false)}
        onSuccess={() => {
          flash('Hospital shift timings updated successfully!');
        }}
      />
    </div>
  );
}

