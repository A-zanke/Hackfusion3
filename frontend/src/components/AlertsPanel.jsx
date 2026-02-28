import React from 'react';
import { AlertCircle, ShieldAlert, UserCheck } from 'lucide-react';
//hello

const AlertsPanel = ({ alerts }) => {
    const getIcon = (type) => {
        switch (type) {
            case 'Stock': return <ShieldAlert className="text-amber-500" size={18} />;
            case 'Expiry': return <AlertCircle className="text-red-500" size={18} />;
            case 'User': return <UserCheck className="text-blue-500" size={18} />;
            default: return <AlertCircle size={18} />;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    System Alerts
                </h2>
                {alerts.length > 0 && (
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {alerts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 opacity-60">
                        <AlertCircle size={32} />
                        <p className="text-sm">No active alerts</p>
                    </div>
                ) : (
                    alerts.map((alert) => (
                        <div key={alert.id} className="p-3 rounded-lg border border-gray-50 bg-gray-50/30 hover:bg-gray-50 transition-colors cursor-pointer group">
                            <div className="flex gap-3">
                                <div className="mt-0.5">{getIcon(alert.type)}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <p className="text-xs font-bold text-gray-900 uppercase tracking-tight mb-1">{alert.type} Alert</p>
                                        <span className="text-[10px] text-gray-400">{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 leading-tight">{alert.message}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AlertsPanel;
