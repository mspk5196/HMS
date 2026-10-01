import React from 'react';
import { useHospitalProfile } from '../context/HospitalProfileContext';

export default function HospitalHeaderBanner({
  documentTitle,
  documentMeta,
  variant = 'receipt',
  showLogo = true,
  className = '',
}) {
  const {
    hospitalName,
    hospitalSubtitle,
    hospitalAddress,
    hospitalPhone,
    hospitalEmergency,
    hospitalEmail,
    hospitalWebsite,
    hospitalGstin,
    hospitalRegNo,
    hospitalHeaderNote,
    hospitalLogo,
  } = useHospitalProfile();

  // Contact items combined cleanly
  const contactParts = [];
  if (hospitalPhone) contactParts.push(`Tel: ${hospitalPhone}`);
  if (hospitalEmergency) contactParts.push(`24x7 Helpline: ${hospitalEmergency}`);
  if (hospitalEmail) contactParts.push(`Email: ${hospitalEmail}`);
  if (hospitalWebsite) contactParts.push(`Web: ${hospitalWebsite}`);

  // Statutory items combined cleanly
  const statutoryParts = [];
  if (hospitalGstin) statutoryParts.push(`GSTIN: ${hospitalGstin}`);
  if (hospitalRegNo) statutoryParts.push(hospitalRegNo);

  if (variant === 'payslip' || variant === 'report') {
    return (
      <div className={`border-b-2 border-slate-900 pb-3 mb-4 print:border-black ${className}`}>
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3.5">
            {showLogo && (
              <div className="shrink-0 flex items-center justify-center">
                {hospitalLogo ? (
                  <img
                    src={hospitalLogo}
                    alt={hospitalName}
                    className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-xl p-0.5 border border-slate-200 print:border-none"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 text-white flex items-center justify-center font-extrabold text-xl shadow-sm border border-emerald-300 shrink-0 print:border-black print:bg-black print:text-white">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      <circle cx="12" cy="12" r="9" strokeWidth="1.5" strokeDasharray="2 2" />
                    </svg>
                  </div>
                )}
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 print:text-black tracking-tight uppercase leading-tight">
                {hospitalName}
              </h1>
              {hospitalSubtitle && (
                <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 print:text-black uppercase tracking-wider mt-0.5">
                  {hospitalSubtitle}
                </div>
              )}
              {hospitalAddress && (
                <p className="text-[10px] text-slate-600 print:text-black leading-snug mt-1 max-w-xl">
                  {hospitalAddress}
                </p>
              )}
              {contactParts.length > 0 && (
                <p className="text-[9.5px] text-slate-500 print:text-gray-700 font-medium mt-0.5">
                  {contactParts.join(' | ')}
                </p>
              )}
              {statutoryParts.length > 0 && (
                <p className="text-[9px] text-slate-500 print:text-gray-700 font-semibold mt-0.5">
                  {statutoryParts.join(' | ')}
                </p>
              )}
            </div>
          </div>

          {(documentTitle || documentMeta) && (
            <div className="text-right flex flex-col items-center sm:items-end justify-center shrink-0">
              {documentTitle && (
                <span className="inline-block bg-slate-900 text-white font-extrabold text-[11px] px-3.5 py-1 rounded-md uppercase tracking-wider print:bg-black print:text-white">
                  {documentTitle}
                </span>
              )}
              {documentMeta}
            </div>
          )}
        </div>
        {hospitalHeaderNote && (
          <div className="text-[9px] text-center text-slate-500 print:text-gray-700 italic border-t border-slate-100 print:border-gray-300 pt-1 mt-2">
            {hospitalHeaderNote}
          </div>
        )}
      </div>
    );
  }

  // Standard Receipt / Bill Layout (Centered, prominent brand banner)
  return (
    <div className={`border-b-2 border-slate-900 pb-4 text-center space-y-1.5 print:border-black ${className}`}>
      <div className="flex items-center justify-center gap-3">
        {showLogo && (
          <div className="shrink-0">
            {hospitalLogo ? (
              <img
                src={hospitalLogo}
                alt={hospitalName}
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-lg p-0.5 border border-slate-200 print:border-none inline-block"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-700 to-slate-900 text-white flex items-center justify-center font-black text-sm shadow-xs border border-emerald-300 print:bg-black print:text-white print:border-black inline-flex">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
            )}
          </div>
        )}
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 print:text-black tracking-wider uppercase leading-none">
            {hospitalName}
          </h1>
          {hospitalSubtitle && (
            <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 print:text-black uppercase tracking-wide mt-1">
              {hospitalSubtitle}
            </p>
          )}
        </div>
      </div>

      {hospitalAddress && (
        <p className="text-[11px] text-slate-700 print:text-black font-medium max-w-2xl mx-auto leading-snug">
          {hospitalAddress}
        </p>
      )}

      {contactParts.length > 0 && (
        <p className="text-[10px] text-slate-600 print:text-gray-800 font-medium">
          {contactParts.join(' | ')}
        </p>
      )}

      {statutoryParts.length > 0 && (
        <p className="text-[9.5px] text-slate-500 print:text-gray-700 font-semibold">
          {statutoryParts.join(' | ')}
        </p>
      )}

      {hospitalHeaderNote && (
        <p className="text-[9px] text-slate-400 print:text-gray-600 italic">
          {hospitalHeaderNote}
        </p>
      )}
    </div>
  );
}
