import React, { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { apiFetch } from '../../util/api';
import { DownloadIcon, XIcon, CheckIcon, DocumentTextIcon, FolderIcon } from '../../components/Icons';

async function fetchImageAsBase64(url) {
  if (!url) return null;
  try {
    const fullUrl = url.startsWith('http')
      ? url
      : `${(import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')}${url}`;
    const res = await fetch(fullUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const raw = reader.result;
        if (!raw || typeof raw !== 'string') {
          resolve(null);
          return;
        }
        const parts = raw.split(',');
        const base64 = parts[1];
        let ext = 'jpeg';
        if (blob.type.includes('png')) ext = 'png';
        resolve({ base64, extension: ext });
      };
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not fetch employee photo for export:', err);
    return null;
  }
}

export const ALL_EXPORT_COLUMNS = [
  // Mandatory
  { id: 'photo', label: 'Photo', group: 'Mandatory', defaultSelected: true },
  { id: 'employee_code', label: 'Employee ID', group: 'Mandatory', required: true, defaultSelected: true },
  { id: 'full_name', label: 'Employee Name', group: 'Mandatory', required: true, defaultSelected: true },

  // Organization & Role
  { id: 'department_name', label: 'Department', group: 'Organization & Role', defaultSelected: true },
  { id: 'designation_name', label: 'Designation / Staff Role', group: 'Organization & Role', defaultSelected: true },
  { id: 'role_name', label: 'System Access Role', group: 'Organization & Role', defaultSelected: false },
  { id: 'status', label: 'Employment Status', group: 'Organization & Role', defaultSelected: true },
  { id: 'date_of_joining', label: 'Date of Joining', group: 'Organization & Role', defaultSelected: true },

  // Contact & Personal
  { id: 'phone', label: 'Mobile / Phone', group: 'Personal & Contact', defaultSelected: true },
  { id: 'gender', label: 'Gender', group: 'Personal & Contact', defaultSelected: true },
  { id: 'date_of_birth', label: 'Date of Birth', group: 'Personal & Contact', defaultSelected: false },
  { id: 'address', label: 'Residential Address', group: 'Personal & Contact', defaultSelected: false },
  { id: 'qualification', label: 'Qualification', group: 'Personal & Contact', defaultSelected: false },
  { id: 'experience_description', label: 'Experience Description', group: 'Personal & Contact', defaultSelected: false },

  // Salary & Banking
  { id: 'basic_salary', label: 'Basic Salary (₹)', group: 'Salary & Banking', defaultSelected: true },
  { id: 'payment_mode', label: 'Payment Mode', group: 'Salary & Banking', defaultSelected: true },
  { id: 'bank_name', label: 'Bank Name', group: 'Salary & Banking', defaultSelected: true },
  { id: 'bank_account_no', label: 'Bank Account No', group: 'Salary & Banking', defaultSelected: true },
  { id: 'bank_ifsc', label: 'Bank IFSC Code', group: 'Salary & Banking', defaultSelected: true },

  // Statutory & Compliance
  { id: 'aadhar_number', label: 'Aadhaar Card No', group: 'Statutory & Compliance', defaultSelected: false },
  { id: 'pan_number', label: 'PAN Card No', group: 'Statutory & Compliance', defaultSelected: false },
  { id: 'uan_number', label: 'UAN (PF Number)', group: 'Statutory & Compliance', defaultSelected: true },
  { id: 'pf_enrolled', label: 'PF Enrolled (Yes/No)', group: 'Statutory & Compliance', defaultSelected: true },
  { id: 'esi_number', label: 'ESI Number', group: 'Statutory & Compliance', defaultSelected: true },
  { id: 'esi_enrolled', label: 'ESI Enrolled (Yes/No)', group: 'Statutory & Compliance', defaultSelected: true },

  // Shift & Leave Allowance
  { id: 'shift_category', label: 'Shift Category', group: 'Shift & Leaves', defaultSelected: false },
  { id: 'shift_timings', label: 'Shift Timings', group: 'Shift & Leaves', defaultSelected: false },
  { id: 'casual_leave_count', label: 'Casual Leaves Allowance', group: 'Shift & Leaves', defaultSelected: false },
  { id: 'privilege_leave_count', label: 'Privilege Leaves Allowance', group: 'Shift & Leaves', defaultSelected: false },
];

const PRESETS = {
  all: {
    name: 'All Details',
    columns: ALL_EXPORT_COLUMNS.map((c) => c.id),
  },
  standard: {
    name: 'Standard HR (Default)',
    columns: ALL_EXPORT_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.id),
  },
  payroll_bank: {
    name: 'Payroll & Banking',
    columns: [
      'employee_code', 'full_name', 'department_name', 'designation_name',
      'basic_salary', 'payment_mode', 'bank_name', 'bank_account_no', 'bank_ifsc',
      'uan_number', 'pf_enrolled', 'esi_number', 'esi_enrolled'
    ],
  },
  statutory: {
    name: 'Statutory & KYC',
    columns: [
      'employee_code', 'full_name', 'department_name', 'phone', 'gender',
      'date_of_birth', 'aadhar_number', 'pan_number', 'uan_number', 'esi_number', 'address'
    ],
  },
  contact: {
    name: 'Basic Directory',
    columns: [
      'photo', 'employee_code', 'full_name', 'department_name', 'designation_name',
      'phone', 'gender', 'date_of_joining', 'status'
    ],
  },
};

export default function EmployeeExportModal({
  isOpen,
  onClose,
  departments = [],
  initialDeptFilter = '',
  initialStatusFilter = 'active',
  initialSearch = '',
}) {
  const [selectedColIds, setSelectedColIds] = useState(() =>
    ALL_EXPORT_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.id)
  );

  const [deptFilter, setDeptFilter] = useState(initialDeptFilter || '');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || '');
  const [useSearchFilter, setUseSearchFilter] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState(initialSearch || '');

  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Group columns by category
  const groupedColumns = useMemo(() => {
    const map = {};
    ALL_EXPORT_COLUMNS.forEach((col) => {
      if (!map[col.group]) map[col.group] = [];
      map[col.group].push(col);
    });
    return map;
  }, []);

  const toggleColumn = (id, required) => {
    if (required) return; // Cannot toggle mandatory fields
    setSelectedColIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const applyPreset = (presetKey) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      // Ensure mandatory columns always included
      const mandatoryIds = ALL_EXPORT_COLUMNS.filter((c) => c.required).map((c) => c.id);
      setSelectedColIds(Array.from(new Set([...mandatoryIds, ...preset.columns])));
    }
  };

  const selectAll = () => {
    setSelectedColIds(ALL_EXPORT_COLUMNS.map((c) => c.id));
  };

  const deselectOptional = () => {
    setSelectedColIds(ALL_EXPORT_COLUMNS.filter((c) => c.required).map((c) => c.id));
  };

  const formatDateVal = (raw) => {
    if (!raw) return '';
    try {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return String(raw);
      return d.toISOString().slice(0, 10);
    } catch {
      return String(raw);
    }
  };

  const formatShiftCategory = (val) => {
    if (!val) return 'Day';
    if (val === 'day') return 'Day Shift';
    if (val === 'night') return 'Night Shift';
    if (val === 'day_and_night') return 'Day & Night Rotational';
    if (val === 'general') return 'General Shift';
    return String(val);
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setErrorMsg('');

      // Build query params to fetch all matching employees without pagination limit
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('limit', '5000'); // Fetch all matching employees

      if (deptFilter) params.append('departmentId', deptFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (useSearchFilter && searchKeyword.trim()) {
        params.append('search', searchKeyword.trim());
      }

      const res = await apiFetch(`/hr/employees?${params.toString()}`);
      const employeeList = Array.isArray(res) ? res : res?.rows || [];

      if (!employeeList.length) {
        setErrorMsg('No employees found matching the selected export filters.');
        setIsExporting(false);
        return;
      }

      // Prepare ordered active columns
      const activeColumns = ALL_EXPORT_COLUMNS.filter((col) =>
        selectedColIds.includes(col.id)
      );

      const hasPhotoCol = activeColumns.some((c) => c.id === 'photo');
      const photoColIdx = activeColumns.findIndex((c) => c.id === 'photo');

      // Create workbook using ExcelJS
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Neha Hospitals Management System';
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet('Employees Master', {
        views: [{ showGridLines: true }],
      });

      // Set columns
      worksheet.columns = activeColumns.map((col) => ({
        header: col.label,
        key: col.id,
        width: col.id === 'photo' ? 14 : Math.max(col.label.length + 5, 16),
      }));

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }, // Dark Blue #1e40af
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Populate data rows
      for (let i = 0; i < employeeList.length; i++) {
        const emp = employeeList[i];
        const rowData = {};

        activeColumns.forEach((col) => {
          switch (col.id) {
            case 'photo':
              rowData[col.id] = '';
              break;
            case 'employee_code':
              rowData[col.id] = emp.employee_code || '';
              break;
            case 'full_name':
              rowData[col.id] = emp.full_name || '';
              break;
            case 'department_name':
              rowData[col.id] = emp.department_name || 'General';
              break;
            case 'designation_name':
              rowData[col.id] = emp.designation_name || emp.role_name || '';
              break;
            case 'role_name':
              rowData[col.id] = emp.role_name || emp.designation_name || 'Staff';
              break;
            case 'status':
              rowData[col.id] = (emp.status || 'active').toUpperCase();
              break;
            case 'date_of_joining':
              rowData[col.id] = formatDateVal(emp.date_of_joining);
              break;
            case 'phone':
              rowData[col.id] = emp.phone || '';
              break;
            case 'gender':
              rowData[col.id] = emp.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1) : '';
              break;
            case 'date_of_birth':
              rowData[col.id] = formatDateVal(emp.date_of_birth);
              break;
            case 'address':
              rowData[col.id] = emp.address || '';
              break;
            case 'qualification':
              rowData[col.id] = emp.qualification || '';
              break;
            case 'experience_description':
              rowData[col.id] = emp.experience_description || '';
              break;
            case 'basic_salary':
              rowData[col.id] = Number(emp.base_salary || emp.basic_salary || 0);
              break;
            case 'payment_mode':
              rowData[col.id] = emp.payment_mode ? emp.payment_mode.toUpperCase() : 'ACCOUNT';
              break;
            case 'bank_name':
              rowData[col.id] = emp.bank_name || '';
              break;
            case 'bank_account_no':
              rowData[col.id] = emp.bank_account_no || '';
              break;
            case 'bank_ifsc':
              rowData[col.id] = emp.bank_ifsc || '';
              break;
            case 'aadhar_number':
              rowData[col.id] = emp.aadhar_number || '';
              break;
            case 'pan_number':
              rowData[col.id] = emp.pan_number || '';
              break;
            case 'uan_number':
              rowData[col.id] = emp.uan_number || '';
              break;
            case 'pf_enrolled':
              rowData[col.id] = emp.pf_enrolled ? 'Yes' : 'No';
              break;
            case 'esi_number':
              rowData[col.id] = emp.esi_number || '';
              break;
            case 'esi_enrolled':
              rowData[col.id] = emp.esi_enrolled ? 'Yes' : 'No';
              break;
            case 'shift_category':
              rowData[col.id] = formatShiftCategory(emp.shift_category);
              break;
            case 'shift_timings':
              rowData[col.id] = emp.custom_shift_start && emp.custom_shift_end
                ? `${String(emp.custom_shift_start).slice(0, 5)} - ${String(emp.custom_shift_end).slice(0, 5)}`
                : 'Standard';
              break;
            case 'casual_leave_count':
              rowData[col.id] = Number(emp.casual_leave_count || 0);
              break;
            case 'privilege_leave_count':
              rowData[col.id] = Number(emp.privilege_leave_count || 0);
              break;
            default:
              rowData[col.id] = emp[col.id] ?? '';
          }
        });

        const newRow = worksheet.addRow(rowData);
        const rowNumber = newRow.number;

        newRow.alignment = { vertical: 'middle' };

        if (hasPhotoCol) {
          newRow.height = 55; // Height for thumbnail image
          if (emp.photo_path) {
            const imgData = await fetchImageAsBase64(emp.photo_path);
            if (imgData) {
              const imageId = workbook.addImage({
                base64: imgData.base64,
                extension: imgData.extension,
              });
              worksheet.addImage(imageId, {
                tl: { col: photoColIdx + 0.15, row: rowNumber - 1 + 0.08 },
                ext: { width: 48, height: 48 },
                editAs: 'oneCell',
              });
            } else {
              newRow.getCell(photoColIdx + 1).value = '(No Photo)';
              newRow.getCell(photoColIdx + 1).alignment = { vertical: 'middle', horizontal: 'center' };
            }
          } else {
            newRow.getCell(photoColIdx + 1).value = '(No Photo)';
            newRow.getCell(photoColIdx + 1).alignment = { vertical: 'middle', horizontal: 'center' };
          }
        } else {
          newRow.height = 22;
        }
      }

      // Generate filename with timestamp and filters
      const dateTag = new Date().toISOString().slice(0, 10);
      let deptTag = '';
      if (deptFilter) {
        const dObj = departments.find((d) => String(d.id) === String(deptFilter));
        if (dObj) deptTag = `_${dObj.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
      const filename = `Neha_Hospital_Employees${deptTag}_${dateTag}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setIsExporting(false);
      onClose();
    } catch (err) {
      console.error('Export error:', err);
      setErrorMsg(err.message || 'Failed to export employees to Excel.');
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 to-transparent dark:from-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <DownloadIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Export Employees to Excel (.xlsx)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose the columns and demographic criteria to include in the spreadsheet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Section 1: Presets & Quick Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                Quick Column Presets
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={deselectOptional}
                  className="text-slate-500 dark:text-slate-400 hover:underline font-semibold cursor-pointer"
                >
                  Reset to Required
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700 text-slate-700 dark:text-slate-300 font-medium transition-colors cursor-pointer"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Column Selection Grouped */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                Select Columns to Export ({selectedColIds.length} of {ALL_EXPORT_COLUMNS.length} selected)
              </span>
            </div>

            <div className="space-y-4 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
              {Object.entries(groupedColumns).map(([groupName, cols]) => (
                <div key={groupName} className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-700/60 pb-1">
                    <span>{groupName}</span>
                    {groupName === 'Mandatory' && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                        (Required — Always Included)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {cols.map((col) => {
                      const isChecked = selectedColIds.includes(col.id);
                      return (
                        <label
                          key={col.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer select-none ${
                            col.required
                              ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 cursor-not-allowed opacity-90'
                              : isChecked
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-white font-medium'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={col.required}
                            onChange={() => toggleColumn(col.id, col.required)}
                            className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className="truncate" title={col.label}>
                            {col.label}
                          </span>
                          {col.required && (
                            <span className="ml-auto text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                              Fixed
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Filter & Scope */}
          <div className="space-y-3 pt-2">
            <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
              Export Filters & Scope
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Department
                </label>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Employment Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="active">Active Employees Only</option>
                  <option value="">All (Active & Inactive)</option>
                  <option value="inactive">Inactive Employees Only</option>
                </select>
              </div>
            </div>

            {searchKeyword && (
              <label className="flex items-center gap-2 pt-1 text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSearchFilter}
                  onChange={(e) => setUseSearchFilter(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>
                  Apply current search keyword filter: <strong className="text-slate-900 dark:text-white">"{searchKeyword}"</strong>
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {selectedColIds.length}
            </span>{' '}
            columns selected
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || selectedColIds.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Generating Excel...</span>
                </>
              ) : (
                <>
                  <DownloadIcon className="w-4 h-4" />
                  <span>Download .xlsx Spreadsheet</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
