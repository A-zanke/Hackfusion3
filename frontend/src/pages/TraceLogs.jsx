import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Clock, ChevronDown } from 'lucide-react';
import '../App.css';

const API_BASE = 'http://localhost:5000/api';

const botBadges = {
    Stock: { label: 'OrderBot', badgeColor: 'bot-badge-blue' },
    Expiry: { label: 'ExpiryBot', badgeColor: 'bot-badge-orange' },
    User: { label: 'SafetyBot', badgeColor: 'bot-badge-red' },
    default: { label: 'SystemBot', badgeColor: 'bot-badge-gray' },
};

const getActionName = (alert) => {
    if (alert.type === 'Stock') return 'Order Processing';
    if (alert.type === 'Expiry') return 'Expiry Scan';
    if (alert.type === 'User') return 'Overdose Prevention';
    return 'System Event';
};

const getIconColorClass = (alert) => {
    if (alert.type === 'Stock') return 'trace-icon-blue';
    if (alert.type === 'Expiry') return 'trace-icon-orange';
    if (alert.type === 'User') return 'trace-icon-red';
    return 'trace-icon-gray';
};

const TraceLogs = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('All');

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                const res = await axios.get(`${API_BASE}/alerts`);
                setAlerts(res.data);
            } catch (err) {
                console.error("Error fetching alerts:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAlerts();
        const interval = setInterval(fetchAlerts, 30000);
        return () => clearInterval(interval);
    }, []);

    const filteredAlerts = activeFilter === 'All'
        ? alerts
        : alerts.filter(a => {
            if (activeFilter === 'Info') return a.type === 'Stock';
            if (activeFilter === 'Warning') return a.type === 'Expiry';
            if (activeFilter === 'Error') return a.type === 'User';
            return true;
        });

    if (loading) {
        return (
            <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold', color: '#10b981' }}>
                    Loading Trace Logs...
                </div>
            </div>
        );
    }

    return (
        <div className="trace-page-container">
            {/* Title */}
            <div className="trace-title-area">
                <h1 className="trace-title">AI Trace Logs</h1>
                <p className="trace-subtitle">Full transparency into every AI decision and action</p>
            </div>

            {/* Log Panel */}
            <div className="trace-panel animate-fade-in">
                {/* Header */}
                <div className="trace-header">
                    <div className="trace-header-left">
                        <FileText size={20} className="trace-header-icon" />
                        <h3 className="trace-header-title">AI Trace Logs</h3>
                        <span className="trace-count-badge">
                            {alerts.length} entries
                        </span>
                    </div>

                    <div className="trace-filters">
                        {['All', 'Info', 'Warning', 'Error'].map(f => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                className={`trace-filter-btn ${activeFilter === f ? 'active' : ''}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Log Entries */}
                <div className="trace-list">
                    {filteredAlerts.length === 0 ? (
                        <div className="trace-empty">
                            No trace logs found for this filter
                        </div>
                    ) : (
                        filteredAlerts.map((alert, i) => {
                            const badge = botBadges[alert.type] || botBadges.default;
                            const iconClass = getIconColorClass(alert);
                            return (
                                <div key={alert.id} className="trace-item animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>

                                    <div className="trace-item-left">
                                        <div className={`trace-item-icon ${iconClass}`}>
                                            <FileText size={18} />
                                        </div>
                                        <div className="trace-item-content">
                                            <div className="trace-item-header">
                                                <p className="trace-item-title">{getActionName(alert)}</p>
                                                <span className={`bot-badge ${badge.badgeColor}`}>{badge.label}</span>
                                            </div>
                                            <p className="trace-item-desc">{alert.message || 'System log execution complete.'}</p>
                                        </div>
                                    </div>

                                    <div className="trace-item-right">
                                        <div className="trace-item-time">
                                            <Clock size={12} />
                                            {/* Simulate exact formatting "2026-02-20 00:15:32" as per screenshot */}
                                            {alert.created_at ? alert.created_at.replace('T', ' ').substring(0, 19) : ''}
                                        </div>
                                        <ChevronDown size={14} className="trace-item-chevron" />
                                    </div>

                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default TraceLogs;
