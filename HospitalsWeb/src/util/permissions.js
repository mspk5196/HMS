/**
 * Role-Based Access Control (RBAC) permission helpers for HospitalsWeb.
 */

/**
 * Check if the user has a specific permission code.
 *
 * Rules:
 * 1. If user is 'Administrator' role or has 'manage_all' permission -> true for everything.
 * 2. If user.permissions array contains permissionCode -> true.
 * 3. Supports wildcard matches, e.g. 'pharmacy.*' allows any pharmacy permission.
 */
export function hasPermission(user, permissionCode) {
  if (!user) return false;

  // Full administrative access bypass
  if (user.role_name === 'Administrator' || user.permissions?.includes('manage_all')) {
    return true;
  }

  if (!user.permissions || !Array.isArray(user.permissions)) {
    return false;
  }

  // Exact match
  if (user.permissions.includes(permissionCode)) {
    return true;
  }

  // Wildcard match (e.g. 'pharmacy.*')
  if (permissionCode.includes('.')) {
    const [modulePrefix] = permissionCode.split('.');
    if (user.permissions.includes(`${modulePrefix}.*`)) {
      return true;
    }
  }

  return false;
}

/**
 * Check whether a specific sidebar tab / page should be visible to the user.
 * If the user lacks view permission, returns false so it is hidden from sidebar.
 */
export function canViewTab(user, tabId) {
  if (!user) return false;

  // Administrators can view everything
  if (user.role_name === 'Administrator' || user.permissions?.includes('manage_all')) {
    return true;
  }

  switch (tabId) {
    // ─── STAFF & SALARY ───
    case 'hr-employees':
      return hasPermission(user, 'hr_employee.view');
    case 'department-role':
      return hasPermission(user, 'hr_department.view');
    case 'shift-roster':
      return hasPermission(user, 'hr_shift.view') || hasPermission(user, 'hr_roster.view');
    case 'attendance':
      return hasPermission(user, 'attendance.view');
    case 'biometric-punches':
      return hasPermission(user, 'biometric.view') || hasPermission(user, 'attendance.view');
    case 'leave':
      return hasPermission(user, 'leave.view');
    case 'fine':
      return hasPermission(user, 'fine.view');
    case 'payroll':
      return hasPermission(user, 'payroll.view');

    // ─── PATIENT & HOSPITAL ───
    case 'patient-records':
      return hasPermission(user, 'patient.view');
    case 'appointments':
      return hasPermission(user, 'appointment.view');
    case 'consultation-rx':
      return hasPermission(user, 'consultation.view');
    case 'admission-beds':
      return hasPermission(user, 'admission.view') || hasPermission(user, 'facility.view');
    case 'discharge':
      return hasPermission(user, 'discharge.view');
    case 'collect-payment':
      return hasPermission(user, 'payment.view');
    case 'doctor-fee-settings':
      return hasPermission(user, 'payment.view') || hasPermission(user, 'payment.set_fee_rate');

    // ─── PHARMACY ───
    case 'pharmacy-stock':
    case 'pharmacy-categories':
    case 'pharmacy-dispense':
    case 'pharmacy-bills':
    case 'pharmacy-purchase-orders':
    case 'pharmacy-goods-receipts':
    case 'pharmacy-suppliers':
    case 'pharmacy-expiry':
    case 'pharmacy-non-movable':
    case 'pharmacy-movements':
      return hasPermission(user, 'pharmacy.view');

    // ─── ADMIN ───
    case 'users-auth':
      return hasPermission(user, 'users.view') || !!user.can_access_settings;
    case 'approvals':
      return (
        hasPermission(user, 'approval.view') ||
        hasPermission(user, 'leave.review_reporting') ||
        hasPermission(user, 'leave.review_hr') ||
        !!user.can_access_settings
      );
    case 'settings':
      return !!user.can_access_settings;
    case 'audit-logs':
      return user.role_name === 'Administrator' || !!user.can_access_settings || hasPermission(user, 'audit.view');

    default:
      return false;
  }
}
