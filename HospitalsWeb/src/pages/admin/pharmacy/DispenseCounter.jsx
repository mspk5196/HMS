import React, { useState, useEffect, useMemo } from 'react';
import MedicineSearchSelect from '../../../components/MedicineSearchSelect';
import { apiFetch } from '../../../util/api';
import { formatCurrency, todayISO } from './pharmacyUtils';

const emptyLine = { medicine_id: '', unit_type: 'tablet', quantity: '', discount_percent: '' };

export default function DispenseCounter() {
  const [medicines, setMedicines] = useState([]);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [patient, setPatient] = useState(null);
  const [prescriptionTerms, setPrescriptionTerms] = useState('');
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const [discountAmount, setDiscountAmount] = useState('0');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [generatedBill, setGeneratedBill] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await apiFetch('/pharmacy/medicines?limit=500', { withMeta: true });
        setMedicines(Array.isArray(result.data) ? result.data : []);
      } catch (err) {
        setErrorMsg(err.message || 'Failed to load medicines.');
      }
    })();
  }, []);

  useEffect(() => {
    const q = patientQuery.trim();
    if (!q) { setPatientResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const result = await apiFetch(`/patient/patients?search=${encodeURIComponent(q)}&limit=8`, { withMeta: true });
        setPatientResults(Array.isArray(result.data) ? result.data : []);
      } catch {
        setPatientResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  const medicineById = useMemo(() => Object.fromEntries(medicines.map((m) => [String(m.id), m])), [medicines]);

  const updateLine = (idx, key, value) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  const addLine = () => setLines((prev) => [...prev, { ...emptyLine }]);
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  /** "Doctor's request to generate" — pull matching medicines from a free-typed prescription list. */
  const suggestFromPrescription = async () => {
    const terms = prescriptionTerms.split(',').map((t) => t.trim()).filter(Boolean);
    if (!terms.length) return;
    try {
      const results = await apiFetch('/pharmacy/suggest', { method: 'POST', body: JSON.stringify({ terms }) });
      const suggested = results
        .filter((r) => r.total_stock > 0)
        .map((r) => ({ medicine_id: String(r.id), unit_type: 'tablet', quantity: '1', discount_percent: '' }));
      if (suggested.length) setLines(suggested);
      else setErrorMsg('No matching medicines with stock were found for that prescription.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to look up prescription items.');
    }
  };

  const validLines = lines.filter((l) => l.medicine_id && l.quantity && Number(l.quantity) > 0);
  const subtotal = validLines.reduce((sum, l) => {
    const med = medicineById[l.medicine_id];
    if (!med) return sum;
    const ratio = med.tablets_per_strip && Number(med.tablets_per_strip) > 0 ? Number(med.tablets_per_strip) : 1;
    const unitType = l.unit_type || 'tablet';
    const baseQty = unitType === 'strip' ? Number(l.quantity) * ratio : Number(l.quantity);
    const pricePerTablet = Number(med.selling_price ?? med.price ?? 0);
    return sum + baseQty * pricePerTablet * (1 - (Number(l.discount_percent) || 0) / 100);
  }, 0);

  const estimatedNet = Math.max(subtotal - (Number(discountAmount) || 0), 0);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!patient) { setErrorMsg('Select a patient first.'); return; }
    if (!validLines.length) { setErrorMsg('Add at least one medicine with a quantity.'); return; }

    try {
      setIsSaving(true);
      setErrorMsg('');
      const bill = await apiFetch('/pharmacy/bills', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patient.id,
          bill_date: todayISO(),
          payment_mode: 'cash',
          discount_amount: Number(discountAmount) || 0,
          paid_amount: 0,
          items: validLines.map((l) => ({
            medicine_id: Number(l.medicine_id),
            unit_type: l.unit_type || 'tablet',
            quantity: Number(l.quantity),
            discount_percent: Number(l.discount_percent) || 0,
          })),
        }),
      });
      setGeneratedBill(bill);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate the bill.');
    } finally {
      setIsSaving(false);
    }
  };

  const startNewSale = () => {
    setGeneratedBill(null);
    setPatient(null);
    setPatientQuery('');
    setPrescriptionTerms('');
    setLines([{ ...emptyLine }]);
    setDiscountAmount('0');
  };

  if (generatedBill) {
    return <Receipt bill={generatedBill} onNewSale={startNewSale} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Pharmacy &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Dispense to Patient</span>
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Dispense medicines to a patient. The bill will be added to Collect Payment page for payment collection.</p>
      </div>
      {errorMsg && <div className="bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl">{errorMsg}</div>}

      <form onSubmit={handleGenerate} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-5">
        <div>
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Patient (Party) *</span>
          {patient ? (
            <div className="mt-1 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3.5 py-2.5">
              <div>
                <div className="text-xs font-bold text-gray-900">{patient.full_name}</div>
                <div className="text-[11px] text-gray-500">{patient.mobile_number}</div>
              </div>
              <button type="button" onClick={() => setPatient(null)} className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer">Change</button>
            </div>
          ) : (
            <div className="relative mt-1">
              <input
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder="Search patient by name or mobile number..."
                className={inputCls}
              />
              {patientResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {patientResults.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => { setPatient(p); setPatientResults([]); }}
                      className="w-full text-left px-3.5 py-2 text-xs hover:bg-blue-50 cursor-pointer"
                    >
                      <span className="font-semibold text-gray-900">{p.full_name}</span>{' '}
                      <span className="text-gray-400">{p.mobile_number}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Doctor's Prescription (optional)</span>
          <div className="flex gap-2">
            <input
              value={prescriptionTerms}
              onChange={(e) => setPrescriptionTerms(e.target.value)}
              placeholder="Comma-separated drug names from the prescription, e.g. Paracetamol, Amoxicillin"
              className={inputCls}
            />
            <button type="button" onClick={suggestFromPrescription} className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 rounded-lg cursor-pointer whitespace-nowrap">
              Look Up
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Items to Charge</span>
          <div className="space-y-2.5">
            {lines.map((l, idx) => {
              const med = medicineById[l.medicine_id];
              const ratio = med?.tablets_per_strip && Number(med.tablets_per_strip) > 0 ? Number(med.tablets_per_strip) : 1;
              const unitType = l.unit_type || 'tablet';
              const qtyNum = Number(l.quantity) || 0;
              const baseQty = unitType === 'strip' ? qtyNum * ratio : qtyNum;

              return (
                <div key={idx} className="bg-gray-50/70 p-3 rounded-lg border border-gray-100 space-y-1.5">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <MedicineSearchSelect
                      value={l.medicine_id}
                      onChange={(id) => updateLine(idx, 'medicine_id', id)}
                      medicines={medicines}
                      className="col-span-4"
                      compact
                    />
                    <select
                      value={l.unit_type || 'tablet'}
                      onChange={(e) => updateLine(idx, 'unit_type', e.target.value)}
                      className={`${inputCls} col-span-3 font-semibold bg-white`}
                    >
                      {ratio > 1 ? (
                        <>
                          <option value="tablet">Tablet(s)</option>
                          <option value="strip">Strip(s) ({ratio} tabs/strip)</option>
                        </>
                      ) : (
                        <option value="tablet">{med?.unit || 'Unit(s)'}</option>
                      )}
                    </select>
                    <input type="number" min="1" placeholder="Qty" value={l.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} className={`${inputCls} col-span-2 font-bold`} />
                    <input type="number" min="0" max="100" placeholder="Disc %" value={l.discount_percent} onChange={(e) => updateLine(idx, 'discount_percent', e.target.value)} className={`${inputCls} col-span-2`} />
                    <button type="button" onClick={() => removeLine(idx)} disabled={lines.length === 1} className="text-rose-500 hover:text-rose-700 disabled:opacity-30 cursor-pointer col-span-1 flex justify-end">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  {med && qtyNum > 0 && (
                    <div className="text-[11px] text-blue-700 font-medium flex items-center justify-between px-1">
                      <span>
                        Dispensing: <strong className="text-blue-900">{baseQty} tablet{baseQty === 1 ? '' : 's'}</strong>
                        {ratio > 1 && unitType === 'strip' && ` (${qtyNum} strip${qtyNum === 1 ? '' : 's'} × ${ratio})`}
                        {ratio > 1 && unitType === 'tablet' && ` (${(qtyNum / ratio).toFixed(2)} strip${qtyNum / ratio === 1 ? '' : 's'})`}
                      </span>
                      <span>
                        Rate: {formatCurrency(med.selling_price ?? med.price ?? 0)}/tablet
                        {ratio > 1 && ` (${formatCurrency((med.selling_price ?? med.price ?? 0) * ratio)}/strip)`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button type="button" onClick={addLine} className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">+ Add another item</button>
        </div>

        <div className="max-w-xs">
          <Field label="Bill Discount (₹)">
            <input type="number" min="0" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="bg-blue-50/70 border border-blue-100 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wide">Estimated Total Bill</span>
          <span className="text-lg font-extrabold text-blue-900">{formatCurrency(estimatedNet)}</span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="submit" disabled={isSaving} className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-6 py-2.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
            {isSaving ? 'Dispensing…' : 'Dispense Medicines & Save to Payment Queue'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Receipt({ bill, onNewSale }) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-4 py-3 rounded-xl">
        Bill {bill.bill_number} generated. Added to <strong>Collect Payment</strong> page for payment collection.
      </div>
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-dashed border-gray-200 pb-3">
          <div>
            <div className="text-sm font-bold text-gray-900">Pharmacy Receipt</div>
            <div className="text-[11px] text-gray-500">{bill.bill_number} · {new Date(bill.bill_date).toLocaleString('en-IN')}</div>
          </div>
          <div className="text-right text-[11px] text-gray-500">
            <div className="font-semibold text-gray-800">{bill.patient_name}</div>
            <div>{bill.patient_mobile}</div>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead className="text-[10px] text-gray-400 uppercase">
            <tr><th className="text-left py-1">Medicine</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Unit ₹</th><th className="text-right py-1">Total ₹</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bill.items.map((it) => (
              <tr key={it.id}>
                <td className="py-1.5 font-semibold">{it.medicine_name}</td>
                <td className="py-1.5 text-right">{it.quantity}</td>
                <td className="py-1.5 text-right">{formatCurrency(it.unit_price)}</td>
                <td className="py-1.5 text-right">{formatCurrency(it.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-dashed border-gray-200 pt-3 space-y-1 text-xs">
          <Row label="Subtotal" value={bill.total_amount} />
          <Row label="Tax" value={bill.tax_amount} />
          <Row label="Discount" value={-bill.discount_amount} />
          <Row label="Net Amount" value={bill.net_amount} bold />
          <Row label="Paid" value={bill.paid_amount} />
          <Row label="Balance" value={bill.balance_amount} bold={bill.balance_amount > 0} />
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={() => window.print()} className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-5 py-2.5 rounded-lg cursor-pointer">
          Print / Give Receipt to Party
        </button>
        <button onClick={onNewSale} className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2.5 rounded-lg cursor-pointer">
          New Sale
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600';

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-gray-400">{hint}</span>}
    </label>
  );
}
