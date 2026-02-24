import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, TrendingUp, Package, Trash2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

const API_BASE = 'http://localhost:5000/api';

const AdminSummary = () => {
    const [stats, setStats] = useState({
        totalMedicines: 0,
        lowStockCount: 0,
        deletedCount: 0,
        totalSales: 0,
        recentOrders: []
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
                const lowStock = meds.data.filter(m => m.total_tablets < m.low_stock_threshold).length;

                setStats({
                    totalMedicines: meds.data.length,
                    lowStockCount: lowStock,
                    deletedCount: bin.data.length,
                    totalSales: totalSales,
                    recentOrders: orders.data
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
            <div className="admin-title-area">
                <h1 className="admin-title">Admin Hub</h1>
                <p className="admin-subtitle">System overview and executive summary</p>
            </div>

            <div className="admin-stats-grid">
                <div className="stat-card">
                    <div className="stat-icon icon-blue"><Package size={20} /></div>
                    <div className="stat-info">
                        <p className="stat-label">Total Inventory</p>
                        <h2 className="stat-value">{stats.totalMedicines}</h2>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon icon-orange"><TrendingUp size={20} /></div>
                    <div className="stat-info">
                        <p className="stat-label">Total Sales (Recent)</p>
                        <h2 className="stat-value">₹{stats.totalSales.toFixed(2)}</h2>
                    </div>
                </div>
                <div className="stat-card" onClick={() => navigate('/inventory')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon icon-red"><LayoutDashboard size={20} /></div>
                    <div className="stat-info">
                        <p className="stat-label">Low Stock items</p>
                        <h2 className="stat-value">{stats.lowStockCount}</h2>
                    </div>
                </div>
                <div className="stat-card" onClick={() => navigate('/bin')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon icon-gray"><Trash2 size={20} /></div>
                    <div className="stat-info">
                        <p className="stat-label">Items in Bin</p>
                        <h2 className="stat-value">{stats.deletedCount}</h2>
                    </div>
                </div>
            </div>

            <div className="admin-content-grid">
                <div className="admin-card">
                    <div className="card-header">
                        <h3 className="card-title">Recent Order Summary</h3>
                        <button className="text-btn" onClick={() => navigate('/orders')}>View All <ArrowRight size={14} /></button>
                    </div>
                    <div className="orders-list-mini">
                        {stats.recentOrders.map(order => (
                            <div key={order.id} className="mini-order-item">
                                <div>
                                    <p className="mini-order-customer">{order.customer_name || 'Walk-in'}</p>
                                    <p className="mini-order-date">{new Date(order.created_at).toLocaleDateString()}</p>
                                </div>
                                <p className="mini-order-price">₹{Number(order.total_price).toFixed(2)}</p>
                            </div>
                        ))}
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

export default AdminSummary;
