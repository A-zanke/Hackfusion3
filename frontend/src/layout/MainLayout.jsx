import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../ui/Sidebar';
import { Bell, Package, AlertTriangle, ShieldCheck, TrendingUp, Clock, CheckCircle, Info } from 'lucide-react';
import '../App.css';

const sampleNotifications = [
    { id: 1, icon: AlertTriangle, color: '#ef4444', title: 'Low Stock Alert', desc: 'Paracetamol 500mg is below reorder level', time: '2 min ago' },
    { id: 2, icon: Package, color: '#3b82f6', title: 'New Order Received', desc: 'Order #1042 — 3 items from Supplier A', time: '15 min ago' },
    { id: 3, icon: Clock, color: '#f59e0b', title: 'Expiry Warning', desc: 'Amoxicillin batch B-204 expires in 30 days', time: '1 hr ago' },
    { id: 4, icon: CheckCircle, color: '#10b981', title: 'Order Delivered', desc: 'Order #1038 has been delivered successfully', time: '2 hr ago' },
    { id: 5, icon: TrendingUp, color: '#8b5cf6', title: 'Sales Spike', desc: 'Ibuprofen sales increased 40% today', time: '3 hr ago' },
    { id: 6, icon: ShieldCheck, color: '#10b981', title: 'Compliance Check Passed', desc: 'Monthly audit report generated', time: '5 hr ago' },
    { id: 7, icon: Info, color: '#3b82f6', title: 'System Update', desc: 'PharmaAI v2.1 is now available', time: '6 hr ago' },
];

const MainLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showNotifications, setShowNotifications] = useState(false);

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    // Get page title based on current route
    const getPageTitle = () => {
        const path = location.pathname;
        switch (path) {
            case '/inventory':
                return 'Inventory Management';
            case '/orders':
                return 'Orders';
            case '/bin':
                return 'Bin';
            case '/trace-logs':
                return 'Trace Logs';
            case '/ai-chat':
                return 'AI Pharmacy Assistant';
            case '/admin':
                return 'Admin Hub';
            case '/admin-hub':
                return 'Admin Hub';
            default:
                return 'Dashboard';
        }
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="app-container">
            <Sidebar />

            <div className="main-content-wrapper">
                <header className="top-header">
                    <div className="header-left">
                        <h1 className="header-page-title">{getPageTitle()}</h1>
                        <p className="header-date">{dateStr} • {currentTime.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                        })}</p>
                    </div>

                    <div className="header-actions">
                        <span className="admin-badge">
                            <span className="admin-badge-dot"></span>
                            Admin
                        </span>

                        <button
                            className="nav-chat-toggle"
                            onClick={() => navigate('/chat')}
                        >
                            <Bot size={18} />
                            <span>AI Chat</span>
                        </button>

                        <div className="notification-wrapper">
                            <button
                                className="notification-btn"
                                onClick={() => setShowNotifications((prev) => !prev)}
                            >
                                <Bell size={20} />
                                <span className="notification-dot">7</span>
                            </button>

                            {showNotifications && (
                                <div className="notification-dropdown">
                                    <div className="notif-dropdown-header">
                                        <span className="notif-dropdown-title">Notifications</span>
                                        <span className="notif-dropdown-count">7 new</span>
                                    </div>
                                    <div className="notif-dropdown-list">
                                        {sampleNotifications.map((n) => {
                                            const Icon = n.icon;
                                            return (
                                                <div key={n.id} className="notif-dropdown-item">
                                                    <div className="notif-item-icon" style={{ backgroundColor: `${n.color}15`, color: n.color }}>
                                                        <Icon size={16} />
                                                    </div>
                                                    <div className="notif-item-content">
                                                        <p className="notif-item-title">{n.title}</p>
                                                        <p className="notif-item-desc">{n.desc}</p>
                                                    </div>
                                                    <span className="notif-item-time">{n.time}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="notif-dropdown-footer">
                                        <button className="notif-view-all-btn">View All Notifications</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="page-viewport">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
