import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../util/api';
import { GearIcon, XIcon, InfoIcon, SunIcon, MoonIcon, CalendarIcon, ClockIcon } from '../../../components/Icons';

export default function ConfigureShiftTimingModal({ isOpen, onClose, onSuccess }) {
  const [dayShift, setDayShift] = useState({
    start_time: '08:00',
    end_time: '18:00',
    monthly_buffer_minutes: 30,
  });

  const [nightShift, setNightShift] = useState({
    start_time: '18:00',
    end_time: '08:00',
    monthly_buffer_minutes: 30,
  });

  const [dayAndNightShift, setDayAndNightShift] = useState({
    monthly_buffer_minutes: 30,
  });

  const [generalShift, setGeneralShift] = useState({
    monthly_buffer_minutes: 30,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadShifts = async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await apiFetch('/hr/shifts');
      const shiftList = Array.isArray(data) ? data : (data?.shifts || []);
      const bufferCfgs = data?.bufferConfigs || {};

      const d = shiftList.find((s) => !s.is_night_shift);
      const n = shiftList.find((s) => s.is_night_shift);
      if (d) {
        setDayShift({
          start_time: String(d.start_time || '08:00').slice(0, 5),
          end_time: String(d.end_time || '18:00').slice(0, 5),
          monthly_buffer_minutes: d.buffer_minutes ?? (bufferCfgs.day?.monthly_buffer_minutes ?? 30),
        });
      }
      if (n) {
        setNightShift({
          start_time: String(n.start_time || '18:00').slice(0, 5),
          end_time: String(n.end_time || '08:00').slice(0, 5),
          monthly_buffer_minutes: n.buffer_minutes ?? (bufferCfgs.night?.monthly_buffer_minutes ?? 30),
        });
      }
      if (bufferCfgs.day_and_night) {
        setDayAndNightShift({
          monthly_buffer_minutes: bufferCfgs.day_and_night.monthly_buffer_minutes ?? 30,
        });
      }
      if (bufferCfgs.general) {
        setGeneralShift({
          monthly_buffer_minutes: bufferCfgs.general.monthly_buffer_minutes ?? 30,
        });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load shift timings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      loadShifts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dayShift.start_time || !dayShift.end_time) {
      setErrorMsg('Please specify Day Shift start and end times.');
      return;
    }
    if (!nightShift.start_time || !nightShift.end_time) {
      setErrorMsg('Please specify Night Shift start and end times.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg('');
      const updated = await apiFetch('/hr/shifts/timings', {
        method: 'PATCH',
        body: JSON.stringify({
          dayShift: {
            start_time: dayShift.start_time,
            end_time: dayShift.end_time,
            grace_period_minutes: 0,
            monthly_buffer_minutes: Number(dayShift.monthly_buffer_minutes) || 0,
          },
          nightShift: {
            start_time: nightShift.start_time,
            end_time: nightShift.end_time,
            grace_period_minutes: 0,
            monthly_buffer_minutes: Number(nightShift.monthly_buffer_minutes) || 0,
          },
          dayAndNightShift: {
            monthly_buffer_minutes: Number(dayAndNightShift.monthly_buffer_minutes) || 0,
          },
          generalShift: {
            monthly_buffer_minutes: Number(generalShift.monthly_buffer_minutes) || 0,
          },
        }),
      });

      setSuccessMsg('Shift timings and monthly buffer pools updated successfully!');
      if (onSuccess) onSuccess(updated);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save shift timings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shadow-xs">
              <GearIcon className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Configure Shift Timings &amp; Monthly Buffers</h2>
              <p className="text-[11px] text-gray-500">Hospital-wide fixed hours and monthly late buffer pools for all 4 shift categories</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {errorMsg && (
            <div className="bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-2.5 rounded-lg">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-4 py-2.5 rounded-lg">
              {successMsg}
            </div>
          )}

          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 text-xs text-blue-800 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <InfoIcon className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Monthly Buffer Governance</span>
            </div>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Lateness accumulates immediately past scheduled shift start times and is absorbed by each category's <strong>Monthly Buffer Limit</strong>. Once the monthly buffer pool is exhausted, subsequent lateness triggers fine deductions.
            </p>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-gray-400">Loading current shift configuration...</div>
          ) : (
            <div className="space-y-4">
              {/* 1. Day Shift Section */}
              <div className="p-4 rounded-xl border border-amber-200/70 bg-amber-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <SunIcon className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>1. Day Shift</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    Fixed Hours + Monthly Buffer
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={dayShift.start_time}
                      onChange={(e) => setDayShift((prev) => ({ ...prev, start_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      End Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={dayShift.end_time}
                      onChange={(e) => setDayShift((prev) => ({ ...prev, end_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      Monthly Buffer Limit (Min)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="300"
                      value={dayShift.monthly_buffer_minutes}
                      onChange={(e) => setDayShift((prev) => ({ ...prev, monthly_buffer_minutes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-amber-900 bg-amber-50/80 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Night Shift Section */}
              <div className="p-4 rounded-xl border border-indigo-200/70 bg-indigo-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                    <MoonIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>2. Night Shift</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Fixed Hours + Monthly Buffer
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={nightShift.start_time}
                      onChange={(e) => setNightShift((prev) => ({ ...prev, start_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      End Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={nightShift.end_time}
                      onChange={(e) => setNightShift((prev) => ({ ...prev, end_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      Monthly Buffer Limit (Min)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="300"
                      value={nightShift.monthly_buffer_minutes}
                      onChange={(e) => setNightShift((prev) => ({ ...prev, monthly_buffer_minutes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-indigo-900 bg-indigo-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Day & Night Shift (Duty Roster) Section */}
              <div className="p-4 rounded-xl border border-blue-200/70 bg-blue-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>3. Day &amp; Night Shift (Duty Roster)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    Rotational / Roster
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Staff under this category rotate between Day and Night shifts according to the weekly duty roster. Their late arrival is absorbed by the hospital-wide monthly buffer pool configured here.
                  </p>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      Monthly Buffer Pool (Minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="300"
                      value={dayAndNightShift.monthly_buffer_minutes}
                      onChange={(e) => setDayAndNightShift((prev) => ({ ...prev, monthly_buffer_minutes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-blue-900 bg-blue-50/80 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 4. General / Custom Shift Section */}
              <div className="p-4 rounded-xl border border-teal-200/70 bg-teal-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
                    <ClockIcon className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>4. General Shift (Custom Time Range)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                    Custom Hours + Global Buffer
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <p className="text-[11px] text-teal-700 leading-relaxed">
                    Staff under General Shift have unique working hours (e.g. 09:30–18:30) assigned on their profile. Their monthly buffer limit is configured hospital-wide here.
                  </p>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      Monthly Buffer Pool (Minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="300"
                      value={generalShift.monthly_buffer_minutes}
                      onChange={(e) => setGeneralShift((prev) => ({ ...prev, monthly_buffer_minutes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-teal-900 bg-teal-50/80 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#1e40af] hover:bg-[#1c399b] rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving Configurations...' : 'Save Shift Timings & Buffers'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

