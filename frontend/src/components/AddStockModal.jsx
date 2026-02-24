import React, { useState, useRef } from 'react';
import { X, Download, Upload, Plus, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import ComboBox from './ComboBox';

const API_BASE = 'http://localhost:5000/api';

const AddStockModal = ({ isOpen, onClose, onStockAdded }) => {
    const [activeTab, setActiveTab] = useState('manual');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');
    const [duplicateModal, setDuplicateModal] = useState(false);
    const [duplicates, setDuplicates] = useState([]);
    const [importData, setImportData] = useState([]);
    const [importAction, setImportAction] = useState('');
    const fileInputRef = useRef(null);

    // Manual form state
    const [manualForm, setManualForm] = useState({
        name: '',
        description: '',
        category: '',
        brand: '',
        total_packets: 0,
        tablets_per_packet: 0,
        total_tablets: 0,
        packet_price_inr: 0,
        expiry_date: ''
    });

    const resetManualForm = () => {
        setManualForm({
            name: '',
            description: '',
            category: '',
            brand: '',
            total_packets: 0,
            tablets_per_packet: 0,
            total_tablets: 0,
            packet_price_inr: 0,
            expiry_date: ''
        });
    };

    const showMessage = (text, type = 'success') => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => {
            setMessage('');
            setMessageType('');
        }, 3000);
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE}/medicines`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(manualForm)
            });

            if (response.ok) {
                showMessage('Stock added successfully');
                resetManualForm();
                onStockAdded && onStockAdded();
                setTimeout(() => onClose(), 3000);
            } else {
                throw new Error('Failed to add stock');
            }
        } catch (error) {
            showMessage('Error adding stock', 'error');
        } finally {
            setLoading(false);
        }
    };

    const downloadSampleExcel = () => {
        const sampleData = [{
            medicine_name: 'Paracetamol 500mg',
            description: 'For fever and mild pain relief',
            category: 'Tablets',
            brand: 'Crocin',
            total_packets: 20,
            tablets_per_packet: 10,
            packet_price_inr: 45.00,
            prescription_required: 'no',
            expiry_date: '2025-12-31',
            batch_number: 'PCM2024001'
        }];

        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sample Stock');
        XLSX.writeFile(wb, 'sample_stock_format.xlsx');
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                // Check for duplicates
                const response = await fetch(`${API_BASE}/medicines`);
                const existingMedicines = await response.json();
                
                const duplicateItems = jsonData.filter(item => 
                    existingMedicines.some(med => 
                        med.name.toLowerCase() === item.name?.toLowerCase()
                    )
                );

                if (duplicateItems.length > 0) {
                    setDuplicates(duplicateItems);
                    setImportData(jsonData);
                    setDuplicateModal(true);
                } else {
                    proceedWithImport(jsonData, 'add');
                }
            } catch (error) {
                showMessage('Error reading Excel file', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const proceedWithImport = async (data, action) => {
        setLoading(true);
        setDuplicateModal(false);

        try {
            let processedData = data;
            
            if (action === 'skip') {
                // Remove duplicates
                const response = await fetch(`${API_BASE}/medicines`);
                const existingMedicines = await response.json();
                processedData = data.filter(item => 
                    !existingMedicines.some(med => 
                        med.name.toLowerCase() === item.name?.toLowerCase()
                    )
                );
            }

            // Import data
            const importPromises = processedData.map(item => 
                fetch(`${API_BASE}/medicines`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                })
            );

            await Promise.all(importPromises);
            
            showMessage(`Stock imported successfully (${processedData.length} items)`);
            onStockAdded && onStockAdded();
            setTimeout(() => onClose(), 3000);
        } catch (error) {
            showMessage('Error importing stock', 'error');
        } finally {
            setLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDuplicateAction = (action) => {
        setImportAction(action);
        proceedWithImport(importData, action);
    };

    const handleManualInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        // Handle number inputs manually to allow proper editing of leading zeros
        let processedValue = value;
        if (name === 'total_packets' || name === 'tablets_per_packet' || name === 'packet_price_inr') {
            // Allow empty string and valid numbers
            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                processedValue = value;
            } else {
                return; // Invalid input, don't update
            }
        } else {
            processedValue = type === 'checkbox' ? checked : value;
        }
        
        // Create new form state
        const newFormState = {
            ...manualForm,
            [name]: processedValue
        };

        // Auto-calculate total tablets in the same state update
        if (name === 'total_packets' || name === 'tablets_per_packet') {
            const packets = name === 'total_packets' ? (value === '' ? 0 : parseFloat(value) || 0) : manualForm.total_packets;
            const tabletsPerPacket = name === 'tablets_per_packet' ? (value === '' ? 0 : parseFloat(value) || 0) : manualForm.tablets_per_packet;
            newFormState.total_tablets = packets * tabletsPerPacket;
        }
        
        // Single state update to prevent re-render issues
        setManualForm(newFormState);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-overlay">
                <div className="modal-container add-stock-modal">
                    <div className="modal-header">
                        <h2>Add Stock</h2>
                        <button className="modal-close-btn" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>

                    {message && (
                        <div className={`message-toast ${messageType}`}>
                            {messageType === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                            {message}
                        </div>
                    )}

                    <div className="modal-tabs">
                        <button 
                            className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
                            onClick={() => setActiveTab('manual')}
                        >
                            Manual Entry
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'excel' ? 'active' : ''}`}
                            onClick={() => setActiveTab('excel')}
                        >
                            Excel Import
                        </button>
                    </div>

                    <div className="modal-content">
                        {activeTab === 'manual' && (
                            <form onSubmit={handleManualSubmit} className="manual-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Medicine Name *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={manualForm.name}
                                            onChange={handleManualInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Category</label>
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <ComboBox
                                                value={manualForm.category}
                                                onChange={(value) => handleManualInputChange({ target: { name: 'category', value } })}
                                                placeholder="Type or select category..."
                                                fetchOptions={async (searchQuery = '') => {
                                                    const url = searchQuery 
                                                        ? `${API_BASE}/categories?search=${encodeURIComponent(searchQuery)}`
                                                        : `${API_BASE}/categories`;
                                                    const response = await fetch(url);
                                                    return response.json();
                                                }}
                                                onCreateNew={async (newCategory) => {
                                                    // New category will be saved when form is submitted
                                                    console.log('New category will be added:', newCategory);
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
                                                value={manualForm.brand}
                                                onChange={(value) => handleManualInputChange({ target: { name: 'brand', value } })}
                                                placeholder="Type or select brand..."
                                                fetchOptions={async (searchQuery = '') => {
                                                    const url = searchQuery 
                                                        ? `${API_BASE}/brands?search=${encodeURIComponent(searchQuery)}`
                                                        : `${API_BASE}/brands`;
                                                    const response = await fetch(url);
                                                    return response.json();
                                                }}
                                                onCreateNew={async (newBrand) => {
                                                    // New brand will be saved when form is submitted
                                                    console.log('New brand will be added:', newBrand);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Total Packets *</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            name="total_packets"
                                            value={manualForm.total_packets}
                                            onChange={handleManualInputChange}
                                            min="0"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Tablets per Packet *</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            name="tablets_per_packet"
                                            value={manualForm.tablets_per_packet}
                                            onChange={handleManualInputChange}
                                            min="0"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Total Tablets</label>
                                        <input
                                            type="number"
                                            name="total_tablets"
                                            value={manualForm.total_tablets}
                                            readOnly
                                            className="readonly-field"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Price of one packet (INR) *</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            name="packet_price_inr"
                                            value={manualForm.packet_price_inr}
                                            onChange={handleManualInputChange}
                                            step="0.01"
                                            min="0"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Expiry Date</label>
                                        <input
                                            type="date"
                                            name="expiry_date"
                                            value={manualForm.expiry_date}
                                            onChange={handleManualInputChange}
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group full-width">
                                        <label>Description</label>
                                        <textarea
                                            name="description"
                                            value={manualForm.description}
                                            onChange={handleManualInputChange}
                                            rows="2"
                                        />
                                    </div>
                                </div>


                                <button type="submit" className="submit-btn" disabled={loading}>
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    {loading ? 'Adding Stock...' : 'Add Stock'}
                                </button>
                            </form>
                        )}

                        {activeTab === 'excel' && (
                            <div className="excel-import-section">
                                <div className="excel-actions">
                                    <button type="button" className="excel-btn download-btn" onClick={downloadSampleExcel}>
                                        <Download size={16} />
                                        Download Sample Excel
                                    </button>
                                    <div className="upload-section">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept=".xlsx,.xls"
                                            onChange={handleFileUpload}
                                            style={{ display: 'none' }}
                                        />
                                        <button 
                                            type="button"
                                            className="excel-btn upload-btn"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={loading}
                                        >
                                            <Upload size={16} />
                                            {loading ? 'Processing...' : 'Import Excel'}
                                        </button>
                                    </div>
                                </div>
                                <div className="excel-info">
                                    <p>Download the sample Excel file to understand the required format.</p>
                                    <p>Fill your data and import the file to add multiple items at once.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {duplicateModal && (
                <div className="modal-overlay">
                    <div className="modal-container duplicate-modal">
                        <div className="modal-header">
                            <h3>Duplicate Items Found</h3>
                        </div>
                        <div className="modal-content">
                            <p>Found {duplicates.length} item(s) that already exist in your inventory:</p>
                            <ul className="duplicate-list">
                                {duplicates.slice(0, 5).map((item, index) => (
                                    <li key={index}>{item.name}</li>
                                ))}
                                {duplicates.length > 5 && <li>...and {duplicates.length - 5} more</li>}
                            </ul>
                            <p>How would you like to proceed?</p>
                        </div>
                        <div className="modal-actions">
                            <button 
                                className="btn-secondary"
                                onClick={() => handleDuplicateAction('add')}
                            >
                                Add Again
                            </button>
                            <button 
                                className="btn-secondary"
                                onClick={() => handleDuplicateAction('skip')}
                            >
                                Skip Existing
                            </button>
                            <button 
                                className="btn-primary"
                                onClick={() => setDuplicateModal(false)}
                            >
                                Cancel Import
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AddStockModal;
