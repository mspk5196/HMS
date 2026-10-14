import React, { useState, useMemo, useEffect, useRef } from 'react';
import { canViewTab } from '../util/permissions';
import { useHospitalProfile } from '../context/HospitalProfileContext';
import ThemeToggle from './ThemeToggle';

export default function Navbar({ activeTab, setActiveTab, onLogout, user, isCollapsed: externalCollapsed, setIsCollapsed: externalSetIsCollapsed }) {
  const { hospitalName, hospitalLogo, hospitalSubtitle } = useHospitalProfile();
  const [navSearch, setNavSearch] = useState('');
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    try {
      return localStorage.getItem('nh_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const setIsCollapsed = externalSetIsCollapsed || setInternalCollapsed;

  const [collapsedSections, setCollapsedSections] = useState({});
  const searchInputRef = useRef(null);

  // Sync collapsed state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nh_sidebar_collapsed', isCollapsed);
    } catch (e) {}
  }, [isCollapsed]);

  // Global hotkey '/' to focus navigation search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        if (isCollapsed) setIsCollapsed(false);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setNavSearch('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCollapsed]);

  const toggleSection = (sectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Modern navigation structure organized by clinical and operational domains
  const navSections = [
    {
      key: 'workforce',
      title: 'Staff & Workforce',
      badgeClass: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
      icon: (
        <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      items: [
        {
          id: 'hr-employees',
          label: 'HR & Employees',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          ),
        },
        {
          id: 'department-role',
          label: 'Department & Role',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5h.75m-.75 3h.75m-.75 3h.75" />
            </svg>
          ),
        },
        {
          id: 'shift-roster',
          label: 'Shift & Duty Roster',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          ),
        },
        {
          id: 'attendance',
          label: 'Attendance & Logs',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          id: 'leave',
          label: 'Leave Management',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          ),
        },
        {
          id: 'fine',
          label: 'Fines & Penalties',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          ),
        },
        {
          id: 'payroll',
          label: 'Payroll & Salary',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
          ),
        },
      ],
    },
    {
      key: 'clinical',
      title: 'Clinical & Patients',
      badgeClass: 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20',
      icon: (
        <svg className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      items: [
        {
          id: 'patient-records',
          label: 'Patient Records',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          ),
        },
        {
          id: 'appointments',
          label: 'Appointments',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          ),
        },
        {
          id: 'consultation-rx',
          label: 'Consultation & Rx',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
        {
          id: 'visiting-doctors',
          label: 'Visiting Doctors',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          ),
        },
        {
          id: 'admission-beds',
          label: 'Admission & Beds',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          ),
        },
        {
          id: 'discharge',
          label: 'Discharge',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
            </svg>
          ),
        },
        {
          id: 'collect-payment',
          label: 'Billing & Payments',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          ),
        },
        {
          id: 'doctor-fee-settings',
          label: 'Doctor Fee Rates',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      key: 'pharmacy',
      title: 'Pharmacy',
      badgeClass: 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
      icon: (
        <svg className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
      items: [
        {
          id: 'pharmacy-stock',
          label: 'Current Stock',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          ),
        },
        {
          id: 'pharmacy-categories',
          label: 'Medicine Categories',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
          ),
        },
        {
          id: 'pharmacy-dispense',
          label: 'Dispense Counter',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          ),
        },
        {
          id: 'pharmacy-bills',
          label: 'Bill History',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          ),
        },
        {
          id: 'pharmacy-purchase-orders',
          label: 'Purchase Orders',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          ),
        },
        {
          id: 'pharmacy-goods-receipts',
          label: 'Goods Receipt (GRN)',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          ),
        },
        {
          id: 'pharmacy-suppliers',
          label: 'Suppliers',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          ),
        },
        {
          id: 'pharmacy-expiry',
          label: 'Expiry Stock',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          id: 'pharmacy-non-movable',
          label: 'Non-Movable Stock',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          ),
        },
        {
          id: 'pharmacy-movements',
          label: 'Stock Movements',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-9L21 7.5m0 0L16.5 3M21 7.5H7.5" />
            </svg>
          ),
        },
      ],
    },
    {
      key: 'governance',
      title: 'Governance & System',
      badgeClass: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.08] border-slate-200 dark:border-white/10',
      icon: (
        <svg className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      items: [
        {
          id: 'users-auth',
          label: 'Users & Roles',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          id: 'approvals',
          label: 'Approvals & Requests',
          hasNotification: true,
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.959 11.959 0 0112 2.714z" />
            </svg>
          ),
        },
        {
          id: 'audit-logs',
          label: 'Request Audit Logs',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
          ),
        },
        {
          id: 'branches',
          label: 'Branch Management',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.75c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12l3 3h3v15" />
            </svg>
          ),
        },
        {
          id: 'settings',
          label: 'Hospital Settings',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
      ],
    },
  ];

  // Filter items based on permissions and search query
  const filteredSections = useMemo(() => {
    const q = navSearch.toLowerCase().trim();
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const hasPerm = canViewTab(user, item.id);
          if (!hasPerm) return false;
          if (!q) return true;
          return item.label.toLowerCase().includes(q) || section.title.toLowerCase().includes(q);
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [user, navSearch]);

  const totalVisibleItems = useMemo(() => {
    return filteredSections.reduce((acc, s) => acc + s.items.length, 0);
  }, [filteredSections]);

  return (
    <aside
      className={`relative z-30 flex flex-col flex-shrink-0 min-h-screen select-none transition-all duration-300 ease-in-out border-r ${
        isCollapsed ? 'w-[72px]' : 'w-64'
      } bg-[#fbfcfd] dark:bg-[#0c0f17] text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-800/80 shadow-xs`}
    >
      {/* ── Brand Header ── */}
      {isCollapsed ? (
        <div className="py-3.5 px-2 border-b border-slate-200/80 dark:border-white/[0.08] flex flex-col items-center justify-center gap-2">
          {/* Medical Emblem / Custom Logo (Clickable to Expand) */}
          <button
            onClick={() => setIsCollapsed(false)}
            title={`Expand Sidebar • ${hospitalName}`}
            className="relative shrink-0 w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-sky-400 p-[1.5px] shadow-sm cursor-pointer hover:scale-105 transition-transform"
          >
            <div className="w-full h-full bg-white dark:bg-[#0c0f17] rounded-[10px] flex items-center justify-center overflow-hidden p-0.5">
              {hospitalLogo ? (
                <img src={hospitalLogo} alt={hospitalName} className="w-full h-full object-contain" />
              ) : (
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10.5 4.5a1.5 1.5 0 013 0v4.5H18a1.5 1.5 0 010 3h-4.5V18a1.5 1.5 0 01-3 0v-6H6a1.5 1.5 0 010-3h4.5V4.5z" />
                </svg>
              )}
            </div>
          </button>

          {/* Quick Expand Chevron Button */}
          <button
            onClick={() => setIsCollapsed(false)}
            title="Expand Sidebar"
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-lg transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="p-3.5 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Medical Emblem / Custom Logo */}
            <div className="relative shrink-0 w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-sky-400 p-[1.5px] shadow-sm">
              <div className="w-full h-full bg-white dark:bg-[#0c0f17] rounded-[10px] flex items-center justify-center relative overflow-hidden p-0.5">
                {hospitalLogo ? (
                  <img src={hospitalLogo} alt={hospitalName} className="w-full h-full object-contain" />
                ) : (
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10.5 4.5a1.5 1.5 0 013 0v4.5H18a1.5 1.5 0 010 3h-4.5V18a1.5 1.5 0 01-3 0v-6H6a1.5 1.5 0 010-3h4.5V4.5z" />
                  </svg>
                )}
              </div>
            </div>

            <div className="truncate animate-fade-in">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white leading-tight truncate" title={hospitalName}>
                  {hospitalName}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold tracking-wider uppercase truncate max-w-[140px]" title={hospitalSubtitle || 'Enterprise Care'}>
                  {hospitalSubtitle || 'Enterprise Care'}
                </span>
              </div>
            </div>
          </div>

          {/* Sidebar Collapse Toggle Button */}
          <button
            onClick={() => setIsCollapsed(true)}
            title="Collapse Sidebar"
            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-lg transition-all cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Quick Search Filter Bar ── */}
      {!isCollapsed ? (
        <div className="px-3 pt-3 pb-1">
          <div className="relative">
            <svg className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tabs… (/)"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              className="w-full pl-8 pr-12 py-1.5 text-xs bg-slate-100/90 dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.08] focus:bg-white dark:focus:bg-white/[0.1] border border-slate-200/90 dark:border-white/[0.08] focus:border-emerald-500/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all shadow-xs"
            />
            {navSearch ? (
              <button
                onClick={() => setNavSearch('')}
                className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs px-1 rounded cursor-pointer"
              >
                ×
              </button>
            ) : (
              <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono border border-slate-200 dark:border-white/10 rounded px-1">
                /
              </span>
            )}
          </div>
          {navSearch && (
            <div className="px-1 mt-1 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Matches:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{totalVisibleItems} tabs</span>
            </div>
          )}
        </div>
      ) : (
        <div className="py-2 flex justify-center">
          <button
            onClick={() => {
              setIsCollapsed(false);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            title="Search Navigation (/)"
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-xl transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Scrollable Navigation Sections ── */}
      <div className={`flex-1 overflow-y-auto py-2 ${isCollapsed ? 'px-2 space-y-3' : 'px-2.5 space-y-4'} [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300`}>
        {filteredSections.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 italic">
            No tabs match "{navSearch}"
          </div>
        ) : (
          filteredSections.map((section) => {
            const isSectionCollapsed = !navSearch && collapsedSections[section.key];
            return (
              <div key={section.key} className="space-y-1">
                {/* Section Header Accordion */}
                {!isCollapsed ? (
                  <button
                    onClick={() => toggleSection(section.key)}
                    className="w-full text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white uppercase tracking-wider px-2 py-1 flex items-center justify-between group transition-colors rounded-lg cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0">{section.icon}</span>
                      <span className="tracking-wider">{section.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium border ${section.badgeClass}`}>
                        {section.items.length}
                      </span>
                      <svg
                        className={`w-3 h-3 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-transform duration-200 ${
                          isSectionCollapsed ? '-rotate-90' : 'rotate-0'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </button>
                ) : (
                  <div className="w-8 mx-auto my-2 border-t border-slate-200/80 dark:border-white/[0.08]" />
                )}

                {/* Section Items */}
                {(!isSectionCollapsed || isCollapsed) && (
                  <div className={isCollapsed ? "space-y-1.5 flex flex-col items-center" : "space-y-0.5"}>
                    {section.items.map((item) => {
                      const isActive = activeTab === item.id;
                      
                      if (isCollapsed) {
                        return (
                          <div key={item.id} className="relative group flex justify-center w-full">
                            <button
                              onClick={() => setActiveTab(item.id)}
                              className={`w-10 h-10 relative flex items-center justify-center rounded-xl text-xs transition-all duration-150 cursor-pointer ${
                                isActive
                                  ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 dark:border-emerald-500/40 ring-1 ring-emerald-500/25 shadow-2xs font-semibold'
                                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white border border-transparent'
                              }`}
                            >
                              <span className={`transition-all duration-150 shrink-0 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                                {item.icon}
                              </span>

                              {/* Notification badge */}
                              {item.hasNotification && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#0c0f17] animate-pulse"></span>
                              )}
                            </button>

                            {/* Floating Tooltip in Collapsed Rail Mode */}
                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-slate-900/95 dark:bg-[#182030] text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 flex items-center gap-2 border border-slate-700/60 dark:border-white/10 backdrop-blur-xs">
                              <span>{item.label}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium border ${section.badgeClass}`}>
                                {section.title}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={item.id} className="relative group">
                          <button
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full relative flex items-center gap-3 px-3 py-2 text-xs rounded-xl transition-all duration-150 cursor-pointer ${
                              isActive
                                ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 dark:border-emerald-500/35 text-emerald-950 dark:text-emerald-200 font-bold shadow-2xs'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/90 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white border border-transparent'
                            }`}
                          >
                            {/* Active Left Accent Bar */}
                            {isActive && (
                              <span className="absolute left-1 top-2 bottom-2 w-1 bg-emerald-600 dark:bg-emerald-400 rounded-full shadow-xs"></span>
                            )}

                            {/* Tab Icon */}
                            <span
                              className={`transition-all duration-150 shrink-0 ${
                                isActive
                                  ? 'text-emerald-700 dark:text-emerald-400 scale-105'
                                  : 'text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                              }`}
                            >
                              {item.icon}
                            </span>

                            {/* Tab Label */}
                            <span className="truncate flex-1 text-left">
                              {item.label}
                            </span>

                            {/* Micro Indicator for Active Tab */}
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0"></span>
                            )}

                            {/* Notification Pill */}
                            {!isActive && item.hasNotification && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ring-2 ring-amber-400/20 shrink-0 animate-pulse"></span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Theme Switcher Segmented Control ── */}
      <div className={isCollapsed ? "p-2 flex justify-center border-t border-slate-200/80 dark:border-white/[0.08]" : "px-3 pt-2 pb-1 border-t border-slate-200/80 dark:border-white/[0.08]"}>
        <ThemeToggle compact={isCollapsed} />
      </div>

      {/* ── User Profile & Sign Out Footer ── */}
      {isCollapsed ? (
        <div className="p-2.5 bg-slate-50/80 dark:bg-[#070b14]/90 border-t border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center">
          <div className="relative group cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-xs shadow-xs hover:ring-2 hover:ring-emerald-500/50 transition-all">
              {user?.username?.charAt(0).toUpperCase() || 'A'}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0c0f17]"></span>
            
            {/* Tooltip on hover in collapsed mode */}
            <div className="absolute left-full bottom-1 ml-3 p-3 bg-slate-900/95 dark:bg-[#182030] text-white text-xs rounded-xl shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 border border-slate-700/60 dark:border-white/10 backdrop-blur-xs min-w-[150px]">
              <div className="font-bold text-slate-100">{user?.username || 'Administrator'}</div>
              <div className="text-[10px] text-emerald-400 font-medium mt-0.5">{user?.role_name || user?.role || 'Staff'}</div>
              <button
                onClick={onLogout}
                className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1 px-2 text-[10px] font-semibold text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-600 rounded-md transition-colors cursor-pointer"
              >
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-slate-50/80 dark:bg-[#070b14]/90 border-t border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden flex-1">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {user?.username?.charAt(0).toUpperCase() || 'A'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0c0f17]"></span>
            </div>

            <div className="truncate flex-1">
              <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                {user?.username || 'Administrator'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-medium flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{user?.role_name || user?.role || 'Staff Member'}</span>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Sign Out of Portal"
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
            </svg>
          </button>
        </div>
      )}
    </aside>
  );
}
