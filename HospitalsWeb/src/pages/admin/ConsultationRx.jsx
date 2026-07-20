import React from 'react';

export default function ConsultationRx() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Patient & Hospital &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Consultation & Rx</span>
        </h1>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-900">Active Consultation: Token #01 — Anitha R.</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">Chief Complaints</label>
            <textarea className="w-full p-2.5 border border-gray-200 rounded-lg text-xs" rows="3" defaultValue="Fever for 2 days, mild cough and fatigue."></textarea>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">Prescribed Medicines</label>
            <textarea className="w-full p-2.5 border border-gray-200 rounded-lg text-xs" rows="3" defaultValue="1. Paracetamol 650mg - 1-0-1 (3 Days)&#10;2. Vitamin C 500mg - 0-1-0 (5 Days)"></textarea>
          </div>
        </div>
      </div>
    </div>
  );
}
