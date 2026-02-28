import React, { useState } from 'react';
import { Plus, Minus, Pill, IndianRupee, QrCode } from 'lucide-react';

const QuantitySelector = ({ medicine, onQuantityChange, onConfirm }) => {
    const [quantity, setQuantity] = useState(1);
    const pricePerTablet = medicine.price_per_tablet || 5;
    const totalPrice = quantity * pricePerTablet;

    return (
        <div className="quantity-selector-card">
            <div className="medicine-info">
                <div className="medicine-icon">
                    <Pill size={24} />
                </div>
                <div className="medicine-details">
                    <h3>{medicine.name}</h3>
                    <p className="price-per-tablet">
                        <IndianRupee size={16} />
                        {pricePerTablet} per tablet
                    </p>
                </div>
            </div>

            <div className="quantity-controls">
                <div className="quantity-label">How many tablets?</div>
                <div className="quantity-buttons">
                    <button 
                        className="quantity-btn minus"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                    >
                        <Minus size={16} />
                    </button>
                    <div className="quantity-display">
                        {quantity}
                    </div>
                    <button 
                        className="quantity-btn plus"
                        onClick={() => setQuantity(quantity + 1)}
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            <div className="price-summary">
                <div className="total-price">
                    <span className="price-label">Total:</span>
                    <span className="price-value">
                        <IndianRupee size={18} />
                        {totalPrice}
                    </span>
                </div>
                <button 
                    className="confirm-order-btn"
                    onClick={() => onConfirm(medicine.name, quantity, totalPrice)}
                >
                    Confirm Order
                </button>
            </div>
        </div>
    );
};

export default QuantitySelector;
