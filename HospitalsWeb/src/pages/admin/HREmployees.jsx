import React, { useState } from 'react';

export default function HREmployees() {
  const [selectedEmployee, setSelectedEmployee] = useState(0);

  const employees = [
    {
      id: 1,
      name: 'Priya Nandhini',
      dept: 'Nursing',
      role: 'Nurse',
      status: 'Active',
      phone: '98xxxxxx10',
      joiningDate: '01 Jun 2026',
      salary: '₹22,500 / month',
      dayShift: '₹850 / day',
      nightShift: '₹1,050 / night',
      bankAcc: 'xxxxxxxx4213',
      ifsc: 'HDFC0001234',
      uan: 'Pending enrolment'
    },
    {
      id: 2,
      name: 'Sundar M.',
      dept: 'Laboratory',
      role: 'Lab Technician',
      status: 'Active',
      phone: '97xxxxxx22',
      joiningDate: '15 Jan 2025',
      salary: '₹28,000 / month',
      dayShift: '₹950 / day',
      nightShift: '₹1,200 / night',
      bankAcc: 'xxxxxxxx5512',
      ifsc: 'SBIN0004321',
      uan: 'TN/MAS/12345/678'
    },
    {
      id: 3,
      name: 'Ravi T.',
      dept: 'Pharmacy',
      role: 'Pharmacist',
      status: 'Active',
      phone: '96xxxxxx44',
      joiningDate: '10 Mar 2026',
      salary: '₹25,000 / month',
      dayShift: '₹900 / day',
      nightShift: '₹1,100 / night',
      bankAcc: 'xxxxxxxx8890',
      ifsc: 'ICIC0009876',
      uan: 'TN/MAS/98765/432'
    },
    {
      id: 4,
      name: 'Kavitha S.',
      dept: 'Admin',
      role: 'Receptionist',
      status: 'Inactive',
      phone: '95xxxxxx88',
      joiningDate: '01 Aug 2024',
      salary: '₹18,000 / month',
      dayShift: '₹700 / day',
      nightShift: '₹900 / night',
      bankAcc: 'xxxxxxxx1123',
      ifsc: 'UTIB0001122',
      uan: 'TN/MAS/54321/890'
    },
    {
      id: 5,
      name: 'Dr. Meera R.',
      dept: 'General Medicine',
      role: 'Doctor',
      status: 'Active',
      phone: '94xxxxxx99',
      joiningDate: '05 May 2023',
      salary: '₹85,000 / month',
      dayShift: '₹3,000 / day',
      nightShift: '₹4,500 / night',
      bankAcc: 'xxxxxxxx7766',
      ifsc: 'HDFC0004321',
      uan: 'TN/MAS/11223/999'
    }
  ];

  const current = employees[selectedEmployee];

  return (
    <div className="space-y-6">
      {/* Top Header Bar with Breadcrumb and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            Staff & Salary &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">HR & Employees</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search employees..."
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-xs w-60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors placeholder-gray-400"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer">
            <span>+</span> Add Employee
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500">Total Employees</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">94</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <span>↗</span> +2 &nbsp;<span className="text-gray-500">85 present today</span>
            </div>
          </div>
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500">On Leave Today</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">3</div>
            <div className="text-[11px] text-amber-600 font-medium mt-1">
              2 pending approval
            </div>
          </div>
          <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500">Attendance Today</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">86</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <span>~</span> 91.5% &nbsp;<span className="text-gray-500">Attendance rate</span>
            </div>
          </div>
          <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500">Payroll This Month</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">₹17.2L</div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">
              5 pending approval
            </div>
          </div>
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5ptm-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Split View: Employees List + Detailed Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Employees List */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Employees</h2>
            <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              94 total
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {employees.map((emp, idx) => {
              const isSelected = selectedEmployee === idx;
              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployee(idx)}
                  className={`w-full p-3.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-gray-50/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">{emp.name}</div>
                      <div className="text-[11px] text-gray-400">
                        {emp.dept} · {emp.role}
                      </div>
                    </div>
                  </div>
                  
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      emp.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                        : 'bg-rose-50 text-rose-600 border border-rose-200/60'
                    }`}
                  >
                    {emp.status}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-3 border-t border-gray-100 text-center">
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
              View all employees
            </button>
          </div>
        </div>

        {/* Right Side: Detailed Employee Profile */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
            <h2 className="text-base font-bold text-gray-900">
              Employee Profile — <span className="text-blue-600">{current.name}</span>
            </h2>
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
              Edit Profile
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Profile Avatar Badge */}
            <div className="flex flex-col items-center justify-center p-6 bg-gray-50/50 rounded-xl border border-gray-100 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.959 11.959 0 0112 2.714z" />
                </svg>
              </div>
              <span className={`text-xs font-semibold px-3 py-0.5 rounded-full ${
                current.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {current.status}
              </span>
            </div>

            {/* Profile Metadata Grid */}
            <div className="md:col-span-2 grid grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">DEPARTMENT</div>
                <div className="text-xs font-bold text-gray-800 mt-1">{current.dept}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">DESIGNATION</div>
                <div className="text-xs font-bold text-gray-800 mt-1">{current.role}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PHONE</div>
                <div className="text-xs font-bold text-gray-800 mt-1">{current.phone}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">JOINING DATE</div>
                <div className="text-xs font-bold text-gray-800 mt-1">{current.joiningDate}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">MONTHLY SALARY</div>
                <div className="text-xs font-bold text-gray-800 mt-1">{current.salary}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PER DAY SHIFT</div>
                <div className="text-xs font-bold text-gray-800 mt-1">{current.dayShift}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PER NIGHT SHIFT</div>
                <div className="text-xs font-bold text-gray-800 mt-1">{current.nightShift}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BANK ACCOUNT</div>
                <div className="text-xs font-bold text-gray-800 mt-1">{current.bankAcc}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">IFSC</div>
                <div className="text-xs font-bold text-gray-800 mt-1">{current.ifsc}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">UAN (PF)</div>
                <div className="text-xs font-bold text-gray-800 mt-1">{current.uan}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-6">
            <button className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm cursor-pointer transition-colors">
              Save changes
            </button>
            <button className="border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5">
              <span>💳</span> View salary history
            </button>
            <button className="border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5">
              <span>📅</span> View attendance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
