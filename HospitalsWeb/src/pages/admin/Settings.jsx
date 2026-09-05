import React, { useState } from 'react';
import RolePermissions from './settings/RolePermissions';
import ApprovalWorkflows from './settings/ApprovalWorkflows';
import SettingsAccess from './settings/SettingsAccess';
import HospitalProfile from './settings/HospitalProfile';
import PageHeader from '../../components/PageHeader';

const TABS = [
  { id: 'role-permissions', label: 'Role Permissions' },
  { id: 'approval-workflows', label: 'Approval Workflows' },
  { id: 'settings-access', label: 'Settings Access' },
  { id: 'hospital-profile', label: 'Hospital Profile' },
];

export default function Settings() {
  const [tab, setTab] = useState('role-permissions');

  return (
    <div className="space-y-6">
      <PageHeader
        category="Admin"
        title="Settings"
        subtitle="Hospital configuration, role permissions, approval workflows, and hospital profile."
      />

      <div className="border-b border-gray-200 flex gap-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-3 text-sm font-semibold cursor-pointer transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        {tab === 'role-permissions' && <RolePermissions />}
        {tab === 'approval-workflows' && <ApprovalWorkflows />}
        {tab === 'settings-access' && <SettingsAccess />}
        {tab === 'hospital-profile' && <HospitalProfile />}
      </div>
    </div>
  );
}
