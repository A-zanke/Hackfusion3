import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, Search, ShoppingCart, Clock, Package } from 'lucide-react';
import '../App.css';

const API_BASE = 'http://localhost:5000/api';

const Orders = () => {
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [orderInput, setOrderInput] = useState('');
    const [mobileInput, setMobileInput] = useState('');

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const res = await axios.get(`${API_BASE}/orders/recent`);
                setRecentOrders(res.data);
            } catch (err) {
                console.error("Error fetching orders:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <div className="flex items-center gap-3 font-bold animate-pulse" style={{ color: '#10b981' }}>
                    <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
                        style={{ borderColor: '#10b981', borderTopColor: 'transparent' }}></div>
                    Loading Orders...
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Title */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Order Management</h1>
                <p className="text-sm" style={{ color: '#10b981' }}>Process orders, lookup users, and manage prescriptions</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick Order + Recent Orders */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Quick Order */}
                    <div className="bg-white rounded-2xl p-6 border animate-fade-in" style={{ borderColor: '#f1f5f9' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: '#dbeafe' }}>
                                <ShoppingCart size={16} style={{ color: '#3b82f6' }} />
                            </div>
                            <h3 className="font-bold text-base" style={{ color: '#0f172a' }}>Quick Order</h3>
                        </div>
                        <p className="text-xs mb-4" style={{ color: '#94a3b8' }}>
                            Enter order (e.g. "2 Crocin + 1 ORS + 5 Vitamin C")
                        </p>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={orderInput}
                                onChange={e => setOrderInput(e.target.value)}
                                placeholder="2 Paracetamol + 1 Omeprazole..."
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none"
                                style={{ borderColor: '#e2e8f0', color: '#0f172a' }}
                            />
                            <button className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2"
                                style={{ background: '#10b981' }}>
                                <Sparkles size={14} /> Parse
                            </button>
                        </div>
                    </div>

                    {/* Recent Orders */}
                    <div className="bg-white rounded-2xl p-6 border animate-fade-in" style={{ borderColor: '#f1f5f9' }}>
                        <div className="flex items-center gap-2 mb-5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: '#d1fae5' }}>
                                <Package size={16} style={{ color: '#10b981' }} />
                            </div>
                            <h3 className="font-bold text-base" style={{ color: '#0f172a' }}>Recent Orders</h3>
                            <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                                style={{ background: '#dbeafe', color: '#2563eb' }}>{recentOrders.length}</span>
                        </div>

                        <div className="space-y-3">
                            {recentOrders.map((order, i) => (
                                <div key={order.id}
                                    className="flex items-center justify-between p-4 rounded-xl transition-colors animate-fade-in"
                                    style={{
                                        background: '#f8fafc',
                                        animationDelay: `${i * 0.05}s`
                                    }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                                            style={{ background: '#d1fae5' }}>
                                            <Package size={16} style={{ color: '#10b981' }} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: '#0f172a' }}>
                                                ORD{String(order.id).padStart(3, '0')}
                                            </p>
                                            <p className="text-[11px]" style={{ color: '#94a3b8' }}>
                                                {order.customer_name || 'Walk-in'} · {order.mobile || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold" style={{ color: '#10b981' }}>
                                            ₹{Number(order.total_price).toFixed(2)}
                                        </p>
                                        <p className="text-[11px] flex items-center gap-1 justify-end" style={{ color: '#94a3b8' }}>
                                            <Clock size={10} />
                                            {new Date(order.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* User Lookup */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 border animate-fade-in" style={{ borderColor: '#f1f5f9' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: '#e0e7ff' }}>
                                <Search size={16} style={{ color: '#6366f1' }} />
                            </div>
                            <h3 className="font-bold text-base" style={{ color: '#0f172a' }}>User Lookup</h3>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={mobileInput}
                                onChange={e => setMobileInput(e.target.value)}
                                placeholder="Enter mobile number..."
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none"
                                style={{ borderColor: '#e2e8f0', color: '#0f172a' }}
                            />
                            <button className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                                style={{ background: '#ef4444' }}>
                                Search
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Orders;
