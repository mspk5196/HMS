import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../util/api';
import { todayISO } from './pharmacyUtils';

const emptyItem = { medicine_id: '', purchase_order_item_id: null, batch_number: '', expiry_date: '', qty_received: '', purchase_price: '', selling_price: '' };

export default function ReceiveGoodsForm({ onCancel, onSubmit }) {
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [openOrders, setOpenOrders] = useState([]);
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [supplierBillNumber, setSupplierBillNumber] = useState('');
  const [supplierBillDate, setSupplierBillDate] = useState(todayISO());
  const [receivedDate, setReceivedDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);
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

  useEffect(() => {
    setPurchaseOrderId('');
    setOpenOrders([]);
    if (!supplierId) return;
    (async () => {
      try {
        const result = await apiFetch(`/pharmacy/purchase-orders?supplierId=${supplierId}&limit=100`, { withMeta: true });
        const rows = (result.data || []).filter((o) => o.status === 'placed' || o.status === 'partially_received');
        setOpenOrders(rows);
      } catch (err) {
        setErrorMsg(err.message || 'Failed to load purchase orders for this supplier.');
      }
    })();
  }, [supplierId]);

  const loadOrderItems = async (poId) => {
    setPurchaseOrderId(poId);
    if (!poId) { setItems([{ ...emptyItem }]); return; }
    try {
      const po = await apiFetch(`/pharmacy/purchase-orders/${poId}`);
      const outstanding = po.items.filter((it) => it.received_qty < it.ordered_qty);
      setItems(outstanding.length ? outstanding.map((it) => ({
        medicine_id: String(it.medicine_id),
        purchase_order_item_id: it.id,
        batch_number: '',
        expiry_date: '',
        qty_received: String(it.ordered_qty - it.received_qty),
        purchase_price: String(it.estimated_price ?? ''),
        selling_price: '',
      })) : [{ ...emptyItem }]);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load purchase order items.');
    }
  };

  const updateItem = (idx, key, value) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  const addItemRow = () => setItems((prev) => [...prev, { ...emptyItem }]);
  const removeItemRow = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanItems = items.filter((it) => it.medicine_id && it.batch_number && it.expiry_date && it.qty_received);
    if (!supplierId || !supplierBillNumber || !supplierBillDate || !receivedDate) {
      setErrorMsg('Supplier, supplier bill number, bill date and received date are required.');
      return;
    }
    if (!cleanItems.length) { setErrorMsg('Add at least one item with a batch number, expiry date and quantity.'); return; }

    try {
      setIsSaving(true);
      setErrorMsg('');
      await onSubmit({
        purchase_order_id: purchaseOrderId ? Number(purchaseOrderId) : null,
        supplier_id: Number(supplierId),
        supplier_bill_number: supplierBillNumber,
        supplier_bill_date: supplierBillDate,
        received_date: receivedDate,
        notes: notes || null,
        items: cleanItems.map((it) => ({
          medicine_id: Number(it.medicine_id),
          purchase_order_item_id: it.purchase_order_item_id ?? null,
          batch_number: it.batch_number,
          expiry_date: it.expiry_date,
          qty_received: Number(it.qty_received),
          purchase_price: Number(it.purchase_price) || 0,
          selling_price: Number(it.selling_price) || 0,
        })),
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record goods receipt.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Receive Stock (Goods Receipt)</h2>
        <p className="text-xs text-gray-500 mt-0.5">Enter the supplier's bill for the delivery — this is what puts the stock into the pharmacy.</p>
      </div>

      {errorMsg && <div className="bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl">{errorMsg}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Supplier *">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">Select supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Against Purchase Order" hint="Optional — pick one to auto-fill items and close it off.">
            <select value={purchaseOrderId} onChange={(e) => loadOrderItems(e.target.value)} disabled={!supplierId} className={inputCls}>
              <option value="">No PO / direct receipt</option>
              {openOrders.map((o) => <option key={o.id} value={o.id}>{o.po_number} ({o.total_received_qty}/{o.total_ordered_qty} received)</option>)}
            </select>
          </Field>
          <Field label="Supplier Bill Number *" hint="The invoice number printed on the supplier's bill.">
            <input value={supplierBillNumber} onChange={(e) => setSupplierBillNumber(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Supplier Bill Date *">
            <input type="date" value={supplierBillDate} onChange={(e) => setSupplierBillDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Received Date *">
            <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Items Received</span>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={it.medicine_id}
                  onChange={(e) => updateItem(idx, 'medicine_id', e.target.value)}
                  disabled={!!it.purchase_order_item_id}
                  className={`${inputCls} col-span-3`}
                >
                  <option value="">Medicine…</option>
                  {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <input placeholder="Batch #" value={it.batch_number} onChange={(e) => updateItem(idx, 'batch_number', e.target.value)} className={`${inputCls} col-span-2`} />
                <input type="date" value={it.expiry_date} onChange={(e) => updateItem(idx, 'expiry_date', e.target.value)} className={`${inputCls} col-span-2`} />
                <input type="number" min="1" placeholder="Qty" value={it.qty_received} onChange={(e) => updateItem(idx, 'qty_received', e.target.value)} className={`${inputCls} col-span-1`} />
                <input type="number" min="0" step="0.01" placeholder="Purch. ₹" value={it.purchase_price} onChange={(e) => updateItem(idx, 'purchase_price', e.target.value)} className={`${inputCls} col-span-2`} />
                <input type="number" min="0" step="0.01" placeholder="Sell ₹" value={it.selling_price} onChange={(e) => updateItem(idx, 'selling_price', e.target.value)} className={`${inputCls} col-span-1`} />
                <button type="button" onClick={() => removeItemRow(idx)} disabled={items.length === 1} className="text-rose-500 hover:text-rose-700 disabled:opacity-30 cursor-pointer col-span-1">
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
            {isSaving ? 'Recording…' : 'Record Receipt & Update Stock'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-gray-100 disabled:text-gray-500';

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-gray-400">{hint}</span>}
    </label>
  );
}
