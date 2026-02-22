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
        <aside className="w-[220px] min-h-screen flex flex-col justify-between"
            style={{ background: 'linear-gradient(180deg, #0f1a2e 0%, #132a46 100%)' }}>
            {/* Logo */}
            <div>
                <div className="flex items-center gap-3 px-5 py-6">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v20M2 12h20" />
                            <path d="M8 6l4-4 4 4" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-white font-bold text-base tracking-tight">PharmaAI</p>
                        <p className="text-[11px]" style={{ color: '#64748b' }}>Agentic Pharmacist</p>
                    </div>
                </div>

                {/* Nav Links */}
                <nav className="mt-2 px-3 space-y-1">
                    {navItems.map(({ to, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            className={({ isActive }) =>
                                `nav-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium ${isActive
                                    ? 'active'
                                    : 'text-[#94a3b8] hover:text-white'
                                }`
                            }
                        >
                            <Icon size={18} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>
            </div>

            {/* User Profile */}
            <div className="px-3 pb-4">
                <div className="rounded-xl p-3 mb-2"
                    style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f1a2e)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                            RG
                        </div>
                        <div>
                            <p className="text-white text-sm font-semibold">Dr. Rajesh Gupta</p>
                            <p className="text-[11px]" style={{ color: '#10b981' }}>Admin · Authenticated</p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl w-full transition-all"
                    style={{ color: '#94a3b8' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
