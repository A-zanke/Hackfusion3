import React from 'react';

const variantStyles = {
    stable: { bg: '#d1fae5', color: '#059669', text: 'Stable' },
    low: { bg: '#fef2f2', color: '#dc2626', text: 'Low Stock' },
    ok: { bg: '#d1fae5', color: '#059669', text: 'OK' },
    insufficient: { bg: '#fef2f2', color: '#dc2626', text: '⚠ Insufficient' },
    valid: { bg: '#d1fae5', color: '#059669', text: 'Valid' },
    info: { bg: '#dbeafe', color: '#2563eb', text: 'Info' },
    warning: { bg: '#fef3c7', color: '#d97706', text: 'Warning' },
    error: { bg: '#fee2e2', color: '#dc2626', text: 'Error' },
};

const StatusBadge = ({ variant = 'stable', text }) => {
    const style = variantStyles[variant] || variantStyles.stable;
    const displayText = text || style.text;

    return (
        <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: style.bg, color: style.color }}
        >
            {displayText}
        </span>
    );
};

export default StatusBadge;
