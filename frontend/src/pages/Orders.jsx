import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingCart, Phone, ClipboardList, ShoppingBag, Clock, Sparkles } from 'lucide-react';
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
            <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold', color: '#10b981' }}>
                    Loading Orders...
                </div>
            </div>
        );
    }

    return (
        <div className="orders-page-container">
            {/* Title */}
            <div className="orders-title-area">
                <h1 className="orders-title">Order Management</h1>
                <p className="orders-subtitle">Process orders, lookup users, and manage prescriptions</p>
            </div>

            <div className="orders-grid">
                {/* Main Column: Quick Order + Recent Orders */}
                <div className="orders-main-col">

                    {/* Quick Order */}
                    <div className="orders-card animate-fade-in">
                        <div className="orders-card-header" style={{ marginBottom: '8px' }}>
                            <div className="orders-card-icon icon-blue">
                                <ShoppingCart size={20} />
                            </div>
                            <h3 className="orders-card-title">Quick Order</h3>
                        </div>
                        <p className="orders-card-subtitle">
                            Enter order (e.g. "2 Crocin + 1 ORS + 5 Vitamin C")
                        </p>
                        <div className="orders-input-row">
                            <input
                                type="text"
                                value={orderInput}
                                onChange={e => setOrderInput(e.target.value)}
                                placeholder="2 Paracetamol + 1 Omeprazole..."
                                className="orders-input"
                            />
                            <button className="orders-btn btn-green">
                                <Sparkles size={16} /> Parse
                            </button>
                        </div>
                    </div>

                    {/* Recent Orders */}
                    <div className="orders-recent-card animate-fade-in delay-1">
                        <div className="orders-recent-header">
                            <div className="orders-card-title" style={{ gap: '12px' }}>
                                <div className="orders-card-icon icon-blue">
                                    <ClipboardList size={20} />
                                </div>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    Recent Orders
                                    <span className="orders-badge">{recentOrders.length}</span>
                                </span>
                            </div>
                        </div>

                        <div className="orders-list-area">
                            {recentOrders.map((order, i) => (
                                <div key={order.id} className="order-item animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                                    <div className="order-item-left">
                                        <div className="order-item-icon">
                                            <ShoppingBag size={20} />
                                        </div>
                                        <div>
                                            <p className="order-item-id">
                                                ORD{String(order.id).padStart(3, '0')}
                                            </p>
                                            <p className="order-item-desc">
                                                {order.customer_name || 'Walk-in'} · {order.mobile || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="order-item-right">
                                        <p className="order-item-price">
                                            ₹{Number(order.total_price).toFixed(2)}
                                        </p>
                                        <p className="order-item-date">
                                            <Clock size={12} />
                                            {new Date(order.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Side Column: User Lookup */}
                <div className="orders-side-col">
                    <div className="orders-card animate-fade-in delay-2">
                        <div className="orders-card-header">
                            <div className="orders-card-icon icon-blue">
                                <Phone size={20} />
                            </div>
                            <h3 className="orders-card-title">User Lookup</h3>
                        </div>
                        <div className="orders-input-row">
                            <input
                                type="text"
                                value={mobileInput}
                                onChange={e => setMobileInput(e.target.value)}
                                placeholder="Enter mobile number..."
                                className="orders-input"
                            />
                            <button className="orders-btn btn-blue">
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
