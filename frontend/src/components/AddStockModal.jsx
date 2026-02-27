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
    const [successToast, setSuccessToast] = useState(null); // Global toast outside modal
    const fileInputRef = useRef(null);
    const toastTimerRef = useRef(null);

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
        expiry_date: '',
        prescription_required: ''
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
            expiry_date: '',
            prescription_required: ''
        });
    };

    const showMessage = (text, type = 'success') => {
        setMessage(text);
        setMessageType(type);
        // Clear after 4 seconds
        setTimeout(() => {
            setMessage('');
            setMessageType('');
        }, 4000);
    };

    const showGlobalToast = (text, type = 'success') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setSuccessToast({ text, type });
        toastTimerRef.current = setTimeout(() => {
            setSuccessToast(null);
        }, 3500);
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Basic validation
        if (!manualForm.name || manualForm.name.trim() === '') {
            showMessage('Medicine Name is required.', 'error');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_BASE}/medicines`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(manualForm)
            });

            if (response.ok) {
                // Show success INSIDE the modal so user sees it
                showMessage('✅ Stock added successfully!', 'success');
                // Notify parent to refresh list
                onStockAdded && onStockAdded();
                // Reset form AFTER showing message (not before)
                setTimeout(() => {
                    resetManualForm();
                }, 1500);
                // Close modal after user has seen the success message
                setTimeout(() => {
                    setMessage('');
                    setMessageType('');
                    onClose();
                }, 3000);
            } else {
                const errorData = await response.json().catch(() => ({}));
                showMessage(errorData.message || 'Failed to add stock. Please try again.', 'error');
            }
        } catch (error) {
            showMessage('Network error. Could not connect to server.', 'error');
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
        reader.onload = async (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (!jsonData || jsonData.length === 0) {
                    showMessage('The Excel file is empty or has no valid data.', 'error');
                    return;
                }

                // Check for duplicates
                const response = await fetch(`${API_BASE}/medicines`);
                const existingMedicines = await response.json();

                const duplicateItems = jsonData.filter(item =>
                    existingMedicines.some(med =>
                        med.name && item.medicine_name &&
                        med.name.toLowerCase() === item.medicine_name.toLowerCase()
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
                showMessage('Error reading Excel file. Please check the format.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const proceedWithImport = async (data, action) => {
        setLoading(true);
        setDuplicateModal(false);

        try {
            let processedData = data;

            // Fetch existing medicines once when we need duplicate awareness
            let existingMedicines = [];
            if (action === 'skip' || action === 'update') {
                const response = await fetch(`${API_BASE}/medicines`);
                existingMedicines = await response.json();
            }

            if (action === 'skip') {
                // Remove items that already exist
                processedData = data.filter(item =>
                    !existingMedicines.some(med =>
                        med.name &&
                        item.medicine_name &&
                        med.name.toLowerCase() === item.medicine_name.toLowerCase()
                    )
                );

                if (processedData.length === 0) {
                    showMessage('No new items to import (all were duplicates).', 'error');
                    setLoading(false);
                    return;
                }

                // Pure create flow for non-duplicates
                const createResults = await Promise.all(
                    processedData.map(item =>
                        fetch(`${API_BASE}/medicines`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(item)
                        })
                    )
                );

                const failedCount = createResults.filter(r => !r.ok).length;
                const successCount = processedData.length - failedCount;

                if (failedCount === 0) {
                    showMessage(`✅ ${successCount} new item(s) imported successfully!`, 'success');
                } else {
                    showMessage(`⚠️ ${successCount} imported, ${failedCount} failed. Check data format.`, 'error');
                }
            } else if (action === 'update') {
                // For update, split into items to update vs create based on name match
                const toUpdate = [];
                const toCreate = [];

                processedData.forEach(item => {
                    // Prefer explicit Excel field, fall back to generic name
                    const excelName = (item.medicine_name || item.name || '').toLowerCase();

                    const match = existingMedicines.find(med =>
                        med.name &&
                        excelName &&
                        med.name.toLowerCase() === excelName
                    );

                    if (match) {
                        toUpdate.push({ existing: match, item });
                    } else {
                        toCreate.push(item);
                    }
                });

                const updatePromises = toUpdate.map(({ existing, item }) =>
                    fetch(`${API_BASE}/medicines/${existing.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: item.medicine_name || existing.name,
                            description: item.description ?? existing.description,
                            category: item.category ?? existing.category,
                            brand: item.brand ?? existing.brand,
                            // Excel uses total_packets → backend expects stock_packets
                            stock_packets: item.total_packets ?? existing.stock_packets,
                            tablets_per_packet: item.tablets_per_packet ?? existing.tablets_per_packet,
                            packet_price_inr: item.packet_price_inr ?? existing.price_per_packet,
                            expiry_date: item.expiry_date ?? existing.expiry_date,
                            prescription_required: item.prescription_required ?? existing.prescription_required
                        })
                    })
                );

                const createPromises = toCreate.map(item =>
                    fetch(`${API_BASE}/medicines`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(item)
                    })
                );

                const [updateResults, createResults] = await Promise.all([
                    Promise.all(updatePromises),
                    Promise.all(createPromises)
                ]);

                const updateFailed = updateResults.filter(r => !r.ok).length;
                const createFailed = createResults.filter(r => !r.ok).length;
                const updateSuccess = toUpdate.length - updateFailed;
                const createSuccess = toCreate.length - createFailed;

                if (updateFailed === 0 && createFailed === 0) {
                    showMessage(`✅ ${updateSuccess} item(s) updated, ${createSuccess} new item(s) added from Excel.`, 'success');
                } else {
                    showMessage(`⚠️ Updated ${updateSuccess} / ${toUpdate.length} and added ${createSuccess} / ${toCreate.length}. Check failed rows.`, 'error');
                }
            } else {
                // Default: add everything, even duplicates (previous behaviour)
                if (processedData.length === 0) {
                    showMessage('No items to import.', 'error');
                    setLoading(false);
                    return;
                }

                const importPromises = processedData.map(item =>
                    fetch(`${API_BASE}/medicines`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(item)
                    })
                );

                const results = await Promise.all(importPromises);
                const failedCount = results.filter(r => !r.ok).length;
                const successCount = processedData.length - failedCount;

                if (failedCount === 0) {
                    showMessage(`✅ ${successCount} item(s) imported successfully!`, 'success');
                } else {
                    showMessage(`⚠️ ${successCount} imported, ${failedCount} failed. Check data format.`, 'error');
                }
            }

            onStockAdded && onStockAdded();

            // Close modal after user sees the result
            setTimeout(() => {
                setMessage('');
                setMessageType('');
                onClose();
            }, 3000);
        } catch (error) {
            showMessage('Error importing stock. Please try again.', 'error');
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
            const packets = name === 'total_packets' ? (value === '' ? 0 : parseFloat(value) || 0) : (parseFloat(manualForm.total_packets) || 0);
            const tabletsPerPacket = name === 'tablets_per_packet' ? (value === '' ? 0 : parseFloat(value) || 0) : (parseFloat(manualForm.tablets_per_packet) || 0);
            newFormState.total_tablets = packets * tabletsPerPacket;
        }

        // Single state update to prevent re-render issues
        setManualForm(newFormState);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Global success/error toast notification - shown OUTSIDE modal so it persists */}
            {successToast && (
                <div
                    style={{
                        position: 'fixed',
                        top: '24px',
                        right: '24px',
                        zIndex: 99999,
                        background: successToast.type === 'success' ? '#16a34a' : '#dc2626',
                        color: '#fff',
                        padding: '14px 24px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
                        fontSize: '15px',
                        fontWeight: 500,
                        animation: 'slideInRight 0.3s ease'
                    }}
                >
                    {successToast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {successToast.text}
                </div>
            )}

            <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
                <div className="modal-container add-stock-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>Add Stock</h2>
                        <button className="modal-close-btn" type="button" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* In-modal message toast */}
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
                            {messageType === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                            {message}
                        </div>
                    )}

                    <div className="modal-tabs">
                        <button
                            type="button"
                            className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
                            onClick={() => setActiveTab('manual')}
                        >
                            Manual Entry
                        </button>
                        <button
                            type="button"
                            className={`tab-btn ${activeTab === 'excel' ? 'active' : ''}`}
                            onClick={() => setActiveTab('excel')}
                        >
                            Excel Import
                        </button>
                    </div>

                    <div className="modal-content">
                        {activeTab === 'manual' && (
                            <form
                                onSubmit={handleManualSubmit}
                                className="manual-form"
                                autoComplete="off"
                            >
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Medicine Name *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={manualForm.name}
                                            onChange={handleManualInputChange}
                                            placeholder="Enter medicine name"
                                            required
                                            autoComplete="off"
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
                                            autoComplete="off"
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
                                            autoComplete="off"
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
                                            value={manualForm.expiry_date}
                                            onChange={handleManualInputChange}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Prescription Required *</label>
                                        <select
                                            name="prescription_required"
                                            value={manualForm.prescription_required}
                                            onChange={handleManualInputChange}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                border: '1.5px solid #e2e8f0',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                color: manualForm.prescription_required === '' ? '#9ca3af' : '#1e293b',
                                                background: '#fff',
                                                cursor: 'pointer',
                                                outline: 'none',
                                                appearance: 'auto'
                                            }}
                                        >
                                            <option value="" disabled>Select Yes / No...</option>
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
                                            value={manualForm.description}
                                            onChange={handleManualInputChange}
                                            rows="2"
                                            placeholder="Optional description..."
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="submit-btn"
                                    disabled={loading || messageType === 'success'}
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    {loading ? 'Adding Stock...' : messageType === 'success' ? 'Stock Added!' : 'Add Stock'}
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
                                            disabled={loading || messageType === 'success'}
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
                <div className="modal-overlay" style={{ zIndex: 10001 }}>
                    <div className="modal-container duplicate-modal">
                        <div className="modal-header">
                            <h3>Duplicate Items Found</h3>
                        </div>
                        <div className="modal-content">
                            <p>Found {duplicates.length} item(s) that already exist in your inventory:</p>
                            <ul className="duplicate-list">
                                {duplicates.slice(0, 5).map((item, index) => (
                                    <li key={index}>{item.medicine_name || item.name}</li>
                                ))}
                                {duplicates.length > 5 && <li>...and {duplicates.length - 5} more</li>}
                            </ul>
                            <p>How would you like to proceed?</p>
                        </div>
                        <div className="modal-actions">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleDuplicateAction('add')}
                            >
                                Add Again
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleDuplicateAction('skip')}
                            >
                                Skip Existing
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => handleDuplicateAction('update')}
                            >
                                Update from Excel
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => {
                                    setDuplicateModal(false);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
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
