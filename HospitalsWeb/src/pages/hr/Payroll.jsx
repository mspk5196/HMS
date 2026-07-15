import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import './Payroll.css';
import { Button } from '../../components/ui/Button';
import { useApi } from '../../hooks/useApi';
import { Calculator, Download } from 'lucide-react';

export const Payroll = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const { request } = useApi();

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await request(`/salary/run?month=${month}&year=${year}`);
      if (res?.success) setPayrolls(res.data || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [month, year]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await request(`/salary/run/generate`, { method: 'POST', body: JSON.stringify({ month, year }) });
      if (res?.success) loadData();
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  return (
    <div className="p-5 space-y-4">
      <div className="page-header">
        <div>
          <div className="page-header__title">Payroll</div>
          <div className="page-header__sub">Combines attendance, leave, fines, overtime and PF/ESI into final payslip.</div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            className="field w-36"
            value={`${year}-${String(month).padStart(2, '0')}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-');
              setCurrentDate(new Date(y, m - 1, 1));
            }}
          />
          <Button icon={Calculator} onClick={handleGenerate} isLoading={loading}>Run Calculation</Button>
        </div>
      </div>

      <Card>
        {payrolls.length === 0 && !loading ? (
          <div className="p-12 text-center text-[#767c83] flex flex-col items-center">
            <p className="text-sm font-semibold mb-4">No payroll calculations run for this month.</p>
            <Button icon={Calculator} onClick={handleGenerate} isLoading={loading}>Run Calculation Now</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Basis</TableHead>
                <TableHead align="center">Days/Shifts</TableHead>
                <TableHead align="right">Gross (₹)</TableHead>
                <TableHead align="right">LOP/Fines (₹)</TableHead>
                <TableHead align="right">PF/ESI (₹)</TableHead>
                <TableHead align="right">Net Pay (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? <tr><td colSpan={7} className="py-10 text-center"><div className="w-4 h-4 border-2 border-[#c4c9cf] border-t-[#1e2227] rounded-full animate-spin mx-auto"/></td></tr>
                : payrolls.length === 0
                ? <tr><td colSpan={7} className="py-10 text-center text-[#767c83] text-sm">No data.</td></tr>
                : payrolls.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell className="text-[#767c83] capitalize">{row.salary_basis?.replace(/_/g, ' ')}</TableCell>
                    <TableCell align="center">{row.salary_basis === 'per_shift' ? row.payable_shifts : row.payable_days}</TableCell>
                    <TableCell align="right">₹{Number(row.gross_salary||0).toFixed(2)}</TableCell>
                    <TableCell align="right" className="text-red-600">-₹{(Number(row.total_deductions||0)+Number(row.fines_amount||0)).toFixed(2)}</TableCell>
                    <TableCell align="right" className="text-[#767c83]">-₹{(Number(row.pf_deduction||0)+Number(row.esi_deduction||0)).toFixed(2)}</TableCell>
                    <TableCell align="right"><span className="font-bold text-[#1e2227]">₹{Number(row.net_salary||0).toFixed(2)}</span></TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};
