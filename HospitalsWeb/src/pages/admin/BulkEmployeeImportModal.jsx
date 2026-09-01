import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../../util/api';

const SAMPLE_DATA = [
  {
    'Employee Code': 'EMP-101',
    'Full Name': 'Dr. Rajesh Kumar',
    'Department Name': 'General Medicine',
    'Designation Name': 'Senior Consultant Physician',
    'Date of Joining': '2024-01-15',
    'Gender': 'male',
    'Date of Birth': '1985-06-20',
    'Mobile': '9876543210',
    'Qualification': 'MBBS, MD (General Medicine)',
    'Experience Description': '10+ years in tertiary clinical care and diagnosis',
    'Salary Type': 'monthly',
    'Basic Salary': 75000,
    'Per Day Salary': 2500,
    'Per Night Salary': 3000,
    'Bank Name': 'State Bank of India',
    'Bank Account No': '30495867201',
    'Bank IFSC': 'SBIN0001234',
    'UAN Number': '100904567890',
    'PF Enrolled': 'Yes',
    'ESI Number': '31001234560000001',
    'ESI Enrolled': 'No',
    'Address': '47, South Park Street, Gobichettipalayam',
    'Status': 'active',
  },
  {
    'Employee Code': 'EMP-102',
    'Full Name': 'Sister Priya M',
    'Department Name': 'Nursing',
    'Designation Name': 'Staff Nurse',
    'Date of Joining': '2024-02-01',
    'Gender': 'female',
    'Date of Birth': '1995-11-12',
    'Mobile': '9842154321',
    'Qualification': 'B.Sc Nursing (RN RM)',
    'Experience Description': '4 years in ICU and emergency ward patient care',
    'Salary Type': 'monthly',
    'Basic Salary': 25000,
    'Per Day Salary': 850,
    'Per Night Salary': 1000,
    'Bank Name': 'HDFC Bank',
    'Bank Account No': '50100234567890',
    'Bank IFSC': 'HDFC0000456',
    'UAN Number': '100904567891',
    'PF Enrolled': 'Yes',
    'ESI Number': '31001234560000002',
    'ESI Enrolled': 'Yes',
    'Address': 'Kutchery Medu, Gobichettipalayam',
    'Status': 'active',
  },
  {
    'Employee Code': 'EMP-103',
    'Full Name': 'Karthik S',
    'Department Name': 'Pharmacy',
    'Designation Name': 'Pharmacist',
    'Date of Joining': '2024-03-10',
    'Gender': 'male',
    'Date of Birth': '1998-04-05',
    'Mobile': '9789012345',
    'Qualification': 'B.Pharm, Registered Pharmacist',
    'Experience Description': '3 years dispensing and hospital pharmacy inventory management',
    'Salary Type': 'monthly',
    'Basic Salary': 22000,
    'Per Day Salary': 750,
    'Per Night Salary': 900,
    'Bank Name': 'Indian Overseas Bank',
    'Bank Account No': '012302000004567',
    'Bank IFSC': 'IOBA0000123',
    'UAN Number': '100904567892',
    'PF Enrolled': 'Yes',
    'ESI Number': '31001234560000003',
    'ESI Enrolled': 'Yes',
    'Address': 'Ganga Nagar, Gobichettipalayam',
    'Status': 'active',
  }
];

export function downloadEmployeeExcelTemplate(departments = []) {
  // 1. Create main template worksheet
  const wsTemplate = XLSX.utils.json_to_sheet(SAMPLE_DATA);

  // Set column widths
  wsTemplate['!cols'] = [
    { wch: 14 }, // Employee Code
    { wch: 22 }, // Full Name
    { wch: 20 }, // Department Name
    { wch: 28 }, // Designation Name
    { wch: 15 }, // Date of Joining
    { wch: 10 }, // Gender
    { wch: 14 }, // Date of Birth
    { wch: 14 }, // Mobile
    { wch: 30 }, // Qualification
    { wch: 40 }, // Experience Description
    { wch: 12 }, // Salary Type
    { wch: 14 }, // Basic Salary
    { wch: 15 }, // Per Day Salary
    { wch: 16 }, // Per Night Salary
    { wch: 24 }, // Bank Name
    { wch: 20 }, // Bank Account No
    { wch: 14 }, // Bank IFSC
    { wch: 16 }, // UAN Number
    { wch: 12 }, // PF Enrolled
    { wch: 20 }, // ESI Number
    { wch: 12 }, // ESI Enrolled
    { wch: 40 }, // Address
    { wch: 10 }, // Status
  ];

  // 2. Reference Sheet for existing Departments & Roles
  const refData = [];
  departments.forEach((d) => {
    const roles = Array.isArray(d.roles) ? d.roles : [];
    if (roles.length === 0) {
      refData.push({ 'Department Name': d.name, 'Existing Role / Designation': '—', 'Default Basic Salary': '—' });
    } else {
      roles.forEach((r) => {
        refData.push({
          'Department Name': d.name,
          'Existing Role / Designation': typeof r === 'object' ? r.roleName : r,
          'Default Basic Salary': typeof r === 'object' ? r.basicSalary : '—',
        });
      });
    }
  });

  const wsRef = XLSX.utils.json_to_sheet(refData.length ? refData : [{ 'Department Name': 'General', 'Existing Role / Designation': 'Staff', 'Default Basic Salary': 20000 }]);
  wsRef['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 20 }];

  // 3. Assemble workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsTemplate, 'Staff Template');
  XLSX.utils.book_append_sheet(wb, wsRef, 'Department Reference');

  XLSX.writeFile(wb, 'Neha_Hospital_Staff_Import_Template.xlsx');
}

export default function BulkEmployeeImportModal({ isOpen, onClose, departments, onSuccess }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processExcelFile(selectedFile);
  };

  const processExcelFile = (f) => {
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
          setErrorMsg('The selected spreadsheet is empty.');
          setParsedRows([]);
          return;
        }

        // Map and validate rows
        const normalized = rawJson.map((row, idx) => {
          const code = String(row['Employee Code'] || row['employee_code'] || row['Code'] || '').trim();
          const name = String(row['Full Name'] || row['full_name'] || row['Name'] || '').trim();
          const dept = String(row['Department Name'] || row['department_name'] || row['Department'] || '').trim();
          const role = String(row['Designation Name'] || row['designation_name'] || row['Role'] || row['Position'] || '').trim();
          const salary = Number(row['Basic Salary'] || row['basic_salary'] || row['Salary'] || 0);

          const isValid = !!code && !!name;
          return {
            _rowNum: idx + 2,
            _isValid: isValid,
            _validationNote: !code ? 'Missing Employee Code' : !name ? 'Missing Full Name' : 'Ready',
            employee_code: code,
            full_name: name,
            department_name: dept || 'General',
            designation_name: role || 'Staff Member',
            date_of_joining: row['Date of Joining'] || row['date_of_joining'] || new Date().toISOString().slice(0, 10),
            gender: String(row['Gender'] || row['gender'] || 'male').toLowerCase(),
            date_of_birth: row['Date of Birth'] || row['date_of_birth'] || '',
            phone: String(row['Mobile'] || row['phone'] || ''),
            qualification: row['Qualification'] || row['qualification'] || '',
            experience_description: row['Experience Description'] || row['experience_description'] || '',
            salary_type: String(row['Salary Type'] || row['salary_type'] || 'monthly').toLowerCase(),
            basic_salary: salary,
            per_day_salary: Number(row['Per Day Salary'] || row['per_day_salary'] || 0),
            per_night_salary: Number(row['Per Night Salary'] || row['per_night_salary'] || 0),
            bank_name: row['Bank Name'] || row['bank_name'] || '',
            bank_account_no: String(row['Bank Account No'] || row['bank_account_no'] || ''),
            bank_ifsc: row['Bank IFSC'] || row['bank_ifsc'] || '',
            uan_number: String(row['UAN Number'] || row['uan_number'] || ''),
            pf_enrolled: ['yes', 'y', '1', 'true'].includes(String(row['PF Enrolled'] || row['pf_enrolled'] || '').toLowerCase()) ? 1 : 0,
            esi_number: String(row['ESI Number'] || row['esi_number'] || ''),
            esi_enrolled: ['yes', 'y', '1', 'true'].includes(String(row['ESI Enrolled'] || row['esi_enrolled'] || '').toLowerCase()) ? 1 : 0,
            address: row['Address'] || row['address'] || '',
            status: String(row['Status'] || row['status'] || 'active').toLowerCase(),
          };
        });

        setParsedRows(normalized);
      } catch (err) {
        setErrorMsg('Failed to parse Excel file. Please ensure it is a valid .xlsx, .xls, or .csv file.');
        setParsedRows([]);
      }
    };

    reader.readAsArrayBuffer(f);
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => r._isValid);
    if (!validRows.length) {
      setErrorMsg('No valid employee rows to import.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMsg('');
      const res = await apiFetch('/hr/employees/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ employees: validRows }),
      });

      onSuccess(`Bulk import complete! ${res.inserted} employee(s) created, ${res.updated} updated.`);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Bulk employee import failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter((r) => r._isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
              📄
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Bulk Import Staff via Excel</h2>
              <p className="text-xs text-gray-500">Upload multiple employee profiles, department roles, and salary configurations at once.</p>
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

          {/* Action Row: Template Download & File Drag-and-drop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Download Template */}
            <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-4 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Step 1: Download Template</span>
                <h3 className="font-bold text-gray-900 text-sm mt-0.5">Official Excel Format</h3>
                <p className="text-gray-600 mt-1 leading-relaxed text-[11px]">
                  Pre-configured spreadsheet with all web fields, sample staff records, and reference tabs for departments and roles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadEmployeeExcelTemplate(departments)}
                className="mt-3 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 font-bold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>📥 Download Excel Template (.xlsx)</span>
              </button>
            </div>

            {/* Step 2: Upload File Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-blue-500 bg-gray-50/50 hover:bg-blue-50/30 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors space-y-1.5"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-full bg-blue-100/80 text-blue-600 flex items-center justify-center text-xl">
                📁
              </div>
              <div>
                <div className="font-bold text-gray-800 text-xs">
                  {fileName ? fileName : 'Click or Drag & Drop Excel File'}
                </div>
                <div className="text-[10px] text-gray-400">Supports .xlsx, .xls, and .csv files</div>
              </div>
            </div>
          </div>

          {/* Step 3: Parsed Data Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-gray-800">
                  <span>Spreadsheet Preview ({parsedRows.length} Rows Loaded):</span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">{validCount} Ready</span>
                  {invalidCount > 0 && (
                    <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[10px]">{invalidCount} Invalid</span>
                  )}
                </div>
                <span className="text-gray-400 text-[11px]">First 50 previewed</span>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-100/80 text-[10px] text-gray-600 font-bold uppercase sticky top-0 border-b border-gray-200">
                    <tr>
                      <th className="p-2">Status</th>
                      <th className="p-2">Emp Code</th>
                      <th className="p-2">Full Name</th>
                      <th className="p-2">Department</th>
                      <th className="p-2">Designation / Role</th>
                      <th className="p-2">Basic Salary</th>
                      <th className="p-2">Joining Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {parsedRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className={r._isValid ? 'hover:bg-gray-50/60' : 'bg-rose-50/40'}>
                        <td className="p-2 whitespace-nowrap">
                          {r._isValid ? (
                            <span className="text-emerald-700 font-bold">✓ Valid</span>
                          ) : (
                            <span className="text-rose-600 font-bold">✕ {r._validationNote}</span>
                          )}
                        </td>
                        <td className="p-2 font-mono font-bold text-blue-800">{r.employee_code || '—'}</td>
                        <td className="p-2 font-semibold text-gray-900">{r.full_name || '—'}</td>
                        <td className="p-2 text-gray-600">{r.department_name}</td>
                        <td className="p-2 text-gray-600">{r.designation_name}</td>
                        <td className="p-2 font-mono font-bold text-gray-900">
                          {r.basic_salary ? `₹${r.basic_salary.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="p-2 text-gray-500 whitespace-nowrap">{r.date_of_joining}</td>
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
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Importing Staff…
              </>
            ) : (
              `Confirm & Import ${validCount} Staff Members`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
