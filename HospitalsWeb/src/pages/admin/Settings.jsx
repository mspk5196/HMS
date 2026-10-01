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

import TabBar from '../../components/TabBar';

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
      <TabBar
        tabs={TABS}
        active={tab}
        onChange={setTab}
        maxVisible={4}
        dropdownLabel="More Settings"
      />

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        {tab === 'role-permissions' && <RolePermissions user={user} />}
        {tab === 'approval-workflows' && <ApprovalWorkflows user={user} />}
        {tab === 'settings-access' && <SettingsAccess user={user} />}
        {tab === 'hospital-profile' && <HospitalProfile user={user} />}
      </div>
    </div>
  );
}
