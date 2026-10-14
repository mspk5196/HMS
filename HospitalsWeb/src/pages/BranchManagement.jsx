import React, { useState, useEffect } from 'react';
import { apiFetch } from '../util/api';
import PageHeader from '../components/PageHeader';

export default function BranchManagement({ user }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Active branch from localStorage
  const [activeBranchId, setActiveBranchId] = useState(() => {
    return Number(localStorage.getItem('active_branch_id')) || 1;
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
  });

  const fetchBranches = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/branches');
      setBranches(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load hospital branches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleOpenAdd = () => {
    setEditingBranch(null);
    setFormData({ name: '', code: '', address: '', phone: '', email: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    try {
      if (editingBranch) {
        await apiFetch(`/branches/${editingBranch.id}`, {
          method: 'PUT',
          body: formData,
        });
        setSuccessMsg(`Branch "${formData.name}" updated successfully.`);
      } else {
        await apiFetch('/branches', {
          method: 'POST',
          body: formData,
        });
        setSuccessMsg(`Branch "${formData.name}" created successfully.`);
      }
      setShowModal(false);
      fetchBranches();
    } catch (err) {
      setError(err.message || 'Error saving branch details');
    }
  };

  const handleSwitchBranch = (branch) => {
    localStorage.setItem('active_branch_id', String(branch.id));
    localStorage.setItem('active_branch_name', branch.name);
    setActiveBranchId(branch.id);
    setSuccessMsg(`Switched active operational facility to: ${branch.name}`);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Hospital Branches & Facilities"
        subtitle="Manage multi-facility hospital locations, operational domains, and edge biometric gateway mapping."
      >
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-sm transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add New Facility
        </button>
      </PageHeader>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold ml-4">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="font-bold ml-4">✕</button>
        </div>
      )}

      {/* Active Branch Notice */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-teal-50 to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border border-sky-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
            🏢
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Active Operational Branch</div>
            <div className="text-base font-bold text-slate-900 dark:text-white">
              {branches.find((b) => b.id === activeBranchId)?.name || 'Default Primary Facility'}
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          All biometric sync, payroll runs, and department rosters resolve to your selected branch.
        </div>
      </div>

      {/* Facility Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading hospital branches...</div>
      ) : branches.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500">No facilities found. Click "Add New Facility" to register a branch.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => {
            const isActive = branch.id === activeBranchId;
            return (
              <div
                key={branch.id}
                className={`relative rounded-2xl p-6 transition-all border flex flex-col justify-between ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 border-emerald-500 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-semibold uppercase mb-1">
                        CODE: {branch.code}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                        {branch.name}
                      </h3>
                    </div>

                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800">
                        {branch.is_active ? 'Available' : 'Inactive'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 mb-6">
                    {branch.address && (
                      <div className="flex items-start gap-2">
                        <span className="text-slate-400 shrink-0">📍</span>
                        <span>{branch.address}</span>
                      </div>
                    )}
                    {branch.phone && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 shrink-0">📞</span>
                        <span>{branch.phone}</span>
                      </div>
                    )}
                    {branch.email && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 shrink-0">✉️</span>
                        <span>{branch.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenEdit(branch)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Edit Details
                  </button>

                  {!isActive && (
                    <button
                      onClick={() => handleSwitchBranch(branch)}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs"
                    >
                      Switch to This Branch
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Branch Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingBranch ? `Edit Facility: ${editingBranch.name}` : 'Register New Hospital Facility'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Facility / Branch Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Neha Hospitals - Coimbatore Branch"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Branch Short Code * (Unique)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CBE, ERD, CHN"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-sm font-mono uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Address
                </label>
                <textarea
                  rows="2"
                  placeholder="Hospital campus, street, city..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="branch@nehahospitals.in"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
                >
                  {editingBranch ? 'Update Facility' : 'Create Facility'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
