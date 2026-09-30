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
  // ─── Staff & HR ───
  { code: 'hr_employee', name: 'Employees', group: 'Staff & HR', order: 1 },
  { code: 'hr_department', name: 'Departments & Roles', group: 'Staff & HR', order: 2 },
  { code: 'hr_shift', name: 'Shifts', group: 'Staff & HR', order: 3 },
  { code: 'hr_roster', name: 'Shift Roster', group: 'Staff & HR', order: 4 },
  { code: 'attendance', name: 'Attendance', group: 'Staff & HR', order: 5 },
  { code: 'biometric', name: 'Biometric Logs', group: 'Staff & HR', order: 6 },
  { code: 'leave', name: 'Leave Management', group: 'Staff & HR', order: 7 },
  { code: 'fine', name: 'Fine Engine', group: 'Staff & HR', order: 8 },
  { code: 'payroll', name: 'Payroll', group: 'Staff & HR', order: 9 },

  // ─── Patients & Clinical ───
  { code: 'patient', name: 'Patients', group: 'Patients & Clinical', order: 10 },
  { code: 'appointment', name: 'Appointments', group: 'Patients & Clinical', order: 11 },
  { code: 'consultation', name: 'Consultations & Rx', group: 'Patients & Clinical', order: 12 },
  { code: 'admission', name: 'Admissions & Beds', group: 'Patients & Clinical', order: 13 },
  { code: 'discharge', name: 'Discharge & Billing', group: 'Patients & Clinical', order: 14 },
  { code: 'facility', name: 'Beds & Rooms Setup', group: 'Patients & Clinical', order: 15 },

  // ─── Financial ───
  { code: 'payment', name: 'Payments & Fee Rates', group: 'Financial', order: 16 },

  // ─── Pharmacy ───
  { code: 'pharmacy', name: 'Pharmacy (Stock & Dispense)', group: 'Pharmacy', order: 17 },

  // ─── Administration ───
  { code: 'users', name: 'Users & Authentication', group: 'Administration', order: 18 },
  { code: 'approval', name: 'Approvals Inbox', group: 'Administration', order: 19 },
];

// action code -> { name, special (bool) }
const STANDARD_ACTIONS = ['view', 'create', 'edit', 'delete'];

/**
 * module code -> array of action entries.
 * Standard entries: 'view' | 'create' | 'edit' | 'delete'.
 * Special entries: { code, name, approvable } — code must be unique within the module.
 */
const MODULE_ACTIONS = {
  hr_employee: [
    'view', 'create', 'edit', 'delete',
    { code: 'remap', name: 'Remap Employee', approvable: true },
    { code: 'set_salary', name: 'Set Salary', approvable: true },
    { code: 'bulk_import', name: 'Bulk Import Staff', approvable: true },
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
  attendance: [
    'view', 'create', 'edit',
    { code: 'recalculate', name: 'Recalculate Attendance', approvable: false },
    { code: 'import_punches', name: 'Import Attendance Punches', approvable: true },
    { code: 'manual_mark', name: 'Manual Attendance Mark', approvable: true },
    { code: 'manage_buffer', name: 'Buffer Pool Access', approvable: false },
  ],
  biometric: [
    'view', 'create', 'edit', 'delete',
    { code: 'sync_device', name: 'Sync Punches from Device', approvable: false },
    { code: 'manage_devices', name: 'Manage Biometric Devices', approvable: false },
    { code: 'manage_windows', name: 'Biometric Window Overrides', approvable: true },
  ],
  leave: [
    'view', 'create', 'edit', 'delete',
    { code: 'set_balance', name: 'Set Leave Balance', approvable: true },
    { code: 'review_reporting', name: 'Review — Reporting Manager', approvable: false },
    { code: 'review_hr', name: 'Review — HR', approvable: false },
    { code: 'record_absence', name: 'Record Unexplained Absence', approvable: false },
    { code: 'create_holiday', name: 'Create Holiday', approvable: true },
  ],
  fine: [
    'view', 'create', 'edit', 'delete',
    { code: 'waive_fine', name: 'Waive Fine', approvable: true },
    { code: 'apply_late_fines', name: 'Apply Late Fines', approvable: true },
  ],
  payroll: [
    'view', 'create', 'edit',
    { code: 'generate_payroll', name: 'Generate Monthly Payroll', approvable: true },
    { code: 'approve_payroll', name: 'Approve Payroll Run', approvable: true },
  ],
  patient: ['view', 'create', 'edit', 'delete'],
  appointment: [
    'view', 'create', 'edit', 'delete',
    { code: 'close_visit', name: 'Close Visit', approvable: true },
  ],
  consultation: ['view', 'create', 'edit'],
  admission: [
    'view', 'create', 'edit',
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
  pharmacy: [
    'view', 'create', 'edit', 'delete',
    { code: 'dispense_medicine', name: 'Dispense Medicine', approvable: false },
    { code: 'create_purchase_order', name: 'Create Purchase Order', approvable: true },
    { code: 'receive_goods_grn', name: 'Receive GRN Goods', approvable: true },
  ],
  users: [
    'view', 'create', 'edit', 'delete',
    { code: 'reset_password', name: 'Reset User Password', approvable: true },
  ],
  approval: [
    'view',
    { code: 'approve_request', name: 'Approve Request', approvable: false },
    { code: 'reject_request', name: 'Reject Request', approvable: false },
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
