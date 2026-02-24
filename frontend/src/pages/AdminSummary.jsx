import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, TrendingUp, Package, Trash2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

const API_BASE = 'http://localhost:5000/api';

const AdminHub = () => {
    const [stats, setStats] = useState({
        totalMedicines: 0,
        lowStockCount: 0,
        deletedCount: 0,
        totalSales: 0,
        recentOrders: [],
        medicines: [], // Store medicines data for calculations
        expiringCount: 0
    });
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const meds = await axios.get(`${API_BASE}/medicines`);
                const bin = await axios.get(`${API_BASE}/medicines/bin`);
                const orders = await axios.get(`${API_BASE}/orders/recent`);

                const totalSales = orders.data.reduce((acc, o) => acc + Number(o.total_price), 0);
                const lowStock = meds.data.filter(m => m.total_tablets < 200).length;
                const expiringCount = meds.data.filter(m => {
                    const days = Math.ceil((new Date(m.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                    return days !== null && days <= 30;
                }).length;

                setStats({
                    totalMedicines: meds.data.length,
                    lowStockCount: lowStock,
                    deletedCount: bin.data.length,
                    totalSales: totalSales,
                    recentOrders: orders.data,
                    medicines: meds.data,
                    expiringCount: expiringCount
                });
            } catch (err) {
                console.error("Error fetching admin stats:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="loading-area">Loading Admin Summary...</div>;

    return (
        <div className="admin-page-container">
            

            <div className="admin-stats-grid">
                {/* Alert Cards */}
                <div className="stat-card alert-card" onClick={() => navigate('/inventory?filter=expiring')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon icon-orange"><TrendingUp size={20} /></div>
                    <div className="stat-info">
                        <p className="stat-label">⚠️ Expiring Items</p>
                        <h2 className="stat-value">{stats.expiringCount}</h2>
                    </div>
                </div>
                <div className="stat-card alert-card" onClick={() => navigate('/inventory?filter=below-30')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon icon-red"><LayoutDashboard size={20} /></div>
                    <div className="stat-info">
                        <p className="stat-label">🚨 Low Stock Items</p>
                        <h2 className="stat-value">{stats.lowStockCount}</h2>
                    </div>
                </div>
                
                {/* Original Stats */}
                <div className="stat-card">
                    <div className="stat-icon icon-blue"><Package size={20} /></div>
                    <div className="stat-info">
                        <p className="stat-label">Total Inventory</p>
                        <h2 className="stat-value">{stats.totalMedicines}</h2>
                    </div>
                </div>
            </div>

            <div className="admin-content-grid">
                <div className="admin-card">
                    <div className="card-header">
                        <h3 className="card-title">🔔 System Alerts</h3>
                    </div>
                    <div className="alerts-list">
                        <div className="alert-item" onClick={() => navigate('/inventory?filter=expiring')}>
                            <span className="alert-icon">⚠️</span>
                            <span className="alert-text">{stats.expiringCount} items expiring in next 30 days</span>
                            <span className="alert-arrow">→</span>
                        </div>
                        <div className="alert-item" onClick={() => navigate('/inventory?filter=below-200')}>
                            <span className="alert-icon">🚨</span>
                            <span className="alert-text">{stats.lowStockCount} items with low stock (below 200 tablets)</span>
                            <span className="alert-arrow">→</span>
                        </div>
                    </div>
                </div>

                <div className="admin-card">
                    <div className="card-header">
                        <h3 className="card-title">📋 Recommendations</h3>
                    </div>
                    <div className="recommendations-list">
                        <div className="recommendation-item">
                            <span className="rec-icon">💊</span>
                            <span className="rec-text">Review expiring medicines and plan restock</span>
                        </div>
                        <div className="recommendation-item">
                            <span className="rec-icon">📈</span>
                            <span className="rec-text">Monitor low stock items frequently</span>
                        </div>
                        <div className="recommendation-item">
                            <span className="rec-icon">🔄</span>
                            <span className="rec-text">Consider automated reordering system</span>
                        </div>
                        <div className="recommendation-item">
                            <span className="rec-icon">📊</span>
                            <span className="rec-text">Analyze sales trends for better forecasting</span>
                        </div>
                    </div>
                </div>

                <div className="admin-card">
                    <div className="card-header">
                        <h3 className="card-title">Quick Actions</h3>
                    </div>
                    <div className="quick-actions-list">
                        <button className="q-action-btn" onClick={() => navigate('/inventory')}>
                            <Package size={16} /> Manage Stock
                        </button>
                        <button className="q-action-btn" onClick={() => navigate('/bin')}>
                            <Trash2 size={16} /> Empty Recycle Bin
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminHub;
