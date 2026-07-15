import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { useApi } from '../../hooks/useApi';
import { Search, ScanLine, Plus, Trash2, Printer, Pill, CreditCard } from 'lucide-react';
import './Billing.css';

export function PharmacyBilling() {
  const [items, setItems] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [barcode, setBarcode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const { request, loading } = useApi();
  
  const barcodeInputRef = useRef(null);

  // Keep focus on barcode scanner input for easy POS flow
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // If user isn't typing in another input, focus the barcode scanner
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        barcodeInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    
    try {
      const res = await request(`/pharmacy/medicines/barcode/${barcode.trim()}`);
      if (res.data) addItemToCart(res.data);
    } catch (err) { alert(err.message || 'Medicine not found'); }
    setBarcode('');
  };

  const addItemToCart = (med, customQty = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.medicine_id === med.id);
      if (existing) {
        // Enforce max stock limit if available
        if (existing.quantity + customQty > med.total_stock) {
          alert(`Cannot add more. Only ${med.total_stock} left in stock.`);
          return prev;
        }
        return prev.map(i => i.medicine_id === med.id 
          ? { ...i, quantity: i.quantity + customQty } 
          : i
        );
      }
      
      if (med.total_stock < customQty) {
        alert(`Insufficient stock. Only ${med.total_stock} left.`);
        return prev;
      }
      
      // Default to the earliest batch price (FIFO)
      const unitPrice = med.batches?.[0]?.selling_price || 0;
      
      return [...prev, {
        medicine_id: med.id,
        name: med.name,
        generic: med.generic_name,
        quantity: customQty,
        unit_price: unitPrice,
        discount_percent: 0,
        gst_percent: med.gst_percent || 0,
        total_stock: med.total_stock
      }];
    });
  };

  const updateQuantity = (id, newQty) => {
    if (newQty < 1) return;
    setItems(prev => prev.map(i => {
      if (i.medicine_id === id) {
        if (newQty > i.total_stock) {
          alert(`Only ${i.total_stock} units available.`);
          return i;
        }
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const updateDiscount = (id, newDiscount) => {
    setItems(prev => prev.map(i => i.medicine_id === id ? { ...i, discount_percent: Number(newDiscount) } : i));
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(i => i.medicine_id !== id));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await request(`/pharmacy/medicines?search=${searchQuery}`);
      setSuggestions(res.data || []);
    } catch (err) { /* ignore */ }
  };

  const handleGenerateBill = async () => {
    if (!patientId) return alert('Please select a patient ID');
    if (items.length === 0) return alert('Cart is empty');

    try {
      const payload = {
        patient_id: Number(patientId),
        bill_date: new Date().toISOString().split('T')[0],
        payment_mode: 'cash',
        items: items.map(i => ({
          medicine_id: i.medicine_id,
          quantity: i.quantity,
          discount_percent: i.discount_percent
        }))
      };
      
      const res = await request('/pharmacy/bills', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      alert('Bill generated successfully! Bill ID: ' + res.data.id);
      setItems([]);
      setPatientId('');
    } catch (err) {
      alert('Error generating bill: ' + err.message);
    }
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const totalDiscount = items.reduce((sum, item) => sum + ((item.unit_price * item.quantity) * (item.discount_percent / 100)), 0);
  const totalTax = items.reduce((sum, item) => {
    const discountedLine = (item.unit_price * item.quantity) * (1 - item.discount_percent / 100);
    return sum + (discountedLine * (item.gst_percent / 100));
  }, 0);
  const netAmount = subtotal - totalDiscount + totalTax;

  return (
    <div className="pos-container">
      <div className="pos-main">
        {/* Top Controls */}
        <div className="pos-controls">
          <Card className="pos-scan-card">
            <CardContent>
              <form onSubmit={handleBarcodeSubmit} className="flex gap-4 items-center">
                <ScanLine size={24} className="text-primary" />
                <Input 
                  ref={barcodeInputRef}
                  placeholder="Scan Barcode here..." 
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  containerClassName="flex-1 mb-0"
                />
                <Button type="submit" variant="primary">Add</Button>
              </form>
            </CardContent>
          </Card>
          
          <Card className="pos-search-card">
            <CardContent>
              <form onSubmit={handleSearch} className="flex gap-4 items-center">
                <Input 
                  icon={Search}
                  placeholder="Search Medicine manually..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  containerClassName="flex-1 mb-0"
                />
                <Button type="submit" variant="secondary">Search</Button>
              </form>
              
              {suggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {suggestions.map(med => (
                    <div key={med.id} className="suggestion-item" onClick={() => {
                      addItemToCart(med);
                      setSuggestions([]);
                      setSearchQuery('');
                    }}>
                      <div>
                        <strong>{med.name}</strong> <small>({med.generic_name})</small>
                      </div>
                      <div className="suggestion-stock">Stock: {med.total_stock}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cart Table */}
        <Card className="pos-cart-card">
          <CardHeader title="Current Bill Items" icon={<Pill />} />
          <CardContent noPadding>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead align="center">Unit Price (₹)</TableHead>
                  <TableHead align="center">Qty</TableHead>
                  <TableHead align="center">Disc (%)</TableHead>
                  <TableHead align="center">GST (%)</TableHead>
                  <TableHead align="right">Line Total</TableHead>
                  <TableHead align="center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" className="empty-cart">
                      No items added yet. Scan a barcode or search to begin.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map(item => {
                    const lineTotal = (item.unit_price * item.quantity) * (1 - item.discount_percent / 100);
                    const lineGst = lineTotal * (item.gst_percent / 100);
                    return (
                      <TableRow key={item.medicine_id}>
                        <TableCell>
                          <strong>{item.name}</strong><br/>
                          <small className="text-muted">{item.generic}</small>
                        </TableCell>
                        <TableCell align="center">{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell align="center">
                          <input 
                            type="number" 
                            className="qty-input" 
                            value={item.quantity} 
                            min="1"
                            onChange={e => updateQuantity(item.medicine_id, parseInt(e.target.value) || 1)}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <input 
                            type="number" 
                            className="qty-input" 
                            value={item.discount_percent} 
                            min="0" max="100"
                            onChange={e => updateDiscount(item.medicine_id, e.target.value)}
                          />
                        </TableCell>
                        <TableCell align="center">{item.gst_percent}%</TableCell>
                        <TableCell align="right">₹{(lineTotal + lineGst).toFixed(2)}</TableCell>
                        <TableCell align="center">
                          <button className="btn-icon-danger" onClick={() => removeItem(item.medicine_id)}>
                            <Trash2 size={16} />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Checkout Sidebar */}
      <div className="pos-sidebar">
        <Card className="checkout-card h-full">
          <CardHeader title="Bill Summary" icon={<CreditCard />} />
          <CardContent className="flex flex-col h-full">
            <div className="patient-select mb-6">
              <Input 
                label="Patient ID" 
                placeholder="Enter Patient ID" 
                value={patientId}
                onChange={e => setPatientId(e.target.value)}
              />
            </div>

            <div className="summary-lines">
              <div className="summary-line">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="summary-line text-success">
                <span>Discount</span>
                <span>- ₹{totalDiscount.toFixed(2)}</span>
              </div>
              <div className="summary-line">
                <span>GST Tax</span>
                <span>+ ₹{totalTax.toFixed(2)}</span>
              </div>
              <div className="summary-line grand-total mt-4">
                <span>Net Amount</span>
                <span>₹{netAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="checkout-actions mt-auto pt-6">
              <Button 
                variant="primary" 
                size="lg" 
                fullWidth 
                icon={Printer}
                onClick={handleGenerateBill}
                isLoading={loading}
              >
                Generate Bill
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
