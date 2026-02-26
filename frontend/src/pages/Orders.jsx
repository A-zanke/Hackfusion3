import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { 
    FileText, Plus, Minus, Search, Download, Save, 
    TrendingUp, Package, Calculator, Sparkles, X, Check,
    AlertTriangle, DollarSign, Building, Phone, MapPin, User, Edit
} from 'lucide-react';
import '../App.css';

// Overlay styles for search dropdown to avoid transparency/overlap issues
const styles = {
    searchDropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
        zIndex: 9999,
        overflow: 'hidden'
    },
    searchList: {
        maxHeight: '320px',
        overflowY: 'auto',
        background: '#ffffff'
    },
    searchBackdrop: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0)',
        zIndex: 9998
    }
};

const API_BASE = 'http://localhost:5000/api';

const Orders = () => {
    // Header Information
    const [pharmacyName, setPharmacyName] = useState('MediCare Pharmacy');
    const [address, setAddress] = useState('123 Main Street, City - 110001');
    const [contactNumber, setContactNumber] = useState('+91 98765 43210');
    const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
    
    // Quotation Items
    const [quotationItems, setQuotationItems] = useState([]);
    const [medicines, setMedicines] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearch, setShowSearch] = useState(false);
    const inputRef = useRef(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const updateDropdownPos = useCallback(() => {
        if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, []);

    useEffect(() => {
        if (!showSearch) return;
        updateDropdownPos();
        const onScroll = () => updateDropdownPos();
        const onResize = () => updateDropdownPos();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
    }, [showSearch, updateDropdownPos]);
    
    // AI Recommendations
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    
    // Review Mode
    const [showReview, setShowReview] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    
    // Loading states
    const [loading, setLoading] = useState(true);
    const [savedList, setSavedList] = useState([]);

    // Fetch medicines on mount
    useEffect(() => {
        const fetchMedicines = async () => {
            try {
                const res = await axios.get(`${API_BASE}/medicines`);
                setMedicines(res.data);
            } catch (err) {
                console.error("Error fetching medicines:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMedicines();
    }, []);

    // Load saved quotations on mount
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('quotations') || '[]');
            setSavedList(Array.isArray(saved) ? saved : []);
        } catch (e) {
            setSavedList([]);
        }
    }, []);

    // Search medicines
    const handleSearch = useCallback((term) => {
        setSearchTerm(term);
        if (term.trim() === '') {
            setSearchResults([]);
            return;
        }
        
        const filtered = medicines.filter(med => 
            med.name.toLowerCase().includes(term.toLowerCase()) ||
            med.brand?.toLowerCase().includes(term.toLowerCase()) ||
            med.category?.toLowerCase().includes(term.toLowerCase())
        ).slice(0, 8);
        
        setSearchResults(filtered);
        updateDropdownPos();
    }, [medicines, updateDropdownPos]);

    // Add medicine to quotation
    const addMedicineToQuotation = (medicine) => {
        const existingItem = quotationItems.find(item => item.id === medicine.id);
        
        if (existingItem) {
            setQuotationItems(prev => prev.map(item => 
                item.id === medicine.id 
                    ? { ...item, totalPackets: item.totalPackets + 1 }
                    : item
            ));
        } else {
            const basePacketPrice = Number(
                medicine.price_per_packet ?? (
                    Number(medicine.price_per_tablet || 0) * Number(medicine.tablets_per_packet || 0)
                )
            ) || 0;
            setQuotationItems(prev => [...prev, {
                id: medicine.id,
                name: medicine.name,
                brand: medicine.brand || 'Generic',
                batchNumber: medicine.batch_number || 'BATCH001',
                totalPackets: 1,
                packetPrice: basePacketPrice,
                totalPrice: basePacketPrice * 1
            }]);
        }
        
        setSearchTerm('');
        setSearchResults([]);
        setShowSearch(false);
    };

    // Update quantity
    const updateQuantity = (id, delta) => {
        setQuotationItems(prev => prev.map(item => {
            if (item.id === id) {
                const newPackets = Math.max(1, item.totalPackets + delta);
                return {
                    ...item,
                    totalPackets: newPackets,
                    totalPrice: item.packetPrice * newPackets
                };
            }
            return item;
        }));
    };

    // Update packet price
    const updatePacketPrice = (id, newPrice) => {
        setQuotationItems(prev => prev.map(item => {
            if (item.id === id) {
                const price = parseFloat(newPrice) || 0;
                return {
                    ...item,
                    packetPrice: price,
                    totalPrice: price * item.totalPackets
                };
            }
            return item;
        }));
    };

    // Update batch number
    const updateBatchNumber = (id, batchNumber) => {
        setQuotationItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, batchNumber };
            }
            return item;
        }));
    };

    // Remove item
    const removeItem = (id) => {
        setQuotationItems(prev => prev.filter(item => item.id !== id));
    };

    // Add low stock items
    const addLowStockItems = async () => {
        try {
            const res = await axios.get(`${API_BASE}/medicines/low-stock`);
            const lowStockMedicines = res.data;
            
            lowStockMedicines.forEach(medicine => {
                addMedicineToQuotation(medicine);
            });
        } catch (err) {
            console.error("Error fetching low stock items:", err);
        }
    };

    // Generate AI suggestions
    const generateSuggestions = async () => {
        setLoadingSuggestions(true);
        try {
            const mockSuggestions = [
                {
                    id: 1,
                    name: 'Paracetamol 500mg',
                    reason: 'High demand trend - 45% increase this month',
                    priority: 'high'
                },
                {
                    id: 2,
                    name: 'Vitamin C Tablets',
                    reason: 'Seasonal demand - winter season approaching',
                    priority: 'medium'
                },
                {
                    id: 3,
                    name: 'ORS Solution',
                    reason: 'Likely to run out next month based on current usage',
                    priority: 'high'
                }
            ];
            
            setTimeout(() => {
                setSuggestions(mockSuggestions);
                setLoadingSuggestions(false);
            }, 1000);
        } catch (err) {
            console.error("Error generating suggestions:", err);
            setLoadingSuggestions(false);
        }
    };

    // Calculate totals
    const calculateTotals = () => {
        const subtotal = quotationItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const cgst = subtotal * 0.09;
        const sgst = subtotal * 0.09;
        const grandTotal = subtotal + cgst + sgst;
        return { subtotal, cgst, sgst, grandTotal };
    };

    // Compute totals for render
    const { subtotal, cgst, sgst, grandTotal } = calculateTotals();

    // Save quotation
    const saveQuotation = async () => {
        try {
            const quotationData = {
                pharmacyName,
                address,
                contactNumber,
                quotationDate,
                items: quotationItems,
                totals: calculateTotals(),
                createdAt: new Date().toISOString()
            };
            
            // Save to localStorage for demo purposes
            const savedQuotations = JSON.parse(localStorage.getItem('quotations') || '[]');
            savedQuotations.push(quotationData);
            localStorage.setItem('quotations', JSON.stringify(savedQuotations));
            setSavedList(savedQuotations);
            
            console.log('Saving quotation:', quotationData);
            alert('Quotation saved successfully! You can create a new quotation now.');
            
            // Reset form for new quotation
            setQuotationItems([]);
            setShowReview(false);
        } catch (err) {
            console.error("Error saving quotation:", err);
            alert('Error saving quotation');
        }
    };

    // Download PDF
    const downloadPDF = () => {
        const totals = calculateTotals();
        const printContent = `
            <html>
                <head>
                    <title>Quotation - ${pharmacyName}</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            margin: 20px; 
                            line-height: 1.6;
                        }
                        .header { 
                            text-align: center; 
                            margin-bottom: 30px; 
                            border-bottom: 2px solid #333;
                            padding-bottom: 20px;
                        }
                        .quotation-title {
                            font-size: 28px;
                            font-weight: bold;
                            text-transform: uppercase;
                            margin: 20px 0;
                            letter-spacing: 2px;
                        }
                        .company-info {
                            margin-bottom: 15px;
                        }
                        .company-name {
                            font-size: 18px;
                            font-weight: bold;
                            margin-bottom: 5px;
                        }
                        .company-address {
                            font-size: 14px;
                            color: #666;
                        }
                        .date-right {
                            text-align: right;
                            font-size: 14px;
                            margin-bottom: 20px;
                        }
                        .items-table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            margin-bottom: 20px; 
                        }
                        .items-table th, .items-table td { 
                            border: 1px solid #ddd; 
                            padding: 12px 8px; 
                            text-align: left; 
                        }
                        .items-table th { 
                            background-color: #f2f2f2; 
                            font-weight: bold;
                        }
                        .items-table td:nth-child(5), .items-table td:nth-child(6) {
                            text-align: right;
                        }
                        .totals { 
                            text-align: right; 
                            margin-top: 20px; 
                        }
                        .signature-section {
                            margin-top: 50px;
                            display: flex;
                            justify-content: flex-end;
                            page-break-inside: avoid;
                        }
                        .signature-block {
                            width: 300px;
                            text-align: center;
                        }
                        .signature-line {
                            border-top: 1px solid #333;
                            margin-top: 40px;
                            padding-top: 5px;
                            font-size: 12px;
                            color: #666;
                        }
                    </style>
                </head>
                <body>
                    <div class="date-right">
                        Date: ${quotationDate}
                    </div>
                    
                    <div class="company-info">
                        <div class="company-name">${pharmacyName}</div>
                        <div class="company-address">${address}</div>
                        <div>Contact: ${contactNumber}</div>
                    </div>
                    
                    <div class="header">
                        <div class="quotation-title">Quotation</div>
                    </div>
                    
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>Sr No.</th>
                                <th>Medicine Name</th>
                                <th>Brand</th>
                                <th>Batch Number</th>
                                <th>Total Packets</th>
                                <th>Packet Price</th>
                                <th>Total Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${quotationItems.map((item, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${item.name}</td>
                                    <td>${item.brand}</td>
                                    <td>${item.batchNumber}</td>
                                    <td>${item.totalPackets}</td>
                                    <td>₹${item.packetPrice.toFixed(2)}</td>
                                    <td>₹${item.totalPrice.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div class="totals" style="page-break-inside: avoid;">
                        <p><strong>Subtotal:</strong> ₹${totals.subtotal.toFixed(2)}</p>
                        <p><strong>CGST 9%:</strong> ₹${totals.cgst.toFixed(2)}</p>
                        <p><strong>SGST 9%:</strong> ₹${totals.sgst.toFixed(2)}</p>
                        <p><strong>Grand Total:</strong> ₹${totals.grandTotal.toFixed(2)}</p>
                    </div>
                    
                    <div class="signature-section">
                        <div class="signature-block">
                            <div class="signature-line">Signature</div>
                        </div>
                    </div>
                </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    };

    if (loading) {
        return (
            <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold', color: '#10b981' }}>
                    Loading Quotation System...
                </div>
            </div>
        );
    }

    if (showReview) {
        return (
            <div className="orders-page-container">
                <div className="orders-title-area">
                    <h1 className="orders-title">Review Quotation</h1>
                    <p className="orders-subtitle">Review and finalize your quotation details</p>
                </div>

                <div className="orders-grid">
                    <div className="orders-main-col">
                        <div className="orders-card animate-fade-in">
                            <div className="orders-card-header">
                                <div className="orders-card-icon icon-blue">
                                    <Package size={20} />
                                </div>
                                <h3 className="orders-card-title">Quotation Details</h3>
                            </div>

                            <div style={{ padding: '20px' }}>
                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>Pharmacy Information</h4>
                                    <div style={{ display: 'grid', gap: '8px', fontSize: '14px', color: '#64748b' }}>
                                        <div><strong>Name:</strong> {pharmacyName}</div>
                                        <div><strong>Address:</strong> {address}</div>
                                        <div><strong>Contact:</strong> {contactNumber}</div>
                                        <div><strong>Date:</strong> {quotationDate}</div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>Quotation Items</h4>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="quotation-table">
                                            <thead>
                                                <tr>
                                                    <th>Sr No.</th>
                                                    <th>Medicine Name</th>
                                                    <th>Batch Number</th>
                                                    <th>Total Packets</th>
                                                    <th>Packet Price</th>
                                                    <th>Total Price</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {quotationItems.map((item, index) => (
                                                    <tr key={item.id}>
                                                        <td style={{ textAlign: 'center', fontWeight: '600' }}>{index + 1}</td>
                                                        <td>
                                                            <div className="medicine-cell">
                                                                <div className="medicine-name">{item.name}</div>
                                                                <div className="medicine-brand">{item.brand}</div>
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>{item.batchNumber}</td>
                                                        <td style={{ textAlign: 'center' }}>{item.totalPackets}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>₹{item.packetPrice.toFixed(2)}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: '700', color: '#10b981' }}>₹{item.totalPrice.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="orders-card animate-fade-in">
                            <div className="orders-card-header">
                                <div className="orders-card-icon icon-green">
                                    <Calculator size={20} />
                                </div>
                                <h3 className="orders-card-title">Pricing Summary</h3>
                            </div>

                            <div style={{ padding: '20px' }}>
                                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '500' }}>Subtotal:</span>
                                    <span style={{ fontWeight: '700', color: '#1e293b' }}>₹{subtotal.toFixed(2)}</span>
                                </div>
                                
                                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '500' }}>CGST 9%:</span>
                                    <span style={{ fontWeight: '700', color: '#1e293b' }}>₹{cgst.toFixed(2)}</span>
                                </div>
                                
                                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '500' }}>SGST 9%:</span>
                                    <span style={{ fontWeight: '700', color: '#1e293b' }}>₹{sgst.toFixed(2)}</span>
                                </div>
                                
                                <div style={{ 
                                    height: '2px', 
                                    backgroundColor: '#e2e8f0', 
                                    margin: '20px 0' 
                                }} />
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', marginBottom: '24px' }}>
                                    <span style={{ fontWeight: '700', color: '#1e293b' }}>Grand Total:</span>
                                    <span style={{ fontWeight: '800', color: '#10b981' }}>₹{grandTotal.toFixed(2)}</span>
                                </div>

                                <div style={{ 
                                    border: '2px dashed #d1d5db', 
                                    borderRadius: '8px', 
                                    padding: '20px', 
                                    textAlign: 'center',
                                    backgroundColor: '#f9fafb'
                                }}>
                                    <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '12px' }}>Signature</p>
                                    <div style={{ 
                                        height: '60px', 
                                        border: '1px solid #e5e7eb', 
                                        borderRadius: '4px',
                                        backgroundColor: 'white'
                                    }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="orders-side-col">
                        <div className="orders-card animate-fade-in">
                            <div className="orders-card-header">
                                <div className="orders-card-icon icon-blue">
                                    <FileText size={20} />
                                </div>
                                <h3 className="orders-card-title">Actions</h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button 
                                    onClick={saveQuotation}
                                    className="orders-btn btn-green"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                >
                                    <Save size={16} /> Save Quotation
                                </button>
                                
                                <button 
                                    onClick={downloadPDF}
                                    className="orders-btn btn-blue"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                >
                                    <Download size={16} /> Download as PDF
                                </button>
                                
                                <button 
                                    onClick={() => setShowReview(false)}
                                    className="text-btn"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                >
                                    Back to Edit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style={{ 
                    textAlign: 'center', 
                    padding: '20px', 
                    color: '#94a3b8', 
                    fontSize: '12px',
                    borderTop: '1px solid #f1f5f9',
                    marginTop: '24px'
                }}>
                    <div style={{ marginBottom: '8px' }}>
                        <strong>Quotation Generated:</strong> {new Date().toLocaleDateString()}
                    </div>
                    <div>
                        <strong>Page:</strong> Review Mode | Total Items: {quotationItems.length}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="orders-page-container">
            <div className="orders-title-area">
                <h1 className="orders-title">Quotation Generator</h1>
                <p className="orders-subtitle">Create professional quotations with AI-powered recommendations</p>
            </div>

            <div className="orders-grid">
                <div className="orders-main-col">
                    <div className="orders-card animate-fade-in">
                        <div className="orders-card-header">
                            <div className="orders-card-icon icon-green">
                                <Building size={20} />
                            </div>
                            <h3 className="orders-card-title">Pharmacy Information</h3>
                        </div>
                        
                        <div style={{ display: 'grid', gap: '16px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px', display: 'block' }}>
                                    Pharmacy Name
                                </label>
                                <input
                                    type="text"
                                    value={pharmacyName}
                                    onChange={e => setPharmacyName(e.target.value)}
                                    className="orders-input"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px', display: 'block' }}>
                                    Quotation Date
                                </label>
                                <input
                                    type="date"
                                    value={quotationDate}
                                    onChange={e => setQuotationDate(e.target.value)}
                                    className="orders-input"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px', display: 'block' }}>
                                    Address
                                </label>
                                <input
                                    type="text"
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    className="orders-input"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px', display: 'block' }}>
                                    Contact Number
                                </label>
                                <input
                                    type="text"
                                    value={contactNumber}
                                    onChange={e => setContactNumber(e.target.value)}
                                    className="orders-input"
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="orders-card animate-fade-in">
                        <div className="orders-card-header">
                            <div className="orders-card-icon icon-blue">
                                <Search size={20} />
                            </div>
                            <h3 className="orders-card-title">Add Medicines</h3>
                        </div>
                        
                        <div className="orders-input-row" style={{ position: 'relative', zIndex: 50 }}>
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={e => handleSearch(e.target.value)}
                                onFocus={() => { setShowSearch(true); updateDropdownPos(); }}
                                placeholder="Search medicines by name, brand, or category..."
                                className="orders-input"
                            />
                            <button 
                                onClick={addLowStockItems}
                                className="orders-btn btn-orange"
                                style={{ position: 'relative', zIndex: 50 }}
                            >
                                <AlertTriangle size={16} /> Add Low Stock
                            </button>

                            {showSearch && searchResults.length > 0 && (
                                ReactDOM.createPortal(
                                    <>
                                        <div
                                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0)', zIndex: 99998 }}
                                            onClick={() => setShowSearch(false)}
                                        />
                                        <div
                                            className="search-results-container"
                                            style={{
                                                position: 'absolute',
                                                top: dropdownPos.top,
                                                left: dropdownPos.left,
                                                width: dropdownPos.width,
                                                background: '#ffffff',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                boxShadow: '0 20px 60px rgba(15,23,42,0.2), 0 2px 10px rgba(15,23,42,0.08)',
                                                zIndex: 99999,
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <div className="search-dropdown-list" style={{ maxHeight: '360px', overflowY: 'auto', padding: '6px' }}>
                                                {searchResults.map(med => (
                                                    <div
                                                        key={med.id}
                                                        onClick={() => {
                                                            addMedicineToQuotation(med);
                                                            setShowSearch(false);
                                                        }}
                                                        className="search-dropdown-item-enhanced"
                                                        style={{
                                                            padding: '12px 14px',
                                                            cursor: 'pointer',
                                                            borderBottom: '1px solid #f1f5f9',
                                                            transition: 'background 0.2s ease',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '12px',
                                                            background: 'white'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                                                    >
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{
                                                                fontWeight: 700,
                                                                color: '#0f172a',
                                                                fontSize: '14px',
                                                                marginBottom: '2px',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}>{med.name}</div>
                                                            <div style={{
                                                                fontSize: '12px',
                                                                color: '#64748b',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}>{med.brand}</div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', minWidth: '100px' }}>
                                                            {med.category && (
                                                                <div style={{
                                                                    fontSize: '11px',
                                                                    color: '#10b981',
                                                                    background: '#ecfdf5',
                                                                    padding: '3px 8px',
                                                                    borderRadius: '9999px',
                                                                    fontWeight: 700
                                                                }}>{med.category}</div>
                                                            )}
                                                            <div style={{ fontSize: '12px', color: '#f97316', fontWeight: 700 }}>
                                                                ₹{med.price_per_tablet}/tablet
                                                            </div>
                                                        </div>
                                                        <div style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '6px',
                                                            background: '#10b981',
                                                            color: 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            <Plus size={14} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>,
                                    document.body
                                )
                            )}
                        </div>
                        <div className="orders-recent-header">
                            <div className="orders-card-title" style={{ gap: '12px' }}>
                                <div className="orders-card-icon icon-green">
                                    <Package size={20} />
                                </div>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    Quotation Items
                                    <span className="orders-badge">{quotationItems.length}</span>
                                </span>
                            </div>
                        </div>

                        {quotationItems.length === 0 ? (
                            <div style={{ 
                                padding: '40px', 
                                textAlign: 'center', 
                                color: '#94a3b8',
                                fontStyle: 'italic',
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                No items added yet. Search for medicines or add low stock items to get started.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto', flex: 1, padding: '16px' }}>
                                <table className="quotation-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}>#</th>
                                            <th>Medicine Details</th>
                                            <th style={{ width: '120px' }}>Batch No</th>
                                            <th style={{ width: '100px' }}>Packets</th>
                                            <th style={{ width: '120px' }}>Packet Price</th>
                                            <th style={{ width: '120px' }}>Total Price</th>
                                            <th style={{ width: '80px' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {quotationItems.map((item, index) => (
                                            <tr key={item.id} style={{ 
                                                backgroundColor: '#ffffff',
                                                borderBottom: '1px solid #f1f5f9',
                                                transition: 'background-color 0.2s ease'
                                            }}>
                                                <td style={{ textAlign: 'center', fontWeight: '600', color: '#64748b' }}>
                                                    {index + 1}
                                                </td>
                                                <td>
                                                    <div className="medicine-cell" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <div className="medicine-name" style={{ 
                                                            fontWeight: '700', 
                                                            color: '#1e293b', 
                                                            fontSize: '14px' 
                                                        }}>
                                                            {item.name}
                                                        </div>
                                                        <div className="medicine-brand" style={{ 
                                                            fontSize: '12px', 
                                                            color: '#64748b',
                                                            padding: '2px 8px',
                                                            backgroundColor: '#f8fafc',
                                                            borderRadius: '4px',
                                                            display: 'inline-block',
                                                            border: '1px solid #e2e8f0'
                                                        }}>
                                                            {item.brand || 'Generic'}
                                                        </div>
                                                        {item.tablets_per_packet && (
                                                            <div className="medicine-desc" style={{ 
                                                                fontSize: '11px', 
                                                                color: '#94a3b8',
                                                                marginTop: '2px'
                                                            }}>
                                                                {item.tablets_per_packet} tablets per packet
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={item.batchNumber}
                                                        onChange={(e) => updateBatchNumber(item.id, e.target.value)}
                                                        className="table-input"
                                                        placeholder="Batch No"
                                                        style={{ 
                                                            fontSize: '12px', 
                                                            padding: '6px 8px',
                                                            textAlign: 'center'
                                                        }}
                                                    />
                                                </td>
                                                <td>
                                                    <div className="quantity-controls" style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center', 
                                                        gap: '6px' 
                                                    }}>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, -1)}
                                                            className="quantity-btn"
                                                            style={{ 
                                                                width: '24px', 
                                                                height: '24px', 
                                                                borderRadius: '4px',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            <Minus size={12} />
                                                        </button>
                                                        <span className="quantity-value" style={{ 
                                                            fontWeight: '700', 
                                                            color: '#1e293b', 
                                                            minWidth: '30px', 
                                                            textAlign: 'center', 
                                                            fontSize: '13px' 
                                                        }}>
                                                            {item.totalPackets}
                                                        </span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, 1)}
                                                            className="quantity-btn"
                                                            style={{ 
                                                                width: '24px', 
                                                                height: '24px', 
                                                                borderRadius: '4px',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ color: '#64748b', fontSize: '12px' }}>₹</span>
                                                        <input
                                                            type="number"
                                                            value={item.packetPrice}
                                                            onChange={(e) => updatePacketPrice(item.id, e.target.value)}
                                                            className="table-input price-input"
                                                            step="0.01"
                                                            min="0"
                                                            style={{ 
                                                                fontWeight: '600', 
                                                                color: '#1e293b',
                                                                fontSize: '13px',
                                                                padding: '6px 8px',
                                                                textAlign: 'right'
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="total-price-cell" style={{ 
                                                    fontWeight: '800', 
                                                    color: '#10b981', 
                                                    fontSize: '14px',
                                                    textAlign: 'right'
                                                }}>
                                                    ₹{Number(item.totalPrice || 0).toFixed(2)}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                        <button
                                                            onClick={() => {
                                                                // Edit functionality - could open a modal or inline edit
                                                                const newName = prompt('Edit medicine name:', item.name);
                                                                if (newName && newName !== item.name) {
                                                                    setQuotationItems(prev => prev.map(i => 
                                                                        i.id === item.id ? { ...i, name: newName } : i
                                                                    ));
                                                                }
                                                            }}
                                                            className="action-icon-btn"
                                                            style={{ 
                                                                width: '28px', 
                                                                height: '28px', 
                                                                borderRadius: '4px',
                                                                backgroundColor: '#eff6ff',
                                                                color: '#3b82f6',
                                                                border: '1px solid #dbeafe'
                                                            }}
                                                            title="Edit item"
                                                        >
                                                            <Edit size={12} />
                                                        </button>
                                                        <button
                                                            onClick={() => removeItem(item.id)}
                                                            className="remove-btn"
                                                            style={{ 
                                                                width: '28px', 
                                                                height: '28px', 
                                                                borderRadius: '4px',
                                                                backgroundColor: '#fef2f2',
                                                                color: '#ef4444',
                                                                border: '1px solid #fee2e2'
                                                            }}
                                                            title="Remove item"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <div className="orders-side-col">
                    <div className="orders-card animate-fade-in">
                        <div className="orders-card-header">
                            <div className="orders-card-icon icon-blue">
                                <FileText size={20} />
                            </div>
                            <h3 className="orders-card-title">Saved Quotations</h3>
                        </div>
                        {savedList.length === 0 ? (
                            <div style={{ padding: '16px', color: '#94a3b8', fontStyle: 'italic' }}>
                                No quotations saved yet.
                            </div>
                        ) : (
                            <div style={{ padding: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                                {savedList.map((q, i) => {
                                    const totals = q.totals || { grandTotal: 0 };
                                    return (
                                        <div key={i} style={{
                                            padding: '12px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            marginBottom: '8px',
                                            backgroundColor: '#f8fafc'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                                                    {q.pharmacyName}
                                                </div>
                                                <div style={{ fontWeight: '700', color: '#10b981', fontSize: '14px' }}>
                                                    ₹{Number(totals.grandTotal || 0).toFixed(2)}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                                                {new Date(q.createdAt || q.quotationDate || Date.now()).toLocaleDateString()} • {(q.items || []).length} items
                                            </div>
                                            <button
                                                className="orders-btn btn-blue"
                                                onClick={() => {
                                                    setPharmacyName(q.pharmacyName || '');
                                                    setAddress(q.address || '');
                                                    setContactNumber(q.contactNumber || '');
                                                    setQuotationDate((q.quotationDate || '').slice(0,10) || new Date().toISOString().split('T')[0]);
                                                    setQuotationItems((q.items || []).map((it, idx) => ({
                                                        id: it.id ?? idx + 1,
                                                        name: it.name,
                                                        brand: it.brand,
                                                        batchNumber: it.batchNumber || 'BATCH001',
                                                        totalPackets: Number(it.totalPackets || 1),
                                                        packetPrice: Number(it.packetPrice || 0),
                                                        totalPrice: Number(it.totalPrice || 0)
                                                    })));
                                                    setShowReview(true);
                                                }}
                                                style={{ padding: '4px 8px', fontSize: '12px', width: '100%' }}
                                            >
                                                Open Quotation
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="orders-card animate-fade-in">
                        <div className="orders-card-header">
                            <div className="orders-card-icon icon-orange">
                                <Sparkles size={20} />
                            </div>
                            <h3 className="orders-card-title">AI Suggestions</h3>
                        </div>
                        
                        <button 
                            onClick={generateSuggestions}
                            disabled={loadingSuggestions}
                            className="orders-btn btn-blue"
                            style={{ width: '100%', marginBottom: '16px', justifyContent: 'center' }}
                        >
                            {loadingSuggestions ? 'Analyzing...' : <><TrendingUp size={16} /> Generate Suggestions</>}
                        </button>

                        {suggestions.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {suggestions.map(suggestion => (
                                    <div key={suggestion.id} style={{ 
                                        padding: '12px', 
                                        border: '1px solid #e2e8f0', 
                                        borderRadius: '8px',
                                        backgroundColor: '#f8fafc'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                            <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                                                {suggestion.name}
                                            </div>
                                            {suggestion.priority === 'high' && (
                                                <span style={{ 
                                                    padding: '2px 6px', 
                                                    backgroundColor: '#fef2f2', 
                                                    color: '#dc2626', 
                                                    fontSize: '10px', 
                                                    fontWeight: '700', 
                                                    borderRadius: '4px' 
                                                }}>
                                                    HIGH
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                                            {suggestion.reason}
                                        </div>
                                        <button
                                            onClick={() => {
                                                const medicine = medicines.find(m => m.name === suggestion.name);
                                                if (medicine) addMedicineToQuotation(medicine);
                                            }}
                                            className="orders-btn btn-green"
                                            style={{ padding: '4px 8px', fontSize: '12px' }}
                                        >
                                            <Plus size={12} /> Add
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="orders-card animate-fade-in">
                        <div className="orders-card-header">
                            <div className="orders-card-icon icon-green">
                                <DollarSign size={20} />
                            </div>
                            <h3 className="orders-card-title">Summary</h3>
                        </div>
                        
                        <div style={{ padding: '16px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ color: '#64748b', fontSize: '14px' }}>Items:</span>
                                <span style={{ fontWeight: '600', color: '#1e293b' }}>{quotationItems.length}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ color: '#64748b', fontSize: '14px' }}>Subtotal:</span>
                                <span style={{ fontWeight: '600', color: '#1e293b' }}>₹{subtotal.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <span style={{ color: '#64748b', fontSize: '14px' }}>Grand Total:</span>
                                <span style={{ fontWeight: '700', color: '#10b981', fontSize: '16px' }}>₹{grandTotal.toFixed(2)}</span>
                            </div>
                            
                            <button 
                                onClick={() => setShowReview(true)}
                                disabled={quotationItems.length === 0}
                                className="orders-btn btn-green"
                                style={{ width: '100%', justifyContent: 'center' }}
                            >
                                <Check size={16} /> Review Quotation
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ 
                textAlign: 'center', 
                padding: '20px', 
                color: '#94a3b8', 
                fontSize: '12px',
                borderTop: '1px solid #f1f5f9',
                marginTop: '24px'
            }}>
                <div style={{ marginBottom: '8px' }}>
                    <strong>Quotation Generated:</strong> {new Date().toLocaleDateString()}
                </div>
                <div>
                    <strong>Page:</strong> Generator | Total Items: {quotationItems.length}
                </div>
            </div>
        </div>
    );
};

export default Orders;
