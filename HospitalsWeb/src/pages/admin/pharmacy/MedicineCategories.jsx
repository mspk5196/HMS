import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import { Banner } from './PharmacyUI';
import PageHeader from '../../../components/PageHeader';
import { XIcon, AlertTriangleIcon } from '../../../components/Icons';

export default function MedicineCategories() {
  const [activeTab, setActiveTab] = useState('categories'); // 'categories' | 'form-factors'
  const [categories, setCategories] = useState([]);
  const [formFactors, setFormFactors] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Category Modal states
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [deletingCat, setDeletingCat] = useState(null);
  const [catName, setCatName] = useState('');

  // Form Factor Modal states
  const [showFfModal, setShowFfModal] = useState(false);
  const [editingFf, setEditingFf] = useState(null);
  const [deletingFf, setDeletingFf] = useState(null);
  const [ffName, setFfName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const [cats, ffs] = await Promise.all([
        apiFetch('/pharmacy/medicines/categories'),
        apiFetch('/pharmacy/medicines/form-factors'),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setFormFactors(Array.isArray(ffs) ? ffs : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load master data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Category actions
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) { setErrorMsg('Category name cannot be empty.'); return; }
    try {
      setIsSubmitting(true);
      setErrorMsg('');
      if (editingCat) {
        await apiFetch(`/pharmacy/medicines/categories/${editingCat.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: catName.trim() }),
        });
        flash(`Category "${catName.trim()}" updated successfully.`);
      } else {
        await apiFetch('/pharmacy/medicines/categories', {
          method: 'POST',
          body: JSON.stringify({ name: catName.trim() }),
        });
        flash(`Category "${catName.trim()}" created successfully.`);
      }
      setShowCatModal(false);
      setEditingCat(null);
      setCatName('');
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCat) return;
    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await apiFetch(`/pharmacy/medicines/categories/${deletingCat.id}`, { method: 'DELETE' });
      flash(`Category "${deletingCat.name}" deleted successfully.`);
      setDeletingCat(null);
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form Factor actions
  const handleSaveFormFactor = async (e) => {
    e.preventDefault();
    if (!ffName.trim()) { setErrorMsg('Form factor name cannot be empty.'); return; }
    try {
      setIsSubmitting(true);
      setErrorMsg('');
      if (editingFf) {
        await apiFetch(`/pharmacy/medicines/form-factors/${editingFf.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: ffName.trim() }),
        });
        flash(`Form factor "${ffName.trim()}" updated successfully.`);
      } else {
        await apiFetch('/pharmacy/medicines/form-factors', {
          method: 'POST',
          body: JSON.stringify({ name: ffName.trim() }),
        });
        flash(`Form factor "${ffName.trim()}" created successfully.`);
      }
      setShowFfModal(false);
      setEditingFf(null);
      setFfName('');
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save form factor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFormFactor = async () => {
    if (!deletingFf) return;
    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await apiFetch(`/pharmacy/medicines/form-factors/${deletingFf.id}`, { method: 'DELETE' });
      flash(`Form factor "${deletingFf.name}" deleted successfully.`);
      setDeletingFf(null);
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete form factor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCategories = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const filteredFormFactors = formFactors.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader
        category="Pharmacy"
        title="Categories & Form Factors"
        subtitle="Manage medicine categories and physical form factors (Tablet, Syrup, Injection, etc.) for medicine stock."
        actions={
          activeTab === 'categories' ? (
            <button
              onClick={() => { setEditingCat(null); setCatName(''); setShowCatModal(true); }}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer whitespace-nowrap"
            >
              + Add Category
            </button>
          ) : (
            <button
              onClick={() => { setEditingFf(null); setFfName(''); setShowFfModal(true); }}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer whitespace-nowrap"
            >
              + Add Form Factor
            </button>
          )
        }
      />

      {successMsg && <Banner>{successMsg}</Banner>}
      {errorMsg && <Banner tone="error">{errorMsg}</Banner>}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200/80 shadow-sm w-fit">
        <button
          onClick={() => { setActiveTab('categories'); setSearch(''); }}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            activeTab === 'categories' ? 'bg-[#1e40af] text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Medicine Categories ({categories.length})
        </button>
        <button
          onClick={() => { setActiveTab('form-factors'); setSearch(''); }}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            activeTab === 'form-factors' ? 'bg-[#1e40af] text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Form Factors ({formFactors.length})
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'categories' ? 'Search categories…' : 'Search form factors…'}
            className="w-full pl-8 pr-3.5 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 placeholder-gray-300"
          />
          <svg
            className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2"
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      </div>

      {activeTab === 'categories' ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700 min-w-[600px]">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="p-3.5">Category Name</th>
                <th className="p-3.5">Assigned Medicines</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={3} className="p-8 text-center text-gray-400">Loading categories…</td></tr>
              ) : filteredCategories.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center text-gray-400">No categories found.</td></tr>
              ) : (
                filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50/80">
                    <td className="p-3.5 font-bold text-gray-900">{cat.name}</td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                        {cat.medicine_count ?? 0} Medicine{cat.medicine_count === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-3 font-semibold whitespace-nowrap">
                      <button
                        onClick={() => { setEditingCat(cat); setCatName(cat.name); setShowCatModal(true); }}
                        className="text-blue-600 hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingCat(cat)}
                        className="text-rose-600 hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700 min-w-[600px]">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="p-3.5">Form Factor Name</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={2} className="p-8 text-center text-gray-400">Loading form factors…</td></tr>
              ) : filteredFormFactors.length === 0 ? (
                <tr><td colSpan={2} className="p-8 text-center text-gray-400">No form factors found.</td></tr>
              ) : (
                filteredFormFactors.map((ff) => (
                  <tr key={ff.id} className="hover:bg-gray-50/80">
                    <td className="p-3.5 font-bold text-gray-900">{ff.name}</td>
                    <td className="p-3.5 text-right space-x-3 font-semibold whitespace-nowrap">
                      <button
                        onClick={() => { setEditingFf(ff); setFfName(ff.name); setShowFfModal(true); }}
                        className="text-blue-600 hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingFf(ff)}
                        className="text-rose-600 hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {editingCat ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button onClick={() => { setShowCatModal(false); setEditingCat(null); setCatName(''); }} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded hover:bg-gray-100">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Category Name *</label>
                <input
                  autoFocus
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Antibiotics, Analgesics, Cardiac"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowCatModal(false); setEditingCat(null); setCatName(''); }} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-xs font-semibold bg-[#1e40af] hover:bg-[#1c399b] text-white rounded-lg cursor-pointer disabled:opacity-50">
                  {isSubmitting ? 'Saving…' : editingCat ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {deletingCat && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-gray-100">
            <h3 className="text-base font-bold text-gray-900">Delete Category</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete the category <span className="font-bold text-gray-900">"{deletingCat.name}"</span>?
            </p>
            {deletingCat.medicine_count > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2.5 rounded-lg flex items-start gap-1.5">
                <AlertTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  This category currently has <span className="font-bold">{deletingCat.medicine_count}</span> active medicine(s) assigned. You must reassign or remove those medicines before deleting this category.
                </span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeletingCat(null)} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
              <button type="button" onClick={handleDeleteCategory} disabled={isSubmitting || deletingCat.medicine_count > 0} className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer disabled:opacity-50">
                {isSubmitting ? 'Deleting…' : 'Delete Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Form Factor Modal */}
      {showFfModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {editingFf ? 'Edit Form Factor' : 'Add New Form Factor'}
              </h3>
              <button onClick={() => { setShowFfModal(false); setEditingFf(null); setFfName(''); }} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded hover:bg-gray-100">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveFormFactor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Form Factor Name *</label>
                <input
                  autoFocus
                  type="text"
                  value={ffName}
                  onChange={(e) => setFfName(e.target.value)}
                  placeholder="e.g. Syrup, Tablet, Capsule, Suspension"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowFfModal(false); setEditingFf(null); setFfName(''); }} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-xs font-semibold bg-[#1e40af] hover:bg-[#1c399b] text-white rounded-lg cursor-pointer disabled:opacity-50">
                  {isSubmitting ? 'Saving…' : editingFf ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Form Factor Confirmation Modal */}
      {deletingFf && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-gray-100">
            <h3 className="text-base font-bold text-gray-900">Delete Form Factor</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete the form factor <span className="font-bold text-gray-900">"{deletingFf.name}"</span>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeletingFf(null)} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
              <button type="button" onClick={handleDeleteFormFactor} disabled={isSubmitting} className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer disabled:opacity-50">
                {isSubmitting ? 'Deleting…' : 'Delete Form Factor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
