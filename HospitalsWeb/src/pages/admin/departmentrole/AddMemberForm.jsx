import React, { useState } from 'react';

export default function AddMemberForm({ departments, initialDepartment, onBack, onSubmit }) {
  const [selectedDeptId, setSelectedDeptId] = useState(
    initialDepartment ? (initialDepartment.id || initialDepartment.name) : (departments[0]?.id || departments[0]?.name || '')
  );

  const currentDept = departments.find(
    d => String(d.id) === String(selectedDeptId) || String(d.name) === String(selectedDeptId)
  ) || departments[0] || initialDepartment;

  const availableRoles = (currentDept?.roles || []).map(r => typeof r === 'string' ? r : r.roleName);

  const [formData, setFormData] = useState({
    employeeCode: '',
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
