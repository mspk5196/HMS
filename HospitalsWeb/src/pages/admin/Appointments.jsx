import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import { hasPermission } from '../../util/permissions';
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

export default function Appointments({ user }) {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('ALL');

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

  // Auto-refresh every 30 seconds
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      load();
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);

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
        user={user}
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
          hasPermission(user, 'appointment.create') && (
            <button
              onClick={() => setShowBook(true)}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
            >
              + Book New Token
            </button>
          )
        }
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
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
        </div>

        {/* Doctor filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Doctor:</span>
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
          >
            <option value="ALL">All Doctors</option>
            {Array.from(new Set(rows.map((r) => r.doctor_name).filter(Boolean))).map((doc) => (
              <option key={doc} value={doc}>{doc}</option>
            ))}
          </select>
          <span className="ml-auto text-[11px] font-semibold text-gray-500 whitespace-nowrap">
            {rows.filter((r) => doctorFilter === 'ALL' || r.doctor_name === doctorFilter).length} token(s)
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.filter((r) => doctorFilter === 'ALL' || r.doctor_name === doctorFilter).length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No appointments booked for this date/doctor.</div>
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
              {rows.filter((r) => doctorFilter === 'ALL' || r.doctor_name === doctorFilter).map((a) => (
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
                      {a.status === 'waiting' && hasPermission(user, 'appointment.edit') && (
                        <button onClick={() => advanceStatus(a.id, 'in_consultation')} disabled={busyId === a.id} className="text-blue-600 font-bold hover:underline cursor-pointer disabled:opacity-50">
                          Start Consultation
                        </button>
                      )}
                      {['waiting', 'in_consultation', 'completed'].includes(a.status) && hasPermission(user, 'appointment.close_visit') && (
                        <button onClick={() => submitClose(a.id)} disabled={busyId === a.id} className="text-gray-700 font-bold hover:underline cursor-pointer disabled:opacity-50">
                          Save & Move to Payment
                        </button>
                      )}
                      {a.status === 'payment_pending' && (
                        <span className="text-orange-600 font-bold text-[11px]">⏳ Awaiting Payment</span>
                      )}
                      {['waiting', 'in_consultation'].includes(a.status) && hasPermission(user, 'appointment.edit') && (
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

function BookAppointment({ user, defaultDate, onBack, onBooked, onError }) {
  const [mobile, setMobile] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [doctorType, setDoctorType] = useState('staff'); // 'staff' | 'visiting'
  const [doctorId, setDoctorId] = useState('');
  const [visitingDoctors, setVisitingDoctors] = useState([]);
  const [visitingDoctorId, setVisitingDoctorId] = useState('');
  const [feeOverride, setFeeOverride] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(defaultDate);
  const [isFuture, setIsFuture] = useState(false);
  const [notes, setNotes] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  // Quick patient registration state
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [isQuickRegistering, setIsQuickRegistering] = useState(false);
  const [quickForm, setQuickForm] = useState({
    full_name: '',
    mobile_number: '',
    age_years: '',
    gender: 'male',
    blood_group: '',
  });

  const handleQuickRegister = async () => {
    if (!quickForm.full_name.trim()) { onError(null, 'Patient full name is required.'); return; }
    if (!quickForm.mobile_number.trim()) { onError(null, 'Mobile number is required.'); return; }
    try {
      setIsQuickRegistering(true);
      const res = await apiFetch('/patient/patients', {
        method: 'POST',
        body: JSON.stringify({
          full_name: quickForm.full_name.trim(),
          mobile_number: quickForm.mobile_number.trim(),
          age_years: quickForm.age_years ? Number(quickForm.age_years) : null,
          gender: quickForm.gender,
          blood_group: quickForm.blood_group || null,
        }),
      });
      const createdPatient = {
        id: res.id || res.patient_id,
        full_name: quickForm.full_name.trim(),
        mobile_number: quickForm.mobile_number.trim(),
        age_years: quickForm.age_years || '—',
        gender: quickForm.gender,
        blood_group: quickForm.blood_group || null,
      };
      setSelectedPatient(createdPatient);
      setCandidates([createdPatient]);
      setShowQuickRegister(false);
    } catch (err) {
      onError(err, 'Failed to register patient.');
    } finally {
      setIsQuickRegistering(false);
    }
  };

  // Load visiting doctors once
  useEffect(() => {
    apiFetch('/visiting-doctors?activeOnly=true')
      .then((res) => setVisitingDoctors(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

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
    const isStaff = doctorType === 'staff';
    if (isStaff && !doctorId) { onError(null, 'Select a staff doctor.'); return; }
    if (!isStaff && !visitingDoctorId) { onError(null, 'Select a visiting doctor.'); return; }
    try {
      setIsBooking(true);
      await apiFetch('/patient/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          doctor_id: isStaff ? Number(doctorId) : null,
          visiting_doctor_id: !isStaff ? Number(visitingDoctorId) : null,
          appointment_date: appointmentDate,
          is_future_booking: isFuture,
          doctor_fee_override: feeOverride !== '' ? Number(feeOverride) : null,
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
        subtitle="Search patient by mobile number, select doctor, and issue consultation token."
        onBack={onBack}
      />

      {/* Step 1: Patient */}
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
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select the patient</div>
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

        {candidates.length === 0 && mobile.trim() && !isSearching && !showQuickRegister && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-2">
            <p>No patient found with mobile <strong>{mobile}</strong>.</p>
            <button
              type="button"
              onClick={() => {
                setQuickForm((prev) => ({ ...prev, mobile_number: mobile.trim() }));
                setShowQuickRegister(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-md text-xs cursor-pointer"
            >
              + Quick Register New Patient
            </button>
          </div>
        )}

        {/* Quick Register Mini-Form */}
        {showQuickRegister && (
          <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-blue-950">Quick Patient Registration</h4>
              <button
                type="button"
                onClick={() => setShowQuickRegister(false)}
                className="text-[11px] text-gray-500 hover:text-gray-700"
              >
                ✕ Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase">Full Name *</label>
                <input
                  type="text"
                  value={quickForm.full_name}
                  onChange={(e) => setQuickForm({ ...quickForm, full_name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase">Mobile Number *</label>
                <input
                  type="text"
                  value={quickForm.mobile_number}
                  onChange={(e) => setQuickForm({ ...quickForm, mobile_number: e.target.value })}
                  placeholder="10-digit mobile"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase">Age (Years)</label>
                <input
                  type="number"
                  value={quickForm.age_years}
                  onChange={(e) => setQuickForm({ ...quickForm, age_years: e.target.value })}
                  placeholder="e.g. 35"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase">Gender *</label>
                <select
                  value={quickForm.gender}
                  onChange={(e) => setQuickForm({ ...quickForm, gender: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-medium"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-gray-600 uppercase">Blood Group</label>
                <select
                  value={quickForm.blood_group}
                  onChange={(e) => setQuickForm({ ...quickForm, blood_group: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-medium"
                >
                  <option value="">Unknown / Not Tested</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleQuickRegister}
                disabled={isQuickRegistering}
                className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50"
              >
                {isQuickRegistering ? 'Registering…' : 'Register & Select'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Appointment Details */}
      {selectedPatient && (
        <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-4">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Step 2 — Appointment Details</div>
          <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-blue-900">
            {selectedPatient.full_name} — {selectedPatient.age_years} Yrs / {selectedPatient.gender}
          </div>

          {/* Doctor type toggle */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Doctor Type:</span>
            <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => { setDoctorType('staff'); setVisitingDoctorId(''); }}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                  doctorType === 'staff' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                Staff Doctor
              </button>
              <button
                type="button"
                onClick={() => { setDoctorType('visiting'); setDoctorId(''); }}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                  doctorType === 'visiting' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                Visiting Doctor
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {doctorType === 'staff' ? (
              <DoctorPicker value={doctorId} onChange={setDoctorId} label="Staff Doctor *" />
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Visiting Doctor *</label>
                <select
                  value={visitingDoctorId}
                  onChange={(e) => setVisitingDoctorId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
                >
                  <option value="">-- Select Visiting Doctor --</option>
                  {visitingDoctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.full_name}{d.specialization ? ` (${d.specialization})` : ''}
                    </option>
                  ))}
                </select>
                {visitingDoctors.length === 0 && (
                  <p className="text-[10px] text-gray-400">No visiting doctors registered. Add them from the Visiting Doctors registry.</p>
                )}
              </div>
            )}

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

          {/* Fee override — only visible to authorized users */}
          {hasPermission(user, 'appointment.override_fee') && (
            <div className="space-y-1 max-w-xs">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Doctor Fee Override (₹) <span className="font-normal text-gray-400">— leave blank for standard rate</span></label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={feeOverride}
                onChange={(e) => setFeeOverride(e.target.value)}
                placeholder="e.g. 500"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
              />
            </div>
          )}

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
