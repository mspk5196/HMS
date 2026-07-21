import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../util/api';
import AssignShiftForm from './AssignShiftForm';

const WEEK_DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ShiftRoster() {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'assign-shift'
  const [editingShift, setEditingShift] = useState(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Configured Department-Role Shifts State
  const [shiftAssignments, setShiftAssignments] = useState([
    {
      id: 101,
      deptId: 1,
      deptName: 'NURSING',
      roles: ['Head Nurse', 'Staff Nurse'],
      shiftName: 'Morning Shift',
      startTime: '07:00',
      endTime: '15:00',
      workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      capacity: 12,
      breakDuration: '30 mins',
      notes: 'ICU & Ward patient rounds handover at 07:15 AM'
    },
    {
      id: 102,
      deptId: 1,
      deptName: 'NURSING',
      roles: ['Staff Nurse', 'Junior Nurse'],
      shiftName: 'Night Shift',
      startTime: '23:00',
      endTime: '07:00',
      workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      capacity: 8,
      breakDuration: '45 mins',
      notes: 'Emergency night duties & vitals monitoring'
    },
    {
      id: 103,
      deptId: 2,
      deptName: 'LABORATORY',
      roles: ['Chief Technician', 'Lab Analyst'],
      shiftName: 'General Duty',
      startTime: '08:30',
      endTime: '16:30',
      workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      capacity: 6,
      breakDuration: '60 mins',
      notes: 'Pathology & Hematology sample processing'
    },
    {
      id: 104,
      deptId: 3,
      deptName: 'PHARMACY',
      roles: ['Chief Pharmacist', 'Dispensing Pharmacist'],
      shiftName: 'Morning Shift',
      startTime: '08:00',
      endTime: '16:00',
      workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      capacity: 4,
      breakDuration: '30 mins',
      notes: 'In-patient & Out-patient medicine distribution'
    },
    {
      id: 105,
      deptId: 4,
      deptName: 'GENERAL MEDICINE',
      roles: ['Senior Consultant', 'Resident Doctor'],
      shiftName: 'Morning Duty',
      startTime: '09:00',
      endTime: '17:00',
      workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      capacity: 5,
      breakDuration: '45 mins',
      notes: 'OPD consultations & ward rounds'
    }
  ]);

  // Fetch departments from API
  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch('/hr/departments');
      if (data && Array.isArray(data) && data.length > 0) {
        setDepartments(data);
      } else {
        setDepartments([
          { id: 1, name: 'NURSING', roles: [{ roleName: 'Head Nurse' }, { roleName: 'Staff Nurse' }, { roleName: 'Junior Nurse' }] },
          { id: 2, name: 'LABORATORY', roles: [{ roleName: 'Chief Technician' }, { roleName: 'Lab Analyst' }] },
          { id: 3, name: 'PHARMACY', roles: [{ roleName: 'Chief Pharmacist' }, { roleName: 'Dispensing Pharmacist' }] },
          { id: 4, name: 'GENERAL MEDICINE', roles: [{ roleName: 'Senior Consultant' }, { roleName: 'Resident Doctor' }] },
          { id: 5, name: 'ADMINISTRATION', roles: [{ roleName: 'HR Manager' }, { roleName: 'Receptionist' }] }
        ]);
      }
    } catch (err) {
      console.log('Using local state fallback for departments:', err.message);
      setDepartments([
        { id: 1, name: 'NURSING', roles: [{ roleName: 'Head Nurse' }, { roleName: 'Staff Nurse' }, { roleName: 'Junior Nurse' }] },
        { id: 2, name: 'LABORATORY', roles: [{ roleName: 'Chief Technician' }, { roleName: 'Lab Analyst' }] },
        { id: 3, name: 'PHARMACY', roles: [{ roleName: 'Chief Pharmacist' }, { roleName: 'Dispensing Pharmacist' }] },
        { id: 4, name: 'GENERAL MEDICINE', roles: [{ roleName: 'Senior Consultant' }, { roleName: 'Resident Doctor' }] },
        { id: 5, name: 'ADMINISTRATION', roles: [{ roleName: 'HR Manager' }, { roleName: 'Receptionist' }] }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSaveShiftAssignment = (payload) => {
    if (editingShift) {
      setShiftAssignments(prev => prev.map(s => s.id === editingShift.id ? payload : s));
      setSuccessMsg(`Shift schedule updated for ${payload.deptName}.`);
    } else {
      setShiftAssignments(prev => [...prev, payload]);
      setSuccessMsg(`Shift schedule assigned successfully to ${payload.deptName}.`);
    }

    setEditingShift(null);
    setViewMode('list');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleDeleteShift = (id, name, deptName) => {
    if (!window.confirm(`Are you sure you want to remove the shift schedule "${name}" from ${deptName}?`)) return;
    setShiftAssignments(prev => prev.filter(s => s.id !== id));
    setSuccessMsg(`Shift schedule removed from ${deptName}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const format12Hour = (time24) => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    const hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    return `${String(formattedHours).padStart(2, '0')}:${m} ${ampm}`;
  };

  // Summary Metrics
  const totalShiftsCount = shiftAssignments.length;
  const uniqueDeptsCount = new Set(shiftAssignments.map(s => s.deptName)).size;
  const totalStaffCapacity = shiftAssignments.reduce((sum, s) => sum + Number(s.capacity || 0), 0);

  // Group shifts by department
  const filteredAssignments = shiftAssignments.filter(s => {
    const matchesDept = selectedDeptFilter === 'ALL' || String(s.deptId) === String(selectedDeptFilter) || s.deptName === selectedDeptFilter;
    const matchesQuery = !searchQuery.trim() || 
      s.shiftName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.deptName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.roles.some(r => r.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesDept && matchesQuery;
  });

  const shiftsByDept = filteredAssignments.reduce((acc, shift) => {
    const key = shift.deptName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(shift);
    return acc;
  }, {});

  if (viewMode === 'assign-shift') {
    return (
      <AssignShiftForm
        departments={departments}
        initialData={editingShift}
        onBack={() => { setEditingShift(null); setViewMode('list'); }}
        onSubmit={handleSaveShiftAssignment}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-4 py-3 rounded-xl shadow-sm">
          <svg className="w-4 h-4 flex-shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* Header & Main Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            Staff & Salary &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Shift & Roster</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Configure and assign work shifts across hospital departments and roles.</p>
        </div>
        <button
          onClick={() => { setEditingShift(null); setViewMode('assign-shift'); }}
          className="bg-[#1e40af] hover:bg-[#1c399b] active:bg-[#193288] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Assign Shift for Department
        </button>
      </div>

      {/* Top Summary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#1e40af] flex items-center justify-center font-bold flex-shrink-0 border border-blue-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Configured Shifts</div>
            <div className="text-xl font-extrabold text-gray-900">{totalShiftsCount} Shifts</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0 border border-emerald-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Departments Covered</div>
            <div className="text-xl font-extrabold text-gray-900">{uniqueDeptsCount} Departments</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold flex-shrink-0 border border-purple-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <div>
            <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Required Staff Capacity</div>
            <div className="text-xl font-extrabold text-gray-900">{totalStaffCapacity} Staff</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap mr-1">Filter Dept:</span>
          <button
            onClick={() => setSelectedDeptFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              selectedDeptFilter === 'ALL'
                ? 'bg-[#1e40af] text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Departments
          </button>
          {departments.map(d => (
            <button
              key={d.id || d.name}
              onClick={() => setSelectedDeptFilter(d.name)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                selectedDeptFilter === d.name
                  ? 'bg-[#1e40af] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

      {/* Main Department Shift Grid */}
      {Object.keys(shiftsByDept).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-10 text-center max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-gray-900 text-sm">No shifts configured</h3>
            <p className="text-xs text-gray-500">No shift schedules match your current department filter or search query.</p>
          </div>
          <button
            onClick={() => { setEditingShift(null); setViewMode('assign-shift'); }}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Assign New Shift
          </button>
        </div>
      ) : (
        <div className="space-y-7">
          {Object.entries(shiftsByDept).map(([deptName, shiftsList]) => {
            const deptStaffSum = shiftsList.reduce((acc, s) => acc + Number(s.capacity || 0), 0);

            return (
              <div key={deptName} className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                {/* Department Card Header */}
                <div className="bg-gradient-to-r from-blue-50/60 via-gray-50/50 to-white px-6 py-4 border-b border-gray-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#1e40af] text-white font-extrabold flex items-center justify-center text-sm shadow-xs">
                      {deptName.charAt(0)}
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900 text-base tracking-wide">{deptName}</h2>
                      <p className="text-xs text-gray-500">
                        {shiftsList.length} shift schedule(s) configured
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200/60">
                      Req. Capacity: <strong className="text-emerald-900">{deptStaffSum} Staff</strong>
                    </span>
                    <button
                      onClick={() => {
                        const targetDeptObj = departments.find(d => d.name === deptName);
                        setEditingShift({ deptId: targetDeptObj?.id || deptName });
                        setViewMode('assign-shift');
                      }}
                      className="text-xs font-semibold text-[#1e40af] hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-lg border border-blue-200/60 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add Shift
                    </button>
                  </div>
                </div>

                {/* Shift Cards Grid for Department */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {shiftsList.map(shift => (
                    <div
                      key={shift.id}
                      className="bg-white rounded-xl border border-gray-200/90 hover:border-blue-300 p-5 space-y-4 transition-all shadow-sm hover:shadow-md flex flex-col justify-between"
                    >
                      <div className="space-y-3.5">
                        {/* Header: Shift Badge & Actions */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="bg-[#1e40af] text-white text-[11px] font-bold px-3 py-1 rounded-md uppercase tracking-wider shadow-2xs">
                            {shift.shiftName}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditingShift(shift); setViewMode('assign-shift'); }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Edit Shift"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteShift(shift.id, shift.shiftName, shift.deptName)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Shift"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Working Time Block */}
                        <div className="bg-blue-50/80 px-3.5 py-2.5 rounded-lg border border-blue-100 flex items-center justify-between text-blue-900 font-bold text-xs">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-[#1e40af] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{format12Hour(shift.startTime)} – {format12Hour(shift.endTime)}</span>
                          </div>
                          {shift.breakDuration && (
                            <span className="text-[11px] text-blue-700 font-medium bg-white px-2 py-0.5 rounded border border-blue-200/60">
                              Break: {shift.breakDuration}
                            </span>
                          )}
                        </div>

                        {/* Assigned Roles */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Assigned Roles</span>
                          <div className="flex flex-wrap gap-1.5">
                            {shift.roles.map((r, i) => (
                              <span key={i} className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-1 rounded-md border border-gray-200/80">
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Weekly Schedule Grid */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Weekly Operating Days</span>
                          <div className="flex items-center justify-between gap-1 bg-gray-50/80 p-2 rounded-lg border border-gray-200/60">
                            {WEEK_DAYS_SHORT.map(day => {
                              const isWorkDay = shift.workDays.includes(day);
                              return (
                                <span
                                  key={day}
                                  className={`flex-1 text-center py-1 text-[11px] rounded-md font-bold transition-colors ${
                                    isWorkDay
                                      ? 'bg-[#1e40af] text-white shadow-2xs'
                                      : 'text-gray-300 font-medium'
                                  }`}
                                  title={`${day}: ${isWorkDay ? 'Active Working Day' : 'Off'}`}
                                >
                                  {day.charAt(0)}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div className="space-y-2 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between text-xs text-gray-600 font-medium">
                          <span>Staff Capacity: <strong className="text-gray-900 font-bold">{shift.capacity} Personnel</strong></span>
                          <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">Active</span>
                        </div>

                        {shift.notes && (
                          <div className="text-[11px] text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                            </svg>
                            <span className="truncate" title={shift.notes}>{shift.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
