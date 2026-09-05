const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const bcrypt = require('bcrypt');

async function main() {
  const nehaDir = path.resolve(__dirname, '..', '..', 'neha');
  const salaryFile = path.join(nehaDir, 'NAME LIST  SALARY.xlsx');
  const epfFile = path.join(nehaDir, 'EPF & ESI CALCULATION.xlsx');

  // 1. Read Salary File
  const wbSal = XLSX.readFile(salaryFile);
  const salData = XLSX.utils.sheet_to_json(wbSal.Sheets[wbSal.SheetNames[0]], { header: 1 });

  const salaryRows = [];
  for (let r = 3; r < salData.length; r++) {
    const row = salData[r];
    if (!row || !row[2] || String(row[2]).trim() === '' || row[2] === 'TOTAL') continue;
    
    const dailyStatuses = {};
    for (let day = 1; day <= 31; day++) {
      const colIdx = 24 + day; // col 25 is day 1
      dailyStatuses[day] = row[colIdx] ? String(row[colIdx]).trim() : '';
    }

    salaryRows.push({
      rowIdx: r,
      sNo: row[1] || row[0],
      name: String(row[2]).trim(),
      fixedSalary: row[16] != null ? Number(row[16]) : (row[18] != null ? Number(row[18]) : 0),
      perDaySalary: row[19] != null ? Number(row[19]) : 0,
      otDays: row[15] != null ? Number(row[15]) : 0,
      otSalary: row[20] != null ? Number(row[20]) : 0,
      fine: row[21] != null ? Number(row[21]) : 0,
      foodRoom: row[22] != null ? Number(row[22]) : 0,
      uan: row[3] ? String(row[3]).trim() : null,
      esic: row[4] ? String(row[4]).trim() : null,
      bankAcc: row[5] ? String(row[5]).trim() : null,
      ifsc: row[6] ? String(row[6]).trim() : null,
      wo: row[7] != null ? Number(row[7]) : 4,
      present: row[9] != null ? Number(row[9]) : 0,
      dailyStatuses
    });
  }

  // 2. Read EPF & ESI List
  const wbEpf = XLSX.readFile(epfFile);
  const epfData = XLSX.utils.sheet_to_json(wbEpf.Sheets[wbEpf.SheetNames[0]], { header: 1 });
  const epfEnrolledNames = new Set();
  const esiEnrolledNames = new Set();

  for (let r = 6; r <= 30; r++) {
    const row = epfData[r];
    if (!row) continue;
    // EPF enrolled (col 7 has name, col 10 has 12% share > 0)
    if (row[7] && String(row[7]).trim()) {
      epfEnrolledNames.add(String(row[7]).trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
    // ESI enrolled (col 1 has name, col 2 has Gross > 0)
    if (row[1] && String(row[1]).trim() && Number(row[2]) > 0) {
      esiEnrolledNames.add(String(row[1]).trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
  }

  // 3. Read Punch Monitor Files
  const punchFiles = fs.readdirSync(nehaDir).filter(f => f.startsWith('Employee Punch Monitor') && f.endsWith('.xls'));
  const getDayFromFilename = (fn) => {
    const m = fn.match(/(\d{2})\s+08/);
    return m ? parseInt(m[1], 10) : 0;
  };
  punchFiles.sort((a, b) => getDayFromFilename(a) - getDayFromFilename(b));

  const empByCode = new Map();
  const allPunchesList = []; // { empCode, dateStr, punchDateTime, punchType }

  punchFiles.forEach(pf => {
    const day = getDayFromFilename(pf);
    const dayStr = String(day).padStart(2, '0');
    const dateStr = '2026-08-' + dayStr;
    
    const filePath = path.join(nehaDir, pf);
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    let curDept = null;
    
    rows.forEach(row => {
      if (!row || row.length === 0) return;
      if (row[0] === 'Department' && row[3]) curDept = String(row[3]).trim();
      if (row[1] && row[3] && row[1] !== 'Emp Code ' && row[1] !== 'Emp Code') {
        const code = String(row[1]).trim();
        const name = String(row[3]).trim();
        const punchRecordStr = row[7] ? String(row[7]).trim() : '';
        const status = row[9] ? String(row[9]).trim() : '';
        
        if (!empByCode.has(code)) {
          empByCode.set(code, {
            code: parseInt(code, 10),
            codeStr: code,
            name,
            dept: curDept,
            punchesByDay: {}
          });
        }
        
        const punchTimes = punchRecordStr
          .split(',')
          .map(t => t.trim())
          .filter(t => /^\d{1,2}:\d{2}/.test(t))
          .map(t => {
            const parts = t.split(':');
            const hh = String(parseInt(parts[0], 10)).padStart(2, '0');
            const mm = String(parseInt(parts[1], 10)).padStart(2, '0');
            return hh + ':' + mm + ':00';
          });

        empByCode.get(code).punchesByDay[day] = {
          dateStr,
          punchRecordStr,
          punchTimes,
          status
        };

        punchTimes.forEach((pt, idx) => {
          const punchType = idx === 0 ? 'in' : (idx === punchTimes.length - 1 ? 'out' : null);
          allPunchesList.push({
            empCode: code,
            dateStr,
            punchDateTime: dateStr + ' ' + pt,
            punchType
          });
        });
      }
    });
  });

  const punchEmployees = Array.from(empByCode.values()).sort((a, b) => a.code - b.code);

  const departmentIdMap = {
    'A Medical': 1,
    'Administration': 2,
    'Nursing': 3,
    'Nursing Training': 4,
    'Pharmacy': 5,
    'Lab': 6,
    'Radiology-scan': 7,
    'Security': 8,
    'Z House Keeping': 9
  };

  const departmentMeta = [
    { id: 1, name: 'Medical', description: 'Medical & Clinical Department', head: 'Dr. Revathi' },
    { id: 2, name: 'Administration', description: 'Hospital Administration & Front Office', head: 'Admin Officer' },
    { id: 3, name: 'Nursing', description: 'Inpatient & Outpatient Nursing Care', head: 'Head Nurse' },
    { id: 4, name: 'Nursing Training', description: 'Nursing Trainees & Interns', head: 'Nursing Tutor' },
    { id: 5, name: 'Pharmacy', description: 'Pharmacy & Drug Dispensation', head: 'Chief Pharmacist' },
    { id: 6, name: 'Laboratory', description: 'Diagnostic & Clinical Pathology Lab', head: 'Lab Head' },
    { id: 7, name: 'Radiology & Scan', description: 'Radiology, X-Ray & Ultrasound Scans', head: 'Senior Radiographer' },
    { id: 8, name: 'Security', description: 'Campus Security & Safety', head: 'Security Chief' },
    { id: 9, name: 'House Keeping', description: 'Sanitation, Cleaning & Maintenance', head: 'Housekeeping Supervisor' }
  ];

  const designationMeta = [
    { id: 1, deptId: 1, name: 'Doctor / Consultant', isDoctor: 1, roleId: 2 },
    { id: 2, deptId: 2, name: 'Admin Officer', isDoctor: 0, roleId: 6 },
    { id: 3, deptId: 3, name: 'Staff Nurse', isDoctor: 0, roleId: 3 },
    { id: 4, deptId: 4, name: 'Nurse Trainee', isDoctor: 0, roleId: 7 },
    { id: 5, deptId: 5, name: 'Pharmacist', isDoctor: 0, roleId: 4 },
    { id: 6, deptId: 6, name: 'Lab Technician', isDoctor: 0, roleId: 7 },
    { id: 7, deptId: 7, name: 'Radiographer / Scan Tech', isDoctor: 0, roleId: 7 },
    { id: 8, deptId: 8, name: 'Security Guard', isDoctor: 0, roleId: 7 },
    { id: 9, deptId: 9, name: 'Housekeeping Staff', isDoctor: 0, roleId: 7 }
  ];

  const salaryMap = new Map();
  salaryRows.forEach(sr => {
    salaryMap.set(sr.name.toLowerCase().replace(/[^a-z0-9]/g, ''), sr);
  });

  const aliasSalaryMatch = {
    '2': 'divyasaravanan',
    '3': 'maheswarik',
    '4': 'senthilkumar',
    '5': 'kandasamyc',
    '6': 'indhumathis',
    '7': 'sonapriyagn',
    '8': 'muthupriyam',
    '14': 'swetham',
    '17': 'drrevathis',
    '19': 'anilap',
    '20': 'meenamr',
    '21': 'sangeethav',
    '24': 'gomathiparamesh',
    '27': 'bhuvaneswaric',
    '30': 'gowsalyas',
    '33': 'thilagavathis',
    '39': 'kaverik',
    '40': 'pooranir',
    '44': 'sumitram',
    '48': 'anithan',
    '49': 'aksharar',
    '52': 'neethukrishnar',
    '56': 'sreelakshmis',
    '57': 'balasubramaniamm',
    '58': 'diviyasreea',
    '59': 'elakkiyag',
    '61': 'mohanambal',
    '62': 'tlatha',
    '64': 'palanimuthum',
    '65': 'rajendran',
    '66': 'lawanyap',
    '67': 'rajut',
    '71': 'parvathapathinim',
    '73': 'sathyae',
    '76': 'sivanithyaa',
    '79': 'swathip',
    '81': 'vijayakumara',
    '91': 'nakeshwarim',
    '102': 'sumathik',
    '107': 'priyadharshinib',
    '119': 'rajendransq',
    '123': 'kanchanaa',
    '138': 'amsals',
    '144': 'mekhaos',
    '145': 'akhilakc',
    '146': 'sangeethaps',
    '149': 'drlavanyab',
    '159': 'nithyadevis',
    '161': 'rathikar',
    '165': 'nishas',
    '167': 'suseelai',
    '168': 'suganyav',
    '173': 'gopikaa',
    '175': 'menakam',
    '176': 'sarithar',
    '177': 'mayilr',
    '179': 'kavipriyag',
    '182': 'manjulap',
    '187': 'mahalakshmig',
    '189': 'srilakashmip',
    '190': 'gayathris',
    '192': 'maragathamm',
    '194': 'ardrakc',
    '197': 'abhinayap',
    '198': 'haripriyap',
    '200': 'marasamy',
    '202': 'thenmozhik',
    '204': 'pradeepas',
    '205': 'jeevithas',
    '206': 'gracys',
    '207': 'shafnaa',
    '208': 'jeniferm',
    '210': 'savitha',
    '211': 'saritha',
    '212': 'dharanis',
    '213': 'gowsikavv',
    '214': 'drarulganga',
    '215': 'gomathipp',
    '217': 'rupar',
    '218': 'priyas',
    '220': 'subashinis',
    '221': 'sunitaorang',
    '223': 'dranumithashreep',
    '226': 'ravis'
  };

  const escapeSql = (str) => {
    if (str == null) return 'NULL';
    return "'" + String(str).replace(/'/g, "''").replace(/\\/g, '\\\\') + "'";
  };

  const sqlStatements = [];
  sqlStatements.push('-- ==============================================================================');
  sqlStatements.push('-- Neha Hospital — Staff, Roles, Biometric Punches & Attendance Data (August 2026)');
  sqlStatements.push('-- ==============================================================================');
  sqlStatements.push('SET NAMES utf8mb4;');
  sqlStatements.push('SET FOREIGN_KEY_CHECKS = 0;\n');

  // 1. DEPARTMENTS (id, name, is_active, description, head)
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('-- 1. DEPARTMENTS');
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('INSERT INTO `departments` (`id`, `name`, `is_active`, `description`, `head`) VALUES');
  const deptSqls = departmentMeta.map(d => 
    `  (${d.id}, ${escapeSql(d.name)}, 1, ${escapeSql(d.description)}, ${escapeSql(d.head)})`
  );
  sqlStatements.push(deptSqls.join(',\n') + '\nON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `description` = VALUES(`description`), `head` = VALUES(`head`);\n');

  // 1.1 SHIFTS
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('-- 1.1 SHIFTS');
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('INSERT INTO `shifts` (`id`, `name`, `start_time`, `end_time`, `crosses_midnight`, `buffer_minutes`, `is_night_shift`, `is_active`, `grace_period_minutes`, `biometric_in_start`, `biometric_in_end`, `biometric_out_start`, `biometric_out_end`) VALUES');
  sqlStatements.push("  (1, 'Day Shift', '09:00:00', '16:00:00', 0, 10, 0, 1, 10, '07:00:00', '09:00:00', '16:00:00', '18:00:00'),");
  sqlStatements.push("  (2, 'Night Shift', '20:00:00', '08:00:00', 0, 10, 1, 1, 10, '18:00:00', '20:00:00', '08:00:00', '10:00:00')");
  sqlStatements.push('ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `start_time` = VALUES(`start_time`), `end_time` = VALUES(`end_time`);\n');

  // 1.2 DEFAULT LEAVE TYPES
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('-- 1.2 SYSTEM DEFAULT LEAVE TYPES (Un-deletable)');
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('INSERT INTO `leave_types` (`id`, `name`, `quota_days`, `quota_period`, `is_half_day_allowed`, `is_active`, `is_lop_applicable`, `can_carry_forward`, `max_carry_forward_days`) VALUES');
  sqlStatements.push("  (1, 'Casual Leave', 1.50, 'monthly', 0, 1, 0, 0, 0.00),");
  sqlStatements.push("  (2, 'Privilege Leave', 2.00, 'monthly', 0, 1, 0, 0, 0.00),");
  sqlStatements.push("  (3, 'Loss of Pay', 0.00, 'monthly', 0, 1, 1, 0, 0.00),");
  sqlStatements.push("  (4, 'Sick Leave', 1.00, 'monthly', 0, 1, 0, 0, 0.00),");
  sqlStatements.push("  (5, 'Weekly Off', 4.00, 'monthly', 0, 1, 0, 0, 0.00)");
  sqlStatements.push('ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `quota_days` = VALUES(`quota_days`), `is_lop_applicable` = VALUES(`is_lop_applicable`);\n');

  // 1.3 FINE TYPES
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('-- 1.3 FINE TYPES');
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('INSERT INTO `fine_types` (`id`, `name`, `default_amount`, `trigger_rule`, `calculation_basis`, `description`, `is_active`) VALUES');
  sqlStatements.push("  (1, 'Unapproved Absence', 500.00, 'unapproved_absence_no_leave', 'flat', 'Fine for unapproved absence', 1),");
  sqlStatements.push("  (2, 'Disciplinary Fine', 100.00, 'manual', 'flat', 'Disciplinary or late penalty deduction', 1),");
  sqlStatements.push("  (3, 'Room & Food Deduction', 500.00, 'manual', 'flat', 'Hostel room and food charge deduction', 1)");
  sqlStatements.push('ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `default_amount` = VALUES(`default_amount`);\n');

  // 2. DESIGNATIONS / STAFF ROLES
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('-- 2. STAFF ROLES / DESIGNATIONS');
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('INSERT INTO `staff_roles` (`id`, `department_id`, `name`, `is_doctor`, `is_active`, `basic_salary`, `default_shift_id`, `monthly_buffer_minutes`) VALUES');
  const desigSqls = designationMeta.map(d => 
    `  (${d.id}, ${d.deptId}, ${escapeSql(d.name)}, ${d.isDoctor}, 1, 20000.00, 1, 30)`
  );
  sqlStatements.push(desigSqls.join(',\n') + '\nON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `department_id` = VALUES(`department_id`);\n');

  // 3. EMPLOYEES
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('-- 3. EMPLOYEES (' + punchEmployees.length + ' Staff Members)');
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('INSERT INTO `employees` (`id`, `employee_code`, `full_name`, `department_id`, `designation_id`, `date_of_joining`, `status`, `salary_type`, `basic_salary`, `per_day_salary`, `uan_number`, `esi_number`, `bank_account_no`, `bank_ifsc`, `payment_mode`, `pf_enrolled`, `esi_enrolled`) VALUES');

  const empSqls = [];
  const usersSqls = [];
  const fineSqls = [];
  const overtimeSqls = [];
  let fineCounter = 1;
  let otCounter = 1;

  for (const pe of punchEmployees) {
    const deptId = departmentIdMap[pe.dept] || 2;
    const desig = designationMeta.find(dm => dm.deptId === deptId) || designationMeta[1];
    
    const aliasKey = aliasSalaryMatch[pe.codeStr];
    let sal = aliasKey ? salaryMap.get(aliasKey) : null;
    if (!sal) {
      sal = salaryMap.get(pe.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }

    const basicSalary = sal ? sal.fixedSalary : (deptId === 1 ? 50000 : (deptId === 4 ? 6000 : 18000));
    const perDaySalary = sal && sal.perDaySalary ? sal.perDaySalary : (basicSalary / 31).toFixed(2);
    const uan = sal ? sal.uan : null;
    const esi = sal ? sal.esic : null;
    const bankAcc = sal ? sal.bankAcc : null;
    const ifsc = sal ? sal.ifsc : null;

    // Check specific EPF / ESI enrollment rules
    const normName = pe.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isEpfApplicable = epfEnrolledNames.has(normName) || (aliasKey && epfEnrolledNames.has(aliasKey)) || (uan && uan.length > 5);
    const isEsiApplicable = esiEnrolledNames.has(normName) || (aliasKey && esiEnrolledNames.has(aliasKey));

    const pfEnrolled = isEpfApplicable ? 1 : 0;
    const esiEnrolled = isEsiApplicable ? 1 : 0;

    const empId = pe.code;
    const empCode = pe.codeStr;
    const fullName = pe.name;

    empSqls.push(
      `  (${empId}, ${escapeSql(empCode)}, ${escapeSql(fullName)}, ${deptId}, ${desig.id}, '2024-01-01', 'active', 'monthly', ${basicSalary}, ${perDaySalary}, ${escapeSql(uan)}, ${escapeSql(esi)}, ${escapeSql(bankAcc)}, ${escapeSql(ifsc)}, 'account', ${pfEnrolled}, ${esiEnrolled})`
    );

    let username = fullName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
    if (username.length < 3) username = 'emp.' + empCode;
    username = username + '.' + empCode;

    // Set password = username (bcrypt hashed)
    const userPasswordHash = await bcrypt.hash(username, 10);
    const roleId = desig.roleId;

    usersSqls.push(
      `  (${empId + 100}, ${empId}, ${escapeSql(username)}, ${escapeSql(username + '@nehahospital.com')}, ${escapeSql(userPasswordHash)}, ${roleId}, 1)`
    );

    // Parse Fines from salary sheet
    if (sal) {
      if (sal.fine > 0) {
        fineSqls.push(
          `  (${fineCounter++}, ${empId}, 2, '2026-08-31', ${sal.fine}, 'August Disciplinary / Late Fine', 0, 8, 2026, 'active', 1)`
        );
      }
      if (sal.foodRoom > 0) {
        fineSqls.push(
          `  (${fineCounter++}, ${empId}, 3, '2026-08-31', ${sal.foodRoom}, 'August Room and Food Deduction', 0, 8, 2026, 'active', 1)`
        );
      }
      // Parse Overtime from salary sheet
      if (sal.otDays > 0 || sal.otSalary > 0) {
        const hours = sal.otDays > 0 ? (sal.otDays * 8).toFixed(2) : '8.00';
        overtimeSqls.push(
          `  (${otCounter++}, ${empId}, '2026-08-31', 'extra_day', ${hours}, ${sal.otSalary}, 'August 2026 Extra Duty (${sal.otDays} Day(s))', 1)`
        );
      }
    }
  }

  sqlStatements.push(empSqls.join(',\n') + '\nON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `basic_salary` = VALUES(`basic_salary`), `department_id` = VALUES(`department_id`), `designation_id` = VALUES(`designation_id`), `payment_mode` = VALUES(`payment_mode`), `pf_enrolled` = VALUES(`pf_enrolled`), `esi_enrolled` = VALUES(`esi_enrolled`);\n');

  // 4. USERS (STAFF LOGINS)
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('-- 4. USER LOGINS FOR STAFF (Default Password: username)');
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('INSERT INTO `users` (`id`, `employee_id`, `username`, `email`, `password_hash`, `role_id`, `is_active`) VALUES');
  sqlStatements.push(usersSqls.join(',\n') + '\nON DUPLICATE KEY UPDATE `is_active` = VALUES(`is_active`);\n');

  // 4.1 FINES (AUGUST 2026)
  if (fineSqls.length > 0) {
    sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
    sqlStatements.push('-- 4.1 FINES & DEDUCTIONS (' + fineSqls.length + ' records from August 2026)');
    sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
    sqlStatements.push('INSERT INTO `fines` (`id`, `employee_id`, `fine_type_id`, `fine_date`, `amount`, `reason`, `is_auto_generated`, `assigned_month`, `assigned_year`, `status`, `created_by`) VALUES');
    sqlStatements.push(fineSqls.join(',\n') + '\nON DUPLICATE KEY UPDATE `amount` = VALUES(`amount`), `status` = VALUES(`status`);\n');
  }

  // 4.2 OVERTIME ENTRIES (AUGUST 2026)
  if (overtimeSqls.length > 0) {
    sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
    sqlStatements.push('-- 4.2 OVERTIME & EXTRA DAYS (' + overtimeSqls.length + ' records from August 2026)');
    sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
    sqlStatements.push('INSERT INTO `overtime_entries` (`id`, `employee_id`, `entry_date`, `entry_type`, `hours`, `computed_amount`, `notes`, `created_by`) VALUES');
    sqlStatements.push(overtimeSqls.join(',\n') + '\nON DUPLICATE KEY UPDATE `computed_amount` = VALUES(`computed_amount`), `hours` = VALUES(`hours`);\n');
  }

  // 5. RAW BIOMETRIC PUNCHES (id, employee_code, device_id, punch_time, employee_id, punch_type, is_processed)
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('-- 5. RAW BIOMETRIC PUNCHES (' + allPunchesList.length + ' Punches from August 2026)');
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');

  const punchChunks = [];
  const chunkSize = 500;
  for (let i = 0; i < allPunchesList.length; i += chunkSize) {
    const chunk = allPunchesList.slice(i, i + chunkSize);
    const lines = chunk.map((p, idx) => {
      const punchId = i + idx + 1;
      const empId = parseInt(p.empCode, 10);
      const punchTypeSql = p.punchType ? escapeSql(p.punchType) : 'NULL';
      return `  (${punchId}, ${escapeSql(p.empCode)}, 'ESSL-BIO-01', ${escapeSql(p.punchDateTime)}, ${empId}, ${punchTypeSql}, 1)`;
    });
    punchChunks.push(
      'INSERT INTO `attendance_raw_punches` (`id`, `employee_code`, `device_id`, `punch_time`, `employee_id`, `punch_type`, `is_processed`) VALUES\n' +
      lines.join(',\n') + '\nON DUPLICATE KEY UPDATE `is_processed` = 1;'
    );
  }
  sqlStatements.push(punchChunks.join('\n\n') + '\n');

  // 6. DAILY ATTENDANCE SUMMARIES
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');
  sqlStatements.push('-- 6. DAILY ATTENDANCE SUMMARIES (August 01–31, 2026)');
  sqlStatements.push('-- ─────────────────────────────────────────────────────────────────────────────');

  const summarySqls = [];
  let summaryCounter = 1;

  punchEmployees.forEach(pe => {
    const empId = pe.code;
    const aliasKey = aliasSalaryMatch[pe.codeStr];
    let sal = aliasKey ? salaryMap.get(aliasKey) : null;
    if (!sal) {
      sal = salaryMap.get(pe.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }

    for (let day = 1; day <= 31; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateStr = '2026-08-' + dayStr;
      const dayData = pe.punchesByDay[day];
      const punchTimes = dayData ? dayData.punchTimes : [];
      const salStatus = sal && sal.dailyStatuses ? sal.dailyStatuses[day] : '';

      let firstIn = null;
      let lastOut = null;
      let workedMinutes = 0;
      let status = 'absent';

      if (punchTimes.length > 0) {
        firstIn = dateStr + ' ' + punchTimes[0];
        lastOut = dateStr + ' ' + punchTimes[punchTimes.length - 1];
        if (punchTimes.length > 1) {
          const [h1, m1] = punchTimes[0].split(':').map(Number);
          const [h2, m2] = punchTimes[punchTimes.length - 1].split(':').map(Number);
          workedMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (workedMinutes < 0) workedMinutes = 0;
        } else {
          workedMinutes = 480;
        }
        status = 'present';
      } else if (salStatus === 'WH') {
        status = 'week_off';
      } else if (salStatus === 'X') {
        status = 'present';
        workedMinutes = 480;
      } else if (salStatus === '---') {
        status = 'lop';
        workedMinutes = 240;
      } else if (salStatus === 'A') {
        status = 'absent';
      } else {
        status = (dayData && dayData.status === 'Present') ? 'present' : 'absent';
      }

      summarySqls.push(
        `  (${summaryCounter++}, ${empId}, ${escapeSql(dateStr)}, 1, ${escapeSql(firstIn)}, ${escapeSql(lastOut)}, ${workedMinutes}, 0, 0, 0, ${escapeSql(status)}, 0)`
      );
    }
  });

  const summaryChunks = [];
  for (let i = 0; i < summarySqls.length; i += chunkSize) {
    const chunk = summarySqls.slice(i, i + chunkSize);
    summaryChunks.push(
      'INSERT INTO `attendance_daily_summary` (`id`, `employee_id`, `attendance_date`, `shift_id`, `first_in_time`, `last_out_time`, `worked_minutes`, `break_minutes`, `late_minutes`, `early_leave_minutes`, `status`, `overtime_minutes`) VALUES\n' +
      chunk.join(',\n') + '\nON DUPLICATE KEY UPDATE `status` = VALUES(`status`), `first_in_time` = VALUES(`first_in_time`), `last_out_time` = VALUES(`last_out_time`), `worked_minutes` = VALUES(`worked_minutes`);'
    );
  }
  sqlStatements.push(summaryChunks.join('\n\n') + '\n');

  sqlStatements.push('SET FOREIGN_KEY_CHECKS = 1;\n');

  const outputSql = sqlStatements.join('\n');
  const targetFile = path.resolve(__dirname, '..', '..', 'Sql', 'import_employees_attendance_august_2026.sql');
  fs.writeFileSync(targetFile, outputSql, 'utf8');

  console.log('Successfully generated SQL file:', targetFile);
  console.log('Fines count:', fineSqls.length);
  console.log('Overtime entries count:', overtimeSqls.length);
  console.log('EPF enrolled count:', punchEmployees.filter(pe => {
    const aliasKey = aliasSalaryMatch[pe.codeStr];
    let sal = aliasKey ? salaryMap.get(aliasKey) : null;
    const uan = sal ? sal.uan : null;
    const normName = pe.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return epfEnrolledNames.has(normName) || (aliasKey && epfEnrolledNames.has(aliasKey)) || (uan && uan.length > 5);
  }).length);
}

main().catch(console.error);
