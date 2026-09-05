import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../util/api';
import ConfigureShiftTimingModal from '../shiftroster/ConfigureShiftTimingModal';

export default function AddMemberForm({ departments, initialDepartment, onBack, onSubmit }) {
  const [selectedDeptId, setSelectedDeptId] = useState(
    initialDepartment ? (initialDepartment.id || initialDepartment.name) : (departments[0]?.id || departments[0]?.name || '')
  );

  const currentDept = departments.find(
    d => String(d.id) === String(selectedDeptId) || String(d.name) === String(selectedDeptId)
  ) || departments[0] || initialDepartment;

  const availableRoles = (currentDept?.roles || []).map(r => typeof r === 'string' ? r : r.roleName);

  const getRoleSalary = (roleName, dept = currentDept) => {
    const r = (dept?.roles || []).find(
      x => (typeof x === 'object' ? x.roleName : x) === roleName
    );
    return r && typeof r === 'object' ? r.basicSalary : '';
  };

  const initialRole = availableRoles.length > 0 ? availableRoles[0] : '';
  const initialSalary = getRoleSalary(initialRole) || '';

  const [formData, setFormData] = useState({
    employeeCode: '',
    name: '',
    qualification: '',
    position: initialRole,
    dateOfJoining: new Date().toISOString().split('T')[0],
    experienceDescription: '',
    // Shift category & custom timing
    shiftCategory: 'day',
    customShiftStart: '09:00',
    customShiftEnd: '17:00',
    // Salary fields
    basicSalary: initialSalary,
    perDaySalary: '',
    perNightSalary: '',
    // Bank details
    bankAccountNo: '',
    bankIfsc: '',
    bankName: '',
    // Identity & docs
    aadharNumber: '',
    panNumber: '',
    aadharDoc: null,
    panDoc: null,
  });

  const [shiftConfigs, setShiftConfigs] = useState({
    day: { start: '09:00', end: '17:00' },
    night: { start: '20:00', end: '08:00' },
  });
  const [showTimingModal, setShowTimingModal] = useState(false);

  const fetchShiftConfigs = async () => {
    try {
      const data = await apiFetch('/hr/shifts');
      if (Array.isArray(data)) {
        const d = data.find((s) => !s.is_night_shift);
        const n = data.find((s) => s.is_night_shift);
        const newConfigs = {
          day: {
            start: d?.start_time ? String(d.start_time).slice(0, 5) : '09:00',
            end: d?.end_time ? String(d.end_time).slice(0, 5) : '17:00',
          },
          night: {
            start: n?.start_time ? String(n.start_time).slice(0, 5) : '20:00',
            end: n?.end_time ? String(n.end_time).slice(0, 5) : '08:00',
          },
        };
        setShiftConfigs(newConfigs);
        setFormData((prev) => {
          if (prev.shiftCategory === 'day') {
            return { ...prev, customShiftStart: newConfigs.day.start, customShiftEnd: newConfigs.day.end };
          }
          if (prev.shiftCategory === 'night') {
            return { ...prev, customShiftStart: newConfigs.night.start, customShiftEnd: newConfigs.night.end };
          }
          return prev;
        });
      }
    } catch {
      /* non-critical fallback */
    }
  };

  useEffect(() => {
    fetchShiftConfigs();
  }, []);

  const [errors, setErrors] = useState({});

  const handleDeptChange = (newDeptId) => {
    setSelectedDeptId(newDeptId);
    const newDept = departments.find(
      d => String(d.id) === String(newDeptId) || String(d.name) === String(newDeptId)
    ) || departments[0];
    const newRoles = (newDept?.roles || []).map(r => typeof r === 'string' ? r : r.roleName);
    const firstRole = newRoles.length > 0 ? newRoles[0] : '';
    const rSalary = getRoleSalary(firstRole, newDept);
    setFormData(prev => ({
      ...prev,
      position: firstRole,
      basicSalary: prev.shiftCategory !== 'day_and_night' ? (rSalary || '') : prev.basicSalary,
      perDaySalary: prev.shiftCategory === 'day_and_night' && rSalary ? String(Math.round(Number(rSalary) / 30)) : prev.perDaySalary,
    }));
  };

  const handleRoleChange = (roleName) => {
    const rSalary = getRoleSalary(roleName);
    setFormData(prev => ({
      ...prev,
      position: roleName,
      basicSalary: prev.shiftCategory !== 'day_and_night' && rSalary ? (rSalary || '') : prev.basicSalary,
      perDaySalary: prev.shiftCategory === 'day_and_night' && rSalary ? String(Math.round(Number(rSalary) / 30)) : prev.perDaySalary,
    }));
    if (errors.position) setErrors(prev => ({ ...prev, position: '' }));
  };

  const handleShiftCategoryChange = (cat) => {
    setFormData(prev => {
      let start = prev.customShiftStart;
      let end = prev.customShiftEnd;
      if (cat === 'day') {
        start = shiftConfigs.day.start;
        end = shiftConfigs.day.end;
      } else if (cat === 'night') {
        start = shiftConfigs.night.start;
        end = shiftConfigs.night.end;
      } else if (cat === 'day_and_night') {
        if (!start || start === shiftConfigs.day.start || start === shiftConfigs.night.start) {
          start = '09:00';
          end = '17:00';
        }
      }
      let newBasic = prev.basicSalary;
      let newPerDay = prev.perDaySalary;
      let newPerNight = prev.perNightSalary;

      if (cat === 'day_and_night') {
        if (!newPerDay && newBasic) {
          newPerDay = String(Math.round(Number(newBasic) / 30));
        }
      } else {
        if (!newBasic && newPerDay) {
          newBasic = String(Math.round(Number(newPerDay) * 30));
        }
        newPerNight = '';
      }

      return {
        ...prev,
        shiftCategory: cat,
        customShiftStart: start,
        customShiftEnd: end,
        basicSalary: newBasic,
        perDaySalary: newPerDay,
        perNightSalary: newPerNight,
      };
    });
    if (errors.customShiftStart || errors.customShiftEnd || errors.basicSalary || errors.perDaySalary || errors.perNightSalary) {
      setErrors(prev => ({ ...prev, customShiftStart: '', customShiftEnd: '', basicSalary: '', perDaySalary: '', perNightSalary: '' }));
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileChange = (field, file) => {
    setFormData(prev => ({ ...prev, [field]: file }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.employeeCode.trim()) {
      newErrors.employeeCode = 'Employee code is required.';
    } else if (!/^[A-Za-z0-9._-]+$/.test(formData.employeeCode.trim())) {
      newErrors.employeeCode = 'Use only letters, numbers, dot, dash or underscore.';
    }
    if (!formData.name.trim()) newErrors.name = 'Member name is required.';
    if (!formData.qualification.trim()) newErrors.qualification = 'Qualification is required.';
    if (!formData.position.trim()) newErrors.position = 'Please select or enter a position.';
    if (!formData.dateOfJoining) newErrors.dateOfJoining = 'Date of joining is required.';
    if (!formData.experienceDescription.trim()) newErrors.experienceDescription = 'Previous experience description is required.';

    // Only General shift requires individual custom timing
    if (formData.shiftCategory === 'general') {
      if (!formData.customShiftStart) newErrors.customShiftStart = 'Shift start time is required.';
      if (!formData.customShiftEnd) newErrors.customShiftEnd = 'Shift end time is required.';
    }

    if (formData.shiftCategory === 'day_and_night') {
      if (!formData.perDaySalary || Number(formData.perDaySalary) <= 0) {
        newErrors.perDaySalary = 'Per day shift salary is required.';
      }
      if (!formData.perNightSalary || Number(formData.perNightSalary) <= 0) {
        newErrors.perNightSalary = 'Per night shift salary is required.';
      }
    } else {
      if (!formData.basicSalary || Number(formData.basicSalary) <= 0) {
        newErrors.basicSalary = 'Monthly basic salary is required.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const calculatedBasic = formData.shiftCategory === 'day_and_night'
      ? Math.round((Number(formData.perDaySalary) || 0) * 30 * 100) / 100
      : (Number(formData.basicSalary) || 0);
    const calculatedPerDay = formData.shiftCategory === 'day_and_night'
      ? (Number(formData.perDaySalary) || 0)
      : Math.round(((Number(formData.basicSalary) || 0) / 30) * 100) / 100;
    const calculatedPerNight = formData.shiftCategory === 'day_and_night'
      ? (Number(formData.perNightSalary) || 0)
      : 0;

    const submissionData = {
      ...formData,
      customShiftStart: formData.shiftCategory === 'day'
        ? shiftConfigs.day.start
        : (formData.shiftCategory === 'night'
          ? shiftConfigs.night.start
          : (formData.shiftCategory === 'general' ? formData.customShiftStart : null)),
      customShiftEnd: formData.shiftCategory === 'day'
        ? shiftConfigs.day.end
        : (formData.shiftCategory === 'night'
          ? shiftConfigs.night.end
          : (formData.shiftCategory === 'general' ? formData.customShiftEnd : null)),
      salary_type: 'monthly',
      basicSalary: calculatedBasic,
      perDaySalary: calculatedPerDay,
      perNightSalary: calculatedPerNight,
    };
    onSubmit(submissionData, currentDept);
  };

  return (
    <div className="min-h-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
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
            Staff & Salary &nbsp;&gt;&nbsp; Department & Role &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Add Member</span>
          </h1>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-6 max-w-2xl">
        <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
          <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.114a6.375 6.375 0 0112.75 0v.114A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-gray-900">Member Details</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Department Selection Dropdown */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => handleDeptChange(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
            >
              {departments.map((dept) => (
                <option key={dept.id || dept.name} value={dept.id || dept.name}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Employee Code — must match the biometric device */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Employee Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.employeeCode}
              onChange={(e) => handleChange('employeeCode', e.target.value)}
              placeholder="e.g. 1042"
              className={`w-full px-3.5 py-2.5 border rounded-lg text-xs font-semibold text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                errors.employeeCode ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
              }`}
            />
            {errors.employeeCode
              ? <p className="text-[11px] text-red-500">{errors.employeeCode}</p>
              : <p className="text-[11px] text-gray-400">Must exactly match this staff member's Emp Code on the biometric device — attendance is matched on this, not on name.</p>}
          </div>

          {/* Member Name */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Priya Nandhini"
              className={`w-full px-3.5 py-2.5 border rounded-lg text-xs font-semibold text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                errors.name ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
              }`}
            />
            {errors.name && <p className="text-[11px] text-red-500">{errors.name}</p>}
          </div>

          {/* Qualification */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Qualification <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.qualification}
              onChange={(e) => handleChange('qualification', e.target.value)}
              placeholder="e.g. B.Sc Nursing, MD, DMLT"
              className={`w-full px-3.5 py-2.5 border rounded-lg text-xs font-medium text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                errors.qualification ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
              }`}
            />
            {errors.qualification && <p className="text-[11px] text-red-500">{errors.qualification}</p>}
          </div>

          {/* Role Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Role / Position to be Allotted <span className="text-red-500">*</span>
            </label>
            {availableRoles.length > 0 ? (
              <select
                value={formData.position}
                onChange={(e) => handleRoleChange(e.target.value)}
                className={`w-full px-3.5 py-2.5 border rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                  errors.position ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
                }`}
              >
                {availableRoles.map((role, idx) => (
                  <option key={idx} value={role}>{role}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={formData.position}
                onChange={(e) => handleChange('position', e.target.value)}
                placeholder="e.g. Staff Nurse"
                className={`w-full px-3.5 py-2.5 border rounded-lg text-xs font-medium text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                  errors.position ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
                }`}
              />
            )}
            {errors.position && <p className="text-[11px] text-red-500">{errors.position}</p>}
          </div>

          {/* Date of Joining */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Date of Joining <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.dateOfJoining}
              onChange={(e) => handleChange('dateOfJoining', e.target.value)}
              className={`w-full px-3.5 py-2.5 border rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                errors.dateOfJoining ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
              }`}
            />
            {errors.dateOfJoining && <p className="text-[11px] text-red-500">{errors.dateOfJoining}</p>}
          </div>

          {/* Previous Experience Description */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Previous Experience Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows="4"
              value={formData.experienceDescription}
              onChange={(e) => handleChange('experienceDescription', e.target.value)}
              placeholder="Describe previous hospital or clinical experience, roles held, years of service..."
              className={`w-full px-3.5 py-2.5 border rounded-lg text-xs text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                errors.experienceDescription ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
              }`}
            ></textarea>
            {errors.experienceDescription && <p className="text-[11px] text-red-500">{errors.experienceDescription}</p>}
          </div>

          {/* ─── Shift & Working Hours ─── */}
          <div className="md:col-span-2 pt-4 border-t border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">Shift &amp; Working Hours</span>
                <span className="text-[11px] text-gray-400">— assign employee's primary shift category</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTimingModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100/80 border border-blue-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                <span>⚙️</span>
                <span>Configure Shift Timings</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Shift Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.shiftCategory}
                  onChange={(e) => handleShiftCategoryChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                >
                  <option value="day">Day Shift (Fixed Time: {shiftConfigs.day.start} – {shiftConfigs.day.end})</option>
                  <option value="night">Night Shift (Fixed Time: {shiftConfigs.night.start} – {shiftConfigs.night.end})</option>
                  <option value="day_and_night">Day &amp; Night Shift (Scheduled via Weekly Duty Roster)</option>
                  <option value="general">General Shift (Individual Custom Timing)</option>
                </select>
              </div>

              {/* Day Shift: Fixed, Non-editable */}
              {formData.shiftCategory === 'day' && (
                <div className="md:col-span-2 p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/80 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-900">☀️ Fixed Day Shift Timing</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-amber-200/80 text-amber-800 rounded-md">Fixed (Non-editable)</span>
                    </div>
                    <p className="text-sm font-extrabold text-amber-900 tracking-wide">
                      {shiftConfigs.day.start} – {shiftConfigs.day.end}
                    </p>
                    <p className="text-[11px] text-amber-700">
                      Standard hospital day shift hours apply to this employee. To adjust global timings, use "Configure Shift Timings" above.
                    </p>
                  </div>
                  <div className="text-amber-500 text-2xl font-bold pl-3">🔒</div>
                </div>
              )}

              {/* Night Shift: Fixed, Non-editable */}
              {formData.shiftCategory === 'night' && (
                <div className="md:col-span-2 p-3.5 bg-purple-50/70 rounded-xl border border-purple-200/80 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-purple-900">🌙 Fixed Night Shift Timing</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-purple-200/80 text-purple-800 rounded-md">Fixed (Non-editable)</span>
                    </div>
                    <p className="text-sm font-extrabold text-purple-900 tracking-wide">
                      {shiftConfigs.night.start} – {shiftConfigs.night.end}
                    </p>
                    <p className="text-[11px] text-purple-700">
                      Standard hospital night shift hours apply to this employee. To adjust global timings, use "Configure Shift Timings" above.
                    </p>
                  </div>
                  <div className="text-purple-500 text-2xl font-bold pl-3">🔒</div>
                </div>
              )}

              {/* Day & Night Shift: Scheduled via Duty Roster (No shift timing inputs asked) */}
              {formData.shiftCategory === 'day_and_night' && (
                <div className="md:col-span-2 p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/80 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-900">🗓️ Weekly Duty Roster Scheduled</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-blue-200/80 text-blue-800 rounded-md">Roster Assigned</span>
                    </div>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      Employees on <strong>Day &amp; Night Shift</strong> do not have a fixed single shift timing. Their day/night shifts and working hours are scheduled weekly via the <strong>Weekly Duty Roster</strong>.
                    </p>
                  </div>
                  <div className="text-blue-500 text-2xl font-bold pl-3">📅</div>
                </div>
              )}

              {/* General Shift: Unique Individual Custom Timing */}
              {formData.shiftCategory === 'general' && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Shift Start Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.customShiftStart}
                      onChange={(e) => handleChange('customShiftStart', e.target.value)}
                      className={`w-full px-3.5 py-2.5 border rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                        errors.customShiftStart ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
                      }`}
                    />
                    {errors.customShiftStart && <p className="text-[11px] text-red-500">{errors.customShiftStart}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Shift End Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.customShiftEnd}
                      onChange={(e) => handleChange('customShiftEnd', e.target.value)}
                      className={`w-full px-3.5 py-2.5 border rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                        errors.customShiftEnd ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
                      }`}
                    />
                    {errors.customShiftEnd && <p className="text-[11px] text-red-500">{errors.customShiftEnd}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-[11px] text-gray-400">
                      General shift hours are unique to each employee. Enter this staff member’s working hours.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ─── Salary Details ─── */}
          <div className="md:col-span-2 pt-4 border-t border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">Salary Details</span>
                <span className="text-[11px] text-gray-400">— monthly basis salary structure</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Monthly Basis Only
              </span>
            </div>

            {formData.shiftCategory === 'day_and_night' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Per Day Shift Salary (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={formData.perDaySalary}
                      onChange={(e) => handleChange('perDaySalary', e.target.value)}
                      placeholder="e.g. 700"
                      className={`w-full px-3.5 py-2.5 border rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                        errors.perDaySalary ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
                      }`}
                    />
                    {errors.perDaySalary && <p className="text-[11px] text-red-500">{errors.perDaySalary}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Per Night Shift Salary (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={formData.perNightSalary}
                      onChange={(e) => handleChange('perNightSalary', e.target.value)}
                      placeholder="e.g. 900"
                      className={`w-full px-3.5 py-2.5 border rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                        errors.perNightSalary ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
                      }`}
                    />
                    {errors.perNightSalary && <p className="text-[11px] text-red-500">{errors.perNightSalary}</p>}
                  </div>
                </div>

                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/80 flex items-center justify-between text-xs">
                  <span className="text-blue-800 font-medium">
                    Auto-calculated Monthly Base (30 days × Per Day Rate):
                  </span>
                  <span className="font-bold text-blue-900 text-sm">
                    ₹{((Number(formData.perDaySalary) || 0) * 30).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Monthly Basic Salary (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={formData.basicSalary}
                      onChange={(e) => handleChange('basicSalary', e.target.value)}
                      placeholder="e.g. 25000"
                      className={`w-full px-3.5 py-2.5 border rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                        errors.basicSalary ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
                      }`}
                    />
                    {errors.basicSalary && <p className="text-[11px] text-red-500">{errors.basicSalary}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Auto-calculated Per Day Salary (÷ 30)
                    </label>
                    <div className="w-full px-3.5 py-2.5 border border-dashed border-gray-300 rounded-lg text-xs font-bold text-gray-800 bg-gray-50 flex items-center justify-between">
                      <span>₹{formData.basicSalary && Number(formData.basicSalary) > 0 ? (Number(formData.basicSalary) / 30).toFixed(2) : '0.00'}</span>
                      <span className="text-[10px] font-normal text-gray-400">(÷ 30 days)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── Identity & Documents ─── */}
          <div className="md:col-span-2 pt-4 border-t border-gray-100 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">Identity &amp; Documents</span>
              <span className="text-[11px] text-gray-400">— Aadhar and PAN cards (with file upload)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Aadhar Number */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Aadhar Card Number
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={formData.aadharNumber}
                  onChange={(e) => handleChange('aadharNumber', e.target.value)}
                  placeholder="e.g. 1234 5678 9012"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                />
              </div>

              {/* Aadhar Document Upload */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Aadhar Document (PDF, JPG, PNG)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileChange('aadharDoc', e.target.files?.[0] || null)}
                  className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              {/* PAN Number */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  PAN Card Number
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={formData.panNumber}
                  onChange={(e) => handleChange('panNumber', e.target.value.toUpperCase())}
                  placeholder="e.g. ABCDE1234F"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                />
              </div>

              {/* PAN Document Upload */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  PAN Document (PDF, JPG, PNG)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileChange('panDoc', e.target.files?.[0] || null)}
                  className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* ─── Bank Account Details ─── */}
          <div className="md:col-span-2 pt-4 border-t border-gray-100 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">Bank Account Details</span>
              <span className="text-[11px] text-gray-400">— for salary credit</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Account Number
                </label>
                <input
                  type="text"
                  value={formData.bankAccountNo}
                  onChange={(e) => handleChange('bankAccountNo', e.target.value)}
                  placeholder="e.g. 0123456789012"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  IFSC Code
                </label>
                <input
                  type="text"
                  maxLength={11}
                  value={formData.bankIfsc}
                  onChange={(e) => handleChange('bankIfsc', e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => handleChange('bankName', e.target.value)}
                  placeholder="e.g. Main Branch, Anna Nagar"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Save Member
          </button>
        </div>
      </form>

      {showTimingModal && (
        <ConfigureShiftTimingModal
          isOpen={showTimingModal}
          onClose={() => setShowTimingModal(false)}
          onSuccess={() => fetchShiftConfigs()}
        />
      )}
    </div>
  );
}
