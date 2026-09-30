import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import { hasPermission } from '../../../util/permissions';
import { formatCurrency, formatDate } from './pharmacyUtils';
import { StatusBadge, Banner } from './PharmacyUI';
import PageHeader from '../../../components/PageHeader';
import ReceiveGoodsForm from './ReceiveGoodsForm';

export default function GoodsReceipts({ user }) {
  const [receipts, setReceipts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [payingGrn, setPayingGrn] = useState(null);
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };

  const loadReceipts = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const result = await apiFetch('/pharmacy/goods-receipts?limit=100', { withMeta: true });
      setReceipts(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load goods receipts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadReceipts(); }, [loadReceipts]);

  const handleCreate = async (payload) => {
    const grn = await apiFetch('/pharmacy/goods-receipts', { method: 'POST', body: JSON.stringify(payload) });
    flash(`${grn.grn_number} recorded — stock updated.`);
    setShowCreate(false);
    await loadReceipts();
  };

  const openPayment = (grn) => { setPayingGrn(grn); setPaidAmountInput(String(grn.paid_amount)); };

  const submitPayment = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await apiFetch(`/pharmacy/goods-receipts/${payingGrn.id}/payment`, {
        method: 'PATCH',
        body: JSON.stringify({ paid_amount: Number(paidAmountInput) || 0 }),
      });
      flash(`Payment recorded for ${payingGrn.grn_number}.`);
      setPayingGrn(null);
      await loadReceipts();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record payment.');
    } finally {
      setIsSaving(false);
    }
  };

  const closeOrder = async (grn) => {
    if (!window.confirm(`Save and close ${grn.grn_number}? This locks the goods receipt.`)) return;
    try {
      await apiFetch(`/pharmacy/goods-receipts/${grn.id}/close`, { method: 'POST' });
      flash(`${grn.grn_number} closed.`);
      await loadReceipts();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to close goods receipt.');
    }
  };

  if (showCreate) {
    return <ReceiveGoodsForm onCancel={() => setShowCreate(false)} onSubmit={handleCreate} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        category="Pharmacy"
        title="Goods Receipt (GRN)"
        subtitle="Stock received against a supplier's bill — this is what updates the stock on hand."
        actions={
          (!user || hasPermission(user, 'pharmacy.receive_goods_grn') || hasPermission(user, 'pharmacy.create')) ? (
            <button onClick={() => setShowCreate(true)} className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer">
              + Receive Stock
            </button>
          ) : null
        }
      />
      {successMsg && <Banner>{successMsg}</Banner>}
      {errorMsg && <Banner tone="error">{errorMsg}</Banner>}

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700 min-w-[950px]">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3.5">GRN #</th>
              <th className="p-3.5">Supplier</th>
              <th className="p-3.5">Supplier Bill #</th>
              <th className="p-3.5">Received</th>
              <th className="p-3.5">Total</th>
              <th className="p-3.5">Paid</th>
              <th className="p-3.5">Payment</th>
              <th className="p-3.5">Order</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={9} className="p-8 text-center text-gray-400">Loading…</td></tr>
            ) : receipts.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-gray-400">No stock received yet.</td></tr>
            ) : receipts.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50/80">
                <td className="p-3.5 font-bold text-blue-600">{g.grn_number}{g.po_number && <div className="text-[10px] font-normal text-gray-400">against {g.po_number}</div>}</td>
                <td className="p-3.5">{g.supplier_name}</td>
                <td className="p-3.5">{g.supplier_bill_number}<div className="text-[10px] text-gray-400">{formatDate(g.supplier_bill_date)}</div></td>
                <td className="p-3.5">{formatDate(g.received_date)}</td>
                <td className="p-3.5 font-semibold">{formatCurrency(g.total_amount)}</td>
                <td className="p-3.5">{formatCurrency(g.paid_amount)}</td>
                <td className="p-3.5"><StatusBadge status={g.payment_status} /></td>
                <td className="p-3.5"><StatusBadge status={g.status} /></td>
                <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                  {g.status === 'open' && (!user || hasPermission(user, 'pharmacy.receive_goods_grn') || hasPermission(user, 'pharmacy.edit')) && (
                    <>
                      <button onClick={() => openPayment(g)} className="text-emerald-600 hover:underline cursor-pointer font-semibold">Enter Paid Amount</button>
                      <button onClick={() => closeOrder(g)} className="text-gray-600 hover:underline cursor-pointer font-semibold">Save &amp; Close</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payingGrn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-800">Enter Paid Amount — {payingGrn.grn_number}</h3>
            <p className="text-[11px] text-gray-500">Bill total: <strong>{formatCurrency(payingGrn.total_amount)}</strong></p>
            <form onSubmit={submitPayment} className="space-y-3">
              <input
                type="number" min="0" step="0.01" autoFocus
                value={paidAmountInput}
                onChange={(e) => setPaidAmountInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={() => setPayingGrn(null)} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSaving} className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
                  {isSaving ? 'Saving…' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
