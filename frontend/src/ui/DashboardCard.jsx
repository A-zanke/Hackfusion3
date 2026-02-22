import React from 'react';

const colorMap = {
    green: { bg: '#d1fae5', icon: '#10b981' },
    blue: { bg: '#dbeafe', icon: '#3b82f6' },
    orange: { bg: '#ffedd5', icon: '#f97316' },
    red: { bg: '#fee2e2', icon: '#ef4444' },
};

const DashboardCard = ({ icon: Icon, title, value, subtitle, color = 'blue' }) => {
    const colors = colorMap[color] || colorMap.blue;

    return (
        <div className="bg-white rounded-2xl p-5 border card-hover animate-fade-in"
            style={{ borderColor: '#f1f5f9' }}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                        style={{ color: '#94a3b8' }}>{title}</p>
                    <p className="text-2xl font-extrabold" style={{ color: '#0f172a' }}>{value}</p>
                    {subtitle && (
                        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{subtitle}</p>
                    )}
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: colors.bg }}>
                    <Icon size={22} style={{ color: colors.icon }} />
                </div>
            </div>
        </div>
    );
};

export default DashboardCard;
