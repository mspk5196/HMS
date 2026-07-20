import React from 'react';

export default function Attendance() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Staff & Salary &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Attendance</span>
        </h1>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Today's Attendance Logs (86 Checked In)</h2>
          <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full">
            Biometric Sync Active
          </span>
        </div>
        <div className="text-xs text-gray-500">
          Biometric attendance logs synced automatically at 08:00 AM. 3 staff members currently marked on leave.
        </div>
      </div>
    </div>
  );
}
