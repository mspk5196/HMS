import React from 'react';

export default function Payroll() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400 font-medium mb-1">
            Staff & Salary &nbsp;&gt;&nbsp; <span className="text-gray-700 font-semibold">Payroll</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Payroll & Salary Processing</h1>
          <p className="text-xs text-gray-500 mt-0.5">Generate monthly payslips, PF contributions, and bank export files.</p>
        </div>
        <button className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer">
          Generate Monthly Payroll
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">July 2026 Payroll Summary</h2>
            <div className="text-xs text-gray-500 mt-0.5">Total Salary Outflow: ₹17.2L</div>
          </div>
          <span className="text-xs text-blue-600 bg-blue-50 font-semibold px-3 py-1 rounded-full">
            Processing Stage
          </span>
        </div>
      </div>
    </div>
  );
}
