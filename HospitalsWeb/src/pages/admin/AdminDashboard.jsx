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
        return <HREmployees />;
      case 'department-role':
        return <DepartmentRole />;
      case 'shift-roster':
        return <ShiftRoster />;
      case 'attendance':
        return <Attendance />;
      case 'biometric-punches':
        return <EmployeeBiometricPunches />;
      case 'leave':
        return <Leave />;
      case 'fine':
        return <Fine />;
      case 'payroll':
        return <Payroll />;
      case 'patient-records':
        return <PatientRecords />;
      case 'appointments':
        return <Appointments />;
      case 'consultation-rx':
        return <ConsultationRx />;
      case 'pharmacy-stock':
        return <PharmacyStock />;
      case 'pharmacy-categories':
        return <PharmacyCategories />;
      case 'pharmacy-dispense':
        return <PharmacyDispense />;
      case 'pharmacy-bills':
        return <PharmacyBillHistory />;
      case 'pharmacy-purchase-orders':
        return <PharmacyPurchaseOrders />;
      case 'pharmacy-goods-receipts':
        return <PharmacyGoodsReceipts />;
      case 'pharmacy-suppliers':
        return <PharmacySuppliers />;
      case 'pharmacy-expiry':
        return <PharmacyExpiryStock />;
      case 'pharmacy-non-movable':
        return <PharmacyNonMovableStock />;
      case 'pharmacy-movements':
        return <PharmacyMovements />;
      case 'admission-beds':
        return <AdmissionBeds />;
      case 'discharge':
        return <Discharge />;
      case 'collect-payment':
        return <CollectPayment />;
      case 'doctor-fee-settings':
        return <DoctorFeeSettings />;
      case 'users-auth':
        return <UsersAuthentication />;
      case 'approvals':
        return <Approvals />;
      case 'settings':
        return <Settings />;
      default:
        return <HREmployees />;
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
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
