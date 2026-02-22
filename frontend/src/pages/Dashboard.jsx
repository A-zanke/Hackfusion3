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
            <div className="h-[60vh] flex items-center justify-center">
                <div className="flex items-center gap-3 font-bold animate-pulse" style={{ color: '#10b981' }}>
                    <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
                        style={{ borderColor: '#10b981', borderTopColor: 'transparent' }}></div>
                    Loading Dashboard...
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Page title */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Dashboard</h1>
                <p className="text-sm" style={{ color: '#10b981' }}>Real-time pharmacy intelligence at a glance</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
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

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Fast Moving Medicines */}
                <div className="bg-white rounded-2xl p-6 border animate-fade-in" style={{ borderColor: '#f1f5f9' }}>
                    <div className="flex items-center gap-2 mb-5">
                        <Zap size={18} style={{ color: '#3b82f6' }} />
                        <h3 className="font-bold text-base" style={{ color: '#0f172a' }}>Fast Moving Medicines</h3>
                    </div>
                    <div className="space-y-4">
                        {fastMoving.map((med, i) => {
                            const maxVal = fastMoving[0]?.total_tablets || 1;
                            const pct = Math.round((med.total_tablets / maxVal) * 100);
                            return (
                                <div key={med.id} className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white"
                                        style={{ background: '#3b82f6' }}>{i + 1}</span>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium" style={{ color: '#0f172a' }}>{med.name}</p>
                                        <div className="h-1.5 rounded-full mt-1" style={{ background: '#f1f5f9' }}>
                                            <div className="progress-bar h-full" style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                    <span className="text-sm font-semibold" style={{ color: '#64748b' }}>{med.total_tablets} units</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Low Stock Medicines */}
                <div className="bg-white rounded-2xl p-6 border animate-fade-in" style={{ borderColor: '#f1f5f9' }}>
                    <div className="flex items-center gap-2 mb-5">
                        <AlertCircle size={18} style={{ color: '#ef4444' }} />
                        <h3 className="font-bold text-base" style={{ color: '#0f172a' }}>Low Stock Medicines</h3>
                        <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                            style={{ background: '#dbeafe', color: '#2563eb' }}>{lowStockMeds.length}</span>
                    </div>
                    <div className="space-y-3">
                        {lowStockMeds.length === 0 ? (
                            <p className="text-sm py-4 text-center" style={{ color: '#94a3b8' }}>All stock levels are healthy</p>
                        ) : (
                            lowStockMeds.map(med => (
                                <div key={med.id} className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                        <Pill size={14} style={{ color: '#ef4444' }} />
                                        <span className="text-sm font-medium" style={{ color: '#0f172a' }}>{med.name}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                                            style={{ background: '#fee2e2', color: '#dc2626' }}>{med.total_tablets} units</span>
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                                            style={{ background: '#fee2e2', color: '#dc2626' }}>Low</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Near Expiry Medicines */}
                <div className="bg-white rounded-2xl p-6 border animate-fade-in" style={{ borderColor: '#f1f5f9' }}>
                    <div className="flex items-center gap-2 mb-5">
                        <Clock size={18} style={{ color: '#f97316' }} />
                        <h3 className="font-bold text-base" style={{ color: '#0f172a' }}>Near Expiry Medicines</h3>
                        <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                            style={{ background: '#dbeafe', color: '#2563eb' }}>{nearExpiryMeds.length}</span>
                    </div>
                    <div className="space-y-3">
                        {nearExpiryMeds.length === 0 ? (
                            <p className="text-sm py-4 text-center" style={{ color: '#94a3b8' }}>No medicines near expiry</p>
                        ) : (
                            nearExpiryMeds.map(med => {
                                const daysTillExpiry = Math.ceil((new Date(med.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                                return (
                                    <div key={med.id} className="flex items-center justify-between py-2">
                                        <div>
                                            <p className="text-sm font-medium" style={{ color: '#0f172a' }}>{med.name}</p>
                                            <p className="text-[11px]" style={{ color: '#94a3b8' }}>Batch: B2025-{String(med.id).padStart(3, '0')}</p>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                                            style={{
                                                background: daysTillExpiry <= 10 ? '#fee2e2' : '#fef3c7',
                                                color: daysTillExpiry <= 10 ? '#dc2626' : '#d97706'
                                            }}>
                                            Expires in {daysTillExpiry} days
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Predictive Stock Alerts */}
                <div className="bg-white rounded-2xl p-6 border animate-fade-in" style={{ borderColor: '#f1f5f9' }}>
                    <div className="flex items-center gap-2 mb-5">
                        <AlertTriangle size={18} style={{ color: '#f97316' }} />
                        <h3 className="font-bold text-base" style={{ color: '#0f172a' }}>Predictive Stock Alerts</h3>
                    </div>
                    <div className="space-y-3">
                        {lowStockMeds.length === 0 ? (
                            <p className="text-sm py-4 text-center" style={{ color: '#94a3b8' }}>No alerts at this time</p>
                        ) : (
                            lowStockMeds.slice(0, 3).map(med => (
                                <div key={med.id} className="py-2">
                                    <p className="text-sm font-semibold" style={{ color: '#0f172a' }}>{med.name}</p>
                                    <p className="text-[11px]" style={{ color: '#94a3b8' }}>
                                        Current: {med.total_tablets} units | Expected demand: 4/month
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Missed Medicine Reminders */}
                <div className="bg-white rounded-2xl p-6 border animate-fade-in" style={{ borderColor: '#f1f5f9' }}>
                    <div className="flex items-center gap-2 mb-5">
                        <AlertCircle size={18} style={{ color: '#ef4444' }} />
                        <h3 className="font-bold text-base" style={{ color: '#0f172a' }}>Missed Medicine Reminders</h3>
                    </div>
                    <div className="space-y-3">
                        {[
                            { name: 'Rajesh Kumar', med: 'Metformin 500mg' },
                            { name: 'Priya Sharma', med: 'Cetirizine 10mg' },
                            { name: 'Amit Patel', med: 'Aspirin 75mg' },
                            { name: 'Mohammed Ali', med: 'Metformin 500mg' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between py-2">
                                <div>
                                    <p className="text-sm" style={{ color: '#0f172a' }}>
                                        {item.name} missed <span className="font-semibold">{item.med}</span>
                                    </p>
                                    <p className="text-[11px]" style={{ color: '#ef4444' }}>Not purchased this month</p>
                                </div>
                                <button className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white flex items-center gap-1"
                                    style={{ background: '#ef4444' }}>
                                    <Send size={10} /> Send Reminder
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Repeat Customers */}
                <div className="bg-white rounded-2xl p-6 border animate-fade-in" style={{ borderColor: '#f1f5f9' }}>
                    <div className="flex items-center gap-2 mb-5">
                        <Users size={18} style={{ color: '#3b82f6' }} />
                        <h3 className="font-bold text-base" style={{ color: '#0f172a' }}>Repeat Customers</h3>
                    </div>
                    <div className="space-y-3">
                        {[
                            { name: 'Rajesh Kumar', orders: 4 },
                            { name: 'Priya Sharma', orders: 2 },
                            { name: 'Amit Patel', orders: 3 },
                            { name: 'Sunita Deshmukh', orders: 2 },
                        ].map((cust, i) => (
                            <div key={i} className="flex items-center justify-between py-2">
                                <span className="text-sm font-medium" style={{ color: '#0f172a' }}>{cust.name}</span>
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                                    style={{ background: '#dbeafe', color: '#2563eb' }}>{cust.orders} orders</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
