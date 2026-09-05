import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '../util/api';
import { XIcon } from './Icons';

/**
 * Reusable, searchable medicine selector component.
 *
 * Supports case-insensitive searching by medicine name, generic name, barcode, form factor, or unit.
 * Works either with an explicit list of pre-loaded `medicines` or auto-fetches via `/pharmacy/medicines`.
 */
export default function MedicineSearchSelect({
  value,
  onChange,
  medicines = null,
  placeholder = 'Search medicine...',
  disabled = false,
  className = '',
  compact = false,
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [fetchedList, setFetchedList] = useState([]);
  const boxRef = useRef(null);

  const activeList = medicines !== null ? medicines : fetchedList;

  // Auto-fetch list if medicines prop not supplied
  useEffect(() => {
    if (medicines !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiFetch('/pharmacy/medicines?limit=500', { withMeta: true });
        if (!cancelled) setFetchedList(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setFetchedList([]);
      }
    })();
    return () => { cancelled = true; };
  }, [medicines]);

  // Find currently selected medicine object
  const selectedMed = useMemo(() => {
    if (!value) return null;
    return activeList.find((m) => String(m.id) === String(value)) || null;
  }, [value, activeList]);

  // Filter medicines by query (case-insensitive)
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeList.slice(0, 50);
    return activeList.filter((m) => {
      const name = (m.name || '').toLowerCase();
      const gen = (m.generic_name || m.genericName || '').toLowerCase();
      const bar = (m.barcode || '').toLowerCase();
      const form = (m.form_factor || m.formFactor || m.form || '').toLowerCase();
      const unit = (m.unit || '').toLowerCase();
      return name.includes(q) || gen.includes(q) || bar.includes(q) || form.includes(q) || unit.includes(q);
    }).slice(0, 50);
  }, [query, activeList]);

  // Close dropdown on outside click
  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handlePick = (m) => {
    onChange(String(m.id), m);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', null);
    setQuery('');
    setIsOpen(true);
  };

  const inputPadding = compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-xs';

  return (
    <div className={`relative w-full ${className}`} ref={boxRef}>
      {selectedMed && !isOpen ? (
        <div
          onClick={() => !disabled && setIsOpen(true)}
          className={`flex items-center justify-between border border-gray-200 rounded-lg bg-white ${inputPadding} ${
            disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-blue-500'
          }`}
        >
          <div className="truncate pr-1">
            <span className="font-bold text-gray-900">{selectedMed.name}</span>
            {(selectedMed.form_factor || selectedMed.unit || selectedMed.generic_name) && (
              <span className="text-[10px] text-gray-500 ml-1">
                ({[selectedMed.form_factor, selectedMed.unit].filter(Boolean).join(' ')}
                {selectedMed.generic_name ? ` · ${selectedMed.generic_name}` : ''})
              </span>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-rose-600 cursor-pointer p-0.5"
              title="Clear selection"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            disabled={disabled}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => !disabled && setIsOpen(true)}
            placeholder={selectedMed ? selectedMed.name : placeholder}
            className={`w-full border border-gray-200 rounded-lg font-medium text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ${inputPadding} ${
              disabled ? 'opacity-60 bg-gray-100 cursor-not-allowed' : ''
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
          {isOpen && !disabled && (
            <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100 min-w-[220px]">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2.5 text-xs text-gray-400 text-center">No medicines found</div>
              ) : (
                filteredOptions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handlePick(m)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer transition-colors flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between font-bold text-gray-900">
                      <span>{m.name}</span>
                      {(m.form_factor || m.unit) && (
                        <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {[m.form_factor, m.unit].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </div>
                    {m.generic_name && (
                      <div className="text-[10px] text-gray-500 truncate">
                        Generic: <span className="font-semibold text-gray-700">{m.generic_name}</span>
                      </div>
                    )}
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
