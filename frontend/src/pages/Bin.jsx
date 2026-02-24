import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, RotateCcw, Package, AlertTriangle } from 'lucide-react';
import '../App.css';

const API_BASE = 'http://localhost:5000/api';

const Bin = () => {
    const [deletedMedicines, setDeletedMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);

    const fetchBin = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE}/medicines/bin`);
            setDeletedMedicines(res.data);
        } catch (err) {
            console.error('Error fetching bin:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBin();
    }, []);

    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleRestore = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Restore ${selectedIds.length} item(s)?`)) return;
        try {
            await axios.post(`${API_BASE}/medicines/restore`, { ids: selectedIds });
            setSelectedIds([]);
            fetchBin();
        } catch (err) {
            console.error('Error restoring:', err);
        }
    };

    const handlePermanentDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Permanently delete ${selectedIds.length} item(s)? This cannot be undone.`)) return;
        try {
            await axios.post(`${API_BASE}/medicines/permanent-delete`, { ids: selectedIds });
            setSelectedIds([]);
            fetchBin();
        } catch (err) {
            console.error('Error deleting permanently:', err);
        }
    };

    if (loading) {
        return (
            <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold', color: '#10b981' }}>
                    Loading Bin...
                </div>
            </div>
        );
    }

    return (
        <div className="inv-page-container">
            <div className="inv-title-area">
                <h1 className="inv-title">🗑️ Recycle Bin</h1>
                <p className="inv-subtitle">
                    {deletedMedicines.length} deleted medicine{deletedMedicines.length !== 1 ? 's' : ''}
                </p>
            </div>

            {selectedIds.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <button
                        onClick={handleRestore}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 20px', borderRadius: '10px', border: 'none',
                            background: '#10b981', color: 'white', fontWeight: '600',
                            fontSize: '14px', cursor: 'pointer'
                        }}
                    >
                        <RotateCcw size={16} /> Restore ({selectedIds.length})
                    </button>
                    <button
                        onClick={handlePermanentDelete}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 20px', borderRadius: '10px', border: 'none',
                            background: '#ef4444', color: 'white', fontWeight: '600',
                            fontSize: '14px', cursor: 'pointer'
                        }}
                    >
                        <Trash2 size={16} /> Delete Forever ({selectedIds.length})
                    </button>
                </div>
            )}

            <div className="inv-table-wrapper" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {deletedMedicines.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '16px', color: '#94a3b8' }}>
                        <AlertTriangle size={48} strokeWidth={1} />
                        <p style={{ fontSize: '16px', fontWeight: '500' }}>Bin is empty</p>
                        <p style={{ fontSize: '13px' }}>Deleted medicines will appear here</p>
                    </div>
                ) : (
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}></th>
                                <th>Medicine</th>
                                <th className="inv-col-center">Packets</th>
                                <th className="inv-col-center">Total Tablets</th>
                                <th className="inv-col-center">Unit Price</th>
                                <th className="inv-col-center">Brand</th>
                            </tr>
                        </thead>
                        <tbody>
                            {deletedMedicines.map(med => (
                                <tr
                                    key={med.id}
                                    className={selectedIds.includes(med.id) ? 'inv-row-selected' : ''}
                                    onClick={() => toggleSelect(med.id)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(med.id)}
                                            onChange={() => toggleSelect(med.id)}
                                            onClick={e => e.stopPropagation()}
                                            style={{ width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer' }}
                                        />
                                    </td>
                                    <td>
                                        <div className="inv-med-cell">
                                            <div className="inv-med-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
                                                <Package size={16} />
                                            </div>
                                            <div className="inv-med-info">
                                                <p className="inv-med-name">{med.name}</p>
                                                <p className="inv-med-desc">{med.product_id_str || 'No ID'} · {med.category}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="inv-col-center inv-col-number">{med.stock_packets}</td>
                                    <td className="inv-col-center inv-col-bold">{med.total_tablets}</td>
                                    <td className="inv-col-center inv-col-price">₹{Number(med.price_per_tablet).toFixed(2)}</td>
                                    <td className="inv-col-center">
                                        <span className="brand-badge">{med.brand || 'Generic'}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Bin;
