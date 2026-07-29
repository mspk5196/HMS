import React, { useState } from 'react';

export default function AddStockBatchForm({ medicine, onCancel, onSubmit }) {
  const [values, setValues] = useState({
    batch_number: '', expiry_date: '', qty_in_stock: '', purchase_price: '', selling_price: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!values.batch_number || !values.expiry_date || !values.qty_in_stock) {
      setErrorMsg('Batch number, expiry date and quantity are required.');
      return;
    }
    try {
      setIsSaving(true);
      setErrorMsg('');
      await onSubmit({
        medicine_id: medicine.id,
        batch_number: values.batch_number,
        expiry_date: values.expiry_date,
        qty_in_stock: Number(values.qty_in_stock),
        purchase_price: Number(values.purchase_price) || 0,
        selling_price: Number(values.selling_price) || 0,
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add stock batch.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Add Stock — {medicine.name}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Manual / opening-stock entry for this medicine.</p>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-3 py-2 rounded-lg">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Batch Number *">
            <input value={values.batch_number} onChange={set('batch_number')} className={inputCls} />
          </Field>
          <Field label="Expiry Date *">
            <input type="date" value={values.expiry_date} onChange={set('expiry_date')} className={inputCls} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Quantity *">
              <input type="number" min="1" value={values.qty_in_stock} onChange={set('qty_in_stock')} className={inputCls} />
            </Field>
            <Field label="Purchase Price">
              <input type="number" min="0" step="0.01" value={values.purchase_price} onChange={set('purchase_price')} className={inputCls} />
            </Field>
            <Field label="Selling Price">
              <input type="number" min="0" step="0.01" value={values.selling_price} onChange={set('selling_price')} className={inputCls} />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
              {isSaving ? 'Saving…' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
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
