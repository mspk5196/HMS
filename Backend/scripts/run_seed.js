const db = require('../src/config/db');

const TAMIL_NAMES = [
  'Aarav', 'Aadhavan', 'Aadhira', 'Aakash', 'Aamani', 'Aarthi', 'Aaryan', 'Abinaya', 'Abinesh', 'Abirami',
  'Adhavan', 'Adhira', 'Adithya', 'Aishwarya', 'Akash', 'Akila', 'Akshay', 'Amirtha', 'Amritha', 'Anand',
  'Ananya', 'Anbarasu', 'Anbu', 'Anitha', 'Anjali', 'Anjana', 'Anush', 'Anusha', 'Anushka', 'Aravind',
  'Arjun', 'Arthi', 'Arul', 'Arulselvan', 'Aruna', 'Arun', 'Arunmozhi', 'Ashok', 'Ashwini', 'Aswin',
  'Avinash', 'Bala', 'Balaji', 'Banu', 'Bharani', 'Bharath', 'Bhargavi', 'Bhavana', 'Bhoomika', 'Brinda',
  'Charan', 'Chandra', 'Chandrika', 'Darshan', 'Deepa', 'Deepak', 'Deepika', 'Deva', 'Devaki', 'Devan',
  'Devika', 'Dhanalakshmi', 'Dhanush', 'Dharani', 'Dharshini', 'Dheeraj', 'Dinesh', 'Divya', 'Eashwar', 'Ezhil',
  'Gayathri', 'Giri', 'Gokul', 'Gokila', 'Gomathi', 'Gowri', 'Gowtham', 'Hari', 'Harini', 'Harish',
  'Haritha', 'Hemalatha', 'Hemant', 'Hema', 'Ilakkiya', 'Ilamaran', 'Ilango', 'Indhu', 'Indrajith', 'Iniya',
  'Iniyan', 'Inban', 'Ishwarya', 'Jagadeesh', 'Janani', 'Janarthanan', 'Janavi', 'Jasmine', 'Jeeva', 'Jeevika',
  'Jenisha', 'Jeyan', 'Jothi', 'Joshna', 'Kabilan', 'Kalyani', 'Kamala', 'Kannan', 'Karthick', 'Karthika',
  'Kavi', 'Kavin', 'Kavitha', 'Keerthana', 'Keerthi', 'Kishore', 'Komathi', 'Krishnan', 'Krithika', 'Kumaran',
  'Lakshmi', 'Lavanya', 'Logesh', 'Lokesh', 'Madhan', 'Madhavi', 'Madhumitha', 'Mahalakshmi', 'Mahesh', 'Mahima',
  'Malathi', 'Manikandan', 'Manimegalai', 'Manoj', 'Meena', 'Meenakshi', 'Megha', 'Mithra', 'Mithran', 'Mohan',
  'Monika', 'Mugilan', 'Murali', 'Muthu', 'Nandhini', 'Naren', 'Narmadha', 'Naveen', 'Navin', 'Nila',
  'Nithin', 'Nithya', 'Nivetha', 'Nivedha', 'Pavithra', 'Pandian', 'Parthiban', 'Pavan', 'Perumal', 'Pooja',
  'Prabhu', 'Pradeep', 'Pragathi', 'Prakash', 'Pranav', 'Pranitha', 'Prasanna', 'Prashanth', 'Praveen', 'Priya',
  'Priyadharshini', 'Priyanka', 'Rahul', 'Rajalakshmi', 'Rajan', 'Rajesh', 'Rajkumar', 'Rakshana', 'Ram', 'Ramya',
  'Ranjani', 'Ranjith', 'Revathi', 'Rithika', 'Rohan', 'Rohini', 'Ruban', 'Sadhana', 'Sakthi', 'Sakthivel',
  'Sangeetha', 'Sanjay', 'Sanjana', 'Santhosh', 'Saranya', 'Saravanan', 'Sathish', 'Savitha', 'Selva', 'Selvi',
  'Senthil', 'Shalini', 'Shanmathi', 'Sharanya', 'Sharmila', 'Shobana', 'Shruthi', 'Siva', 'Sivakumar', 'Sneha',
  'Sowmiya', 'Sreeja', 'Sridhar', 'Sriram', 'Subash', 'Subha', 'Sudha', 'Suganya', 'Suresh', 'Surya',
  'Swathi', 'Tamilarasan', 'Tamilselvan', 'Tamilini', 'Thamarai', 'Tharani', 'Thenmozhi', 'Thilaga', 'Thilak', 'Thirumal',
  'Udhaya', 'Uma', 'Umesh', 'Valli', 'Vani', 'Varalakshmi', 'Varsha', 'Vasanth', 'Vasuki', 'Vedha',
  'Veena', 'Velmurugan', 'Venkatesh', 'Vidhya', 'Vijay', 'Vijayalakshmi', 'Vijaykumar', 'Vikram', 'Vimal', 'Vinitha',
  'Vinod', 'Vinoth', 'Vishal', 'Vishnu', 'Vivek', 'Yamini', 'Yazhini', 'Yoganathan', 'Yogesh', 'Yuvan',
  'Yuvraj', 'Ahalya', 'Akshara', 'Amudha', 'Angayarkanni', 'Arasi', 'Chitra', 'Durga', 'Elakkiya', 'Ezhilarasi',
  'Gajalakshmi', 'Harikrishnan', 'Ilavarasi', 'Inbavalli', 'Jayalakshmi', 'Kalaiselvi', 'Kanmani', 'Kayalvizhi', 'Malar', 'Malarvizhi',
  'Mathivanan', 'Mohana', 'Nallathambi', 'Nandhakumar', 'Poongodi', 'Pugazh', 'Selvakumar', 'Selvarani', 'Thamizharasi', 'Thangavel',
  'Ulaganathan', 'Vairamuthu', 'Vetrivel', 'Vetri', 'Vignesh', 'Vigneshwari', 'Visalakshi', 'Yashika', 'Yuvanika', 'Ziya'
];

const REQUIRED_DEPTS = [
  {
    name: 'NURSING',
    description: 'Patient care & inpatient ward operations',
    head: 'Head Nurse',
    roles: [
      { name: 'Head Nurse', salary: 35000 },
      { name: 'Staff Nurse', salary: 25000 },
      { name: 'Junior Nurse', salary: 18000 }
    ]
  },
  {
    name: 'LABORATORY',
    description: 'Diagnostics, pathology & hematology testing',
    head: 'Chief Pathologist',
    roles: [
      { name: 'Chief Technician', salary: 40000 },
      { name: 'Lab Analyst', salary: 28000 },
      { name: 'Phlebotomist', salary: 20000 }
    ]
  },
  {
    name: 'PHARMACY',
    description: 'Inpatient & outpatient medicine distribution',
    head: 'Chief Pharmacist',
    roles: [
      { name: 'Chief Pharmacist', salary: 45000 },
      { name: 'Dispensing Pharmacist', salary: 30000 }
    ]
  },
  {
    name: 'GENERAL MEDICINE',
    description: 'Outpatient consultation & internal medicine',
    head: 'Senior Consultant MD',
    roles: [
      { name: 'Senior Consultant', salary: 90000 },
      { name: 'Resident Doctor', salary: 60000 },
      { name: 'Intern Doctor', salary: 15000 }
    ]
  },
  {
    name: 'ADMINISTRATION',
    description: 'Hospital administration, HR, front desk & billing',
    head: 'Hospital Administrator',
    roles: [
      { name: 'HR Manager', salary: 38000 },
      { name: 'Receptionist', salary: 20000 },
      { name: 'Billing Executive', salary: 22000 }
    ]
  }
];

const getQualification = (deptName, roleName) => {
  const dept = (deptName || '').toUpperCase();
  const role = (roleName || '').toLowerCase();

  if (dept.includes('NURSING')) {
    if (role.includes('head')) return 'M.Sc Nursing (Critical Care)';
    if (role.includes('staff')) return 'B.Sc Nursing (RNC Registered)';
    if (role.includes('junior')) return 'Diploma in Nursing (GNM)';
    return 'B.Sc Nursing';
  }
  if (dept.includes('LABORATORY') || dept.includes('LAB')) {
    if (role.includes('chief') || role.includes('head')) return 'Ph.D Clinical Pathology & MLT';
    if (role.includes('analyst') || role.includes('tech')) return 'B.Sc Medical Laboratory Technology (MLT)';
    if (role.includes('phlebotomist')) return 'Diploma in Medical Lab Technology (DMLT)';
    return 'B.Sc MLT';
  }
  if (dept.includes('PHARMACY')) {
    if (role.includes('chief') || role.includes('head')) return 'M.Pharm (Clinical Pharmacy)';
    if (role.includes('dispensing') || role.includes('pharmacist')) return 'B.Pharm (Registered Pharmacist)';
    return 'D.Pharm';
  }
  if (dept.includes('MEDICINE') || dept.includes('GENERAL') || dept.includes('CLINICAL')) {
    if (role.includes('senior') || role.includes('consultant')) return 'MBBS, MD (General Medicine)';
    if (role.includes('resident') || role.includes('doctor')) return 'MBBS, DNB (Internal Medicine)';
    if (role.includes('intern')) return 'MBBS (CRMI Intern)';
    return 'MBBS, MD';
  }
  if (dept.includes('ADMIN') || dept.includes('MANAGEMENT')) {
    if (role.includes('hr') || role.includes('manager')) return 'MBA (HR Management), PGDHRM';
    if (role.includes('reception') || role.includes('front')) return 'B.Com, Diploma in Hospital Admin';
    if (role.includes('billing')) return 'B.Com (Finance & Tally ERP)';
    return 'B.Com, MBA';
  }
  return 'Bachelor Degree / Diploma';
};

const getExperience = (roleName) => {
  const role = (roleName || '').toLowerCase();
  if (role.includes('head') || role.includes('chief') || role.includes('senior') || role.includes('manager')) {
    return '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.';
  }
  if (role.includes('staff') || role.includes('analyst') || role.includes('dispensing') || role.includes('resident')) {
    return '4 years experience in hospital workflow, patient routines, and diagnostics.';
  }
  return '2 years experience in patient care, hospital admin, and record management.';
};

const getRandomDate = () => {
  const year = Math.floor(Math.random() * 5) + 2021;
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

(async () => {
  try {
    console.log('🚀 Running database seed for Departments, Roles, and 8 UNIQUE Tamil Members per Role...');

    // 1. Ensure required departments exist
    for (const reqDept of REQUIRED_DEPTS) {
      const [existingDept] = await db.execute(`SELECT id FROM departments WHERE name = ?`, [reqDept.name]);
      let deptId;
      if (existingDept.length > 0) {
        deptId = existingDept[0].id;
      } else {
        const [deptIns] = await db.execute(
          `INSERT INTO departments (name, description, head, is_active) VALUES (?, ?, ?, 1)`,
          [reqDept.name, reqDept.description, reqDept.head]
        );
        deptId = deptIns.insertId;
        console.log(`✨ Inserted Department: ${reqDept.name}`);
      }

      // Ensure staff roles exist
      for (const roleDef of reqDept.roles) {
        const [existingRole] = await db.execute(
          `SELECT id FROM staff_roles WHERE department_id = ? AND name = ?`,
          [deptId, roleDef.name]
        );
        if (existingRole.length === 0) {
          await db.execute(
            `INSERT INTO staff_roles (department_id, name, basic_salary) VALUES (?, ?, ?)`,
            [deptId, roleDef.name, roleDef.salary]
          );
          console.log(`  ✨ Inserted Role: ${roleDef.name}`);
        }
      }
    }

    // 2. Fetch all departments and staff roles
    const [departments] = await db.execute(`SELECT id, name FROM departments ORDER BY id`);
    const [staffRoles] = await db.execute(`SELECT id, department_id, name, basic_salary FROM staff_roles ORDER BY department_id, id`);

    // Clear employees table to perform clean, 100% non-repeating insert
    await db.execute(`DELETE FROM employees`);
    console.log('🧹 Cleaned employees table.');

    const usedNames = new Set();
    let nameIdx = 0;
    let totalInserted = 0;

    for (const dept of departments) {
      const rolesForDept = staffRoles.filter(r => r.department_id === dept.id);
      
      let currentRoles = rolesForDept;
      if (currentRoles.length === 0) {
        const defaultRoles = [
          { name: `${dept.name} Lead`, salary: 40000 },
          { name: `${dept.name} Specialist`, salary: 28000 },
          { name: `${dept.name} Assistant`, salary: 18000 }
        ];
        for (const dr of defaultRoles) {
          const [ins] = await db.execute(
            `INSERT INTO staff_roles (department_id, name, basic_salary) VALUES (?, ?, ?)`,
            [dept.id, dr.name, dr.salary]
          );
          currentRoles.push({ id: ins.insertId, department_id: dept.id, name: dr.name, basic_salary: dr.salary });
        }
      }

      for (const role of currentRoles) {
        const targetCount = 8;
        for (let i = 0; i < targetCount; i++) {
          let nameToUse = null;

          while (!nameToUse && nameIdx < TAMIL_NAMES.length * 2) {
            const cand = TAMIL_NAMES[nameIdx % TAMIL_NAMES.length];
            nameIdx++;
            if (!usedNames.has(cand)) {
              nameToUse = cand;
              usedNames.add(cand);
              break;
            }
          }

          if (!nameToUse) {
            nameToUse = `Staff_${dept.id}_${role.id}_${i + 1}`;
          }

          const empCode = `EMP-${dept.id}${role.id}-${Date.now().toString().slice(-4)}-${i + 1}`;
          const qualification = getQualification(dept.name, role.name);
          const experience = getExperience(role.name);
          const joiningDate = getRandomDate();

          await db.execute(
            `INSERT INTO employees (
              employee_code, full_name, date_of_joining, department_id, designation_id,
              status, qualification, experience_description, basic_salary, salary_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              empCode,
              nameToUse,
              joiningDate,
              dept.id,
              role.id,
              'active',
              qualification,
              experience,
              Number(role.basic_salary || 25000),
              'monthly'
            ]
          );

          totalInserted++;
        }
        console.log(`✅ ${dept.name} -> ${role.name}: 8 Members Seeded.`);
      }
    }

    console.log(`\n🎉 DATABASE SEED COMPLETE! Total ${totalInserted} members saved to MySQL 'employees' table.`);

    // Log Summary
    const [[{ totalEmps }]] = await db.execute(`SELECT COUNT(*) AS totalEmps FROM employees`);
    console.log(`📊 DB Persistence Check: 'employees' table now has ${totalEmps} total active records.`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error executing seed:', err);
    process.exit(1);
  }
})();
