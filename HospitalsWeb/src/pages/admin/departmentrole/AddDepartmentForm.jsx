import React, { useState } from 'react';

export default function AddDepartmentForm({ onBack, onSubmit, initialData }) {
  const [deptName, setDeptName] = useState(initialData ? initialData.name : '');
  const [roles, setRoles] = useState(
    initialData && initialData.roles && initialData.roles.length > 0
      ? initialData.roles.map(r => ({ id: r.id, roleName: r.roleName, basicSalary: r.basicSalary, weeklyOffCount: r.weeklyOffCount ?? 4, monthlyBufferMinutes: r.monthlyBufferMinutes ?? 30 }))
      : [{ roleName: '', basicSalary: '', weeklyOffCount: 4, monthlyBufferMinutes: 30 }]
  );
  const [errors, setErrors] = useState({});

  // Force uppercase as user types
  const handleDeptNameChange = (e) => {
    setDeptName(e.target.value.toUpperCase());
    if (errors.deptName) setErrors(prev => ({ ...prev, deptName: '' }));
  };

  const handleRoleChange = (idx, field, value) => {
    setRoles(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    if (errors[`role_${idx}_${field}`]) {
      setErrors(prev => ({ ...prev, [`role_${idx}_${field}`]: '' }));
    }
  };

  const addRole = () => {
    setRoles(prev => [...prev, { roleName: '', basicSalary: '', weeklyOffCount: 4, monthlyBufferMinutes: 30 }]);
  };

  const removeRole = (idx) => {
    if (roles.length === 1) return; // keep at least one row
    setRoles(prev => prev.filter((_, i) => i !== idx));
  };

  const validate = () => {
    const newErrors = {};
    if (!deptName.trim()) newErrors.deptName = 'Department name is required.';
    roles.forEach((r, i) => {
      if (!r.roleName.trim()) newErrors[`role_${i}_roleName`] = 'Role name is required.';
      if (!r.basicSalary || isNaN(r.basicSalary) || Number(r.basicSalary) <= 0)
        newErrors[`role_${i}_basicSalary`] = 'Enter a valid salary.';
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ deptName, roles });
  };

  return (
    <div className="min-h-full space-y-6">
      {/* Page Header */}
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
            Staff & Salary &nbsp;&gt;&nbsp; Department & Role &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">{initialData ? 'Edit Department' : 'Add Department'}</span>
          </h1>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Department Name */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5h.75m-.75 3h.75m-.75 3h.75" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-gray-900">Department Information</h2>
          </div>

          <div className="max-w-md space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="deptName"
              value={deptName}
              onChange={handleDeptNameChange}
              placeholder="e.g. NURSING"
              className={`w-full px-3.5 py-2.5 border rounded-lg text-sm font-semibold text-gray-900 tracking-wide placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                errors.deptName ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
              }`}
            />
            {errors.deptName && (
              <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.deptName}
              </p>
            )}
            <p className="text-[11px] text-gray-400 mt-1">
              Input is automatically converted to UPPERCASE.
            </p>
          </div>
        </div>

        {/* Roles & Salaries */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Roles & Basic Salary</h2>
                <p className="text-[11px] text-gray-400">Add one or more roles for this department with their base salary.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={addRole}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Role
            </button>
          </div>

          <div className="grid grid-cols-12 gap-2 px-1">
            <div className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">#</div>
            <div className="col-span-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Role Name <span className="text-red-400">*</span>
            </div>
            <div className="col-span-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Basic Salary (₹) <span className="text-red-400">*</span>
            </div>
            <div className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center" title="Weekly Offs per month">
              W-Off
            </div>
            <div className="col-span-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center" title="Monthly Buffer Minutes">
              Buffer (min)
            </div>
            <div className="col-span-1"></div>
          </div>

          <div className="space-y-3">
            {roles.map((role, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-1 flex items-center justify-center h-10">
                  <span className="text-xs font-bold text-gray-400 bg-gray-100 w-6 h-6 rounded-full flex items-center justify-center">
                    {idx + 1}
                  </span>
                </div>

                <div className="col-span-4 space-y-1">
                  <input
                    type="text"
                    value={role.roleName}
                    onChange={(e) => handleRoleChange(idx, 'roleName', e.target.value)}
                    placeholder="e.g. Head Nurse"
                    className={`w-full px-3 py-2.5 border rounded-lg text-xs text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                      errors[`role_${idx}_roleName`] ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
                    }`}
                  />
                  {errors[`role_${idx}_roleName`] && (
                    <p className="text-[10px] text-red-500 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors[`role_${idx}_roleName`]}
                    </p>
                  )}
                </div>

                <div className="col-span-3 space-y-1">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold pointer-events-none">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={role.basicSalary}
                      onChange={(e) => handleRoleChange(idx, 'basicSalary', e.target.value)}
                      placeholder="e.g. 25000"
                      min="0"
                      className={`w-full pl-6 pr-2 py-2.5 border rounded-lg text-xs text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
                        errors[`role_${idx}_basicSalary`] ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
                      }`}
                    />
                  </div>
                  {errors[`role_${idx}_basicSalary`] && (
                    <p className="text-[10px] text-red-500 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors[`role_${idx}_basicSalary`]}
                    </p>
                  )}
                </div>

                <div className="col-span-1 space-y-1">
                  <input
                    type="number"
                    value={role.weeklyOffCount ?? 4}
                    onChange={(e) => handleRoleChange(idx, 'weeklyOffCount', e.target.value)}
                    placeholder="4"
                    min="0" max="15"
                    title="Weekly Offs per month"
                    className="w-full px-1 py-2.5 border border-gray-200 bg-white rounded-lg text-xs font-semibold text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <input
                    type="number"
                    value={role.monthlyBufferMinutes ?? 30}
                    onChange={(e) => handleRoleChange(idx, 'monthlyBufferMinutes', e.target.value)}
                    placeholder="30"
                    min="0" max="600"
                    title="Monthly Buffer Minutes"
                    className="w-full px-2 py-2.5 border border-gray-200 bg-white rounded-lg text-xs font-semibold text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div className="col-span-1 flex items-center justify-center h-10">
                  <button
                    type="button"
                    onClick={() => removeRole(idx)}
                    disabled={roles.length === 1}
                    className={`p-1.5 rounded-lg transition-colors ${
                      roles.length === 1
                        ? 'text-gray-200 cursor-not-allowed'
                        : 'text-rose-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                    }`}
                    title="Remove role"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {roles.length > 0 && roles.some(r => r.basicSalary) && (
            <div className="mt-2 pt-4 border-t border-gray-100 flex justify-end">
              <div className="text-xs text-gray-500">
                Total roles added: &nbsp;
                <span className="font-bold text-gray-800">{roles.length}</span>
                &nbsp;·&nbsp; Avg. Basic Salary: &nbsp;
                <span className="font-bold text-blue-600">
                  ₹{Math.round(
                    roles.filter(r => r.basicSalary && !isNaN(r.basicSalary))
                      .reduce((sum, r) => sum + Number(r.basicSalary), 0) /
                    (roles.filter(r => r.basicSalary && !isNaN(r.basicSalary)).length || 1)
                  ).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
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
            {initialData ? 'Save Changes' : 'Save Department'}
          </button>
        </div>
      </form>
    </div>
  );
}
