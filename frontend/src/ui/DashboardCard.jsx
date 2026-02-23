import React from 'react';

const colorMap = {
    green: { bg: 'stat-icon-green' },
    blue: { bg: 'stat-icon-blue' },
    orange: { bg: 'stat-icon-orange' },
    red: { bg: 'stat-icon-red' },
};

const DashboardCard = ({ icon: Icon, title, value, subtitle, color = 'blue' }) => {
    const styling = colorMap[color] || colorMap.blue;

    return (
        <div className="stat-card animate-fade-in">
            <div className="stat-left">
                <p className="stat-title">{title}</p>
                <p className="stat-value">{value}</p>
                {subtitle && (
                    <p className="stat-subtitle">
                        {subtitle}
                    </p>
                )}
            </div>
            <div className={`stat-icon-wrapper ${styling.bg}`}>
                <Icon size={24} />
            </div>
        </div>
    );
};

export default DashboardCard;
