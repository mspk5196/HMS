import React from 'react';

export default function Discharge() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Patient & Hospital &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Discharge</span>
        </h1>
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
