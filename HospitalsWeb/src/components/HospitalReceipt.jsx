import React, { useEffect, useState } from 'react';
import { apiFetch } from '../util/api';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function HospitalReceipt({ type, data, onClose }) {
  const [pharmacyItems, setPharmacyItems] = useState(data?.items || []);
  const [fetchedDocInfo, setFetchedDocInfo] = useState({ name: '', qualification: '' });
  const [fetchedBillNum, setFetchedBillNum] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);

  // If it's a pharmacy receipt/bill and full items or doctor aren't attached yet, fetch the full bill
  useEffect(() => {
    const billKey = data?.pharmacy_bill_id || data?.bill_number;
    if (type === 'pharmacy' && billKey && (!data.items || data.items.length === 0 || !data.doctor_name)) {
      (async () => {
        try {
          setLoadingItems(true);
          const fullBill = await apiFetch(`/pharmacy/bills/${billKey}`);
          if (fullBill) {
            if (Array.isArray(fullBill.items)) {
              setPharmacyItems(fullBill.items);
            }
            if (fullBill.doctor_name) {
              setFetchedDocInfo({
                name: fullBill.doctor_name,
                qualification: fullBill.doctor_qualification || fullBill.doctor_designation || '',
              });
            }
            if (fullBill.bill_number) {
              setFetchedBillNum(fullBill.bill_number);
            }
          }
        } catch (err) {
          console.error('Failed to load pharmacy bill details:', err);
        } finally {
          setLoadingItems(false);
        }
      })();
    }
  }, [type, data]);

  if (!data) return null;

  const isPaid = Boolean(
    data.is_paid ||
    data.payment_status === 'paid' ||
    (data.receipt_number && Number(data.amount_paid_now || data.amount_paid || data.total_amount || 0) > 0 && !data.is_bill)
  );

  const receiptTitle = isPaid
    ? (type === 'opd'
        ? 'OPD CONSULTATION RECEIPT'
        : type === 'ipd'
        ? 'IPD DISCHARGE & SETTLEMENT RECEIPT'
        : 'PHARMACY PAYMENT RECEIPT & TAX INVOICE')
    : (type === 'opd'
        ? 'OPD CONSULTATION BILL / ESTIMATE'
        : type === 'ipd'
        ? 'IPD DISCHARGE BILL / SUMMARY'
        : 'PHARMACY BILL / ESTIMATE');

  const receiptNo = data.receipt_number || data.receiptNumber || `RCPT-${Date.now().toString().slice(-6)}`;
  const billNo = data.bill_number || data.billNumber || fetchedBillNum || (type === 'opd' ? `OPD-${data.appointment_id || ''}` : type === 'ipd' ? `IPD-${data.admission_id || ''}` : `PB-${data.pharmacy_bill_id || ''}`);
  const dateStr = data.payment_date || data.bill_date || data.discharge_datetime || new Date().toISOString();
  const formattedDate = new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  });

  const patientName = data.patient_name || '—';
  const mobile = data.mobile_number || data.mobile || '—';
  const ageGender = data.age_years ? `${data.age_years} Yrs / ${data.gender || '—'}` : '—';
  const doctorName = data.doctor_name || fetchedDocInfo.name || '—';
  const doctorQualification = data.doctor_qualification || data.doctor_designation || fetchedDocInfo.qualification || '';
  const paymentMode = (data.payment_mode || 'cash').toUpperCase();
  const receivedBy = data.received_by_name || data.generated_by_name || 'Billing Desk';

  // Amount computations
  const netAmount = Number(data.net_amount || data.final_bill_amount || data.total_amount || data.doctor_fee || 0);
  const paidNow = isPaid ? Number(data.amount_paid_now || data.amount_paid || data.amount || netAmount) : Number(data.paid_amount || data.amount_paid || 0);
  const balanceDue = Number(data.balance_due !== undefined ? data.balance_due : data.balance !== undefined ? data.balance : (netAmount - paidNow));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-receipt, #printable-receipt * { visibility: visible; }
          #printable-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Action Header bar (hidden on print) */}
        <div className="no-print bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPaid ? (
              <>
                <span className="text-emerald-400 font-bold text-sm">✓ Payment Completed</span>
                <span className="text-gray-400 text-xs">| {receiptNo}</span>
              </>
            ) : (
              <>
                <span className="text-amber-400 font-bold text-sm">📄 Payment Pending / Bill</span>
                <span className="text-gray-400 text-xs">| {billNo}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className={`${isPaid ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'} text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231a1.125 1.125 0 01-1.12-1.227L6.34 18m11.318-4.171A3 3 0 0015 11.25H9a3 3 0 00-2.658 1.579M18 10.5H6M6 6h12" />
              </svg>
              {isPaid ? 'Print Receipt' : 'Print Bill'}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer"
              >
                Close ✕
              </button>
            )}
          </div>
        </div>

        {/* Printable Receipt Canvas */}
        <div id="printable-receipt" className="p-8 space-y-6 overflow-y-auto bg-white text-gray-800 text-xs">
          
          {/* Hospital Header */}
          <div className="border-b-2 border-blue-900 pb-4 text-center space-y-1">
            <h1 className="text-xl font-extrabold text-blue-900 tracking-wider">NEHA HOSPITAL</h1>
            <p className="text-[11px] text-gray-700 font-medium">
              47, South Park Street (Kambar Veethi, Ganga Nagar), Kutchery Medu, Gobichettipalayam, Tamil Nadu - 638452
            </p>
            <p className="text-[10px] text-gray-500">
              (Opp. Palaniammal Girls HR SEC School, Near Dr. Ravindran Hospital) | 24 Hours Emergency & Medical Facility
            </p>
            <div className="pt-2">
              <span className={`inline-block ${isPaid ? 'bg-blue-900' : 'bg-amber-800'} text-white font-extrabold text-[11px] px-4 py-1 rounded-full uppercase tracking-wider shadow-sm`}>
                {receiptTitle}
              </span>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/80 grid grid-cols-2 gap-4 text-[11px]">
            <div className="space-y-1">
              {isPaid ? (
                <div className="flex"><span className="w-28 font-bold text-gray-500">Receipt No:</span><span className="font-extrabold text-gray-900">{receiptNo}</span></div>
              ) : (
                <div className="flex"><span className="w-28 font-bold text-gray-500">Status:</span><span className="font-extrabold text-amber-700 uppercase">UNPAID / BILL</span></div>
              )}
              <div className="flex"><span className="w-28 font-bold text-gray-500">Reference / Bill #:</span><span className="font-semibold text-blue-700">{billNo}</span></div>
              <div className="flex"><span className="w-28 font-bold text-gray-500">Date & Time:</span><span className="font-semibold text-gray-800">{formattedDate}</span></div>
              <div className="flex"><span className="w-28 font-bold text-gray-500">Payment Mode:</span><span className="font-bold text-emerald-700">{isPaid ? paymentMode : 'Pending Settlement'}</span></div>
            </div>
            <div className="space-y-1">
              <div className="flex"><span className="w-28 font-bold text-gray-500">Patient Name:</span><span className="font-bold text-gray-900">{patientName}</span></div>
              <div className="flex"><span className="w-28 font-bold text-gray-500">Mobile No:</span><span className="font-semibold text-gray-800">{mobile}</span></div>
              <div className="flex"><span className="w-28 font-bold text-gray-500">Age / Gender:</span><span className="font-semibold text-gray-800">{ageGender}</span></div>
              <div className="flex">
                <span className="w-28 font-bold text-gray-500">{type === 'pharmacy' ? 'Prescribed Dr:' : 'Consultant Dr:'}</span>
                <span className="font-bold text-gray-900">
                  {doctorName && doctorName !== '—' ? `Dr. ${doctorName}` : '—'}
                  {doctorQualification && <span className="block text-[10px] text-blue-800 font-semibold">{doctorQualification}</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <h3 className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">
              {type === 'pharmacy' ? 'Medicine & Item Particulars' : 'Fee Breakdown'}
            </h3>

            {type === 'pharmacy' ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {loadingItems ? (
                  <div className="p-4 text-center text-gray-400 text-xs">Loading medicine line items…</div>
                ) : (
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-200">
                      <tr>
                        <th className="p-2.5 w-8">#</th>
                        <th className="p-2.5">Medicine Name</th>
                        <th className="p-2.5">Batch</th>
                        <th className="p-2.5">Expiry</th>
                        <th className="p-2.5 text-right">Qty</th>
                        <th className="p-2.5 text-right">Unit Rate (₹)</th>
                        <th className="p-2.5 text-right">Disc %</th>
                        <th className="p-2.5 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pharmacyItems.length > 0 ? (
                        pharmacyItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="p-2.5 text-gray-400 font-medium">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-gray-900">
                              {item.medicine_name || item.name}
                              {item.generic_name && <span className="block text-[10px] text-gray-400 font-normal">{item.generic_name}</span>}
                            </td>
                            <td className="p-2.5 text-gray-600 font-mono text-[10px]">{item.batch_number || '—'}</td>
                            <td className="p-2.5 text-gray-600 font-mono text-[10px]">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN') : '—'}</td>
                            <td className="p-2.5 text-right font-bold text-gray-800">{item.quantity}</td>
                            <td className="p-2.5 text-right font-semibold text-gray-700">{money(item.unit_price)}</td>
                            <td className="p-2.5 text-right text-gray-500">{item.discount_percent || 0}%</td>
                            <td className="p-2.5 text-right font-bold text-gray-900">{money(item.total_price || (item.quantity * item.unit_price * (1 - (item.discount_percent || 0)/100)))}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="p-4 text-center text-gray-400">Pharmacy Bill Charges ({money(netAmount)})</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            ) : type === 'opd' ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-2.5 w-8">#</th>
                      <th className="p-2.5">Particulars</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2.5 text-gray-400 font-medium">1</td>
                      <td className="p-2.5 font-bold text-gray-900">Doctor OPD Consultation Fee (Dr. {doctorName})</td>
                      <td className="p-2.5 text-gray-600">Consultation</td>
                      <td className="p-2.5 text-right font-bold text-gray-900">{money(data.doctor_fee || netAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-2.5 w-8">#</th>
                      <th className="p-2.5">Particulars / Charge Head</th>
                      <th className="p-2.5 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="p-2.5 text-gray-400 font-medium">1</td>
                      <td className="p-2.5 font-bold text-gray-900">IPD Room & Stay Charges</td>
                      <td className="p-2.5 text-right font-bold text-gray-900">{money(data.room_charges)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-gray-400 font-medium">2</td>
                      <td className="p-2.5 font-bold text-gray-900">Pharmacy & Medicines Total</td>
                      <td className="p-2.5 text-right font-bold text-gray-900">{money(data.pharmacy_charges)}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-gray-400 font-medium">3</td>
                      <td className="p-2.5 font-bold text-gray-900">Doctor Visiting & Consultation Fee</td>
                      <td className="p-2.5 text-right font-bold text-gray-900">{money(data.doctor_fee)}</td>
                    </tr>
                    {Number(data.other_charges) > 0 && (
                      <tr>
                        <td className="p-2.5 text-gray-400 font-medium">4</td>
                        <td className="p-2.5 font-bold text-gray-900">Other Hospital Charges</td>
                        <td className="p-2.5 text-right font-bold text-gray-900">{money(data.other_charges)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Financial Summary Box */}
          <div className="flex justify-end pt-2">
            <div className="w-72 bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal Net:</span>
                <span className="font-bold text-gray-900">{money(netAmount)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold border-t border-gray-200 pt-2">
                <span>Amount Paid Now:</span>
                <span>{money(paidNow)}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-extrabold border-t border-gray-200 pt-2 text-sm">
                <span>Balance Due:</span>
                <span>{money(balanceDue)}</span>
              </div>
            </div>
          </div>

          {/* Terms & Footer Signatures */}
          <div className="pt-8 border-t border-dashed border-gray-300 grid grid-cols-2 gap-8 text-[10px] text-gray-500">
            <div>
              <p className="font-bold text-gray-700">Important Notes & Policy:</p>
              <ul className="list-disc list-inside space-y-0.5 mt-1">
                {type === 'pharmacy' ? (
                  <>
                    <li>Medicines once sold can only be returned within 7 days with original invoice.</li>
                    <li>Refrigerated items and cut strips are non-returnable.</li>
                  </>
                ) : (
                  <>
                    <li>This is a computer-generated official payment receipt.</li>
                    <li>Please retain this receipt for any reimbursement or clearance queries.</li>
                  </>
                )}
              </ul>
              <p className="mt-3 text-gray-400 italic">Issued By: {receivedBy}</p>
            </div>

            <div className="flex flex-col justify-between text-right space-y-8">
              <div className="h-10"></div>
              <div>
                <div className="border-t border-gray-400 w-40 ml-auto pt-1 font-bold text-gray-700">
                  Authorized Signatory / Stamp
                </div>
                <p className="text-[10px] text-blue-900 font-bold mt-1">Neha Hospital, Gobichettipalayam</p>
              </div>
            </div>
          </div>

          {/* Bottom Tagline */}
          <div className="text-center text-[10px] text-gray-400 font-semibold pt-2 border-t border-gray-100">
            Thank you for choosing Neha Hospital, Gobichettipalayam. We wish you good health & a speedy recovery!
          </div>
        </div>
      </div>
    </div>
  );
}
