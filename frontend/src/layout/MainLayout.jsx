import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../ui/Sidebar';
import { Bell } from 'lucide-react';
import '../App.css';

const MainLayout = () => {
    const location = useLocation();
    const [currentTime, setCurrentTime] = useState(new Date());
    
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
        switch(path) {
            case '/inventory':
                return 'Inventory Management';
            case '/orders':
                return 'Orders';
            case '/bin':
                return 'Bin';
            case '/trace-logs':
                return 'Trace Logs';
            case '/ai-chat':
                return 'AI Chat';
            case '/admin':
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
