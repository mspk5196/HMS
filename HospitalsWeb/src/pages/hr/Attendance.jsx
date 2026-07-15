import { useState, useEffect } from 'react';
import './Attendance.css';
import { Button } from '../../components/ui/Button';
import { useApi } from '../../hooks/useApi';
import { format } from 'date-fns';
import { Clock, CheckCircle, XCircle, Activity } from 'lucide-react';

export const Attendance = () => {
  const [activeTab, setActiveTab] = useState('daily'); // daily, corrections, buffer
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { request } = useApi();

  const loadData = async () => {
    setLoading(true);
    setData([]);
    try {
      if (activeTab === 'daily') {
        const res = await request(`/attendance?fromDate=${date}&toDate=${date}&limit=100`);
        if (res?.success) setData(res.data?.rows || []);
      } else if (activeTab === 'corrections') {
        const res = await request(`/attendance/corrections?status=pending&limit=100`);
        if (res?.success) setData(res.data?.rows || []);
      } else if (activeTab === 'buffer') {
        const res = await request(`/attendance/buffer?month=${month}&year=${year}`);
        if (res?.success) setData(res.data || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeTab, date, month, year]);

  const handleProcessDay = async () => {
    setLoading(true);
    await request(`/attendance/process`, { method: 'POST', body: JSON.stringify({ date }) }).catch(() => {});
    loadData();
  };

  const handleReviewCorrection = async (id, status) => {
    await request(`/attendance/corrections/${id}/review`, { method: 'PATCH', body: JSON.stringify({ status }) }).catch(() => {});
    loadData();
  };

  const renderDailyTab = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input 
            type="date" 
            className="form-control"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: '140px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={loadData} variant="outline"><Clock className="w-4 h-4 mr-2"/> Sync punches</Button>
          <Button onClick={handleProcessDay}>Run Engine</Button>
        </div>
      </div>
      
      <table className="attendance-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Code</th>
            <th>Shift</th>
            <th>First In</th>
            <th>Last Out</th>
            <th align="right">Worked</th>
            <th align="right">Late</th>
            <th align="center">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && !loading ? (
            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--mute)' }}>No attendance records found for this date.</td></tr>
          ) : (
            data.map(row => (
              <tr key={row.id}>
                <td style={{ fontWeight: '500', color: 'var(--text)' }}>{row.full_name}</td>
                <td style={{ color: 'var(--mute)' }}>{row.employee_code}</td>
                <td>{row.shift_name || '-'}</td>
                <td>{row.first_in_time ? format(new Date(row.first_in_time), 'hh:mm a') : '-'}</td>
                <td>{row.last_out_time ? format(new Date(row.last_out_time), 'hh:mm a') : '-'}</td>
                <td align="right" style={{ fontWeight: '500' }}>{row.worked_minutes || 0}m</td>
                <td align="right">
                  <span style={{ color: row.late_minutes > 0 ? 'var(--danger)' : 'var(--mute)', fontWeight: row.late_minutes > 0 ? '600' : 'normal' }}>
                    {row.late_minutes || 0}m
                  </span>
                </td>
                <td align="center">
                  <span style={{
                    padding: '3px 12px',
                    borderRadius: '20px',
                    fontSize: '9px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    background: row.status === 'present' ? 'var(--success)' :
                      row.status === 'absent' || row.status === 'lop' ? 'var(--danger)' :
                      row.status === 'on_leave' ? 'var(--info)' : 'var(--mute)',
                    color: 'white'
                  }}>{row.status}</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );

  const renderCorrectionsTab = () => (
    <>
      <table className="attendance-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Date</th>
            <th>Requested In</th>
            <th>Requested Out</th>
            <th>Reason</th>
            <th align="center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && !loading ? (
            <tr><td colSpan={6} align="center" style={{ padding: '32px', color: 'var(--mute)' }}>No pending correction requests.</td></tr>
          ) : (
            data.map(row => (
              <tr key={row.id}>
                <td style={{ fontWeight: '500', color: 'var(--text)' }}>{row.full_name}</td>
                <td>{format(new Date(row.attendance_date), 'dd MMM yyyy')}</td>
                <td>{row.requested_first_in ? format(new Date(row.requested_first_in), 'hh:mm a') : '-'}</td>
                <td>{row.requested_last_out ? format(new Date(row.requested_last_out), 'hh:mm a') : '-'}</td>
                <td style={{ color: 'var(--mute)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.reason}>{row.reason}</td>
                <td align="center">
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <Button size="sm" variant="outline" style={{ color: 'var(--success)', height: '32px', padding: '0 8px' }} onClick={() => handleReviewCorrection(row.id, 'approved')}>
                      <CheckCircle className="w-4 h-4 mr-1"/> Approve
                    </Button>
                    <Button size="sm" variant="outline" style={{ color: 'var(--danger)', height: '32px', padding: '0 8px' }} onClick={() => handleReviewCorrection(row.id, 'rejected')}>
                      <XCircle className="w-4 h-4 mr-1"/> Reject
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );

  const renderBufferTab = () => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <input 
          type="month" 
          className="form-control"
          value={`${year}-${String(month).padStart(2, '0')}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split('-');
            setYear(Number(y)); setMonth(Number(m));
          }}
          style={{ width: '160px' }}
        />
      </div>
      <table className="attendance-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Code</th>
            <th align="right">Allocated (Mins)</th>
            <th align="right">Used (Mins)</th>
            <th align="right">Remaining (Mins)</th>
            <th align="center">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && !loading ? (
            <tr><td colSpan={6} align="center" style={{ padding: '32px', color: 'var(--mute)' }}>No buffer data for this month.</td></tr>
          ) : (
            data.map(row => (
              <tr key={row.id}>
                <td style={{ fontWeight: '500', color: 'var(--text)' }}>{row.full_name}</td>
                <td style={{ color: 'var(--mute)' }}>{row.employee_code}</td>
                <td align="right">{row.buffer_allocated_minutes}</td>
                <td align="right" style={{ color: 'var(--warning)', fontWeight: '500' }}>{row.buffer_used_minutes}</td>
                <td align="right" style={{ fontWeight: '700', color: 'var(--success)' }}>{row.buffer_remaining_minutes}</td>
                <td align="center">
                  {row.buffer_remaining_minutes === 0 ? (
                    <span style={{ padding: '2px 8px', borderRadius: '3px', background: 'var(--danger)', color: 'white', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>Exhausted</span>
                  ) : (
                    <span style={{ padding: '2px 8px', borderRadius: '3px', background: 'var(--success)', color: 'white', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>Active</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );

  return (
    <div className="attendance-container">
      <div className="attendance-header">
        <div>
          <h1 className="attendance-title">Attendance Management</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-md)', margin: '4px 0 0 0' }}>Built from raw biometric punches — recorded and validated</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
          <button 
            style={{ padding: '6px 12px', background: activeTab === 'daily' ? 'var(--primary)' : 'transparent', color: activeTab === 'daily' ? 'white' : 'var(--text-md)', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s' }}
            onClick={() => setActiveTab('daily')}
          >
            Daily Summary
          </button>
          <button 
            style={{ padding: '6px 12px', background: activeTab === 'corrections' ? 'var(--primary)' : 'transparent', color: activeTab === 'corrections' ? 'white' : 'var(--text-md)', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s' }}
            onClick={() => setActiveTab('corrections')}
          >
            Corrections
          </button>
          <button 
            style={{ padding: '6px 12px', background: activeTab === 'buffer' ? 'var(--primary)' : 'transparent', color: activeTab === 'buffer' ? 'white' : 'var(--text-md)', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s' }}
            onClick={() => setActiveTab('buffer')}
          >
            Late Buffer
          </button>
        </div>
      </div>

      <div className="attendance-table-card">
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--mute)' }}>
             <div style={{ width: '20px', height: '20px', border: '2px solid var(--line)', borderTop: '2px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}></div>
             Loading data...
          </div>
        ) : (
          <div>
            {activeTab === 'daily' && renderDailyTab()}
            {activeTab === 'corrections' && renderCorrectionsTab()}
            {activeTab === 'buffer' && renderBufferTab()}
          </div>
        )}
      </div>
    </div>
  );
};
