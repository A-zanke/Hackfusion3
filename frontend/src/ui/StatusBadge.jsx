import React from 'react';

const variantStyles = {
    stable: { colorClass: 'status-badge-stable', text: 'Stable' },
    low: { colorClass: 'status-badge-low', text: 'Low Stock' },
    ok: { colorClass: 'status-badge-stable', text: 'OK' },
    insufficient: { colorClass: 'status-badge-warning', text: '⚠ Insufficient' },
    valid: { colorClass: 'status-badge-stable', text: 'Valid' },
    info: { colorClass: 'status-badge-info', text: 'Info' },
    warning: { colorClass: 'status-badge-warning', text: 'Warning' },
    error: { colorClass: 'status-badge-low', text: 'Error' },
};

const StatusBadge = ({ variant = 'stable', text }) => {
    const style = variantStyles[variant] || variantStyles.stable;
    const displayText = text || style.text;

    return (
        <span className={`status-badge ${style.colorClass}`}>
            {displayText}
        </span>
    );
};

export default StatusBadge;
