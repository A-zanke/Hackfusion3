import React from 'react';

const ModernTable = ({ columns, data, renderRow, emptyMessage = 'No data available' }) => {
    return (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#f1f5f9' }}>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            {columns.map((col, i) => (
                                <th
                                    key={i}
                                    className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider"
                                    style={{ color: '#94a3b8', textAlign: col.align || 'left' }}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-12 text-center text-sm"
                                    style={{ color: '#94a3b8' }}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            data.map((item, index) => renderRow(item, index))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ModernTable;
