import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, Calendar, Stethoscope, Bed, FileText,
  Pill, Package, ClipboardList, Clock, Banknote, Building2,
  LogOut, ChevronDown, ChevronRight, UserCheck
} from 'lucide-react';
import './DashboardLayout.css';

/* ── Nav structure ─────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: 'Patient Care',
    items: [
      { name: 'Dashboard',      path: '/',                          icon: LayoutDashboard, end: true },
      { name: 'Patients',       path: '/patients/records',          icon: Users,            perm: 'patient.view' },
      { name: 'Appointments',   path: '/patients/appointments',     icon: Calendar,         perm: 'appointment.view' },
      { name: 'Consultation',   path: '/patients/consultation',     icon: Stethoscope,      perm: 'consultation.view' },
    ],
  },
  {
    label: 'IPD / Hospital',
    items: [
      { name: 'Admissions',     path: '/hospital/admissions',       icon: Bed,              perm: 'admission.view' },
      { name: 'Discharge',      path: '/hospital/discharge',        icon: FileText,         perm: 'discharge.view' },
    ],
  },
  {
    label: 'Pharmacy',
    items: [
      { name: 'Billing (POS)',  path: '/pharmacy/billing',          icon: Pill,             perm: 'pharmacy.view' },
      { name: 'Stock / Inventory', path: '/pharmacy/stock',         icon: Package,          perm: 'pharmacy.view' },
    ],
  },
  {
    label: 'Human Resources',
    items: [
      { name: 'Employees',      path: '/hr/employees',              icon: UserCheck,        perm: 'hr_employee.view' },
      { name: 'Departments & Roles', path: '/hr/structure',          icon: Building2,        perm: 'hr_employee.view' },
      { name: 'Duty Roster',    path: '/hr/roster',                 icon: ClipboardList,    perm: 'shift_roster.view' },
      { name: 'Attendance',     path: '/hr/attendance',             icon: Clock,            perm: 'attendance.view' },
      { name: 'Payroll',        path: '/hr/payroll',                icon: Banknote,         perm: 'payroll.view' },
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
