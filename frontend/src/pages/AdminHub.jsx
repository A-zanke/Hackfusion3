import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Search,
  User,
  Phone,
  Calendar,
  Package,
  DollarSign,
  FileText,
  Filter,
  Download,
  Eye,
  TrendingUp,
  Clock,
  ChevronRight,
  Users,
  ShoppingCart,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import "../App.css";

const API_BASE_URL = "http://localhost:5000/api";

const AdminHub = () => {
  // Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState("name"); // 'name' or 'mobile'
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [allCustomers, setAllCustomers] = useState([]);
  const [allOrdersData, setAllOrdersData] = useState({ count: 0, revenue: 0 });

  // Fetch all customers and orders on mount
  useEffect(() => {
    fetchAllCustomers();
  }, []);

  // Fetch all customers from database
  const fetchAllCustomers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/customers`);
      setAllCustomers(response.data);
      // Calculate total orders and revenue
      const totalOrders = response.data.reduce(
        (sum, c) => sum + c.totalOrders,
        0,
      );
      const totalRevenue = response.data.reduce(
        (sum, c) => sum + c.totalSpent,
        0,
      );
      setAllOrdersData({ count: totalOrders, revenue: totalRevenue });
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  // Search users
  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setLoading(true);

    try {
      // Call API to search customers - passing searchTerm directly
      const response = await axios.get(`${API_BASE_URL}/customers/search`, {
        params: {
          query: searchTerm,
          type: searchType
        }
      });
      setSearchResults(response.data);
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
      setLoading(false);
    }
  }, [searchTerm, searchType]);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      // Search if searchTerm has at least 1 character as requested by user
      if (searchTerm.trim().length >= 1) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [searchTerm, searchType, handleSearch]);

  // Get user order history
  const getUserOrderHistory = useCallback(
    async (user) => {
      setSelectedUser(user);
      setLoading(true);

      try {
        // Call API to get customer orders
        const response = await axios.get(`${API_BASE_URL}/customers/orders`, {
          params: {
            mobile: user.mobile,
            name: user.name // Pass name as fallback
          }
        });
        setUserOrders(response.data);
      } catch (error) {
        console.error("Error fetching order history:", error);
        setUserOrders([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Select user from search results
  const selectUser = useCallback(
    (user) => {
      getUserOrderHistory(user);
    },
    [getUserOrderHistory],
  );

  // Clear search results
  const clearSearch = useCallback(() => {
    setSearchTerm("");
    setSearchResults([]);
    setSelectedUser(null);
    setUserOrders([]);
  }, []);

  // Handle re-ordering
  const handleReorder = (medicineName, quantity) => {
    window.location.href = `/ai-chat?reorder=${encodeURIComponent(medicineName)}&qty=${quantity}`;
  };

  // Get order status badge
  const getOrderStatusBadge = (status) => {
    const statusConfig = getStatusColor(status);
    const StatusIcon = statusConfig.icon;
    return (
      <div
        className={`order-status-badge ${status}`}
        style={{
          color: statusConfig.color,
          backgroundColor: statusConfig.bg,
        }}
      >
        <StatusIcon size={14} />
        <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </div>
    );
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle search type change
  const handleSearchTypeChange = (type) => {
    setSearchType(type);
    setSearchResults([]);
    setSelectedUser(null);
    setUserOrders([]);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "delivered":
        return { color: "#10b981", bg: "#ecfdf5", icon: CheckCircle };
      case "pending":
        return { color: "#f59e0b", bg: "#fef3c7", icon: Clock };
      case "cancelled":
        return { color: "#ef4444", bg: "#fef2f2", icon: AlertCircle };
      default:
        return { color: "#6b7280", bg: "#f9fafb", icon: Clock };
    }
  };

  return (
    <div className="admin-hub-container" style={{ minHeight: "auto", height: "auto", overflow: "visible" }}>
      <div className="admin-content-wrapper">
        {/* Header */}
        <div className="admin-header">
          <div className="admin-header-content">
            <div className="admin-title-section">
              <div className="admin-icon-wrapper">
                <Users size={32} className="admin-icon" />
                <h1 className="admin-title">Control Panel</h1>
                <p className="admin-subtitle">
                  Customer Order Management System
                </p>
              </div>
            </div>
            <div className="admin-stats">
              <div className="stat-card">
                <div className="stat-icon icon-blue">
                  <Users size={20} />
                </div>
                <div className="stat-content">
                  <div className="stat-number">{allCustomers.length}</div>
                  <div className="stat-label">Total Customers</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon icon-green">
                  <ShoppingCart size={20} />
                </div>
                <div className="stat-content">
                  <div className="stat-number">{allOrdersData.count}</div>
                  <div className="stat-label">Total Orders</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon icon-orange">
                  <TrendingUp size={20} />
                </div>
                <div className="stat-content">
                  <div className="stat-number">
                    {formatCurrency(allOrdersData.revenue)}
                  </div>
                  <div className="stat-label">Total Revenue</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Order Searching Block */}
        <div className="admin-card user-search-block animate-fade-in" style={{ marginTop: '10px' }}>
          <div className="admin-card-header">
            <div className="admin-card-icon icon-blue">
              <Search size={24} />
            </div>
            <div>
              <h3 className="admin-card-title">User Order Searching</h3>
              <p className="admin-card-subtitle">
                Search users by name or mobile number to view complete order
                history
              </p>
            </div>
          </div>

          <div className="search-controls" style={{ padding: '16px' }}>
            <div className="search-type-selector">
              <button
                className={`search-type-btn ${searchType === "name" ? "active" : ""}`}
                onClick={() => handleSearchTypeChange("name")}
              >
                <User size={16} />
                Search by Name
              </button>
              <button
                className={`search-type-btn ${searchType === "mobile" ? "active" : ""}`}
                onClick={() => handleSearchTypeChange("mobile")}
              >
                <Phone size={16} />
                Search by Mobile
              </button>
            </div>

            <div className="search-input-wrapper">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                placeholder={`Search users by ${searchType}...`}
                value={searchTerm}
                onChange={handleSearchChange}
                className="search-input"
              />
              {searchTerm && (
                <button onClick={clearSearch} className="clear-search-btn">
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="search-results">
              <h4 className="results-title">
                Search Results ({searchResults.length})
              </h4>
              <div className="results-list">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className={`result-item ${selectedUser?.id === user.id ? "selected" : ""}`}
                    onClick={() => selectUser(user)}
                  >
                    <div className="result-avatar">
                      <User size={20} />
                    </div>
                    <div className="result-info">
                      <div className="result-name">{user.name}</div>
                      <div className="result-contact">{user.mobile}</div>
                      <div className="result-stats">
                        <span>{user.totalOrders} orders</span>
                        <span>•</span>
                        <span>{formatCurrency(user.totalSpent)}</span>
                      </div>
                    </div>
                    <ChevronRight size={20} className="result-arrow" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected User Orders */}
          {selectedUser && userOrders.length > 0 && (
            <div className="selected-user-orders">
              <div className="selected-user-header">
                <div className="selected-user-info">
                  <h4>{selectedUser.name}</h4>
                  <p>
                    {selectedUser.mobile} • {selectedUser.email}
                  </p>
                </div>
                <div className="selected-user-stats">
                  <span>{userOrders.length} Orders</span>
                  <span>
                    {formatCurrency(
                      userOrders.reduce(
                        (sum, order) => sum + order.grandTotal,
                        0,
                      ),
                    )}
                  </span>
                </div>
              </div>

              <div className="orders-list">
                {userOrders.map((order) => (
                  <div key={order.orderId} className="order-item">
                    <div className="order-header">
                      <div className="order-info">
                        <span className="order-id">{order.orderId}</span>
                        <span className="order-date">{order.date}</span>
                      </div>
                      <div className="order-status">
                        {getOrderStatusBadge(order.status)}
                      </div>
                    </div>

                    <div className="order-items">
                      {order.items.map((item, index) => (
                        <div key={index} className="order-item-row">
                          <div className="item-details">
                            <div className="item-name">{item.name}</div>
                            <div className="item-brand">{item.brand}</div>
                          </div>
                          <div className="item-quantity">×{item.quantity}</div>
                          <div className="item-price">
                            {formatCurrency(item.price)}
                          </div>
                          <div className="item-total">
                            {formatCurrency(item.total)}
                          </div>
                          <button
                            className="reorder-mini-btn"
                            onClick={() => handleReorder(item.name, item.quantity)}
                            title="Re-order this medicine"
                          >
                            <ShoppingCart size={14} />
                            Re-order
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="order-summary">
                      <div className="summary-row">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(order.subtotal)}</span>
                      </div>
                      <div className="tax-breakdown">
                        <span>CGST 9%:</span>
                        <span>{formatCurrency(order.cgst)}</span>
                      </div>
                      <div className="tax-breakdown">
                        <span>SGST 9%:</span>
                        <span>{formatCurrency(order.sgst)}</span>
                      </div>
                      <div className="summary-row grand-total">
                        <span>Grand Total:</span>
                        <span>{formatCurrency(order.grandTotal)}</span>
                      </div>

                      <div className="payment-info">
                        <span className="payment-method">
                          <DollarSign size={14} />
                          {order.paymentMethod === "COD"
                            ? "Cash on Delivery"
                            : "Online Payment"}
                        </span>
                        <span className="order-date">
                          <Clock size={14} />
                          Ordered on {order.date}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="admin-grid">
          {/* Search Section */}
          <div className="admin-search-section">
            <div className="admin-card animate-fade-in">
              <div className="admin-card-header">
                <div className="admin-card-icon icon-blue">
                  <Search size={20} />
                </div>
                <h3 className="admin-card-title">Customer Search</h3>
              </div>

              <div className="search-controls">
                <div className="search-type-selector">
                  <button
                    className={`search-type-btn ${searchType === "name" ? "active" : ""}`}
                    onClick={() => handleSearchTypeChange("name")}
                  >
                    <User size={16} />
                    Search by Name
                  </button>
                  <button
                    className={`search-type-btn ${searchType === "mobile" ? "active" : ""}`}
                    onClick={() => handleSearchTypeChange("mobile")}
                  >
                    <Phone size={16} />
                    Search by Mobile
                  </button>
                </div>

                <div className="search-input-wrapper">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    placeholder={
                      searchType === "name"
                        ? "Enter customer name..."
                        : "Enter mobile number..."
                    }
                    className="admin-search-input"
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || !searchTerm.trim()}
                    className="search-btn"
                  >
                    {searching ? (
                      <div className="loading-spinner"></div>
                    ) : (
                      <Search size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="search-results">
                  <div className="results-header">
                    <span>Found {searchResults.length} customer(s)</span>
                  </div>
                  <div className="results-list">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="user-result-card"
                        onClick={() => getUserOrderHistory(user)}
                      >
                        <div className="user-avatar">
                          <User size={20} />
                        </div>
                        <div className="user-info">
                          <div className="user-name">{user.name}</div>
                          <div className="user-details">
                            <span className="user-mobile">{user.mobile}</span>
                            <span className="user-orders">
                              {user.totalOrders} orders
                            </span>
                          </div>
                        </div>
                        <div className="user-spent">
                          {formatCurrency(user.totalSpent)}
                        </div>
                        <ChevronRight size={18} className="chevron-icon" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchTerm && searchResults.length === 0 && !searching && (
                <div className="no-results">
                  <AlertCircle size={48} className="no-results-icon" />
                  <p>No customers found matching your search.</p>
                </div>
              )}
            </div>
          </div>

          {/* User Details & Order History */}
          {selectedUser && (
            <div className="admin-details-section">
              <div className="admin-card animate-fade-in">
                <div className="admin-card-header">
                  <div className="admin-card-icon icon-green">
                    <User size={20} />
                  </div>
                  <h3 className="admin-card-title">Customer Details</h3>
                </div>

                <div className="user-details-card">
                  <div className="user-header">
                    <div className="user-large-avatar">
                      <User size={32} />
                    </div>
                    <div className="user-main-info">
                      <h4 className="user-full-name">{selectedUser.name}</h4>
                      <div className="user-contact-info">
                        <div className="contact-item">
                          <Phone size={14} />
                          {selectedUser.mobile}
                        </div>
                        <div className="contact-item">
                          <FileText size={14} />
                          {selectedUser.email}
                        </div>
                      </div>
                    </div>
                    <div className="user-status-badge">
                      <span className="status-dot active"></span>
                      Active
                    </div>
                  </div>

                  <div className="user-stats-grid">
                    <div className="user-stat-item">
                      <div className="user-stat-value">
                        {selectedUser.totalOrders}
                      </div>
                      <div className="user-stat-label">Total Orders</div>
                    </div>
                    <div className="user-stat-item">
                      <div className="user-stat-value">
                        {formatCurrency(selectedUser.totalSpent)}
                      </div>
                      <div className="user-stat-label">Total Spent</div>
                    </div>
                    <div className="user-stat-item">
                      <div className="user-stat-value">
                        {selectedUser.lastOrderDate}
                      </div>
                      <div className="user-stat-label">Last Order</div>
                    </div>
                  </div>

                  <div className="user-address">
                    <div className="address-label">Address:</div>
                    <div className="address-text">{selectedUser.address}</div>
                  </div>
                </div>
              </div>

              <div className="admin-card animate-fade-in">
                <div className="admin-card-header">
                  <div className="admin-card-icon icon-orange">
                    <Package size={20} />
                  </div>
                  <h3 className="admin-card-title">Order History</h3>
                </div>

                {loading ? (
                  <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading order history...</p>
                  </div>
                ) : userOrders.length > 0 ? (
                  <div className="orders-list">
                    {userOrders.map((order) => {
                      const statusConfig = getStatusColor(order.status);
                      const StatusIcon = statusConfig.icon;

                      return (
                        <div key={order.orderId} className="order-details-card">
                          <div className="order-header">
                            <div className="order-id">{order.orderId}</div>
                            <div className="order-date-section">
                              <Calendar size={16} />
                              <span>{order.date}</span>
                            </div>
                            <div
                              className={`order-status-badge ${order.status}`}
                            >
                              <StatusIcon size={14} />
                              {order.status.charAt(0).toUpperCase() +
                                order.status.slice(1)}
                            </div>
                          </div>

                          <table className="order-items-table">
                            <thead>
                              <tr>
                                <th>Medicine Details</th>
                                <th>Brand</th>
                                <th>Quantity</th>
                                <th>Unit Price</th>
                                <th>Total Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items.map((item, index) => (
                                <tr key={index}>
                                  <td>
                                    <div className="medicine-name">
                                      {item.name}
                                    </div>
                                    {item.description && (
                                      <div className="medicine-description">
                                        {item.description}
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <div className="medicine-brand">
                                      {item.brand}
                                    </div>
                                  </td>
                                  <td>
                                    <div className="quantity-badge">
                                      {item.quantity}
                                    </div>
                                  </td>
                                  <td className="price-cell">
                                    {formatCurrency(item.price)}
                                  </td>
                                  <td className="total-price-cell">
                                    {formatCurrency(item.total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          <div className="order-summary-section">
                            <div className="summary-row subtotal">
                              <span>Subtotal:</span>
                              <span>{formatCurrency(order.subtotal)}</span>
                            </div>
                            <div className="tax-breakdown">
                              <span>CGST 9%:</span>
                              <span>{formatCurrency(order.cgst)}</span>
                            </div>
                            <div className="tax-breakdown">
                              <span>SGST 9%:</span>
                              <span>{formatCurrency(order.sgst)}</span>
                            </div>
                            <div className="summary-row grand-total">
                              <span>Grand Total:</span>
                              <span>{formatCurrency(order.grandTotal)}</span>
                            </div>

                            <div className="payment-info">
                              <span className="payment-method">
                                <DollarSign size={14} />
                                {order.paymentMethod === "COD"
                                  ? "Cash on Delivery"
                                  : "Online Payment"}
                              </span>
                              <span className="order-date">
                                <Clock size={14} />
                                Ordered on {order.date}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="no-orders">
                    <Package size={48} className="no-orders-icon" />
                    <p>No orders found for this customer.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="admin-footer">
        <div className="footer-content">
          <div className="footer-text">
            Control Panel - Customer Order Management System
          </div>
          <div className="footer-date">
            Last Updated: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHub;
