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
            <div className="h-[60vh] flex items-center justify-center">
                <div className="flex items-center gap-3 font-bold animate-pulse" style={{ color: '#10b981' }}>
                    <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
                        style={{ borderColor: '#10b981', borderTopColor: 'transparent' }}></div>
                    Loading Inventory...
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Title */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Inventory Management</h1>
                <p className="text-sm" style={{ color: '#10b981' }}>Track stock, batches, and expiry across all medicines</p>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 border flex-1 min-w-[250px]"
                    style={{ borderColor: '#e2e8f0' }}>
                    <Search size={16} style={{ color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Search medicines..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm w-full"
                        style={{ color: '#0f172a' }}
                    />
                </div>

                <div className="flex gap-2">
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'low', label: '⚠ Low Stock' },
                        { key: 'expiring', label: '⏰ Expiring' },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                            style={{
                                background: filter === f.key ? '#3b82f6' : 'white',
                                color: filter === f.key ? 'white' : '#64748b',
                                border: filter === f.key ? 'none' : '1px solid #e2e8f0',
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                    <button className="px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1"
                        style={{ background: '#10b981' }}>
                        <Plus size={14} /> Add Stock
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border overflow-hidden animate-fade-in" style={{ borderColor: '#f1f5f9' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                {['MEDICINE', 'PACKETS', 'TAB/PKT', 'TOTAL TABLETS', 'UNIT PRICE', 'STATUS', 'DEMAND', 'EXPIRY'].map((h, i) => (
                                    <th key={i} className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider"
                                        style={{ color: '#94a3b8', textAlign: i >= 4 ? 'center' : 'left' }}>
                                        {h}
                                    </th>
                                ))}
                                <th className="px-3 py-3.5"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((med, index) => {
                                const isLowStock = med.total_tablets < med.low_stock_threshold;
                                const daysToExpiry = getDaysToExpiry(med.expiry_date);
                                const isNearExpiry = daysToExpiry !== null && daysToExpiry <= 60;

                                return (
                                    <tr key={med.id}
                                        className="table-row-hover animate-fade-in"
                                        style={{
                                            borderBottom: '1px solid #f8fafc',
                                            animationDelay: `${index * 0.03}s`,
                                        }}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                                    style={{ background: '#f0f4f8' }}>
                                                    <Package size={14} style={{ color: '#64748b' }} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold" style={{ color: '#0f172a' }}>{med.name}</p>
                                                    <p className="text-[11px]" style={{ color: '#94a3b8' }}>{med.category} · {med.manufacturer || 'Generic'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm font-medium" style={{ color: '#334155' }}>
                                            {med.stock_packets}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm font-medium" style={{ color: '#334155' }}>
                                            {med.tablets_per_packet}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm font-bold" style={{ color: '#0f172a' }}>
                                            {med.total_tablets}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm font-medium" style={{ color: '#334155' }}>
                                            ₹{Number(med.price_per_tablet).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <StatusBadge variant={isLowStock ? 'low' : 'stable'} />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <StatusBadge variant={isLowStock ? 'insufficient' : 'ok'} />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {isNearExpiry ? (
                                                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                                                    style={{
                                                        background: daysToExpiry <= 10 ? '#fee2e2' : '#fef3c7',
                                                        color: daysToExpiry <= 10 ? '#dc2626' : '#d97706'
                                                    }}>
                                                    Expires in {daysToExpiry} days
                                                </span>
                                            ) : (
                                                <StatusBadge variant="valid" text="Valid" />
                                            )}
                                        </td>
                                        <td className="px-3 py-4">
                                            <ChevronDown size={14} style={{ color: '#94a3b8' }} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 text-xs" style={{ color: '#10b981', borderTop: '1px solid #f1f5f9' }}>
                    Showing {filtered.length} of {medicines.length} medicines
                </div>
            </div>
        </div>
    );
};

export default Inventory;
