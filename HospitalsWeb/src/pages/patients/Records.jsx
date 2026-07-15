import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import './Records.css';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, TableLoading } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Search, UserPlus, X } from 'lucide-react';
import { format } from 'date-fns';

const GENDERS = ['male', 'female', 'other'];

function PatientModal({ open, onClose, onSaved }) {
  const { request, loading } = useApi();
  const [form, setForm] = useState({
    full_name: '', mobile_number: '', age_years: '', gender: 'male',
    blood_group: '', address: '', notes: ''
  });
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.full_name || !form.mobile_number || !form.age_years) {
      return setErr('Name, mobile, and age are required.');
    }
    try {
      await request('/patient/patients', { method: 'POST', body: JSON.stringify(form) });
      onSaved();
      onClose();
      setForm({ full_name: '', mobile_number: '', age_years: '', gender: 'male', blood_group: '', address: '', notes: '' });
    } catch (e) { setErr(e.message); }
  };

  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 500 }}>
        <div className="modal-header">
          <h2 className="text-sm font-bold">Register New Patient</h2>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div>
              <label className="field-label">Full Name *</label>
              <input className="field" required value={form.full_name} onChange={e => set('full_name', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Mobile Number *</label>
                <input className="field" required value={form.mobile_number} onChange={e => set('mobile_number', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Blood Group</label>
                <input className="field" placeholder="e.g. O+" value={form.blood_group} onChange={e => set('blood_group', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Age (years) *</label>
                <input className="field" type="number" min="0" max="150" required value={form.age_years} onChange={e => set('age_years', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Gender *</label>
                <select className="field" required value={form.gender} onChange={e => set('gender', e.target.value)}>
                  {GENDERS.map(g => <option key={g} value={g} className="capitalize">{g}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="field-label">Address</label>
              <input className="field" value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div>
              <label className="field-label">Notes</label>
              <textarea className="field resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
          <div className="modal-footer">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={loading}>Save Patient</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Records() {
  const { request, loading } = useApi();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const load = async (q = '') => {
    try {
      const res = await request(`/patient/patients?search=${encodeURIComponent(q)}&limit=50`);
      if (res?.success) {
        setPatients(res.data?.rows || res.data?.data || res.data || []);
        setTotal(res.data?.total || 0);
      }
    } catch (e) { /* silent */ }
  };

  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="p-5 space-y-4">
      <div className="page-header">
        <div>
          <div className="page-header__title">Patient Records</div>
          <div className="page-header__sub">Master database — {total > 0 ? `${total} patients registered` : 'Loading…'}</div>
        </div>
        <Button icon={UserPlus} onClick={() => setShowModal(true)}>New Patient</Button>
      </div>

      <Card>
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#eef0f2] bg-[#fafbfc]">
          <Search size={14} className="text-[#767c83]" />
          <input
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#1e2227] placeholder-[#767c83]"
            placeholder="Search by name, UHID or mobile number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>UHID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Age / Gender</TableHead>
              <TableHead>Blood</TableHead>
              <TableHead>Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableLoading colSpan={6} /> :
             patients.length === 0 ? <TableEmpty colSpan={6} message="No patients found." /> :
             patients.map(p => (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="font-mono text-[12px] font-bold text-[#1d6fbf]">{p.uhid || `P${p.id}`}</span>
                </TableCell>
                <TableCell>
                  <div className="font-semibold text-[#1e2227]">{p.full_name}</div>
                  {p.address && <div className="text-[11px] text-[#767c83] truncate max-w-[180px]">{p.address}</div>}
                </TableCell>
                <TableCell>{p.mobile_number}</TableCell>
                <TableCell>
                  <span>{p.age_years} yr</span>
                  <span className="ml-1 badge badge-default capitalize">{p.gender}</span>
                </TableCell>
                <TableCell>{p.blood_group || <span className="text-[#767c83]">—</span>}</TableCell>
                <TableCell className="text-[#767c83]">
                  {p.created_at ? format(new Date(p.created_at), 'dd MMM yyyy') : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <PatientModal open={showModal} onClose={() => setShowModal(false)} onSaved={() => load(search)} />
    </div>
  );
}
