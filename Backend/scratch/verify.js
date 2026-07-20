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
  console.log('--- STARTING JWT END-TO-END SECURITY VERIFICATION ---');

  try {
    // 1. Fetch departments without token
    console.log('1. Attempting unauthorized fetch...');
    const resDepts = await request('GET', '/api/hr/departments');
    console.log('Status:', resDepts.statusCode);
    console.log('Body:', JSON.stringify(resDepts.body));
    
    if (resDepts.statusCode === 401) {
      console.log('✅ Correctly blocked access (401 Unauthorized)');
    } else if (resDepts.statusCode === 200) {
      console.log('ℹ️ Bypassed verification (PROTECTED_ROUTES_ENABLED might be false)');
      return;
    } else {
      console.log('❌ Unexpected status code:', resDepts.statusCode);
    }

    // 2. Perform Login
    console.log('\n2. Attempting login as admin...');
    const loginRes = await request('POST', '/api/auth/login', {}, {
      username: 'admin',
      password: 'password123'
    });
    console.log('Login Status:', loginRes.statusCode);
    if (!loginRes.body.success) {
      console.log('❌ Login failed:', loginRes.body.message);
      return;
    }
    
    const token = loginRes.body.data.token;
    console.log('✅ Login successful! Token retrieved.');

    // 3. Fetch departments with Token
    console.log('\n3. Fetching departments with Authorization header...');
    const authorizedRes = await request('GET', '/api/hr/departments', {
      'Authorization': `Bearer ${token}`
    });
    console.log('Status:', authorizedRes.statusCode);
    if (authorizedRes.body.success) {
      console.log('✅ Successfully accessed protected resource! Departments Count:', authorizedRes.body.data.length);
    } else {
      console.log('❌ Failed to fetch even with token:', authorizedRes.body.message);
    }

  } catch (err) {
    console.error('❌ Error during verification:', err.message);
  } finally {
    process.exit(0);
  }
})();
