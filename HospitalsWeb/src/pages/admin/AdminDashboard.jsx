import React, { useState } from 'react';
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

export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('hr-employees');

  const handleLogoutClick = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore failures
    }
    onLogout();
  };

  const renderContent = () => {
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
        setActiveTab={setActiveTab} 
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
