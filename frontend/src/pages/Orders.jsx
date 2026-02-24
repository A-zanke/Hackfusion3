import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
    FileText, Plus, Minus, Search, Download, Save, 
    TrendingUp, Package, Calculator, Sparkles, X, Check,
    AlertTriangle, DollarSign, Building, Phone, MapPin, User
} from 'lucide-react';
import '../App.css';

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
    
    // AI Recommendations
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    
    // Review Mode
    const [showReview, setShowReview] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    
    // Loading states
    const [loading, setLoading] = useState(true);

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
        ).slice(0, 5);
        
        setSearchResults(filtered);
    }, [medicines]);

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
            setQuotationItems(prev => [...prev, {
                id: medicine.id,
                name: medicine.name,
                brand: medicine.brand || 'Generic',
                batchNumber: medicine.batch_number || 'BATCH001',
                totalPackets: 1,
                packetPrice: medicine.price_per_packet || (medicine.price_per_tablet * medicine.tablets_per_packet) || 0,
                totalPrice: (medicine.price_per_packet || (medicine.price_per_tablet * medicine.tablets_per_packet) || 0) * 1
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
        const gst1 = subtotal * 0.09;
        const gst2 = subtotal * 0.09;
        const grandTotal = subtotal + gst1 + gst2;
        return { subtotal, gst1, gst2, grandTotal };
    };

    // Compute totals for render
    const { subtotal, gst1, gst2, grandTotal } = calculateTotals();

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
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .pharmacy-info { margin-bottom: 20px; }
                        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        .items-table th { background-color: #f2f2f2; }
                        .totals { text-align: right; margin-top: 20px; }
                        .signature { margin-top: 40px; border-top: 1px dashed #ccc; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>QUOTATION</h1>
                        <p>Date: ${quotationDate}</p>
                    </div>
                    
                    <div class="pharmacy-info">
                        <h2>${pharmacyName}</h2>
                        <p>${address}</p>
                        <p>Contact: ${contactNumber}</p>
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
                    
                    <div class="totals">
                        <p><strong>Subtotal:</strong> ₹${totals.subtotal.toFixed(2)}</p>
                        <p><strong>GST 9%:</strong> ₹${totals.gst1.toFixed(2)}</p>
                        <p><strong>GST 9%:</strong> ₹${totals.gst2.toFixed(2)}</p>
                        <p><strong>Grand Total:</strong> ₹${totals.grandTotal.toFixed(2)}</p>
                    </div>
                    
                    <div class="signature">
                        <p>Signature:</p>
                        <div style="height: 60px; border: 1px solid #ccc; margin-top: 10px;"></div>
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
                                    <span style={{ color: '#64748b', fontWeight: '500' }}>GST 9%:</span>
                                    <span style={{ fontWeight: '700', color: '#1e293b' }}>₹{gst1.toFixed(2)}</span>
                                </div>
                                
                                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '500' }}>GST 9%:</span>
                                    <span style={{ fontWeight: '700', color: '#1e293b' }}>₹{gst2.toFixed(2)}</span>
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
                                type="text"
                                value={searchTerm}
                                onChange={e => handleSearch(e.target.value)}
                                onFocus={() => setShowSearch(true)}
                                onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                                placeholder="Search medicines by name, brand, or category..."
                                className="orders-input"
                                style={{ position: 'relative', zIndex: 51 }}
                            />
                            <button 
                                onClick={addLowStockItems}
                                className="orders-btn btn-orange"
                                style={{ position: 'relative', zIndex: 50 }}
                            >
                                <AlertTriangle size={16} /> Add Low Stock
                            </button>

                            {showSearch && searchResults.length > 0 && (
                                <div className="search-dropdown-below-input">
                                    <div className="search-dropdown-header">
                                        <Search size={16} className="search-icon" />
                                        <span>Search Results</span>
                                    </div>
                                    <div className="search-dropdown-list">
                                        {searchResults.map(med => (
                                            <div
                                                key={med.id}
                                                onClick={() => addMedicineToQuotation(med)}
                                                className="search-dropdown-item-enhanced"
                                            >
                                                <div className="search-item-main">
                                                    <div className="search-item-name-enhanced">{med.name}</div>
                                                    <div className="search-item-brand">{med.brand}</div>
                                                </div>
                                                <div className="search-item-meta">
                                                    <div className="search-item-category">{med.category}</div>
                                                    <div className="search-item-price">₹{med.price_per_tablet}/tablet</div>
                                                </div>
                                                <div className="search-item-add">
                                                    <Plus size={14} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {!showSearch && searchResults.length === 0 && (
                    <div className="orders-recent-card animate-fade-in">
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
                                fontStyle: 'italic'
                            }}>
                                No items added yet. Search for medicines or add low stock items to get started.
                            </div>
                        ) : (
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
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {quotationItems.map((item, index) => (
                                            <tr key={item.id}>
                                                <td>{index + 1}</td>
                                                <td>
                                                    <div className="medicine-cell">
                                                        <div className="medicine-name">{item.name}</div>
                                                        <div className="medicine-brand">{item.brand}</div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={item.batchNumber}
                                                        onChange={(e) => updateBatchNumber(item.id, e.target.value)}
                                                        className="table-input"
                                                        placeholder="Batch No"
                                                    />
                                                </td>
                                                <td>
                                                    <div className="quantity-controls">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, -1)}
                                                            className="quantity-btn"
                                                        >
                                                            <Minus size={14} />
                                                        </button>
                                                        <span className="quantity-value">{item.totalPackets}</span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, 1)}
                                                            className="quantity-btn"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        value={item.packetPrice}
                                                        onChange={(e) => updatePacketPrice(item.id, e.target.value)}
                                                        className="table-input price-input"
                                                        step="0.01"
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="total-price-cell">
                                                    ₹{item.totalPrice.toFixed(2)}
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="remove-btn"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    )}
                </div>

                <div className="orders-side-col">
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
                Page {currentPage}
            </div>
        </div>
    );
};

export default Orders;
