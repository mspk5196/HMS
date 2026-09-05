import React from 'react';
import PageHeader from '../../../components/PageHeader';

export default function DepartmentMembersView({ department, onBack, members = [] }) {
  // Sort department roles by basic salary descending (highest salary first)
  const sortedRoles = Array.isArray(department.roles)
    ? [...department.roles].sort((a, b) => Number(b.basicSalary || 0) - Number(a.basicSalary || 0))
    : [];

  // Group members by their position/role name
  const membersByRole = members.reduce((acc, mem) => {
    const roleName = mem.position || 'Unassigned';
    if (!acc[roleName]) acc[roleName] = [];
    acc[roleName].push(mem);
    return acc;
  }, {});

  // Build ordered role sections
  const roleSections = [];
  const processedRoleNames = new Set();

  // 1. First add roles defined in the department (sorted by salary descending)
  sortedRoles.forEach(roleObj => {
    const roleName = typeof roleObj === 'string' ? roleObj : roleObj.roleName;
    const salary = typeof roleObj !== 'string' ? roleObj.basicSalary : null;
    processedRoleNames.add(roleName);
    roleSections.push({
      roleName,
      basicSalary: salary,
      roleMembers: membersByRole[roleName] || []
    });
  });

  // 2. Add any remaining member positions that weren't in department roles list
  Object.keys(membersByRole).forEach(roleName => {
    if (!processedRoleNames.has(roleName)) {
      roleSections.push({
        roleName,
        basicSalary: null,
        roleMembers: membersByRole[roleName]
      });
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        category="Staff & Salary"
        parent="Department & Role"
        title={`${department.name} Members`}
        subtitle={`Active employees and designations assigned to ${department.name}`}
        onBack={onBack}
        badge={`${members.length} members`}
      />

      {/* Empty State when no members exist in the entire department */}
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
        /* Role-wise Separated Member Sections */
        <div className="space-y-5">
          {roleSections.map((sec, sectionIdx) => {
            if (sec.roleMembers.length === 0) return null; // Only show active roles with members

            return (
              <div key={sectionIdx} className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                {/* Role Section Header Bar */}
                <div className="bg-gray-50/90 px-5 py-3 border-b border-gray-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900 text-sm tracking-tight">{sec.roleName}</span>
                    {sec.basicSalary && (
                      <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-md border border-emerald-200/60">
                        ₹{Number(sec.basicSalary).toLocaleString('en-IN')} / mo
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-gray-500 bg-white px-2.5 py-0.5 rounded-md border border-gray-200">
                    {sec.roleMembers.length} {sec.roleMembers.length === 1 ? 'Staff Member' : 'Staff Members'}
                  </span>
                </div>

                {/* Role Members Table */}
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-gray-50/40 text-[10px] text-gray-400 uppercase font-bold border-b border-gray-100">
                    <tr>
                      <th className="p-3 pl-5">Member Name</th>
                      <th className="p-3">Qualification</th>
                      <th className="p-3">Joining Date</th>
                      <th className="p-3 pr-5">Previous Experience</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sec.roleMembers.map((mem, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                        <td className="p-3 pl-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
                              {mem.name.charAt(0)}
                            </div>
                            <span className="font-bold text-gray-900">{mem.name}</span>
                          </div>
                        </td>
                        <td className="p-3 font-medium text-gray-800">{mem.qualification}</td>
                        <td className="p-3 text-gray-600">{mem.dateOfJoining}</td>
                        <td className="p-3 pr-5 text-gray-500 max-w-xs truncate" title={mem.experienceDescription}>
                          {mem.experienceDescription}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
