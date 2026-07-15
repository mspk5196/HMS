import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, TableLoading } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Plus, X, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

function CreateModal({ open, onClose, type, onSaved }) {
  const { request, loading } = useApi();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');

  const titles = {
    department: 'Add New Department',
    designation: 'Add New Designation',
    role: 'Add New Role',
  };

  const labels = {
    department: 'Department Name *',
    designation: 'Designation Name *',
    role: 'Role Name *',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!name.trim()) return setErr('Name is required');

    try {
      if (type === 'department') {
        await request('/hr/departments', { method: 'POST', body: JSON.stringify({ name }) });
      } else if (type === 'designation') {
        await request('/hr/designations', { method: 'POST', body: JSON.stringify({ name }) });
      } else if (type === 'role') {
        await request('/hr/roles', { method: 'POST', body: JSON.stringify({ name, description }) });
      }
      onSaved();
      onClose();
      setName('');
      setDescription('');
    } catch (e) {
      setErr(e.message);
    }
  };

  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 440 }}>
        <div className="modal-header">
          <h2 className="text-sm font-bold">{titles[type]}</h2>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div>
              <label className="field-label">{labels[type]}</label>
              <input
                className="field"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={`e.g. ${type === 'department' ? 'Cardiology' : type === 'designation' ? 'Senior Consultant' : 'Doctor'}`}
              />
            </div>
            {type === 'role' && (
              <div>
                <label className="field-label">Description</label>
                <textarea
                  className="field resize-none"
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Role access description..."
                />
              </div>
            )}
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
          <div className="modal-footer">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={loading}>Create</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Structure() {
  const { request } = useApi();
  const [activeTab, setActiveTab] = useState('department'); // department | designation | role
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const path = activeTab === 'role' ? '/hr/roles' : `/hr/${activeTab}s`;
      const res = await request(path);
      if (res?.success) {
        setData(res.data || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const addBtnLabels = {
    department: 'Add Department',
    designation: 'Add Designation',
    role: 'Add Role',
  };

  const getPageSub = () => {
    if (activeTab === 'department') return `${data.length} hospital departments`;
    if (activeTab === 'designation') return `${data.length} staff designations`;
    return `${data.length} access roles`;
  };

  return (
    <div className="p-5 space-y-4">
      <div className="page-header">
        <div>
          <div className="page-header__title">Departments, Designations & Roles</div>
          <div className="page-header__sub">{getPageSub()}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="tab-bar">
            <button className={`tab-btn ${activeTab === 'department' ? 'active' : ''}`} onClick={() => setActiveTab('department')}>Departments</button>
            <button className={`tab-btn ${activeTab === 'designation' ? 'active' : ''}`} onClick={() => setActiveTab('designation')}>Designations</button>
            <button className={`tab-btn ${activeTab === 'role' ? 'active' : ''}`} onClick={() => setActiveTab('role')}>Roles</button>
          </div>
          <Button variant="outline" icon={RefreshCw} onClick={loadData}>Refresh</Button>
          <Button icon={Plus} onClick={() => setShowModal(true)}>{addBtnLabels[activeTab]}</Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              {activeTab === 'role' ? (
                <TableHead>Description</TableHead>
              ) : (
                <TableHead align="center">Status</TableHead>
              )}
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableLoading colSpan={activeTab === 'role' ? 4 : 4} />
            ) : data.length === 0 ? (
              <TableEmpty colSpan={activeTab === 'role' ? 4 : 4} message={`No ${activeTab}s configured yet.`} />
            ) : (
              data.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs font-bold text-[#1d6fbf]">{item.id}</TableCell>
                  <TableCell className="font-semibold">{item.name}</TableCell>
                  {activeTab === 'role' ? (
                    <TableCell className="text-[#767c83]">{item.description || '—'}</TableCell>
                  ) : (
                    <TableCell align="center">
                      <span className={`badge ${item.is_active ? 'badge-success' : 'badge-default'}`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="text-[#767c83]">
                    {item.created_at ? format(new Date(item.created_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <CreateModal
        open={showModal}
        onClose={() => setShowModal(false)}
        type={activeTab}
        onSaved={loadData}
      />
    </div>
  );
}
