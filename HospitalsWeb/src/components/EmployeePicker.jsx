import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '../util/api';
import { SearchIcon, XIcon, UserIcon } from './Icons';

/**
 * Reusable, search-as-you-type EmployeePicker.
 * Supports searching by Name, Phone / Mobile, or Employee ID / Code.
 * Displays formatting: Name [Emp ID] [Department]
 */
export default function EmployeePicker({
  value,
  onChange,
  label = 'Select Employee',
  placeholder = 'Search by name, phone, or emp ID...',
  departmentId = null,
  required = false,
  compact = false,
  employees: propEmployees = null,
  className = '',
}) {
  const [query, setQuery] = useState('');
  const [employees, setEmployees] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch employees if not provided via props
  useEffect(() => {
    if (propEmployees && Array.isArray(propEmployees)) {
      setEmployees(propEmployees);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const res = await apiFetch('/hr/employees?limit=500');
        const list = Array.isArray(res) ? res : res?.rows || [];
        if (!cancelled) setEmployees(list);
      } catch {
        if (!cancelled) setEmployees([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propEmployees]);

  // Click outside to close dropdown
  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Find currently selected employee
  const selected = useMemo(() => {
    if (!value) return null;
    return employees.find((e) => String(e.id) === String(value) || String(e.employee_code) === String(value)) || null;
  }, [value, employees]);

  // Filter employees by department and query (name, phone, emp code/id)
  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (departmentId) {
      list = list.filter((e) => String(e.department_id) === String(departmentId));
    }

    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 50); // initial 50

    return list.filter((e) => {
      const name = String(e.full_name || '').toLowerCase();
      const code = String(e.employee_code || '').toLowerCase();
      const idStr = String(e.id || '');
      const phone = String(e.phone || e.mobile || e.contact_number || '').toLowerCase();
      const dept = String(e.department_name || '').toLowerCase();

      return name.includes(q) || code.includes(q) || idStr === q || phone.includes(q) || dept.includes(q);
    }).slice(0, 50);
  }, [employees, departmentId, query]);

  const handlePick = (emp) => {
    onChange(String(emp.id));
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = (e) => {
    if (e) e.stopPropagation();
    onChange('');
    setQuery('');
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className={`space-y-1 relative ${className}`} ref={boxRef}>
      {label && (
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {value && selected ? (
        <div className="flex items-center justify-between px-3 py-2 border border-blue-200 bg-blue-50/50 rounded-lg text-xs font-semibold text-gray-900 shadow-2xs">
          <div className="flex items-center gap-2 truncate pr-2">
            <span className="font-extrabold text-blue-900">{selected.full_name}</span>
            <span className="text-[10px] font-mono font-bold text-blue-700 bg-white px-1.5 py-0.2 rounded border border-blue-200">
              [{selected.employee_code || selected.id}]
            </span>
            <span className="text-[10px] text-gray-500 font-normal">
              [{selected.department_name || 'General'}]
            </span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] font-bold text-blue-700 hover:text-rose-600 cursor-pointer shrink-0 ml-1"
          >
            Change
          </button>
        </div>
      ) : value && !selected && !isLoading ? (
        <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-xs">
          <span className="font-semibold text-gray-800">Staff #{value}</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={isLoading ? 'Loading staff list…' : placeholder}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-gray-400"
          />
          <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />

          {isOpen && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100">
              {isLoading ? (
                <div className="p-3 text-center text-xs text-gray-400">Loading staff directory…</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-500">
                  No staff member matched <span className="font-bold text-gray-700">"{query}"</span>
                </div>
              ) : (
                filteredEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handlePick(emp)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between gap-2 text-xs group cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-gray-900 group-hover:text-blue-900 flex items-center gap-1.5">
                        <span>{emp.full_name}</span>
                        <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                          [{emp.employee_code || emp.id}]
                        </span>
                        <span className="text-[10px] text-gray-500 font-normal">
                          [{emp.department_name || 'General'}]
                        </span>
                      </div>
                      {(emp.phone || emp.mobile || emp.contact_number) && (
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          📞 {emp.phone || emp.mobile || emp.contact_number}
                        </div>
                      )}
                    </div>
                    {String(value) === String(emp.id) && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Selected
                      </span>
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
