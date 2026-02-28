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
import { useNavigate } from 'react-router-dom';
import '../App.css';
import '../PremiumDashboard.css';
import StatsModal from '../ui/StatsModal';

const API_BASE = 'http://localhost:5000/api';

const Dashboard = () => {
    const navigate = useNavigate();
    const [medicines, setMedicines] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [recentOrders, setRecentOrders] = useState([]);
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
    const [dashboardStats, setDashboardStats] = useState({
        expired: 0,
        expiring: 0,
        lowStock: 0,
        totalInventory: 0
    });
    const [showExpiredModal, setShowExpiredModal] = useState(false);
    const [expiredMedicines, setExpiredMedicines] = useState([]);
    const [expiredLoading, setExpiredLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                console.log('=== DASHBOARD DATA FETCH START ===');
                console.log('Current dashboardStats state:', dashboardStats);
                
                // Fetch dashboard stats
                console.log('Fetching dashboard stats...');
                const statsRes = await axios.get(`${API_BASE}/dashboard-stats`);
                console.log('Dashboard stats response:', statsRes.data);
                console.log('Setting dashboardStats to:', statsRes.data);
                setDashboardStats(statsRes.data);
                
                // Verify the state was set correctly
                setTimeout(() => {
                    console.log('DashboardStats after set timeout:', dashboardStats);
                }, 100);

                const medRes = await axios.get(`${API_BASE}/medicines`);
                const alertRes = await axios.get(`${API_BASE}/alerts`);
                const statRes = await axios.get(`${API_BASE}/dashboard/stats`);
                const orderRes = await axios.get(`${API_BASE}/orders/recent`);
                setMedicines(medRes.data);
                setAlerts(alertRes.data);
                setRecentOrders(orderRes.data);
                
                console.log('=== DASHBOARD DATA FETCH END ===');
            } catch (err) {
                console.error("Error fetching data:", err);
            } finally {
                setLoading(false);
            }
        };

        // Initial fetch
        fetchData();
        
        // Set up interval for periodic updates
        const interval = setInterval(fetchData, 30000);
        
        // Listen for custom refresh events
        const handleRefreshEvent = () => {
            fetchData();
        };
        window.addEventListener('refreshDashboardStats', handleRefreshEvent);
        
        // Cleanup
        return () => {
            clearInterval(interval);
            window.removeEventListener('refreshDashboardStats', handleRefreshEvent);
        };
    }, []);

    const totalSales = recentOrders.reduce((acc, o) => acc + Number(o.total_price || 0), 0);
    const totalOrdersCount = recentOrders.length;
    const lowStockMeds = medicines.filter(m => m.total_tablets < m.low_stock_threshold);
    const nearExpiryMeds = medicines.filter(m =>
        m.expiry_date && new Date(m.expiry_date) < new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    );
    const repeatCustomersList = dashboardStats.repeatCustomers || [];
    const fastMoving = [...medicines].sort((a, b) => (b.total_tablets || 0) - (a.total_tablets || 0)).slice(0, 5);

    // Handle alert clicks to navigate to inventory with filters
    const handleAlertClick = async (filterType) => {
        console.log('=== DASHBOARD CARD CLICKED ===');
        console.log('Filter type:', filterType);
        console.log('Current dashboard stats:', dashboardStats);
        
        if (filterType === 'expired') {
            // Show expired medicines in modal instead of navigating
            console.log('Showing expired medicines modal');
            await fetchExpiredMedicines();
            setShowExpiredModal(true);
        } else {
            // For other filters, navigate to inventory
            console.log('Navigating to:', `/inventory?filter=${filterType}`);
            navigate(`/inventory?filter=${filterType}`);
        }
        
        console.log('=== END CLICK HANDLER ===');
    };

    // Fetch expired medicines for modal display
    const fetchExpiredMedicines = async () => {
        try {
            console.log('Fetching expired medicines...');
            setExpiredLoading(true);
            const res = await axios.get(`${API_BASE}/inventory?filter=expired`);
            console.log('Expired medicines response:', res.data);
            setExpiredMedicines(res.data);
        } catch (err) {
            console.error("Error fetching expired medicines:", err);
        } finally {
            setExpiredLoading(false);
        }
    };

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
                <div className="premium-card" style={{ cursor: 'pointer' }} onClick={() => setModalConfig({ type: 'sales', title: "Sales Details", data: dashboardStats.allSales })}>
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Today's Sales</h3>
                        <div className="premium-card-icon-wrapper icon-green">
                            <TrendingUp size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body" style={{ justifyContent: 'center' }}>
                        <p className="premium-card-value">₹{totalSales.toFixed(0)}</p>
                        <p className="premium-card-subtitle">{dashboardStats.todaySales.length} orders today</p>
                    </div>
                </div>

                {/* 2. Total Orders */}
                <div className="premium-card" style={{ cursor: 'pointer' }} onClick={() => setModalConfig({ type: 'orders', title: "All Orders", data: dashboardStats.allOrders })}>
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
                <div 
                    className="premium-card clickable-card" 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAlertClick('lowstock');
                    }}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleAlertClick('lowstock');
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    title="Click to view low stock items"
                    style={{ pointerEvents: 'auto', userSelect: 'none' }}
                >
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Low Stock Items</h3>
                        <div className="premium-card-icon-wrapper icon-orange">
                            <AlertTriangle size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body" style={{ justifyContent: 'center' }}>
                        <p className="premium-card-value">{dashboardStats.lowStock}</p>
                        <p className="premium-card-subtitle">of {dashboardStats.totalInventory} medicines need restock.</p>
                    </div>
                </div>

                {/* 4. Expiring Items */}
                <div 
                    className="premium-card clickable-card" 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAlertClick('expiring');
                    }}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleAlertClick('expiring');
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    title="Click to view expiring items"
                    style={{ pointerEvents: 'auto', userSelect: 'none' }}
                >
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Expiring This Month</h3>
                        <div className="premium-card-icon-wrapper icon-orange">
                            <Clock size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body" style={{ justifyContent: 'center' }}>
                        <p className="premium-card-value">{dashboardStats.expiring}</p>
                        <p className="premium-card-subtitle">medicines expiring in next 30 days</p>
                    </div>
                </div>

                {/* 5. Expired Items */}
                <div 
                    className="premium-card clickable-card" 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAlertClick('expired');
                    }}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleAlertClick('expired');
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    title="Click to view expired items"
                    style={{ pointerEvents: 'auto', userSelect: 'none' }}
                >
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Expired Items</h3>
                        <div className="premium-card-icon-wrapper icon-red">
                            <AlertCircle size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body" style={{ justifyContent: 'center' }}>
                        <p className="premium-card-value">{dashboardStats.expired}</p>
                        <p className="premium-card-subtitle">medicines already expired</p>
                    </div>
                </div>

                {/* 6. Total Inventory */}
                <div className="premium-card">
                    <div className="premium-card-header">
                        <h3 className="premium-card-title">Total Inventory</h3>
                        <div className="premium-card-icon-wrapper icon-blue">
                            <Pill size={18} />
                        </div>
                    </div>
                    <div className="premium-card-body" style={{ justifyContent: 'center' }}>
                        <p className="premium-card-value">{dashboardStats.totalInventory}</p>
                        <p className="premium-card-subtitle">total medicines in stock</p>
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
                <div className="premium-card" style={{ cursor: 'pointer' }} onClick={() => setModalConfig({ type: 'repeatCustomers', title: "Repeat Customers", data: dashboardStats.repeatCustomers })}>
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
                <div className="premium-card" style={{ cursor: 'pointer' }} onClick={() => setModalConfig({ type: 'fastMoving', title: "Fast Moving Medicines", data: dashboardStats.fastMoving })}>
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
                <div className="premium-card" style={{ cursor: 'pointer' }} onClick={() => setModalConfig({ type: 'nearExpiry', title: "Near Expiry Medicines", data: dashboardStats.nearExpiry })}>
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

            {/* Expired Medicines Modal */}
            {showExpiredModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '24px',
                        maxWidth: '800px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, color: '#ef4444' }}>Expired Medicines ({dashboardStats.expired})</h2>
                            <button 
                                onClick={() => setShowExpiredModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#666'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {expiredLoading ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                                <div>Loading expired medicines...</div>
                            </div>
                        ) : expiredMedicines.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                <div>No expired medicines found</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {expiredMedicines.map((medicine) => (
                                    <div key={medicine.id} style={{
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        backgroundColor: '#fef2f2'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                            <div>
                                                <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>{medicine.name}</h4>
                                                <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#666' }}>
                                                    Category: {medicine.category}
                                                </p>
                                                <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#666' }}>
                                                    Brand: {medicine.brand}
                                                </p>
                                                <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#666' }}>
                                                    Stock: {medicine.totalStock} tablets
                                                </p>
                                                <p style={{ margin: '0', fontSize: '14px', color: '#ef4444', fontWeight: 'bold' }}>
                                                    Expired: {new Date(medicine.expiry_date).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div style={{
                                                backgroundColor: '#ef4444',
                                                color: 'white',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}>
                                                EXPIRED
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ marginTop: '20px', textAlign: 'center' }}>
                            <button 
                                onClick={() => setShowExpiredModal(false)}
                                style={{
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
