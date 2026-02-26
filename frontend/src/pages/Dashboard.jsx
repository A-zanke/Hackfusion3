import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DashboardCard from '../ui/DashboardCard';
import {
    TrendingUp,
    ShoppingCart,
    AlertTriangle,
    Clock,
    Pill,
    AlertCircle,
    Send,
    Users,
    Zap,
} from 'lucide-react';
import '../App.css';

const API_BASE = 'http://localhost:5000/api';

const Dashboard = () => {
    const [medicines, setMedicines] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const medRes = await axios.get(`${API_BASE}/medicines`);
                const alertRes = await axios.get(`${API_BASE}/alerts`);
                const orderRes = await axios.get(`${API_BASE}/orders/recent`);
                setMedicines(medRes.data);
                setAlerts(alertRes.data);
                setRecentOrders(orderRes.data);
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

    const totalSales = recentOrders.reduce((acc, o) => acc + Number(o.total_price || 0), 0);
    const lowStockMeds = medicines.filter(m => m.total_tablets < m.low_stock_threshold);
    const nearExpiryMeds = medicines.filter(m =>
        m.expiry_date && new Date(m.expiry_date) < new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    );
    const fastMoving = [...medicines].sort((a, b) => (b.total_tablets || 0) - (a.total_tablets || 0)).slice(0, 5);

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
        <div className="dashboard-container">
            {/* Page title */}

            {/* Stat Cards */}
            <div className="top-stats-grid">
                <DashboardCard
                    icon={TrendingUp}
                    title="TODAY'S SALES"
                    value={`₹${totalSales.toFixed(0)}`}
                    subtitle={`${recentOrders.length} orders`}
                    color="green"
                />
                <DashboardCard
                    icon={ShoppingCart}
                    title="TOTAL ORDERS"
                    value={recentOrders.length}
                    subtitle="All-time"
                    color="blue"
                />
                <DashboardCard
                    icon={AlertTriangle}
                    title="LOW STOCK ITEMS"
                    value={lowStockMeds.length}
                    subtitle={`of ${medicines.length} medicines`}
                    color="orange"
                />
                <DashboardCard
                    icon={Clock}
                    title="EXPIRY ALERTS"
                    value={nearExpiryMeds.length}
                    subtitle="Batches need attention"
                    color="red"
                />
            </div>

            {/* Content Grid — flat 2-column CSS Grid */}
            <div className="dashboard-main-grid">

                {/* Row 1, Col 1: Fast Moving Medicines */}
                <div className="dashboard-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <div className="card-header">
                        <div className="stat-icon-wrapper stat-icon-blue" style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
                            <Zap size={18} />
                        </div>
                        <h3 className="card-title">Fast Moving Medicines</h3>
                    </div>
                    <div className="space-y-4">
                        {fastMoving.map((med, i) => {
                            const maxVal = fastMoving[0]?.total_tablets || 1;
                            const pct = Math.round((med.total_tablets / maxVal) * 100);
                            return (
                                <div key={med.id} className="dash-list-item" style={{ paddingTop: i === 0 ? 0 : '12px' }}>
                                    <span className="med-rank">{i + 1}</span>
                                    <div className="med-info">
                                        <p className="med-name">{med.name}</p>
                                        <div className="progress-track">
                                            <div className="progress-fill" style={{ width: `${pct}%`, backgroundColor: i === 0 ? '#3b82f6' : '#10b981' }}></div>
                                        </div>
                                    </div>
                                    <span className="med-units">{med.total_tablets} units</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Row 1, Col 2: Low Stock Medicines */}
                <div className="dashboard-card dashboard-card-custom-red animate-fade-in" style={{ animationDelay: '0.15s' }}>
                    <div className="card-header">
                        <div className="stat-icon-wrapper stat-icon-red" style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
                            <AlertCircle size={18} />
                        </div>
                        <h3 className="card-title" style={{ width: '100%', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Low Stock Medicines
                                <span className="alert-pill pill-red-light">{lowStockMeds.length}</span>
                            </div>
                        </h3>
                    </div>
                    <div>
                        {lowStockMeds.length === 0 ? (
                            <p className="sub-text" style={{ textAlign: 'center', padding: '16px 0' }}>All stock levels are healthy</p>
                        ) : (
                            lowStockMeds.map((med, idx) => (
                                <div key={med.id} className="dash-list-item" style={{ paddingTop: idx === 0 ? 0 : '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                        <Pill size={14} style={{ color: '#ef4444' }} />
                                        <span className="med-name" style={{ margin: 0 }}>{med.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <span className="text-[11px] font-bold" style={{ color: '#ef4444' }}>{med.total_tablets} units</span>
                                        <span className="alert-pill pill-red">Low</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Row 2, Col 1: Near Expiry Medicines */}
                <div className="dashboard-card dashboard-card-custom-orange animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <div className="card-header">
                        <div className="stat-icon-wrapper stat-icon-orange" style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
                            <Clock size={18} />
                        </div>
                        <h3 className="card-title" style={{ width: '100%', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Near Expiry Medicines
                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', background: '#ffedd5', color: '#ea580c' }}>{nearExpiryMeds.length}</span>
                            </div>
                        </h3>
                    </div>
                    <div>
                        {nearExpiryMeds.length === 0 ? (
                            <p className="sub-text" style={{ textAlign: 'center', padding: '16px 0' }}>No medicines near expiry</p>
                        ) : (
                            nearExpiryMeds.map((med, idx) => {
                                const daysTillExpiry = Math.ceil((new Date(med.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                                const isCritical = daysTillExpiry <= 10;
                                return (
                                    <div key={med.id} className={`expiry-item ${isCritical ? 'critical' : ''}`}>
                                        <div>
                                            <p className="med-name" style={{ marginBottom: '2px' }}>{med.name}</p>
                                            <p className="sub-text">Batch: B2025-{String(med.id).padStart(3, '0')}</p>
                                        </div>
                                        <span className={isCritical ? 'badge-red-light' : 'badge-orange-light'}>
                                            Expires in {daysTillExpiry} days
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Row 2, Col 2: Predictive Stock Alerts */}
                <div className="dashboard-card dashboard-card-custom-orange animate-fade-in" style={{ animationDelay: '0.25s' }}>
                    <div className="card-header">
                        <div className="stat-icon-wrapper stat-icon-orange" style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
                            <AlertTriangle size={18} />
                        </div>
                        <h3 className="card-title">Predictive Stock Alerts</h3>
                    </div>
                    <div>
                        {lowStockMeds.length === 0 ? (
                            <p className="sub-text" style={{ textAlign: 'center', padding: '16px 0' }}>No alerts at this time</p>
                        ) : (
                            lowStockMeds.slice(0, 3).map((med, idx) => (
                                <div key={med.id} className="expiry-item" style={{ backgroundColor: '#fff7ed', borderColor: '#ffedd5', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <p className="med-name" style={{ marginBottom: '4px' }}>{med.name}</p>
                                    <p className="sub-text">
                                        Current: {med.total_tablets} units | Expected demand: 4/month
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Row 3, Col 1: Missed Medicine Reminders */}
                <div className="dashboard-card dashboard-card-custom-red animate-fade-in" style={{ animationDelay: '0.3s' }}>
                    <div className="card-header">
                        <div className="stat-icon-wrapper stat-icon-red" style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
                            <AlertCircle size={18} />
                        </div>
                        <h3 className="card-title">Missed Medicine Reminders</h3>
                    </div>
                    <div>
                        {[
                            { name: 'Rajesh Kumar', med: 'Metformin 500mg' },
                            { name: 'Priya Sharma', med: 'Cetirizine 10mg' },
                            { name: 'Amit Patel', med: 'Aspirin 75mg' },
                            { name: 'Mohammed Ali', med: 'Metformin 500mg' },
                        ].map((item, i) => (
                            <div key={i} className="dash-list-item" style={{ paddingTop: i === 0 ? 0 : '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <p className="med-name" style={{ marginBottom: '4px' }}>
                                        {item.name} missed <span style={{ fontWeight: 800 }}>{item.med}</span>
                                    </p>
                                    <p className="sub-text" style={{ color: '#ef4444' }}>Not purchased this month</p>
                                </div>
                                <button className="dash-btn-small btn-red-outline">
                                    Send Reminder
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Row 3, Col 2: Repeat Customers */}
                <div className="dashboard-card animate-fade-in" style={{ animationDelay: '0.35s' }}>
                    <div className="card-header">
                        <div className="stat-icon-wrapper stat-icon-blue" style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
                            <Users size={18} />
                        </div>
                        <h3 className="card-title">Repeat Customers</h3>
                    </div>
                    <div>
                        {[
                            { name: 'Rajesh Kumar', orders: 4 },
                            { name: 'Priya Sharma', orders: 2 },
                            { name: 'Amit Patel', orders: 3 },
                            { name: 'Sunita Deshmukh', orders: 2 },
                        ].map((cust, i) => (
                            <div key={i} className="dash-list-item" style={{ paddingTop: i === 0 ? 0 : '12px' }}>
                                <span className="med-name" style={{ margin: 0, flex: 1 }}>{cust.name}</span>
                                <span className="alert-pill pill-blue">{cust.orders} orders</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
