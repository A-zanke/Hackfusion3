import React, { useState } from 'react';
import { X } from 'lucide-react';

const StatsModal = ({ config, onClose }) => {
    if (!config) return null;

    const [filter, setFilter] = useState('Daily'); // For Sales

    // Close on background click
    const handleBgClick = (e) => {
        if (e.target.className === 'modal-overlay') onClose();
    };

    const renderSalesTable = () => {
        // Filter logic for sales
        const now = new Date();
        const filteredData = config.data.filter(item => {
            const itemDate = new Date(item.created_at);
            if (filter === 'Daily') return itemDate.toDateString() === now.toDateString();
            if (filter === 'Weekly') {
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);
                return itemDate >= weekAgo;
            }
            if (filter === 'Monthly') return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
            if (filter === 'Yearly') return itemDate.getFullYear() === now.getFullYear();
            return true;
        });

        return (
            <div>
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '10px' }}>
                    {['Daily', 'Weekly', 'Monthly', 'Yearly'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '5px 10px',
                                background: filter === f ? '#10b981' : '#e5e7eb',
                                color: filter === f ? 'white' : 'black',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >{f}</button>
                    ))}
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #ddd' }}>
                                <th style={{ padding: '8px' }}>Order ID</th>
                                <th>Medicine</th>
                                <th>Quantity</th>
                                <th>Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((s, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '8px' }}>{s.order_id}</td>
                                    <td>{s.medicine_name}</td>
                                    <td>{s.quantity}</td>
                                    <td>₹{s.price}</td>
                                    <td>₹{s.total}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredData.length === 0 && <p style={{ padding: '10px', textAlign: 'center' }}>No sales found for this period.</p>}
                </div>
            </div>
        );
    };

    const renderOrdersTable = () => (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <th style={{ padding: '8px' }}>Order ID</th>
                        <th>Customer</th>
                        <th>Medicines</th>
                        <th>Status</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    {config.data.map((o, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px' }}>{o.order_id}</td>
                            <td>{o.customer_name || 'Anonymous'}</td>
                            <td>{o.medicines}</td>
                            <td>
                                <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', background: o.status === 'completed' ? '#d1fae5' : '#fef3c7', color: o.status === 'completed' ? '#065f46' : '#92400e' }}>
                                    {o.status}
                                </span>
                            </td>
                            <td>{new Date(o.created_at).toLocaleDateString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderLowStockTable = () => (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <th style={{ padding: '8px' }}>Medicine Name</th>
                        <th>Remaining Quantity</th>
                        <th>Threshold</th>
                    </tr>
                </thead>
                <tbody>
                    {config.data.map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px' }}>{m.name}</td>
                            <td style={{ color: '#ef4444', fontWeight: 'bold' }}>{m.remaining_quantity}</td>
                            <td>{m.low_stock_threshold}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderRepeatCustomersTable = () => (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <th style={{ padding: '8px' }}>Customer Name</th>
                        <th>Mobile</th>
                        <th>Order Count</th>
                    </tr>
                </thead>
                <tbody>
                    {config.data.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px' }}>{c.name}</td>
                            <td>{c.mobile || 'N/A'}</td>
                            <td style={{ fontWeight: 'bold', color: '#3b82f6' }}>{c.order_count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderFastMovingTable = () => (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <th style={{ padding: '8px' }}>Medicine Name</th>
                        <th>Total Sold (Units)</th>
                    </tr>
                </thead>
                <tbody>
                    {config.data.map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px' }}>{m.name}</td>
                            <td style={{ fontWeight: 'bold', color: '#a855f7' }}>{m.total_sold}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderNearExpiryTable = () => (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <th style={{ padding: '8px' }}>Medicine Name</th>
                        <th>Expiry Date</th>
                        <th>Days Left</th>
                    </tr>
                </thead>
                <tbody>
                    {config.data.map((m, i) => {
                        const daysLeft = Math.ceil((new Date(m.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                        return (
                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '8px' }}>{m.name}</td>
                                <td>{new Date(m.expiry_date).toLocaleDateString()}</td>
                                <td style={{ color: daysLeft <= 30 ? '#ef4444' : '#f59e0b', fontWeight: 'bold' }}>
                                    {daysLeft} days
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );

    const renderContent = () => {
        switch (config.type) {
            case 'sales': return renderSalesTable();
            case 'orders': return renderOrdersTable();
            case 'lowStock': return renderLowStockTable();
            case 'repeatCustomers': return renderRepeatCustomersTable();
            case 'fastMoving': return renderFastMovingTable();
            case 'nearExpiry': return renderNearExpiryTable();
            default: return null;
        }
    };

    return (
        <div
            className="modal-overlay"
            onClick={handleBgClick}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
        >
            <div
                style={{
                    background: 'white', padding: '24px', borderRadius: '12px',
                    width: '90%', maxWidth: '800px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                    position: 'relative', overflow: 'hidden'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>{config.title}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                        <X size={24} color="#6b7280" />
                    </button>
                </div>
                {renderContent()}
            </div>
        </div>
    );
};

export default StatsModal;
