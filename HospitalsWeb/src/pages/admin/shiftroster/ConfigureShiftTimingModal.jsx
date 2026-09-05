import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../util/api';
import { GearIcon, XIcon, InfoIcon, SunIcon, MoonIcon } from '../../../components/Icons';

export default function ConfigureShiftTimingModal({ isOpen, onClose, onSuccess }) {
  const [dayShift, setDayShift] = useState({
    start_time: '09:00',
    end_time: '17:00',
    grace_period_minutes: 10,
  });

  const [nightShift, setNightShift] = useState({
    start_time: '20:00',
    end_time: '08:00',
    grace_period_minutes: 10,
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
      if (Array.isArray(data)) {
        const d = data.find((s) => !s.is_night_shift);
        const n = data.find((s) => s.is_night_shift);
        if (d) {
          setDayShift({
            start_time: String(d.start_time || '09:00').slice(0, 5),
            end_time: String(d.end_time || '17:00').slice(0, 5),
            grace_period_minutes: d.grace_period_minutes ?? 10,
          });
        }
        if (n) {
          setNightShift({
            start_time: String(n.start_time || '20:00').slice(0, 5),
            end_time: String(n.end_time || '08:00').slice(0, 5),
            grace_period_minutes: n.grace_period_minutes ?? 10,
          });
        }
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
            grace_period_minutes: Number(dayShift.grace_period_minutes) || 0,
          },
          nightShift: {
            start_time: nightShift.start_time,
            end_time: nightShift.end_time,
            grace_period_minutes: Number(nightShift.grace_period_minutes) || 0,
          },
        }),
      });

      setSuccessMsg('Shift timings updated successfully!');
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
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shadow-xs">
              <GearIcon className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Configure Shift Timings</h2>
              <p className="text-[11px] text-gray-500">Hospital-wide fixed hours for Day and Night shifts</p>
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
              <span>Fixed Shift Notice</span>
            </div>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Timings set here apply hospital-wide to all employees assigned to <strong>Day Shift</strong> and <strong>Night Shift</strong>. These hours cannot be altered on individual employee profiles.
            </p>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-gray-400">Loading current shift configuration...</div>
          ) : (
            <div className="space-y-5">
              {/* Day Shift Section */}
              <div className="p-4 rounded-xl border border-amber-200/70 bg-amber-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <SunIcon className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Day Shift Hours</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    Hospital Fixed
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      Buffer / Grace (Min)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={dayShift.grace_period_minutes}
                      onChange={(e) => setDayShift((prev) => ({ ...prev, grace_period_minutes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Night Shift Section */}
              <div className="p-4 rounded-xl border border-indigo-200/70 bg-indigo-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                    <MoonIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Night Shift Hours</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Hospital Fixed
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      Buffer / Grace (Min)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={nightShift.grace_period_minutes}
                      onChange={(e) => setNightShift((prev) => ({ ...prev, grace_period_minutes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
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
              {isSaving ? 'Saving Timings...' : 'Save Shift Timings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
