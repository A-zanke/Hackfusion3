import React, { useState, useEffect } from 'react';
import axios from 'axios';
import StatusBadge from '../ui/StatusBadge';
import { Search, Plus, Package, ChevronDown } from 'lucide-react';
import '../App.css';

const API_BASE = 'http://localhost:5000/api';

const Inventory = () => {
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');

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
        const interval = setInterval(fetchMedicines, 30000);
        return () => clearInterval(interval);
    }, []);

    const getDaysToExpiry = (date) => {
        if (!date) return null;
        return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
    };

    const filtered = medicines.filter(med => {
        const matchesSearch = med.name.toLowerCase().includes(searchTerm.toLowerCase());
        if (filter === 'low') return matchesSearch && med.total_tablets < med.low_stock_threshold;
        if (filter === 'expiring') {
            const days = getDaysToExpiry(med.expiry_date);
            return matchesSearch && days !== null && days <= 60;
        }
        return matchesSearch;
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
            {/* Title */}
            <div className="inv-title-area">
                <h1 className="inv-title">Inventory Management</h1>
                <p className="inv-subtitle">Track stock, batches, and expiry across all medicines</p>
            </div>

            {/* Search & Filters */}
            <div className="inv-controls-area">
                <div className="inv-search-box">
                    <Search size={16} style={{ color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Search medicines..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="inv-search-input"
                    />
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
                    <button className="inv-add-btn">
                        <Plus size={14} /> Add Stock
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="inv-table-card animate-fade-in">
                <div className="inv-table-wrapper">
                    <table className="inv-table">
                        <thead>
                            <tr>
                                {['MEDICINE', 'PACKETS', 'TAB/PKT', 'TOTAL TABLETS', 'UNIT PRICE', 'STATUS', 'DEMAND', 'EXPIRY'].map((h, i) => (
                                    <th key={i} className={i >= 4 ? 'inv-col-center' : ''}>
                                        {h}
                                    </th>
                                ))}
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((med, index) => {
                                const isLowStock = med.total_tablets < med.low_stock_threshold;
                                const daysToExpiry = getDaysToExpiry(med.expiry_date);
                                const isNearExpiry = daysToExpiry !== null && daysToExpiry <= 60;

                                return (
                                    <tr key={med.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                                        <td>
                                            <div className="inv-med-cell">
                                                <div className="inv-med-icon stat-green">
                                                    <Package size={16} />
                                                </div>
                                                <div className="inv-med-info">
                                                    <p className="inv-med-name">{med.name}</p>
                                                    <p className="inv-med-desc">{med.category} · {med.manufacturer || 'Generic'}</p>
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
                                            <StatusBadge variant={isLowStock ? 'insufficient' : 'ok'} />
                                        </td>
                                        <td className="inv-col-center">
                                            {isNearExpiry ? (
                                                <span className={`status-badge ${daysToExpiry <= 10 ? 'status-badge-low' : 'status-badge-warning'}`}>
                                                    Expires in {daysToExpiry} days
                                                </span>
                                            ) : (
                                                <StatusBadge variant="valid" text="Valid" />
                                            )}
                                        </td>
                                        <td>
                                            <ChevronDown size={14} style={{ color: '#94a3b8' }} />
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
        </div>
    );
};

export default Inventory;
