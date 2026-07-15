import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import './Stock.css';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, TableLoading } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Package, AlertTriangle, Search, RefreshCw } from 'lucide-react';

function StockBadge({ qty }) {
  if (qty === 0) return <span className="badge badge-danger">Out of Stock</span>;
  if (qty <= 10) return <span className="badge badge-warning">Low Stock</span>;
  return <span className="badge badge-success">In Stock</span>;
}

export function Stock() {
  const { request } = useApi();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState('all'); // all | low

  const load = async (q = '', tab = 'all') => {
    setLoading(true);
    try {
      const url = tab === 'low'
        ? `/pharmacy/medicines?lowStock=true&limit=200`
        : `/pharmacy/medicines?search=${encodeURIComponent(q)}&limit=100`;
      const res = await request(url);
      if (res?.success) {
        const rows = res.data?.rows || res.data || [];
        setMedicines(rows);
        setTotal(res.data?.total || rows.length);
      }
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => load(search, activeTab), 300);
    return () => clearTimeout(t);
  }, [search, activeTab]);

  const lowCount = medicines.filter(m => (m.total_stock || 0) <= 10).length;

  return (
    <div className="p-5 space-y-4">
      <div className="page-header">
        <div>
          <div className="page-header__title">Pharmacy Stock & Inventory</div>
          <div className="page-header__sub">{total} medicines — {lowCount > 0 ? `⚠ ${lowCount} low/out of stock` : 'All stocked'}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="tab-bar">
            <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All</button>
            <button className={`tab-btn ${activeTab === 'low' ? 'active' : ''}`} onClick={() => setActiveTab('low')}>
              Low / OOS {lowCount > 0 && <span className="ml-1 badge badge-danger">{lowCount}</span>}
            </button>
          </div>
          <Button variant="outline" icon={RefreshCw} onClick={() => load(search, activeTab)}>Refresh</Button>
        </div>
      </div>

      {activeTab === 'all' && (
        <div className="flex items-center gap-2 bg-white border border-[#c4c9cf] rounded-md px-3 py-2">
          <Search size={14} className="text-[#767c83]" />
          <input
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#1e2227] placeholder-[#767c83]"
            placeholder="Search by medicine name or generic…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medicine Name</TableHead>
              <TableHead>Generic Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead align="right">Total Stock</TableHead>
              <TableHead>Stock Status</TableHead>
              <TableHead align="right">Selling Price</TableHead>
              <TableHead align="right">GST</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableLoading colSpan={7} /> :
             medicines.length === 0 ? <TableEmpty colSpan={7} message="No medicines found." /> :
             medicines.map(m => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="font-semibold text-[13px]">{m.name}</div>
                  {m.barcode && <div className="text-[10px] text-[#767c83] font-mono">{m.barcode}</div>}
                </TableCell>
                <TableCell className="text-[#767c83]">{m.generic_name || '—'}</TableCell>
                <TableCell className="text-[#767c83]">{m.category || '—'}</TableCell>
                <TableCell align="right">
                  <span className={`font-bold ${(m.total_stock || 0) === 0 ? 'text-red-600' : (m.total_stock || 0) <= 10 ? 'text-amber-600' : 'text-[#1e2227]'}`}>
                    {m.total_stock ?? 0}
                  </span>
                </TableCell>
                <TableCell><StockBadge qty={m.total_stock ?? 0} /></TableCell>
                <TableCell align="right">
                  {m.selling_price != null ? `₹${Number(m.selling_price).toFixed(2)}` : <span className="text-[#767c83]">—</span>}
                </TableCell>
                <TableCell align="right" className="text-[#767c83]">{m.gst_percent ?? 0}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
