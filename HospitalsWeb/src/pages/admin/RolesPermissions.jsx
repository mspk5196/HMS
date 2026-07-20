import React from 'react';

export default function RolesPermissions() {
  const roles = [
    { name: 'Super Admin', users: 2, access: 'Full System Control' },
    { name: 'Doctor / Medical Officer', users: 14, access: 'Consultations, EMR, Prescriptions' },
    { name: 'Nurse / Ward In-Charge', users: 24, access: 'Vitals, Attendance, Ward Beds' },
    { name: 'Pharmacist', users: 8, access: 'Pharmacy Inventory & Billing' },
    { name: 'Receptionist / Billing', users: 10, access: 'Token Booking, Patient Registration' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400 font-medium mb-1">
            Admin &nbsp;&gt;&nbsp; <span className="text-gray-700 font-semibold">Roles & Permissions</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Roles & Access Control</h1>
          <p className="text-xs text-gray-500 mt-0.5">Define role-based security policies and granular permissions.</p>
        </div>
        <button className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer">
          + Add Custom Role
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3.5">Role Name</th>
              <th className="p-3.5">Assigned Users</th>
              <th className="p-3.5">Access Scope</th>
              <th className="p-3.5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {roles.map((r, idx) => (
              <tr key={idx} className="hover:bg-gray-50/80">
                <td className="p-3.5 font-bold text-gray-900">{r.name}</td>
                <td className="p-3.5"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{r.users} Users</span></td>
                <td className="p-3.5">{r.access}</td>
                <td className="p-3.5">
                  <button className="text-blue-600 font-semibold hover:underline cursor-pointer">Edit Permissions</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
