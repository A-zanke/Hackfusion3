import React from 'react';
import { Pill, Package, Calendar } from 'lucide-react';

const MedicineTable = ({ medicines }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Pill className="text-blue-500" size={20} />
                    Medicine Inventory
                </h2>
                <span className="text-xs font-medium px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full">
                    {medicines.length} Items Total
                </span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-gray-400 text-xs uppercase tracking-wider bg-gray-50">
                            <th className="px-6 py-3 font-medium">Medicine Name</th>
                            <th className="px-6 py-3 font-medium text-center">Packets</th>
                            <th className="px-6 py-3 font-medium text-center">Total Tablets</th>
                            <th className="px-6 py-3 font-medium text-right">Price/Tab</th>
                            <th className="px-6 py-3 font-medium text-right">Expiry</th>
                            <th className="px-6 py-3 font-medium text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {medicines.map((med) => {
                            const isLowStock = med.total_tablets < med.low_stock_threshold;
                            return (
                                <tr key={med.id} className="hover:bg-gray-50/80 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{med.name}</div>
                                        <div className="text-xs text-gray-500">{med.category}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center text-gray-600 text-sm font-medium">
                                        {med.stock_packets}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-sm font-semibold text-gray-800">{med.total_tablets}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm text-emerald-600 font-bold">
                                        ₹{Number(med.price_per_tablet).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1 text-xs text-gray-500">
                                            <Calendar size={12} />
                                            {new Date(med.expiry_date).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${isLowStock
                                                ? 'bg-red-50 text-red-600 border border-red-100'
                                                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                            }`}>
                                            {isLowStock ? 'Low Stock' : 'Stable'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MedicineTable;
