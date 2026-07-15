import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Login } from './pages/auth/Login';

// Dashboard
import { Dashboard } from './pages/Dashboard';

// Patient Care
import { Records }       from './pages/patients/Records';
import { Appointments }  from './pages/patients/Appointments';
import { Consultation }  from './pages/patients/Consultation';

// IPD / Hospital
import { Admissions }   from './pages/hospital/Admissions';
import { Discharge }    from './pages/hospital/Discharge';

// Pharmacy
import { PharmacyBilling } from './pages/pharmacy/Billing';
import { Stock }           from './pages/pharmacy/Stock';

// Human Resources
import { Employees }  from './pages/hr/Employees';
import { Roster }     from './pages/hr/Roster';
import { Attendance } from './pages/hr/Attendance';
import { Payroll }    from './pages/hr/Payroll';
import { Structure }  from './pages/hr/Structure';

// ── Auth Guard ─────────────────────────────────────────
const RequireAuth = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
};

// ── App ─────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
            {/* Dashboard */}
            <Route index element={<Dashboard />} />

            {/* Patient Care */}
            <Route path="patients">
              <Route path="records"      element={<Records />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="consultation" element={<Consultation />} />
            </Route>

            {/* IPD / Hospital */}
            <Route path="hospital">
              <Route path="admissions" element={<Admissions />} />
              <Route path="discharge"  element={<Discharge />} />
            </Route>

            {/* Pharmacy */}
            <Route path="pharmacy">
              <Route path="billing" element={<PharmacyBilling />} />
              <Route path="stock"   element={<Stock />} />
            </Route>

            {/* Human Resources */}
            <Route path="hr">
              <Route path="employees"  element={<Employees />} />
              <Route path="roster"     element={<Roster />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="payroll"    element={<Payroll />} />
              <Route path="structure"  element={<Structure />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
