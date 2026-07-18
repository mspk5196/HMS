import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  Users, Search, CheckCircle, AlertCircle, Info
} from 'lucide-react';
import './Leave.css';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysDiff(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  if (s > e) return 0;
  
  let count = 0;
  let temp = new Date(s);
  temp.setHours(0, 0, 0, 0);
  const endCompare = new Date(e);
  endCompare.setHours(0, 0, 0, 0);

  while (temp <= endCompare) {
    if (temp.getDay() !== 0) { // Skip Sundays
      count++;
    }
    temp.setDate(temp.getDate() + 1);
  }
  return count;
}

function statusBadge(status) {
  switch ((status || '').toLowerCase()) {
    case 'pending':  return <span className="badge badge-warning-light">Pending</span>;
    case 'approved': return <span className="badge badge-success-light">Approved</span>;
    case 'rejected': return <span className="badge badge-danger-light">Rejected</span>;
    default:         return <span className="badge">{status}</span>;
  }
}

/**
 * computeLeaveSplit
 * 
 * Given total requested days and available balances, returns an array of split portions:
 *  [{ leaveTypeId, label, days, casual_days, privilege_days, lop_days, type }]
 * 
 * Priority: Casual → Privilege → Loss of Pay
 */
function computeLeaveSplit({ totalDays, casualAvail, plAvail, casualTypeId, plTypeId, lopTypeId }) {
  const splits = [];
  let remaining = totalDays;

  // 1. Take from Casual (if selected type is casual, or always if available)
  if (casualAvail > 0 && remaining > 0 && casualTypeId) {
    const take = Math.min(casualAvail, remaining);
    splits.push({
      leave_type_id: casualTypeId,
      label: 'Casual Leave',
      total_days: take,
      casual_days: take,
      privilege_days: 0,
      lop_days: 0,
      type: 'casual'
    });
    remaining -= take;
  }

  // 2. Overflow → Privilege Leave
  if (plAvail > 0 && remaining > 0 && plTypeId) {
    const take = Math.min(plAvail, remaining);
    splits.push({
      leave_type_id: plTypeId,
      label: 'Privilege Leave',
      total_days: take,
      casual_days: 0,
      privilege_days: take,
      lop_days: 0,
      type: 'privilege'
    });
    remaining -= take;
  }

  // 3. Remaining → Loss of Pay
  if (remaining > 0 && lopTypeId) {
    splits.push({
      leave_type_id: lopTypeId,
      label: 'Loss of Pay',
      total_days: remaining,
      casual_days: 0,
      privilege_days: 0,
      lop_days: remaining,
      type: 'lop'
    });
  }

  return splits;
}

export function Leave() {
  const { request, loading } = useApi();
  
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [allRequests, setAllRequests] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [selectedEmpRequests, setSelectedEmpRequests] = useState([]);
  
  const [leaveForm, setLeaveForm] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [byDateFilter, setByDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAllRequests = useCallback(async () => {
    try {
      const res = await request('/leave/requests?limit=1000');
      setAllRequests(res?.data?.rows || res?.data || []);
    } catch (e) { console.error(e); }
  }, [request]);

  useEffect(() => {
    request('/hr/employees?limit=200').then(r => {
      const list = r?.data?.rows || r?.data || [];
      setEmployees(list);
      if (list.length > 0) setSelectedEmpId(list[0].id);
    }).catch(() => {});

    request('/leave/types').then(r => {
      setLeaveTypes(r?.data || []);
    }).catch(() => {});

    loadAllRequests();
  }, [request, loadAllRequests]);

  const loadEmployeeDetails = useCallback(async () => {
    if (!selectedEmpId) return;
    try {
      const empRes = await request(`/hr/employees/${selectedEmpId}`);
      setSelectedEmp(empRes?.data || null);
      const reqRes = await request(`/leave/requests?employeeId=${selectedEmpId}`);
      setSelectedEmpRequests(reqRes?.data?.rows || reqRes?.data || []);
    } catch (e) { console.error(e); }
  }, [selectedEmpId, request]);

  useEffect(() => {
    loadEmployeeDetails();
  }, [selectedEmpId, loadEmployeeDetails]);

  const filteredEmployees = employees.filter(emp => {
    const term = searchQuery.toLowerCase();
    return (
      emp.full_name.toLowerCase().includes(term) ||
      (emp.employee_code && emp.employee_code.toLowerCase().includes(term))
    );
  });

  // Compute taken leaves
  const casualTaken = selectedEmpRequests
    .filter(r => r.status === 'approved' && (r.leave_type_name || '').toLowerCase().includes('casual'))
    .reduce((sum, r) => sum + daysDiff(r.start_date, r.end_date), 0);

  const privilegeTaken = selectedEmpRequests
    .filter(r => r.status === 'approved' && (
      (r.leave_type_name || '').toLowerCase().includes('privilege') ||
      (r.leave_type_name || '').toLowerCase().includes('annual') ||
      (r.leave_type_name || '').toLowerCase().includes('pr')
    ))
    .reduce((sum, r) => sum + daysDiff(r.start_date, r.end_date), 0);

  // Compute available balances
  const casualAlloted = selectedEmp?.casual_leave_count || 0;
  const plAlloted = selectedEmp?.privilege_leave_count || 0;
  const casualAvail = Math.max(0, casualAlloted - casualTaken);
  const plAvail = Math.max(0, plAlloted - privilegeTaken);

  // Resolve type IDs from the leave types list
  const casualType = leaveTypes.find(lt => lt.name.toLowerCase().includes('casual'));
  const plType = leaveTypes.find(lt =>
    lt.name.toLowerCase().includes('privilege') ||
    lt.name.toLowerCase().includes('annual') ||
    lt.name.toLowerCase().includes('pr')
  );
  const lopType = leaveTypes.find(lt =>
    lt.name.toLowerCase().includes('loss') ||
    lt.name.toLowerCase().includes('lop') ||
    lt.name.toLowerCase().includes('unpaid')
  );

  // Live breakdown computation
  const totalDays = daysDiff(leaveForm.start_date, leaveForm.end_date);
  const leaveSplits = useMemo(() => {
    if (!leaveForm.start_date || !leaveForm.end_date || totalDays <= 0 || !selectedEmp) return [];
    return computeLeaveSplit({
      totalDays,
      casualAvail: casualAlloted > 0 ? casualAvail : 0,
      plAvail: plAlloted > 0 ? plAvail : 0,
      casualTypeId: casualType?.id || null,
      plTypeId: plType?.id || null,
      lopTypeId: lopType?.id || null,
    });
  }, [leaveForm.start_date, leaveForm.end_date, totalDays, casualAvail, plAvail,
      casualType, plType, lopType, selectedEmp, casualAlloted, plAlloted]);

  const lopDays = leaveSplits.reduce((s, x) => s + x.lop_days, 0);
  const paidDays = totalDays - lopDays;

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!selectedEmpId) return;
    if (!leaveForm.start_date || !leaveForm.end_date) {
      showToast('Please select start and end dates.', 'error');
      return;
    }
    if (totalDays <= 0) {
      showToast('End Date must be on or after Start Date.', 'error');
      return;
    }
    if (leaveSplits.length === 0) {
      showToast('Unable to compute leave split. Please check leave types are configured.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Use the primary leave_type_id for the request (first split's type, or LOP if all LOP)
      const primaryTypeId = leaveSplits[0]?.leave_type_id;

      await request('/leave/requests', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(selectedEmpId),
          leave_type_id: Number(primaryTypeId),
          start_date: leaveForm.start_date,
          end_date: leaveForm.end_date,
          total_days: totalDays,
          reason: leaveForm.reason || 'Directly applied',
          status: 'approved',
          splits: leaveSplits.map(s => ({
            leave_type_id: Number(s.leave_type_id),
            total_days: s.total_days,
            casual_days: s.casual_days,
            privilege_days: s.privilege_days,
            lop_days: s.lop_days,
          }))
        })
      });

      showToast(`Leave applied for ${selectedEmp.full_name}. ${paidDays} paid day(s), ${lopDays} LOP day(s).`);
      setLeaveForm({ start_date: '', end_date: '', reason: '' });
      loadEmployeeDetails();
      loadAllRequests();
    } catch (err) {
      showToast(err.message || 'Failed to apply leave', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const leavesOnSelectedDate = allRequests.filter(req => {
    return req.status === 'approved' && req.start_date <= byDateFilter && req.end_date >= byDateFilter;
  });

  return (
    <div className="leave-page p-6 space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className={`toast-alert ${toast.type === 'error' ? 'error-toast' : 'success-toast'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      <PageHeader 
        breadcrumbs={[
          { label: 'Staff Management', path: '#' },
          { label: 'Leave Center' }
        ]}
        title="Leave Management System"
      />

      

      <div className="leave-layout-grid">
        {/* Left Sidebar: Employee Search */}
        <div className="flex flex-col h-[calc(100vh-190px)] min-h-[500px]">
          <Card className="p-4 flex flex-col h-full shadow-sm">
            <div className="mb-4">
              <h3 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider text-slate-500">Search Employee</h3>
              <div className="relative search-box">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter name or code..."
                  className="leave-field pr-4 py-1.5 w-full text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredEmployees.map((emp) => {
                const isSelected = emp.id === selectedEmpId;
                return (
                  <div
                    key={emp.id}
                    className={`emp-search-item p-3 rounded-lg border transition-all flex items-center gap-3 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/30 shadow-sm font-semibold'
                        : 'border-slate-100 hover:bg-slate-50/50'
                    }`}
                    onClick={() => setSelectedEmpId(emp.id)}
                  >
                    <div className="emp-initials" aria-hidden>
                      {emp.full_name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] text-slate-800 truncate">{emp.full_name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{emp.employee_code || `EMP${emp.id}`} · {emp.designation_name || 'Staff'}</div>
                    </div>
                  </div>
                );
              })}
              {filteredEmployees.length === 0 && (
                <div className="text-center text-slate-400 py-10 text-xs">No employees found.</div>
              )}
            </div>
          </Card>
        </div>

        {/* Middle Pane: Details, Balance & Leave Form */}
        <div className="h-[calc(100vh-190px)] min-h-[500px] flex flex-col overflow-y-auto space-y-6 pr-2">
          {selectedEmp ? (
            <>
              {/* Employee Header */}
              <Card className="p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="selected-emp-initials">
                    {selectedEmp.full_name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">{selectedEmp.full_name}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedEmp.employee_code || `EMP${selectedEmp.id}`} · {selectedEmp.department_name} · {selectedEmp.designation_name}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Leave Balance Cards */}
              <div className="leave-balance-container">
                {/* Casual */}
                <div className="balance-card casual">
                  <div className="balance-title">Casual Leaves</div>
                  <div className="balance-metrics">
                    <div className="metric-box">
                      <span className="metric-label">Monthly</span>
                      <span className="metric-val total">{casualAlloted}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">Taken</span>
                      <span className="metric-val used">{casualTaken}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">Available</span>
                      <span className="metric-val avail">{casualAvail}</span>
                    </div>
                  </div>
                </div>

                {/* Privilege */}
                <div className="balance-card privilege">
                  <div className="balance-title">Privilege Leaves</div>
                  <div className="balance-metrics">
                    <div className="metric-box">
                      <span className="metric-label">Monthly</span>
                      <span className="metric-val total">{plAlloted}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">Taken</span>
                      <span className="metric-val used">{privilegeTaken}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">Available</span>
                      <span className="metric-val avail">{plAvail}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Apply Form + History */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Leave Apply Form */}
                <Card className="p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 mb-4 uppercase tracking-wider text-slate-500">Apply Leave</h3>
                  <form onSubmit={handleApplyLeave} className="space-y-4">

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">From Date *</label>
                        <input
                          type="date"
                          required
                          className="leave-field w-full text-xs"
                          value={leaveForm.start_date}
                          onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">To Date *</label>
                        <input
                          type="date"
                          required
                          className="leave-field w-full text-xs"
                          value={leaveForm.end_date}
                          onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Live Leave Breakdown Preview */}
                    {totalDays > 0 && leaveSplits.length > 0 && (
                      <div className="leave-breakdown-preview">
                        <div className="breakdown-header">
                          <Info size={12} />
                          <span>{totalDays} day(s) — Auto-allocated leave breakdown</span>
                        </div>
                        <div className="breakdown-rows">
                          {leaveSplits.map((split, i) => (
                            <div key={i} className={`breakdown-row breakdown-row-${split.type}`}>
                              <span className="breakdown-label">{split.label}</span>
                              <span className="breakdown-days">{split.total_days} {split.total_days === 1 ? 'day' : 'days'}</span>
                            </div>
                          ))}
                        </div>
                        {lopDays > 0 && (
                          <div className="breakdown-lop-notice">
                            ⚠ {lopDays} day(s) will be marked as <strong>Loss of Pay</strong> and deducted from salary.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Warning when no leave types configured */}
                    {totalDays > 0 && leaveSplits.length === 0 && lopType && (
                      <div className="leave-breakdown-preview">
                        <div className="breakdown-header">
                          <Info size={12} />
                          <span>{totalDays} day(s) selected</span>
                        </div>
                        <div className="breakdown-rows">
                          <div className="breakdown-row breakdown-row-lop">
                            <span className="breakdown-label">Loss of Pay</span>
                            <span className="breakdown-days">{totalDays} day(s)</span>
                          </div>
                        </div>
                        <div className="breakdown-lop-notice">
                          ⚠ No leave balance available. All days will be Loss of Pay.
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Reason (Optional)</label>
                      <textarea
                        placeholder="Reason for applying leave..."
                        className="leave-field leave-textarea w-full text-xs"
                        value={leaveForm.reason}
                        onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                      />
                    </div>

                    <Button
                      variant="primary"
                      type="submit"
                      className="w-full text-xs py-2"
                      disabled={submitting || totalDays <= 0}
                    >
                      {submitting ? 'Applying...' : 'Apply & Approve Leave'}
                    </Button>
                  </form>
                </Card>

                {/* Leave History */}
                <Card className="p-5 shadow-sm flex flex-col h-full">
                  <h3 className="text-xs font-bold text-slate-800 mb-4 uppercase tracking-wider text-slate-500">Leave History</h3>
                  <div className="flex-1 overflow-y-auto space-y-2 history-list">
                    {selectedEmpRequests.length === 0 ? (
                      <div className="text-center py-10 text-xs text-slate-400">No leaves taken yet.</div>
                    ) : (
                      selectedEmpRequests.map((req, idx) => {
                        const days = daysDiff(req.start_date, req.end_date);
                        const isLop = (req.lop_days || 0) > 0;
                        return (
                          <div key={req.id || idx} className="history-item">
                            <div>
                              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                {req.leave_type_name || 'Leave'}
                                {isLop && <span className="badge badge-danger-light" style={{fontSize:'9px'}}>LOP</span>}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {fmtDate(req.start_date)} — {fmtDate(req.end_date)} ({days} {days === 1 ? 'day' : 'days'})
                              </div>
                              {/* Show split detail if this record has split data */}
                              {(req.casual_days > 0 || req.privilege_days > 0 || req.lop_days > 0) && (
                                <div className="history-split-detail">
                                  {req.casual_days > 0 && <span className="split-tag split-casual">{req.casual_days}d Casual</span>}
                                  {req.privilege_days > 0 && <span className="split-tag split-privilege">{req.privilege_days}d PL</span>}
                                  {req.lop_days > 0 && <span className="split-tag split-lop">{req.lop_days}d LOP</span>}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              {statusBadge(req.status)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              </div>
            </>
          ) : (
            <Card className="flex-1 flex flex-col items-center justify-center text-center p-8 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-4 border border-dashed">
                <Users size={28} />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No Employee Selected</h3>
              <p className="text-xs text-slate-400 mt-2 max-w-[320px]">
                Please select an employee from the left panel to view leave details or apply leaves.
              </p>
            </Card>
          )}
        </div>

        {/* Right Sidebar: Leaves by Date */}
        <div className="flex flex-col h-[calc(100vh-190px)] min-h-[500px]">
          <Card className="p-4 flex flex-col h-full shadow-sm">
            <div className="mb-4">
              <h3 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider text-slate-500">Leaves by Date</h3>
              <div className="relative">
                <input
                  type="date"
                  className="leave-field w-full text-xs font-medium"
                  value={byDateFilter}
                  onChange={(e) => setByDateFilter(e.target.value)}
                />
              </div>
              <div className="mt-3 text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                Total Absent: <span className="text-red-600 text-xs font-bold ml-1">{leavesOnSelectedDate.length}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {leavesOnSelectedDate.map((r, i) => (
                <div key={r.id || i} className="p-3 border border-slate-100 rounded-lg bg-slate-50/30 flex items-center gap-3">
                  <div className="emp-initials small">
                    {(r.employee_name || r.full_name || '').split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-slate-800 truncate">{r.employee_name || r.full_name || `Employee ${r.employee_id}`}</div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">{r.leave_type_name || 'Leave'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-slate-400 font-bold uppercase">Ends</div>
                    <div className="text-[11.5px] font-semibold text-slate-700 mt-0.5">{fmtDate(r.end_date)}</div>
                  </div>
                </div>
              ))}
              {leavesOnSelectedDate.length === 0 && (
                <div className="text-center text-slate-400 py-10 text-xs">No one is on leave on this date.</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
