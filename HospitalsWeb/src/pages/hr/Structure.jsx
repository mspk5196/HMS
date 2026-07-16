import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  ShieldCheck, Users, Lock, Calendar, CheckCircle2,
  CheckSquare, Square, Plus, X
} from 'lucide-react';
import './Structure.css';

const PERMISSION_MODULES = [
  'Patient Records', 'Appointments', 'Prescriptions', 'Admissions',
  'Discharge', 'Pharmacy', 'Payroll', 'Attendance',
  'Leave Management', 'Staff Management', 'Reports', 'System Settings',
];

const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];

function CreateRoleModal({ open, onClose, onSaved }) {
  const { request, loading } = useApi();
  const [form, setForm] = useState({ name: '', description: '' });
  const [permissions, setPermissions] = useState({});
  const [err, setErr] = useState('');

  const toggle = (module, action) => {
    const key = `${module}:${action}`;
    setPermissions(p => ({ ...p, [key]: !p[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const perms = Object.entries(permissions).filter(([, v]) => v).map(([k]) => k);
      await request('/hr/roles', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, description: form.description, permissions: perms })
      });
      onSaved(); onClose();
    } catch (e) { setErr(e.message); }
  };

  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="text-sm font-bold">Create New Role</h2>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div>
              <label className="field-label">Role Name *</label>
              <input className="field" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Lab Manager" />
            </div>
            <div>
              <label className="field-label">Description</label>
              <input className="field" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Role description..." />
            </div>
            <div>
              <label className="field-label mb-2 block">Permissions</label>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[var(--text-md)] border-b">
                      <th className="pb-2 font-semibold">Module</th>
                      {PERMISSION_ACTIONS.map(a => (
                        <th key={a} className="pb-2 font-semibold text-center capitalize">{a}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_MODULES.map(mod => (
                      <tr key={mod} className="border-b border-gray-50">
                        <td className="py-2 font-medium">{mod}</td>
                        {PERMISSION_ACTIONS.map(action => {
                          const key = `${mod}:${action}`;
                          return (
                            <td key={action} className="text-center cursor-pointer" onClick={() => toggle(mod, action)}>
                              {permissions[key]
                                ? <CheckSquare className="text-success inline-block" size={16} />
                                : <Square className="text-gray-200 inline-block" size={16} />
                              }
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {err && <p className="text-danger text-xs">{err}</p>}
          </div>
          <div className="modal-footer">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create Role'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Structure() {
  const { request, loading } = useApi();
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [matrixPerms, setMatrixPerms] = useState({});

  const loadRoles = useCallback(async () => {
    try {
      const res = await request('/hr/roles');
      const data = res?.data || [];
      setRoles(data);
      if (data.length > 0 && !selectedRole) {
        setSelectedRole(data[0]);
      }
    } catch (_) {}
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await request('/hr/employees?limit=200');
      setEmployees(res?.data?.rows || res?.data || []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadRoles();
    loadEmployees();
  }, []);

  useEffect(() => {
    if (!selectedRole) return;
    // Build permissions matrix from selected role
    const perms = {};
    const rolePerms = selectedRole.permissions || [];
    rolePerms.forEach(p => { perms[p] = true; });
    // Also try name:action format
    PERMISSION_MODULES.forEach(mod => {
      PERMISSION_ACTIONS.forEach(action => {
        const key = `${mod}:${action}`;
        const altKey = `${mod.toLowerCase().replace(/\s+/g, '_')}:${action}`;
        if (rolePerms.includes(key) || rolePerms.includes(altKey)) {
          perms[key] = true;
        }
      });
    });
    setMatrixPerms(perms);
  }, [selectedRole]);

  const togglePerm = (module, action) => {
    const key = `${module}:${action}`;
    setMatrixPerms(p => ({ ...p, [key]: !p[key] }));
  };

  const handleSavePerms = async () => {
    if (!selectedRole) return;
    try {
      const perms = Object.entries(matrixPerms).filter(([, v]) => v).map(([k]) => k);
      await request(`/hr/roles/${selectedRole.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions: perms })
      });
    } catch (_) {}
  };

  // Count employees per role
  const empPerRole = employees.reduce((acc, emp) => {
    if (emp.role_id) acc[emp.role_id] = (acc[emp.role_id] || 0) + 1;
    return acc;
  }, {});

  const maxEmpCount = Math.max(...Object.values(empPerRole), 1);

  return (
    <div className="page-container">
      <CreateRoleModal open={showModal} onClose={() => setShowModal(false)} onSaved={loadRoles} />
      <PageHeader 
        breadcrumbs={[
          { label: 'Admin', path: '#' },
          { label: 'Roles & Permissions' }
        ]}
        searchPlaceholder="Search roles..."
        actions={
          <Button variant="primary" onClick={() => setShowModal(true)}>
            <Plus size={16} className="mr-1" /> Create Role
          </Button>
        }
      />

      <div className="page-content roles-permissions-page">
        <div className="page-header-text mb-6">
          <h1 className="text-2xl font-bold mb-1">Roles & Permissions</h1>
          <p className="text-[var(--text-md)] text-sm">Define user roles, manage access levels, and control system permissions.</p>
        </div>

        <div className="stats-grid mb-6">
          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Total Roles</div>
              <div className="stat-icon-wrapper blue-bg"><ShieldCheck size={18} className="text-primary" /></div>
            </div>
            <div className="stat-value">{roles.length}</div>
            <div className="stat-sub">Active roles</div>
          </Card>
          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Total Users</div>
              <div className="stat-icon-wrapper green-bg"><Users size={18} className="text-success" /></div>
            </div>
            <div className="stat-value">{employees.length}</div>
            <div className="stat-sub">Across all roles</div>
          </Card>
          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Permission Modules</div>
              <div className="stat-icon-wrapper orange-bg"><Lock size={18} className="text-warning" /></div>
            </div>
            <div className="stat-value">{PERMISSION_MODULES.length}</div>
            <div className="stat-sub">System modules</div>
          </Card>
          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Last Updated</div>
              <div className="stat-icon-wrapper blue-bg"><Calendar size={18} className="text-primary" /></div>
            </div>
            <div className="stat-value">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
            <div className="stat-sub">System permissions</div>
          </Card>
        </div>

        <div className="dashboard-grid">
          <div className="main-column">
            {/* System Roles Card */}
            <Card className="system-roles-card">
              <div className="card-header-flex">
                <h3 className="card-title font-bold">System Roles</h3>
                <Button variant="outline" size="sm">Export</Button>
              </div>
              <div className="role-list">
                {loading && <p className="text-center text-[var(--text-md)] py-8">Loading roles…</p>}
                {!loading && roles.length === 0 && (
                  <p className="text-center text-[var(--text-md)] py-8">No roles defined yet. Create one.</p>
                )}
                {roles.map(role => {
                  const permsCount = (role.permissions || []).length;
                  const userCount = empPerRole[role.id] || role.user_count || 0;
                  return (
                    <div
                      key={role.id}
                      className={`role-item cursor-pointer ${selectedRole?.id === role.id ? 'bg-primary/5 rounded-lg' : ''}`}
                      onClick={() => setSelectedRole(role)}
                    >
                      <div className="role-info">
                        <div className="role-name-row">
                          <span className="role-name font-semibold">{role.name}</span>
                          {permsCount > 0 && (
                            <span className="badge badge-primary-light">{permsCount} permissions</span>
                          )}
                        </div>
                        {role.description && (
                          <div className="role-desc text-xs text-[var(--text-md)] mt-1">{role.description}</div>
                        )}
                        <div className="role-users text-xs text-[var(--text-md)] mt-1">{userCount} active users</div>
                      </div>
                      <div className="role-actions">
                        <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); setSelectedRole(role); }}>Edit</Button>
                        <Button variant="outline" size="sm">View</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Permission Matrix */}
            {selectedRole && (
              <Card className="permission-matrix-card mt-6">
                <div className="card-header-flex">
                  <h3 className="card-title font-bold">Permission Matrix — {selectedRole.name}</h3>
                  <Button variant="primary" onClick={handleSavePerms}>Save Changes</Button>
                </div>
                <div className="matrix-table-wrapper mt-4">
                  <table className="matrix-table w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--text-md)] border-b pb-2">
                        <th className="pb-3 font-semibold">Module</th>
                        {PERMISSION_ACTIONS.map(a => (
                          <th key={a} className="pb-3 font-semibold text-center capitalize">{a}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_MODULES.map((mod, i, arr) => (
                        <tr key={mod} className={i < arr.length - 1 ? 'border-b border-gray-100' : ''}>
                          <td className="py-3 font-medium">{mod}</td>
                          {PERMISSION_ACTIONS.map(action => {
                            const key = `${mod}:${action}`;
                            return (
                              <td key={action} className="text-center cursor-pointer" onClick={() => togglePerm(mod, action)}>
                                {matrixPerms[key]
                                  ? <CheckSquare className="text-success inline-block" size={18} />
                                  : <Square className="text-gray-200 inline-block" size={18} />
                                }
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          <div className="side-column">
            {/* Users by Role */}
            <Card className="side-card">
              <h3 className="card-title font-bold mb-5">Users by Role</h3>
              <div className="users-role-list flex flex-col gap-4">
                {roles.length === 0 && <p className="text-center text-[var(--text-md)] text-sm py-4">No roles</p>}
                {roles.map(role => {
                  const count = empPerRole[role.id] || role.user_count || 0;
                  const pct = count > 0 ? Math.max(5, Math.round((count / maxEmpCount) * 100)) : 0;
                  return (
                    <div key={role.id} className="role-bar-item flex items-center justify-between text-sm">
                      <div className="bar-label w-32 text-[var(--text-md)] truncate" title={role.name}>{role.name}</div>
                      <div className="bar-track flex-1 bg-gray-100 h-2 rounded-full mx-3 overflow-hidden">
                        <div className="bar-fill bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="bar-value font-bold w-6 text-right">{count}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Security Best Practices */}
            <Card className="side-card mt-6">
              <h3 className="card-title font-bold mb-4">Security Best Practices</h3>
              <ul className="security-list flex flex-col gap-3 text-sm text-[var(--text-md)]">
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-success" /> Use least privilege principle</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-success" /> Audit roles quarterly</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-success" /> Review suspicious access</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-success" /> Never share credentials</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-success" /> Log out after session</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
