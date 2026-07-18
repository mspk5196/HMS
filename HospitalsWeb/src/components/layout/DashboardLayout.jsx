import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Users, CalendarDays, Clock, FileMinus, AlertCircle, Banknote,
  FolderOpen, Calendar, Stethoscope, Link2, Bed, LogOut,
  ShieldCheck, Settings
} from 'lucide-react';
import './DashboardLayout.css';

/* ── Nav structure ─────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: 'STAFF & SALARY',
    items: [
      { name: 'HR & Employees', path: '/hr/employees', icon: Users, perm: 'hr_employee.view' },
      { name: 'Department & Role', path: '/hr/departments', icon: FolderOpen, perm: 'hr_employee.view' },
      { name: 'Shift & Roster', path: '/hr/roster', icon: CalendarDays, perm: 'shift_roster.view' },
      { name: 'Attendance', path: '/hr/attendance', icon: Clock, perm: 'attendance.view' },
      { name: 'Leave', path: '/hr/leave', icon: FileMinus, perm: 'hr_employee.view' },
      { name: 'Fine', path: '/hr/fine', icon: AlertCircle, perm: 'hr_employee.view' },
      { name: 'Payroll', path: '/hr/payroll', icon: Banknote, perm: 'payroll.view' },
    ],
  },
  {
    label: 'PATIENT & HOSPITAL',
    items: [
      { name: 'Patient Records', path: '/patients/records', icon: FolderOpen, perm: 'patient.view' },
      { name: 'Appointments', path: '/patients/appointments', icon: Calendar, perm: 'appointment.view' },
      { name: 'Consultation & Rx', path: '/patients/consultation', icon: Stethoscope, perm: 'consultation.view' },
      { name: 'Pharmacy', path: '/pharmacy/billing', icon: Link2, perm: 'pharmacy.view' },
      { name: 'Admission & Beds', path: '/hospital/admissions', icon: Bed, perm: 'admission.view' },
      { name: 'Discharge', path: '/hospital/discharge', icon: LogOut, perm: 'discharge.view' },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { name: 'Roles & Permissions', path: '/hr/structure', icon: ShieldCheck, perm: 'hr_employee.view' },
      { name: 'Settings', path: '/settings', icon: Settings, perm: 'hr_employee.view' },
    ],
  },
];

function NavGroup({ group, hasPermission }) {
  const location = useLocation();

  const visibleItems = group.items.filter(item =>
    !item.perm || hasPermission(item.perm)
  );

  if (visibleItems.length === 0) return null;

  return (
    <div className="nav-group">
      <div className="nav-group-label">{group.label}</div>
      {visibleItems.map(item => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={15} />
            <span>{item.name}</span>
          </NavLink>
        );
      })}
    </div>
  );
}

export function DashboardLayout() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout-root">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="brand-icon">NH</div>
          <div>
            <div className="brand-name">Neha Hospital</div>
            <div className="brand-sub">HMS v2.0</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV_GROUPS.map(group => (
            <NavGroup key={group.label} group={group} hasPermission={hasPermission} />
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{user?.username}</div>
              <div className="user-role">{user?.role_name}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-area">
        <Outlet />
      </main>
    </div>
  );
}
