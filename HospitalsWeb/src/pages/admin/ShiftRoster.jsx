import React from 'react';

export default function ShiftRoster() {
  const shifts = [
    { name: 'Morning Shift', time: '07:00 AM - 03:00 PM', assignedCount: 32 },
    { name: 'Evening Shift', time: '03:00 PM - 11:00 PM', assignedCount: 28 },
    { name: 'Night Shift', time: '11:00 PM - 07:00 AM', assignedCount: 16 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            Staff & Salary &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Shift & Roster</span>
          </h1>
        </div>
        <button className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer">
          + Create Roster
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {shifts.map((shift, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-900 text-sm">{shift.name}</h3>
              <span className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full">
                {shift.assignedCount} Staff
              </span>
            </div>
            <p className="text-xs text-gray-500">{shift.time}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
