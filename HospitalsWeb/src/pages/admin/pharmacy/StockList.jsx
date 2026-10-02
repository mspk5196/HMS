import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import { hasPermission } from '../../../util/permissions';
import { formatCurrency, formatDate } from './pharmacyUtils';
import { Banner } from './PharmacyUI';
import PageHeader from '../../../components/PageHeader';
import MedicineForm from './MedicineForm';
import AddStockBatchForm from './AddStockBatchForm';

export default function StockList({ user }) {
  const [medicines, setMedicines] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showMedicineForm, setShowMedicineForm] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [stockTargetMedicine, setStockTargetMedicine] = useState(null);
  const [expandedMedicineId, setExpandedMedicineId] = useState(null);
  const [batchesByMedicine, setBatchesByMedicine] = useState({});

  const [deletingMedicine, setDeletingMedicine] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [stockFilter, setStockFilter] = useState('ALL'); // 'ALL' | 'LOW' | 'OUT'

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };

  const loadAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const [medResult, cats] = await Promise.all([
        apiFetch(`/pharmacy/medicines?search=${encodeURIComponent(search)}&limit=200`, { withMeta: true }),
        apiFetch('/pharmacy/medicines/categories'),
      ]);
      setMedicines(Array.isArray(medResult.data) ? medResult.data : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load stock.');
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleBatches = async (medicineId) => {
    if (expandedMedicineId === medicineId) { setExpandedMedicineId(null); return; }
    setExpandedMedicineId(medicineId);
    if (!batchesByMedicine[medicineId]) {
      try {
        const result = await apiFetch(`/pharmacy/stock?medicineId=${medicineId}&limit=100`, { withMeta: true });
        setBatchesByMedicine((prev) => ({ ...prev, [medicineId]: result.data || [] }));
      } catch (err) {
        setErrorMsg(err.message || 'Failed to load batches.');
      }
    }
  };

  const handleSaveMedicine = async (payload) => {
    if (editingMedicine) {
      await apiFetch(`/pharmacy/medicines/${editingMedicine.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      flash(`"${payload.name}" updated.`);
    } else {
      await apiFetch('/pharmacy/medicines', { method: 'POST', body: JSON.stringify(payload) });
      flash(`"${payload.name}" added to the medicine master.`);
    }
    setShowMedicineForm(false);
    setEditingMedicine(null);
    await loadAll();
  };

  const handleDeleteMedicine = async () => {
    if (!deletingMedicine) return;
    try {
      setIsDeleting(true);
      setErrorMsg('');
      await apiFetch(`/pharmacy/medicines/${deletingMedicine.id}`, { method: 'DELETE' });
      flash(`"${deletingMedicine.name}" removed from pharmacy stock.`);
      setDeletingMedicine(null);
      await loadAll();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete medicine.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateCategory = async (name) => {
    const { id } = await apiFetch('/pharmacy/medicines/categories', { method: 'POST', body: JSON.stringify({ name }) });
    const category = { id, name };
    setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
    return category;
  };

  const handleAddStock = async (payload) => {
    await apiFetch('/pharmacy/stock', { method: 'POST', body: JSON.stringify(payload) });
    flash('Stock batch added.');
    setStockTargetMedicine(null);
    setBatchesByMedicine((prev) => ({ ...prev, [payload.medicine_id]: undefined }));
    await loadAll();
  };

  const statusFor = (m) => {
    const stock = Number(m.total_stock || 0);
    if (stock <= 0) return { label: 'Out of Stock', tone: 'bg-rose-50 text-rose-600 border-rose-200' };
    if (stock <= Number(m.reorder_level || 0)) return { label: '⚠ Low Stock', tone: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'In Stock', tone: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
  };

  const lowStockCount = medicines.filter((m) => Number(m.total_stock || 0) > 0 && Number(m.total_stock || 0) <= Number(m.reorder_level || 0)).length;
  const outOfStockCount = medicines.filter((m) => Number(m.total_stock || 0) <= 0).length;

  const filteredMedicines = medicines.filter((m) => {
    const stock = Number(m.total_stock || 0);
    const reorder = Number(m.reorder_level || 0);
    if (stockFilter === 'LOW') return stock > 0 && stock <= reorder;
    if (stockFilter === 'OUT') return stock <= 0;
    return true;
  });

  if (showMedicineForm) {
    return (
      <MedicineForm
        categories={categories}
        initialData={editingMedicine}
        onCancel={() => { setShowMedicineForm(false); setEditingMedicine(null); }}
        onSubmit={handleSaveMedicine}
        onCreateCategory={handleCreateCategory}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        category="Pharmacy"
        title="Stock"
        subtitle="Medicine master, live stock levels and minimum-stock thresholds."
      />
      {successMsg && <Banner>{successMsg}</Banner>}
      {errorMsg && <Banner tone="error">{errorMsg}</Banner>}

      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medicine, generic name or barcode..."
              className="w-full pl-8 pr-3.5 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 placeholder-gray-300"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStockFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                stockFilter === 'ALL' ? 'bg-[#1e40af] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({medicines.length})
            </button>
            <button
              onClick={() => setStockFilter('LOW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                stockFilter === 'LOW'
                  ? 'bg-amber-600 text-white'
                  : lowStockCount > 0
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>⚠ Low Stock</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${stockFilter === 'LOW' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'}`}>
                {lowStockCount}
              </span>
            </button>
            <button
              onClick={() => setStockFilter('OUT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                stockFilter === 'OUT'
                  ? 'bg-rose-600 text-white'
                  : outOfStockCount > 0
                  ? 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>Out of Stock</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${stockFilter === 'OUT' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-900'}`}>
                {outOfStockCount}
              </span>
            </button>
          </div>
        </div>

        {hasPermission(user, 'pharmacy.create') && (
          <button
            onClick={() => { setEditingMedicine(null); setShowMedicineForm(true); }}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer whitespace-nowrap"
          >
            + Add Medicine
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700 min-w-[900px]">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3.5">Medicine</th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Form / Strength</th>
              <th className="p-3.5">Stock</th>
              <th className="p-3.5">Reorder Threshold</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">Loading…</td></tr>
            ) : filteredMedicines.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">No medicines match the selected filter.</td></tr>
            ) : filteredMedicines.map((m) => {
              const status = statusFor(m);
              const isExpanded = expandedMedicineId === m.id;
              return (
                <React.Fragment key={m.id}>
                  <tr className="hover:bg-gray-50/80">
                    <td className="p-3.5">
                      <div className="font-bold text-gray-900">{m.name}</div>
                      {m.generic_name && <div className="text-[11px] text-gray-400">{m.generic_name}</div>}
                    </td>
                    <td className="p-3.5">{m.category_name || '—'}</td>
                    <td className="p-3.5">{[m.form, m.strength].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="p-3.5 font-semibold">{m.total_stock} {m.unit || ''}</td>
                    <td className="p-3.5">{m.reorder_level}</td>
                    <td className="p-3.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.tone}`}>{status.label}</span></td>
                    <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => toggleBatches(m.id)} className="text-blue-600 hover:underline cursor-pointer font-semibold">
                        {isExpanded ? 'Hide Batches' : 'Batches'}
                      </button>
                      {hasPermission(user, 'pharmacy.create') && (
                        <button onClick={() => setStockTargetMedicine(m)} className="text-emerald-600 hover:underline cursor-pointer font-semibold">
                          Add Stock
                        </button>
                      )}
                      {hasPermission(user, 'pharmacy.edit') && (
                        <button onClick={() => { setEditingMedicine(m); setShowMedicineForm(true); }} className="text-gray-500 hover:underline cursor-pointer font-semibold">
                          Edit
                        </button>
                      )}
                      {hasPermission(user, 'pharmacy.delete') && (
                        <button onClick={() => setDeletingMedicine(m)} className="text-rose-600 hover:underline cursor-pointer font-semibold">
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50/60 p-3.5">
                        {!batchesByMedicine[m.id] ? (
                          <div className="text-gray-400 text-center py-3">Loading batches…</div>
                        ) : batchesByMedicine[m.id].length === 0 ? (
                          <div className="text-gray-400 text-center py-3">No batches recorded yet.</div>
                        ) : (
                          <table className="w-full text-[11px]">
                            <thead className="text-gray-400 uppercase">
                              <tr>
                                <th className="text-left py-1.5">Batch #</th>
                                <th className="text-left py-1.5">Expiry</th>
                                <th className="text-left py-1.5">Qty in Stock</th>
                                <th className="text-left py-1.5">Purchase Price</th>
                                <th className="text-left py-1.5">Selling Price</th>
                                <th className="text-left py-1.5">Received</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {batchesByMedicine[m.id].map((b) => (
                                <tr key={b.id}>
                                  <td className="py-1.5 font-semibold">{b.batch_number}</td>
                                  <td className="py-1.5">{formatDate(b.expiry_date)}</td>
                                  <td className="py-1.5">{b.qty_in_stock}</td>
                                  <td className="py-1.5">{formatCurrency(b.purchase_price)}</td>
                                  <td className="py-1.5">{formatCurrency(b.selling_price)}</td>
                                  <td className="py-1.5">{formatDate(b.received_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {stockTargetMedicine && (
        <AddStockBatchForm
          medicine={stockTargetMedicine}
          onCancel={() => setStockTargetMedicine(null)}
          onSubmit={handleAddStock}
        />
      )}

      {deletingMedicine && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-gray-100">
            <h3 className="text-base font-bold text-gray-900">Delete Medicine</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-gray-900">"{deletingMedicine.name}"</span> from pharmacy stock?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingMedicine(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMedicine}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete Medicine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
