import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import { Banner } from './PharmacyUI';
import PageHeader from '../../../components/PageHeader';

const emptyForm = { name: '', contact_person: '', phone: '', email: '', address: '', gstin: '' };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };

  const loadSuppliers = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const rows = await apiFetch(`/pharmacy/suppliers?search=${encodeURIComponent(search)}`);
      setSuppliers(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load suppliers.');
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', address: s.address || '', gstin: s.gstin || '' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setErrorMsg('Supplier name is required.'); return; }
    try {
      setIsSaving(true);
      setErrorMsg('');
      if (editing) {
        await apiFetch(`/pharmacy/suppliers/${editing.id}`, { method: 'PATCH', body: JSON.stringify(form) });
        flash(`"${form.name}" updated.`);
      } else {
        await apiFetch('/pharmacy/suppliers', { method: 'POST', body: JSON.stringify(form) });
        flash(`"${form.name}" added.`);
      }
      setShowForm(false);
      await loadSuppliers();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save supplier.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (s) => {
    try {
      await apiFetch(`/pharmacy/suppliers/${s.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: s.is_active ? 0 : 1 }) });
      flash(`"${s.name}" marked ${s.is_active ? 'inactive' : 'active'}.`);
      await loadSuppliers();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update supplier.');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        category="Pharmacy"
        title="Suppliers"
        subtitle="Vendors the pharmacy orders stock from."
        actions={
          <button onClick={openCreate} className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer whitespace-nowrap">
            + Add Supplier
          </button>
        }
      />
      {successMsg && <Banner>{successMsg}</Banner>}
      {errorMsg && <Banner tone="error">{errorMsg}</Banner>}

      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplier name, phone or GSTIN..."
          className="w-full sm:w-72 px-3.5 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 placeholder-gray-300"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700 min-w-[800px]">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3.5">Supplier</th>
              <th className="p-3.5">Contact</th>
              <th className="p-3.5">Phone</th>
              <th className="p-3.5">GSTIN</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading…</td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">No suppliers yet.</td></tr>
            ) : suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50/80">
                <td className="p-3.5 font-bold text-gray-900">{s.name}<div className="text-[11px] font-normal text-gray-400">{s.address}</div></td>
                <td className="p-3.5">{s.contact_person || '—'}</td>
                <td className="p-3.5">{s.phone || '—'}</td>
                <td className="p-3.5">{s.gstin || '—'}</td>
                <td className="p-3.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => openEdit(s)} className="text-blue-600 hover:underline cursor-pointer font-semibold">Edit</button>
                  <button onClick={() => toggleActive(s)} className="text-gray-500 hover:underline cursor-pointer font-semibold">
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-800">{editing ? 'Edit Supplier' : 'Add Supplier'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="Name *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
              <Field label="Contact Person"><input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Field>
                <Field label="Email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
              </div>
              <Field label="Address"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} /></Field>
              <Field label="GSTIN"><input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} className={inputCls} /></Field>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSaving} className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
                  {isSaving ? 'Saving…' : editing ? 'Save Changes' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
