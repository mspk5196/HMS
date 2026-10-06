import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../../util/api';

/* ─── Icons ─── */
const SparklesIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

const XMarkIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckCircleIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExclamationTriangleIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const PlusIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const TrashIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

const BuildingOffice2Icon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
  </svg>
);

const ClockIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function AiRosterModal({
  isOpen,
  onClose,
  departmentId: initialDeptId,
  departments: propDepts = [],
  staffRoleId,
  startDate,
  endDate,
  shifts: propShifts = [],
  onRosterCommitted
}) {
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'preview'
  const [aiHealth, setAiHealth] = useState({ online: false, checking: true });
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Departments List & Active Department
  const [deptList, setDeptList] = useState(propDepts);
  const [selectedDeptId, setSelectedDeptId] = useState(initialDeptId || '1');

  // Natural Language Prompt State
  const [promptText, setPromptText] = useState(
    'Keep at least 2 staff in morning, 2 in evening, 1 in night. When employee ends night shift for that week, continue day shift of that day. Max 6 consecutive work days.'
  );

  // Custom Shift Slots for this Template
  const [customShifts, setCustomShifts] = useState([
    { id: 1, shift_code: 'M', shift_name: 'Morning Shift', start_time: '08:00:00', end_time: '16:00:00', is_night_shift: false, min_staff: 2 },
    { id: 2, shift_code: 'E', shift_name: 'Evening Shift', start_time: '16:00:00', end_time: '00:00:00', is_night_shift: false, min_staff: 2 },
    { id: 3, shift_code: 'N', shift_name: 'Night Shift', start_time: '20:00:00', end_time: '08:00:00', is_night_shift: true, min_staff: 1 },
    { id: 4, shift_code: 'G', shift_name: 'General Shift', start_time: '09:00:00', end_time: '17:00:00', is_night_shift: false, min_staff: 1 }
  ]);

  // Fatigue & Rest Constraints
  const [maxConsecutiveDays, setMaxConsecutiveDays] = useState(6);
  const [minRestHours, setMinRestHours] = useState(12);
  const [maxNightsPerWeek, setMaxNightsPerWeek] = useState(3);
  const [requireOffAfterNight, setRequireOffAfterNight] = useState(false);

  // Template Saving & Loading
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isDefaultTemplate, setIsDefaultTemplate] = useState(false);

  // Solution State
  const [generationResult, setGenerationResult] = useState(null);
  const [editableAssignments, setEditableAssignments] = useState([]);

  // Fetch departments if not passed as prop
  useEffect(() => {
    if (!isOpen) return;
    if (!deptList || deptList.length === 0) {
      apiFetch('/hr/departments').then((res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setDeptList(list);
        if (list[0]?.id && !selectedDeptId) {
          setSelectedDeptId(String(list[0].id));
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  // Update selectedDeptId when initialDeptId changes
  useEffect(() => {
    if (initialDeptId) {
      setSelectedDeptId(String(initialDeptId));
    }
  }, [initialDeptId]);

  // Check health and load templates when modal opens or department changes
  useEffect(() => {
    if (!isOpen) return;
    checkHealth();
    if (selectedDeptId) {
      loadTemplates(selectedDeptId);
    }
  }, [isOpen, selectedDeptId]);

  const checkHealth = async () => {
    try {
      setAiHealth((prev) => ({ ...prev, checking: true }));
      const res = await apiFetch('/hr/roster/ai/health');
      const data = res?.data || res;
      if (data?.online) {
        setAiHealth({ online: true, checking: false, ...data });
      } else {
        setAiHealth({ online: false, checking: false, error: data?.error });
      }
    } catch (err) {
      setAiHealth({ online: false, checking: false, error: err.message });
    }
  };

  const loadTemplates = async (deptId) => {
    try {
      const res = await apiFetch(`/hr/roster/ai/templates?department_id=${deptId}`);
      const list = Array.isArray(res) ? res : res?.data || [];
      setTemplates(list);
      const def = list.find((t) => t.is_default);
      if (def) {
        applyTemplate(def);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const applyTemplate = (tpl) => {
    if (!tpl?.rules) return;
    setSelectedTemplateId(tpl.id);
    if (tpl.rules.prompt) setPromptText(tpl.rules.prompt);
    if (tpl.rules.custom_shifts && Array.isArray(tpl.rules.custom_shifts)) {
      setCustomShifts(tpl.rules.custom_shifts);
    }
    if (tpl.rules.max_consecutive_working_days) setMaxConsecutiveDays(tpl.rules.max_consecutive_working_days);
    if (tpl.rules.min_rest_hours_between_shifts) setMinRestHours(tpl.rules.min_rest_hours_between_shifts);
    if (tpl.rules.max_night_shifts_per_week) setMaxNightsPerWeek(tpl.rules.max_night_shifts_per_week);
    if (tpl.rules.require_off_after_night_shift !== undefined) {
      setRequireOffAfterNight(Boolean(tpl.rules.require_off_after_night_shift));
    }
  };

  const handleAddShiftSlot = () => {
    const nextId = customShifts.length + 1;
    setCustomShifts([
      ...customShifts,
      {
        id: nextId,
        shift_code: `S${nextId}`,
        shift_name: `Shift ${nextId}`,
        start_time: '08:00:00',
        end_time: '16:00:00',
        is_night_shift: false,
        min_staff: 1
      }
    ]);
  };

  const handleUpdateShiftSlot = (index, field, value) => {
    setCustomShifts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveShiftSlot = (index) => {
    setCustomShifts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      setError('Please enter a template name');
      return;
    }
    try {
      setError(null);
      // Map min staff
      const minStaffMap = {};
      customShifts.forEach((s) => {
        if (s.shift_code) minStaffMap[s.shift_code] = Number(s.min_staff || 0);
      });

      const payload = {
        departmentId: Number(selectedDeptId),
        staffRoleId: staffRoleId ? Number(staffRoleId) : null,
        name: newTemplateName.trim(),
        isDefault: isDefaultTemplate,
        rules: {
          prompt: promptText.trim(),
          custom_shifts: customShifts,
          min_staff_per_shift: minStaffMap,
          max_consecutive_working_days: Number(maxConsecutiveDays),
          min_rest_hours_between_shifts: Number(minRestHours),
          max_night_shifts_per_week: Number(maxNightsPerWeek),
          require_off_after_night_shift: requireOffAfterNight,
          weekly_offs_per_employee: 1
        }
      };
      await apiFetch('/hr/roster/ai/templates', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setSuccessMsg('Template saved successfully with custom timings & prompt!');
      setNewTemplateName('');
      loadTemplates(selectedDeptId);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save template');
    }
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      setGenerationResult(null);

      const minStaffMap = {};
      customShifts.forEach((s) => {
        if (s.shift_code) minStaffMap[s.shift_code] = Number(s.min_staff || 0);
      });

      const rulesPayload = {
        min_staff_per_shift: minStaffMap,
        max_consecutive_working_days: Number(maxConsecutiveDays),
        min_rest_hours_between_shifts: Number(minRestHours),
        max_night_shifts_per_week: Number(maxNightsPerWeek),
        require_off_after_night_shift: requireOffAfterNight,
        weekly_offs_per_employee: 1
      };

      const res = await apiFetch('/hr/roster/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          departmentId: Number(selectedDeptId),
          staffRoleId: staffRoleId ? Number(staffRoleId) : null,
          startDate,
          endDate,
          prompt: promptText.trim(),
          shifts: customShifts,
          rules: rulesPayload
        })
      });

      const data = res?.data || res;
      if (data && data.assignments) {
        setGenerationResult(data);
        setEditableAssignments(data.assignments || []);
        setActiveTab('preview');
      }
    } catch (err) {
      setError(err.message || 'AI Roster Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!generationResult?.generation_id) return;
    try {
      setCommitting(true);
      setError(null);
      const res = await apiFetch('/hr/roster/ai/approve', {
        method: 'POST',
        body: JSON.stringify({
          generation_id: generationResult.generation_id,
          assignments: editableAssignments
        })
      });
      const data = res?.data || res;
      if (data?.success) {
        setSuccessMsg('✅ AI Duty Roster approved and saved into live database!');
        setTimeout(() => {
          if (onRosterCommitted) onRosterCommitted();
          onClose();
        }, 1500);
      }
    } catch (err) {
      setError(err.message || 'Failed to commit roster');
    } finally {
      setCommitting(false);
    }
  };

  // Group editable assignments by employee for preview grid
  const previewData = useMemo(() => {
    if (!editableAssignments.length) return { empList: [], dateList: [] };
    const dateSet = new Set();
    const empMap = new Map();

    editableAssignments.forEach((a) => {
      dateSet.add(a.date);
      if (!empMap.has(a.employee_id)) {
        empMap.set(a.employee_id, {
          id: a.employee_id,
          name: a.employee_name,
          shifts: {}
        });
      }
      empMap.get(a.employee_id).shifts[a.date] = a;
    });

    return {
      dateList: Array.from(dateSet).sort(),
      empList: Array.from(empMap.values())
    };
  }, [editableAssignments]);

  const updateCell = (empId, date, newShiftCode) => {
    setEditableAssignments((prev) =>
      prev.map((a) => {
        if (a.employee_id === empId && a.date === date) {
          if (newShiftCode === 'WO') {
            return {
              ...a,
              shift_code: 'WO',
              shift_name: 'Week Off',
              is_week_off: true,
              shift_id: null,
              start_time: null,
              end_time: null,
              is_night_shift: false
            };
          }
          const targetShift = customShifts.find((s) => s.shift_code === newShiftCode) || propShifts.find((s) => (s.shift_code || s.code) === newShiftCode);
          return {
            ...a,
            shift_code: newShiftCode,
            shift_name: targetShift?.shift_name || targetShift?.name || newShiftCode,
            shift_id: targetShift?.id || null,
            start_time: targetShift?.start_time ? String(targetShift.start_time).slice(0, 5) : '08:00',
            end_time: targetShift?.end_time ? String(targetShift.end_time).slice(0, 5) : '16:00',
            is_night_shift: Boolean(targetShift?.is_night_shift || newShiftCode === 'N' || /night/i.test(targetShift?.shift_name || targetShift?.name || '')),
            is_week_off: false
          };
        }
        return a;
      })
    );
  };

  const selectedDeptObj = deptList.find((d) => String(d.id) === String(selectedDeptId));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
              <SparklesIcon className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                AI Duty Roster Generator
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-medium">
                  Custom Timing &amp; Prompt Solver
                </span>
              </h3>
              <p className="text-xs text-blue-100">
                Period: <strong className="text-white">{startDate}</strong> → <strong className="text-white">{endDate}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Department Selection Inside Modal Window */}
            <div className="flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/20">
              <BuildingOffice2Icon className="w-4 h-4 text-amber-300" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">Dept:</span>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="text-xs font-bold px-2 py-1 rounded-lg bg-white/20 text-white border-0 focus:ring-1 focus:ring-white cursor-pointer"
              >
                {deptList.map((d) => (
                  <option key={d.id} value={d.id} className="text-slate-900">
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Health Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                aiHealth.online
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                  : 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${aiHealth.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              {aiHealth.checking ? 'Checking...' : aiHealth.online ? 'AI Solver Online' : 'Offline'}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'rules'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ClockIcon className="w-4 h-4" />
            1. Shift Timings, Prompts &amp; Rules
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            disabled={!generationResult}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'preview'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 rounded-t-lg'
                : !generationResult
                ? 'border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer'
            }`}
          >
            <SparklesIcon className="w-4 h-4" />
            2. Review &amp; Approve Draft {generationResult ? `(${generationResult.metrics?.fairness_score || 100}% Fit)` : ''}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3 text-rose-700 dark:text-rose-300">
              <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm font-medium">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
              <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
              <div className="text-sm font-medium">{successMsg}</div>
            </div>
          )}

          {/* TAB 1: PROMPT, CUSTOM SHIFT TIMINGS & CONSTRAINTS */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              {/* Template selection header */}
              {templates.length > 0 && (
                <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
                      Load Department Template:
                    </span>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => {
                        const t = templates.find((x) => String(x.id) === e.target.value);
                        if (t) applyTemplate(t);
                      }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                    >
                      <option value="">Custom Configuration</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.is_default ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                    Department: {selectedDeptObj?.name || selectedDeptId}
                  </span>
                </div>
              )}

              {/* 1. Custom Shift Timings Builder */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ClockIcon className="w-4 h-4 text-indigo-600" />
                      Department Shift Slots &amp; Timings
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Define custom shift timings for this roster template. The AI will allocate staff to these exact timing slots.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddShiftSlot}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <PlusIcon className="w-4 h-4" /> Add Shift Slot
                  </button>
                </div>

                {/* Shift Slots Table / Grid */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2.5 font-bold w-16">Code</th>
                        <th className="px-3 py-2.5 font-bold">Shift Name</th>
                        <th className="px-3 py-2.5 font-bold w-32">Start Time</th>
                        <th className="px-3 py-2.5 font-bold w-32">End Time</th>
                        <th className="px-3 py-2.5 font-bold text-center w-24">Night Duty?</th>
                        <th className="px-3 py-2.5 font-bold text-center w-28">Min Staff/Day</th>
                        <th className="px-3 py-2.5 text-center w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {customShifts.map((slot, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2">
                            <input
                              type="text"
                              value={slot.shift_code}
                              onChange={(e) => handleUpdateShiftSlot(idx, 'shift_code', e.target.value)}
                              className="w-full font-bold uppercase text-center px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                              maxLength={4}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={slot.shift_name}
                              onChange={(e) => handleUpdateShiftSlot(idx, 'shift_name', e.target.value)}
                              className="w-full font-semibold px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="time"
                              step="1"
                              value={slot.start_time?.slice(0, 5) || '08:00'}
                              onChange={(e) => handleUpdateShiftSlot(idx, 'start_time', `${e.target.value}:00`)}
                              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="time"
                              step="1"
                              value={slot.end_time?.slice(0, 5) || '16:00'}
                              onChange={(e) => handleUpdateShiftSlot(idx, 'end_time', `${e.target.value}:00`)}
                              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={slot.is_night_shift}
                              onChange={(e) => handleUpdateShiftSlot(idx, 'is_night_shift', e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max="50"
                              value={slot.min_staff ?? 1}
                              onChange={(e) => handleUpdateShiftSlot(idx, 'min_staff', parseInt(e.target.value) || 0)}
                              className="w-16 mx-auto text-center font-bold px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2 text-center">
                            {customShifts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveShiftSlot(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Natural Language Prompt Box */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-blue-50/80 dark:from-slate-800/80 dark:via-slate-850 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/60 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    AI Roster Prompt &amp; Staff Rotation Rules
                  </label>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                    Universal Natural Language Parser (Accepts any phrasing)
                  </span>
                </div>

                <textarea
                  rows="3"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="e.g. Assign Aiswarya to 08:30 to 18:30, Priya to Night shift for 3 days then Day shift. When employee ends night shift, continue day shift of that day. Give Mary Sunday off."
                  className="w-full text-xs sm:text-sm font-medium p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />

                {/* Quick Interactive Prompt Snippets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-500">Quick Prompts:</span>
                  {[
                    'When night shift ends, continue day shift',
                    'Assign Aiswarya to Day Shift',
                    'First 3 days Night Shift then Day Shift',
                    'Sunday off for all senior nurses',
                    'Max 2 night shifts per week, 12h rest between shifts'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPromptText((prev) => (prev ? `${prev} ${preset}.` : `${preset}.`))}
                      className="px-2.5 py-1 text-[11px] font-medium bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/60 hover:bg-indigo-50 text-indigo-700 dark:text-indigo-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Fatigue & General Rest Rules */}
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Fatigue Prevention &amp; Rest Constraints
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Max Consecutive Work Days
                    </label>
                    <input
                      type="number"
                      min="3"
                      max="14"
                      value={maxConsecutiveDays}
                      onChange={(e) => setMaxConsecutiveDays(parseInt(e.target.value) || 6)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
                    />
                    <p className="text-xs text-slate-500 mt-1">Default 6 days (mandatory off on 7th)</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Min Rest Between Shifts (Hours)
                    </label>
                    <input
                      type="number"
                      min="8"
                      max="24"
                      value={minRestHours}
                      onChange={(e) => setMinRestHours(parseInt(e.target.value) || 12)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
                    />
                    <p className="text-xs text-slate-500 mt-1">Prevents Evening → Morning turnaround</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Max Night Shifts / Week
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="7"
                      value={maxNightsPerWeek}
                      onChange={(e) => setMaxNightsPerWeek(parseInt(e.target.value) || 3)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
                    />
                    <p className="text-xs text-slate-500 mt-1">Rotates night duties fairly</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requireOffAfterNight"
                    checked={requireOffAfterNight}
                    onChange={(e) => setRequireOffAfterNight(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <label htmlFor="requireOffAfterNight" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Force 24h Rest / Off Day following a Night shift (Uncheck to allow continuing Day shift upon ending Night block)
                  </label>
                </div>
              </div>

              {/* 4. Save Template Option (Saves Custom Timings + Prompt + Rules) */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                <div className="flex-1 min-w-[240px]">
                  <input
                    type="text"
                    placeholder="Save timings, prompt &amp; rules as template name (e.g. ICU Night-to-Day 3-Shift Template)..."
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={isDefaultTemplate}
                      onChange={(e) => setIsDefaultTemplate(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-indigo-600"
                    />
                    Set as default for {selectedDeptObj?.name || 'this department'}
                  </label>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!newTemplateName.trim()}
                    className="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    Save Template
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PREVIEW & REVIEW */}
          {activeTab === 'preview' && generationResult && (
            <div className="space-y-6">
              {/* Summary Metrics Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase">
                    Fairness Score
                  </span>
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                    {generationResult.metrics?.fairness_score ?? 100}%
                  </div>
                  <p className="text-[11px] text-indigo-600/80 mt-0.5">Optimal workload balance</p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase">
                    Total Shifts
                  </span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {generationResult.metrics?.total_shifts_assigned ?? 0}
                  </div>
                  <p className="text-[11px] text-emerald-600/80 mt-0.5">Across {previewData.empList.length} staff</p>
                </div>

                <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase">
                    Solve Time
                  </span>
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                    {generationResult.solve_time_seconds}s
                  </div>
                  <p className="text-[11px] text-purple-600/80 mt-0.5">Google OR-Tools CP-SAT</p>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase">
                    Deficits / Flags
                  </span>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {generationResult.violations?.length ?? 0}
                  </div>
                  <p className="text-[11px] text-amber-600/80 mt-0.5">Soft constraints checked</p>
                </div>
              </div>

              {/* Prompt Extraction Logs */}
              {generationResult.prompt_logs?.length > 0 && (
                <div className="p-4 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-1.5">
                  <h5 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide flex items-center gap-1.5">
                    <SparklesIcon className="w-4 h-4 text-indigo-600" />
                    AI Prompt Interpretations ({generationResult.prompt_logs.length})
                  </h5>
                  <ul className="text-xs text-indigo-800 dark:text-indigo-300 space-y-1 list-disc pl-5 font-medium">
                    {generationResult.prompt_logs.map((log, i) => (
                      <li key={i}>{log}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Violations / Deficits alerts */}
              {generationResult.violations?.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1.5">
                  <h5 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide flex items-center gap-1.5">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-600" />
                    Solver Notices ({generationResult.violations.length})
                  </h5>
                  <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1 list-disc pl-5">
                    {generationResult.violations.map((v, i) => (
                      <li key={i}>{v.description}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Roster Assignment Preview Matrix */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2.5 font-bold border-b border-r border-slate-200 dark:border-slate-700 min-w-[160px] bg-slate-100 dark:bg-slate-800">
                          Employee ({selectedDeptObj?.name || 'Staff'})
                        </th>
                        {previewData.dateList.map((d) => (
                          <th
                            key={d}
                            className="px-2 py-2.5 text-center font-bold border-b border-r border-slate-200 dark:border-slate-700 min-w-[70px]"
                          >
                            <div>{d.slice(5)}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {previewData.empList.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            {emp.name}
                          </td>
                          {previewData.dateList.map((d) => {
                            const assign = emp.shifts[d];
                            const code = assign?.shift_code || 'WO';
                            const isLeave = assign?.is_leave;

                            let badgeStyle = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                            if (code === 'M' || code === 'D') badgeStyle = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800';
                            if (code === 'E') badgeStyle = 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800';
                            if (code === 'N') badgeStyle = 'bg-indigo-900 text-indigo-100 dark:bg-indigo-950 dark:text-indigo-200 border border-indigo-700';
                            if (code === 'G') badgeStyle = 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800';
                            if (code === 'WO') badgeStyle = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
                            if (isLeave) badgeStyle = 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800';

                            return (
                              <td key={d} className="p-1 text-center border-r border-slate-200 dark:border-slate-800">
                                {isLeave ? (
                                  <span className="inline-block px-2 py-1 rounded text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                    LEAVE
                                  </span>
                                ) : (
                                  <select
                                    value={code}
                                    onChange={(e) => updateCell(emp.id, d, e.target.value)}
                                    className={`text-[11px] font-bold px-1.5 py-1 rounded cursor-pointer transition-colors ${badgeStyle}`}
                                  >
                                    {customShifts.map((s) => (
                                      <option key={s.shift_code} value={s.shift_code}>
                                        {s.shift_code} ({s.shift_name})
                                      </option>
                                    ))}
                                    <option value="WO">WO (Off)</option>
                                  </select>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="text-xs text-slate-500">
            {activeTab === 'preview'
              ? 'Click on any shift cell to manually tweak before committing.'
              : 'Configured shift slots & prompt rules are mathematically solved by Google OR-Tools.'}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {activeTab === 'rules' ? (
              <button
                onClick={handleGenerate}
                disabled={loading || !aiHealth.online}
                className="px-6 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 disabled:opacity-50 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Solving Constraints...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5 text-amber-300" />
                    Generate AI Roster
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('rules')}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Back to Config
                </button>
                <button
                  onClick={handleApprove}
                  disabled={committing}
                  className="px-6 py-2.5 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 disabled:opacity-50 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
                >
                  {committing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Committing Roster...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-5 h-5" />
                      Approve &amp; Save to Live Roster
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
