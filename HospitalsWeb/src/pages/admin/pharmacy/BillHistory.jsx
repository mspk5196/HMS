import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import { formatCurrency, formatDate } from './pharmacyUtils';
import { StatusBadge, Banner } from './PharmacyUI';
import HospitalReceipt from '../../../components/HospitalReceipt';

export default function BillHistory() {
  const [bills, setBills] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [viewingBill, setViewingBill] = useState(null);
  const [payingBill, setPayingBill] = useState(null);
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };

  const loadBills = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const qs = statusFilter === 'ALL' ? '' : `paymentStatus=${statusFilter}&`;
      const result = await apiFetch(`/pharmacy/bills?${qs}limit=100`, { withMeta: true });
      setBills(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load bills.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadBills(); }, [loadBills]);

  const viewBill = async (bill) => {
    try {
      const full = await apiFetch(`/pharmacy/bills/${bill.id}`);
      setViewingBill(full);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load bill.');
    }
  };

  const openPayment = (bill) => { setPayingBill(bill); setPaidAmountInput(String(bill.paid_amount)); };

  const submitPayment = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await apiFetch(`/pharmacy/bills/${payingBill.id}/payment`, {
        method: 'PATCH',
        body: JSON.stringify({ paid_amount: Number(paidAmountInput) || 0 }),
      });
      flash(`Payment recorded for ${payingBill.bill_number}.`);
      setPayingBill(null);
      await loadBills();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record payment.');
    } finally {
      setIsSaving(false);
    }
  };

  const closeBill = async (bill) => {
    if (!window.confirm(`Close ${bill.bill_number}? Any remaining balance will be written off from the open-orders list.`)) return;
    try {
      await apiFetch(`/pharmacy/bills/${bill.id}/close`, { method: 'POST' });
      flash(`${bill.bill_number} closed.`);
      await loadBills();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to close bill.');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Pharmacy &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Bill History</span>
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Every pharmacy bill generated for a patient, with payment status and receipts.</p>
      </div>
      {successMsg && <Banner>{successMsg}</Banner>}
      {errorMsg && <Banner tone="error">{errorMsg}</Banner>}

      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-2 overflow-x-auto">
        {['ALL', 'pending', 'partial', 'paid'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
              statusFilter === s ? 'bg-[#1e40af] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {s === 'ALL' ? 'All' : s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700 min-w-[850px]">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3.5">Bill #</th>
              <th className="p-3.5">Patient</th>
              <th className="p-3.5">Date</th>
              <th className="p-3.5">Net Amount</th>
              <th className="p-3.5">Balance</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">Loading…</td></tr>
            ) : bills.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">No bills yet.</td></tr>
            ) : bills.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50/80">
                <td className="p-3.5 font-bold text-blue-600">{b.bill_number}</td>
                <td className="p-3.5">{b.patient_name}<div className="text-[10px] text-gray-400">{b.patient_mobile}</div></td>
                <td className="p-3.5">{formatDate(b.bill_date)}</td>
                <td className="p-3.5 font-semibold">{formatCurrency(b.net_amount)}</td>
                <td className="p-3.5">{formatCurrency(b.balance_amount)}</td>
                <td className="p-3.5"><StatusBadge status={b.payment_status} /></td>
                <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => viewBill(b)} className="text-blue-600 hover:underline cursor-pointer font-semibold">Receipt</button>
                  {b.payment_status !== 'paid' && (
                    <>
                      <button onClick={() => openPayment(b)} className="text-emerald-600 hover:underline cursor-pointer font-semibold">Enter Paid</button>
                      {!b.closed_at && <button onClick={() => closeBill(b)} className="text-gray-600 hover:underline cursor-pointer font-semibold">Close</button>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewingBill && (
        <HospitalReceipt
          type="pharmacy"
          data={{
            pharmacy_bill_id: viewingBill.id,
            bill_number: viewingBill.bill_number,
            bill_date: viewingBill.bill_date,
            patient_name: viewingBill.patient_name,
            mobile_number: viewingBill.patient_mobile,
            net_amount: viewingBill.net_amount,
            amount_paid_now: viewingBill.paid_amount,
            balance_due: viewingBill.balance_amount,
            payment_mode: viewingBill.payment_mode || 'cash',
            items: viewingBill.items || [],
          }}
          onClose={() => setViewingBill(null)}
        />
      )}

      {payingBill && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-800">Enter Paid Amount — {payingBill.bill_number}</h3>
            <p className="text-[11px] text-gray-500">Net amount: <strong>{formatCurrency(payingBill.net_amount)}</strong></p>
            <form onSubmit={submitPayment} className="space-y-3">
              <input
                type="number" min="0" step="0.01" autoFocus
                value={paidAmountInput}
                onChange={(e) => setPaidAmountInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={() => setPayingBill(null)} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
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
