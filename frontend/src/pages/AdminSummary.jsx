import React, { useState, useEffect } from 'react';

import axios from 'axios';

import { LayoutDashboard, TrendingUp, Package, Trash2, ArrowRight, Search, Filter } from 'lucide-react';

import { useNavigate } from 'react-router-dom';

import '../App.css';



const API_BASE = 'http://localhost:5000/api';



const AdminHub = () => {

    const [stats, setStats] = useState({

        totalMedicines: 0,

        lowStockCount: 0,

        deletedCount: 0,

        totalSales: 0,

        recentOrders: []

    });

    const [loading, setLoading] = useState(true);

    // User search states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [userOrders, setUserOrders] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [dateFilter, setDateFilter] = useState('');
    const [loadingSearch, setLoadingSearch] = useState(false);

    const navigate = useNavigate();



    useEffect(() => {

        const fetchStats = async () => {

            try {

                const meds = await axios.get(`${API_BASE}/medicines`);

                const bin = await axios.get(`${API_BASE}/medicines/bin`);

                const orders = await axios.get(`${API_BASE}/orders/recent`);

                const totalSales = orders.data.reduce((acc, o) => acc + Number(o.total_price), 0);

                const lowStock = meds.data.filter(m => m.total_tablets < 30).length;

                setStats({

                    totalMedicines: meds.data.length,

                    lowStockCount: lowStock,

                    deletedCount: bin.data.length,

                    totalSales: totalSales,

                    recentOrders: orders.data

                });

            } catch (err) {

                console.error("Error fetching admin stats:", err);

                // Set fallback data when API fails
                setStats({
                    totalMedicines: 0,
                    lowStockCount: 0,
                    deletedCount: 0,
                    totalSales: 0,
                    recentOrders: []
                });

            } finally {

                setLoading(false);

            }

        };

        fetchStats();

    }, []);

    // Search functions - Real database integration
    const handleSearchChange = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (query.length >= 1) { // Trigger for any input
            setLoadingSearch(true);
            setShowSearchResults(true);

            try {
                // Use the consolidated customers/search endpoint
                const response = await axios.get(`${API_BASE}/customers/search?query=${encodeURIComponent(query)}`);
                setSearchResults(response.data || []);
            } catch (err) {
                console.error('Error searching customers:', err);
                setSearchResults([]);
            } finally {
                setLoadingSearch(false);
            }
        } else {
            setShowSearchResults(false);
            setSearchResults([]);
        }
    };

    const handleSearchSelect = async (item) => {
        setSelectedUser(item);
        setShowSearchResults(false);
        setSearchQuery(item.name);

        // Fetch user's orders using the correct endpoint
        setLoadingSearch(true);
        try {
            const response = await axios.get(`${API_BASE}/customers/orders?mobile=${encodeURIComponent(item.mobile)}&name=${encodeURIComponent(item.name)}`);
            setUserOrders(response.data || []);
        } catch (err) {
            console.error('Error fetching customer orders:', err);
            setUserOrders([]);
        } finally {
            setLoadingSearch(false);
        }
    };

    const handleDateFilter = async () => {
        if (dateFilter) {
            setLoadingSearch(true);
            try {
                // Use the unified search for date
                const response = await axios.get(`${API_BASE}/customers/search?query=${dateFilter}`);
                setSearchResults(response.data || []);
                setShowSearchResults(true);
                setSelectedUser(null);
            } catch (err) {
                console.error('Error filtering orders by date:', err);
                setSearchResults([]);
            } finally {
                setLoadingSearch(false);
            }
        }
    };



    if (loading) return <div className="loading-area">Loading Admin Summary...</div>;

    // Check if there's an API connection issue
    if (stats.totalMedicines === 0 && stats.lowStockCount === 0 && stats.deletedCount === 0 && stats.totalSales === 0) {
        return (
            <div className="admin-page-container">
                <div className="admin-title-area">
                    <h1 className="admin-title">Admin Hub</h1>
                    <p className="admin-subtitle">System Overview & Management</p>
                </div>
                <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    margin: '20px 0'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                    <h3 style={{ color: '#ef4444', marginBottom: '12px' }}>API Connection Error</h3>
                    <p style={{ color: '#64748b', marginBottom: '20px' }}>
                        Unable to connect to the backend server. Please check if the server is running on port 5000.
                    </p>
                    <div style={{
                        background: '#fef2f2',
                        padding: '16px',
                        borderRadius: '8px',
                        border: '1px solid #fecaca',
                        textAlign: 'left',
                        maxWidth: '500px',
                        margin: '0 auto'
                    }}>
                        <h4 style={{ color: '#dc2626', marginBottom: '8px' }}>Troubleshooting:</h4>
                        <ul style={{ color: '#64748b', fontSize: '14px', paddingLeft: '20px' }}>
                            <li>Make sure the backend server is running: <code>npm run dev</code> in the backend folder</li>
                            <li>Check if the server is accessible at: <code>http://localhost:5000</code></li>
                            <li>Verify the database connection is working</li>
                            <li>Check browser console for detailed error messages</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }



    return (

        <div className="admin-page-container">

            <div className="admin-stats-grid">

                {/* Alert Cards */}

                <div className="stat-card alert-card" onClick={() => navigate('/inventory?filter=expiring')} style={{ cursor: 'pointer' }}>

                    <div className="stat-icon icon-orange"><TrendingUp size={20} /></div>

                    <div className="stat-info">

                        <p className="stat-label">⚠️ Expiring Items</p>

                        <h2 className="stat-value">{stats.recentOrders.filter(o => {
                            // This is a placeholder - you might want to add expiring items to the stats
                            return false; // Will show 0 until you implement expiring items tracking
                        }).length}</h2>

                    </div>

                </div>

                <div className="stat-card alert-card" onClick={() => navigate('/inventory?filter=below-30')} style={{ cursor: 'pointer' }}>

                    <div className="stat-icon icon-red"><LayoutDashboard size={20} /></div>

                    <div className="stat-info">

                        <p className="stat-label">🚨 Low Stock Items</p>

                        <h2 className="stat-value">{stats.lowStockCount}</h2>

                    </div>

                </div>



                {/* Original Stats */}

                <div className="stat-card">

                    <div className="stat-icon icon-blue"><Package size={20} /></div>

                    <div className="stat-info">

                        <p className="stat-label">Total Inventory</p>

                        <h2 className="stat-value">{stats.totalMedicines}</h2>

                    </div>

                </div>

            </div>



            <div className="admin-content-grid">

                {/* User Search Block - Replaced System Alerts */}
                <div className="admin-card" style={{ zIndex: showSearchResults && searchResults.length > 0 ? 2000 : 1, position: 'relative' }}>
                    <div className="card-header">
                        <h3 className="card-title">🔍 User & Order Search</h3>
                    </div>
                    <div style={{ padding: '24px' }}>
                        {/* Search Input with Filter Button */}
                        <div style={{ position: 'relative', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <Search size={18} style={{
                                        position: 'absolute',
                                        left: '16px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: '#94a3b8',
                                        pointerEvents: 'none'
                                    }} />
                                    <input
                                        type="text"
                                        placeholder="Search users by name, email, phone, or ID..."
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSearchChange({ target: { value: searchQuery } })}
                                        style={{
                                            width: '100%',
                                            padding: '16px 20px 16px 48px',
                                            border: '2px solid #e2e8f0',
                                            borderRadius: '12px',
                                            fontSize: '15px',
                                            outline: 'none',
                                            transition: 'all 0.2s ease',
                                            background: '#ffffff',
                                            fontWeight: '500'
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#10b981';
                                            e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#e2e8f0';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => {
                                                setSearchQuery('');
                                                setSearchResults([]);
                                                setShowSearchResults(false);
                                            }}
                                            style={{
                                                position: 'absolute',
                                                right: '12px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                width: '24px',
                                                height: '24px',
                                                border: 'none',
                                                background: '#ef4444',
                                                borderRadius: '50%',
                                                color: 'white',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '16px',
                                                fontWeight: 'bold',
                                                zIndex: 5
                                            }}
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleSearchChange({ target: { value: searchQuery } })}
                                    style={{
                                        padding: '16px',
                                        background: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '52px'
                                    }}
                                    title="Search now"
                                >
                                    <Search size={18} />
                                </button>
                                <button
                                    onClick={() => setShowDateFilter(!showDateFilter)}
                                    style={{
                                        padding: '16px',
                                        background: showDateFilter ? '#10b981' : '#f8fafc',
                                        color: showDateFilter ? 'white' : '#64748b',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '52px'
                                    }}
                                    title="Filter by date"
                                >
                                    <Filter size={18} />
                                </button>
                            </div>

                            {/* Transparent Search Results Dropdown */}
                            {showSearchResults && searchResults.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: '0',
                                    width: '100%',
                                    marginTop: '8px',
                                    maxHeight: '60vh',
                                    background: 'rgba(255, 255, 255, 0.98)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '16px',
                                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)',
                                    zIndex: '10000',
                                    overflow: 'hidden',
                                    animation: 'fadeIn 0.2s ease-out'
                                }}>
                                    <div style={{
                                        padding: '20px',
                                        borderBottom: '1px solid rgba(226, 232, 240, 0.5)',
                                        background: 'rgba(248, 250, 252, 0.8)',
                                        fontWeight: '600',
                                        color: '#1e293b',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span>🔍 Search Results ({searchResults.length})</span>
                                        <button
                                            onClick={() => setShowSearchResults(false)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                fontSize: '24px',
                                                cursor: 'pointer',
                                                color: '#64748b',
                                                padding: '0',
                                                width: '30px',
                                                height: '30px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div style={{
                                        maxHeight: 'calc(60vh - 80px)',
                                        overflowY: 'auto'
                                    }}>
                                        {loadingSearch ? (
                                            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                                <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔍</div>
                                                Searching...
                                            </div>
                                        ) : (
                                            searchResults.map((item, index) => (
                                                <div
                                                    key={index}
                                                    onClick={() => handleSearchSelect(item)}
                                                    style={{
                                                        padding: '20px',
                                                        borderBottom: '1px solid rgba(241, 245, 249, 0.5)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s ease',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '16px'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                                                        e.currentTarget.style.transform = 'translateX(4px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                        e.currentTarget.style.transform = 'translateX(0)';
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '48px',
                                                        height: '48px',
                                                        borderRadius: '12px',
                                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        flexShrink: 0,
                                                        fontSize: '18px',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {item.name ? item.name.charAt(0).toUpperCase() : 'U'}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: '700', color: '#1e293b', marginBottom: '4px', fontSize: '16px' }}>
                                                            {item.name || 'Unknown User'}
                                                        </div>
                                                        <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '2px' }}>
                                                            📧 {item.email || 'No email'}
                                                        </div>
                                                        <div style={{ fontSize: '13px', color: '#64748b' }}>
                                                            📱 {item.mobile || 'No phone'} • 📦 {item.totalOrders || 0} orders
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        color: '#10b981',
                                                        fontSize: '20px',
                                                        transition: 'transform 0.3s ease'
                                                    }}>
                                                        <ArrowRight />
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Date Filter Panel */}
                        {showDateFilter && (
                            <div style={{
                                background: '#f8fafc',
                                padding: '20px',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                marginBottom: '16px'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{
                                            display: 'block',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            color: '#374151',
                                            marginBottom: '6px'
                                        }}>
                                            📅 Filter Orders by Date
                                        </label>
                                        <input
                                            type="date"
                                            value={dateFilter}
                                            onChange={(e) => setDateFilter(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                outline: 'none',
                                                background: 'white'
                                            }}
                                        />
                                    </div>
                                    <button
                                        onClick={handleDateFilter}
                                        disabled={!dateFilter || loadingSearch}
                                        style={{
                                            padding: '12px 24px',
                                            background: dateFilter && !loadingSearch ? '#10b981' : '#d1d5db',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            cursor: dateFilter && !loadingSearch ? 'pointer' : 'not-allowed',
                                            transition: 'all 0.2s ease',
                                            alignSelf: 'flex-end',
                                            opacity: dateFilter && !loadingSearch ? 1 : 0.6
                                        }}
                                    >
                                        {loadingSearch ? 'Filtering...' : 'Filter Orders'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* User Orders Display */}
                        {userOrders.length > 0 && (
                            <div style={{
                                marginTop: '20px',
                                background: 'white',
                                borderRadius: '16px',
                                border: '2px solid #e2e8f0',
                                overflow: 'hidden'
                            }}>
                                {/* Selected User Header */}
                                {selectedUser && (
                                    <div style={{
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        padding: '20px',
                                        color: 'white'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700' }}>
                                                    👤 {selectedUser.name}
                                                </h4>
                                                <p style={{ margin: '0', fontSize: '14px', opacity: 0.9 }}>
                                                    📧 {selectedUser.email || 'No email'} • 📱 {selectedUser.mobile || selectedUser.phone}
                                                </p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '24px', fontWeight: '800', lineHeight: '1' }}>
                                                        {userOrders.length}
                                                    </div>
                                                    <div style={{ fontSize: '12px', opacity: 0.8, fontWeight: '600' }}>
                                                        TOTAL ORDERS
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => navigate(`/ai-chat?user=${encodeURIComponent(selectedUser.name)}`)}
                                                    style={{
                                                        padding: '10px 16px',
                                                        background: 'rgba(255, 255, 255, 0.2)',
                                                        border: '1px solid rgba(255, 255, 255, 0.3)',
                                                        borderRadius: '8px',
                                                        color: 'white',
                                                        fontSize: '14px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                                                    onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                                                >
                                                    🛍️ Order Again
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Orders List */}
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {userOrders.map((order, index) => (
                                        <div key={index} style={{
                                            borderBottom: index < userOrders.length - 1 ? '1px solid #f1f5f9' : 'none',
                                            padding: '20px',
                                            transition: 'background-color 0.2s ease'
                                        }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f8fafc';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }}>
                                            {/* Order Header */}
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '16px',
                                                paddingBottom: '12px',
                                                borderBottom: '1px solid #e2e8f0'
                                            }}>
                                                <div>
                                                    <div style={{
                                                        fontSize: '16px',
                                                        fontWeight: '700',
                                                        color: '#1e293b',
                                                        marginBottom: '4px'
                                                    }}>
                                                        📦 Order #{order.id}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '13px',
                                                        color: '#64748b',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}>
                                                        📅 {new Date(order.date || order.createdAt).toLocaleDateString()}
                                                        <span style={{ color: '#d1d5db' }}>•</span>
                                                        🕐 {new Date(order.date || order.createdAt).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                                <div style={{
                                                    fontSize: '18px',
                                                    fontWeight: '800',
                                                    color: '#10b981'
                                                }}>
                                                    ₹{order.grandTotal?.toFixed(0) || '0'}
                                                </div>
                                            </div>

                                            {/* Order Items */}
                                            {order.items && order.items.length > 0 && (
                                                <div style={{ marginBottom: '16px' }}>
                                                    <div style={{
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        color: '#64748b',
                                                        marginBottom: '8px',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px'
                                                    }}>
                                                        💊 Medicines Ordered
                                                    </div>
                                                    {order.items.map((item, itemIndex) => (
                                                        <div key={itemIndex} style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '8px 0',
                                                            borderBottom: itemIndex < order.items.length - 1 ? '1px solid #f8fafc' : 'none'
                                                        }}>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{
                                                                    fontSize: '14px',
                                                                    fontWeight: '600',
                                                                    color: '#1e293b',
                                                                    marginBottom: '2px'
                                                                }}>
                                                                    {item.name || item.medicineName}
                                                                </div>
                                                                <div style={{
                                                                    fontSize: '12px',
                                                                    color: '#64748b'
                                                                }}>
                                                                    {item.brand || item.manufacturer} • {item.type || 'Tablet'}
                                                                </div>
                                                            </div>
                                                            <div style={{
                                                                fontSize: '13px',
                                                                fontWeight: '600',
                                                                color: '#64748b',
                                                                textAlign: 'center',
                                                                minWidth: '60px'
                                                            }}>
                                                                Qty: {item.quantity}
                                                            </div>
                                                            <div style={{
                                                                fontSize: '14px',
                                                                fontWeight: '700',
                                                                color: '#1e293b',
                                                                textAlign: 'right',
                                                                minWidth: '80px'
                                                            }}>
                                                                ₹{item.price?.toFixed(0) || '0'}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Order Summary */}
                                            <div style={{
                                                background: '#f8fafc',
                                                padding: '12px',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <div style={{ fontSize: '13px', color: '#64748b' }}>
                                                    {order.items ? `${order.items.length} items` : 'Order completed'}
                                                </div>
                                                <div style={{
                                                    fontSize: '15px',
                                                    fontWeight: '700',
                                                    color: '#1e293b'
                                                }}>
                                                    Total: ₹{order.grandTotal?.toFixed(2) || '0.00'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{
                            textAlign: 'center',
                            color: '#64748b',
                            fontSize: '13px',
                            fontStyle: 'italic',
                            marginTop: '16px'
                        }}>
                            🔍 Search for users by name, email, phone, or ID to view their order history
                        </div>
                    </div>
                </div>



                <div className="admin-card">

                    <div className="card-header">

                        <h3 className="card-title">📋 Recommendations</h3>

                    </div>

                    <div className="recommendations-list">

                        <div className="recommendation-item">

                            <span className="rec-icon">💊</span>

                            <span className="rec-text">Review expiring medicines and plan restock</span>

                        </div>

                        <div className="recommendation-item">

                            <span className="rec-icon">📈</span>

                            <span className="rec-text">Monitor low stock items frequently</span>

                        </div>

                        <div className="recommendation-item">

                            <span className="rec-icon">🔄</span>

                            <span className="rec-text">Consider automated reordering system</span>

                        </div>

                        <div className="recommendation-item">

                            <span className="rec-icon">📊</span>

                            <span className="rec-text">Analyze sales trends for better forecasting</span>

                        </div>

                    </div>

                </div>



                {/* System Alerts Block - Below Recommendations */}
                <div className="admin-card">

                    <div className="card-header">

                        <h3 className="card-title">🚨 System Alerts</h3>

                    </div>

                    <div className="alerts-list">

                        <div className="alert-item">

                            <span className="alert-icon">⚠️</span>

                            <span className="alert-text">3 medicines expiring this month</span>

                        </div>

                        <div className="alert-item">

                            <span className="alert-icon">📉</span>

                            <span className="alert-text">Low stock on 5 critical items</span>

                        </div>

                        <div className="alert-item">

                            <span className="alert-icon">💾</span>

                            <span className="alert-text">Database backup scheduled for tonight</span>

                        </div>

                    </div>

                </div>



                <div className="admin-card">

                    <div className="card-header">

                        <h3 className="card-title">Quick Actions</h3>

                    </div>

                    <div className="quick-actions-list">

                        <button className="q-action-btn" onClick={() => navigate('/inventory')}>

                            <Package size={16} /> Manage Stock

                        </button>

                        <button className="q-action-btn" onClick={() => navigate('/bin')}>

                            <Trash2 size={16} /> Empty Recycle Bin

                        </button>

                    </div>

                </div>

            </div>

            <div style={{
                marginTop: '20px',
                textAlign: 'center',
                padding: '20px',
                color: '#94a3b8',
                fontSize: '12px',
                borderTop: '1px solid #f1f5f9'
            }}>
                <div style={{ marginBottom: '8px' }}>
                    <strong>Admin Hub Dashboard</strong> - Real-time System Monitoring
                </div>
                <div>
                    <strong>Last Updated:</strong> {new Date().toLocaleString()}
                </div>
            </div>

        </div>

    );

};



export default AdminHub;
