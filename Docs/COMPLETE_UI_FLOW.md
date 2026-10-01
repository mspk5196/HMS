# Neha Hospital HMS - Complete UI Flow Documentation

**Last Updated:** 2026-07-15  
**Project:** Neha Hospital Management System (React + Express + MySQL)  
**Total Pages:** 12 | **Routes:** 5 main sections | **Styling:** Tailwind + Semantic CSS

---

## Table of Contents
1. [Dashboard](#1-dashboard) - Landing/Overview page
2. [HR Module](#hr-module)
   - [Employees](#2-employees) - Employee master data
   - [Attendance](#3-attendance) - Attendance tracking & corrections
   - [Roster](#4-roster) - Shift scheduling calendar
   - [Payroll](#5-payroll) - Salary calculations & payslips
3. [Hospital Module](#hospital-module)
   - [Admissions](#6-admissions) - Patient bed assignment
   - [Discharge](#7-discharge) - Patient discharge & billing
4. [Patients Module](#patients-module)
   - [Appointments](#8-appointments) - Token booking & queue
   - [Consultation](#9-consultation) - Doctor consultation & prescriptions
   - [Records](#10-records) - Patient master data
5. [Pharmacy Module](#pharmacy-module)
   - [Stock](#11-stock) - Inventory management
   - [Billing](#12-billing) - POS & bill generation

---

## 1. Dashboard

### **Purpose**
Landing page showing hospital KPIs and today's appointment queue. Displays role-based statistics and quick access to critical information.

### **Key Sections**

#### Welcome Banner
- Greeting message with time-based salutation ("Good Morning/Afternoon/Evening")
- Current date in full format (e.g., "Tuesday, 15 July 2026")
- Logged-in user's role display

#### Stat Cards (4 columns on desktop)
- **Total Patients** (🧑‍⚕️) - Total patient count (blue theme)
- **Today's Tokens** (📅) - Appointment count for today (green theme)
- **Active Admissions** (🛏️) - Currently admitted patients (amber theme)
- **System Status** (⚡) - "Online" / system health (slate theme)

#### Today's Appointment Queue Table
- **Columns:** Token # | Patient Name/Mobile | Doctor | Type | Status | Appointment Date
- **Status Badges:** Waiting (yellow), In Consultation (blue), Completed (green), Cancelled (red)
- **Token Display:** Large, bold, blue number
- **Pagination:** Shows up to 10 appointments
- **Empty State:** "No appointments scheduled for today"
- **Loading State:** Animated spinner while fetching

### **API Calls**
```
GET /patient/appointments?date={today}&limit=10
GET /patient/patients?limit=1
GET /patient/admissions?status=admitted&limit=1
```

### **Permissions Checked**
- `patient.view` - Show patient count
- `appointment.view` - Show today's tokens & queue
- `admission.view` - Show active admissions

### **User Interactions**
- No direct actions; read-only dashboard
- Auto-refreshes on page load

### **Next Steps**
- Navigate to Appointments, Patients, or Admissions pages from sidebar

---

## HR Module

## 2. Employees

### **Purpose**
Employee master data management. Create, edit, view, and search all hospital staff records.

### **Key Sections**

#### Page Header
- **Title:** "Employees"
- **Subtitle:** "Manage staff roster — add new, edit details, define salary structure"
- **Action Button:** "+ Add Employee"

#### Search & Filter Bar
- **Search Input:** Name, employee code, mobile number (real-time search with debounce)
- **Search Icon:** Lucide `Search`

#### Employee Table
- **Columns:** 
  - Employee Name (with Employee Code in gray below)
  - Designation
  - Mobile
  - Email
  - Status (badge: Active/Inactive)
  - Joining Date
  - Actions (View/Edit/Delete)
- **Row Highlighting:** Hover effect on rows
- **Badge Colors:** Active (green), Inactive (gray)
- **Empty State:** "No employees found"
- **Pagination:** Limit 50 per page

#### Add Employee Modal
- **Trigger:** Click "+ Add Employee" button
- **Modal Title:** "Add New Employee"
- **Form Layout:** 2-column grid
- **Fields:**
  - Full Name * (text)
  - Employee Code * (text)
  - Mobile Number * (tel)
  - Email (email)
  - Designation (select: Doctor, Nurse, Staff, Pharmacist, etc.)
  - Department (select: HR, Medicine, Surgery, ICU, Pharmacy, etc.)
  - Status (select: Active/Inactive)
  - Blood Group (text: O+, A-, etc.)
  - Address (textarea)
  - Notes (textarea)
- **Buttons:** Cancel | Save Employee
- **Validation:** Name, Mobile, Employee Code are required
- **Error Message:** Displayed in red below form

### **API Calls**
```
GET /hr/employees?search={query}&limit=50
POST /hr/employees
PATCH /hr/employees/{id}
DELETE /hr/employees/{id}
```

### **Permissions Checked**
- `hr_employee.view` - Display page
- `hr_employee.modify` - Show add/edit button
- `hr_employee.delete` - Show delete button

### **User Interactions**
- Click "+ Add Employee" → Modal opens
- Type in search box → Auto-filters table (debounced 300ms)
- Click employee row → Edit modal opens
- Click delete icon → Confirmation modal
- Submit form → POST/PATCH to backend → Refresh table

### **Next Steps**
- After adding employee → Redirect to Payroll to set salary structure
- View employee → Can also manage Leave balance, Shift assignments

---

## 3. Attendance

### **Purpose**
Biometric attendance tracking with three tabs:
1. Daily Summary - punch logs & LOP calculation
2. Correction Requests - employee-submitted corrections
3. Late Buffer - monthly late buffer allocation & usage

### **Key Sections**

#### Page Header with Tabs
- **Title:** "Attendance"
- **Subtitle:** "Daily punch logs, corrections, and late buffer"
- **3 Tabs:**
  - Daily Summary (default active)
  - Correction Requests
  - Late Buffer

---

### **Tab 1: Daily Summary**

#### Controls
- **Date Picker Input:** Select date (calendar widget)
- **"Sync Punch" Button:** Fetch biometric data from device
- **"Process Attendance" Button:** Calculate LOP & buffer

#### Daily Attendance Table
- **Columns:** Employee | Code | In Time | Out Time | Status | Duration (hrs) | LOP
- **Status Badge:** "Present" (green), "Absent" (red), "Half Day" (yellow)
- **In/Out Time Format:** HH:MM (24-hour)
- **LOP Badge:** Shows as "-1.0 day" in red if applicable
- **Pagination:** 50 rows per page

#### Inline Styles for Controls
- "Sync Punch" button: `background: var(--primary)`
- "Process Attendance" button: `background: var(--success)`
- LOP text: `color: var(--danger)`

---

### **Tab 2: Correction Requests**

#### Correction Requests Table
- **Columns:** Employee | Date | Submitted In Time | Submitted Out Time | Reason | Status | Actions
- **Status Badge:** "Pending" (yellow), "Approved" (green), "Rejected" (red)
- **Action Buttons:** ✅ Approve | ❌ Reject
- **Reason Textarea:** Shows employee's explanation
- **Empty State:** "No correction requests pending"

#### Correction Workflow
- Employee submits punch correction with reason
- Appears in Pending status
- HR/Manager clicks Approve/Reject
- Updates backend & reflects in Daily Summary

---

### **Tab 3: Late Buffer**

#### Controls
- **Month Picker Input:** Select month/year

#### Late Buffer Allocation Table
- **Columns:** Employee | Category | Allocated (hrs) | Used (hrs) | Remaining (hrs)
- **Color Coding:** 
  - Used hrs: `color: var(--danger)`
  - Remaining hrs: `color: var(--success)`
- **Monthly Limit:** 8 hours (configurable in payroll_config)
- **Calculation:** Any minutes late on a day → fractional LOP

#### Buffer Logic
- Example: 30 min late = 0.0625 day (30 mins / 480 mins per day)
- Automatically deducted from buffer first
- Excess → LOP deduction in Payroll
- Resets on month start

### **API Calls**
```
GET /attendance/daily?date={date}&limit=50
POST /attendance/sync (biometric sync)
POST /attendance/process-daily
GET /attendance/corrections?status=pending&limit=100
PATCH /attendance/corrections/{id}/approve
PATCH /attendance/corrections/{id}/reject
GET /attendance/buffer?month={month}&year={year}
```

### **Permissions Checked**
- `attendance.view` - Display page
- `attendance.modify` - Sync & Process buttons
- `attendance.approve_correction` - Approve/Reject buttons

### **User Interactions**
1. Select date → Click "Sync Punch" → Loads punch logs from device
2. Click "Process Attendance" → Calculates LOP & buffer
3. View correction requests → Click Approve/Reject
4. Select month → View buffer usage & allocation

---

## 4. Roster

### **Purpose**
Visual shift roster calendar. Assign shifts to employees for each day of the month. Shows Shift/Week Off/Night Duty assignments.

### **Key Sections**

#### Page Header
- **Title:** "Roster"
- **Month Navigation:** ◀ [Current Month/Year] ▶ (buttons)

#### Roster Calendar Grid
- **Layout:** Table with sticky employee names on left, calendar days across top
- **Rows:** Employee names (left column)
- **Columns:** Dates (1-31 for the month)
- **Cell Interaction:** Click cell → Cycle through: Shift → Week Off → Night Duty → (repeat)

#### Cell Color Coding
- **Shift:** Blue (`background: var(--primary)`)
- **Week Off:** Gray (`background: var(--mute)`)
- **Night Duty:** Dark Blue/Purple (`background: var(--accent)`)
- **Empty/Unassigned:** White

#### Shift Legend (Bottom)
- **Color Legend:**
  - 🟦 = Shift (Morning/Standard)
  - 🟩 = Night Duty (Extra Pay)
  - ⬜ = Week Off
  - Yellow = Holiday

### **API Calls**
```
GET /hr/roster?month={month}&year={year}
POST /hr/roster/assign (bulk: [{employee_id, date, shift_id}, ...])
PATCH /hr/roster/{id} (single cell update)
```

### **Permissions Checked**
- `shift_roster.view` - Display page
- `shift_roster.modify` - Click to assign shifts
- `shift_roster.publish_roster` - Publish button (lock for month)

### **User Interactions**
1. Navigate months using ◀ ▶ buttons
2. Click any roster cell → Toggle shift assignment
3. Drag across multiple cells → Bulk assign (if enabled)
4. Click "Publish Roster" → Lock month & notify employees

### **Next Steps**
- Published roster feeds into Attendance auto-calculation
- Night Duty entries → Night shift extra pay in Payroll

---

## 5. Payroll

### **Purpose**
Monthly salary calculation engine. Combines attendance, leaves, fines, overtime, PF/ESI deductions to generate payslips.

### **Key Sections**

#### Page Header
- **Title:** "Payroll"
- **Subtitle:** "Combines attendance, leave, fines, overtime and PF/ESI into final payslip."
- **Month Picker:** `YYYY-MM` format
- **"Run Calculation" Button:** Triggers payroll generation for selected month

#### Payroll Summary Card
- Shows current month & year
- Status: "Calculated" / "Not Run" / "Locked"

#### Payroll Items Table
- **Columns:**
  - Employee Name
  - Salary Basis (Monthly Fixed / Per Day / Per Shift)
  - Days/Shifts (numeric: 20.5 for days, 90 for shifts)
  - Gross (₹) - With Talian font
  - LOP/Fines (₹) - Shown in red, negative
  - PF/ESI (₹) - Statutory deductions, gray
  - **Net Pay (₹)** - Bold, final amount

#### Salary Breakdown Per Row
```
Gross Pay = Base Salary + Night Shift Component + Overtime
Less:
  - LOP Amount (days_lop × day_rate)
  - Buffer Late Deduction (late minutes / 480 × day_rate)
  - PF Deduction (12% of base, capped at ₹15,000)
  - ESI Deduction (if gross ≤ ₹21,000)
  - Fines Amount (from Fine module)
= NET PAY
```

#### Empty State
- Message: "No payroll calculations run for this month"
- CTA Button: "Run Calculation Now"

### **Salary Computation Algorithm**
1. **Base Salary Component:**
   - If `monthly`: (gross_monthly / 26 days) × effective_days
   - If `per_day`: rate_per_day × effective_days
   - If `per_shift`: rate_per_shift × shifts_worked
   - Where effective_days = days_present + (days_half × 0.5)

2. **Night Shift Component:**
   - night_shift_extra_amount × night_shifts_worked

3. **Overtime Component:**
   - Already calculated from overtime_entries table

4. **Deductions (in order):**
   - LOP: days_lop × (gross_monthly / 26)
   - Buffer Late: buffer_late_excess_minutes / 480 × day_rate
   - PF Employee: 12% of (base_salary capped at ₹15,000)
   - PF Employer: 12% of (base_salary capped at ₹15,000)
   - ESI: Applied if gross_pay ≤ ₹21,000
     - Employee: ESI_percent × gross_pay
     - Employer: 3.25% × gross_pay
   - Fines: Sum of active fines for period

5. **Net Pay:** Gross - All Deductions

### **API Calls**
```
GET /salary/run?month={month}&year={year}&limit=100
POST /salary/run/generate (body: {month, year})
GET /salary/payslip/{payroll_run_id}/{employee_id}
POST /salary/run/lock (finalize & prevent edits)
```

### **Database Tables Involved**
- `payroll_runs` - Monthly batch record
- `payroll_items` - Per-employee calculations
- `salary_structures` - Employee salary config
- `attendance_summary` - Days present/absent/LOP
- `shift_rate_history` - Night shift rates
- `overtime_entries` - Extra hours/days
- `fine_assignments` - Active fines
- `payroll_config` - Config values (PF ceiling, ESI threshold, etc.)

### **Permissions Checked**
- `payroll.view` - Display page & data
- `payroll.modify` - Run Calculation button
- `payroll.lock_payroll` - Lock/Finalize for month
- `payroll.generate_payslip` - Export payslip

### **User Interactions**
1. Select month from picker
2. Click "Run Calculation" → Backend processes all employees
3. Table auto-populates with results
4. Review breakdown per employee
5. Click employee row → View detailed payslip
6. Click "Lock Payroll" → Finalize & prevent further edits
7. Generate/export payslips

### **Next Steps**
- Locked payroll → Cannot modify attendance/leave/fines
- Export payslip → PDF or email to employee
- Integration with bank transfer for payment

---

## Hospital Module

## 6. Admissions

### **Purpose**
Patient admission management. Create admission records, assign beds (Ward → Room → Bed hierarchy), track admission timeline.

### **Key Sections**

#### Page Header
- **Title:** "Admissions"
- **Subtitle:** "Manage active admissions and bed assignments"
- **"+ Admit Patient" Button:** Opens admission modal

#### Active Admissions Table
- **Columns:**
  - Patient Name / ID (linked to patient records)
  - Admission Date (date-time)
  - Doctor Name
  - Ward / Room / Bed
  - Admission Status (Admitted / Discharged) - badge
  - Notes
  - Actions (View/Edit/Discharge)
- **Badge Colors:** Admitted (blue), Discharged (gray)
- **Empty State:** "No active admissions"
- **Pagination:** 20 per page

#### Admit Patient Modal
- **Trigger:** Click "+ Admit Patient"
- **Modal Title:** "New Admission"
- **Form Layout:** 2-3 column grid
- **Fields:**
  1. **Patient ID*** (number input)
  2. **Admitting Doctor*** (select dropdown - loads from employees with doctor role)
  3. **Admission Date & Time** (datetime-local input)
  4. **Ward** (select) - Loads from `/bed/wards`
  5. **Room** (select) - Depends on ward selection, loads from `/bed/wards/{wardId}/rooms`
  6. **Bed** (select) - Depends on room selection, loads available beds only
  7. **Notes** (textarea)

#### Cascading Dropdowns
```
Ward Selection
  ↓ (onChange event)
Load Rooms for that Ward
  ↓ (on Room selection)
Load Available Beds for that Room (status=available)
```

### **API Calls**
```
GET /hr/employees?limit=100 (fetch doctors)
GET /bed/wards (fetch all wards)
GET /bed/wards/{wardId}/rooms (fetch rooms for ward)
GET /bed/rooms/{roomId}/beds?status=available (fetch available beds)
POST /patient/admissions (create admission)
GET /patient/admissions?status=admitted&limit=50
PATCH /patient/admissions/{id} (update admission)
```

### **Permissions Checked**
- `admission.view` - Display page & table
- `admission.modify` - "+ Admit Patient" button
- `admission.assign_bed` - Dropdown for bed selection

### **User Interactions**
1. Click "+ Admit Patient" → Modal opens
2. Enter Patient ID (or search)
3. Select Doctor from dropdown
4. Select Ward → Room options appear
5. Select Room → Bed options appear (only available beds)
6. Select Bed & enter notes
7. Click "Admit Patient" → POST to backend
8. Table refreshes with new admission

### **Next Steps**
- Admitted patient appears in admission table
- Can view patient records from admission row
- Link to Discharge page to process discharge later
- Consultation & Prescription per admission

---

## 7. Discharge

### **Purpose**
Process patient discharge, generate discharge summary, settle final bill (room charges, pharmacy charges, other fees).

### **Key Sections**

#### Page Header
- **Title:** "Discharge Summary & Billing"
- **Subtitle:** "Generate discharge summary and settle final bill"
- **Admission ID Lookup:** Input field + "Load" button

#### Discharge Form (appears after loading admission)
- **Two-Column Layout on Desktop**

**Left Column:**
- **Patient Info Card:**
  - Patient Name (readonly)
  - Admission ID (readonly)
  - Doctor Name (readonly)
  - Admission Date (readonly)

- **Medical Summary:**
  - Diagnosis Summary (textarea)
  - Treatment Summary (textarea)
  - Doctor Advice (textarea)
  - Discharge Condition (select: Recovered / Improved / Transferred / Expired)
  - Follow-up Date (date input, optional)

**Right Column:**
- **Billing Card:**
  - Room Charges (₹) - number input
  - Pharmacy Charges (₹) - number input
  - Other Charges (₹) - number input
  - **Total Bill** (calculated: auto-sum)
  - Amount Paid (₹) - number input
  - Payment Mode (select: Cash / UPI / Card / Insurance / Credit)
  - **Balance Due** (calculated: Total - Paid)

- **Discharge Notes** (textarea)

#### Discharge Buttons
- **"Cancel Discharge"** - Discard & go back
- **"Process Discharge"** - Submit form (POST)

#### Success Screen
- Checkmark icon ✅
- Message: "Patient Discharged Successfully"
- Message: "Admission #{id} has been closed and beds freed."
- CTA: "Process Another Discharge"

### **API Calls**
```
GET /patient/admissions?status=admitted&limit=200
POST /patient/discharges (body: {...form, final_bill_amount, balance_due})
```

### **Permissions Checked**
- `discharge.view` - Display page
- `discharge.modify` - Load & Process buttons
- `discharge.discharge_patient` - Special action button

### **User Interactions**
1. Enter Admission ID → Click "Load"
2. Admission details auto-populate
3. Fill medical summary & billing info
4. Calculate totals auto-update
5. Click "Process Discharge"
6. Success screen appears
7. Click "Process Another Discharge" to repeat

### **Next Steps**
- Discharged patient → Bed becomes available
- Discharge record → Patient Records module
- Balance due → Follow-up billing (if applicable)

---

## Patients Module

## 8. Appointments

### **Purpose**
Appointment booking & token management. Schedule patient-doctor appointments, track queue status (Waiting → In Consultation → Completed).

### **Key Sections**

#### Page Header
- **Title:** "Appointments"
- **Subtitle:** "Book tokens, manage queue, track consultation status"
- **Date Picker:** Select appointment date (default: today)
- **"+ Book Token" Button:** Opens booking modal
- **"↻ Refresh" Button:** Reload appointments list

#### Appointment Queue Table
- **Columns:**
  - Token # (large, bold, blue number)
  - Patient Name / Mobile (linked)
  - Doctor Name
  - Visit Type (New / Follow-up / Emergency)
  - Status (badge)
  - Time (appointment time)
  - Actions (Move to Consultation / Complete / Cancel)
- **Status Badges:**
  - Waiting (yellow)
  - In Consultation (blue)
  - Completed (green)
  - Cancelled (red)
- **Token Number Format:** Auto-incremented per day (1, 2, 3, ...)
- **Row Click:** View appointment details

#### Book Token Modal
- **Trigger:** Click "+ Book Token"
- **Modal Title:** "Book New Token"
- **Form Layout:** 2-column grid
- **Fields:**
  1. **Patient ID*** (number input, e.g., "12")
  2. **Visit Type** (select: New Visit / Follow-up / Emergency)
  3. **Doctor*** (select dropdown - loads doctors only)
  4. **Appointment Date*** (date input)
  5. Optional: Receptionist notes (textarea)
- **Buttons:** Cancel | Book Token
- **Validation:** Patient ID, Doctor, Date required
- **Error Message:** Red text below form

#### Token Display
- Large, prominent number in blue
- Example: Token #7 for Dr. Smith's queue

### **API Calls**
```
GET /patient/appointments?date={date}&limit=100
GET /hr/employees?department=doctor&limit=100 (fetch doctors)
POST /patient/appointments (body: {patient_id, doctor_id, appointment_date, visit_type})
PATCH /patient/appointments/{id}/status (body: {status: 'in_consultation' | 'completed' | 'cancelled'})
GET /patient/appointments/{id} (view details)
```

### **Permissions Checked**
- `appointment.view` - Display page & table
- `appointment.modify` - "+ Book Token" button
- `appointment.close_appointment` - Cancel / Close button
- `appointment.convert_to_admission` - "Convert to Admission" button

### **User Interactions**
1. Select appointment date from picker
2. Table auto-filters for that date
3. Click "+ Book Token" → Modal opens
4. Enter patient ID (search or type)
5. Select doctor → Token auto-generated
6. Click "Book Token" → Saved
7. Table updates with new token
8. Click token row → Can move to "In Consultation"
9. After consultation → Mark "Completed"

### **Token Assignment Workflow**
- Receptionist books token at counter
- Next available token number assigned
- Receptionist hands token to patient
- Doctor starts consultation → Click to move "In Consultation"
- After consultation → Mark "Completed"
- Next patient called with next token

### **Next Steps**
- Completed appointment → Can link to Consultation/Prescription
- Option: Convert to Admission (if hospitalization needed)
- No-show → Can cancel appointment

---

## 9. Consultation

### **Purpose**
Doctor consultation notes & prescription management. Record patient complaints, diagnosis, doctor advice, and prescribe medicines.

### **Key Sections**

#### Page Header
- **Title:** "Consultation & Prescription"
- **Appointment ID Lookup:** Input field + "Load" button (to fetch appointment & existing consultation)
- **"🔍 Search" Button:** Find appointment

#### Doctor Notes Section (Multipart Form)
1. **Appointment Details Card (Readonly):**
   - Patient Name
   - Doctor Name
   - Appointment Date & Token #

2. **Clinical Form:**
   - **Patient Complaints** (textarea) - What patient reports
   - **Doctor Diagnosis** (textarea) - Doctor's clinical assessment
   - **Doctor Notes** (textarea) - Additional observations
   - **Follow-up Date** (date input, optional)

#### Prescription Builder

**Medicine Search Box:**
- Input: Medicine name or generic name
- Auto-suggests matching medicines
- Shows: Medicine Name | Generic Name | Category
- Click suggestion → Adds to prescription table

**Prescription Table:**
- **Columns:**
  - Medicine Name (linked)
  - Generic Name
  - Dose (Morning | Afternoon | Night) - Spinners (↑↓)
  - Duration (days) - Numeric input
  - Food Instruction (select: After Food / Before Food / Anytime)
  - Notes (textarea)
  - 🗑️ Delete button (remove medicine)
- **Default Values:**
  - Dose: Morning=1, Afternoon=0, Night=1
  - Duration: 5 days
  - Food: After Food
- **Add More:** "✚ Add Medicine" button below table

#### Form Buttons
- **"← Back"** - Cancel & go back
- **"💾 Save Consultation"** - POST to backend

#### Success Confirmation
- Green checkmark
- Message: "Consultation saved successfully"
- Option: Print or Share with patient

### **API Calls**
```
GET /patient/appointments?limit=200 (search appointment)
GET /consultation/appointments/{appointmentId}/consultation (load existing)
GET /pharmacy/medicines?search={query}&limit=10 (medicine search)
POST /consultation/appointments/{appointmentId} (save consultation & prescription)
PATCH /consultation/{consultationId} (update existing)
```

### **Permissions Checked**
- `consultation.view` - Display page
- `consultation.modify` - Load & Save buttons
- Typically: Doctors only

### **User Interactions**
1. Enter Appointment ID → Click "Load"
2. Appointment & patient details auto-populate
3. Fill Complaints, Diagnosis, Doctor Notes
4. Type medicine name in search → Suggestions appear
5. Click suggestion → Adds to prescription
6. Adjust dose, duration, food instruction per medicine
7. Click "+ Add Medicine" → Add another
8. Click delete 🗑️ → Remove medicine
9. Click "Save Consultation" → POST to backend
10. Success message appears

### **Prescription Data Structure**
```json
{
  "appointment_id": 123,
  "complaints": "Fever, cough, body pain",
  "diagnosis": "Common Cold / Viral Fever",
  "doctor_notes": "Rest, fluids, paracetamol PRN",
  "follow_up_date": "2026-07-22",
  "prescription_items": [
    {
      "medicine_id": 45,
      "dose_morning": 1,
      "dose_afternoon": 0,
      "dose_night": 1,
      "duration_days": 5,
      "food_instruction": "after_food",
      "notes": "Take with warm water"
    }
  ]
}
```

### **Next Steps**
- Saved consultation → Patient can view prescription
- Prescription → Link to Pharmacy Billing (if patient buys medicines)
- Follow-up appointment → Can rebook token

---

## 10. Records

### **Purpose**
Patient master data management. Register new patients, search, edit, view medical history & linked admissions.

### **Key Sections**

#### Page Header
- **Title:** "Patient Records"
- **Subtitle:** "Patient registration, search, and medical history"
- **"+ Register Patient" Button:** Opens registration modal

#### Search & Filter Bar
- **Search Input:** Patient name, mobile, ID (real-time with debounce)
- **Search Icon:** Lucide `Search`

#### Patient Table
- **Columns:**
  - Patient ID (linked)
  - Full Name
  - Age (years)
  - Gender (M / F / Other)
  - Mobile
  - Blood Group
  - Created Date
  - Actions (View / Edit / Delete)
- **Row Highlighting:** Hover effect
- **Empty State:** "No patients found"
- **Pagination:** 50 per page

#### Register Patient Modal
- **Trigger:** Click "+ Register Patient"
- **Modal Title:** "Register New Patient"
- **Form Layout:** Multi-row
- **Fields:**
  1. **Full Name*** (text input)
  2. **Mobile Number*** (tel input)
  3. **Blood Group** (select: O+, O-, A+, A-, B+, B-, AB+, AB-)
  4. **Age (years)*** (number: 0-150)
  5. **Gender*** (select: Male / Female / Other)
  6. **Date of Birth** (date input, optional)
  7. **Address** (text input)
  8. **Notes** (textarea)
- **Buttons:** Cancel | Save Patient
- **Validation:** Full Name, Mobile, Age required
- **Error Message:** Red text below form

#### Patient Detail View (after clicking row)
- Shows all patient info in readonly format
- Linked Admissions list (if any)
- Option to edit or delete

### **API Calls**
```
GET /patient/patients?search={query}&limit=50
POST /patient/patients (register new)
PATCH /patient/patients/{id} (edit)
DELETE /patient/patients/{id} (delete)
GET /patient/patients/{id} (view details)
GET /patient/admissions?patient_id={patientId} (linked admissions)
```

### **Permissions Checked**
- `patient.view` - Display page & table
- `patient.modify` - "+ Register Patient" button
- `patient.delete` - Delete button

### **User Interactions**
1. Click "+ Register Patient" → Modal opens
2. Fill name, mobile, age, gender (required)
3. Fill optional fields (blood group, address)
4. Click "Save Patient" → POST to backend
5. Table refreshes with new patient
6. Search by name/mobile → Filters list
7. Click patient row → View full details
8. Option to edit or delete from detail view

### **Next Steps**
- Registered patient → Can book appointments
- Admission record → Links to patient
- Consultation → Links to patient via appointment

---

## Pharmacy Module

## 11. Stock

### **Purpose**
Pharmacy inventory management. Track medicine stock levels, identify low-stock items, search medicines.

### **Key Sections**

#### Page Header
- **Title:** "Pharmacy Stock & Inventory"
- **Subtitle:** "{total} medicines — {lowCount} low/out of stock"
- **Tab Selector:** All | Low/OOS
- **"↻ Refresh" Button:** Reload inventory

#### Stock Alert Badge
- If any medicines low/out of stock: ⚠️ Badge showing count
- Example: "⚠️ 5 Low Stock Items"

#### Tab 1: All Medicines
- **Search Input:** Search by name, generic name, barcode
- **Real-time filtering** (debounced 300ms)

#### Tab 2: Low / Out of Stock
- Shows only medicines with qty ≤ 10 or qty = 0
- High-priority view for reordering

#### Medicine Stock Table
- **Columns:**
  - Medicine Name (bold) + Barcode (small, gray, monospace)
  - Generic Name
  - Category (e.g., Antibiotic, Analgesic)
  - Total Stock (qty) - Number
  - Stock Status (badge)
  - Selling Price (₹)
  - GST (%)
- **Stock Status Badges:**
  - **In Stock** (green) - qty > 10
  - **Low Stock** (yellow) - 1 ≤ qty ≤ 10
  - **Out of Stock** (red) - qty = 0
- **Row Click:** View medicine details + batch history
- **Pagination:** 100 per page on Tab 1, all on Tab 2

#### Stock Levels Visual Indicator
- Simple bar chart or progress indicator per row
- Color gradient: Green (full) → Yellow (low) → Red (empty)

### **API Calls**
```
GET /pharmacy/medicines?search={query}&limit=100
GET /pharmacy/medicines?lowStock=true&limit=200 (for low stock tab)
GET /pharmacy/medicines/{id}/batches (batch/expiry info)
GET /pharmacy/medicines/{id}/history (stock movement history)
POST /pharmacy/medicines/reorder (place reorder)
```

### **Permissions Checked**
- `pharmacy.view` - Display page & tables

### **User Interactions**
1. Page loads → Shows all medicines (tab: All)
2. Type in search → Auto-filters (debounced)
3. Click "Low/OOS" tab → Shows only low-stock items
4. Click medicine row → View details (batches, expiry dates)
5. Click "Refresh" → Reloads inventory count

### **Stock Calculation**
- Total Stock = Sum of all batches qty (where expiry_date > today)
- Excludes expired batches

### **Barcode Usage**
- FIFO-based barcode scanning in Billing
- Barcode shown in small font under medicine name

### **Next Steps**
- Low stock items → Reorder form (create PO)
- Medicine details → Batch info with expiry tracking
- Integration with Billing (Stock.jsx → Billing.jsx)

---

## 12. Billing

### **Purpose**
Pharmacy POS (Point of Sale) system. Barcode scanning, cart management, bill generation with GST & discounts.

### **Key Sections**

#### Page Header
- **Title:** "Pharmacy Billing"
- **Subtitle:** "POS system with barcode scanning and bill generation"
- **Status:** Total items | Total amount (live update)

#### Billing Form - Two Columns

**Left Column: Barcode Scanner (Primary Input)**
- **Large Focus Input:** Barcode scanner (auto-focus on page load)
- Barcode format: EAN13 or custom code
- **Global Keydown Listener:** Auto-focuses barcode input if user not typing elsewhere
- **On Submit:** Lookup medicine by barcode → Add to cart
- Error handling: "Medicine not found" alert

**Right Column: Cart Summary**
- **Bill Items Table:**
  - Medicine Name
  - Qty (with ↑↓ spinners)
  - Unit Price (₹)
  - Discount % (editable)
  - Subtotal (calculated: qty × unit_price × (1 - discount%))
  - Delete 🗑️ button

- **Bill Totals Card:**
  - Subtotal (₹) - Sum of all items
  - GST % (from medicine master)
  - GST Amount (₹) - Auto-calculated
  - **Discount Amount** (₹) - If applied
  - **Total Amount** (₹) - Bold, large font
  - **Amount Paid** (₹) - Input field
  - **Change Due** (₹) - Calculated: Total - Paid

- **Payment Mode:** Select (Cash / UPI / Card / Insurance / Credit)
- **Print Button:** Generate & print bill
- **Generate Bill Button:** POST to backend

#### Medicine Search Alternative
- If not scanning: Search input for manual lookup
- Shows suggestions → Click to add to cart

#### Stock Validation
- When adding to cart: Check available stock
- If qty > available: Alert "Only {stock} units available"
- Prevent adding more than available qty

#### FIFO Batch Logic
- When medicine added: Fetch earliest batch (by batch creation date)
- Use that batch's selling_price for unit price
- On print: Show batch # & expiry date

#### Bill Output
- **Bill Format:**
  ```
  NEHA HOSPITAL PHARMACY
  Bill Date: 2026-07-15 14:30
  ─────────────────────
  Item           Qty  Price   Discount  Total
  ─────────────────────
  Paracetamol    10   ₹5.00   0%        ₹50.00
  Amoxicillin    5    ₹12.00  5%        ₹57.00
  ─────────────────────
  Subtotal:      ₹107.00
  GST (5%):      ₹5.35
  Total:         ₹112.35
  Paid (Cash):   ₹115.00
  Change:        ₹2.65
  ─────────────────────
  Thank you for visiting!
  ```

### **API Calls**
```
GET /pharmacy/medicines/barcode/{barcode}
GET /pharmacy/medicines?search={query}&limit=10
GET /pharmacy/medicines/{id}/batches?status=available
POST /pharmacy/bills (create bill)
GET /pharmacy/bills/{billId} (view/print)
```

### **Permissions Checked**
- `pharmacy.view` - Display page
- `pharmacy.modify` - Add/remove items
- `pharmacy.generate_bill` - Generate Bill button

### **User Interactions**
1. Barcode scanner focused by default
2. Scan medicine barcode → AUTO-added to cart
3. Repeat step 2 for multiple items
4. Adjust quantity with ↑↓ spinners
5. Apply discount % per item (optional)
6. Select Payment Mode
7. Enter Amount Paid
8. Change automatically calculated
9. Click "Generate Bill" → POST to backend, save bill record
10. Click "Print" → Print bill
11. Bill clears for next customer

#### POS Workflow (Typical)
- Pharmacist opens page
- Customer brings medicines to counter
- Scan each barcode → Added to cart
- Adjust quantities if needed
- Apply bulk discount (if applicable)
- Select payment mode (usually Cash)
- Enter cash amount
- Print bill & receipt
- Give to customer

### **Inventory Deduction**
- On Bill Generation (POST): Deduct qty from medicine_batches.available_qty
- Update stock in Stock.jsx table (real-time)

### **Next Steps**
- Bill saved → Link to Patient (if patient_id provided)
- Admission/Consultation integration (pharmacy charges linked)
- Daily billing reports (revenue tracking)

---

## Summary: Module Dependencies & Data Flow

### **Cross-Module Data Flow**

```
DASHBOARD (Read-Only)
  ↓ Shows KPIs from all modules
  ├─ Patients module → Patient count
  ├─ Appointments → Today's tokens
  └─ Admissions → Active bed count

HR MODULE
  ├─ Employees → Master data (all other modules reference)
  ├─ Attendance → Daily punch logs
  ├─ Roster → Shift assignments (feeds into Attendance)
  └─ Payroll ← All above → Final salary calculation

PATIENT MODULE
  ├─ Records → Patient registration
  ├─ Appointments ← Records (patient_id)
  ├─ Consultation ← Appointments → Prescription
  └─ Pharmacy Billing ← Consultation (medicines prescribed)

HOSPITAL MODULE
  ├─ Admissions ← Appointments or direct (patient_id)
  ├─ Consultation ← During admission
  └─ Discharge ← Admissions (admission_id)

PHARMACY MODULE
  ├─ Stock → Inventory levels
  └─ Billing ← Stock (medicine_id, batch_id)
```

---

## API Endpoint Summary

| Module | Endpoint | Method | Purpose |
|--------|----------|--------|---------|
| **Dashboard** | GET /patient/appointments | GET | Today's tokens |
| | GET /patient/patients | GET | Patient count |
| | GET /patient/admissions | GET | Active admissions |
| **Employees** | GET /hr/employees | GET | List all |
| | POST /hr/employees | POST | Create |
| | PATCH /hr/employees/{id} | PATCH | Update |
| **Attendance** | GET /attendance/daily | GET | Daily summary |
| | POST /attendance/sync | POST | Biometric sync |
| | PATCH /attendance/corrections/{id}/approve | PATCH | Approve correction |
| **Roster** | GET /hr/roster | GET | Monthly view |
| | POST /hr/roster/assign | POST | Assign shifts |
| **Payroll** | GET /salary/run | GET | Payroll items |
| | POST /salary/run/generate | POST | Generate calculation |
| | POST /salary/run/lock | POST | Finalize |
| **Admissions** | POST /patient/admissions | POST | Admit patient |
| | GET /patient/admissions | GET | List admissions |
| **Discharge** | POST /patient/discharges | POST | Process discharge |
| **Appointments** | GET /patient/appointments | GET | List appointments |
| | POST /patient/appointments | POST | Book token |
| | PATCH /patient/appointments/{id}/status | PATCH | Update status |
| **Consultation** | POST /consultation/appointments/{id} | POST | Save consultation |
| | GET /pharmacy/medicines | GET | Medicine search |
| **Records** | GET /patient/patients | GET | List patients |
| | POST /patient/patients | POST | Register |
| **Stock** | GET /pharmacy/medicines | GET | Inventory list |
| **Billing** | GET /pharmacy/medicines/barcode/{code} | GET | Barcode lookup |
| | POST /pharmacy/bills | POST | Generate bill |

---

## Styling Implementation

### **CSS Architecture**
- **Global:** index.css (CSS variables + utilities.css imports)
- **Per-Page:** {PageName}.css (semantic classes)
- **Components:** Component.css (reusable patterns)

### **Key CSS Classes Used Across Pages**
- `.page-header` / `.page-header__title` / `.page-header__sub`
- `.card` / `.card-header` / `.card-content`
- `.table` / `thead` / `tbody` / `tr` / `td`
- `.modal-overlay` / `.modal-box` / `.modal-header` / `.modal-body` / `.modal-footer`
- `.badge` / `.badge-primary` / `.badge-success` / `.badge-danger` / `.badge-warning`
- `.field` / `.field-label` / `.form-group`
- `.tab-btn` / `.tab-bar` (for tabs)
- Utilities: `.gap-3` / `.space-y-4` / `.grid-cols-2` / `.flex-center`

---

## RBAC Permissions Matrix

### **Modules (12 Total)**
1. HR & Employee Management
2. Shift & Roster Management
3. Attendance Engine
4. Leave Engine
5. Fine Engine
6. Payroll Engine
7. Patient Records
8. Appointment / Token
9. Doctor Consultation & Prescription
10. Pharmacy Module
11. Admission & Bed Management
12. Discharge & Patient History

### **Actions (16 Total)**
- **Standard (3):** View, Modify, Delete
- **Special Approvals (13):**
  - Approve Salary Increment
  - Publish Roster
  - Approve Attendance Correction
  - Approve Leave (Reporting)
  - Approve Leave (HR)
  - Waive Fine
  - Lock Payroll
  - Generate Payslip
  - Close Appointment
  - Convert to Admission
  - Assign Bed
  - Generate Pharmacy Bill
  - Discharge Patient

### **Role Examples**
- **Administrator** - All 49 permissions
- **HR Manager** - HR modules (1-6), view-only Patient (7)
- **Doctor** - Patient (7), Appointments (8), Consultation (9)
- **Nurse** - Appointments (8), Consultation (9), Admissions (11)
- **Pharmacist** - Pharmacy (10)
- **Receptionist** - Appointments (8), Patient Records (7) - view/modify
- **Staff** - Attendance (3), Leave (4) - view/modify own records

---

**End of Document**

Generated: 2026-07-15  
Version: 1.0 (Complete UI Flow)  
Author: AI Assistant  
Scope: All 12 pages + API integration
