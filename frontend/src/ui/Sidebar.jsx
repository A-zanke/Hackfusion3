import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    MessageSquare,
    FileText,
    LogOut,
} from 'lucide-react';
import '../App.css';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/orders', icon: ShoppingCart, label: 'Orders' },
    { to: '/ai-chat', icon: MessageSquare, label: 'AI Chat' },
    { to: '/trace-logs', icon: FileText, label: 'Trace Logs' },
];

const Sidebar = () => {
    const navigate = useNavigate();

    const handleSignOut = () => {
        navigate('/login');
    };

    return (
        <aside className="sidebar-container">
            <div>
                <div className="sidebar-logo-area">
                    <div className="sidebar-logo">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v20M2 12h20" />
                            <path d="M8 6l4-4 4 4" />
                        </svg>
                    </div>
                    <div>
                        <p className="sidebar-title">PharmaAI</p>
                        <p className="sidebar-subtitle">Agentic Pharmacist</p>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map(({ to, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            <Icon size={18} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>
            </div>

            <div className="sidebar-profile-area">
                <div className="sidebar-profile-card">
                    <div className="profile-avatar">RG</div>
                    <div>
                        <p className="profile-name">Dr. Rajesh Gupta</p>
                        <p className="profile-role">Admin · Authenticated</p>
                    </div>
                </div>
                <button onClick={handleSignOut} className="signout-btn">
                    <LogOut size={16} />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
