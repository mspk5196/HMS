import React from 'react';

export default function Fine() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Staff & Salary &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Fine</span>
        </h1>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm">
        <p className="text-xs text-gray-500">No active fine deductions recorded for this billing cycle.</p>
      </div>
    </div>
  );
}
