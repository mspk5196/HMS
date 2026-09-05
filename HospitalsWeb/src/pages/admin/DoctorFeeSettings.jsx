import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import PageHeader from '../../components/PageHeader';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm ${cls}`}>{msg}</div>;
}

export default function DoctorFeeSettings() {
  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ opd_fee: '', ipd_daily_fee: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await apiFetch('/payment/doctors');
      setDoctors(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to load doctors.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const departments = Array.from(
    new Map(doctors.filter((d) => d.department_id != null).map((d) => [d.department_id, d.department_name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const roles = Array.from(
    new Map(
      doctors
        .filter((d) => d.designation_id != null && (!departmentFilter || String(d.department_id) === departmentFilter))
        .map((d) => [d.designation_id, d.designation])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const filteredDoctors = doctors.filter((d) => {
    if (departmentFilter && String(d.department_id) !== departmentFilter) return false;
    if (roleFilter && String(d.designation_id) !== roleFilter) return false;
    return true;
  });

  const startEdit = (doctor) => {
    setEditingId(doctor.id);
    setEditForm({
      opd_fee: doctor.opd_fee ?? '',
      ipd_daily_fee: doctor.ipd_daily_fee ?? '',
    });
  };

  const save = async (doctorId) => {
    try {
      setIsSaving(true);
      await apiFetch('/payment/fee-rates', {
        method: 'POST',
        body: JSON.stringify({
          doctor_id: doctorId,
          opd_fee: Number(editForm.opd_fee) || 0,
          ipd_daily_fee: Number(editForm.ipd_daily_fee) || 0,
        }),
      });
      flash('Doctor fee rate saved.');
      setEditingId(null);
      await load();
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        category="Patient & Hospital"
        title="Doctor Fee Rates"
        subtitle="Set OPD consultation fee and IPD daily visit fee per doctor. These are pre-filled when closing a consultation or processing a discharge."
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900">All Doctors ({filteredDoctors.length})</h2>
          <div className="flex items-center gap-2">
            <select
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setRoleFilter(''); }}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              <option value="">All Departments</option>
              {departments.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              <option value="">All Roles</option>
              {roles.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            {(departmentFilter || roleFilter) && (
              <button
                onClick={() => { setDepartmentFilter(''); setRoleFilter(''); }}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : filteredDoctors.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            {doctors.length === 0
              ? 'No doctors found. Make sure employees are tagged with a doctor designation.'
              : 'No doctors match the selected filters.'}
          </div>
        ) : (
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="p-3.5">Doctor</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Designation</th>
                <th className="p-3.5">OPD Fee (₹)</th>
                <th className="p-3.5">IPD Daily Fee (₹)</th>
                <th className="p-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDoctors.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50/80">
                  <td className="p-3.5 font-semibold text-gray-900">{doc.full_name}</td>
                  <td className="p-3.5 text-gray-500">{doc.department_name || '—'}</td>
                  <td className="p-3.5 text-gray-500">{doc.designation || '—'}</td>

                  {editingId === doc.id ? (
                    <>
                      <td className="p-3.5">
                        <input
                          type="number"
                          value={editForm.opd_fee}
                          onChange={(e) => setEditForm((f) => ({ ...f, opd_fee: e.target.value }))}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-28 px-2 py-1.5 border border-blue-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </td>
                      <td className="p-3.5">
                        <input
                          type="number"
                          value={editForm.ipd_daily_fee}
                          onChange={(e) => setEditForm((f) => ({ ...f, ipd_daily_fee: e.target.value }))}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-28 px-2 py-1.5 border border-blue-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => save(doc.id)}
                            disabled={isSaving}
                            className="text-emerald-600 font-bold hover:underline cursor-pointer disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-gray-400 font-bold hover:underline cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3.5">
                        <span className={`font-semibold ${doc.opd_fee ? 'text-gray-900' : 'text-gray-400'}`}>
                          {doc.opd_fee ? money(doc.opd_fee) : '—'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`font-semibold ${doc.ipd_daily_fee ? 'text-gray-900' : 'text-gray-400'}`}>
                          {doc.ipd_daily_fee ? money(doc.ipd_daily_fee) : '—'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => startEdit(doc)}
                          className="text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          {doc.opd_fee || doc.ipd_daily_fee ? 'Edit' : 'Set Rate'}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-3 text-[11px] text-amber-800">
        <strong>Note:</strong> OPD Fee is the per-visit consultation fee. IPD Daily Fee is the doctor's visiting charge per day of admission — 
        it is automatically included in the discharge bill during the "Save & Move to Payment" step.
      </div>
    </div>
  );
}
