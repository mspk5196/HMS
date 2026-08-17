import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../util/api';

/**
 * Search-as-you-type doctor picker.
 *
 * Backed by GET /hr/employees/doctors, which is filtered server-side to
 * employees whose staff_role has is_doctor = 1 — so this only ever lists
 * real doctors, not every employee.
 *
 * value/onChange carry the employee id (string, to match the numeric-input
 * pickers this replaces). label is shown once selected.
 */
export default function DoctorPicker({ value, onChange, label = 'Doctor' }) {
  const [query, setQuery] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const data = await apiFetch('/hr/employees/doctors');
        if (!cancelled) setDoctors(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setDoctors([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selected = doctors.find((d) => String(d.id) === String(value));
  const q = query.trim().toLowerCase();
  const results = q
    ? doctors.filter((d) => d.full_name.toLowerCase().includes(q))
    : doctors;

  const pick = (doc) => {
    onChange(String(doc.id));
    setQuery('');
    setIsOpen(false);
  };

  const clear = () => {
    onChange('');
    setQuery('');
  };

  return (
    <div className="space-y-1" ref={boxRef}>
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>

      {value && selected ? (
        <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-xs">
          <span className="font-semibold text-gray-800">{selected.full_name} · {selected.designation || '—'}</span>
          <button type="button" onClick={clear} className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer">
            Change
          </button>
        </div>
      ) : value && !selected && !isLoading ? (
        <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-xs">
          <span className="font-semibold text-gray-800">Doctor #{value}</span>
          <button type="button" onClick={clear} className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer">
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            placeholder={isLoading ? 'Loading doctors…' : 'Search doctor by name...'}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          {isOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-md max-h-52 overflow-y-auto">
              {isLoading ? (
                <div className="px-3 py-2 text-[11px] text-gray-400">Loading…</div>
              ) : results.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-gray-400">No doctors found.</div>
              ) : (
                results.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => pick(doc)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer"
                  >
                    <div className="font-semibold text-gray-900">{doc.full_name}</div>
                    <div className="text-[10px] text-gray-400">{doc.department_name || '—'} · {doc.designation || '—'}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
