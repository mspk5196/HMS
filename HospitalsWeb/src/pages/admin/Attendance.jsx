import React from 'react';

export default function Attendance() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-gray-400 font-medium mb-1">
          Staff & Salary &nbsp;&gt;&nbsp; <span className="text-gray-700 font-semibold">Attendance</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Daily Attendance Tracking</h1>
        <p className="text-xs text-gray-500 mt-0.5">Track employee check-ins, check-outs, and overtime logs.</p>
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
