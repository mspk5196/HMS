import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../../util/api';
import { useHospitalProfile } from '../../../context/HospitalProfileContext';
import HospitalHeaderBanner from '../../../components/HospitalHeaderBanner';
import {
  LandmarkIcon,
  CheckIcon,
  UploadIcon,
  TrashIcon,
  EyeIcon,
  DocumentTextIcon,
  InformationCircleIcon,
} from '../../../components/Icons';

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300';
  return (
    <div className={`text-xs font-semibold px-4 py-3 rounded-xl border shadow-xs animate-in fade-in duration-200 ${cls}`}>
      {msg}
    </div>
  );
}

export default function HospitalProfile() {
  const { refreshProfile } = useHospitalProfile();

  const [configs, setConfigs] = useState({
    HOSPITAL_NAME: 'Neha Hospitals',
    HOSPITAL_SUBTITLE: 'Speciality Hospital for Gynecology & Maternity · Pediatrics, Orthopedics & Gut Care',
    HOSPITAL_ADDRESS: '47, South Park Street (Kambar Veethi, Ganga Nagar), Kutchery Medu, Gobichettipalayam, Tamil Nadu - 638452',
    HOSPITAL_PHONE: '04285 - 222333',
    HOSPITAL_EMERGENCY: '+91 97894 94444',
    HOSPITAL_EMAIL: 'contact@nehahospitals.com',
    HOSPITAL_WEBSITE: 'www.nehahospitals.com',
    HOSPITAL_GSTIN: '33AAAAA0000A1Z5',
    HOSPITAL_REG_NO: 'Reg. No: NH/TN/638452 | NABH Entry-Level Accredited',
    HOSPITAL_HEADER_NOTE: '24x7 Emergency, Trauma, Critical Care & Pharmacy Services',
    HOSPITAL_LOGO_PATH: '',
    HOSPITAL_LOGO_DATA: '',
    FUTURE_BOOKING_ENABLED: '0',
    TOKEN_SCOPE: 'hospital',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [previewVariant, setPreviewVariant] = useState('receipt'); // 'receipt' | 'payslip'

  const fileInputRef = useRef(null);

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
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

  // Handle Logo Upload
  const handleLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (.png, .jpg, .jpeg, .svg, .webp).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Logo image file size must be less than 5 MB.');
      return;
    }

    try {
      setIsUploadingLogo(true);
      setErrorMsg('');

      // Preview immediately via FileReader
      const reader = new FileReader();
      reader.onload = async (uploadEvt) => {
        const base64Data = uploadEvt.target?.result;
        if (base64Data) {
          setConfigs((prev) => ({ ...prev, HOSPITAL_LOGO_DATA: base64Data }));
        }

        // Send to backend via FormData
        const formData = new FormData();
        formData.append('logo', file);

        try {
          const res = await apiFetch('/system/logo', {
            method: 'POST',
            body: formData,
          });
          const data = res?.data || res;
          if (data?.logoUrl) {
            setConfigs((prev) => ({
              ...prev,
              HOSPITAL_LOGO_PATH: data.logoUrl,
              HOSPITAL_LOGO_DATA: data.base64Data || base64Data,
            }));
          }
          await refreshProfile();
          flash('Hospital logo uploaded and updated successfully!');
        } catch (uploadErr) {
          setErrorMsg(uploadErr?.message || 'Failed to upload logo to server.');
        } finally {
          setIsUploadingLogo(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setErrorMsg(err?.message || 'Error processing logo image.');
      setIsUploadingLogo(false);
    }
  };

  // Handle Logo Removal
  const handleRemoveLogo = async () => {
    if (!window.confirm('Are you sure you want to remove the hospital logo? The default medical crest emblem will be used instead.')) {
      return;
    }

    try {
      setIsUploadingLogo(true);
      setErrorMsg('');
      await apiFetch('/system/logo', { method: 'DELETE' });
      setConfigs((prev) => ({
        ...prev,
        HOSPITAL_LOGO_PATH: '',
        HOSPITAL_LOGO_DATA: '',
      }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refreshProfile();
      flash('Hospital logo removed successfully.');
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to remove logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Save All Profile & Header Configs
  const save = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setErrorMsg('');

      // Update via atomic hospital profile endpoint
      await apiFetch('/system/hospital-profile', {
        method: 'PATCH',
        body: JSON.stringify({ configs }),
      });

      // Synchronize frontend context and storage
      await refreshProfile();
      flash('Hospital Profile and Printable Header configurations saved successfully!');
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save hospital settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentLogoSrc = configs.HOSPITAL_LOGO_DATA || configs.HOSPITAL_LOGO_PATH;

  return (
    <div className="space-y-6">
      {/* Page Section Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shadow-xs">
            <LandmarkIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Hospital Profile &amp; Printable Header</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Customize hospital branding, upload official logo, and edit the header banner used across bills, receipts, payslips, and printable reports.
            </p>
          </div>
        </div>

        {/* Live Preview Toggle Pill */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span className="px-2 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <EyeIcon className="w-3.5 h-3.5" /> Preview:
          </span>
          <button
            type="button"
            onClick={() => setPreviewVariant('receipt')}
            className={`px-2.5 py-1 rounded-md cursor-pointer transition-all ${
              previewVariant === 'receipt'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Bill / Receipt
          </button>
          <button
            type="button"
            onClick={() => setPreviewVariant('payslip')}
            className={`px-2.5 py-1 rounded-md cursor-pointer transition-all ${
              previewVariant === 'payslip'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Payslip / Report
          </button>
        </div>
      </div>

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      {/* ── LIVE INTERACTIVE HEADER PREVIEW CARD ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Live Printable Header Banner Preview
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {previewVariant === 'receipt' ? 'Centered Receipt Layout' : 'Report / Payslip Top Bar'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Real-time appearance on paper &amp; screen
          </span>
        </div>

        {/* Scaled Preview Canvas */}
        <div className="p-4 sm:p-6 bg-slate-50/70 dark:bg-slate-950/40 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
          <div className="bg-white text-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 max-w-3xl mx-auto">
            <HospitalHeaderBanner
              variant={previewVariant}
              documentTitle={previewVariant === 'payslip' ? 'OFFICIAL SALARY PAYSLIP' : 'PHARMACY PAYMENT RECEIPT & INVOICE'}
              documentMeta={
                previewVariant === 'payslip' ? (
                  <span className="text-[10px] text-slate-500 mt-1 block font-mono">OCTOBER 2026</span>
                ) : null
              }
            />
            <div className="text-center text-[10px] text-slate-400 py-3 italic">
              [ Patient Particulars / Prescription Items / Salary Earnings &amp; Deductions continue below ]
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 dark:text-slate-500">
          Loading hospital settings…
        </div>
      ) : (
        <form onSubmit={save} className="space-y-6">
          {/* ── LOGO UPLOADER SECTION ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Official Hospital Logo</span>
              <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                (Used in Header Banners, Sidebar Brand, and Sign-in page)
              </span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-50/60 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              {/* Logo Preview Square */}
              <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center p-2 shrink-0 shadow-xs overflow-hidden relative group">
                {currentLogoSrc ? (
                  <img
                    src={currentLogoSrc}
                    alt="Hospital Logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-1">
                    <svg className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 block leading-tight">No Logo</span>
                  </div>
                )}
              </div>

              {/* Upload Controls & Guidelines */}
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {currentLogoSrc ? 'Custom Logo Active' : 'Upload Your Hospital Crest or Brand Logo'}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Recommended: Transparent PNG, SVG, or high-res WebP/JPG (square or horizontal layout, minimum 200×200px, max 5 MB).
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <UploadIcon className="w-3.5 h-3.5" />
                    <span>{isUploadingLogo ? 'Uploading…' : currentLogoSrc ? 'Change Logo' : 'Upload Logo'}</span>
                  </button>

                  {currentLogoSrc && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={isUploadingLogo}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                      <span>Remove Logo</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── HEADER BANNER DETAILS ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Hospital Top Header Banner Information</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Hospital Name */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Hospital Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={configs.HOSPITAL_NAME || ''}
                  onChange={(e) => handleChange('HOSPITAL_NAME', e.target.value)}
                  placeholder="e.g. Neha Hospitals"
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Tagline / Subtitle */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Subtitle / Specialty Tagline
                </label>
                <input
                  type="text"
                  value={configs.HOSPITAL_SUBTITLE || ''}
                  onChange={(e) => handleChange('HOSPITAL_SUBTITLE', e.target.value)}
                  placeholder="e.g. Speciality Hospital for Gynecology & Maternity · Pediatrics, Orthopedics & Gut Care"
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Address (Full letterhead) */}
              <div className="space-y-1 md:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Full Hospital Address (Printed on Bills, Receipts &amp; Payslips) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={configs.HOSPITAL_ADDRESS || ''}
                  onChange={(e) => handleChange('HOSPITAL_ADDRESS', e.target.value)}
                  placeholder="Door No, Street name, Area, City, District, State, PIN code"
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Primary Phone */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Primary Contact Phone
                </label>
                <input
                  type="text"
                  value={configs.HOSPITAL_PHONE || ''}
                  onChange={(e) => handleChange('HOSPITAL_PHONE', e.target.value)}
                  placeholder="e.g. 04285 - 222333"
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Emergency Helpline */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  24x7 Emergency Contact / Helpline
                </label>
                <input
                  type="text"
                  value={configs.HOSPITAL_EMERGENCY || ''}
                  onChange={(e) => handleChange('HOSPITAL_EMERGENCY', e.target.value)}
                  placeholder="e.g. +91 97894 94444"
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Official Email */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Official Email Address
                </label>
                <input
                  type="email"
                  value={configs.HOSPITAL_EMAIL || ''}
                  onChange={(e) => handleChange('HOSPITAL_EMAIL', e.target.value)}
                  placeholder="e.g. contact@nehahospitals.com"
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Official Website */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Official Website URL
                </label>
                <input
                  type="text"
                  value={configs.HOSPITAL_WEBSITE || ''}
                  onChange={(e) => handleChange('HOSPITAL_WEBSITE', e.target.value)}
                  placeholder="e.g. www.nehahospitals.com"
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* GSTIN */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  GSTIN / Tax ID Number
                </label>
                <input
                  type="text"
                  value={configs.HOSPITAL_GSTIN || ''}
                  onChange={(e) => handleChange('HOSPITAL_GSTIN', e.target.value)}
                  placeholder="e.g. 33AAAAA0000A1Z5"
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Registration / NABH accreditation */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Hospital Reg. No / NABH Accreditation
                </label>
                <input
                  type="text"
                  value={configs.HOSPITAL_REG_NO || ''}
                  onChange={(e) => handleChange('HOSPITAL_REG_NO', e.target.value)}
                  placeholder="e.g. Reg. No: NH/TN/638452 | NABH Accredited"
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Header Note / Footer Subtext */}
              <div className="space-y-1 md:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Banner Note / Facilities Subtext
                </label>
                <input
                  type="text"
                  value={configs.HOSPITAL_HEADER_NOTE || ''}
                  onChange={(e) => handleChange('HOSPITAL_HEADER_NOTE', e.target.value)}
                  placeholder="e.g. 24 Hours Emergency, Trauma Care & In-Patient Facility"
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold px-6 py-2.5 rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <CheckIcon className="w-4 h-4" />
              <span>{isSaving ? 'Saving Changes…' : 'Save Hospital Profile & Header'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
