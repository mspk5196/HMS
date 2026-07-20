import React from 'react';

export default function Discharge() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-gray-400 font-medium mb-1">
          Patient & Hospital &nbsp;&gt;&nbsp; <span className="text-gray-700 font-semibold">Discharge</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Patient Discharge & Settlement</h1>
        <p className="text-xs text-gray-500 mt-0.5">Final IPD bill clearance, summary report generation, and bed checkout.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-900">Pending Discharge Requests (1)</h2>
        <div className="p-4 bg-gray-50 rounded-lg flex justify-between items-center text-xs">
          <div>
            <div className="font-bold text-gray-900">Saraswathi M. (PAT-1023)</div>
            <div className="text-gray-500 mt-0.5">Ward: General Ward (Female) Bed #04</div>
          </div>
          <button className="bg-[#1e40af] text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">
            Process Discharge Bill
          </button>
        </div>
      </div>
    </div>
  );
}
