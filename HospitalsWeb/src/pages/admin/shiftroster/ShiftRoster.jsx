import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import AssignShiftForm from './AssignShiftForm';
import WeeklyRoster from './WeeklyRoster';

const WEEK_DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const format12Hour = (time24) => {
  if (!time24) return '';
  const [h, m] = String(time24).split(':');
  const hours = parseInt(h, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${String(hours % 12 || 12).padStart(2, '0')}:${m} ${ampm}`;
};

export default function ShiftRoster() {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'assign-shift' | 'weekly-roster'
  const [editingShift, setEditingShift] = useState(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [departments, setDepartments] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [staffRoles, setStaffRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const loadAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const [depts, shiftList, roles] = await Promise.all([
        apiFetch('/hr/departments'),
        apiFetch('/hr/shifts'),
        apiFetch('/hr/staff-roles'),
      ]);
      setDepartments(Array.isArray(depts) ? depts : []);
      setShifts(Array.isArray(shiftList) ? shiftList : []);
      setStaffRoles(Array.isArray(roles) ? roles : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load shift data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /**
   * Save the shift into the catalog, then point every selected department-role
   * at it. Two steps, because a shift is global and the role holds the default.
   */
  const handleSaveShiftAssignment = async (payload, dept) => {
    try {
      setIsSaving(true);
      setErrorMsg('');

      let shiftId = payload.id;
      if (shiftId) {
        await apiFetch(`/hr/shifts/${shiftId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload.shift),
        });
      } else {
        const created = await apiFetch('/hr/shifts', {
          method: 'POST',
          body: JSON.stringify(payload.shift),
        });
        shiftId = created.id;
      }

      const targetRoles = staffRoles.filter(
        (r) => String(r.department_id) === String(dept?.id) && payload.roles.includes(r.name)
      );
      if (!targetRoles.length) {
        throw new Error(`No matching roles found in ${dept?.name || 'this department'}.`);
      }

      for (const role of targetRoles) {
        await apiFetch(`/hr/staff-roles/${role.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...payload.roleDefaults, default_shift_id: shiftId }),
        });
      }

      await loadAll();
      setEditingShift(null);
      setViewMode('list');
      flash(`"${payload.shift.name}" saved and applied to ${targetRoles.length} role(s) in ${dept?.name}.`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save the shift.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteShift = async (shift) => {
    if (!window.confirm(`Remove the shift "${shift.name}" from the catalog?`)) return;
    try {
      setIsSaving(true);
      setErrorMsg('');
      await apiFetch(`/hr/shifts/${shift.id}`, { method: 'DELETE' });
      await loadAll();
      flash(`Shift "${shift.name}" removed.`);
    } catch (err) {
      // The server refuses when a roster or attendance row still references it.
      setErrorMsg(err.message || 'Failed to delete the shift.');
    } finally {
      setIsSaving(false);
    }
  };

  /** Turn a catalog shift back into the shape AssignShiftForm edits. */
  const toFormShape = (shift) => {
    const usingRoles = staffRoles.filter((r) => String(r.default_shift_id) === String(shift.id));
    const first = usingRoles[0];
    return {
      id: shift.id,
      deptId: first?.department_id ?? null,
      roles: usingRoles.map((r) => r.name),
      shiftName: shift.name,
      startTime: (shift.start_time || '').slice(0, 5),
      endTime: (shift.end_time || '').slice(0, 5),
      isNightShift: !!shift.is_night_shift,
      gracePeriodMinutes: shift.grace_period_minutes ?? 10,
      earliestPunchIn: (shift.biometric_in_start || '').slice(0, 5),
      latestPunchOut: (shift.biometric_out_end || '').slice(0, 5),
      capacity: first?.capacity ?? 2,
      breakMinutes: first?.break_minutes ?? 30,
      notes: first?.notes || '',
      workDays: WEEK_DAYS_SHORT,
    };
  };

  if (viewMode === 'assign-shift') {
    return (
      <div className="space-y-4">
        {errorMsg && (
          <div className="bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl">
            {errorMsg}
          </div>
        )}
        <AssignShiftForm
          departments={departments}
          initialData={editingShift}
          onBack={() => { setEditingShift(null); setErrorMsg(''); setViewMode('list'); }}
          onSubmit={handleSaveShiftAssignment}
        />
      </div>
    );
  }

  if (viewMode === 'weekly-roster') {
    return (
      <WeeklyRoster
        departments={departments}
        shifts={shifts}
        onBack={() => setViewMode('list')}
      />
    );
  }

  // Group catalog shifts by the departments whose roles use them.
  const rolesByShift = staffRoles.reduce((acc, r) => {
    if (!r.default_shift_id) return acc;
    (acc[r.default_shift_id] ||= []).push(r);
    return acc;
  }, {});

  const visibleShifts = shifts.filter((s) => {
    const users = rolesByShift[s.id] || [];
    const matchesDept =
      selectedDeptFilter === 'ALL' ||
      users.some((r) => r.department_name === selectedDeptFilter);
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      s.name.toLowerCase().includes(q) ||
      users.some((r) => r.name.toLowerCase().includes(q) || (r.department_name || '').toLowerCase().includes(q));
    return matchesDept && matchesQuery;
  });

  const assignedRoleCount = staffRoles.filter((r) => r.default_shift_id).length;
  const unassignedRoles = staffRoles.filter((r) => !r.default_shift_id);

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-4 py-3 rounded-xl shadow-sm">
          <svg className="w-4 h-4 flex-shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl shadow-sm">
          <svg className="w-4 h-4 flex-shrink-0 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {errorMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            Staff &amp; Salary &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Shift &amp; Roster</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Define the shifts that exist, then plan who works which one each week.
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('weekly-roster')}
            disabled={shifts.length === 0}
            className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-2 disabled:opacity-50"
            title={shifts.length === 0 ? 'Define a shift first' : 'Plan the weekly duty roster'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            Weekly Duty Roster
          </button>
          <button
            onClick={() => { setEditingShift(null); setViewMode('assign-shift'); }}
            disabled={departments.length === 0}
            className="bg-[#1e40af] hover:bg-[#1c399b] active:bg-[#193288] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Define Shift
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { label: 'Shifts in Catalog', value: `${shifts.length}`,
            tone: 'bg-blue-50 text-blue-600 border-blue-100',
            icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Roles With a Shift', value: `${assignedRoleCount} of ${staffRoles.length}`,
            tone: 'bg-emerald-50 text-emerald-600 border-emerald-100',
            icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Roles Without a Shift', value: `${unassignedRoles.length}`,
            tone: 'bg-amber-50 text-amber-600 border-amber-100',
            icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
        ].map((card) => (
          <div key={card.label} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${card.tone}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
              </svg>
            </div>
            <div>
              <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">{card.label}</div>
              <div className="text-xl font-extrabold text-gray-900">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {unassignedRoles.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-3 text-[11px] text-amber-800">
          <strong>{unassignedRoles.length} role(s)</strong> have no default shift yet, so the roster can't pre-fill for them:{' '}
          {unassignedRoles.slice(0, 6).map((r) => `${r.department_name} · ${r.name}`).join(', ')}
          {unassignedRoles.length > 6 && ` and ${unassignedRoles.length - 6} more`}.
        </div>
      )}

      {/* Filter & search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap mr-1">Filter Dept:</span>
          <button
            onClick={() => setSelectedDeptFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              selectedDeptFilter === 'ALL' ? 'bg-[#1e40af] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Departments
          </button>
          {departments.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDeptFilter(d.name)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                selectedDeptFilter === d.name ? 'bg-[#1e40af] text-white shadow-xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shift or role..."
            className="w-full pl-8 pr-3.5 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 placeholder-gray-300"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      </div>

      {/* Shift catalog */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-10 text-center text-xs text-gray-400">
          Loading…
        </div>
      ) : visibleShifts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-10 text-center max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-gray-900 text-sm">
              {shifts.length === 0 ? 'No shifts defined yet' : 'No shifts match your filter'}
            </h3>
            <p className="text-xs text-gray-500">
              {shifts.length === 0
                ? 'Define the shifts that exist once — the roster then picks from them.'
                : 'Try a different department or search term.'}
            </p>
          </div>
          <button
            onClick={() => { setEditingShift(null); setViewMode('assign-shift'); }}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Define Shift
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleShifts.map((shift) => {
            const users = rolesByShift[shift.id] || [];
            const byDept = users.reduce((acc, r) => {
              (acc[r.department_name] ||= []).push(r.name);
              return acc;
            }, {});
            const capacity = users.reduce((sum, r) => sum + Number(r.capacity || 0), 0);

            return (
              <div
                key={shift.id}
                className="bg-white rounded-xl border border-gray-200/90 hover:border-blue-300 p-5 space-y-4 transition-all shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-md uppercase tracking-wider shadow-2xs ${
                      shift.is_night_shift ? 'bg-indigo-900 text-white' : 'bg-[#1e40af] text-white'
                    }`}>
                      {shift.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingShift(toFormShape(shift)); setViewMode('assign-shift'); }}
                        disabled={isSaving}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
                        title="Edit shift"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteShift(shift)}
                        disabled={isSaving}
                        className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete shift"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="bg-blue-50/80 px-3.5 py-2.5 rounded-lg border border-blue-100 text-blue-900 font-bold text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#1e40af] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{format12Hour(shift.start_time)} – {format12Hour(shift.end_time)}</span>
                    </div>
                    <div className="text-[10px] font-medium text-blue-700/90 pl-6">
                      Punch in {format12Hour(shift.biometric_in_start)}–{format12Hour(shift.start_time)} ·
                      out {format12Hour(shift.end_time)}–{format12Hour(shift.biometric_out_end)}
                    </div>
                    <div className="text-[10px] font-medium text-blue-700/90 pl-6">
                      {shift.grace_period_minutes ?? 0} min grace
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Assigned Roles</span>
                    {users.length === 0 ? (
                      <p className="text-[11px] text-gray-400 italic">Not assigned to any role yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {Object.entries(byDept).map(([deptName, roleNames]) => (
                          <div key={deptName}>
                            <div className="text-[10px] font-bold text-gray-500">{deptName}</div>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              {roleNames.map((n) => (
                                <span key={n} className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-1 rounded-md border border-gray-200/80">
                                  {n}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-600 font-medium">
                  <span>Capacity: <strong className="text-gray-900 font-bold">{capacity || '—'}</strong></span>
                  <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                    shift.is_active ? 'text-emerald-700 bg-emerald-50' : 'text-gray-500 bg-gray-100'
                  }`}>
                    {shift.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
