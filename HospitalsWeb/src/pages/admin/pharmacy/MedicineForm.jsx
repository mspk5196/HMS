import React, { useState, useEffect } from 'react';

const FORM_OPTIONS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Other'];

export default function MedicineForm({ categories, initialData, onCancel, onSubmit, onCreateCategory }) {
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  useEffect(() => { setCategoryOptions(categories); }, [categories]);

  const [values, setValues] = useState({
    name: initialData?.name || '',
    generic_name: initialData?.generic_name || '',
    category_id: initialData?.category_id || '',
    form: initialData?.form || '',
    strength: initialData?.strength || '',
    unit: initialData?.unit || '',
    manufacturer: initialData?.manufacturer || '',
    hsn_code: initialData?.hsn_code || '',
    gst_percent: initialData?.gst_percent ?? 0,
    reorder_level: initialData?.reorder_level ?? 10,
    barcode: initialData?.barcode || '',
    description: initialData?.description || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      setIsSavingCategory(true);
      setErrorMsg('');
      const category = await onCreateCategory(newCategoryName.trim());
      setCategoryOptions((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
      setValues((v) => ({ ...v, category_id: category.id }));
      setNewCategoryName('');
      setAddingCategory(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create category.');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!values.name.trim()) { setErrorMsg('Medicine name is required.'); return; }
    try {
      setIsSaving(true);
      setErrorMsg('');
      await onSubmit({
        ...values,
        category_id: values.category_id || null,
        gst_percent: Number(values.gst_percent) || 0,
        reorder_level: Number(values.reorder_level) || 0,
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save medicine.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800">{initialData ? 'Edit Medicine' : 'Add Medicine'}</h2>
        <p className="text-xs text-gray-500 mt-0.5">Medicine master details, used across billing, ordering and reports.</p>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Medicine Name *">
            <input value={values.name} onChange={set('name')} required className={inputCls} placeholder="Paracetamol 650mg" />
          </Field>
          <Field label="Generic Name">
            <input value={values.generic_name} onChange={set('generic_name')} className={inputCls} placeholder="Paracetamol" />
          </Field>
          <Field label="Category">
            {addingCategory ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); } }}
                  placeholder="New category name"
                  className={inputCls}
                />
                <button type="button" onClick={handleCreateCategory} disabled={isSavingCategory} className="px-3 py-2 bg-[#1e40af] text-white text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 whitespace-nowrap">
                  {isSavingCategory ? 'Adding…' : 'Add'}
                </button>
                <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryName(''); }} className="px-3 py-2 text-gray-500 text-xs font-semibold rounded-lg hover:bg-gray-100 cursor-pointer">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select value={values.category_id} onChange={set('category_id')} className={inputCls}>
                  <option value="">Select category…</option>
                  {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setAddingCategory(true)} className="px-3 py-2 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-50 cursor-pointer whitespace-nowrap">
                  + New
                </button>
              </div>
            )}
          </Field>
          <Field label="Form">
            <select value={values.form} onChange={set('form')} className={inputCls}>
              <option value="">Select form…</option>
              {FORM_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Strength">
            <input value={values.strength} onChange={set('strength')} className={inputCls} placeholder="650mg" />
          </Field>
          <Field label="Unit">
            <input value={values.unit} onChange={set('unit')} className={inputCls} placeholder="Strip / Bottle / Box" />
          </Field>
          <Field label="Manufacturer">
            <input value={values.manufacturer} onChange={set('manufacturer')} className={inputCls} />
          </Field>
          <Field label="HSN Code">
            <input value={values.hsn_code} onChange={set('hsn_code')} className={inputCls} />
          </Field>
          <Field label="GST %">
            <input type="number" min="0" step="0.01" value={values.gst_percent} onChange={set('gst_percent')} className={inputCls} />
          </Field>
          <Field label="Minimum Stock Threshold *" hint="Reorder alert triggers at/below this quantity.">
            <input type="number" min="0" value={values.reorder_level} onChange={set('reorder_level')} className={inputCls} />
          </Field>
          <Field label="Barcode">
            <input value={values.barcode} onChange={set('barcode')} className={inputCls} placeholder="Scanner code" />
          </Field>
        </div>
        <Field label="Description">
          <textarea value={values.description} onChange={set('description')} rows={2} className={inputCls} />
        </Field>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
            {isSaving ? 'Saving…' : initialData ? 'Save Changes' : 'Add Medicine'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600';

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-gray-400">{hint}</span>}
    </label>
  );
}
