import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../ui/Sidebar';
import { Bell } from 'lucide-react';
import '../App.css';

const MainLayout = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    return (
        <div className="app-container">
            <Sidebar />

            <div className="main-content-wrapper">
                <header className="top-header">
                    <div>
                        <p className="header-date">{dateStr}</p>
                    </div>

                    <div className="header-actions">
                        <span className="admin-badge">
                            <span className="admin-badge-dot"></span>
                            Admin
                        </span>

                        <button className="notification-btn">
                            <Bell size={20} />
                            <span className="notification-dot">7</span>
                        </button>
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
