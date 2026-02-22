import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Clock, ChevronDown } from 'lucide-react';
import '../App.css';

const API_BASE = 'http://localhost:5000/api';

const botBadges = {
    Stock: { label: 'OrderBot', bg: '#dbeafe', color: '#2563eb' },
    Expiry: { label: 'ExpiryBot', bg: '#d1fae5', color: '#059669' },
    User: { label: 'SafetyBot', bg: '#fee2e2', color: '#dc2626' },
    default: { label: 'SystemBot', bg: '#f3e8ff', color: '#7c3aed' },
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

    const getActionName = (alert) => {
        if (alert.type === 'Stock') return 'Order Processing';
        if (alert.type === 'Expiry') return 'Expiry Scan';
        if (alert.type === 'User') return 'Overdose Prevention';
        return 'System Event';
    };

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
            <div className="h-[60vh] flex items-center justify-center">
                <div className="flex items-center gap-3 font-bold animate-pulse" style={{ color: '#10b981' }}>
                    <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
                        style={{ borderColor: '#10b981', borderTopColor: 'transparent' }}></div>
                    Loading Trace Logs...
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Title */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>AI Trace Logs</h1>
                <p className="text-sm" style={{ color: '#10b981' }}>Full transparency into every AI decision and action</p>
            </div>

            {/* Log Panel */}
            <div className="bg-white rounded-2xl border animate-fade-in" style={{ borderColor: '#f1f5f9' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <div className="flex items-center gap-2">
                        <FileText size={18} style={{ color: '#3b82f6' }} />
                        <h3 className="font-bold text-base" style={{ color: '#0f172a' }}>AI Trace Logs</h3>
                        <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                            style={{ background: '#dbeafe', color: '#2563eb' }}>{alerts.length} entries</span>
                    </div>

                    <div className="flex gap-2">
                        {['All', 'Info', 'Warning', 'Error'].map(f => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                                style={{
                                    background: activeFilter === f ? '#3b82f6' : 'transparent',
                                    color: activeFilter === f ? 'white' : '#64748b',
                                    border: activeFilter === f ? 'none' : '1px solid #e2e8f0',
                                }}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Log Entries */}
                <div className="divide-y" style={{ borderColor: '#f8fafc' }}>
                    {filteredAlerts.length === 0 ? (
                        <div className="px-6 py-12 text-center text-sm" style={{ color: '#94a3b8' }}>
                            No trace logs found for this filter
                        </div>
                    ) : (
                        filteredAlerts.map((alert, i) => {
                            const badge = botBadges[alert.type] || botBadges.default;
                            return (
                                <div key={alert.id}
                                    className="flex items-center justify-between px-6 py-4 table-row-hover animate-fade-in"
                                    style={{ animationDelay: `${i * 0.05}s` }}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                                            style={{ background: '#f0f4f8' }}>
                                            <FileText size={16} style={{ color: '#64748b' }} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold" style={{ color: '#0f172a' }}>{getActionName(alert)}</p>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                                    style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                                            </div>
                                            <p className="text-[12px] mt-0.5" style={{ color: '#94a3b8' }}>{alert.message}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1 text-[12px]" style={{ color: '#94a3b8' }}>
                                            <Clock size={12} />
                                            {new Date(alert.created_at).toLocaleString()}
                                        </div>
                                        <ChevronDown size={14} style={{ color: '#94a3b8' }} />
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
