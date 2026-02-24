import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import ComboBox from './ComboBox';

const EditMedicineModal = ({ isOpen, onClose, medicine, onMedicineUpdated }) => {
    const API_BASE = 'http://localhost:5000/api';
    
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: '',
        brand: '',
        stock_packets: 0,
        tablets_per_packet: 0,
        packet_price_inr: 0,
        expiry_date: '',
        prescription_required: ''
    });
    
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');

    useEffect(() => {
        if (medicine) {
            // Format expiry date to YYYY-MM-DD for proper display in date input
            const formatExpiryDate = (dateStr) => {
                if (!dateStr) return '';
                
                // If already in YYYY-MM-DD format, return as is
                if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    return dateStr;
                }
                
                // Parse any date format and return YYYY-MM-DD
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return '';
                
                return date.toISOString().split('T')[0];
            };

            setFormData({
                name: medicine.name || '',
                description: medicine.description || '',
                category: medicine.category || '',
                brand: medicine.brand || '',
                stock_packets: medicine.stock_packets || 0,
                tablets_per_packet: medicine.tablets_per_packet || 0,
                packet_price_inr: medicine.price_per_packet || 0,
                expiry_date: formatExpiryDate(medicine.expiry_date),
                prescription_required: medicine.prescription_required ? 'yes' : 'no'
            });
        }
    }, [medicine]);

    const showMessage = (text, type) => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => {
            setMessage('');
            setMessageType('');
        }, 3000);
    };

    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        
        let processedValue = value;
        if (name === 'stock_packets' || name === 'tablets_per_packet' || name === 'packet_price_inr') {
            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                processedValue = value;
            } else {
                return;
            }
        }
        
        setFormData(prev => ({
            ...prev,
            [name]: processedValue
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!formData.name || formData.name.trim() === '') {
            showMessage('Medicine Name is required.', 'error');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_BASE}/medicines/${medicine.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    stock_packets: parseInt(formData.stock_packets) || 0,
                    tablets_per_packet: parseInt(formData.tablets_per_packet) || 0,
                    packet_price_inr: parseFloat(formData.packet_price_inr) || 0,
                    prescription_required: formData.prescription_required === 'yes'
                })
            });

            const responseData = await response.json();

            if (response.ok) {
                showMessage('✅ Medicine updated successfully!', 'success');
                onMedicineUpdated && onMedicineUpdated();
                setTimeout(() => {
                    setMessage('');
                    setMessageType('');
                    onClose();
                }, 2000);
            } else {
                showMessage(responseData.message || responseData.error || 'Failed to update medicine. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Update error:', error);
            showMessage('Network error. Could not connect to server.', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-container add-stock-modal" style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                borderRadius: '20px',
                boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
                border: '1px solid #e2e8f0',
                position: 'relative'
            }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header" style={{
                    background: '#10b981',
                    color: 'white',
                    padding: '20px 24px',
                    borderRadius: '12px 12px 0 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Edit Medicine</h2>
                    <button 
                        className="modal-close-btn" 
                        type="button" 
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '8px',
                            padding: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(255,255,255,0.3)';
                            e.target.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(255,255,255,0.2)';
                            e.target.style.transform = 'scale(1)';
                        }}
                    >
                        <X size={18} style={{ color: 'white' }} />
                    </button>
                </div>

                {message && (
                    <div className={`message-toast ${messageType}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 16px',
                        margin: '0 20px 8px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        background: messageType === 'success' ? '#dcfce7' : '#fee2e2',
                        color: messageType === 'success' ? '#15803d' : '#b91c1c',
                        border: `1px solid ${messageType === 'success' ? '#86efac' : '#fca5a5'}`
                    }}>
                        {messageType === 'success' ? '✓' : '⚠'} {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="manual-form" autoComplete="off" style={{
                    padding: '24px 32px',
                    background: 'transparent'
                }}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Medicine Name *</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                placeholder="Enter medicine name"
                                required
                                autoComplete="off"
                            />
                        </div>
                        <div className="form-group">
                            <label>Category</label>
                            <div onClick={(e) => e.stopPropagation()}>
                                <ComboBox
                                    value={formData.category}
                                    onChange={(value) => handleInputChange({ target: { name: 'category', value } })}
                                    placeholder="Type or select category..."
                                    fetchOptions={async (searchQuery = '') => {
                                        const url = searchQuery
                                            ? `${API_BASE}/categories?search=${encodeURIComponent(searchQuery)}`
                                            : `${API_BASE}/categories`;
                                        const response = await fetch(url);
                                        return response.json();
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Brand</label>
                            <div onClick={(e) => e.stopPropagation()}>
                                <ComboBox
                                    value={formData.brand}
                                    onChange={(value) => handleInputChange({ target: { name: 'brand', value } })}
                                    placeholder="Type or select brand..."
                                    fetchOptions={async (searchQuery = '') => {
                                        const url = searchQuery
                                            ? `${API_BASE}/brands?search=${encodeURIComponent(searchQuery)}`
                                            : `${API_BASE}/brands`;
                                        const response = await fetch(url);
                                        return response.json();
                                    }}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Stock Packets *</label>
                            <input
                                type="text"
                                name="stock_packets"
                                value={formData.stock_packets}
                                onChange={handleInputChange}
                                placeholder="Number of packets"
                                inputMode="numeric"
                                min="0"
                                required
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Tablets per Packet *</label>
                            <input
                                type="text"
                                name="tablets_per_packet"
                                value={formData.tablets_per_packet}
                                onChange={handleInputChange}
                                placeholder="Tablets in each packet"
                                inputMode="numeric"
                                min="0"
                                required
                                autoComplete="off"
                            />
                        </div>
                        <div className="form-group">
                            <label>Packet Price (₹) *</label>
                            <input
                                type="text"
                                name="packet_price_inr"
                                value={formData.packet_price_inr}
                                onChange={handleInputChange}
                                placeholder="Price per packet"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                required
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Expiry Date</label>
                            <input
                                type="date"
                                name="expiry_date"
                                value={formData.expiry_date}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="form-group">
                            <label>Prescription Required *</label>
                            <select
                                name="prescription_required"
                                value={formData.prescription_required}
                                onChange={handleInputChange}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: '1.5px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    color: formData.prescription_required === '' ? '#9ca3af' : '#1e293b',
                                    background: '#fff',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    appearance: 'auto'
                                }}
                            >
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group full-width">
                            <label>Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows="2"
                                placeholder="Optional description..."
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={loading || messageType === 'success'}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            padding: '12px 28px',
                            background: loading || messageType === 'success' 
                                ? '#94a3b8' 
                                : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '15px',
                            cursor: loading || messageType === 'success' ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: loading || messageType === 'success' ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)',
                            margin: '20px auto 0',
                            width: 'fit-content'
                        }}
                        onMouseEnter={(e) => {
                            if (!loading && messageType !== 'success') {
                                e.target.style.background = '#059669';
                                e.target.style.transform = 'translateY(-1px)';
                                e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!loading && messageType !== 'success') {
                                e.target.style.background = '#10b981';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
                            }
                        }}
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {loading ? 'Updating...' : messageType === 'success' ? 'Updated!' : 'Update Medicine'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default EditMedicineModal;
