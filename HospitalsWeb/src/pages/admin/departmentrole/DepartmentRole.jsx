import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../util/api';
import AddMemberForm from './AddMemberForm';
import AddDepartmentForm from './AddDepartmentForm';
import DepartmentMembersView from './DepartmentMembersView';

const mapEmployeeToMember = (emp) => ({
  id: emp.id,
  name: emp.full_name,
  position: emp.designation_name || 'Staff',
  qualification: emp.qualification || '—',
  dateOfJoining: emp.date_of_joining ? new Date(emp.date_of_joining).toISOString().split('T')[0] : '—',
  experienceDescription: emp.experience_description || '—'
});

export default function DepartmentRole() {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'add-dept' | 'members-list' | 'add-member'
  const [selectedDept, setSelectedDept] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await apiFetch('/hr/departments');
      if (data && Array.isArray(data)) {
        setDepartments(data.map(d => ({
          ...d,
          roles: Array.isArray(d.roles)
            ? [...d.roles].sort((a, b) => Number(b.basicSalary || 0) - Number(a.basicSalary || 0))
            : d.roles,
          members: d.members || undefined
        })));
      }
    } catch (err) {
      console.error('Error fetching departments:', err.message);
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
        } catch (e) { /* fallback */ }

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
        } catch (e) { /* fallback */ }

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
  const handleAddMemberSubmit = async (memberData, targetDept) => {
    const deptToUpdate = targetDept || selectedDept || departments[0];
    if (!deptToUpdate) return;

    try {
      setIsLoading(true);
      setErrorMsg('');

      const matchingRole = (deptToUpdate.roles || []).find(
        r => r.roleName === memberData.position || (typeof r === 'object' && r.roleName === memberData.position)
      );
      const designationId = matchingRole && typeof matchingRole === 'object' ? matchingRole.id : null;
      if (!designationId) {
        throw new Error(`The role "${memberData.position}" was not found or has no ID in this department.`);
      }

      const employeeCode = `EMP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

      const payload = {
        employee_code: employeeCode,
        full_name: memberData.name,
        date_of_joining: memberData.dateOfJoining,
        department_id: deptToUpdate.id,
        designation_id: designationId,
        qualification: memberData.qualification,
        experience_description: memberData.experienceDescription,
        basic_salary: matchingRole && typeof matchingRole === 'object' ? Number(matchingRole.basicSalary) : 0
      };

      const result = await apiFetch('/hr/employees', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const newMember = {
        id: result.id,
        name: memberData.name,
        position: memberData.position,
        qualification: memberData.qualification,
        dateOfJoining: memberData.dateOfJoining,
        experienceDescription: memberData.experienceDescription
      };

      setDepartments(prev => prev.map(d => {
        if (d.id === deptToUpdate.id) {
          const updatedMembers = d.members ? [...d.members, newMember] : [newMember];
          const updatedDept = {
            ...d,
            members: updatedMembers,
            staffCount: Math.max(updatedMembers.length, Number(d.staffCount ?? 0) + 1)
          };
          if (selectedDept && selectedDept.id === d.id) {
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
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add member.');
    } finally {
      setIsLoading(false);
    }
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
      } catch(e) { /* fallback */ }

      setDepartments(prev => prev.filter(d => d.id !== id));
      setSuccessMsg(`Department "${name}" deleted successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      await fetchDepartments();
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

  const handleOpenMembers = async (dept) => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const empData = await apiFetch(`/hr/employees?departmentId=${dept.id}&limit=200`);
      const members = (empData || []).map(mapEmployeeToMember);
      
      const updatedDept = {
        ...dept,
        members,
        staffCount: members.length
      };
      
      setDepartments(prev => prev.map(d => d.id === dept.id ? updatedDept : d));
      setSelectedDept(updatedDept);
      setViewMode('members-list');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load department members.');
    } finally {
      setIsLoading(false);
    }
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

        {/* Action Buttons */}
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
            const memberCount = (dept.members && dept.members.length > 0)
              ? dept.members.length
              : Number(dept.staffCount ?? dept.staff_count ?? 0);
            return (
              <div key={dept.id || idx} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm space-y-3 relative">
                <div className="flex items-center justify-between gap-2">
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
                    {dept.roles && [...dept.roles]
                      .sort((a, b) => Number(b.basicSalary || 0) - Number(a.basicSalary || 0))
                      .map((r, i) => (
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
