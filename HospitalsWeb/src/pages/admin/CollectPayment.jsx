import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import HospitalReceipt from '../../components/HospitalReceipt';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm ${cls}`}>{msg}</div>;
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200/80 shadow-sm w-fit">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${active === t.value ? 'bg-[#1e40af] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
          {t.label}
          {t.count > 0 && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active === t.value ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'credit', label: 'Credit' },
];

export default function CollectPayment() {
  const [tab, setTab] = useState('opd');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pending, setPending] = useState({ opd: [], ipd: [], pharmacy: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [payingItem, setPayingItem] = useState(null); // { type: 'opd'|'ipd'|'pharmacy', item }
  const [showReceipt, setShowReceipt] = useState(null); // { type, data }

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const params = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : '';
      const data = await apiFetch(`/payment/pending${params}`);
      setPending({ opd: data.opd || [], ipd: data.ipd || [], pharmacy: data.pharmacy || [] });
    } catch (err) {
      fail(err, 'Failed to load pending payments.');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const handlePayDone = (msg, receiptInfo) => {
    flash(msg);
    setPayingItem(null);
    if (receiptInfo) {
      setShowReceipt(receiptInfo);
    }
    load();
  };

  if (payingItem) {
    return (
      <PaymentModal
        type={payingItem.type}
        item={payingItem.item}
        onDone={handlePayDone}
        onCancel={() => setPayingItem(null)}
        onError={fail}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Patient & Hospital &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Collect Payment</span>
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          All OPD visits, IPD discharges, and Pharmacy bills pending payment are listed here.
        </p>
      </div>

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <TabBar
          active={tab}
          onChange={setTab}
          tabs={[
            { value: 'opd', label: 'OPD (Consultation)', count: pending.opd.length },
            { value: 'ipd', label: 'IPD (Discharge)', count: pending.ipd.length },
            { value: 'pharmacy', label: 'Pharmacy Bills', count: pending.pharmacy.length },
          ]}
        />
        <div className="relative ml-auto">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, mobile, or bill #…"
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs w-64 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      {tab === 'opd' && (
        <OPDList
          rows={pending.opd}
          isLoading={isLoading}
          onPay={(item) => setPayingItem({ type: 'opd', item })}
        />
      )}
      {tab === 'ipd' && (
        <IPDList
          rows={pending.ipd}
          isLoading={isLoading}
          onPay={(item) => setPayingItem({ type: 'ipd', item })}
        />
      )}
      {tab === 'pharmacy' && (
        <PharmacyList
          rows={pending.pharmacy}
          isLoading={isLoading}
          onPay={(item) => setPayingItem({ type: 'pharmacy', item })}
        />
      )}

      {showReceipt && (
        <HospitalReceipt
          type={showReceipt.type}
          data={showReceipt.data}
          onClose={() => setShowReceipt(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   OPD PENDING LIST
═══════════════════════════════════════════════════════════ */
function OPDList({ rows, isLoading, onPay }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">OPD Consultations — Awaiting Payment ({rows.length})</h2>
      </div>
      {isLoading ? (
        <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-xs text-gray-500">
          <div className="text-2xl mb-2">✅</div>
          No OPD payments pending.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((row) => (
            <div key={row.appointment_id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-blue-600 text-xs">#{String(row.token_number).padStart(2, '0')}</span>
                  <span className="font-bold text-gray-900 text-xs">{row.patient_name}</span>
                  <span className="text-[10px] text-gray-400">{row.age_years} Yrs / {row.gender} · {row.mobile_number}</span>
                  <span className="text-[10px] bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded-full border border-amber-200">payment pending</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Date: {new Date(row.appointment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {' · '} Dr. {row.doctor_name || '—'}
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs">
                  <span className="text-gray-500">Doctor Fee: <span className="font-semibold text-gray-800">{money(row.doctor_fee)}</span></span>
                  <span className="text-gray-500">Paid: <span className="font-semibold text-emerald-600">{money(row.amount_paid)}</span></span>
                  <span className="text-gray-500">Balance: <span className="font-bold text-rose-600">{money(row.balance_due)}</span></span>
                </div>
              </div>
              <button
                onClick={() => onPay(row)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors whitespace-nowrap"
              >
                Collect ₹{Number(row.balance_due).toFixed(0)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   IPD PENDING LIST
═══════════════════════════════════════════════════════════ */
function IPDList({ rows, isLoading, onPay }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">IPD Discharges — Awaiting Payment ({rows.length})</h2>
      </div>
      {isLoading ? (
        <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-xs text-gray-500">
          <div className="text-2xl mb-2">✅</div>
          No IPD payments pending.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((row) => (
            <div key={row.discharge_id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-xs">{row.patient_name}</span>
                    <span className="text-[10px] text-gray-400">{row.age_years} Yrs / {row.gender} · {row.mobile_number}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${
                      row.payment_status === 'partial' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {row.payment_status}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Discharge: {new Date(row.discharge_datetime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' · '} Dr. {row.doctor_name || '—'}
                    {' · '} Condition: <span className="capitalize">{row.discharge_condition}</span>
                  </div>
                  <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div><span className="text-gray-400">Room</span><br /><span className="font-semibold text-gray-800">{money(row.room_charges)}</span></div>
                    <div><span className="text-gray-400">Pharmacy</span><br /><span className="font-semibold text-gray-800">{money(row.pharmacy_charges)}</span></div>
                    <div><span className="text-gray-400">Doctor Fee</span><br /><span className="font-semibold text-gray-800">{money(row.doctor_fee)}</span></div>
                    <div><span className="text-gray-400">Other</span><br /><span className="font-semibold text-gray-800">{money(row.other_charges)}</span></div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-gray-500">Total: <span className="font-bold text-gray-800">{money(row.final_bill_amount)}</span></span>
                    <span className="text-gray-500">Paid: <span className="font-semibold text-emerald-600">{money(row.amount_paid)}</span></span>
                    <span className="text-gray-500">Balance: <span className="font-bold text-rose-600">{money(row.balance_due)}</span></span>
                  </div>
                </div>
                <button
                  onClick={() => onPay(row)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors whitespace-nowrap mt-1"
                >
                  Collect ₹{Number(row.balance_due).toFixed(0)}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PHARMACY PENDING LIST
═══════════════════════════════════════════════════════════ */
function PharmacyList({ rows, isLoading, onPay }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">Pharmacy Bills — Awaiting Payment ({rows.length})</h2>
      </div>
      {isLoading ? (
        <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-xs text-gray-500">
          <div className="text-2xl mb-2">✅</div>
          No pharmacy payments pending.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((row) => (
            <div key={row.pharmacy_bill_id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-blue-600 text-xs">{row.bill_number}</span>
                  <span className="font-bold text-gray-900 text-xs">{row.patient_name}</span>
                  <span className="text-[10px] text-gray-400">{row.age_years} Yrs / {row.gender} · {row.mobile_number}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${
                    row.payment_status === 'partial' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {row.payment_status}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Bill Date: {new Date(row.bill_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {row.generated_by_name && ` · By: ${row.generated_by_name}`}
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs">
                  <span className="text-gray-500">Net Bill: <span className="font-bold text-gray-800">{money(row.net_amount)}</span></span>
                  <span className="text-gray-500">Paid: <span className="font-semibold text-emerald-600">{money(row.paid_amount)}</span></span>
                  <span className="text-gray-500">Balance: <span className="font-bold text-rose-600">{money(row.balance_due)}</span></span>
                </div>
              </div>
              <button
                onClick={() => onPay(row)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors whitespace-nowrap"
              >
                Collect ₹{Number(row.balance_due).toFixed(0)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAYMENT MODAL (inline panel)
═══════════════════════════════════════════════════════════ */
function PaymentModal({ type, item, onDone, onCancel, onError }) {
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [err, setErr] = useState('');

  const balance = type === 'opd' ? Number(item.balance_due) : Number(item.balance_due);

  const submit = async (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { setErr('Enter a valid amount.'); return; }
    if (amt > balance) { setErr(`Amount cannot exceed balance of ${money(balance)}`); return; }
    try {
      setIsBusy(true);
      setErr('');
      let result;
      if (type === 'opd') {
        result = await apiFetch('/payment/collect/opd', {
          method: 'POST',
          body: JSON.stringify({ appointment_id: item.appointment_id, amount: amt, payment_mode: mode, notes: notes || null }),
        });
      } else if (type === 'ipd') {
        result = await apiFetch('/payment/collect/ipd', {
          method: 'POST',
          body: JSON.stringify({ admission_id: item.admission_id, amount: amt, payment_mode: mode, notes: notes || null }),
        });
      } else {
        result = await apiFetch('/payment/collect/pharmacy', {
          method: 'POST',
          body: JSON.stringify({ pharmacy_bill_id: item.pharmacy_bill_id, amount: amt, payment_mode: mode, notes: notes || null }),
        });
      }
      const msg = result.closed
        ? `Payment recorded — Receipt ${result.receiptNumber} · ${type === 'ipd' ? 'Patient fully discharged!' : type === 'pharmacy' ? 'Pharmacy bill settled!' : 'Visit closed!'}`
        : `Partial payment recorded — Receipt ${result.receiptNumber} · Balance ${money(result.balance)}`;
      
      const receiptInfo = {
        type,
        data: {
          ...item,
          receipt_number: result.receiptNumber,
          amount_paid_now: amt,
          balance_due: result.balance || 0,
          payment_mode: mode,
        }
      };

      onDone(msg, receiptInfo);
    } catch (e) {
      setErr(e?.message || 'Failed to record payment.');
    } finally {
      setIsBusy(false);
    }
  };

  const patientName = item.patient_name;

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-200/80 transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Collect Payment — <span className="text-blue-600">{patientName}</span>
        </h1>
      </div>

      <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 space-y-1.5 text-xs">
        <div className="font-bold text-blue-900 text-sm mb-2">
          {type === 'opd' ? 'OPD Consultation' : type === 'ipd' ? 'IPD Discharge' : `Pharmacy Bill #${item.bill_number}`}
        </div>
        {type === 'opd' ? (
          <>
            <div className="flex justify-between text-blue-900"><span>Doctor Fee</span><span className="font-semibold">{money(item.doctor_fee)}</span></div>
            <div className="flex justify-between text-blue-900"><span>Already Paid</span><span className="font-semibold text-emerald-600">−{money(item.amount_paid)}</span></div>
          </>
        ) : type === 'ipd' ? (
          <>
            <div className="flex justify-between text-blue-900"><span>Room Charges</span><span className="font-semibold">{money(item.room_charges)}</span></div>
            <div className="flex justify-between text-blue-900"><span>Pharmacy</span><span className="font-semibold">{money(item.pharmacy_charges)}</span></div>
            <div className="flex justify-between text-blue-900"><span>Doctor Fee</span><span className="font-semibold">{money(item.doctor_fee)}</span></div>
            <div className="flex justify-between text-blue-900"><span>Other Charges</span><span className="font-semibold">{money(item.other_charges)}</span></div>
            <div className="flex justify-between text-blue-900"><span>Already Paid</span><span className="font-semibold text-emerald-600">−{money(item.amount_paid)}</span></div>
          </>
        ) : (
          <>
            <div className="flex justify-between text-blue-900"><span>Net Amount</span><span className="font-semibold">{money(item.net_amount)}</span></div>
            <div className="flex justify-between text-blue-900"><span>Already Paid</span><span className="font-semibold text-emerald-600">−{money(item.paid_amount)}</span></div>
          </>
        )}
        <div className="flex justify-between pt-2 border-t border-blue-200 font-extrabold text-blue-900 text-sm">
          <span>Balance Due</span>
          <span className="text-rose-600">{money(balance)}</span>
        </div>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-gray-900">Record Payment</h2>

        {err && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</div>}

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Amount (₹)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Max: ${balance.toFixed(2)}`}
            step="0.01"
            min="0.01"
            max={balance}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="button"
            onClick={() => setAmount(balance.toFixed(2))}
            className="text-blue-600 text-[11px] font-semibold hover:underline cursor-pointer"
          >
            Pay full balance ({money(balance)})
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Payment Mode</label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  mode === m.value
                    ? 'bg-[#1e40af] text-white border-[#1e40af]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. UPI Ref: 12345, cheque no..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isBusy}
            className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-6 py-2.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50 transition-colors"
          >
            {isBusy ? 'Recording…' : '✓ Confirm Payment'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
