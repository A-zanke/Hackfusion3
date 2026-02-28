import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Plus, Package, ChevronDown, Filter, Trash2, CheckSquare, Square } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import AddStockModal from '../components/AddStockModal';
import EditMedicineModal from '../components/EditMedicineModal';
import '../App.css';

const API_BASE = 'http://localhost:5000/api';

const Inventory = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);      // true only on FIRST load
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [showAddStockModal, setShowAddStockModal] = useState(false);
    const [toast, setToast] = useState(null);          // { text, type }
    const toastTimerRef = useRef(null);
    const isFirstLoad = useRef(true);
    const [activeDropdown, setActiveDropdown] = useState(null); // Track which dropdown is open
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingMedicine, setEditingMedicine] = useState(null);
    const [advFilters, setAdvFilters] = useState({
        brand: '',
        category: '',
        productId: '',
        expiryStart: '',
        expiryEnd: '',
        prescriptionRequired: '',
        lowStockRange: ''
    });

    const showToast = useCallback((text, type = 'success') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ text, type });
        toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    }, []);

    // Silent background refresh — does NOT trigger full-page loader
    const fetchMedicines = useCallback(async (silent = false, filterType = null) => {
        try {
            console.log('Fetching medicines with filter:', filterType || 'all');
            if (!silent) setLoading(true);
            
            // Use the new inventory API with filtering
            let url = `${API_BASE}/inventory`;
            if (filterType) {
                url += `?filter=${filterType}`;
            }
            
            console.log('API call to:', url);
            const res = await axios.get(url);
            console.log('API response:', res.data);
            setMedicines(res.data);
        } catch (err) {
            console.error("Error fetching medicines:", err);
            console.error("Error details:", err.response?.data || err.message);
        } finally {
            if (!silent) setLoading(false);
            isFirstLoad.current = false;
        }
    }, []);

    // Get filter from URL on component mount
    useEffect(() => {
        console.log('=== INVENTORY COMPONENT MOUNTED ===');
        console.log('Current location:', location.search);
        console.log('Current filter state:', filter);
        
        const urlParams = new URLSearchParams(location.search);
        const urlFilter = urlParams.get('filter');
        
        console.log('URL filter found:', urlFilter);
        
        if (urlFilter && ['expired', 'expiring', 'lowstock'].includes(urlFilter)) {
            console.log('Setting filter from URL:', urlFilter);
            setFilter(urlFilter);
            fetchMedicines(false, urlFilter);
        } else {
            console.log('No valid filter in URL, fetching all medicines');
            fetchMedicines(false);
        }
        
        const interval = setInterval(() => fetchMedicines(true, filter), 60000); // background silent refresh
        return () => {
            clearInterval(interval);
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, [fetchMedicines, filter, location.search]);

    // Update filter when changed
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const currentFilter = urlParams.get('filter');
        
        console.log('Filter changed to:', filter, 'Current URL filter:', currentFilter);
        
        if (filter !== currentFilter) {
            // Update URL without page reload using React Router
            const newUrl = filter ? `/inventory?filter=${filter}` : '/inventory';
            console.log('Navigating to:', newUrl);
            navigate(newUrl, { replace: true });
            
            // Fetch medicines with new filter
            fetchMedicines(false, filter);
        }
    }, [filter, fetchMedicines, navigate, location.search]);

    // Called by AddStockModal after successful add
    const handleStockAdded = useCallback(() => {
        fetchMedicines(true, filter);   // silent refresh, no spinner
        showToast('Stock added successfully!', 'success');
        
        // Trigger dashboard stats refresh (event-based approach)
        window.dispatchEvent(new CustomEvent('refreshDashboardStats'));
    }, [fetchMedicines, showToast, filter]);

    // Called by EditMedicineModal after successful update
    const handleMedicineUpdated = useCallback(() => {
        fetchMedicines(true, filter);   // silent refresh, no spinner
        showToast('✅ Medicine updated successfully!', 'success');
        
        // Trigger dashboard stats refresh
        window.dispatchEvent(new CustomEvent('refreshDashboardStats'));
    }, [fetchMedicines, showToast, filter]);

    const handleSoftDelete = async (ids) => {
        if (!window.confirm(`Move ${ids.length} item(s) to bin?`)) return;
        try {
            await axios.post(`${API_BASE}/medicines/soft-delete`, { ids });
            setSelectedIds([]);
            fetchMedicines(true, filter);
            
            // Trigger dashboard stats refresh
            window.dispatchEvent(new CustomEvent('refreshDashboardStats'));
        } catch (err) {
            console.error("Error moving to bin:", err);
        }
    };

    // Handle individual medicine edit
    const handleEditMedicine = (medicine) => {
        setEditingMedicine(medicine);
        setShowEditModal(true);
        setActiveDropdown(null);
    };

    // Handle individual medicine delete
    const handleDeleteMedicine = async (medicine) => {
        if (!window.confirm(`Are you sure you want to delete "${medicine.name}"?`)) return;
        try {
            await axios.post(`${API_BASE}/medicines/soft-delete`, { ids: [medicine.id] });
            fetchMedicines(true, filter);
            showToast('🗑️ Medicine deleted successfully!', 'success');
            setActiveDropdown(null);
            
            // Trigger dashboard stats refresh
            window.dispatchEvent(new CustomEvent('refreshDashboardStats'));
        } catch (err) {
            console.error("Error deleting medicine:", err);
            showToast('❌ Failed to delete medicine', 'error');
        }
    };

    // Toggle dropdown menu
    const toggleDropdown = (medicineId, event) => {
        if (activeDropdown === medicineId) {
            setActiveDropdown(null);
        } else {
            setActiveDropdown(medicineId);
            // Store button position for dropdown placement
            const rect = event.currentTarget.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY + 4,
                right: window.innerWidth - rect.right
            });
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filtered.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filtered.map(m => m.id));
        }
    };

    const getDaysToExpiry = (date) => {
        if (!date) return null;
        return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
    };

    const formatExpiryDisplay = (days) => {
        if (days === null) return null;
        if (days <= 0) return 'Expired';

        if (days <= 15) {
            return `${days} days`;
        }

        if (days <= 30) {
            return '30 days';
        }

        if (days <= 60) {
            return '2 months';
        }

        if (days <= 90) {
            return '3 months';
        }

        if (days <= 180) {
            return '6 months';
        }

        if (days <= 365) {
            return '1 year';
        }

        const years = Math.floor(days / 365);
        return `${years} year${years > 1 ? 's' : ''}`;
    };

    const filtered = medicines.filter(med => {
        // Multi-field search
        const s = searchTerm.toLowerCase();
        const matchesSearch =
            med.name.toLowerCase().includes(s) ||
            (med.product_id_str && med.product_id_str.toLowerCase().includes(s)) ||
            (med.category && med.category.toLowerCase().includes(s)) ||
            (med.brand && med.brand.toLowerCase().includes(s)) ||
            (med.description && med.description.toLowerCase().includes(s));

        // Advanced filters
        const matchesBrand = !advFilters.brand || (med.brand && med.brand.toLowerCase().includes(advFilters.brand.toLowerCase()));
        const matchesCat = !advFilters.category || (med.category && med.category.toLowerCase().includes(advFilters.category.toLowerCase()));
        const matchesID = !advFilters.productId || (med.product_id_str && med.product_id_str.toLowerCase().includes(advFilters.productId.toLowerCase()));
        const matchesPrescription = !advFilters.prescriptionRequired ||
            (advFilters.prescriptionRequired === 'required' && med.prescription_required) ||
            (advFilters.prescriptionRequired === 'not-required' && !med.prescription_required) ||
            (advFilters.prescriptionRequired === 'below-30' && med.total_tablets < 30);

        // Low stock range filter
        let matchesLowStockRange = true;
        if (advFilters.lowStockRange) {
            const threshold = parseInt(advFilters.lowStockRange);
            if (!isNaN(threshold)) {
                matchesLowStockRange = med.total_tablets < threshold;
            }
        }

        // Expiry range filter
        let matchesExpiry = true;
        if (advFilters.expiryStart || advFilters.expiryEnd) {
            if (!med.expiry_date) matchesExpiry = false;
            else {
                const medDate = new Date(med.expiry_date);
                if (advFilters.expiryStart) matchesExpiry = matchesExpiry && medDate >= new Date(advFilters.expiryStart);
                if (advFilters.expiryEnd) matchesExpiry = matchesExpiry && medDate <= new Date(advFilters.expiryEnd);
            }
        }

        const matchesAdvanced = matchesBrand && matchesCat && matchesID && matchesExpiry && matchesPrescription && matchesLowStockRange;

        if (filter === 'low') return matchesSearch && matchesAdvanced && med.total_tablets < 200;
        if (filter === 'expiring') {
            const days = getDaysToExpiry(med.expiry_date);
            return matchesSearch && matchesAdvanced && days !== null && days <= 30;
        }
        return matchesSearch && matchesAdvanced;
    });

    if (loading && isFirstLoad.current) {
        return (
            <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold', color: '#10b981' }}>
                    Loading Inventory...
                </div>
            </div>
        );
    }

    return (
        <div className="inv-page-container" onClick={() => setActiveDropdown(null)}>
            {/* Global Toast Notification */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    top: '24px',
                    right: '24px',
                    zIndex: 99999,
                    background: toast.type === 'success' ? '#16a34a' : '#dc2626',
                    color: '#fff',
                    padding: '14px 22px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                    fontSize: '15px',
                    fontWeight: 600,
                    minWidth: '280px',
                    animation: 'slideInRight 0.35s cubic-bezier(0.16,1,0.3,1)'
                }}>
                    <span style={{ fontSize: '20px' }}>{toast.type === 'success' ? '✅' : '❌'}</span>
                    {toast.text}
                    <button
                        onClick={() => setToast(null)}
                        style={{
                            marginLeft: 'auto',
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: 1
                        }}
                    >×</button>
                </div>
            )}
            {/* Search & Filters */}
            <div className="inv-controls-area">
                <div style={{ display: 'flex', flex: 1, gap: '12px' }}>
                    <div className="inv-search-box" style={{ flex: 1 }}>
                        <Search size={16} style={{ color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Search by name or description..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="inv-search-input"
                        />
                    </div>
                    <button
                        className={`inv-filter-btn ${showAdvanced ? 'active' : ''}`}
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        title="Advanced Filters"
                    >
                        <Filter size={16} />
                    </button>
                    <button className="inv-add-btn" onClick={() => setShowAddStockModal(true)}>
                        <Plus size={14} /> Add Stock
                    </button>
                </div>

                <div className="inv-filters">
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'lowstock', label: '⚠ Low Stock' },
                        { key: 'expiring', label: '⏳ Expiring This Month' },
                        { key: 'expired', label: '❌ Expired' },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`inv-filter-btn ${filter === f.key ? 'active' : ''}`}
                        >
                            {f.label}
                        </button>
                    ))}

                    <button
                        className={`inv-filter-btn ${selectionMode ? 'active' : ''}`}
                        onClick={() => {
                            setSelectionMode(!selectionMode);
                            if (selectionMode) setSelectedIds([]);
                        }}
                    >
                        {selectionMode ? 'Select ON' : 'Select'}
                    </button>

                    {selectedIds.length > 0 && (
                        <button
                            className="inv-add-btn"
                            style={{ backgroundColor: '#ef4444' }}
                            onClick={() => handleSoftDelete(selectedIds)}
                        >
                            <Trash2 size={14} /> Move to Bin ({selectedIds.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Advanced Filters Panel */}
            {showAdvanced && (
                <div className="adv-filter-panel animate-fade-in">
                    <div className="adv-filter-grid">
                        <div className="adv-input-group">
                            <label>Product ID</label>
                            <input
                                type="text"
                                placeholder="P-123..."
                                value={advFilters.productId}
                                onChange={e => setAdvFilters({ ...advFilters, productId: e.target.value })}
                            />
                        </div>
                        <div className="adv-input-group">
                            <label>Brand</label>
                            <input
                                type="text"
                                placeholder="Filter by brand..."
                                value={advFilters.brand}
                                onChange={e => setAdvFilters({ ...advFilters, brand: e.target.value })}
                            />
                        </div>
                        <div className="adv-input-group">
                            <label>Category</label>
                            <input
                                type="text"
                                placeholder="Filter by category..."
                                value={advFilters.category}
                                onChange={e => setAdvFilters({ ...advFilters, category: e.target.value })}
                            />
                        </div>
                        <div className="adv-input-group">
                            <label>Expiry From</label>
                            <input
                                type="date"
                                value={advFilters.expiryStart}
                                onChange={e => setAdvFilters({ ...advFilters, expiryStart: e.target.value })}
                            />
                        </div>
                        <div className="adv-input-group">
                            <label>Expiry To</label>
                            <input
                                type="date"
                                value={advFilters.expiryEnd}
                                onChange={e => setAdvFilters({ ...advFilters, expiryEnd: e.target.value })}
                            />
                        </div>
                        <div className="adv-input-group">
                            <label>Prescription</label>
                            <select
                                value={advFilters.prescriptionRequired}
                                onChange={e => setAdvFilters({ ...advFilters, prescriptionRequired: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: '1.5px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    color: '#1e293b',
                                    background: '#fff',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    appearance: 'auto'
                                }}
                            >
                                <option value="">All</option>
                                <option value="required">Required</option>
                                <option value="not-required">Not Required</option>
                                <option value="below-30">Below 30 Tablets</option>
                            </select>
                        </div>
                        {filter === 'low' && (
                            <div className="adv-input-group">
                                <label>Low Stock Below</label>
                                <input
                                    type="number"
                                    placeholder="e.g., 10, 20, 50..."
                                    value={advFilters.lowStockRange}
                                    onChange={e => setAdvFilters({ ...advFilters, lowStockRange: e.target.value })}
                                    min="1"
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1.5px solid #10b981',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                        backgroundColor: '#f0fdf4'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#10b981';
                                        e.target.style.backgroundColor = '#f0fdf4';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = '#10b981';
                                        e.target.style.backgroundColor = '#f0fdf4';
                                    }}
                                />
                            </div>
                        )}
                        <div className="adv-input-group" style={{ justifyContent: 'flex-end', paddingTop: '20px' }}>
                            <button
                                className="text-btn"
                                onClick={() => setAdvFilters({ brand: '', category: '', productId: '', expiryStart: '', expiryEnd: '', prescriptionRequired: '', lowStockRange: '' })}
                            >
                                Reset Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="inv-table-card animate-fade-in">
                <div className="inv-table-wrapper">
                    <table className="inv-table">
                        <thead>
                            <tr>
                                {selectionMode && (
                                    <th style={{ width: '40px' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filtered.length && filtered.length > 0}
                                            onChange={toggleSelectAll}
                                            className="header-checkbox"
                                        />
                                    </th>
                                )}
                                {['MEDICINE', 'PACKETS', 'TAB/PKT', 'TOTAL TABLETS', 'UNIT PRICE', 'STATUS', 'BRAND', 'PRESCRIPTION', ...(filter === 'expiring' ? ['EXPIRY'] : [])].map((h, i) => (
                                    <th key={i} className={i >= 4 ? 'inv-col-center' : ''}>
                                        {h}
                                    </th>
                                ))}
                                {selectionMode && <th></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((med, index) => {
                                const isLowStock = med.total_tablets < med.low_stock_threshold;
                                const daysToExpiry = getDaysToExpiry(med.expiry_date);
                                const isNearExpiry = daysToExpiry !== null && daysToExpiry <= 60;

                                return (
                                    <tr
                                        key={med.id}
                                        className={`animate-fade-in ${selectedIds.includes(med.id) ? 'row-selected' : ''}`}
                                        style={{ animationDelay: `${index * 0.03}s` }}
                                        onClick={() => toggleSelect(med.id)}
                                    >
                                        {selectionMode && (
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(med.id)}
                                                    onChange={() => toggleSelect(med.id)}
                                                />
                                            </td>
                                        )}
                                        <td>
                                            <div className="inv-med-cell">
                                                <div className="inv-med-icon stat-green">
                                                    <Package size={16} />
                                                </div>
                                                <div className="inv-med-info">
                                                    <p className="inv-med-name">{med.name}</p>
                                                    <p className="inv-med-desc">{med.product_id_str || 'No ID'} · {med.category}</p>
                                                    {searchTerm && med.description && (
                                                        <p className="inv-med-description">{med.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="inv-col-center inv-col-number">{med.stock_packets}</td>
                                        <td className="inv-col-center inv-col-number">{med.tablets_per_packet}</td>
                                        <td className="inv-col-center inv-col-bold">{med.total_tablets}</td>
                                        <td className="inv-col-center inv-col-price">₹{Number(med.price_per_tablet).toFixed(2)}</td>
                                        <td className="inv-col-center">
                                            <StatusBadge variant={isLowStock ? 'low' : 'stable'} />
                                        </td>
                                        <td className="inv-col-center">
                                            <span className="brand-badge">{med.brand || 'Generic'}</span>
                                        </td>
                                        <td className="inv-col-center">
                                            {med.prescription_required ? (
                                                <span className="status-badge status-badge-urgent">YES</span>
                                            ) : (
                                                <span className="status-badge status-badge-valid">NO</span>
                                            )}
                                        </td>
                                        {filter === 'expiring' && (
                                            <td className="inv-col-center">
                                                {daysToExpiry !== null ? (
                                                    <span className={`status-badge ${daysToExpiry <= 15 ? 'status-badge-urgent' :
                                                        daysToExpiry <= 30 ? 'status-badge-low' :
                                                            'status-badge-valid'
                                                        }`}>
                                                        {formatExpiryDisplay(daysToExpiry)}
                                                    </span>
                                                ) : (
                                                    <StatusBadge variant="valid" text="Valid" />
                                                )}
                                            </td>
                                        )}
                                        <td>
                                            {!selectionMode && (
                                                <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={(e) => toggleDropdown(med.id, e)}
                                                        style={{
                                                            background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                                                            border: '1px solid #cbd5e1',
                                                            cursor: 'pointer',
                                                            padding: '8px 12px',
                                                            borderRadius: '10px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2)',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                                            position: 'relative',
                                                            overflow: 'hidden'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.target.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                                                            e.target.style.borderColor = '#10b981';
                                                            e.target.style.transform = 'scale(1.05)';
                                                            e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.target.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
                                                            e.target.style.borderColor = '#cbd5e1';
                                                            e.target.style.transform = 'scale(1)';
                                                            e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                                                        }}
                                                    >
                                                        <ChevronDown size={16} style={{ 
                                                            color: activeDropdown === med.id ? '#10b981' : '#64748b', 
                                                            transition: 'all 0.3s ease',
                                                            transform: activeDropdown === med.id ? 'rotate(180deg)' : 'rotate(0deg)'
                                                        }} />
                                                    </button>
                                                    
                                                    {activeDropdown === med.id && (
                                                        <div className="dropdown-menu" style={{
                                                            top: dropdownPosition.top + 'px',
                                                            right: dropdownPosition.right + 'px'
                                                        }} onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => handleEditMedicine(med)}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '12px 16px',
                                                                    border: 'none',
                                                                    background: 'transparent',
                                                                    textAlign: 'left',
                                                                    cursor: 'pointer',
                                                                    fontSize: '14px',
                                                                    fontWeight: '600',
                                                                    color: '#1e293b',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '10px',
                                                                    transition: 'background-color 0.2s ease'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.target.style.backgroundColor = '#f8fafc';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.target.style.backgroundColor = 'transparent';
                                                                }}
                                                            >
                                                                <span style={{ 
                                                                    fontSize: '16px'
                                                                }}>✏️</span>
                                                                <span>Edit Medicine</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="inv-footer">
                    Showing {filtered.length} of {medicines.length} medicines
                </div>
            </div>

            <AddStockModal
                isOpen={showAddStockModal}
                onClose={() => setShowAddStockModal(false)}
                onStockAdded={handleStockAdded}
            />
            
            <EditMedicineModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                medicine={editingMedicine}
                onMedicineUpdated={handleMedicineUpdated}
            />
        </div>
    );
};

export default Inventory;
