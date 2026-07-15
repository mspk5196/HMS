import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import './Discharge.css';
import { Button } from '../../components/ui/Button';
import { FileText, Search } from 'lucide-react';

function Field({ label, children }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

export function Discharge() {
  const { request } = useApi();
  const [admissionId, setAdmissionId] = useState('');
  const [admission, setAdmission] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    diagnosis_summary: '', treatment_summary: '', doctor_advice: '',
    discharge_condition: 'recovered', room_charges: 0, pharmacy_charges: 0,
    other_charges: 0, amount_paid: 0, payment_mode: 'cash',
    discharge_notes: '', follow_up_date: ''
  });
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const total = Number(form.room_charges) + Number(form.pharmacy_charges) + Number(form.other_charges);
  const balance = total - Number(form.amount_paid);

  const loadAdmission = async (e) => {
    e.preventDefault(); if (!admissionId) return;
    setFetching(true); setAdmission(null); setDone(false);
    try {
      const res = await request(`/patient/admissions?status=admitted&limit=200`);
      const found = (res?.data?.rows || res?.data || []).find(a => a.id === Number(admissionId));
      if (found) setAdmission(found);
      else alert('Active admission not found.');
    } catch (e) { alert(e.message); }
    setFetching(false);
  };

  const handleDischarge = async (e) => {
    e.preventDefault(); if (!admission) return;
    setSaving(true);
    try {
      await request('/patient/discharges', {
        method: 'POST',
        body: JSON.stringify({
          ...form, admission_id: admission.id,
          final_bill_amount: total,
          balance_due: balance > 0 ? balance : 0
        })
      });
      setDone(true);
    } catch (err) { alert(err.message || 'Error processing discharge'); }
    setSaving(false);
  };

  if (done) return (
    <div className="p-5">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h2 className="text-base font-bold mb-2">Patient Discharged Successfully</h2>
        <p className="text-[#767c83] text-sm mb-6">Admission #{admissionId} has been closed and beds freed.</p>
        <Button variant="outline" onClick={() => { setDone(false); setAdmission(null); setAdmissionId(''); }}>
          Process Another Discharge
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-5 space-y-4">
      <div className="page-header">
        <div>
          <div className="page-header__title">Discharge Summary & Billing</div>
          <div className="page-header__sub">Generate discharge summary and settle final bill</div>
        </div>
        <form onSubmit={loadAdmission} className="flex items-center gap-2">
          <input className="field w-44" type="number" placeholder="Admission ID" value={admissionId} onChange={e => setAdmissionId(e.target.value)} />
          <Button type="submit" variant="outline" isLoading={fetching}>Load</Button>
        </form>
      </div>

      {!admission && !fetching && (
        <div className="flex flex-col items-center justify-center py-20 text-[#767c83]">
          <FileText size={40} className="mb-4 opacity-30" />
          <p className="text-sm">Enter an Admission ID above to load the discharge form.</p>
        </div>
      )}

      {admission && (
        <form onSubmit={handleDischarge}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Clinical summary */}
            <Card>
              <CardHeader title="Clinical Summary" />
              <CardContent className="space-y-4">
                <div className="bg-[#f8f9fa] border border-[#dde1e5] rounded p-3 text-[13px] space-y-1">
                  <div><span className="text-[#767c83]">Patient:</span> <strong>{admission.patient_name}</strong></div>
                  <div><span className="text-[#767c83]">Doctor:</span> {admission.doctor_name || '—'}</div>
                  {admission.bed_label && <div><span className="text-[#767c83]">Bed:</span> {admission.room_number} / {admission.bed_label}</div>}
                </div>
                <Field label="Diagnosis Summary">
                  <textarea required className="field resize-none" rows={3} value={form.diagnosis_summary} onChange={e => setF('diagnosis_summary', e.target.value)} />
                </Field>
                <Field label="Treatment Given">
                  <textarea required className="field resize-none" rows={3} value={form.treatment_summary} onChange={e => setF('treatment_summary', e.target.value)} />
                </Field>
                <Field label="Doctor's Advice">
                  <textarea className="field resize-none" rows={2} value={form.doctor_advice} onChange={e => setF('doctor_advice', e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Condition at Discharge">
                    <select className="field" value={form.discharge_condition} onChange={e => setF('discharge_condition', e.target.value)}>
                      <option value="recovered">Recovered</option>
                      <option value="referred">Referred</option>
                      <option value="lama">LAMA</option>
                      <option value="expired">Expired</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <Field label="Follow-up Date">
                    <input className="field" type="date" value={form.follow_up_date} onChange={e => setF('follow_up_date', e.target.value)} />
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* Bill settlement */}
            <Card>
              <CardHeader title="Final Bill Settlement" />
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Room Charges (₹)">
                    <input type="number" min="0" required className="field" value={form.room_charges} onChange={e => setF('room_charges', e.target.value)} />
                  </Field>
                  <Field label="Pharmacy Charges (₹)">
                    <input type="number" min="0" required className="field" value={form.pharmacy_charges} onChange={e => setF('pharmacy_charges', e.target.value)} />
                  </Field>
                </div>
                <Field label="Other Charges — doctor fees, labs, etc. (₹)">
                  <input type="number" min="0" className="field" value={form.other_charges} onChange={e => setF('other_charges', e.target.value)} />
                </Field>

                <div className="border border-[#dde1e5] rounded-md p-4 space-y-2">
                  <div className="summary-line"><span>Room</span><span>₹{Number(form.room_charges).toFixed(2)}</span></div>
                  <div className="summary-line"><span>Pharmacy</span><span>₹{Number(form.pharmacy_charges).toFixed(2)}</span></div>
                  <div className="summary-line"><span>Other</span><span>₹{Number(form.other_charges).toFixed(2)}</span></div>
                  <div className="summary-line grand-total"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Field label="Amount Paid (₹)">
                    <input type="number" min="0" required className="field" value={form.amount_paid} onChange={e => setF('amount_paid', e.target.value)} />
                  </Field>
                  <Field label="Payment Mode">
                    <select className="field" value={form.payment_mode} onChange={e => setF('payment_mode', e.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="insurance">Insurance</option>
                      <option value="credit">Credit</option>
                    </select>
                  </Field>
                </div>

                {balance > 0 && (
                  <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-semibold flex justify-between">
                    <span>Balance Due</span><span>₹{balance.toFixed(2)}</span>
                  </div>
                )}
                {balance <= 0 && total > 0 && (
                  <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700 font-semibold">
                    ✓ Fully Paid
                  </div>
                )}

                <Field label="Discharge Notes">
                  <textarea className="field resize-none" rows={2} value={form.discharge_notes} onChange={e => setF('discharge_notes', e.target.value)} />
                </Field>

                <Button type="submit" fullWidth isLoading={saving} className="mt-2">Confirm Discharge</Button>
              </CardContent>
            </Card>
          </div>
        </form>
      )}
    </div>
  );
}
