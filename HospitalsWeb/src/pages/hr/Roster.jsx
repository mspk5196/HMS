import { useState, useEffect } from 'react';
import './Roster.css';
import { Button } from '../../components/ui/Button';
import { useApi } from '../../hooks/useApi';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Roster = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [rosterData, setRosterData] = useState([]);
  const { request } = useApi();

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const daysInMonth = new Date(year, month, 0).getDate();

  const loadData = async () => {
    const [empRes, shiftRes, rosterRes] = await Promise.all([
      request('/hr/employees').catch(() => null),
      request('/hr/shifts').catch(() => null),
      request(`/hr/roster?month=${month}&year=${year}`).catch(() => null)
    ]);

    if (empRes?.success) setEmployees(empRes.data?.rows || empRes.data || []);
    if (shiftRes?.success) setShifts(shiftRes.data?.rows || shiftRes.data || []);
    if (rosterRes?.success) setRosterData(rosterRes.data || []);
  };

  useEffect(() => {
    loadData();
  }, [month, year]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 2, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month, 1));

  const getShiftForDay = (empId, day) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return rosterData.find(r => r.employee_id === empId && r.shift_date.startsWith(dateStr));
  };

  const handleCellClick = async (empId, day) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const current = getShiftForDay(empId, day);
    
    // Cycle through: [No Shift] -> Shift 1 -> Shift 2 ... -> Week Off -> Night Duty -> [No Shift]
    let nextPayload = { employee_id: empId, shift_date: dateStr, shift_id: null, is_week_off: false, is_night_duty: false };
    
    if (!current) {
      if (shifts.length > 0) nextPayload.shift_id = shifts[0].id;
    } else if (current.shift_id) {
      const idx = shifts.findIndex(s => s.id === current.shift_id);
      if (idx + 1 < shifts.length) {
        nextPayload.shift_id = shifts[idx + 1].id;
      } else {
        nextPayload.is_week_off = true;
      }
    } else if (current.is_week_off) {
      nextPayload.is_night_duty = true;
    }

    const res = await request('/hr/roster/day', {
      method: 'POST',
      body: JSON.stringify(nextPayload)
    }).catch(() => null);
    if (res?.success) loadData();
  };

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="roster-container">
      <div className="roster-header">
        <div>
          <div className="roster-title">Shift & Roster Management</div>
          <div className="roster-subtitle">Calendar-style roster — click a cell to set a shift, week-off, or night duty.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button variant="outline" onClick={handlePrevMonth}>Prev</Button>
          <span style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text)', width: '128px', textAlign: 'center' }}>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
          <Button variant="outline" onClick={handleNextMonth}>Next</Button>
        </div>
      </div>

      <div className="roster-table-card" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'white' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="roster-table" style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead style={{ fontSize: '10px', color: 'var(--text-md)', background: 'var(--panel)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <tr>
                <th style={{ padding: '8px 16px', position: 'sticky', left: 0, background: 'var(--panel)', zIndex: 10, width: '160px', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>Employee</th>
                {daysArray.map(d => (
                  <th key={d} style={{ padding: '8px 6px', textAlign: 'center', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', minWidth: '32px' }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                 <tr>
                    <td colSpan={daysInMonth + 1} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--mute)' }}>
                      No employees found.
                    </td>
                 </tr>
              ) : employees.map(emp => (
                <tr key={emp.id} style={{ background: 'transparent', borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 16px', fontWeight: '500', color: 'var(--text)', position: 'sticky', left: 0, background: 'white', zIndex: 9, borderRight: '1px solid var(--line)', width: '160px' }}>
                    {emp.full_name}
                  </td>
                  {daysArray.map(day => {
                    const cellData = getShiftForDay(emp.id, day);
                    let label = '-';
                    let bg = 'color: var(--mute)';
                    let bgColor = 'transparent';
                    if (cellData?.is_week_off) { label = 'WO'; bgColor = 'var(--panel)'; bg = 'color: var(--text-md)'; }
                    else if (cellData?.is_night_duty) { label = 'ND'; bgColor = 'var(--panel)'; bg = 'color: var(--text-md)'; }
                    else if (cellData?.shift_id) {
                      label = cellData.shift_name?.substring(0, 1).toUpperCase() || 'S';
                      bgColor = 'var(--primary)';
                      bg = 'color: white';
                    }
                    
                    return (
                      <td 
                        key={day} 
                        style={{ padding: '4px', borderRight: '1px solid var(--line)', textAlign: 'center', cursor: 'pointer' }}
                        onClick={() => handleCellClick(emp.id, day)}
                      >
                        <div style={{ width: '100%', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px', fontSize: '10px', fontWeight: '700', background: bgColor, ...{ color: bg.replace('color: ', '').trim() } }}>
                          {label}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div style={{ display: 'inline-flex', gap: '16px', fontSize: '12px', color: 'var(--mute)', background: 'white', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}><div style={{ width: '16px', height: '16px', background: 'var(--primary)', color: 'white', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', marginRight: '8px' }}>S</div> Shift (S)</div>
        <div style={{ display: 'flex', alignItems: 'center' }}><div style={{ width: '16px', height: '16px', background: 'var(--panel)', color: 'var(--text-md)', border: '1px solid var(--line)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', marginRight: '8px' }}>WO</div> Week Off (WO)</div>
        <div style={{ display: 'flex', alignItems: 'center' }}><div style={{ width: '16px', height: '16px', background: 'var(--panel)', color: 'var(--text-md)', border: '1px solid var(--line)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', marginRight: '8px' }}>ND</div> Night Duty (ND)</div>
      </div>
    </div>
  );
};
