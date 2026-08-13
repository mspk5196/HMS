import React, { useState, useEffect } from 'react';
import MedicineSearchSelect from '../../../components/MedicineSearchSelect';
import { apiFetch } from '../../../util/api';
import { todayISO } from './pharmacyUtils';

export default function CreatePurchaseOrderForm({ onCancel, onSubmit }) {
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(todayISO());
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ medicine_id: '', ordered_qty: '', estimated_price: '' }]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [supplierRows, medResult] = await Promise.all([
          apiFetch('/pharmacy/suppliers?activeOnly=1'),
          apiFetch('/pharmacy/medicines?limit=500', { withMeta: true }),
        ]);
        setSuppliers(Array.isArray(supplierRows) ? supplierRows : []);
        setMedicines(Array.isArray(medResult.data) ? medResult.data : []);
      } catch (err) {
        setErrorMsg(err.message || 'Failed to load suppliers/medicines.');
      }
    })();
  }, []);

  const updateItem = (idx, key, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  };
  const addItemRow = () => setItems((prev) => [...prev, { medicine_id: '', ordered_qty: '', estimated_price: '' }]);
  const removeItemRow = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanItems = items.filter((it) => it.medicine_id && it.ordered_qty);
    if (!supplierId || !orderDate) { setErrorMsg('Supplier and order date are required.'); return; }
    if (!cleanItems.length) { setErrorMsg('Add at least one item to order.'); return; }

    try {
      setIsSaving(true);
      setErrorMsg('');
      await onSubmit({
        supplier_id: Number(supplierId),
        order_date: orderDate,
        expected_date: expectedDate || null,
        notes: notes || null,
        items: cleanItems.map((it) => ({
          medicine_id: Number(it.medicine_id),
          ordered_qty: Number(it.ordered_qty),
          estimated_price: Number(it.estimated_price) || 0,
        })),
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to place purchase order.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Place Purchase Order</h2>
        <p className="text-xs text-gray-500 mt-0.5">List the items to order from a supplier, then send it out for goods receipt once it arrives.</p>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl">{errorMsg}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Supplier *">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">Select supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Order Date *">
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Expected Delivery">
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Items to Order</span>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <MedicineSearchSelect
                  value={it.medicine_id}
                  onChange={(id) => updateItem(idx, 'medicine_id', id)}
                  medicines={medicines}
                  className="flex-1"
                  compact
                />
                <input type="number" min="1" placeholder="Qty" value={it.ordered_qty} onChange={(e) => updateItem(idx, 'ordered_qty', e.target.value)} className={`${inputCls} w-24`} />
                <input type="number" min="0" step="0.01" placeholder="Est. Price" value={it.estimated_price} onChange={(e) => updateItem(idx, 'estimated_price', e.target.value)} className={`${inputCls} w-28`} />
                <button type="button" onClick={() => removeItemRow(idx)} disabled={items.length === 1} className="text-rose-500 hover:text-rose-700 disabled:opacity-30 cursor-pointer p-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItemRow} className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">+ Add another item</button>
        </div>

        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </Field>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
          <button type="submit" disabled={isSaving} className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
            {isSaving ? 'Placing…' : 'Place Order'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600';

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
