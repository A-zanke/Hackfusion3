import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    TrendingUp,
    ShoppingCart,
    AlertTriangle,
    Clock,
    Pill,
    AlertCircle,
    Users,
    Zap,
    Search,
    Shield
} from 'lucide-react';
import '../App.css';
import '../PremiumDashboard.css';
import StatsModal from '../ui/StatsModal';

const API_BASE = 'http://localhost:5000/api';

const Dashboard = () => {
    const [medicines, setMedicines] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [stats, setStats] = useState({
        allSales: [],
        todaySales: [],
        allOrders: [],
        lowStock: [],
        repeatCustomers: [],
        fastMoving: [],
        nearExpiry: []
    });
    const [modalConfig, setModalConfig] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const medRes = await axios.get(`${API_BASE}/medicines`);
                const alertRes = await axios.get(`${API_BASE}/alerts`);
                const statRes = await axios.get(`${API_BASE}/dashboard/stats`);
                setMedicines(medRes.data);
                setAlerts(alertRes.data);
                setStats(statRes.data || {
                    allSales: [], todaySales: [], allOrders: [],
                    lowStock: [], repeatCustomers: [], fastMoving: [], nearExpiry: []
                });
            } catch (err) {
                console.error("Error fetching data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const totalSales = stats.todaySales.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const totalOrdersCount = stats.allOrders.length;
    const lowStockMeds = stats.lowStock;
    const repeatCustomersList = stats.repeatCustomers;
    const nearExpiryMeds = stats.nearExpiry;
    const fastMoving = stats.fastMoving;

    if (loading) {
        return (
            <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold', color: '#10b981' }}>
                    Loading Dashboard...
                </div>
            </div>
        );
    }

    return (
        <div className="premium-dashboard-container">
            <div className="premium-dashboard-grid">

                {/* 1. Today's Sales */}
                <div className="premium-card" style={{ cursor: 'pointer' }} onClick={() => setModalConfig({ type: 'sales', title: "Sales Details", data: stats.allSales })}>
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Today's Sales</h3>
                        <div className="premium-card-icon-wrapper icon-green">
                            <TrendingUp size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body" style={{ justifyContent: 'center' }}>
                        <p className="premium-card-value">₹{totalSales.toFixed(0)}</p>
                        <p className="premium-card-subtitle">{stats.todaySales.length} orders today</p>
                    </div>
                </div>

                {/* 2. Total Orders */}
                <div className="premium-card" style={{ cursor: 'pointer' }} onClick={() => setModalConfig({ type: 'orders', title: "All Orders", data: stats.allOrders })}>
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Total Orders</h3>
                        <div className="premium-card-icon-wrapper icon-blue">
                            <ShoppingCart size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body" style={{ justifyContent: 'center' }}>
                        <p className="premium-card-value">{totalOrdersCount}</p>
                        <p className="premium-card-subtitle">All-time orders processed</p>
                    </div>
                </div>

                {/* 3. Low Stock Items */}
                <div className="premium-card" style={{ cursor: 'pointer' }} onClick={() => setModalConfig({ type: 'lowStock', title: "Low Stock Medicines", data: stats.lowStock })}>
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Low Stock Items</h3>
                        <div className="premium-card-icon-wrapper icon-orange">
                            <AlertTriangle size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body" style={{ justifyContent: 'center' }}>
                        <p className="premium-card-value">{lowStockMeds.length}</p>
                        <p className="premium-card-subtitle">of {medicines.length} medicines need restock.</p>
                    </div>
                </div>

                {/* 4. Advanced Admin Search & Filters */}
                <div className="premium-card">
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Advanced Admin<br />Search & Filters</h3>
                        <div className="premium-card-icon-wrapper icon-green">
                            <Search size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body" style={{ justifyContent: 'center' }}>
                        <p className="premium-card-subtitle" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
                            Search, filter & manage all<br />pharmacy data efficiently
                        </p>
                    </div>
                </div>

                {/* 5. Overdose Prevention & Order Limit Control */}
                <div className="premium-card">
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Overdose Prevention<br />& Order Limit Control</h3>
                        <div className="premium-card-icon-wrapper icon-blue">
                            <Shield size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body" style={{ justifyContent: 'center' }}>
                        <p className="premium-card-subtitle" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
                            Monitor dosage limits and restrict<br />excessive orders automatically
                        </p>
                    </div>
                </div>

                {/* 6. Predictive Stock Alerts */}
                <div className="premium-card">
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Predictive Stock<br />Alerts</h3>
                        <div className="premium-card-icon-wrapper icon-orange">
                            <AlertTriangle size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body" style={{ justifyContent: 'center', alignItems: 'center' }}>
                        <p className="premium-card-subtitle" style={{ textAlign: 'center', width: '100%', marginTop: 'auto', marginBottom: 'auto' }}>
                            No predictive alerts at this time
                        </p>
                    </div>
                </div>

                {/* 7. Missed Medicine Reminder */}
                <div className="premium-card">
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Missed Medicine<br />Reminder</h3>
                        <div className="premium-card-icon-wrapper icon-red">
                            <AlertCircle size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body">
                        <ul className="premium-card-list">
                            <li className="premium-list-item">
                                <span className="premium-list-text">Rajesh Kumar</span>
                                <span className="premium-list-badge badge-red">Metformin 500mg</span>
                            </li>
                            <li className="premium-list-item">
                                <span className="premium-list-text">Priya Sharma</span>
                                <span className="premium-list-badge badge-red">Cetirizine 10mg</span>
                            </li>
                            <li className="premium-list-item">
                                <span className="premium-list-text">Amit Patel</span>
                                <span className="premium-list-badge badge-red">Aspirin 75mg</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* 8. Repeat Customers */}
                <div className="premium-card" style={{ cursor: 'pointer' }} onClick={() => setModalConfig({ type: 'repeatCustomers', title: "Repeat Customers", data: stats.repeatCustomers })}>
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Repeat Customers</h3>
                        <div className="premium-card-icon-wrapper icon-blue">
                            <Users size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body">
                        {repeatCustomersList.length > 0 ? (
                            <ul className="premium-card-list">
                                {repeatCustomersList.slice(0, 3).map((c, i) => (
                                    <li key={i} className="premium-list-item">
                                        <span className="premium-list-text">{c.name}</span>
                                        <span className="premium-list-badge badge-blue">{c.order_count} orders</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="premium-card-subtitle" style={{ textAlign: 'center', width: '100%', marginTop: 'auto', marginBottom: 'auto' }}>
                                No repeat customers yet
                            </p>
                        )}
                    </div>
                </div>

                {/* 9. Fast Moving Medicines */}
                <div className="premium-card" style={{ cursor: 'pointer' }} onClick={() => setModalConfig({ type: 'fastMoving', title: "Fast Moving Medicines", data: stats.fastMoving })}>
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Fast Moving<br />Medicines</h3>
                        <div className="premium-card-icon-wrapper icon-purple">
                            <Zap size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body" style={{ justifyContent: 'center', alignItems: 'center' }}>
                        {fastMoving.length > 0 ? (
                            <ul className="premium-card-list">
                                {fastMoving.slice(0, 3).map((med, i) => (
                                    <li key={med.id} className="premium-list-item">
                                        <span className="premium-list-text">{med.name}</span>
                                        <span className="premium-list-badge badge-purple" style={{ backgroundColor: '#faf5ff', color: '#a855f7', border: '1px solid #f3e8ff' }}>{med.total_sold} units</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="premium-card-subtitle" style={{ textAlign: 'center', width: '100%', marginTop: 'auto', marginBottom: 'auto' }}>
                                No fast moving medicines at this time
                            </p>
                        )}
                    </div>
                </div>

                {/* 10. Near Expiry Medicines */}
                <div className="premium-card" style={{ cursor: 'pointer' }} onClick={() => setModalConfig({ type: 'nearExpiry', title: "Near Expiry Medicines", data: stats.nearExpiry })}>
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Near Expiry<br />Medicines</h3>
                        <div className="premium-card-icon-wrapper icon-red">
                            <Clock size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body" style={{ justifyContent: 'center', alignItems: 'center' }}>
                        {nearExpiryMeds.length > 0 ? (
                            <ul className="premium-card-list">
                                {nearExpiryMeds.slice(0, 3).map((med, i) => {
                                    const daysTillExpiry = Math.ceil((new Date(med.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                                    return (
                                        <li key={med.id} className="premium-list-item">
                                            <span className="premium-list-text">{med.name}</span>
                                            <span className="premium-list-badge badge-orange">{daysTillExpiry > 0 ? `${daysTillExpiry} days left` : 'Expired'}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="premium-card-subtitle" style={{ textAlign: 'center', width: '100%', marginTop: 'auto', marginBottom: 'auto' }}>
                                No medicines near expiry
                            </p>
                        )}
                    </div>
                </div>

            </div>
            <StatsModal config={modalConfig} onClose={() => setModalConfig(null)} />
        </div>
    );
};

export default Dashboard;
