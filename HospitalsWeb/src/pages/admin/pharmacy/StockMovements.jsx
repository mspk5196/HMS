import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import { formatDate, todayISO } from './pharmacyUtils';
import { Banner } from './PharmacyUI';

const SUB_TABS = [
  { id: 'daily', label: 'Daily Movements' },
  { id: 'drug', label: 'Drug-wise' },
  { id: 'patient', label: 'Patient-wise' },
];

const MOVEMENT_TONE = {
  receipt: 'bg-emerald-50 text-emerald-600',
  sale: 'bg-blue-50 text-blue-600',
  return: 'bg-amber-50 text-amber-600',
  adjustment: 'bg-gray-100 text-gray-600',
};

export default function StockMovements() {
  const [subTab, setSubTab] = useState('daily');
  const [errorMsg, setErrorMsg] = useState('');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Pharmacy &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Movements</span>
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Daily, drug-wise and patient-wise stock movement history.</p>
      </div>
      {errorMsg && <Banner tone="error">{errorMsg}</Banner>}
      <div className="bg-white p-1.5 rounded-xl border border-gray-200/80 shadow-sm flex gap-1 w-fit">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${subTab === t.id ? 'bg-[#1e40af] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'daily' && <DailyMovements onError={setErrorMsg} />}
      {subTab === 'drug' && <DrugWiseMovements onError={setErrorMsg} />}
      {subTab === 'patient' && <PatientWiseMovements onError={setErrorMsg} />}
    </div>
  );
}

function DailyMovements({ onError }) {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch(`/pharmacy/reports/movements/daily?date=${date}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err.message || 'Failed to load daily movements.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-3">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700 min-w-[700px]">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3.5">Medicine</th>
              <th className="p-3.5">Received</th>
              <th className="p-3.5">Dispensed</th>
              <th className="p-3.5">Returned</th>
              <th className="p-3.5">Adjusted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">No stock movement recorded on this date.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.medicine_id} className="hover:bg-gray-50/80">
                <td className="p-3.5 font-bold text-gray-900">{r.medicine_name}</td>
                <td className="p-3.5 text-emerald-600 font-semibold">{r.received_qty > 0 ? `+${r.received_qty}` : '—'}</td>
                <td className="p-3.5 text-blue-600 font-semibold">{r.dispensed_qty > 0 ? `-${r.dispensed_qty}` : '—'}</td>
                <td className="p-3.5">{r.returned_qty > 0 ? `+${r.returned_qty}` : '—'}</td>
                <td className="p-3.5">{r.adjusted_qty !== 0 ? r.adjusted_qty : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DrugWiseMovements({ onError }) {
  const [medicines, setMedicines] = useState([]);
  const [medicineId, setMedicineId] = useState('');
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const result = await apiFetch('/pharmacy/medicines?limit=500', { withMeta: true });
        setMedicines(Array.isArray(result.data) ? result.data : []);
      } catch (err) {
        onError(err.message || 'Failed to load medicines.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!medicineId) { setRows([]); return; }
    (async () => {
      try {
        setIsLoading(true);
        const result = await apiFetch(`/pharmacy/reports/movements?medicineId=${medicineId}&limit=100`, { withMeta: true });
        setRows(Array.isArray(result.data) ? result.data : []);
      } catch (err) {
        onError(err.message || 'Failed to load movements.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [medicineId, onError]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
        <select value={medicineId} onChange={(e) => setMedicineId(e.target.value)} className="w-full sm:w-80 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900">
          <option value="">Select a medicine…</option>
          {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <MovementsTable rows={rows} isLoading={isLoading} showPatient placeholder="Pick a medicine to see its full movement history." />
    </div>
  );
}

function PatientWiseMovements({ onError }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [patient, setPatient] = useState(null);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const result = await apiFetch(`/patient/patients?search=${encodeURIComponent(q)}&limit=8`, { withMeta: true });
        setResults(Array.isArray(result.data) ? result.data : []);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!patient) { setRows([]); return; }
    (async () => {
      try {
        setIsLoading(true);
        const result = await apiFetch(`/pharmacy/reports/movements?patientId=${patient.id}&movementType=sale&limit=100`, { withMeta: true });
        setRows(Array.isArray(result.data) ? result.data : []);
      } catch (err) {
        onError(err.message || 'Failed to load movements.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [patient, onError]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
        {patient ? (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3.5 py-2.5 max-w-sm">
            <div>
              <div className="text-xs font-bold text-gray-900">{patient.full_name}</div>
              <div className="text-[11px] text-gray-500">{patient.mobile_number}</div>
            </div>
            <button onClick={() => setPatient(null)} className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer">Change</button>
          </div>
        ) : (
          <div className="relative max-w-sm">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient by name or mobile number..."
              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900"
            />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {results.map((p) => (
                  <button key={p.id} onClick={() => { setPatient(p); setResults([]); }} className="w-full text-left px-3.5 py-2 text-xs hover:bg-blue-50 cursor-pointer">
                    <span className="font-semibold text-gray-900">{p.full_name}</span> <span className="text-gray-400">{p.mobile_number}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <MovementsTable rows={rows} isLoading={isLoading} showMedicine placeholder="Search and select a patient to see the tablets/medicines they've bought." />
    </div>
  );
}

function MovementsTable({ rows, isLoading, showPatient, showMedicine, placeholder }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden overflow-x-auto">
      <table className="w-full text-left text-xs text-gray-700 min-w-[700px]">
        <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
          <tr>
            <th className="p-3.5">Date</th>
            {showMedicine && <th className="p-3.5">Medicine</th>}
            <th className="p-3.5">Type</th>
            <th className="p-3.5">Quantity</th>
            {showPatient && <th className="p-3.5">Patient</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {isLoading ? (
            <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={5} className="p-8 text-center text-gray-400">{placeholder}</td></tr>
          ) : rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50/80">
              <td className="p-3.5">{formatDate(r.movement_date)}</td>
              {showMedicine && <td className="p-3.5 font-semibold">{r.medicine_name}</td>}
              <td className="p-3.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${MOVEMENT_TONE[r.movement_type] || 'bg-gray-100 text-gray-600'}`}>{r.movement_type}</span></td>
              <td className="p-3.5 font-semibold">{r.quantity > 0 ? `+${r.quantity}` : r.quantity} {r.unit || ''}</td>
              {showPatient && <td className="p-3.5">{r.patient_name || '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
