import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import { Banner } from './PharmacyUI';

export default function MedicineCategories() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);

  const [categoryName, setCategoryName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };

  const loadCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await apiFetch('/pharmacy/medicines/categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load medicine categories.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      setErrorMsg('Category name cannot be empty.');
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg('');
      if (editingCategory) {
        await apiFetch(`/pharmacy/medicines/categories/${editingCategory.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: categoryName.trim() }),
        });
        flash(`Category "${categoryName.trim()}" updated successfully.`);
      } else {
        await apiFetch('/pharmacy/medicines/categories', {
          method: 'POST',
          body: JSON.stringify({ name: categoryName.trim() }),
        });
        flash(`Category "${categoryName.trim()}" created successfully.`);
      }
      setShowAddModal(false);
      setEditingCategory(null);
      setCategoryName('');
      await loadCategories();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await apiFetch(`/pharmacy/medicines/categories/${deletingCategory.id}`, {
        method: 'DELETE',
      });
      flash(`Category "${deletingCategory.name}" deleted successfully.`);
      setDeletingCategory(null);
      await loadCategories();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            Pharmacy &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Medicine Categories</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Organize medicines by pharmacological or therapeutic classification.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCategory(null);
            setCategoryName('');
            setShowAddModal(true);
          }}
          className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          + Add Category
        </button>
      </div>

      {successMsg && <Banner>{successMsg}</Banner>}
      {errorMsg && <Banner tone="error">{errorMsg}</Banner>}

      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories…"
            className="w-full pl-8 pr-3.5 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 placeholder-gray-300"
          />
          <svg
            className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <div className="text-xs text-gray-500 font-medium">
          Total Categories: <span className="font-bold text-gray-800">{categories.length}</span>
        </div>
      </div>

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
              <tr>
                <td colSpan={3} className="p-8 text-center text-gray-400">Loading categories…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-gray-400">No categories found.</td>
              </tr>
            ) : (
              filtered.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50/80">
                  <td className="p-3.5 font-bold text-gray-900">{cat.name}</td>
                  <td className="p-3.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                      {cat.medicine_count ?? 0} Medicine{cat.medicine_count === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td className="p-3.5 text-right space-x-3 font-semibold whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditingCategory(cat);
                        setCategoryName(cat.name);
                        setShowAddModal(true);
                      }}
                      className="text-blue-600 hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingCategory(cat)}
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

      {/* Add / Edit Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingCategory(null);
                  setCategoryName('');
                }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  autoFocus
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Antibiotics, Analgesics, Cardiac"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCategory(null);
                    setCategoryName('');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold bg-[#1e40af] hover:bg-[#1c399b] text-white rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving…' : editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCategory && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-gray-100">
            <h3 className="text-base font-bold text-gray-900">Delete Category</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete the category <span className="font-bold text-gray-900">"{deletingCategory.name}"</span>?
            </p>
            {deletingCategory.medicine_count > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2.5 rounded-lg">
                ⚠️ This category currently has <span className="font-bold">{deletingCategory.medicine_count}</span> active medicine(s) assigned. You must reassign or remove those medicines before deleting this category.
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting || deletingCategory.medicine_count > 0}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting…' : 'Delete Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
