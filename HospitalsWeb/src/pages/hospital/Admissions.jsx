import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import './Admissions.css';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, TableLoading } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Bed, Plus, X, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

function AdmitModal({ open, onClose, onSaved }) {
  const { request, loading } = useApi();
  const [doctors, setDoctors] = useState([]);
  const [wards, setWards] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [beds, setBeds] = useState([]);
  const [form, setForm] = useState({
    patient_id: '', doctor_id: '', ward_id: '', room_id: '', bed_id: '',
    notes: '', admission_datetime: new Date().toISOString().slice(0, 16)
  });
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    request('/hr/employees?limit=100').then(r => setDoctors(r?.data?.rows || r?.data || [])).catch(() => {});
    request('/bed/wards').then(r => setWards(r?.data || [])).catch(() => {});
  }, [open]);

  const handleWardChange = async (wardId) => {
    set('ward_id', wardId); set('room_id', ''); set('bed_id', ''); setRooms([]); setBeds([]);
    if (!wardId) return;
    const r = await request(`/bed/wards/${wardId}/rooms`).catch(() => null);
    if (r?.success) setRooms(r.data || []);
  };

  const handleRoomChange = async (roomId) => {
    set('room_id', roomId); set('bed_id', ''); setBeds([]);
    if (!roomId) return;
    const r = await request(`/bed/rooms/${roomId}/beds?status=available`).catch(() => null);
    if (r?.success) setBeds(r.data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      await request('/patient/admissions', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: Number(form.patient_id),
          admitting_doctor_id: Number(form.doctor_id),
          bed_id: form.bed_id ? Number(form.bed_id) : undefined,
          notes: form.notes,
          admission_datetime: form.admission_datetime,
        })
      });
      onSaved(); onClose();
    } catch (e) { setErr(e.message); }
  };

  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 520 }}>
        <div className="modal-header">
          <h2 className="text-sm font-bold">New Admission</h2>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Patient ID *</label>
                <input className="field" required type="number" value={form.patient_id} onChange={e => set('patient_id', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Admitting Doctor *</label>
                <select className="field" required value={form.doctor_id} onChange={e => set('doctor_id', e.target.value)}>
                  <option value="">Select…</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="field-label">Admission Date & Time</label>
              <input className="field" type="datetime-local" value={form.admission_datetime} onChange={e => set('admission_datetime', e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="field-label">Ward</label>
                <select className="field" value={form.ward_id} onChange={e => handleWardChange(e.target.value)}>
                  <option value="">—</option>
                  {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Room</label>
                <select className="field" value={form.room_id} onChange={e => handleRoomChange(e.target.value)}>
                  <option value="">—</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.room_number}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Bed</label>
                <select className="field" value={form.bed_id} onChange={e => set('bed_id', e.target.value)}>
                  <option value="">—</option>
                  {beds.map(b => <option key={b.id} value={b.id}>{b.bed_label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="field-label">Notes</label>
              <textarea className="field resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
          <div className="modal-footer">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={loading}>Admit Patient</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Admissions() {
  const { request } = useApi();
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await request('/patient/admissions?status=admitted&limit=100');
      if (res?.success) setAdmissions(res.data?.rows || res.data || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-5 space-y-4">
      <div className="page-header">
        <div>
          <div className="page-header__title">IPD Admissions & Bed Management</div>
          <div className="page-header__sub">{admissions.length} active admissions</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={load}>Refresh</Button>
          <Button icon={Plus} onClick={() => setShowModal(true)}>New Admission</Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Bed</TableHead>
              <TableHead>Admitted</TableHead>
              <TableHead align="center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableLoading colSpan={6} /> :
             admissions.length === 0 ? <TableEmpty colSpan={6} message="No active admissions." /> :
             admissions.map(a => (
              <TableRow key={a.id}>
                <TableCell className="text-[#767c83] font-mono text-xs">{a.id}</TableCell>
                <TableCell>
                  <div className="font-semibold">{a.patient_name}</div>
                  <div className="text-[11px] text-[#767c83]">{a.mobile}</div>
                </TableCell>
                <TableCell>{a.doctor_name || '—'}</TableCell>
                <TableCell>
                  {a.bed_label ? (
                    <div className="flex items-center gap-1">
                      <Bed size={13} className="text-[#1d6fbf]" />
                      <span className="font-semibold text-[#1d6fbf]">{a.room_number} / {a.bed_label}</span>
                    </div>
                  ) : (
                    <span className="badge badge-warning">Unallocated</span>
                  )}
                </TableCell>
                <TableCell>
                  {a.admission_datetime ? (
                    <div>
                      <div className="font-medium">{format(new Date(a.admission_datetime), 'dd MMM yyyy')}</div>
                      <div className="text-[11px] text-[#767c83]">{format(new Date(a.admission_datetime), 'hh:mm a')}</div>
                    </div>
                  ) : '—'}
                </TableCell>
                <TableCell align="center">
                  <span className="badge badge-warning">Admitted</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AdmitModal open={showModal} onClose={() => setShowModal(false)} onSaved={load} />
    </div>
  );
}
