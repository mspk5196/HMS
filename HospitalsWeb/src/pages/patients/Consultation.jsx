import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import './Consultation.css';
import { Button } from '../../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '../../components/ui/Table';
import { Search, Save, Trash2, Stethoscope } from 'lucide-react';

function Spinner() {
  return <div className="w-4 h-4 border-2 border-[#c4c9cf] border-t-[#1e2227] rounded-full animate-spin" />;
}

export function Consultation() {
  const { request, loading } = useApi();
  const [appointmentId, setAppointmentId] = useState('');
  const [apptData, setApptData] = useState(null);
  const [existing, setExisting] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    complaints: '', diagnosis: '', doctor_notes: '', follow_up_date: ''
  });
  const [medSearch, setMedSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [items, setItems] = useState([]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadAppointment = async (e) => {
    e.preventDefault();
    if (!appointmentId) return;
    setFetching(true);
    setApptData(null); setExisting(null); setItems([]); setSuggestions([]);
    setForm({ complaints: '', diagnosis: '', doctor_notes: '', follow_up_date: '' });
    try {
      // Find appointment
      const apptRes = await request(`/patient/appointments?limit=200`);
      const appt = (apptRes?.data?.rows || apptRes?.data || []).find(a => a.id === Number(appointmentId));
      if (!appt) { alert('Appointment not found.'); setFetching(false); return; }
      setApptData(appt);

      // Load existing consultation if any
      const cRes = await request(`/consultation/appointments/${appointmentId}/consultation`).catch(() => null);
      if (cRes?.success && cRes.data) {
        setExisting(cRes.data);
        setForm({
          complaints: cRes.data.complaints || '',
          diagnosis: cRes.data.diagnosis || '',
          doctor_notes: cRes.data.doctor_notes || '',
          follow_up_date: cRes.data.follow_up_date || ''
        });
        setItems(cRes.data.prescription_items || []);
      }
    } catch (err) { alert(err.message); }
    setFetching(false);
  };

  const searchMed = async (e) => {
    e.preventDefault();
    if (!medSearch.trim()) return;
    try {
      const res = await request(`/pharmacy/medicines?search=${encodeURIComponent(medSearch)}&limit=10`);
      setSuggestions(res?.data?.rows || res?.data || []);
    } catch (e) { /* silent */ }
  };

  const addMed = (med) => {
    if (items.some(i => i.medicine_id === med.id)) return;
    setItems(prev => [...prev, {
      medicine_id: med.id, medicine_name: med.name, generic_name: med.generic_name,
      dose_morning: 1, dose_afternoon: 0, dose_night: 1,
      duration_days: 5, food_instruction: 'after_food', notes: ''
    }]);
    setSuggestions([]); setMedSearch('');
  };

  const updateItem = (i, k, v) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!apptData) return;
    if (existing) { alert('Consultation already saved for this appointment.'); return; }
    setSaving(true);
    try {
      await request(`/consultation/appointments/${apptData.id}/consultation`, {
        method: 'POST',
        body: JSON.stringify({ ...form, appointment_id: apptData.id, prescription_items: items })
      });
      alert('Consultation saved successfully!');
      // Reload
      const cRes = await request(`/consultation/appointments/${apptData.id}/consultation`).catch(() => null);
      if (cRes?.success) setExisting(cRes.data);
    } catch (err) { alert(err.message || 'Error saving consultation'); }
    setSaving(false);
  };

  return (
    <div className="p-5 space-y-4">
      <div className="page-header">
        <div>
          <div className="page-header__title">Doctor Consultation & Prescription</div>
          <div className="page-header__sub">Load an appointment to record diagnosis and prescribe medicines</div>
        </div>
        <form onSubmit={loadAppointment} className="flex items-center gap-2">
          <input className="field w-44" type="number" placeholder="Appointment ID" value={appointmentId} onChange={e => setAppointmentId(e.target.value)} />
          <Button type="submit" variant="outline" isLoading={fetching}>Load</Button>
        </form>
      </div>

      {!apptData && !fetching && (
        <div className="flex flex-col items-center justify-center py-20 text-[#767c83]">
          <Stethoscope size={40} className="mb-4 opacity-30" />
          <p className="text-sm">Enter an Appointment ID above to load the patient consultation form.</p>
        </div>
      )}

      {apptData && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left panel */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader title="Patient Info" />
              <CardContent className="space-y-2 text-[13px]">
                <div className="flex justify-between"><span className="text-[#767c83]">Name</span><span className="font-semibold">{apptData.patient_name || apptData.full_name}</span></div>
                <div className="flex justify-between"><span className="text-[#767c83]">Token</span><span className="font-bold text-[#1d6fbf] text-lg">{apptData.token_number}</span></div>
                <div className="flex justify-between"><span className="text-[#767c83]">Mobile</span><span>{apptData.mobile_number}</span></div>
                <div className="flex justify-between"><span className="text-[#767c83]">Doctor</span><span>{apptData.doctor_name}</span></div>
                <div className="flex justify-between"><span className="text-[#767c83]">Date</span><span>{apptData.appointment_date}</span></div>
                {existing && (
                  <div className="mt-2 pt-2 border-t border-[#eef0f2]">
                    <span className="badge badge-success">Consultation Saved</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Clinical Notes" />
              <CardContent className="space-y-3">
                <div>
                  <label className="field-label">Chief Complaints</label>
                  <textarea className="field resize-none" rows={3} value={form.complaints} onChange={e => setF('complaints', e.target.value)} disabled={!!existing} />
                </div>
                <div>
                  <label className="field-label">Diagnosis</label>
                  <input className="field" value={form.diagnosis} onChange={e => setF('diagnosis', e.target.value)} disabled={!!existing} />
                </div>
                <div>
                  <label className="field-label">Doctor's Notes</label>
                  <textarea className="field resize-none" rows={2} value={form.doctor_notes} onChange={e => setF('doctor_notes', e.target.value)} disabled={!!existing} />
                </div>
                <div>
                  <label className="field-label">Follow-up Date</label>
                  <input className="field" type="date" value={form.follow_up_date} onChange={e => setF('follow_up_date', e.target.value)} disabled={!!existing} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right panel: Prescription */}
          <div className="lg:col-span-3">
            <Card className="h-full flex flex-col">
              <CardHeader title="Prescription" />
              <CardContent className="flex flex-col flex-1 space-y-3">
                {/* Medicine search */}
                {!existing && (
                  <form onSubmit={searchMed} className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#767c83]" />
                        <input className="field pl-8" placeholder="Search medicine name…" value={medSearch} onChange={e => setMedSearch(e.target.value)} />
                      </div>
                      <Button type="submit" variant="outline">Search</Button>
                    </div>
                    {suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#c4c9cf] rounded-md shadow-lg z-50 max-h-44 overflow-y-auto">
                        {suggestions.map(m => (
                          <div key={m.id} className="px-3 py-2 flex justify-between items-center hover:bg-[#f5f6f7] cursor-pointer border-b border-[#eef0f2] last:border-0" onClick={() => addMed(m)}>
                            <div>
                              <div className="font-semibold text-[13px]">{m.name}</div>
                              <div className="text-[11px] text-[#767c83]">{m.generic_name}</div>
                            </div>
                            <div className="text-[11px] text-[#767c83]">Stock: {m.total_stock}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </form>
                )}

                {/* Prescription table */}
                <div className="border border-[#dde1e5] rounded-md overflow-hidden flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medicine</TableHead>
                        <TableHead align="center">M–A–N</TableHead>
                        <TableHead align="center">Days</TableHead>
                        <TableHead>Food</TableHead>
                        {!existing && <TableHead></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0
                        ? <TableEmpty colSpan={existing ? 4 : 5} message="No medicines prescribed." />
                        : items.map((it, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <div className="font-semibold text-[12px]">{it.medicine_name}</div>
                              <div className="text-[10px] text-[#767c83]">{it.generic_name}</div>
                            </TableCell>
                            <TableCell align="center">
                              <div className="flex items-center gap-1 justify-center">
                                {['dose_morning','dose_afternoon','dose_night'].map((f, fi) => (
                                  <input key={fi} type="number" min="0" max="5"
                                    className="field text-center px-1 py-0.5 w-8 text-xs"
                                    value={it[f]} onChange={e => updateItem(i, f, Number(e.target.value))}
                                    disabled={!!existing}
                                  />
                                ))}
                              </div>
                            </TableCell>
                            <TableCell align="center">
                              <input type="number" min="1" className="field text-center px-1 py-0.5 w-12 text-xs"
                                value={it.duration_days} onChange={e => updateItem(i, 'duration_days', Number(e.target.value))}
                                disabled={!!existing} />
                            </TableCell>
                            <TableCell>
                              <select className="field py-0.5 text-[11px]" value={it.food_instruction} onChange={e => updateItem(i, 'food_instruction', e.target.value)} disabled={!!existing}>
                                <option value="before_food">Before Food</option>
                                <option value="after_food">After Food</option>
                                <option value="anytime">Anytime</option>
                              </select>
                            </TableCell>
                            {!existing && (
                              <TableCell align="center">
                                <button className="text-red-400 hover:text-red-600 p-1" onClick={() => removeItem(i)}>
                                  <Trash2 size={13} />
                                </button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </div>

                {!existing && (
                  <div className="flex justify-end pt-1">
                    <Button icon={Save} isLoading={saving} onClick={save}>Save Consultation</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
