import React, { useState } from 'react';

const WEEK_DAYS = [
  { key: 'Mon', label: 'Monday' },
  { key: 'Tue', label: 'Tuesday' },
  { key: 'Wed', label: 'Wednesday' },
  { key: 'Thu', label: 'Thursday' },
  { key: 'Fri', label: 'Friday' },
  { key: 'Sat', label: 'Saturday' },
  { key: 'Sun', label: 'Sunday' }
];

const PRESET_SHIFTS = [
  { name: 'Morning Shift', start: '07:00', end: '15:00' },
  { name: 'Evening Shift', start: '15:00', end: '23:00' },
  { name: 'Night Shift', start: '23:00', end: '07:00' },
  { name: 'General Duty', start: '09:00', end: '17:00' },
  { name: 'Emergency Duty', start: '20:00', end: '08:00' }
];

export default function AssignShiftForm({ departments = [], initialData = null, initialDept = null, onBack, onSubmit }) {
  const [selectedDeptId, setSelectedDeptId] = useState(
    initialData?.deptId || initialDept?.id || initialDept?.name || departments[0]?.id || departments[0]?.name || ''
  );

  const currentDept = departments.find(
    d => String(d.id) === String(selectedDeptId) || String(d.name) === String(selectedDeptId)
  ) || departments[0] || initialDept;

  const availableRoles = (currentDept?.roles || []).map(r => typeof r === 'string' ? r : r.roleName);

  const [selectedRoles, setSelectedRoles] = useState(
    initialData?.roles || (availableRoles.length > 0 ? [availableRoles[0]] : ['All Roles'])
  );

  const [shiftName, setShiftName] = useState(initialData?.shiftName || 'Morning Shift');
  const [startTime, setStartTime] = useState(initialData?.startTime || '07:00');
  const [endTime, setEndTime] = useState(initialData?.endTime || '15:00');
  const [workDays, setWorkDays] = useState(
    initialData?.workDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  );
  const [capacity, setCapacity] = useState(initialData?.capacity || 2);
  const [breakDuration, setBreakDuration] = useState(initialData?.breakDuration || '30 mins');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [errors, setErrors] = useState({});

  const handleDeptChange = (newDeptId) => {
    setSelectedDeptId(newDeptId);
    const newDept = departments.find(
      d => String(d.id) === String(newDeptId) || String(d.name) === String(newDeptId)
    ) || departments[0];
    const newRoles = (newDept?.roles || []).map(r => typeof r === 'string' ? r : r.roleName);
    setSelectedRoles(newRoles.length > 0 ? [newRoles[0]] : ['All Roles']);
  };

  const handleToggleRole = (role) => {
    if (role === 'ALL') {
      if (selectedRoles.length === availableRoles.length) {
        setSelectedRoles([]);
      } else {
        setSelectedRoles([...availableRoles]);
      }
      return;
    }

    if (selectedRoles.includes(role)) {
      setSelectedRoles(prev => prev.filter(r => r !== role));
    } else {
      setSelectedRoles(prev => [...prev, role]);
    }
  };

  const handleToggleDay = (dayKey) => {
    if (workDays.includes(dayKey)) {
      setWorkDays(prev => prev.filter(d => d !== dayKey));
    } else {
      setWorkDays(prev => [...prev, dayKey]);
    }
  };

  const handleSelectAllDays = () => {
    if (workDays.length === 7) {
      setWorkDays([]);
    } else {
      setWorkDays(WEEK_DAYS.map(d => d.key));
    }
  };

  const applyPresetShift = (preset) => {
    setShiftName(preset.name);
    setStartTime(preset.start);
    setEndTime(preset.end);
    if (errors.shiftName) setErrors(prev => ({ ...prev, shiftName: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!selectedDeptId) newErrors.deptId = 'Please select a department.';
    if (selectedRoles.length === 0) newErrors.roles = 'Please select at least one role.';
    if (!shiftName.trim()) newErrors.shiftName = 'Shift name is required.';
    if (!startTime) newErrors.startTime = 'Start time is required.';
    if (!endTime) newErrors.endTime = 'End time is required.';
    if (workDays.length === 0) newErrors.workDays = 'Select at least one work day.';
    if (!capacity || Number(capacity) <= 0) newErrors.capacity = 'Enter a valid staff capacity.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      id: initialData?.id || Date.now(),
      deptId: currentDept?.id || selectedDeptId,
      deptName: currentDept?.name || 'Department',
      roles: selectedRoles,
      shiftName,
      startTime,
      endTime,
      workDays,
      capacity: Number(capacity),
      breakDuration,
      notes
    };

    onSubmit(payload, currentDept);
  };

  return (
    <div className="min-h-full space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-200/80 transition-colors cursor-pointer text-gray-500 hover:text-gray-800"
          title="Go back"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            Staff & Salary &nbsp;&gt;&nbsp; Shift & Roster &nbsp;&gt;&nbsp;{' '}
            <span className="text-blue-600 font-semibold">
              {initialData ? 'Edit Shift Schedule' : 'Assign Department Shift Schedule'}
            </span>
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Department & Target Roles */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e40af] font-bold text-xs flex items-center justify-center flex-shrink-0">
              1
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Department & Target Roles</h2>
              <p className="text-xs text-gray-500">Select the department and the target roles that will operate this shift schedule.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Department Selection */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedDeptId}
                onChange={(e) => handleDeptChange(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
              >
                {departments.map(dept => (
                  <option key={dept.id || dept.name} value={dept.id || dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
              {errors.deptId && <p className="text-[11px] text-red-500">{errors.deptId}</p>}
            </div>

            {/* Target Roles */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Target Roles in {currentDept?.name || 'Department'} <span className="text-red-500">*</span>
                </label>
                {availableRoles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleToggleRole('ALL')}
                    className="text-[11px] font-semibold text-[#1e40af] hover:underline cursor-pointer"
                  >
                    {selectedRoles.length === availableRoles.length ? 'Deselect All' : 'Select All Roles'}
                  </button>
                )}
              </div>

              {availableRoles.length === 0 ? (
                <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg border border-gray-100">
                  No specific roles configured for this department yet. This shift will apply to all staff members in {currentDept?.name}.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {availableRoles.map((role, idx) => {
                    const isChecked = selectedRoles.includes(role);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleToggleRole(role)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-all flex items-center gap-2 ${
                          isChecked
                            ? 'bg-blue-50 border-[#1e40af] text-[#1e40af] shadow-xs font-bold'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold ${
                          isChecked ? 'bg-[#1e40af] text-white border-[#1e40af]' : 'border-gray-300 bg-white'
                        }`}>
                          {isChecked && '✓'}
                        </span>
                        {role}
                      </button>
                    );
                  })}
                </div>
              )}
              {errors.roles && <p className="text-[11px] text-red-500">{errors.roles}</p>}
            </div>
          </div>
        </div>

        {/* Section 2: Shift Timings & Working Days */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e40af] font-bold text-xs flex items-center justify-center flex-shrink-0">
              2
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Shift Name & Working Hours</h2>
              <p className="text-xs text-gray-500">Configure shift names, start/end hours, and active work days.</p>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Shift Presets</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_SHIFTS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPresetShift(p)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 hover:bg-blue-50 hover:text-[#1e40af] border border-gray-200 text-gray-700 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {p.name} <span className="text-[11px] text-gray-400">({p.start} - {p.end})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Shift Name */}
            <div className="space-y-1.5 md:col-span-3">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Shift Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={shiftName}
                onChange={(e) => {
                  setShiftName(e.target.value);
                  if (errors.shiftName) setErrors(prev => ({ ...prev, shiftName: '' }));
                }}
                placeholder="e.g. Morning Shift, ICU Night Shift"
                className={`w-full px-3.5 py-2.5 border rounded-lg text-xs font-semibold text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                  errors.shiftName ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
                }`}
              />
              {errors.shiftName && <p className="text-[11px] text-red-500">{errors.shiftName}</p>}
            </div>

            {/* Start Time */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
              />
              {errors.startTime && <p className="text-[11px] text-red-500">{errors.startTime}</p>}
            </div>

            {/* End Time */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
              />
              {errors.endTime && <p className="text-[11px] text-red-500">{errors.endTime}</p>}
            </div>

            {/* Break Duration */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Break Duration
              </label>
              <input
                type="text"
                value={breakDuration}
                onChange={(e) => setBreakDuration(e.target.value)}
                placeholder="e.g. 30 mins"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
              />
            </div>

            {/* Work Days */}
            <div className="space-y-2 md:col-span-3">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Weekly Operating Days <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllDays}
                  className="text-[11px] font-semibold text-[#1e40af] hover:underline cursor-pointer"
                >
                  {workDays.length === 7 ? 'Clear Days' : 'Select All 7 Days'}
                </button>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5 pt-1">
                {WEEK_DAYS.map(day => {
                  const isActive = workDays.includes(day.key);
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => handleToggleDay(day.key)}
                      className={`py-2.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center border ${
                        isActive
                          ? 'bg-[#1e40af] text-white border-[#1e40af] shadow-xs'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {day.key}
                    </button>
                  );
                })}
              </div>
              {errors.workDays && <p className="text-[11px] text-red-500">{errors.workDays}</p>}
            </div>
          </div>
        </div>

        {/* Section 3: Capacity & Notes */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e40af] font-bold text-xs flex items-center justify-center flex-shrink-0">
              3
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Staff Capacity & Handover Notes</h2>
              <p className="text-xs text-gray-500">Specify required staff count and shift guidelines.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Staff Capacity */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Min. Required Staff Count <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 5"
                className={`w-full px-3.5 py-2.5 border rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                  errors.capacity ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
                }`}
              />
              {errors.capacity && <p className="text-[11px] text-red-500">{errors.capacity}</p>}
            </div>

            {/* Handover Notes */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Handover Instructions / Remarks
              </label>
              <textarea
                rows="3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add shift handover instructions, clinical requirements, or rotational guidelines..."
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors placeholder-gray-300"
              ></textarea>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200/80 shadow-sm px-6 py-4">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-[#1e40af] hover:bg-[#1c399b] active:bg-[#193288] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {initialData ? 'Save Changes' : 'Confirm Shift Assignment'}
          </button>
        </div>
      </form>
    </div>
  );
}
