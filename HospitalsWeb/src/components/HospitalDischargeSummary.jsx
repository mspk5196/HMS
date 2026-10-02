import React from 'react';
import HospitalHeaderBanner from './HospitalHeaderBanner';

export default function HospitalDischargeSummary({ data, onClose }) {
  if (!data) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-gray-200/80 overflow-hidden flex flex-col my-auto print:shadow-none print:border-none print:max-w-full print:rounded-none">
        
        {/* Modal Action Bar (Hidden on print) */}
        <div className="px-6 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Inpatient Discharge Summary</span>
            <span className="text-[11px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full capitalize">
              {data.discharge_condition || 'Discharged'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.656h10.5z" />
              </svg>
              Print Summary
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Printable Content */}
        <div className="p-6 space-y-5 text-gray-900 print:p-0">
          <HospitalHeaderBanner />

          <div className="text-center pb-2 border-b border-gray-200">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">DISCHARGE SUMMARY</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Patient Name</div>
              <div className="font-bold text-gray-900">{data.patient_name || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Age / Gender</div>
              <div className="font-semibold text-gray-800">{data.age_years || '—'} Yrs / {data.gender || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Admission Date</div>
              <div className="font-semibold text-gray-800">{data.admission_date || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Discharge Date</div>
              <div className="font-semibold text-gray-800">{data.discharge_date || new Date().toLocaleDateString('en-IN')}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Attending Doctor</div>
              <div className="font-bold text-blue-900">Dr. {data.doctor_name || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Room / Bed</div>
              <div className="font-semibold text-gray-800">{data.bed_number || data.room_name || 'General'}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Discharge Condition</div>
              <div className="font-bold capitalize text-gray-900">{data.discharge_condition || 'Recovered'}</div>
            </div>
          </div>

          {/* Clinical Details */}
          <div className="space-y-3 text-xs">
            {data.diagnosis_summary && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Diagnosis at Discharge</span>
                <p className="p-2.5 bg-blue-50/40 rounded-lg border border-blue-100 text-blue-950 font-semibold">{data.diagnosis_summary}</p>
              </div>
            )}

            {data.treatment_summary && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Treatment & Procedures Given</span>
                <p className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-gray-800">{data.treatment_summary}</p>
              </div>
            )}

            {data.doctor_advice && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Advice on Discharge & Diet</span>
                <p className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-gray-800">{data.doctor_advice}</p>
              </div>
            )}

            {data.discharge_notes && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Discharge Notes</span>
                <p className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-gray-800">{data.discharge_notes}</p>
              </div>
            )}
          </div>

          {/* Footer Signature */}
          <div className="pt-6 border-t border-gray-200 flex items-end justify-between text-xs">
            <div>
              {data.follow_up_date && (
                <div className="text-gray-800 font-semibold">
                  <span className="text-gray-500">Next Follow-up Date:</span> {data.follow_up_date}
                </div>
              )}
              <div className="text-[10px] text-gray-400 mt-1">Generated electronically via Neha Hospital HMS</div>
            </div>
            <div className="text-right space-y-8">
              <div className="w-40 border-b border-gray-400 ml-auto"></div>
              <div className="text-xs font-bold text-gray-900">Dr. {data.doctor_name || 'Attending Physician'}</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
