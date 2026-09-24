import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../util/api';
import { BoltIcon, XIcon, CheckIcon, ClockIcon } from '../../components/Icons';

export default function SyncHistoricalPunchesModal({ isOpen, onClose, onSuccess }) {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [syncScope, setSyncScope] = useState('full'); // 'full' | 'range'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSyncResult(null);
      // Load active devices
      apiFetch('/attendance/devices')
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setDevices(list);
          if (list.length > 0 && selectedDevice === 'all') {
            // Keep 'all' or default
          }
        })
        .catch((err) => {
          console.warn('Failed to load devices for sync modal:', err);
        });

      // Default date range: last 30 days
      const d = new Date();
      const end = d.toISOString().slice(0, 10);
      const startD = new Date();
      startD.setDate(startD.getDate() - 30);
      const start = startD.toISOString().slice(0, 10);
      setFromDate(start);
      setToDate(end);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartSync = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSyncResult(null);
    setIsProcessing(true);

    try {
      const payload = {
        deviceId: selectedDevice,
      };

      if (syncScope === 'range') {
        if (!fromDate || !toDate) {
          throw new Error('Please select both From Date and To Date for custom range.');
        }
        if (fromDate > toDate) {
          throw new Error('From Date cannot be after To Date.');
        }
        payload.fromDate = fromDate;
        payload.toDate = toDate;
      }

      const res = await apiFetch('/attendance/devices/sync-historical', {
        method: 'POST',
        body: payload,
      });

      // Process summary result
      let totalFetched = 0;
      let totalInserted = 0;
      let totalPreserved = 0;
      const datesSet = new Set();

      if (Array.isArray(res)) {
        res.forEach((r) => {
          totalFetched += r.totalLogsFetched || 0;
          totalInserted += r.newPunchesInserted || 0;
          totalPreserved += r.existingPunchesPreserved || 0;
          if (Array.isArray(r.affectedDates)) {
            r.affectedDates.forEach((d) => datesSet.add(d));
          }
        });
      } else if (res && typeof res === 'object') {
        totalFetched = res.totalLogsFetched || 0;
        totalInserted = res.newPunchesInserted || 0;
        totalPreserved = res.existingPunchesPreserved || 0;
        if (Array.isArray(res.affectedDates)) {
          res.affectedDates.forEach((d) => datesSet.add(d));
        }
      }

      const summary = {
        totalFetched,
        totalInserted,
        totalPreserved,
        affectedDatesCount: datesSet.size || (res?.affectedDatesCount || 0),
      };

      setSyncResult(summary);
      if (onSuccess) {
        onSuccess(
          `Historical sync complete: ${totalInserted} new punches added (${totalPreserved} existing records preserved).`
        );
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to sync historical punches from biometric device.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 transition-all">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <BoltIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Sync Historical Biometric Punches</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Download stored attendance punch logs directly from physical eSSL devices.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Form */}
        <form onSubmit={handleStartSync} className="mt-5 space-y-4">
          {/* Informational Assurance Card */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs space-y-1.5 text-blue-900">
            <div className="font-bold flex items-center gap-1.5 text-blue-800">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Safe &amp; Non-Destructive Sync (Leave Existing Data Intact)</span>
            </div>
            <p className="text-blue-700/90 text-[11px] leading-relaxed">
              Punches already present in your database will remain untouched and preserved. Only missing historical
              punches will be downloaded, mapped to employees, and processed into daily summaries.
            </p>
          </div>

          {/* Device Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Select Biometric Device
            </label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              disabled={isProcessing}
              className="w-full text-xs font-semibold px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 focus:bg-white transition-colors"
            >
              <option value="all">⚡ All Active Configured Devices</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.ip_address}:{d.port || 4370}) — {d.location || 'Hospital'}
                </option>
              ))}
            </select>
          </div>

          {/* Sync Scope / Mode */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Sync Scope
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSyncScope('full')}
                disabled={isProcessing}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  syncScope === 'full'
                    ? 'border-purple-600 bg-purple-50/60 text-purple-950 font-bold shadow-xs ring-1 ring-purple-600'
                    : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700 font-medium'
                }`}
              >
                <div className="text-xs">All Available History</div>
                <div className="text-[11px] text-gray-500 mt-0.5 font-normal">
                  Read all punch logs stored in the machine buffer
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSyncScope('range')}
                disabled={isProcessing}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  syncScope === 'range'
                    ? 'border-purple-600 bg-purple-50/60 text-purple-950 font-bold shadow-xs ring-1 ring-purple-600'
                    : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700 font-medium'
                }`}
              >
                <div className="text-xs">Specific Date Range</div>
                <div className="text-[11px] text-gray-500 mt-0.5 font-normal">
                  Target a custom historical date interval
                </div>
              </button>
            </div>
          </div>

          {/* Date Range Inputs (if range selected) */}
          {syncScope === 'range' && (
            <div className="grid grid-cols-2 gap-3 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={isProcessing}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  disabled={isProcessing}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Success Result Breakdown */}
          {syncResult && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <CheckIcon className="w-4 h-4 text-emerald-600" />
                <span>Historical Biometric Sync Completed Successfully!</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-center">
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <div className="text-[10px] text-gray-500 font-medium">Total Read</div>
                  <div className="text-sm font-bold text-gray-900">{syncResult.totalFetched}</div>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <div className="text-[10px] text-emerald-700 font-medium">New Added</div>
                  <div className="text-sm font-bold text-emerald-700">+{syncResult.totalInserted}</div>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                  <div className="text-[10px] text-blue-700 font-medium">Preserved (Kept)</div>
                  <div className="text-sm font-bold text-blue-700">{syncResult.totalPreserved}</div>
                </div>
              </div>
              {syncResult.affectedDatesCount > 0 && (
                <p className="text-[11px] text-emerald-800 text-center pt-1 font-medium">
                  ✨ Updated daily attendance summaries for {syncResult.affectedDatesCount} calendar date(s).
                </p>
              )}
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              {syncResult ? 'Close' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={isProcessing}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Reading Device Buffer…</span>
                </>
              ) : (
                <>
                  <BoltIcon className="w-4 h-4 text-white" />
                  <span>Start Historical Sync</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
