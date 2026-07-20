import React from 'react';

export default function Leave() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Staff & Salary &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Leave</span>
        </h1>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-900">Pending Leave Requests (3)</h2>
        <div className="space-y-3">
          <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-gray-900">Kavitha S.</span> — <span className="text-gray-500">Casual Leave (2 Days)</span>
              <div className="text-[11px] text-gray-400 mt-0.5">Reason: Personal emergency</div>
            </div>
            <div className="flex gap-2">
              <button className="bg-emerald-600 text-white px-3 py-1 rounded text-[11px] font-semibold cursor-pointer">Approve</button>
              <button className="bg-rose-600 text-white px-3 py-1 rounded text-[11px] font-semibold cursor-pointer">Reject</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
