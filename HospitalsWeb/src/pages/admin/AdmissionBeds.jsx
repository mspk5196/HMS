import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import DoctorPicker from '../../components/DoctorPicker';

const today = () => new Date().toISOString().slice(0, 10);

const BED_STYLE = {
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  occupied: 'bg-blue-50 text-blue-700 border-blue-200',
  pending_clearance: 'bg-amber-50 text-amber-700 border-amber-200',
  maintenance: 'bg-gray-100 text-gray-500 border-gray-200',
};

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200/80 shadow-sm w-fit flex-wrap">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            active === t.value ? 'bg-[#1e40af] text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm ${cls}`}>{msg}</div>;
}

/**
 * These three must live at module scope, not inside ManageStructure — a
 * component defined inside another component's body gets a new function
 * identity every render, so React remounts the DOM node on every keystroke
 * and the input (AddRow) loses focus after one character.
 */
function Column({ title, children, addSlot }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden flex flex-col">
      <div className="px-3.5 py-2.5 border-b border-gray-100">
        <h3 className="text-xs font-bold text-gray-900">{title}</h3>
      </div>
      <div className="flex-1 overflow-y-auto max-h-72 divide-y divide-gray-100">{children}</div>
      {addSlot && <div className="p-2.5 border-t border-gray-100">{addSlot}</div>}
    </div>
  );
}
function Row({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-3.5 py-2.5 text-xs cursor-pointer transition-colors ${active ? 'bg-blue-50 font-bold text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}>
      {children}
    </button>
  );
}
function AddRow({ value, onChange, onAdd, placeholder }) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => e.key === 'Enter' && onAdd()}
        className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-[11px]" />
      <button onClick={onAdd} className="text-blue-600 font-bold text-[11px] cursor-pointer">+ Add</button>
    </div>
  );
}

export default function AdmissionBeds() {
  const [tab, setTab] = useState('occupancy');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            Patient &amp; Hospital &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Admission &amp; Beds</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Building → Floor → Ward → Room → Bed, fully admin-editable.</p>
        </div>
      </div>

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'occupancy', label: 'Occupancy' },
          { value: 'admit', label: 'Admit Patient' },
          { value: 'structure', label: 'Manage Structure' },
        ]}
      />

      {tab === 'occupancy' && <Occupancy onError={fail} onSuccess={flash} />}
      {tab === 'admit' && <AdmitPatient onError={fail} onSuccess={flash} />}
      {tab === 'structure' && <ManageStructure onError={fail} onSuccess={flash} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   OCCUPANCY
═══════════════════════════════════════════════════════════════════════ */

function Occupancy({ onError, onSuccess }) {
  const [beds, setBeds] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const [bedData, admData] = await Promise.all([
        apiFetch('/bed/beds'),
        apiFetch('/patient/admissions?status=admitted&limit=100', { withMeta: true }).then((r) => r.data),
      ]);
      setBeds(Array.isArray(bedData) ? bedData : []);
      setAdmissions(Array.isArray(admData) ? admData : []);
    } catch (err) {
      onError(err, 'Failed to load occupancy.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byWard = beds.reduce((acc, b) => {
    (acc[b.ward_name] ||= []).push(b);
    return acc;
  }, {});

  const counts = (list) => ({
    total: list.length,
    available: list.filter((b) => b.status === 'available').length,
    occupied: list.filter((b) => b.status === 'occupied').length,
    pending: list.filter((b) => b.status === 'pending_clearance').length,
    maintenance: list.filter((b) => b.status === 'maintenance').length,
  });

  if (isLoading) return <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-8 text-center text-xs text-gray-400">Loading…</div>;

  return (
    <div className="space-y-6">
      {Object.keys(byWard).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-10 text-center text-xs text-gray-500">
          No wards/rooms/beds configured yet — set them up under "Manage Structure".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(byWard).map(([ward, list]) => {
            const c = counts(list);
            return (
              <div key={ward} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm space-y-2">
                <h3 className="font-bold text-gray-900 text-sm">{ward}</h3>
                <div className="text-xs text-gray-500 flex justify-between">
                  <span>Occupied: <strong className="text-blue-600">{c.occupied}</strong></span>
                  <span>Available: <strong className="text-emerald-600">{c.available}</strong></span>
                </div>
                {(c.pending > 0 || c.maintenance > 0) && (
                  <div className="text-[11px] text-gray-500 flex justify-between">
                    {c.pending > 0 && <span>Pending clearance: <strong className="text-amber-600">{c.pending}</strong></span>}
                    {c.maintenance > 0 && <span>Maintenance: <strong className="text-gray-500">{c.maintenance}</strong></span>}
                  </div>
                )}
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-2 flex">
                  <div className="bg-blue-600 h-2" style={{ width: `${(c.occupied / c.total) * 100}%` }} />
                  <div className="bg-amber-400 h-2" style={{ width: `${(c.pending / c.total) * 100}%` }} />
                  <div className="bg-gray-400 h-2" style={{ width: `${(c.maintenance / c.total) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Currently Admitted ({admissions.length})</h2>
        </div>
        {admissions.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No patients currently admitted.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {admissions.map((a) => (
              <div key={a.id} className="p-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-gray-900">{a.patient_name}</span>{' '}
                  <span className="text-gray-500">— {a.age_years} Yrs / {a.gender} · admitted {new Date(a.admission_datetime).toLocaleDateString('en-IN')}</span>
                </div>
                <span className="text-gray-500">Dr. {a.doctor_name || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ADMIT PATIENT
═══════════════════════════════════════════════════════════════════════ */

function AdmitPatient({ onError, onSuccess }) {
  const [mobile, setMobile] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [patient, setPatient] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const [appointments, setAppointments] = useState([]);
  const [appointmentId, setAppointmentId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [notes, setNotes] = useState('');

  const [availableBeds, setAvailableBeds] = useState([]);
  const [selectedBeds, setSelectedBeds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiFetch('/bed/beds?status=available').then((d) => setAvailableBeds(Array.isArray(d) ? d : []))
      .catch((err) => onError(err, 'Failed to load available beds.'));
  }, []);

  const searchMobile = async () => {
    if (!mobile.trim()) return;
    try {
      setIsSearching(true);
      const data = await apiFetch(`/patient/patients/by-mobile/${encodeURIComponent(mobile.trim())}`);
      setCandidates(Array.isArray(data) ? data : []);
      setPatient(null);
    } catch (err) {
      onError(err, 'Search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const pickPatient = async (p) => {
    setPatient(p);
    try {
      const { data } = await apiFetch(`/patient/appointments?patientId=${p.id}&date=${today()}&limit=20`, { withMeta: true });
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err, 'Failed to load recent appointments.');
    }
  };

  const toggleBed = (bedId) =>
    setSelectedBeds((prev) => (prev.includes(bedId) ? prev.filter((id) => id !== bedId) : [...prev, bedId]));

  const bedsByWard = availableBeds.reduce((acc, b) => {
    (acc[`${b.ward_name} — ${b.room_number} (${b.type_name})`] ||= []).push(b);
    return acc;
  }, {});

  const submit = async (e) => {
    e.preventDefault();
    if (!patient) { onError(null, 'Select a patient first.'); return; }
    if (!doctorId) { onError(null, 'Admitting doctor is required.'); return; }
    try {
      setIsSubmitting(true);
      await apiFetch('/patient/admissions', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patient.id,
          appointment_id: appointmentId ? Number(appointmentId) : null,
          admitting_doctor_id: Number(doctorId),
          bed_ids: selectedBeds,
          notes: notes.trim() || null,
        }),
      });
      onSuccess(`${patient.full_name} admitted.`);
      setPatient(null); setMobile(''); setCandidates([]); setAppointmentId(''); setDoctorId(''); setNotes(''); setSelectedBeds([]);
      const beds = await apiFetch('/bed/beds?status=available');
      setAvailableBeds(Array.isArray(beds) ? beds : []);
    } catch (err) {
      onError(err, 'Failed to admit the patient.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-4">
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Step 1 — Find the Patient</div>
        <div className="flex items-center gap-2">
          <input
            type="text" value={mobile} onChange={(e) => setMobile(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchMobile())}
            placeholder="Enter mobile number" className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-lg text-xs font-medium"
          />
          <button type="button" onClick={searchMobile} disabled={isSearching} className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer disabled:opacity-50">
            {isSearching ? 'Searching…' : 'Search'}
          </button>
        </div>
        {candidates.length > 0 && (
          <div className="space-y-1.5">
            {candidates.map((p) => (
              <button
                key={p.id} type="button" onClick={() => pickPatient(p)}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg border text-xs cursor-pointer ${
                  patient?.id === p.id ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="font-bold text-gray-900">{p.full_name}</span>
                <span className="text-gray-500"> — {p.age_years} Yrs / {p.gender}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {patient && (
        <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-4">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Step 2 — Admission Details</div>
          <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-blue-900">
            {patient.full_name} — {patient.age_years} Yrs / {patient.gender}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DoctorPicker value={doctorId} onChange={setDoctorId} label="Admitting Doctor" />
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Convert Today's Appointment (optional)</label>
              <select value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white">
                <option value="">Direct admission (no appointment)</option>
                {appointments.map((a) => (
                  <option key={a.id} value={a.id}>Token #{a.token_number} — {a.status.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Notes</label>
            <textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Select Bed(s) — {selectedBeds.length} selected
            </label>
            {Object.keys(bedsByWard).length === 0 ? (
              <p className="text-xs text-gray-500 italic">No beds are currently available.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-100 rounded-lg p-2">
                {Object.entries(bedsByWard).map(([label, list]) => (
                  <div key={label}>
                    <div className="text-[10px] font-bold text-gray-500 px-1">{label}</div>
                    <div className="flex flex-wrap gap-1.5 p-1">
                      {list.map((b) => (
                        <button
                          key={b.id} type="button" onClick={() => toggleBed(b.id)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border cursor-pointer transition-colors ${
                            selectedBeds.includes(b.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          Bed {b.bed_label} · ₹{Number(b.daily_rate).toLocaleString('en-IN')}/day
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" disabled={isSubmitting} className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-6 py-2.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
            {isSubmitting ? 'Admitting…' : 'Admit Patient'}
          </button>
        </form>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MANAGE STRUCTURE — Building → Floor → Ward → Room Type / Room → Bed
═══════════════════════════════════════════════════════════════════════ */

function ManageStructure({ onError, onSuccess }) {
  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors] = useState([]);
  const [wards, setWards] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [beds, setBeds] = useState([]);

  const [newName, setNewName] = useState({ building: '', floor: '', ward: '', roomTypeName: '', roomTypeRate: '', roomNumber: '', roomTypeId: '', bedLabel: '' });

  const loadBuildings = useCallback(async () => {
    try { setBuildings(await apiFetch('/bed/buildings')); } catch (err) { onError(err, 'Failed to load buildings.'); }
  }, []);
  const loadRoomTypes = useCallback(async () => {
    try { setRoomTypes(await apiFetch('/bed/room-types')); } catch (err) { onError(err, 'Failed to load room types.'); }
  }, []);

  useEffect(() => { loadBuildings(); loadRoomTypes(); }, [loadBuildings, loadRoomTypes]);

  const openBuilding = async (b) => {
    setSelectedBuilding(b); setSelectedFloor(null); setSelectedWard(null); setSelectedRoom(null);
    try { setFloors(await apiFetch(`/bed/floors?buildingId=${b.id}`)); } catch (err) { onError(err, 'Failed to load floors.'); }
  };
  const openFloor = async (f) => {
    setSelectedFloor(f); setSelectedWard(null); setSelectedRoom(null);
    try { setWards(await apiFetch(`/bed/wards?floorId=${f.id}`)); } catch (err) { onError(err, 'Failed to load wards.'); }
  };
  const openWard = async (w) => {
    setSelectedWard(w); setSelectedRoom(null);
    try { setRooms(await apiFetch(`/bed/wards/${w.id}/rooms`)); } catch (err) { onError(err, 'Failed to load rooms.'); }
  };
  const openRoom = async (r) => {
    setSelectedRoom(r);
    try { setBeds(await apiFetch(`/bed/rooms/${r.id}/beds`)); } catch (err) { onError(err, 'Failed to load beds.'); }
  };

  const addBuilding = async () => {
    if (!newName.building.trim()) return;
    try {
      await apiFetch('/bed/buildings', { method: 'POST', body: JSON.stringify({ name: newName.building.trim() }) });
      setNewName((n) => ({ ...n, building: '' }));
      onSuccess('Building added.');
      await loadBuildings();
    } catch (err) { onError(err, 'Failed to add building.'); }
  };

  const addFloor = async () => {
    if (!newName.floor.trim() || !selectedBuilding) return;
    try {
      await apiFetch('/bed/floors', { method: 'POST', body: JSON.stringify({ building_id: selectedBuilding.id, name: newName.floor.trim() }) });
      setNewName((n) => ({ ...n, floor: '' }));
      onSuccess('Floor added.');
      await openBuilding(selectedBuilding);
    } catch (err) { onError(err, 'Failed to add floor.'); }
  };

  const addWard = async () => {
    if (!newName.ward.trim() || !selectedFloor) return;
    try {
      await apiFetch('/bed/wards', { method: 'POST', body: JSON.stringify({ floor_id: selectedFloor.id, name: newName.ward.trim() }) });
      setNewName((n) => ({ ...n, ward: '' }));
      onSuccess('Ward added.');
      await openFloor(selectedFloor);
    } catch (err) { onError(err, 'Failed to add ward.'); }
  };

  const addRoomType = async () => {
    if (!newName.roomTypeName.trim()) return;
    try {
      await apiFetch('/bed/room-types', { method: 'POST', body: JSON.stringify({ name: newName.roomTypeName.trim(), daily_rate: Number(newName.roomTypeRate) || 0 }) });
      setNewName((n) => ({ ...n, roomTypeName: '', roomTypeRate: '' }));
      onSuccess('Room type added.');
      await loadRoomTypes();
    } catch (err) { onError(err, 'Failed to add room type.'); }
  };

  const addRoom = async () => {
    if (!newName.roomNumber.trim() || !newName.roomTypeId || !selectedWard) return;
    try {
      await apiFetch('/bed/rooms', { method: 'POST', body: JSON.stringify({ ward_id: selectedWard.id, room_type_id: Number(newName.roomTypeId), room_number: newName.roomNumber.trim() }) });
      setNewName((n) => ({ ...n, roomNumber: '' }));
      onSuccess('Room added.');
      await openWard(selectedWard);
    } catch (err) { onError(err, 'Failed to add room.'); }
  };

  const addBed = async () => {
    if (!newName.bedLabel.trim() || !selectedRoom) return;
    try {
      await apiFetch('/bed/beds', { method: 'POST', body: JSON.stringify({ room_id: selectedRoom.id, bed_label: newName.bedLabel.trim() }) });
      setNewName((n) => ({ ...n, bedLabel: '' }));
      onSuccess('Bed added.');
      await openRoom(selectedRoom);
    } catch (err) { onError(err, 'Failed to add bed.'); }
  };

  const toggleBedMaintenance = async (bed) => {
    const next = bed.status === 'maintenance' ? 'available' : 'maintenance';
    try {
      await apiFetch(`/bed/beds/${bed.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      onSuccess(`Bed ${bed.bed_label} set to ${next}.`);
      await openRoom(selectedRoom);
    } catch (err) { onError(err, 'Failed to update bed status.'); }
  };

  const removeBed = async (bed) => {
    if (!window.confirm(`Delete bed ${bed.bed_label}?`)) return;
    try {
      await apiFetch(`/bed/beds/${bed.id}`, { method: 'DELETE' });
      onSuccess('Bed deleted.');
      await openRoom(selectedRoom);
    } catch (err) { onError(err, 'Failed to delete bed.'); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Column title="Buildings" addSlot={<AddRow value={newName.building} onChange={(v) => setNewName((n) => ({ ...n, building: v }))} onAdd={addBuilding} placeholder="New building name" />}>
          {buildings.map((b) => (
            <Row key={b.id} active={selectedBuilding?.id === b.id} onClick={() => openBuilding(b)}>{b.name}</Row>
          ))}
          {buildings.length === 0 && <div className="p-3.5 text-[11px] text-gray-400">None yet.</div>}
        </Column>

        <Column title="Floors" addSlot={selectedBuilding && <AddRow value={newName.floor} onChange={(v) => setNewName((n) => ({ ...n, floor: v }))} onAdd={addFloor} placeholder="New floor name" />}>
          {!selectedBuilding ? <div className="p-3.5 text-[11px] text-gray-400">Select a building.</div> : floors.map((f) => (
            <Row key={f.id} active={selectedFloor?.id === f.id} onClick={() => openFloor(f)}>{f.name}</Row>
          ))}
        </Column>

        <Column title="Wards" addSlot={selectedFloor && <AddRow value={newName.ward} onChange={(v) => setNewName((n) => ({ ...n, ward: v }))} onAdd={addWard} placeholder="New ward name" />}>
          {!selectedFloor ? <div className="p-3.5 text-[11px] text-gray-400">Select a floor.</div> : wards.map((w) => (
            <Row key={w.id} active={selectedWard?.id === w.id} onClick={() => openWard(w)}>{w.name}</Row>
          ))}
        </Column>

        <Column
          title="Rooms"
          addSlot={selectedWard && (
            <div className="space-y-1.5">
              <select value={newName.roomTypeId} onChange={(e) => setNewName((n) => ({ ...n, roomTypeId: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-200 rounded text-[11px] bg-white">
                <option value="">Room type…</option>
                {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name} (₹{rt.daily_rate}/day)</option>)}
              </select>
              <AddRow value={newName.roomNumber} onChange={(v) => setNewName((n) => ({ ...n, roomNumber: v }))} onAdd={addRoom} placeholder="Room number, e.g. 204" />
            </div>
          )}
        >
          {!selectedWard ? <div className="p-3.5 text-[11px] text-gray-400">Select a ward.</div> : rooms.map((r) => (
            <Row key={r.id} active={selectedRoom?.id === r.id} onClick={() => openRoom(r)}>
              {r.room_number} <span className="text-gray-400 font-normal">({r.type_name})</span>
            </Row>
          ))}
        </Column>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-3">
          <h3 className="text-xs font-bold text-gray-900">Room Types &amp; Daily Rates</h3>
          <div className="flex flex-wrap gap-1.5">
            {roomTypes.map((rt) => (
              <span key={rt.id} className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-[11px] font-medium">
                {rt.name} — ₹{Number(rt.daily_rate).toLocaleString('en-IN')}/day
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <input type="text" value={newName.roomTypeName} onChange={(e) => setNewName((n) => ({ ...n, roomTypeName: e.target.value }))} placeholder="Type name (e.g. Private)" className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-[11px]" />
            <input type="number" value={newName.roomTypeRate} onChange={(e) => setNewName((n) => ({ ...n, roomTypeRate: e.target.value }))} placeholder="₹/day" className="w-24 px-2 py-1.5 border border-gray-200 rounded text-[11px]" />
            <button onClick={addRoomType} className="text-blue-600 font-bold text-[11px] cursor-pointer">+ Add</button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-3">
          <h3 className="text-xs font-bold text-gray-900">
            Beds {selectedRoom ? `in Room ${selectedRoom.room_number}` : ''}
          </h3>
          {!selectedRoom ? (
            <p className="text-[11px] text-gray-400">Select a room above to manage its beds.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                {beds.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-xs font-semibold text-gray-800">Bed {b.bed_label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${BED_STYLE[b.status] || ''}`}>{b.status.replace(/_/g, ' ')}</span>
                      {(b.status === 'available' || b.status === 'maintenance') && (
                        <>
                          <button onClick={() => toggleBedMaintenance(b)} className="text-[10px] font-bold text-amber-600 hover:underline cursor-pointer">
                            {b.status === 'maintenance' ? 'Restore' : 'Maintenance'}
                          </button>
                          <button onClick={() => removeBed(b)} className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer">Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {beds.length === 0 && <p className="text-[11px] text-gray-400">No beds in this room yet.</p>}
              </div>
              <AddRow value={newName.bedLabel} onChange={(v) => setNewName((n) => ({ ...n, bedLabel: v }))} onAdd={addBed} placeholder="Bed label, e.g. A" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
