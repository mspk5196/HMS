/**
 * Single source of truth for the permission surface of the app.
 *
 * Every entry becomes one row in `permissions` (code = `${module}.${action}`),
 * one matrix cell in the Role Permissions UI, and — for `approvable: true`
 * entries — one configurable row in the Approval Workflows UI.
 *
 * `view` actions are access-control only (never approvable — approving a
 * read makes no sense). Everything else can optionally require approval.
 */

const MODULES = [
  { code: 'patient', name: 'Patients', group: 'Patients & Clinical', order: 1 },
  { code: 'appointment', name: 'Appointments', group: 'Patients & Clinical', order: 2 },
  { code: 'consultation', name: 'Consultations', group: 'Patients & Clinical', order: 3 },
  { code: 'admission', name: 'Admissions', group: 'Patients & Clinical', order: 4 },
  { code: 'discharge', name: 'Discharge & Billing', group: 'Patients & Clinical', order: 5 },
  { code: 'facility', name: 'Beds & Rooms Setup', group: 'Patients & Clinical', order: 6 },
  { code: 'payment', name: 'Payments', group: 'Financial', order: 7 },
  { code: 'hr_employee', name: 'Employees', group: 'HR & Staff', order: 8 },
  { code: 'hr_department', name: 'Departments & Roles', group: 'HR & Staff', order: 9 },
  { code: 'hr_shift', name: 'Shifts', group: 'HR & Staff', order: 10 },
  { code: 'hr_roster', name: 'Shift Roster', group: 'HR & Staff', order: 11 },
  { code: 'leave', name: 'Leave Management', group: 'HR & Staff', order: 12 },
];

// action code -> { name, special (bool) }
const STANDARD_ACTIONS = ['view', 'create', 'edit', 'delete'];

/**
 * module code -> array of action entries.
 * Standard entries: 'view' | 'create' | 'edit' | 'delete'.
 * Special entries: { code, name, approvable } — code must be unique within the module.
 */
const MODULE_ACTIONS = {
  patient: ['view', 'create', 'edit'],
  appointment: [
    'view', 'create', 'edit',
    { code: 'close_visit', name: 'Close Visit', approvable: true },
  ],
  consultation: ['view', 'create'],
  admission: [
    'view', 'create',
    { code: 'assign_bed', name: 'Assign Bed', approvable: true },
    { code: 'release_bed', name: 'Release Bed', approvable: true },
    { code: 'add_note', name: 'Add Daily Note', approvable: false },
  ],
  discharge: [
    'view',
    { code: 'discharge_patient', name: 'Discharge Patient', approvable: true },
    { code: 'record_payment', name: 'Record Payment', approvable: true },
  ],
  facility: [
    'view',
    { code: 'building_create', name: 'Add Building', approvable: true },
    { code: 'building_delete', name: 'Delete Building', approvable: true },
    { code: 'floor_create', name: 'Add Floor', approvable: true },
    { code: 'floor_delete', name: 'Delete Floor', approvable: true },
    { code: 'ward_create', name: 'Add Ward', approvable: true },
    { code: 'ward_delete', name: 'Delete Ward', approvable: true },
    { code: 'room_type_create', name: 'Add Room Type', approvable: true },
    { code: 'room_type_edit', name: 'Edit Room Type', approvable: true },
    { code: 'room_create', name: 'Add Room', approvable: true },
    { code: 'room_delete', name: 'Delete Room', approvable: true },
    { code: 'bed_create', name: 'Add Bed', approvable: true },
    { code: 'bed_delete', name: 'Delete Bed', approvable: true },
    { code: 'bed_status', name: 'Change Bed Status', approvable: false },
  ],
  payment: [
    'view',
    { code: 'set_fee_rate', name: 'Set Fee Rate', approvable: true },
    { code: 'collect_opd', name: 'Collect OPD Payment', approvable: true },
    { code: 'collect_ipd', name: 'Collect IPD Payment', approvable: true },
  ],
  hr_employee: [
    'view', 'create', 'edit',
    { code: 'remap', name: 'Remap Employee', approvable: true },
    { code: 'set_salary', name: 'Set Salary', approvable: true },
  ],
  hr_department: ['view', 'create', 'edit', 'delete'],
  hr_shift: ['view', 'create', 'edit', 'delete'],
  hr_roster: [
    'view',
    { code: 'save_day', name: 'Save Roster Day', approvable: false },
    { code: 'bulk_save', name: 'Bulk Save Roster', approvable: true },
    { code: 'swap_shift', name: 'Swap Shift', approvable: false },
    { code: 'set_week_off', name: 'Set Week Off', approvable: false },
  ],
  leave: [
    'view', 'create', 'edit', 'delete',
    { code: 'set_balance', name: 'Set Leave Balance', approvable: true },
    { code: 'review_reporting', name: 'Review — Reporting Manager', approvable: false },
    { code: 'review_hr', name: 'Review — HR', approvable: false },
    { code: 'record_absence', name: 'Record Unexplained Absence', approvable: false },
    { code: 'create_holiday', name: 'Create Holiday', approvable: true },
  ],
};

const STANDARD_LABELS = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete' };

/** Flat list of every {code, module, action, label, isSpecial, approvable}. */
function buildCatalog() {
  const entries = [];
  for (const mod of MODULES) {
    const actions = MODULE_ACTIONS[mod.code] || [];
    for (const a of actions) {
      if (typeof a === 'string') {
        entries.push({
          code: `${mod.code}.${a}`,
          module: mod.code,
          action: a,
          label: STANDARD_LABELS[a],
          isSpecial: false,
          approvable: a !== 'view',
        });
      } else {
        entries.push({
          code: `${mod.code}.${a.code}`,
          module: mod.code,
          action: a.code,
          label: a.name,
          isSpecial: true,
          approvable: !!a.approvable,
        });
      }
    }
  }
  return entries;
}

module.exports = { MODULES, MODULE_ACTIONS, STANDARD_ACTIONS, STANDARD_LABELS, buildCatalog };
