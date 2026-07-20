import React from 'react';

export default function Appointments() {
  const tokens = [
    { token: '#01', patient: 'Anitha R.', doctor: 'Dr. Meera R.', time: '09:30 AM', status: 'In Consultation' },
    { token: '#02', patient: 'Suresh Babu', doctor: 'Dr. Meera R.', time: '10:00 AM', status: 'Waiting' },
    { token: '#03', patient: 'Deepa V.', doctor: 'Dr. Rajesh Kumar', time: '10:15 AM', status: 'Waiting' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400 font-medium mb-1">
            Patient & Hospital &nbsp;&gt;&nbsp; <span className="text-gray-700 font-semibold">Appointments</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Appointments & Token Booking</h1>
          <p className="text-xs text-gray-500 mt-0.5">Live OPD token queue and doctor consultation schedules.</p>
        </div>
        <button className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer">
          + Book New Token
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3.5">Token #</th>
              <th className="p-3.5">Patient</th>
              <th className="p-3.5">Doctor</th>
              <th className="p-3.5">Time</th>
              <th className="p-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tokens.map((t, idx) => (
              <tr key={idx} className="hover:bg-gray-50/80">
                <td className="p-3.5 font-bold text-blue-600 text-sm">{t.token}</td>
                <td className="p-3.5 font-semibold text-gray-900">{t.patient}</td>
                <td className="p-3.5">{t.doctor}</td>
                <td className="p-3.5">{t.time}</td>
                <td className="p-3.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    t.status === 'In Consultation' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {t.status}
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
