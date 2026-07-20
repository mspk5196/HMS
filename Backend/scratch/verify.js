const http = require('http');

const request = (method, path, headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

(async () => {
  console.log('--- STARTING JWT & EMPLOYEE/MEMBER INTEGRATION VERIFICATION ---');

  try {
    // 1. Fetch departments without token
    console.log('1. Attempting unauthorized fetch...');
    const resDepts = await request('GET', '/api/hr/departments');
    console.log('Status:', resDepts.statusCode);
    
    // 2. Perform Login
    console.log('\n2. Attempting login as admin...');
    const loginRes = await request('POST', '/api/auth/login', {}, {
      username: 'admin',
      password: 'password123'
    });
    if (!loginRes.body.success) {
      console.log('❌ Login failed:', loginRes.body.message);
      return;
    }
    
    const token = loginRes.body.data.token;
    const authHeader = { 'Authorization': `Bearer ${token}` };
    console.log('✅ Login successful! Token retrieved.');

    // 3. Create a test department with a role
    console.log('\n3. Creating a test department with roles...');
    const rand = Math.floor(Math.random() * 10000);
    const deptName = `TEMP_DEPT_${rand}`;
    const createDeptRes = await request('POST', '/api/hr/departments', authHeader, {
      name: deptName,
      description: 'Temporary department for member integration testing',
      head: 'Test Head',
      is_active: 1,
      roles: [
        { roleName: 'Test Specialist', basicSalary: 75000 }
      ]
    });
    
    if (!createDeptRes.body.success) {
      console.log('❌ Failed to create test department:', createDeptRes.body.message);
      return;
    }
    
    const deptId = createDeptRes.body.data.id;
    console.log(`✅ Test department created successfully. ID: ${deptId}`);

    // Fetch the department to obtain the staff role's ID
    const fetchDeptRes = await request('GET', '/api/hr/departments', authHeader);
    const myDept = fetchDeptRes.body.data.find(d => d.id === deptId);
    const roleId = myDept.roles[0].id;
    console.log(`Found Staff Role ID: ${roleId}`);

    // 4. Create an employee (member) in this department
    console.log('\n4. Creating a test employee/member...');
    const empCode = `EMP-TEST-${rand}`;
    const createEmpRes = await request('POST', '/api/hr/employees', authHeader, {
      employee_code: empCode,
      full_name: 'Dr. Jane Miller',
      date_of_joining: '2026-07-20',
      department_id: deptId,
      designation_id: roleId,
      qualification: 'MD Pathology, Fellow clinical diagnostics',
      experience_description: '5 years of research in autoimmune markers and pathology.',
      gender: 'female',
      dob: '1990-05-10'
    });

    if (!createEmpRes.body.success) {
      console.log('❌ Failed to create test employee:', createEmpRes.body.message);
      return;
    }
    
    const empId = createEmpRes.body.data.id;
    console.log(`✅ Test employee created successfully! ID: ${empId}`);

    // 5. Fetch department members to confirm it loads them correctly
    console.log('\n5. Listing employees in department...');
    const listEmpRes = await request('GET', `/api/hr/employees?departmentId=${deptId}`, authHeader);
    if (listEmpRes.body.success) {
      const emps = listEmpRes.body.data;
      console.log(`✅ Fetched department members successfully! Count: ${emps.length}`);
      console.log('Employee Row details:', JSON.stringify(emps[0], null, 2));
    } else {
      console.log('❌ Failed to list employees:', listEmpRes.body.message);
    }

    // 6. Clean up (Normally, employees can be deleted or updated. Since we need to delete the department, let's delete the employee first)
    console.log('\n6. Cleaning up test data from database...');
    const db = require('../src/config/db');
    await db.execute('DELETE FROM employees WHERE id = ?', [empId]);
    await db.execute('DELETE FROM departments WHERE id = ?', [deptId]);
    console.log('✅ Cleanup complete! Test employee and department deleted.');

  } catch (err) {
    console.error('❌ Error during verification:', err.message);
  } finally {
    process.exit(0);
  }
})();
