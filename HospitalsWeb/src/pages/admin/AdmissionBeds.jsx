import React from 'react';

export default function AdmissionBeds() {
  const wards = [
    { name: 'ICU Ward', total: 10, occupied: 8, available: 2 },
    { name: 'General Ward (Male)', total: 20, occupied: 14, available: 6 },
    { name: 'General Ward (Female)', total: 20, occupied: 11, available: 9 },
    { name: 'Private Deluxe Suite', total: 5, occupied: 4, available: 1 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400 font-medium mb-1">
            Patient & Hospital &nbsp;&gt;&nbsp; <span className="text-gray-700 font-semibold">Admission & Beds</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">In-Patient Admission & Bed Matrix</h1>
          <p className="text-xs text-gray-500 mt-0.5">Real-time bed availability, ward assignments, and IPD transfers.</p>
        </div>
        <button className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer">
          + Admit Patient
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {wards.map((w, idx) => (
          <div key={idx} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm space-y-2">
            <h3 className="font-bold text-gray-900 text-sm">{w.name}</h3>
            <div className="text-xs text-gray-500 flex justify-between">
              <span>Occupied: <strong className="text-blue-600">{w.occupied}</strong></span>
              <span>Available: <strong className="text-emerald-600">{w.available}</strong></span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(w.occupied / w.total) * 100}%` }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
