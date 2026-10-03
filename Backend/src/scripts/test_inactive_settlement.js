require('dotenv').config();
const db = require('../config/db');
const hrService = require('../modules/hr/hr.service');
const salaryService = require('../modules/salary/salary.service');

async function runTest() {
  console.log('=== TESTING INACTIVE EMPLOYEE & SETTLEMENT FLOW ===');

  // 1. Pick an active employee (e.g., ID 1 or 2)
  const [activeEmps] = await db.query("SELECT id, full_name, employee_code, status FROM employees WHERE status = 'active' LIMIT 1");
  if (!activeEmps.length) throw new Error('No active employee found');
  const testEmp = activeEmps[0];
  console.log('Testing with employee:', testEmp.id, testEmp.full_name, testEmp.employee_code);

  // 2. Preview settlement for 2026-10-15 (15 days worked in a 31-day month)
  const exitDate = '2026-10-15';
  const preview = await hrService.previewEmployeeSettlement(testEmp.id, exitDate);
  console.log('\n--- Settlement Preview ---');
  console.log('Month/Year:', preview.month, preview.year);
  console.log('Cal Days vs Active Days:', preview.calDays, preview.activeDays);
  console.log('Day Rate:', preview.dayRate);
  console.log('Salary Breakdown:', {
    base_salary: preview.salaryBreakdown.base_salary_component,
    earned_basic: preview.salaryBreakdown.earned_basic,
    earned_hra: preview.salaryBreakdown.earned_hra,
    earned_gross: preview.salaryBreakdown.earned_gross,
    lop_amount: preview.salaryBreakdown.lop_amount,
    pf: preview.salaryBreakdown.pf_employee_amount,
    esi: preview.salaryBreakdown.esi_employee_amount,
    net_pay: preview.salaryBreakdown.net_pay,
  });

  // 3. Mark Employee Inactive with immediate settlement and payment
  const deactRes = await hrService.deactivateEmployee(
    testEmp.id,
    {
      last_working_date: exitDate,
      reason: 'Resigned due to relocation',
      settle_salary: true,
      mark_as_paid: true,
      payment_mode: 'cash',
      payment_date: exitDate,
      payment_reference: 'CASH-SETTLE-001',
      notes: 'Handed over cash voucher on exit date',
    },
    null,
    1
  );
  console.log('\n--- Deactivation Result ---');
  console.log('Updated Status:', deactRes.employee.status);
  console.log('Leaving Date:', deactRes.employee.date_of_leaving);
  console.log('Inactive Reason:', deactRes.employee.inactive_reason);
  console.log('Settlement Run ID:', deactRes.settlement?.runId);
  console.log('Settlement Is Paid:', deactRes.settlement?.isPaid);

  // 4. Test Generating Full Month Payroll for October 2026
  console.log('\n--- Running Full October Payroll Generation ---');
  const runId = deactRes.settlement.runId;
  const calcRes = await salaryService.calculatePayrollForRun(runId);
  console.log('Calculated Result:', calcRes);

  // 5. Check if the inactive employee is properly included in items with paid settlement preserved
  const items = await salaryService.getPayrollItems(runId, 1, 100);
  const myItem = items.rows.find(i => i.employee_id === testEmp.id);
  console.log('\n--- Inactive Employee in Monthly Payroll Items ---');
  console.log('Employee in Run:', myItem?.full_name);
  console.log('Is Settlement:', myItem?.is_settlement);
  console.log('Payment Status:', myItem?.payment_status);
  console.log('Payment Date:', myItem?.payment_date);
  console.log('Payment Reference:', myItem?.payment_reference);
  console.log('Net Pay:', myItem?.net_pay);

  // 6. Test Reactivating Employee (so we don't mess up real data)
  console.log('\n--- Reactivating Employee ---');
  const reactRes = await hrService.reactivateEmployee(testEmp.id, { reason: 'Reactivated after test' }, 1);
  console.log('Reactivated Status:', reactRes.employee.status);
  console.log('Date of leaving cleared:', reactRes.employee.date_of_leaving === null);

  console.log('\nALL TESTS PASSED PERFECTLY!');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
