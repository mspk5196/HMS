import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../../util/api';

const SAMPLE_PUNCH_DATA = [
  {
    'Employee Code': 'EMP-101',
    'Punch Time': '2026-08-31 08:58:12',
    'Punch Type': 'in',
    'Device Name': 'eSSL Main Entrance',
  },
  {
    'Employee Code': 'EMP-101',
    'Punch Time': '2026-08-31 17:05:40',
    'Punch Type': 'out',
    'Device Name': 'eSSL Main Entrance',
  },
  {
    'Employee Code': 'EMP-102',
    'Punch Time': '2026-08-31 07:55:30',
    'Punch Type': 'in',
    'Device Name': 'eSSL Emergency / ICU',
  },
  {
    'Employee Code': 'EMP-102',
    'Punch Time': '2026-08-31 16:02:15',
    'Punch Type': 'out',
    'Device Name': 'eSSL Emergency / ICU',
  },
  {
    'Employee Code': 'EMP-103',
    'Punch Time': '2026-08-31 09:02:44',
    'Punch Type': 'in',
    'Device Name': 'eSSL Pharmacy Terminal',
  },
];

export function downloadPunchesExcelTemplate() {
  const ws = XLSX.utils.json_to_sheet(SAMPLE_PUNCH_DATA);
  ws['!cols'] = [
    { wch: 16 }, // Employee Code
    { wch: 24 }, // Punch Time
    { wch: 14 }, // Punch Type
    { wch: 28 }, // Device Name
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance Punches');
  XLSX.writeFile(wb, 'Neha_Hospital_Biometric_Punches_Template.xlsx');
}

export default function BulkPunchesImportModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [parsedPunches, setParsedPunches] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processPunchFile(selectedFile);
  };

  const formatTimestamp = (val) => {
    if (!val) return '';
    if (val instanceof Date && !isNaN(val.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())} ${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`;
    }
    const str = String(val).trim();
    return str;
  };

  const processPunchFile = (f) => {
    setErrorMsg('');
    setFile(f);
    setFileName(f.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson.length) {
          setErrorMsg('The selected spreadsheet contains no punch rows.');
          setParsedPunches([]);
          return;
        }

        const normalized = rawJson.map((row, idx) => {
          const code = String(row['Employee Code'] || row['employee_code'] || row['Enroll ID'] || row['Emp Code'] || row['UserId'] || '').trim();
          const rawTime = row['Punch Time'] || row['punch_time'] || row['Time'] || row['DateTime'] || row['Date Time'];
          const time = formatTimestamp(rawTime);
          const rawType = String(row['Punch Type'] || row['punch_type'] || row['Type'] || row['State'] || 'in').toLowerCase();
          const punchType = rawType.includes('out') || rawType === '1' ? 'out' : 'in';
          const device = String(row['Device Name'] || row['device_name'] || row['device_id'] || row['Terminal'] || 'Manual Upload').trim();

          const isValid = !!code && !!time;
          return {
            _rowNum: idx + 2,
            _isValid: isValid,
            _validationNote: !code ? 'Missing Code' : !time ? 'Missing Time' : 'Ready',
            employee_code: code,
            punch_time: time,
            punch_type: punchType,
            device_id: device,
          };
        });

        setParsedPunches(normalized);
      } catch (err) {
        setErrorMsg('Failed to parse file. Please upload a valid .xlsx, .xls, or .csv biometric log file.');
        setParsedPunches([]);
      }
    };

    reader.readAsArrayBuffer(f);
  };

  const handleImport = async () => {
    const validRows = parsedPunches.filter((r) => r._isValid);
    if (!validRows.length) {
      setErrorMsg('No valid punch rows to import.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMsg('');

      const res = await apiFetch('/attendance/punches/import', {
        method: 'POST',
        body: JSON.stringify({
          punches: validRows.map((r) => ({
            employee_code: r.employee_code,
            punch_time: r.punch_time,
            punch_type: r.punch_type,
            device_id: r.device_id,
          })),
        }),
      });

      const note = res?.recalculatedDays ? ` Attendance recalculated for ${res.recalculatedDays} affected date(s).` : '';
      onSuccess(`Successfully imported ${res.inserted || validRows.length} punch(es) (${res.duplicatesIgnored || 0} duplicates skipped).${note}`);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Bulk punch import failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedPunches.filter((r) => r._isValid).length;
  const invalidCount = parsedPunches.length - validCount;

  // Distinct dates in the batch
  const distinctDates = [
    ...new Set(
      parsedPunches
        .filter((r) => r._isValid)
        .map((r) => String(r.punch_time).slice(0, 10))
        .filter(Boolean)
    ),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg">
              ⚡
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Bulk Import Biometric Attendance Punches</h2>
              <p className="text-xs text-gray-500">Upload attendance logs from eTimeTrackLite, USB exports, or Excel spreadsheets.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Action Row: Template & File Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Download Template */}
            <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-4 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Step 1: Download Template</span>
                <h3 className="font-bold text-gray-900 text-sm mt-0.5">Punch Import Format</h3>
                <p className="text-gray-600 mt-1 leading-relaxed text-[11px]">
                  Sample Excel sheet matching standard eSSL &amp; ZK biometric device punch exports.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadPunchesExcelTemplate}
                className="mt-3 bg-white hover:bg-purple-50 text-purple-700 border border-purple-300 font-bold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>📥 Download Punches Template (.xlsx)</span>
              </button>
            </div>

            {/* Step 2: Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-purple-500 bg-gray-50/50 hover:bg-purple-50/30 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors space-y-1.5"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-full bg-purple-100/80 text-purple-600 flex items-center justify-center text-xl">
                📂
              </div>
              <div>
                <div className="font-bold text-gray-800 text-xs">
                  {fileName ? fileName : 'Click or Drag & Drop Punches File'}
                </div>
                <div className="text-[10px] text-gray-400">Supports .xlsx, .xls, and .csv files</div>
              </div>
            </div>
          </div>

          {/* Step 3: Parsed Data Preview */}
          {parsedPunches.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-gray-800">
                  <span>Punches Preview ({parsedPunches.length} Rows):</span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">{validCount} Ready</span>
                  {distinctDates.length > 0 && (
                    <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px]">
                      {distinctDates.length} Date(s) Affected
                    </span>
                  )}
                </div>
                <span className="text-gray-400 text-[11px]">First 50 previewed</span>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-100/80 text-[10px] text-gray-600 font-bold uppercase sticky top-0 border-b border-gray-200">
                    <tr>
                      <th className="p-2">Status</th>
                      <th className="p-2">Emp Code</th>
                      <th className="p-2">Punch Time</th>
                      <th className="p-2 text-center">Type</th>
                      <th className="p-2">Terminal / Device</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {parsedPunches.slice(0, 50).map((r, i) => (
                      <tr key={i} className={r._isValid ? 'hover:bg-gray-50/60' : 'bg-rose-50/40'}>
                        <td className="p-2 whitespace-nowrap">
                          {r._isValid ? (
                            <span className="text-emerald-700 font-bold">✓ Valid</span>
                          ) : (
                            <span className="text-rose-600 font-bold">✕ {r._validationNote}</span>
                          )}
                        </td>
                        <td className="p-2 font-mono font-bold text-blue-800">{r.employee_code || '—'}</td>
                        <td className="p-2 font-mono font-semibold text-gray-900">{r.punch_time}</td>
                        <td className="p-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            r.punch_type === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {r.punch_type}
                          </span>
                        </td>
                        <td className="p-2 text-gray-600">{r.device_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isProcessing || validCount === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Importing &amp; Recalculating…
              </>
            ) : (
              `Import & Recalculate (${validCount} Punches)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
