import React from 'react';
import HospitalHeaderBanner from './HospitalHeaderBanner';

export default function HospitalPrescription({ data, onClose }) {
  if (!data) return null;

  const handlePrint = () => {
    window.print();
  };

  const vitalsList = [
    data.bp_systolic && data.bp_diastolic && { label: 'BP', value: `${data.bp_systolic}/${data.bp_diastolic} mmHg` },
    data.temperature && { label: 'Temp', value: `${data.temperature} °C` },
    data.pulse && { label: 'Pulse', value: `${data.pulse} bpm` },
    data.spo2 && { label: 'SpO₂', value: `${data.spo2} %` },
    data.weight && { label: 'Weight', value: `${data.weight} kg` },
    data.height && { label: 'Height', value: `${data.height} cm` },
    data.blood_sugar && { label: 'Blood Sugar', value: `${data.blood_sugar} mg/dL` },
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-200/80 overflow-hidden flex flex-col my-auto print:shadow-none print:border-none print:max-w-full print:rounded-none">
        
        {/* Modal Action Bar (Hidden on print) */}
        <div className="px-6 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Digital Prescription</span>
            <span className="text-[11px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
              Token #{String(data.token_number || '').padStart(2, '0')}
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
              Print Rx Slip
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

        {/* Prescription Printable Content */}
        <div className="p-6 space-y-5 text-gray-900 print:p-0">
          <HospitalHeaderBanner />

          <div className="border-t border-b border-gray-200 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Patient Name</div>
              <div className="font-bold text-gray-900">{data.patient_name || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Age / Gender</div>
              <div className="font-semibold text-gray-800">{data.age_years || '—'} Yrs / {data.gender || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Doctor</div>
              <div className="font-bold text-blue-900">Dr. {data.doctor_name || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Date</div>
              <div className="font-semibold text-gray-800">{data.date || new Date().toLocaleDateString('en-IN')}</div>
            </div>
          </div>

          {/* Vitals Summary if available */}
          {vitalsList.length > 0 && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3">
              <div className="text-[10px] font-bold text-blue-900 uppercase tracking-wider mb-1.5">Recorded Vitals</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {vitalsList.map((v, i) => (
                  <span key={i} className="text-gray-700">
                    <strong className="text-gray-900 font-semibold">{v.label}:</strong> {v.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Complaints & Diagnosis */}
          {(data.diagnosis || data.complaints) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-gray-50/60 p-3 rounded-lg border border-gray-100">
              {data.complaints && (
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Chief Complaints</span>
                  <p className="font-medium text-gray-800 mt-0.5">{data.complaints}</p>
                </div>
              )}
              {data.diagnosis && (
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Diagnosis</span>
                  <p className="font-bold text-blue-950 mt-0.5">{data.diagnosis}</p>
                </div>
              )}
            </div>
          )}

          {/* Rx Medication Table */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-serif italic text-blue-900">℞</span>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Prescribed Medications</span>
            </div>

            {data.items?.length > 0 ? (
              <table className="w-full text-left text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 text-[10px] text-gray-600 uppercase font-bold">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">Medicine Name</th>
                    <th className="p-2.5 text-center">Dosage (M-A-N)</th>
                    <th className="p-2.5 text-center">Duration</th>
                    <th className="p-2.5">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="p-2.5 text-gray-400 font-semibold">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-gray-900">{it.medicine_name}</td>
                      <td className="p-2.5 text-center font-semibold text-blue-800">
                        {it.dose_morning || 0} - {it.dose_afternoon || 0} - {it.dose_night || 0}
                      </td>
                      <td className="p-2.5 text-center font-medium text-gray-700">{it.duration_days || 1} day(s)</td>
                      <td className="p-2.5 capitalize text-gray-600 font-medium">
                        {(it.food_instruction || '').replace(/_/g, ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-xs text-gray-400 italic p-3 border border-gray-100 rounded-lg">No medicines prescribed.</div>
            )}
          </div>

          {/* Doctor Notes / Advice */}
          {data.notes && (
            <div className="text-xs space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Doctor's Advice & Remarks</span>
              <p className="text-gray-700 font-medium p-2.5 bg-gray-50 rounded-lg border border-gray-100">{data.notes}</p>
            </div>
          )}

          {/* Follow-up & Doctor Signature Footer */}
          <div className="pt-6 border-t border-gray-200 flex items-end justify-between text-xs">
            <div>
              {data.follow_up_date && (
                <div className="text-gray-700 font-medium">
                  <span className="font-bold text-gray-900">Follow-up Visit:</span> {data.follow_up_date}
                </div>
              )}
              <div className="text-[10px] text-gray-400 mt-1">Generated electronically via Neha Hospital HMS</div>
            </div>
            <div className="text-right space-y-8">
              <div className="w-36 border-b border-gray-400 ml-auto"></div>
              <div className="text-xs font-bold text-gray-900">Dr. {data.doctor_name || 'Doctor Signature'}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
