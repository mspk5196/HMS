/**
 * Shared DTO mappers between the API's snake_case rows and the UI's camelCase shapes.
 * Kept here so the Department-Role and Employees screens agree on the same shape.
 */

const isoDate = (value) => (value ? new Date(value).toISOString().split('T')[0] : '');

/** employees row → the "member" shape used by department member lists. */
export const mapEmployeeToMember = (emp) => ({
  id: emp.id,
  employeeCode: emp.employee_code || '—',
  name: emp.full_name,
  position: emp.designation_name || 'Staff',
  qualification: emp.qualification || '—',
  dateOfJoining: isoDate(emp.date_of_joining) || '—',
  experienceDescription: emp.experience_description || '—',
});

/** employees row → the shape AddMemberForm edits. Empty strings, not dashes. */
export const mapEmployeeToForm = (emp) => ({
  employeeCode: emp.employee_code || '',
  name: emp.full_name || '',
  qualification: emp.qualification || '',
  position: emp.designation_name || '',
  dateOfJoining: isoDate(emp.date_of_joining),
  experienceDescription: emp.experience_description || '',
});

export { isoDate };
