import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, Package, ChevronDown, Filter, Trash2, CheckSquare, Square } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import AddStockModal from '../components/AddStockModal';
import '../App.css';

const API_BASE = 'http://localhost:5000/api';

const Inventory = () => {
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [showAddStockModal, setShowAddStockModal] = useState(false);
    const [advFilters, setAdvFilters] = useState({
        brand: '',
        category: '',
        productId: '',
        expiryStart: '',
        expiryEnd: '',
        prescriptionRequired: ''
    });

    const fetchMedicines = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE}/medicines`);
            setMedicines(res.data);
        } catch (err) {
            console.error("Error fetching medicines:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMedicines();
        const interval = setInterval(fetchMedicines, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleSoftDelete = async (ids) => {
        if (!window.confirm(`Move ${ids.length} item(s) to bin?`)) return;
        try {
            await axios.post(`${API_BASE}/medicines/soft-delete`, { ids });
            setSelectedIds([]);
            fetchMedicines();
        } catch (err) {
            console.error("Error moving to bin:", err);
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
            (advFilters.prescriptionRequired === 'not-required' && !med.prescription_required);

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

        const matchesAdvanced = matchesBrand && matchesCat && matchesID && matchesExpiry && matchesPrescription;

        if (filter === 'low') return matchesSearch && matchesAdvanced && med.total_tablets < med.low_stock_threshold;
        if (filter === 'expiring') {
            const days = getDaysToExpiry(med.expiry_date);
            return matchesSearch && matchesAdvanced && days !== null && days <= 30;
        }
        return matchesSearch && matchesAdvanced;
    });

    if (loading) {
        return (
            <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold', color: '#10b981' }}>
                    Loading Inventory...
                </div>
            </div>
        );
    }

    return (
        <div className="inv-page-container">
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
                        { key: 'low', label: '⚠ Low Stock' },
                        { key: 'expiring', label: '⏳ Expiring' },
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
                            >
                                <option value="">All</option>
                                <option value="required">Yes</option>
                                <option value="not-required">No</option>
                            </select>
                        </div>
                        <div className="adv-input-group" style={{ justifyContent: 'flex-end', paddingTop: '20px' }}>
                            <button
                                className="text-btn"
                                onClick={() => setAdvFilters({ brand: '', category: '', productId: '', expiryStart: '', expiryEnd: '', prescriptionRequired: '' })}
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
                                            {!selectionMode && <ChevronDown size={14} style={{ color: '#94a3b8' }} />}
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
                onStockAdded={fetchMedicines}
            />
        </div>
    );
};

export default Inventory;
