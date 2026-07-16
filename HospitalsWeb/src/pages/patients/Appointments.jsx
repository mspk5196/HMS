import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import './Appointments.css';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, TableLoading } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { CalendarDays, Plus, ArrowRight, X, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_BADGE = {
  scheduled:       'badge badge-default',
  waiting:         'badge badge-warning',
  in_consultation: 'badge badge-info',
  completed:       'badge badge-success',
  cancelled:       'badge badge-danger',
  converted_to_admission: 'badge badge-primary',
  closed:          'badge badge-default',
};

function BookTokenModal({ open, onClose, onSaved }) {
  const { request, loading } = useApi();
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({ patient_id: '', doctor_id: '', appointment_date: new Date().toISOString().split('T')[0], type: 'new' });
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      request('/hr/employees?department=doctor&limit=100').then(r => {
        if (r?.success) setDoctors(r.data?.rows || r.data || []);
      }).catch(() => {});
    }
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await request('/patient/appointments', {
        method: 'POST',
        body: JSON.stringify({ ...form, patient_id: Number(form.patient_id), doctor_id: Number(form.doctor_id) })
      });
      onSaved();
      onClose();
    } catch (e) { setErr(e.message); }
  };

  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 460 }}>
        <div className="modal-header">
          <h2 className="text-sm font-bold">Book New Token</h2>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Patient ID *</label>
                <input className="field" required type="number" placeholder="e.g. 12" value={form.patient_id} onChange={e => set('patient_id', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Visit Type</label>
                <select className="field" value={form.type} onChange={e => set('type', e.target.value)}>
                  <option value="new">New Visit</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
            </div>
            <div>
              <label className="field-label">Doctor *</label>
              <select className="field" required value={form.doctor_id} onChange={e => set('doctor_id', e.target.value)}>
                <option value="">Select Doctor</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Appointment Date *</label>
              <input className="field" type="date" required value={form.appointment_date} onChange={e => set('appointment_date', e.target.value)} />
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
          <div className="modal-footer">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={loading}>Book Token</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Appointments() {
  const { request } = useApi();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await request(`/patient/appointments?date=${date}&limit=100`);
      if (res?.success) setAppointments(res.data?.rows || res.data || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [date]);

  const updateStatus = async (id, status) => {
    try {
      await request(`/patient/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="p-5 space-y-4">
      <div className="page-header">
        <div>
          <div className="page-header__title">Appointments & Tokens</div>
          <div className="page-header__sub">Daily OPD token queue — {appointments.length} tokens for {date}</div>
        </div>
        <div className="flex items-center gap-3">
          <input className="field w-40" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Button variant="outline" icon={RefreshCw} onClick={load}>Refresh</Button>
          <Button icon={Plus} onClick={() => setShowModal(true)}>Book Token</Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token #</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead align="center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableLoading colSpan={6} /> :
             appointments.length === 0 ? <TableEmpty colSpan={6} message="No appointments for this date." /> :
             appointments.map(a => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="text-2xl font-black text-[#1d6fbf] leading-none">{a.token_number}</div>
                </TableCell>
                <TableCell>
                  <div className="font-semibold">{a.patient_name || a.full_name}</div>
                  <div className="text-[11px] text-[#767c83]">{a.mobile_number}</div>
                </TableCell>
                <TableCell>{a.doctor_name || '—'}</TableCell>
                <TableCell className="capitalize text-[#767c83]">{a.type}</TableCell>
                <TableCell>
                  <span className={STATUS_BADGE[a.status] || 'badge badge-default'}>
                    {a.status?.replace(/_/g, ' ')}
                  </span>
                </TableCell>
                <TableCell align="center">
                  <div className="flex items-center justify-center gap-2">
                    {a.status === 'scheduled' && (
                      <Button size="xs" variant="outline" onClick={() => updateStatus(a.id, 'in_consultation')}>
                        Call In <ArrowRight size={11} />
                      </Button>
                    )}
                    {a.status === 'in_consultation' && (
                      <Button size="xs" variant="success" onClick={() => updateStatus(a.id, 'completed')}>
                        Done
                      </Button>
                    )}
                    {(a.status === 'scheduled' || a.status === 'waiting') && (
                      <Button size="xs" variant="ghost" onClick={() => updateStatus(a.id, 'cancelled')}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <BookTokenModal open={showModal} onClose={() => setShowModal(false)} onSaved={load} />
    </div>
  );
}
