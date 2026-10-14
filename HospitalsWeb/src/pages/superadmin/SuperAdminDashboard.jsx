import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../util/api';
import { useTheme } from '../../context/ThemeContext';

export default function SuperAdminDashboard({ user, onLogout }) {
  const { theme, toggleTheme } = useTheme ? useTheme() : { theme: 'light', toggleTheme: () => {} };
  const [activeTab, setActiveTab] = useState('organizations'); // 'organizations' | 'connectors' | 'ai_routing'
  
  // Data State
  const [organizations, setOrganizations] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Tenant Creation / Edit Modal
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [orgFormData, setOrgFormData] = useState({
    name: '',
    code: '',
    domain: '',
    db_name: '',
    db_host: 'localhost',
    db_port: 3306,
    deployment_type: 'PLATFORM_HOSTED',
    ai_mode: 'PLATFORM_SHARED',
    ai_service_url: '',
  });

  // Connector Token Generation Modal
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [generatedToken, setGeneratedToken] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);

  // Fetch Organizations
  const fetchOrganizations = async () => {
    try {
      const data = await apiFetch('/control-plane/organizations');
      setOrganizations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch tenant organizations');
    }
  };

  // Fetch Connectors
  const fetchConnectors = async () => {
    try {
      const data = await apiFetch('/control-plane/connectors');
      setConnectors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to fetch biometric connectors:', err.message);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    await Promise.all([fetchOrganizations(), fetchConnectors()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      fetchConnectors();
    }, 15000); // 15s live poll for connector heartbeats
    return () => clearInterval(interval);
  }, []);

  // Save Tenant
  const handleSaveOrg = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      if (editingOrg) {
        await apiFetch(`/control-plane/organizations/${editingOrg.id}`, {
          method: 'PUT',
          body: {
            name: orgFormData.name,
            domain: orgFormData.domain,
            deployment_type: orgFormData.deployment_type,
            ai_mode: orgFormData.ai_mode,
            ai_service_url: orgFormData.ai_service_url || null,
          },
        });
        setSuccessMsg(`Tenant "${orgFormData.name}" updated successfully.`);
      } else {
        await apiFetch('/control-plane/organizations', {
          method: 'POST',
          body: orgFormData,
        });
        setSuccessMsg(`Tenant "${orgFormData.name}" provisioned successfully.`);
      }
      setShowOrgModal(false);
      setEditingOrg(null);
      fetchOrganizations();
    } catch (err) {
      setError(err.message || 'Error saving tenant organization');
    }
  };

  // Generate Pairing Token
  const handleGenerateToken = async (e) => {
    e.preventDefault();
    if (!selectedOrgId) {
      setError('Please select an organization.');
      return;
    }
    setTokenLoading(true);
    setError('');
    try {
      const res = await apiFetch('/control-plane/connectors/generate-token', {
        method: 'POST',
        body: {
          organization_id: Number(selectedOrgId),
          branch_id: Number(selectedBranchId) || 1,
          expiresInHours: 48,
        },
      });
      setGeneratedToken(res);
    } catch (err) {
      setError(err.message || 'Failed to generate edge pairing token');
    } finally {
      setTokenLoading(false);
    }
  };

  const filteredOrgs = organizations.filter((org) => {
    const q = searchQuery.toLowerCase();
    return (
      org.name?.toLowerCase().includes(q) ||
      org.code?.toLowerCase().includes(q) ||
      org.domain?.toLowerCase().includes(q) ||
      org.db_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Super Admin Navigation Header */}
      <header className="bg-slate-950/80 border-b border-slate-800 backdrop-blur sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-black text-white shadow-lg shadow-indigo-500/20">
            CP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base tracking-tight text-white">
                Neha Hospitals Platform Control Plane
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                SUPER ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Multi-Tenant Cloud Registry & Edge Gateway Infrastructure
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-400">Signed in as:</span>
            <span className="font-semibold text-slate-200">{user?.email || 'admin@mspkapps.in'}</span>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Banner Alert Messages */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/50 border border-red-800/80 text-red-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-200">✕</button>
          </div>
        )}

        {/* Global Summary Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tenants</p>
              <p className="text-2xl font-black text-white mt-1">{organizations.length}</p>
              <p className="text-[11px] text-emerald-400 mt-1 font-medium">Platform Isolated DBs</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Edge Connectors</p>
              <p className="text-2xl font-black text-white mt-1">{connectors.length}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[11px] text-emerald-400 font-medium">
                  {connectors.filter(c => c.sync_status === 'online').length} Live Online
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
              </svg>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Service Architecture</p>
              <p className="text-2xl font-black text-white mt-1">Multi-Domain</p>
              <p className="text-[11px] text-violet-400 mt-1 font-medium">CP-SAT Solver & Voice Diarization</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Control Plane DB</p>
              <p className="text-2xl font-black text-white mt-1">MySQL 8.0</p>
              <p className="text-[11px] text-cyan-400 mt-1 font-medium">Database-Per-Tenant Routing</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('organizations')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'organizations'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              🏢 Tenant Organizations ({organizations.length})
            </button>
            <button
              onClick={() => setActiveTab('connectors')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'connectors'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              📡 Biometric Gateways ({connectors.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'organizations' && (
              <button
                onClick={() => {
                  setEditingOrg(null);
                  setOrgFormData({
                    name: '',
                    code: '',
                    domain: '',
                    db_name: '',
                    db_host: 'localhost',
                    db_port: 3306,
                    deployment_type: 'PLATFORM_HOSTED',
                    ai_mode: 'PLATFORM_SHARED',
                    ai_service_url: '',
                  });
                  setShowOrgModal(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                <span>+</span> Provision New Tenant
              </button>
            )}

            {activeTab === 'connectors' && (
              <button
                onClick={() => {
                  setSelectedOrgId(organizations[0]?.id || '');
                  setSelectedBranchId(1);
                  setGeneratedToken(null);
                  setShowTokenModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                <span>⚡</span> Generate Edge Pairing Token
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Organizations View */}
        {activeTab === 'organizations' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-sm w-full">
                <input
                  type="text"
                  placeholder="Filter by name, code, domain, or db..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 text-xs rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <p className="text-xs text-slate-400">
                Showing {filteredOrgs.length} of {organizations.length} organizations
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Organization</th>
                    <th className="px-4 py-3.5">Hostname / Domain</th>
                    <th className="px-4 py-3.5">Database Target</th>
                    <th className="px-4 py-3.5">Deployment</th>
                    <th className="px-4 py-3.5">AI Mode</th>
                    <th className="px-4 py-3.5">Branches</th>
                    <th className="px-4 py-3.5">Connectors</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredOrgs.map((org) => (
                    <tr key={org.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-white text-sm">{org.name}</div>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                          {org.code}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-slate-300">
                        {org.domain}
                      </td>
                      <td className="px-4 py-4 font-mono text-slate-400 text-[11px]">
                        <span className="text-slate-200 font-bold">{org.db_name}</span>
                        <div className="text-[10px] text-slate-500">
                          {org.db_host}:{org.db_port}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                          org.deployment_type === 'PLATFORM_HOSTED'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {org.deployment_type}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                          {org.ai_mode}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-slate-200">
                        {org.total_branches ?? 1}
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-slate-200">
                        {org.total_connectors ?? 0}
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          {org.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => {
                            setEditingOrg(org);
                            setOrgFormData({
                              name: org.name,
                              code: org.code,
                              domain: org.domain,
                              db_name: org.db_name,
                              db_host: org.db_host,
                              db_port: org.db_port,
                              deployment_type: org.deployment_type,
                              ai_mode: org.ai_mode,
                              ai_service_url: org.ai_service_url || '',
                            });
                            setShowOrgModal(true);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors font-medium border border-slate-700"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredOrgs.length === 0 && (
                    <tr>
                      <td colSpan="9" className="text-center py-10 text-slate-500">
                        No organizations found matching "{searchQuery}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Connectors View */}
        {activeTab === 'connectors' && (
          <div className="flex flex-col gap-4">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Gateway Name</th>
                    <th className="px-4 py-3.5">Organization & Facility</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Last Heartbeat</th>
                    <th className="px-4 py-3.5">Version</th>
                    <th className="px-4 py-3.5">Public Endpoint</th>
                    <th className="px-4 py-3.5">Connector Secret Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {connectors.map((conn) => (
                    <tr key={conn.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-white text-sm">{conn.name}</div>
                        <span className="text-[10px] text-slate-500">ID #{conn.id}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-200">{conn.organization_name}</div>
                        <div className="text-[11px] text-indigo-400">{conn.branch_name} ({conn.branch_code})</div>
                      </td>
                      <td className="px-4 py-4">
                        {conn.sync_status === 'online' ? (
                          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-fit">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            ONLINE
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5 w-fit">
                            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                            OFFLINE
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-400">
                        {conn.last_heartbeat ? new Date(conn.last_heartbeat).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-4 py-4 font-mono text-slate-300">
                        v{conn.version || '1.0.0'}
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] text-indigo-300">
                        {conn.public_url || 'LAN / Tunnel'}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-[10px] bg-slate-900 border border-slate-800 px-2.5 py-1 rounded text-slate-400">
                          {conn.connector_key?.slice(0, 8)}...{conn.connector_key?.slice(-6)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {connectors.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-10 text-slate-500">
                        No biometric edge connectors paired yet. Click "Generate Edge Pairing Token" to register one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Provision / Edit Tenant */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white">
                {editingOrg ? `Edit Tenant: ${editingOrg.name}` : 'Provision New Hospital Tenant'}
              </h2>
              <button onClick={() => setShowOrgModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveOrg} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">ORGANIZATION NAME</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apollo Super Speciality"
                    value={orgFormData.name}
                    onChange={(e) => setOrgFormData({ ...orgFormData, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">TENANT CODE</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingOrg}
                    placeholder="e.g. APOLLO"
                    value={orgFormData.code}
                    onChange={(e) => setOrgFormData({ ...orgFormData, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white uppercase focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">ASSIGNED DOMAIN / HOSTNAME</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. apollo.mspkapps.in"
                    value={orgFormData.domain}
                    onChange={(e) => setOrgFormData({ ...orgFormData, domain: e.target.value.toLowerCase() })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white lowercase focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">TARGET DATABASE NAME</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingOrg}
                    placeholder="e.g. apollo_hrms_db"
                    value={orgFormData.db_name}
                    onChange={(e) => setOrgFormData({ ...orgFormData, db_name: e.target.value.toLowerCase() })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white lowercase focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">DEPLOYMENT TYPE</label>
                  <select
                    value={orgFormData.deployment_type}
                    onChange={(e) => setOrgFormData({ ...orgFormData, deployment_type: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PLATFORM_HOSTED">PLATFORM_HOSTED (Multi-Tenant Cloud)</option>
                    <option value="CUSTOMER_HOSTED">CUSTOMER_HOSTED (On-Premise / Edge)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">AI MODE</label>
                  <select
                    value={orgFormData.ai_mode}
                    onChange={(e) => setOrgFormData({ ...orgFormData, ai_mode: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PLATFORM_SHARED">PLATFORM_SHARED (Central AI Service)</option>
                    <option value="CUSTOMER_LOCAL">CUSTOMER_LOCAL (Dedicated Sidecar)</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>
              </div>

              {orgFormData.ai_mode === 'CUSTOMER_LOCAL' && (
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">CUSTOM AI SERVICE URL</label>
                  <input
                    type="text"
                    placeholder="e.g. http://192.168.1.150:8000"
                    value={orgFormData.ai_service_url}
                    onChange={(e) => setOrgFormData({ ...orgFormData, ai_service_url: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOrgModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-600/30"
                >
                  {editingOrg ? 'Save Changes' : 'Provision Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Generate Pairing Token */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white">Generate Biometric Edge Gateway Token</h2>
              <button onClick={() => setShowTokenModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {!generatedToken ? (
              <form onSubmit={handleGenerateToken} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">SELECT TENANT</label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">TARGET BRANCH ID</label>
                  <input
                    type="number"
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Default is Branch #1 (Primary Facility)</p>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowTokenModal(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={tokenLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/30"
                  >
                    {tokenLoading ? 'Generating...' : 'Generate 48h Pairing Token'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Edge Pairing Token</p>
                  <p className="font-mono text-emerald-400 font-bold text-sm select-all mt-1 break-all">
                    {generatedToken.pairing_token}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Valid for {generatedToken.expires_in_hours} hours. Single-use only.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-[11px] font-bold text-slate-400 uppercase mb-1.5">Pairing Command</p>
                  <code className="block font-mono text-[11px] bg-black/60 p-3 rounded-lg text-indigo-300 select-all border border-slate-800/80">
                    npx neha-bio-connector --token={generatedToken.pairing_token}
                  </code>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setShowTokenModal(false);
                      setGeneratedToken(null);
                      fetchConnectors();
                    }}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
