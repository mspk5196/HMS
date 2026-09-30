import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import HREmployees from './HREmployees';
import DepartmentRole from './departmentrole/DepartmentRole';
import ShiftRoster from './shiftroster/ShiftRoster';
import Attendance from './Attendance';
import EmployeeBiometricPunches from './EmployeeBiometricPunches';
import Leave from './Leave';
import Fine from './Fine';
import Payroll from './Payroll';
import PatientRecords from './PatientRecords';
import Appointments from './Appointments';
import ConsultationRx from './ConsultationRx';
import PharmacyStock from './pharmacy/StockList';
import PharmacyCategories from './pharmacy/MedicineCategories';
import PharmacyDispense from './pharmacy/DispenseCounter';
import PharmacyBillHistory from './pharmacy/BillHistory';
import PharmacyPurchaseOrders from './pharmacy/PurchaseOrders';
import PharmacyGoodsReceipts from './pharmacy/GoodsReceipts';
import PharmacySuppliers from './pharmacy/Suppliers';
import PharmacyExpiryStock from './pharmacy/ExpiryStock';
import PharmacyNonMovableStock from './pharmacy/NonMovableStock';
import PharmacyMovements from './pharmacy/StockMovements';
import AdmissionBeds from './AdmissionBeds';
import Discharge from './Discharge';
import CollectPayment from './CollectPayment';
import DoctorFeeSettings from './DoctorFeeSettings';
import Settings from './Settings';
import UsersAuthentication from './UsersAuthentication';
import Approvals from './Approvals';
import AuditLogs from './AuditLogs';
import { apiFetch } from '../../util/api';
import { canViewTab } from '../../util/permissions';

const ALL_TABS = [
  'hr-employees',
  'department-role',
  'shift-roster',
  'attendance',
  'biometric-punches',
  'leave',
  'fine',
  'payroll',
  'patient-records',
  'appointments',
  'consultation-rx',
  'admission-beds',
  'discharge',
  'collect-payment',
  'doctor-fee-settings',
  'pharmacy-stock',
  'pharmacy-categories',
  'pharmacy-dispense',
  'pharmacy-bills',
  'pharmacy-purchase-orders',
  'pharmacy-goods-receipts',
  'pharmacy-suppliers',
  'pharmacy-expiry',
  'pharmacy-non-movable',
  'pharmacy-movements',
  'users-auth',
  'approvals',
  'settings',
  'audit-logs',
];

// Helper to resolve active tab from URL hash, search query, localStorage or default fallback
const resolveInitialTab = (user, permittedTabs) => {
  if (typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    if (hash && ALL_TABS.includes(hash) && canViewTab(user, hash)) {
      return hash;
    }
  }

  if (typeof window !== 'undefined' && window.location.search) {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ALL_TABS.includes(tabParam) && canViewTab(user, tabParam)) {
      return tabParam;
    }
  }

  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('neha_active_tab');
    if (saved && ALL_TABS.includes(saved) && canViewTab(user, saved)) {
      return saved;
    }
  }

  return permittedTabs[0] || 'hr-employees';
};

export default function AdminDashboard({ user, onLogout }) {
  const permittedTabs = ALL_TABS.filter((id) => canViewTab(user, id));
  const [activeTab, setActiveTab] = useState(() => resolveInitialTab(user, permittedTabs));

  // Switch tab and sync with URL hash & localStorage
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined') {
      window.location.hash = tabId;
      localStorage.setItem('neha_active_tab', tabId);
    }
  };

  // Sync state with URL hash and localStorage on change
  useEffect(() => {
    if (typeof window !== 'undefined' && activeTab) {
      if (window.location.hash.replace(/^#\/?/, '') !== activeTab) {
        window.location.hash = activeTab;
      }
      localStorage.setItem('neha_active_tab', activeTab);
    }
  }, [activeTab]);

  // Support browser Back/Forward buttons and direct URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      if (hash && ALL_TABS.includes(hash) && canViewTab(user, hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user]);

  const [approvalNotice, setApprovalNotice] = useState(null);

  useEffect(() => {
    const handleApprovalEvent = (e) => {
      setApprovalNotice(e.detail?.message || 'Action submitted for approval (Pending Review).');
      setTimeout(() => setApprovalNotice(null), 6000);
    };
    window.addEventListener('approval-requested', handleApprovalEvent);
    return () => window.removeEventListener('approval-requested', handleApprovalEvent);
  }, []);

  // Auto-switch to first accessible tab if current tab is not permitted
  useEffect(() => {
    if (permittedTabs.length > 0 && !canViewTab(user, activeTab)) {
      const fallback = resolveInitialTab(user, permittedTabs);
      setActiveTab(fallback);
      if (typeof window !== 'undefined') {
        window.location.hash = fallback;
        localStorage.setItem('neha_active_tab', fallback);
      }
    }
  }, [user, activeTab, permittedTabs]);

  const handleLogoutClick = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore failures
    }
    onLogout();
  };

  const renderContent = () => {
    if (!canViewTab(user, activeTab)) {
      return (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-12 text-center max-w-lg mx-auto my-12">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-inner">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Access Restricted</h2>
          <p className="text-xs text-gray-500 mb-6">
            Your current role (<span className="font-semibold text-gray-700">{user?.role_name || 'User'}</span>) does not have permission to view this module. Please contact your system administrator to request access.
          </p>
          {permittedTabs.length > 0 ? (
            <button
              onClick={() => handleTabChange(permittedTabs[0])}
              className="px-5 py-2 bg-[#1b3b82] text-white text-xs font-semibold rounded-lg hover:bg-blue-800 transition-colors shadow-sm cursor-pointer"
            >
              Go to Allowed Page
            </button>
          ) : (
            <button
              onClick={handleLogoutClick}
              className="px-5 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition-colors shadow-sm cursor-pointer"
            >
              Sign Out
            </button>
          )}
        </div>
      );
    }

    switch (activeTab) {
      case 'hr-employees':
        return <HREmployees user={user} />;
      case 'department-role':
        return <DepartmentRole user={user} />;
      case 'shift-roster':
        return <ShiftRoster user={user} />;
      case 'attendance':
        return <Attendance user={user} />;
      case 'biometric-punches':
        return <EmployeeBiometricPunches user={user} />;
      case 'leave':
        return <Leave user={user} />;
      case 'fine':
        return <Fine user={user} />;
      case 'payroll':
        return <Payroll user={user} />;
      case 'patient-records':
        return <PatientRecords user={user} />;
      case 'appointments':
        return <Appointments user={user} />;
      case 'consultation-rx':
        return <ConsultationRx user={user} />;
      case 'pharmacy-stock':
        return <PharmacyStock user={user} />;
      case 'pharmacy-categories':
        return <PharmacyCategories user={user} />;
      case 'pharmacy-dispense':
        return <PharmacyDispense user={user} />;
      case 'pharmacy-bills':
        return <PharmacyBillHistory user={user} />;
      case 'pharmacy-purchase-orders':
        return <PharmacyPurchaseOrders user={user} />;
      case 'pharmacy-goods-receipts':
        return <PharmacyGoodsReceipts user={user} />;
      case 'pharmacy-suppliers':
        return <PharmacySuppliers user={user} />;
      case 'pharmacy-expiry':
        return <PharmacyExpiryStock user={user} />;
      case 'pharmacy-non-movable':
        return <PharmacyNonMovableStock user={user} />;
      case 'pharmacy-movements':
        return <PharmacyMovements user={user} />;
      case 'admission-beds':
        return <AdmissionBeds user={user} />;
      case 'discharge':
        return <Discharge user={user} />;
      case 'collect-payment':
        return <CollectPayment user={user} />;
      case 'doctor-fee-settings':
        return <DoctorFeeSettings user={user} />;
      case 'users-auth':
        return <UsersAuthentication user={user} />;
      case 'approvals':
        return <Approvals user={user} />;
      case 'settings':
        return <Settings user={user} />;
      case 'audit-logs':
        return <AuditLogs user={user} />;
      default:
        return <HREmployees user={user} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#f1f4f8] overflow-hidden antialiased font-sans text-gray-800">
      {/* Sidebar / Navbar Component */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        onLogout={handleLogoutClick} 
        user={user}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-4">
          {approvalNotice && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-4 py-3 rounded-xl shadow-xs flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="text-amber-500 font-bold">⏳</span>
                <span>{approvalNotice}</span>
              </div>
              <button
                onClick={() => setApprovalNotice(null)}
                className="text-amber-600 hover:text-amber-800 cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>
          )}
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
