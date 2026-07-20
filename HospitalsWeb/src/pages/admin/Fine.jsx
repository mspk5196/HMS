import React from 'react';

export default function Fine() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-gray-400 font-medium mb-1">
          Staff & Salary &nbsp;&gt;&nbsp; <span className="text-gray-700 font-semibold">Fine</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Fines & Penalties Log</h1>
        <p className="text-xs text-gray-500 mt-0.5">Track tardiness penalties, duty violations, and deductions.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm">
        <p className="text-xs text-gray-500">No active fine deductions recorded for this billing cycle.</p>
      </div>
    </div>
  );
}
