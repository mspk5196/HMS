import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../util/api';

// ─── Add Member Form ────────────────────────────────────────────────────────
function AddMemberForm({ departments, initialDepartment, onBack, onSubmit }) {
  const [selectedDeptId, setSelectedDeptId] = useState(
    initialDepartment ? (initialDepartment.id || initialDepartment.name) : (departments[0]?.id || departments[0]?.name || '')
  );

  const currentDept = departments.find(
    d => String(d.id) === String(selectedDeptId) || String(d.name) === String(selectedDeptId)
  ) || departments[0] || initialDepartment;

  const availableRoles = (currentDept?.roles || []).map(r => typeof r === 'string' ? r : r.roleName);

  const [formData, setFormData] = useState({
    name: '',
    qualification: '',
    position: availableRoles.length > 0 ? availableRoles[0] : '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    experienceDescription: ''
  });

  const [errors, setErrors] = useState({});

  const handleDeptChange = (newDeptId) => {
    setSelectedDeptId(newDeptId);
    const newDept = departments.find(
      d => String(d.id) === String(newDeptId) || String(d.name) === String(newDeptId)
    ) || departments[0];
    const newRoles = (newDept?.roles || []).map(r => typeof r === 'string' ? r : r.roleName);
    setFormData(prev => ({
      ...prev,
      position: newRoles.length > 0 ? newRoles[0] : ''
    }));
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Member name is required.';
    if (!formData.qualification.trim()) newErrors.qualification = 'Qualification is required.';
    if (!formData.position.trim()) newErrors.position = 'Please select or enter a position.';
    if (!formData.dateOfJoining) newErrors.dateOfJoining = 'Date of joining is required.';
    if (!formData.experienceDescription.trim()) newErrors.experienceDescription = 'Previous experience description is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(formData, currentDept);
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

          {/* Role Dropdown (Dynamically updated according to selected Dept) */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Role / Position to be Allotted <span className="text-red-500">*</span>
            </label>
            {availableRoles.length > 0 ? (
              <select
                value={formData.position}
                onChange={(e) => handleChange('position', e.target.value)}
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
    </div>
  );
}

// ─── Department Members View ──────────────────────────────────────────────────
function DepartmentMembersView({ department, onBack, members }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-gray-200/80 transition-colors cursor-pointer text-gray-500 hover:text-gray-800"
            title="Back to departments"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">
              Staff & Salary &nbsp;&gt;&nbsp; Department & Role &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">{department.name} Members</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Members Grid / Table */}
      {members.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-8 text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-gray-900 text-sm">No members added yet</h3>
            <p className="text-xs text-gray-500">No staff members currently registered in {department.name}.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="p-3.5">Name</th>
                <th className="p-3.5">Position Allotted</th>
                <th className="p-3.5">Qualification</th>
                <th className="p-3.5">Joining Date</th>
                <th className="p-3.5">Previous Experience</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((mem, idx) => (
                <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                        {mem.name.charAt(0)}
                      </div>
                      <span className="font-bold text-gray-900">{mem.name}</span>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className="bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-md text-[11px]">
                      {mem.position}
                    </span>
                  </td>
                  <td className="p-3.5 font-medium text-gray-800">{mem.qualification}</td>
                  <td className="p-3.5 text-gray-600">{mem.dateOfJoining}</td>
                  <td className="p-3.5 text-gray-500 max-w-xs truncate" title={mem.experienceDescription}>
                    {mem.experienceDescription}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Add/Edit Department Form ──────────────────────────────────────────────────
function AddDepartmentForm({ onBack, onSubmit, initialData }) {
  const [deptName, setDeptName] = useState(initialData ? initialData.name : '');
  const [roles, setRoles] = useState(
    initialData && initialData.roles && initialData.roles.length > 0
      ? initialData.roles.map(r => ({ id: r.id, roleName: r.roleName, basicSalary: r.basicSalary }))
      : [{ roleName: '', basicSalary: '' }]
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
    setRoles(prev => [...prev, { roleName: '', basicSalary: '' }]);
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

          <div className="grid grid-cols-12 gap-3 px-1">
            <div className="col-span-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">#</div>
            <div className="col-span-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Role Name <span className="text-red-400">*</span>
            </div>
            <div className="col-span-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Basic Salary (₹) <span className="text-red-400">*</span>
            </div>
            <div className="col-span-1"></div>
          </div>

          <div className="space-y-3">
            {roles.map((role, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-1 flex items-center justify-center h-10">
                  <span className="text-xs font-bold text-gray-400 bg-gray-100 w-6 h-6 rounded-full flex items-center justify-center">
                    {idx + 1}
                  </span>
                </div>

                <div className="col-span-6 space-y-1">
                  <input
                    type="text"
                    value={role.roleName}
                    onChange={(e) => handleRoleChange(idx, 'roleName', e.target.value)}
                    placeholder="e.g. Head Nurse"
                    className={`w-full px-3.5 py-2.5 border rounded-lg text-xs text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
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

                <div className="col-span-4 space-y-1">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold pointer-events-none">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={role.basicSalary}
                      onChange={(e) => handleRoleChange(idx, 'basicSalary', e.target.value)}
                      placeholder="e.g. 25000"
                      min="0"
                      className={`w-full pl-7 pr-3 py-2.5 border rounded-lg text-xs text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${
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


// ─── Department List (main view) ─────────────────────────────────────────────
export default function DepartmentRole() {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'add-dept' | 'members-list' | 'add-member'
  const [selectedDept, setSelectedDept] = useState(null);
  const [editingDept, setEditingDept] = useState(null);

  const [departments, setDepartments] = useState([
    {
      id: 1,
      name: 'NURSING',
      head: 'Sr. Mary Joseph',
      staffCount: 2,
      roles: [{ roleName: 'Head Nurse', basicSalary: '35000' }, { roleName: 'Staff Nurse', basicSalary: '25000' }, { roleName: 'Junior Nurse', basicSalary: '18000' }],
      members: [
        { name: 'Sr. Mary Joseph', position: 'Head Nurse', qualification: 'M.Sc Nursing', dateOfJoining: '2020-05-15', experienceDescription: '10+ years experience in ICU and emergency nursing.' },
        { name: 'Priya Nandhini', position: 'Staff Nurse', qualification: 'B.Sc Nursing', dateOfJoining: '2026-06-01', experienceDescription: '3 years in general ward care and patient vitals monitoring.' }
      ]
    },
    {
      id: 2,
      name: 'LABORATORY',
      head: 'Dr. Rajesh Kumar',
      staffCount: 1,
      roles: [{ roleName: 'Chief Technician', basicSalary: '40000' }, { roleName: 'Lab Analyst', basicSalary: '28000' }, { roleName: 'Phlebotomist', basicSalary: '20000' }],
      members: [
        { name: 'Dr. Rajesh Kumar', position: 'Chief Technician', qualification: 'Ph.D Clinical Pathology', dateOfJoining: '2021-02-10', experienceDescription: '8 years leading diagnostic testing and hematology labs.' }
      ]
    },
    {
      id: 3,
      name: 'PHARMACY',
      head: 'Pharmacist Ravi T.',
      staffCount: 1,
      roles: [{ roleName: 'Chief Pharmacist', basicSalary: '45000' }, { roleName: 'Dispensing Pharmacist', basicSalary: '30000' }],
      members: [
        { name: 'Ravi T.', position: 'Chief Pharmacist', qualification: 'M.Pharm', dateOfJoining: '2022-03-20', experienceDescription: '6 years managing clinical pharmacy inventory and prescriptions.' }
      ]
    },
    {
      id: 4,
      name: 'GENERAL MEDICINE',
      head: 'Dr. Meera R.',
      staffCount: 1,
      roles: [{ roleName: 'Senior Consultant', basicSalary: '90000' }, { roleName: 'Resident Doctor', basicSalary: '60000' }, { roleName: 'Intern', basicSalary: '15000' }],
      members: [
        { name: 'Dr. Meera R.', position: 'Senior Consultant', qualification: 'MBBS, MD General Medicine', dateOfJoining: '2019-11-01', experienceDescription: '12 years in internal medicine and outpatient consultations.' }
      ]
    },
    {
      id: 5,
      name: 'ADMINISTRATION',
      head: 'Admin Kavitha S.',
      staffCount: 1,
      roles: [{ roleName: 'HR Manager', basicSalary: '38000' }, { roleName: 'Receptionist', basicSalary: '20000' }, { roleName: 'Billing Executive', basicSalary: '22000' }],
      members: [
        { name: 'Kavitha S.', position: 'Receptionist', qualification: 'B.Com, PGDHRM', dateOfJoining: '2023-01-15', experienceDescription: '4 years in hospital front-office administration and patient billing.' }
      ]
    }
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await apiFetch('/hr/departments');
      if (data && Array.isArray(data) && data.length > 0) {
        setDepartments(data.map(d => ({
          ...d,
          members: d.members || []
        })));
      }
    } catch (err) {
      console.log('Using local state fallback for departments:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  // Submit Handler for Add/Edit Department
  const handleDepartmentSubmit = async ({ deptName, roles }) => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      if (editingDept) {
        try {
          await apiFetch(`/hr/departments/${editingDept.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name: deptName,
              roles: roles.map(r => ({ id: r.id, roleName: r.roleName, basicSalary: Number(r.basicSalary) }))
            })
          });
        } catch (e) { /* local fallback */ }

        setDepartments(prev => prev.map(d => d.id === editingDept.id ? {
          ...d,
          name: deptName,
          roles
        } : d));
        setSuccessMsg(`Department "${deptName}" updated successfully.`);
      } else {
        const newDeptObj = {
          id: Date.now(),
          name: deptName,
          head: '—',
          staffCount: 0,
          roles,
          members: []
        };
        try {
          await apiFetch('/hr/departments', {
            method: 'POST',
            body: JSON.stringify(newDeptObj)
          });
        } catch (e) { /* local fallback */ }

        setDepartments(prev => [...prev, newDeptObj]);
        setSuccessMsg(`Department "${deptName}" added successfully with ${roles.length} role(s).`);
      }

      setEditingDept(null);
      setViewMode('list');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save department.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Handler for Add Member
  const handleAddMemberSubmit = (memberData, targetDept) => {
    const deptToUpdate = targetDept || selectedDept || departments[0];
    if (!deptToUpdate) return;

    setDepartments(prev => prev.map(d => {
      if ((d.id && d.id === deptToUpdate.id) || d.name === deptToUpdate.name) {
        const updatedMembers = [...(d.members || []), memberData];
        const updatedDept = {
          ...d,
          members: updatedMembers,
          staffCount: updatedMembers.length
        };
        if (selectedDept && ((selectedDept.id && selectedDept.id === d.id) || selectedDept.name === d.name)) {
          setSelectedDept(updatedDept);
        }
        return updatedDept;
      }
      return d;
    }));

    setSuccessMsg(`Member "${memberData.name}" added successfully to ${deptToUpdate.name} as ${memberData.position}.`);
    if (selectedDept) {
      setViewMode('members-list');
    } else {
      setViewMode('list');
    }
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleDeleteDepartment = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the department "${name}"?`)) {
      return;
    }
    try {
      setIsLoading(true);
      setErrorMsg('');
      try {
        await apiFetch(`/hr/departments/${id}`, { method: 'DELETE' });
      } catch(e) { /* local fallback */ }

      setDepartments(prev => prev.filter(d => d.id !== id));
      setSuccessMsg(`Department "${name}" deleted successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete department.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (dept) => {
    setEditingDept(dept);
    setViewMode('add-dept');
  };

  const handleOpenMembers = (dept) => {
    setSelectedDept(dept);
    setViewMode('members-list');
  };

  // ── Render Views ─────────────────────────────────────────────────────────────
  if (viewMode === 'add-dept') {
    return (
      <AddDepartmentForm
        onBack={() => { setEditingDept(null); setViewMode('list'); }}
        onSubmit={handleDepartmentSubmit}
        initialData={editingDept}
      />
    );
  }

  if (viewMode === 'members-list' && selectedDept) {
    const currentDept = departments.find(d => (d.id && d.id === selectedDept.id) || d.name === selectedDept.name) || selectedDept;
    return (
      <DepartmentMembersView
        department={currentDept}
        members={currentDept.members || []}
        onBack={() => setViewMode('list')}
      />
    );
  }

  if (viewMode === 'add-member') {
    return (
      <AddMemberForm
        departments={departments}
        initialDepartment={selectedDept}
        onBack={() => {
          if (selectedDept) {
            setViewMode('members-list');
          } else {
            setViewMode('list');
          }
        }}
        onSubmit={handleAddMemberSubmit}
      />
    );
  }

  // Main Department Cards List
  return (
    <div className="space-y-6">
      {/* Success Toast */}
      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-4 py-3 rounded-xl shadow-sm">
          <svg className="w-4 h-4 flex-shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* Error Banner */}
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
            Staff & Salary &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Department & Role</span>
          </h1>
        </div>

        {/* Action Buttons: [+ Add Member] before [+ Add Department] */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => {
              setSelectedDept(null);
              setViewMode('add-member');
            }}
            disabled={isLoading || departments.length === 0}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.114a6.375 6.375 0 0112.75 0v.114A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
            Add Member
          </button>

          <button
            onClick={() => { setEditingDept(null); setViewMode('add-dept'); }}
            disabled={isLoading}
            className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Department
          </button>
        </div>
      </div>

      {/* Department Cards Grid */}
      {departments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-8 text-center max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-gray-900 text-sm">No departments configured</h3>
            <p className="text-xs text-gray-500">Add a department to configure roles and salaries.</p>
          </div>
          <button
            onClick={() => { setEditingDept(null); setViewMode('add-dept'); }}
            className="inline-flex items-center gap-1.5 bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Department
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept, idx) => {
            const memberCount = dept.members ? dept.members.length : (dept.staffCount || 0);
            return (
              <div key={dept.id || idx} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm space-y-3 relative">
                <div className="flex items-center justify-between gap-2">
                  {/* Left Title & Edit/Delete actions */}
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-sm tracking-wide">{dept.name}</h3>
                    <button
                      onClick={() => handleEditClick(dept)}
                      disabled={isLoading}
                      className="p-1 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
                      title={`Edit ${dept.name}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                      disabled={isLoading}
                      className="p-1 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                      title={`Delete ${dept.name}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>

                  {/* Right side: Members button + Staff count */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenMembers(dept)}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer flex items-center gap-1"
                      title={`View ${dept.name} members`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                      Members
                    </button>

                    <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {memberCount} Staff
                    </span>
                  </div>
                </div>

                {dept.head && dept.head !== '—' && (
                  <div className="text-xs text-gray-500">
                    Department Head: <span className="font-medium text-gray-800">{dept.head}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-gray-100">
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Roles</div>
                  <div className="space-y-1.5">
                    {dept.roles && dept.roles.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
                          {typeof r === 'string' ? r : r.roleName}
                        </span>
                        {typeof r !== 'string' && r.basicSalary && (
                          <span className="text-gray-400 font-medium">
                            ₹{Number(r.basicSalary).toLocaleString('en-IN')} / mo
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
