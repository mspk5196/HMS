import React from 'react';

export default function PatientRecords() {
  const patients = [
    { id: 'PAT-1021', name: 'Anitha R.', age: 34, gender: 'Female', phone: '9845012345', blood: 'O+', status: 'OPD' },
    { id: 'PAT-1022', name: 'Karthik Raja', age: 48, gender: 'Male', phone: '9845054321', blood: 'B+', status: 'IPD Admitted' },
    { id: 'PAT-1023', name: 'Saraswathi M.', age: 62, gender: 'Female', phone: '9845099887', blood: 'A+', status: 'Discharged' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            Patient & Hospital &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Patient Records</span>
          </h1>
        </div>
        <button className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer">
          + Register New Patient
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3.5">Patient ID</th>
              <th className="p-3.5">Name</th>
              <th className="p-3.5">Age / Gender</th>
              <th className="p-3.5">Phone</th>
              <th className="p-3.5">Blood Group</th>
              <th className="p-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {patients.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="p-3.5 font-bold text-blue-600">{p.id}</td>
                <td className="p-3.5 font-bold text-gray-900">{p.name}</td>
                <td className="p-3.5">{p.age} Yrs / {p.gender}</td>
                <td className="p-3.5">{p.phone}</td>
                <td className="p-3.5 font-medium">{p.blood}</td>
                <td className="p-3.5">
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
