import React from 'react';
import { QrCode, IndianRupee, CheckCircle, Pill } from 'lucide-react';

const OrderSummary = ({ order, qrCode, onPaymentComplete }) => {
    return (
        <div className="order-summary-card">
            <div className="order-header">
                <CheckCircle className="success-icon" size={24} />
                <h3>Order Confirmed!</h3>
            </div>

            <div className="order-details">
                <div className="medicine-item">
                    <Pill size={20} />
                    <div className="medicine-info">
                        <h4>{order.medicine}</h4>
                        <p>{order.quantity} tablets</p>
                    </div>
                </div>

                <div className="price-breakdown">
                    <div className="price-row">
                        <span>Price per tablet:</span>
                        <span>
                            <IndianRupee size={14} />
                            {order.pricePerTablet}
                        </span>
                    </div>
                    <div className="price-row">
                        <span>Quantity:</span>
                        <span>{order.quantity}</span>
                    </div>
                    <div className="price-row total">
                        <span>Total Amount:</span>
                        <span className="total-amount">
                            <IndianRupee size={18} />
                            {order.totalPrice}
                        </span>
                    </div>
                </div>
            </div>

            <div className="payment-section">
                <h4>Scan QR to Pay</h4>
                <div className="qr-container">
                    {qrCode && (
                        <img 
                            src={qrCode} 
                            alt="Payment QR Code" 
                            className="qr-code"
                        />
                    )}
                </div>
                <p className="payment-note">
                    Pay <strong>
                        <IndianRupee size={16} />
                        {order.totalPrice}
                    </strong> via UPI
                </p>
                <button 
                    className="payment-complete-btn"
                    onClick={onPaymentComplete}
                >
                    I've Paid
                </button>
            </div>
        </div>
    );
};

export default OrderSummary;
