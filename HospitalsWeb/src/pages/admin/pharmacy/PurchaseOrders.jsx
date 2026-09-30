import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import { hasPermission } from '../../../util/permissions';
import { formatDate } from './pharmacyUtils';
import { StatusBadge, Banner } from './PharmacyUI';
import PageHeader from '../../../components/PageHeader';
import CreatePurchaseOrderForm from './CreatePurchaseOrderForm';

export default function PurchaseOrders({ user }) {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const qs = statusFilter === 'ALL' ? '' : `status=${statusFilter}&`;
      const result = await apiFetch(`/pharmacy/purchase-orders?${qs}limit=100`, { withMeta: true });
      setOrders(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load purchase orders.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleCreate = async (payload) => {
    await apiFetch('/pharmacy/purchase-orders', { method: 'POST', body: JSON.stringify(payload) });
    flash('Purchase order placed.');
    setShowCreate(false);
    await loadOrders();
  };

  const handleCancel = async (order) => {
    if (!window.confirm(`Cancel purchase order ${order.po_number}?`)) return;
    try {
      await apiFetch(`/pharmacy/purchase-orders/${order.id}/cancel`, { method: 'POST' });
      flash(`${order.po_number} cancelled.`);
      await loadOrders();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to cancel purchase order.');
    }
  };

  const viewDetails = async (order) => {
    try {
      const full = await apiFetch(`/pharmacy/purchase-orders/${order.id}`);
      setViewingOrder(full);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load purchase order.');
    }
  };

  if (showCreate) {
    return <CreatePurchaseOrderForm onCancel={() => setShowCreate(false)} onSubmit={handleCreate} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        category="Pharmacy"
        title="Purchase Orders"
        subtitle="Items ordered from suppliers, waiting to be received."
      />
      {successMsg && <Banner>{successMsg}</Banner>}
      {errorMsg && <Banner tone="error">{errorMsg}</Banner>}

      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'placed', 'partially_received', 'received', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                statusFilter === s ? 'bg-[#1e40af] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {s === 'ALL' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        {(!user || hasPermission(user, 'pharmacy.create_purchase_order') || hasPermission(user, 'pharmacy.create')) && (
          <button onClick={() => setShowCreate(true)} className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer whitespace-nowrap">
            + Place Order
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700 min-w-[800px]">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3.5">PO Number</th>
              <th className="p-3.5">Supplier</th>
              <th className="p-3.5">Order Date</th>
              <th className="p-3.5">Ordered / Received</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">No purchase orders yet.</td></tr>
            ) : orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50/80">
                <td className="p-3.5 font-bold text-blue-600">{o.po_number}</td>
                <td className="p-3.5">{o.supplier_name}</td>
                <td className="p-3.5">{formatDate(o.order_date)}</td>
                <td className="p-3.5">{o.total_received_qty} / {o.total_ordered_qty}</td>
                <td className="p-3.5"><StatusBadge status={o.status} /></td>
                <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => viewDetails(o)} className="text-blue-600 hover:underline cursor-pointer font-semibold">View</button>
                  {(o.status === 'placed' || o.status === 'partially_received') && (!user || hasPermission(user, 'pharmacy.delete') || hasPermission(user, 'pharmacy.edit')) && (
                    <button onClick={() => handleCancel(o)} className="text-rose-600 hover:underline cursor-pointer font-semibold">Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewingOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">{viewingOrder.po_number} — {viewingOrder.supplier_name}</h3>
              <StatusBadge status={viewingOrder.status} />
            </div>
            <div className="text-[11px] text-gray-500 grid grid-cols-2 gap-2">
              <div>Order Date: <strong className="text-gray-800">{formatDate(viewingOrder.order_date)}</strong></div>
              <div>Expected: <strong className="text-gray-800">{formatDate(viewingOrder.expected_date)}</strong></div>
            </div>
            {viewingOrder.notes && <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">{viewingOrder.notes}</p>}
            <table className="w-full text-xs">
              <thead className="text-[10px] text-gray-400 uppercase border-b border-gray-100">
                <tr><th className="text-left py-2">Medicine</th><th className="text-left py-2">Ordered</th><th className="text-left py-2">Received</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {viewingOrder.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2 font-semibold">{it.medicine_name}</td>
                    <td className="py-2">{it.ordered_qty}</td>
                    <td className="py-2">{it.received_qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end pt-2">
              <button onClick={() => setViewingOrder(null)} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
