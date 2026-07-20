const db = require('../src/config/db');

(async () => {
  try {
    console.log('Correcting employees.designation_id foreign key constraint...');
    
    // 1. Drop the incorrect foreign key constraint
    try {
      await db.query('ALTER TABLE employees DROP FOREIGN KEY fk_employees_designation');
      console.log('Dropped old fk_employees_designation constraint.');
    } catch (e) {
      console.log('Constraint fk_employees_designation may not exist or already dropped:', e.message);
    }
    
    // 2. Add the correct constraint referencing staff_roles(id)
    await db.query(`
      ALTER TABLE employees 
      ADD CONSTRAINT fk_employees_designation 
      FOREIGN KEY (designation_id) REFERENCES staff_roles(id) 
      ON DELETE RESTRICT ON UPDATE RESTRICT
    `);
    console.log('✅ Successfully added correct foreign key constraint to staff_roles!');
    
  } catch (err) {
    console.error('❌ Failed to update foreign key:', err.message);
  } finally {
    process.exit(0);
  }
})();
