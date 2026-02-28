import React, { useState } from 'react';
import { X, RefreshCw, Calendar, FileText, Package, Users, AlertCircle } from 'lucide-react';

const DetailModal = ({ isOpen, onClose, title, data, type, loading, salesPeriod, onPeriodChange }) => {
    if (!isOpen) return null;

    const handleBgClick = (e) => {
        if (e.target.className === 'modal-overlay') onClose();
    };

    const renderSalesTable = () => (
        <div className="modal-table-container">
            <div className="period-selector">
                {['daily', 'weekly', 'monthly', 'yearly'].map(p => (
                    <button
                        key={p}
                        onClick={() => onPeriodChange(p)}
                        className={`period-btn ${salesPeriod === p ? 'active' : ''}`}
                    >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                ))}
            </div>
            <table className="premium-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Customer</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((order) => (
                        <tr key={order.id}>
                            <td>#{order.id}</td>
                            <td>{order.customer_name || 'Anonymous'}</td>
                            <td className="text-green fw-bold">₹{parseFloat(order.total_price).toLocaleString()}</td>
                            <td>
                                <span className={`status-pill ${order.status}`}>
                                    {order.status}
                                </span>
                            </td>
                            <td>{new Date(order.created_at).toLocaleDateString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {data.length === 0 && <p className="empty-msg">No sales found for this period.</p>}
        </div>
    );

    const renderInventoryTable = () => (
        <div className="modal-table-container">
            <table className="premium-table">
                <thead>
                    <tr>
                        <th>Medicine</th>
                        <th>Stock</th>
                        <th>Threshold</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((med) => (
                        <tr key={med.id}>
                            <td className="fw-medium">{med.name}</td>
                            <td className="text-orange fw-bold">{med.total_tablets}</td>
                            <td>{med.low_stock_threshold}</td>
                            <td>
                                <span className="status-pill warning">Low Stock</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {data.length === 0 && <p className="empty-msg">All stock levels are healthy.</p>}
        </div>
    );

    const renderExpiryTable = () => (
        <div className="modal-table-container">
            <table className="premium-table">
                <thead>
                    <tr>
                        <th>Medicine</th>
                        <th>Expiry Date</th>
                        <th>Risk Level</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((med) => {
                        const daysLeft = Math.ceil((new Date(med.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                        return (
                            <tr key={med.id}>
                                <td className="fw-medium">{med.name}</td>
                                <td>{new Date(med.expiry_date).toLocaleDateString()}</td>
                                <td>
                                    <span className={`status-pill ${daysLeft < 30 ? 'critical' : 'warning'}`}>
                                        {daysLeft} days left
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {data.length === 0 && <p className="empty-msg">No medicines near expiry.</p>}
        </div>
    );

    const renderCustomerTable = () => (
        <div className="modal-table-container">
            <table className="premium-table">
                <thead>
                    <tr>
                        <th>Customer</th>
                        <th>Mobile</th>
                        <th>Orders</th>
                        <th>Total Spend</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((customer, i) => (
                        <tr key={i}>
                            <td className="fw-medium">{customer.customer_name}</td>
                            <td>{customer.mobile}</td>
                            <td className="text-blue fw-bold">{customer.order_count}</td>
                            <td className="text-green fw-bold">₹{parseFloat(customer.total_spent).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderSearchReport = () => (
        <div className="search-report">
            <div className="report-section">
                <h4><Package size={16} /> Medicines Found ({data.medicines?.length || 0})</h4>
                <div className="report-grid">
                    {data.medicines?.map(m => (
                        <div key={m.id} className="report-item glass">
                            <h5>{m.name}</h5>
                            <p>{m.brand} | {m.category}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="report-section">
                <h4><FileText size={16} /> Orders Found ({data.orders?.length || 0})</h4>
                <div className="report-list">
                    {data.orders?.map(o => (
                        <div key={o.id} className="report-list-item glass">
                            <span>#{o.id} - {o.customer_name}</span>
                            <span className="text-green">₹{parseFloat(o.total_price).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderGenericTable = () => (
        <div className="modal-table-container">
            <table className="premium-table">
                <thead>
                    <tr>
                        {data.length > 0 && Object.keys(data[0]).filter(k => k !== 'id').map(key => (
                            <th key={key}>{key.replace(/_/g, ' ').toUpperCase()}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, i) => (
                        <tr key={i}>
                            {Object.entries(item).filter(([k]) => k !== 'id').map(([key, val], j) => (
                                <td key={j}>{typeof val === 'number' ? val.toLocaleString() : String(val)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {data.length === 0 && <p className="empty-msg">No data available.</p>}
        </div>
    );

    const renderContent = () => {
        if (loading) return (
            <div className="modal-loader">
                <RefreshCw className="rotate-icon" />
                <p>Retrieving secure ledger data...</p>
            </div>
        );

        switch (type) {
            case 'sales': return renderSalesTable();
            case 'low-stock': return renderInventoryTable();
            case 'near-expiry': return renderExpiryTable();
            case 'repeat-customers': return renderCustomerTable();
            case 'search-all': return renderSearchReport();
            default: return renderGenericTable();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleBgClick}>
            <div className={`detail-modal-glass ${type === 'search-all' ? 'large' : ''}`}>
                <div className="modal-header">
                    <div className="header-info">
                        <div className="header-icon-ring">
                            <AlertCircle size={20} className="text-blue" />
                        </div>
                        <h2>{title}</h2>
                    </div>
                    <button onClick={onClose} className="close-btn">
                        <X size={24} />
                    </button>
                </div>
                <div className="modal-body">
                    {renderContent()}
                </div>
            </div>
            <style>{`
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(8px);
                    z-index: 2000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.3s ease;
                }

                .detail-modal-glass {
                    background: rgba(255, 255, 255, 0.9);
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    border-radius: 24px;
                    width: 90%;
                    max-width: 800px;
                    max-height: 85vh;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: modalSlideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .detail-modal-glass.large {
                    max-width: 1000px;
                }

                .modal-header {
                    padding: 24px 32px;
                    border-bottom: 1px solid #f1f5f9;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .header-info {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .header-icon-ring {
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    background: #eff6ff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .modal-header h2 {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: #1e293b;
                }

                .close-btn {
                    background: #f1f5f9;
                    border: none;
                    border-radius: 12px;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #64748b;
                    transition: all 0.2s;
                }

                .close-btn:hover {
                    background: #e2e8f0;
                    color: #0f172a;
                    transform: rotate(90deg);
                }

                .modal-body {
                    padding: 32px;
                    overflow-y: auto;
                    flex: 1;
                }

                /* Tables */
                .modal-table-container {
                    width: 100%;
                }

                .premium-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }

                .premium-table th {
                    padding: 12px 16px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid #f1f5f9;
                }

                .premium-table td {
                    padding: 16px;
                    font-size: 0.95rem;
                    color: #334155;
                    border-bottom: 1px solid #f8fafc;
                }

                .premium-table tr:last-child td {
                    border-bottom: none;
                }

                /* UI Elements */
                .status-pill {
                    padding: 4px 12px;
                    border-radius: 999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .status-pill.completed { background: #dcfce7; color: #166534; }
                .status-pill.pending { background: #fef9c3; color: #854d0e; }
                .status-pill.warning { background: #ffedd5; color: #9a3412; }
                .status-pill.critical { background: #fee2e2; color: #991b1b; }

                .text-green { color: #10b981; }
                .text-blue { color: #3b82f6; }
                .text-orange { color: #f59e0b; }
                .fw-bold { font-weight: 700; }
                .fw-medium { font-weight: 600; }

                .period-selector {
                    display: flex;
                    gap: 8px;
                    background: #f1f5f9;
                    padding: 4px;
                    border-radius: 12px;
                    margin-bottom: 24px;
                    width: fit-content;
                }

                .period-btn {
                    padding: 6px 16px;
                    border: none;
                    background: transparent;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .period-btn.active {
                    background: white;
                    color: #3b82f6;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                }

                .modal-loader {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                    padding: 40px;
                }

                .rotate-icon {
                    animation: spin 1s linear infinite;
                    color: #3b82f6;
                    width: 32px;
                    height: 32px;
                }

                .empty-msg {
                    text-align: center;
                    color: #94a3b8;
                    padding: 40px;
                }

                /* Search Report */
                .report-section { margin-bottom: 32px; }
                .report-section h4 { 
                    display: flex; 
                    align-items: center; 
                    gap: 8px; 
                    color: #1e293b; 
                    margin-bottom: 16px; 
                }
                .report-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 16px;
                }
                .report-item {
                    padding: 16px;
                    border-radius: 16px;
                    background: #f8fafc;
                }
                .report-item h5 { margin: 0 0 4px 0; color: #334155; }
                .report-item p { margin: 0; font-size: 0.8rem; color: #64748b; }
                .report-list-item {
                    padding: 12px 20px;
                    border-radius: 12px;
                    background: #f8fafc;
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-weight: 500;
                }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes modalSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default DetailModal;
