import React, { useState, useEffect, useRef, useCallback } from 'react';

const ComboBox = ({ 
    value, 
    onChange, 
    placeholder, 
    fetchOptions, 
    onCreateNew,
    className = '',
    disabled = false 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState([]);
    const [filteredOptions, setFilteredOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const [showCreateNew, setShowCreateNew] = useState(false);
    const wrapperRef = useRef(null);
    const debounceTimeoutRef = useRef(null);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        loadOptions(''); // Load initial options
    }, [fetchOptions]);

    useEffect(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        if (isOpen && inputValue) {
            debounceTimeoutRef.current = setTimeout(() => {
                loadOptions(inputValue);
            }, 300);
        } else if (!inputValue) {
            loadOptions('');
        }

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [inputValue, isOpen, fetchOptions]);

    useEffect(() => {
        if (isOpen && options.length > 0) {
            const filtered = options.filter(option =>
                option.toLowerCase().includes(inputValue.toLowerCase())
            );
            setFilteredOptions(filtered);
            setShowCreateNew(inputValue.trim() !== '' && !filtered.includes(inputValue.trim()));
        } else {
            setFilteredOptions(options);
            setShowCreateNew(false);
        }
    }, [inputValue, isOpen, options]);

    const loadOptions = async (searchQuery = '') => {
        if (!fetchOptions) return;
        
        setLoading(true);
        try {
            const result = await fetchOptions(searchQuery);
            setOptions(result || []);
        } catch (error) {
            console.error('Error loading options:', error);
            setOptions([]);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        onChange(newValue);
        setIsOpen(true);
    };

    const handleOptionClick = (option) => {
        setInputValue(option);
        onChange(option);
        setIsOpen(false);
    };

    const handleCreateNew = async () => {
        if (inputValue.trim() && onCreateNew) {
            try {
                await onCreateNew(inputValue.trim());
                await loadOptions(); // Reload options to include the new one
                setInputValue(inputValue.trim());
                onChange(inputValue.trim());
                setIsOpen(false);
            } catch (error) {
                console.error('Error creating new option:', error);
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (showCreateNew) {
                handleCreateNew();
            } else if (filteredOptions.length > 0) {
                handleOptionClick(filteredOptions[0]);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
        }
    };

    return (
        <div className={`combobox-wrapper ${className}`} ref={wrapperRef}>
            <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="combobox-input"
                disabled={disabled}
            />
            
            {isOpen && (
                <div className="combobox-dropdown">
                    {loading ? (
                        <div className="combobox-option loading">Loading...</div>
                    ) : (
                        <>
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((option, index) => (
                                    <div
                                        key={index}
                                        className="combobox-option"
                                        onClick={() => handleOptionClick(option)}
                                    >
                                        {option}
                                    </div>
                                ))
                            ) : (
                                !showCreateNew && (
                                    <div className="combobox-option no-results">No options found</div>
                                )
                            )}
                            
                            {showCreateNew && (
                                <div className="combobox-option create-new" onClick={handleCreateNew}>
                                    Create "{inputValue.trim()}"
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ComboBox;
