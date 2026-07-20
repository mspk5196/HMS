import React, { useState } from 'react';
import Navbar from '../../components/Navbar';
import HREmployees from './HREmployees';
import DepartmentRole from './DepartmentRole';
import ShiftRoster from './ShiftRoster';
import Attendance from './Attendance';
import Leave from './Leave';
import Fine from './Fine';
import Payroll from './Payroll';
import PatientRecords from './PatientRecords';
import Appointments from './Appointments';
import ConsultationRx from './ConsultationRx';
import Pharmacy from './Pharmacy';
import AdmissionBeds from './AdmissionBeds';
import Discharge from './Discharge';
import RolesPermissions from './RolesPermissions';
import Settings from './Settings';

export default function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('hr-employees');

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
      case 'pharmacy':
        return <Pharmacy />;
      case 'admission-beds':
        return <AdmissionBeds />;
      case 'discharge':
        return <Discharge />;
      case 'roles-permissions':
        return <RolesPermissions />;
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
        onLogout={onLogout} 
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
