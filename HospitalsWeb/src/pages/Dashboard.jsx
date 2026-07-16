import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, TableLoading } from '../components/ui/Table';
import { Users, Calendar, Bed, Pill, TrendingUp, Activity, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

function StatCard({ label, value, icon: Icon, color = 'blue', sub }) {
  const colors = {
    blue:  { bg: '#eff6ff', ic: '#1d6fbf', ring: '#bfdbfe' },
    green: { bg: '#ecfdf5', ic: '#059669', ring: '#a7f3d0' },
    amber: { bg: '#fffbeb', ic: '#d97706', ring: '#fde68a' },
    slate: { bg: '#f1f5f9', ic: '#475569', ring: '#cbd5e1' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: c.bg, borderColor: c.ring }}>
        <Icon size={18} style={{ color: c.ic }} />
      </div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value ?? '—'}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { request } = useApi();
  const { user, hasPermission } = useAuth();
  const [stats, setStats] = useState({ patients: null, appointments: null, admissions: null, beds: null });
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Load today's appointments for summary
        if (hasPermission('appointment.view')) {
          const apptRes = await request(`/patient/appointments?date=${today}&limit=10`);
          if (apptRes?.success) {
            const rows = apptRes.data?.rows || apptRes.data || [];
            setTodayAppointments(rows);
            setStats(s => ({ ...s, appointments: rows.length }));
          }
        }
        // Patient count
        if (hasPermission('patient.view')) {
          const patRes = await request('/patient/patients?limit=1');
          if (patRes?.success) setStats(s => ({ ...s, patients: patRes.data?.total || 0 }));
        }
        // Admission count
        if (hasPermission('admission.view')) {
          const admRes = await request('/patient/admissions?status=admitted&limit=1');
          if (admRes?.success) setStats(s => ({ ...s, admissions: admRes.data?.total || 0 }));
        }
      } catch (e) { /* silent */ }
      setLoading(false);
    };
    load();
  }, []);

  const statusBadge = (status) => {
    const map = {
      scheduled:       'badge badge-default',
      waiting:         'badge badge-warning',
      in_consultation: 'badge badge-info',
      completed:       'badge badge-success',
      cancelled:       'badge badge-danger',
    };
    return <span className={map[status] || 'badge badge-default'}>{status?.replace('_', ' ')}</span>;
  };

  return (
    <div className="dashboard-container">
      {/* Welcome banner */}
      <div className="dashboard-banner">
        <div>
          <h1>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.username} 👋</h1>
          <p>{format(new Date(), 'EEEE, dd MMMM yyyy')} — Neha Hospital HMS</p>
        </div>
        <div className="dashboard-banner-right">
          Role: <span>{user?.role_name}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="dashboard-stats">
        {hasPermission('patient.view') && (
          <StatCard label="Total Patients" value={stats.patients} icon={Users} color="blue" />
        )}
        {hasPermission('appointment.view') && (
          <StatCard label="Today's Tokens" value={stats.appointments} icon={Calendar} color="green" sub={today} />
        )}
        {hasPermission('admission.view') && (
          <StatCard label="Active Admissions" value={stats.admissions} icon={Bed} color="amber" />
        )}
        <StatCard label="System Status" value="Online" icon={Activity} color="slate" sub="All services running" />
      </div>

      {/* Today's appointments table */}
      {hasPermission('appointment.view') && (
        <Card>
          <CardHeader title={`Today's Appointment Queue — ${format(new Date(), 'dd MMM yyyy')}`} icon={<Calendar size={14} />} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableLoading colSpan={6} />
              ) : todayAppointments.length === 0 ? (
                <TableEmpty colSpan={6} message="No appointments scheduled for today." />
              ) : (
                todayAppointments.map(a => (
                  <TableRow key={a.id}>
                    <TableCell><span className="text-lg font-bold text-[#1d6fbf]">{a.token_number}</span></TableCell>
                    <TableCell>
                      <div className="font-medium">{a.patient_name || a.full_name}</div>
                      <div className="text-[11px] text-[#767c83]">{a.mobile_number}</div>
                    </TableCell>
                    <TableCell>{a.doctor_name || '—'}</TableCell>
                    <TableCell className="capitalize text-[#767c83]">{a.type}</TableCell>
                    <TableCell>{statusBadge(a.status)}</TableCell>
                    <TableCell className="text-[#767c83]">{a.appointment_date}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Catch-all for roles without specific view permissions */}
      {!hasPermission('appointment.view') && !hasPermission('patient.view') && (
        <div className="text-center py-12 text-[#767c83]">
          <AlertCircle className="mx-auto mb-3 opacity-40" size={36} />
          <p className="text-sm">Welcome to Neha Hospital HMS. Navigate using the sidebar to access your modules.</p>
        </div>
      )}
    </div>
  );
}
