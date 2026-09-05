import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import DoctorPicker from '../../components/DoctorPicker';
import PageHeader from '../../components/PageHeader';

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_STYLE = {
  waiting: 'bg-amber-50 text-amber-700 border-amber-200',
  in_consultation: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  payment_pending: 'bg-orange-50 text-orange-700 border-orange-200',
  converted_to_admission: 'bg-purple-50 text-purple-700 border-purple-200',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm ${cls}`}>{msg}</div>;
}

export default function Appointments() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showBook, setShowBook] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const { data, meta: m } = await apiFetch(`/patient/appointments?date=${date}&limit=100`, { withMeta: true });
      setRows(Array.isArray(data) ? data : []);
      setMeta(m || { total: 0 });
    } catch (err) {
      fail(err, 'Failed to load appointments.');
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const advanceStatus = async (id, status) => {
    try {
      setBusyId(id);
      await apiFetch(`/patient/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      flash('Status updated.');
      await load();
    } catch (err) {
      fail(err, 'Failed to update status.');
    } finally {
      setBusyId(null);
    }
  };

  const submitClose = async (id) => {
    try {
      setBusyId(id);
      await apiFetch(`/patient/appointments/${id}/close`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      flash('Visit saved — moved to payment queue.');
      await load();
    } catch (err) {
      fail(err, 'Failed to save the visit.');
    } finally {
      setBusyId(null);
    }
  };

  if (showBook) {
    return (
      <BookAppointment
        defaultDate={date}
        onBack={() => setShowBook(false)}
        onBooked={async (msg) => { flash(msg); setShowBook(false); await load(); }}
        onError={fail}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        category="Patient & Hospital"
        title="Appointments"
        subtitle="Token numbers increase per patient visit for the day, hospital-wide — there are no fixed time slots."
        actions={
          <button
            onClick={() => setShowBook(true)}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
          >
            + Book New Token
          </button>
        }
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-3">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold"
        />
        <button onClick={() => setDate(today())} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold cursor-pointer">
          Today
        </button>
        <span className="ml-auto text-[11px] font-semibold text-gray-500">{meta.total} token{meta.total === 1 ? '' : 's'}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No appointments booked for this date.</div>
        ) : (
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="p-3.5">Token #</th>
                <th className="p-3.5">Patient</th>
                <th className="p-3.5">Doctor</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/80">
                  <td className="p-3.5 font-bold text-blue-600 text-sm">#{String(a.token_number).padStart(2, '0')}</td>
                  <td className="p-3.5">
                    <div className="font-semibold text-gray-900">{a.patient_name}</div>
                    <div className="text-[10px] text-gray-400">{a.age_years} Yrs / {a.gender} · {a.mobile}</div>
                  </td>
                  <td className="p-3.5">{a.doctor_name || '—'}</td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${STATUS_STYLE[a.status] || ''}`}>
                      {a.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      {a.status === 'waiting' && (
                        <button onClick={() => advanceStatus(a.id, 'in_consultation')} disabled={busyId === a.id} className="text-blue-600 font-bold hover:underline cursor-pointer disabled:opacity-50">
                          Start Consultation
                        </button>
                      )}
                      {['waiting', 'in_consultation', 'completed'].includes(a.status) && (
                        <button onClick={() => submitClose(a.id)} disabled={busyId === a.id} className="text-gray-700 font-bold hover:underline cursor-pointer disabled:opacity-50">
                          Save & Move to Payment
                        </button>
                      )}
                      {a.status === 'payment_pending' && (
                        <span className="text-orange-600 font-bold text-[11px]">⏳ Awaiting Payment</span>
                      )}
                      {['waiting', 'in_consultation'].includes(a.status) && (
                        <button onClick={() => advanceStatus(a.id, 'cancelled')} disabled={busyId === a.id} className="text-rose-600 font-bold hover:underline cursor-pointer disabled:opacity-50">
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   BOOK APPOINTMENT
═══════════════════════════════════════════════════════════════════════ */

function BookAppointment({ defaultDate, onBack, onBooked, onError }) {
  const [mobile, setMobile] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [doctorId, setDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(defaultDate);
  const [isFuture, setIsFuture] = useState(false);
  const [notes, setNotes] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  const searchMobile = async () => {
    if (!mobile.trim()) return;
    try {
      setIsSearching(true);
      const data = await apiFetch(`/patient/patients/by-mobile/${encodeURIComponent(mobile.trim())}`);
      setCandidates(Array.isArray(data) ? data : []);
      setSelectedPatient(null);
    } catch (err) {
      onError(err, 'Search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedPatient) { onError(null, 'Select a patient first.'); return; }
    if (!doctorId) { onError(null, 'Doctor is required.'); return; }
    try {
      setIsBooking(true);
      await apiFetch('/patient/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          doctor_id: Number(doctorId),
          appointment_date: appointmentDate,
          is_future_booking: isFuture,
          receptionist_notes: notes.trim() || null,
        }),
      });
      onBooked(`Token booked for ${selectedPatient.full_name}.`);
    } catch (err) {
      onError(err, 'Failed to book the appointment.');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        category="Patient & Hospital"
        parent="Appointments"
        title="Book New Token"
        subtitle="Search patient by mobile or name, select doctor, and issue consultation token."
        onBack={onBack}
      />

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-4">
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Step 1 — Find the Patient</div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchMobile())}
            placeholder="Enter mobile number"
            className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs font-medium"
          />
          <button
            type="button"
            onClick={searchMobile}
            disabled={isSearching}
            className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer disabled:opacity-50"
          >
            {isSearching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {candidates.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select the patient (name + age shown so family members aren't confused)</div>
            {candidates.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPatient(p)}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  selectedPatient?.id === p.id ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="font-bold text-gray-900">{p.full_name}</span>
                <span className="text-gray-500"> — {p.age_years} Yrs / {p.gender}</span>
              </button>
            ))}
          </div>
        )}

        {candidates.length === 0 && mobile.trim() && !isSearching && (
          <p className="text-[11px] text-gray-500">
            No patient found on this number. <a href="#" onClick={(e) => e.preventDefault()} className="text-blue-600 font-semibold">Register them from Patient Records</a> first, then come back here.
          </p>
        )}
      </div>

      {selectedPatient && (
        <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-4">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Step 2 — Appointment Details</div>
          <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-blue-900">
            {selectedPatient.full_name} — {selectedPatient.age_years} Yrs / {selectedPatient.gender}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DoctorPicker value={doctorId} onChange={setDoctorId} label="Doctor" />
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
              />
            </div>
          </div>

          {appointmentDate !== today() && (
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
              <input type="checkbox" checked={isFuture} onChange={(e) => setIsFuture(e.target.checked)} />
              Confirm this is a future-dated booking
            </label>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reception Notes</label>
            <textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs" />
          </div>

          <button
            type="submit"
            disabled={isBooking}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-6 py-2.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isBooking ? 'Booking…' : 'Book Token'}
          </button>
        </form>
      )}
    </div>
  );
}
