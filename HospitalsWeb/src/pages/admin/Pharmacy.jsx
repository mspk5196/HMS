import React from 'react';

export default function Pharmacy() {
  const stock = [
    { code: 'MED-001', name: 'Paracetamol 650mg', category: 'Analgesics', qty: 1450, unitPrice: '₹2.50', status: 'In Stock' },
    { code: 'MED-002', name: 'Amoxicillin 500mg', category: 'Antibiotics', qty: 120, unitPrice: '₹8.00', status: 'Low Stock' },
    { code: 'MED-003', name: 'Pantoprazole 40mg', category: 'Antacids', qty: 890, unitPrice: '₹6.50', status: 'In Stock' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400 font-medium mb-1">
            Patient & Hospital &nbsp;&gt;&nbsp; <span className="text-gray-700 font-semibold">Pharmacy</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Pharmacy & Medicine Stock</h1>
          <p className="text-xs text-gray-500 mt-0.5">Inventory management, batch tracking, and dispensing POS.</p>
        </div>
        <button className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer">
          + Add Stock Batch
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3.5">Code</th>
              <th className="p-3.5">Medicine Name</th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Qty in Stock</th>
              <th className="p-3.5">Unit Price</th>
              <th className="p-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stock.map((s) => (
              <tr key={s.code} className="hover:bg-gray-50/80">
                <td className="p-3.5 font-bold text-blue-600">{s.code}</td>
                <td className="p-3.5 font-bold text-gray-900">{s.name}</td>
                <td className="p-3.5">{s.category}</td>
                <td className="p-3.5 font-semibold">{s.qty} Units</td>
                <td className="p-3.5">{s.unitPrice}</td>
                <td className="p-3.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    s.status === 'In Stock' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
