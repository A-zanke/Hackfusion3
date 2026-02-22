import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../ui/Sidebar';
import { Bell, Settings } from 'lucide-react';

const MainLayout = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: '#f0f4f8' }}>
            <Sidebar />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header */}
                <header className="h-16 flex items-center justify-between px-8 bg-white border-b"
                    style={{ borderColor: '#e2e8f0' }}>
                    <div>
                        <p className="text-sm font-semibold" style={{ color: '#0f172a' }}>
                            Welcome, Dr. Rajesh Gupta
                        </p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>{dateStr}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                            style={{ background: '#10b981', color: 'white' }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-white inline-block"></span>
                            Admin
                        </span>

                        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100"
                            style={{ color: '#64748b' }}>
                            <Bell size={18} />
                            <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                                style={{ background: '#ef4444', color: 'white' }}>
                                7
                            </span>
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
