import React, { useState } from 'react';
import RolePermissions from './settings/RolePermissions';
import ApprovalWorkflows from './settings/ApprovalWorkflows';
import SettingsAccess from './settings/SettingsAccess';
import HospitalProfile from './settings/HospitalProfile';
import PageHeader from '../../components/PageHeader';
import {
  GearIcon,
  BoltIcon,
  LockIcon,
  LandmarkIcon,
  CheckIcon,
} from '../../components/Icons';

const TABS = [
  { id: 'role-permissions', label: 'Role Permissions', icon: BoltIcon, desc: 'Assign fine-grained actions per role' },
  { id: 'approval-workflows', label: 'Approval Workflows', icon: CheckIcon, desc: 'Two-tier administrative sign-off' },
  { id: 'settings-access', label: 'Settings Access', icon: LockIcon, desc: 'Control which roles can access this page' },
  { id: 'hospital-profile', label: 'Hospital Profile', icon: LandmarkIcon, desc: 'Hospital name, address, and system settings' },
];

export default function Settings({ user }) {
  const [tab, setTab] = useState('role-permissions');

  return (
    <div className="space-y-6">
      <PageHeader
        category="Admin"
        title="Settings & System Configuration"
        subtitle="Manage hospital configuration, role permission matrix, approval workflows, and administrative access."
      />

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-1.5 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                isActive
                  ? 'bg-[#1e40af] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        {tab === 'role-permissions' && <RolePermissions user={user} />}
        {tab === 'approval-workflows' && <ApprovalWorkflows user={user} />}
        {tab === 'settings-access' && <SettingsAccess user={user} />}
        {tab === 'hospital-profile' && <HospitalProfile user={user} />}
      </div>
    </div>
  );
}
