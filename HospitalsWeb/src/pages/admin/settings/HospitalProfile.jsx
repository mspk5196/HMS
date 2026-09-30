import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import { LandmarkIcon, CheckIcon } from '../../../components/Icons';

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-rose-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <div className={`text-xs font-medium px-4 py-2.5 rounded-lg border ${cls}`}>
      {msg}
    </div>
  );
}

export default function HospitalProfile() {
  const [configs, setConfigs] = useState({
    HOSPITAL_NAME: 'Neha Hospitals',
    HOSPITAL_PHONE: '',
    HOSPITAL_ADDRESS: '',
    HOSPITAL_GSTIN: '',
    DEFAULT_BUFFER_MINUTES: '30',
    SALARY_DATE_TYPE: 'last_day_of_month',
    FUTURE_BOOKING_ENABLED: '0',
    TOKEN_SCOPE: 'hospital',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const rows = await apiFetch('/system');
      if (Array.isArray(rows)) {
        const map = {};
        rows.forEach((r) => {
          map[r.config_key] = r.config_value;
        });
        setConfigs((prev) => ({ ...prev, ...map }));
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to load hospital settings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (key, val) => {
    setConfigs((prev) => ({ ...prev, [key]: val }));
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setErrorMsg('');
      for (const [k, v] of Object.entries(configs)) {
        await apiFetch(`/system/${k}`, {
          method: 'PATCH',
          body: JSON.stringify({ value: String(v ?? '') }),
        });
      }
      flash('Hospital profile and system settings saved successfully.');
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
          <LandmarkIcon className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">Hospital Profile & System Configuration</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            General details used on patient bills, OPD tokens, payslips, and system reports.
          </p>
        </div>
      </div>

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      {isLoading ? (
        <div className="p-12 text-center text-xs text-gray-400">Loading settings…</div>
      ) : (
        <form onSubmit={save} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Hospital Name */}
            <div className="space-y-1">
              <label className="block font-bold text-gray-700">Hospital Name *</label>
              <input
                type="text"
                required
                value={configs.HOSPITAL_NAME || ''}
                onChange={(e) => handleChange('HOSPITAL_NAME', e.target.value)}
                placeholder="e.g. Neha Hospitals"
                className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-1">
              <label className="block font-bold text-gray-700">Primary Contact Phone</label>
              <input
                type="text"
                value={configs.HOSPITAL_PHONE || ''}
                onChange={(e) => handleChange('HOSPITAL_PHONE', e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold"
              />
            </div>

            {/* Address */}
            <div className="space-y-1 md:col-span-2">
              <label className="block font-bold text-gray-700">Hospital Address (for letterhead / receipts)</label>
              <textarea
                rows={2}
                value={configs.HOSPITAL_ADDRESS || ''}
                onChange={(e) => handleChange('HOSPITAL_ADDRESS', e.target.value)}
                placeholder="Street address, City, District, State, Pincode"
                className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold"
              />
            </div>

            {/* GSTIN */}
            <div className="space-y-1">
              <label className="block font-bold text-gray-700">GSTIN / Tax ID</label>
              <input
                type="text"
                value={configs.HOSPITAL_GSTIN || ''}
                onChange={(e) => handleChange('HOSPITAL_GSTIN', e.target.value)}
                placeholder="GST Identification Number"
                className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold"
              />
            </div>

            {/* Salary Date Type */}
            <div className="space-y-1">
              <label className="block font-bold text-gray-700">Salary Calculation Date Cycle</label>
              <select
                value={configs.SALARY_DATE_TYPE || 'last_day_of_month'}
                onChange={(e) => handleChange('SALARY_DATE_TYPE', e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold"
              >
                <option value="last_day_of_month">Last Day of Current Month (e.g. 30th/31st)</option>
                <option value="first_of_next_month">First of Next Month (e.g. 1st)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-6 py-2.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <CheckIcon className="w-4 h-4" />
              <span>{isSaving ? 'Saving…' : 'Save Hospital Profile'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
