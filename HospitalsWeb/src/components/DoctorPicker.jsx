import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../util/api';

/**
 * Search-as-you-type doctor/employee picker.
 *
 * Backed by GET /hr/employees?search=..., which matches on name or employee
 * code. There's no "is_doctor" flag in the schema — doctor_id on appointments
 * and admitting_doctor_id on admissions are both plain employees FKs — so this
 * searches all active employees rather than guessing which designations count
 * as doctors.
 *
 * value/onChange carry the employee id (string, to match the numeric-input
 * pickers this replaces). label is shown once selected.
 */
export default function DoctorPicker({ value, onChange, label = 'Doctor' }) {
  const [query, setQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const boxRef = useRef(null);

  // If a value arrives from outside (e.g. editing) with no cached label yet,
  // resolve it once so the field doesn't show a bare id.
  useEffect(() => {
    if (!value || selectedLabel) return;
    let cancelled = false;
    (async () => {
      try {
        const emp = await apiFetch(`/hr/employees/${value}`);
        if (!cancelled) setSelectedLabel(`${emp.full_name} · ${emp.department_name || '—'}`);
      } catch {
        if (!cancelled) setSelectedLabel(`Employee #${value}`);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!isOpen || !query.trim()) { setResults([]); return; }
    let cancelled = false;
    setIsSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await apiFetch(
          `/hr/employees?search=${encodeURIComponent(query.trim())}&status=active&limit=8`,
          { withMeta: true }
        );
        if (!cancelled) setResults(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, isOpen]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const pick = (emp) => {
    onChange(String(emp.id));
    setSelectedLabel(`${emp.full_name} · ${emp.department_name || '—'}`);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const clear = () => {
    onChange('');
    setSelectedLabel('');
    setQuery('');
  };

  return (
    <div className="space-y-1" ref={boxRef}>
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>

      {value && selectedLabel ? (
        <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-xs">
          <span className="font-semibold text-gray-800">{selectedLabel}</span>
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
            placeholder="Search doctor by name..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          {isOpen && query.trim() && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-md max-h-52 overflow-y-auto">
              {isSearching ? (
                <div className="px-3 py-2 text-[11px] text-gray-400">Searching…</div>
              ) : results.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-gray-400">No matches.</div>
              ) : (
                results.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => pick(emp)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer"
                  >
                    <div className="font-semibold text-gray-900">{emp.full_name}</div>
                    <div className="text-[10px] text-gray-400">{emp.department_name || '—'} · {emp.designation_name || '—'}</div>
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
