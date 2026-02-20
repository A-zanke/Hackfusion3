import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MedicineTable from './components/MedicineTable';
import AlertsPanel from './components/AlertsPanel';
import { LayoutDashboard, MessageSquare, Settings, Bell, Search, User } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [medicines, setMedicines] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const medRes = await axios.get(`${API_BASE}/medicines`);
        const alertRes = await axios.get(`${API_BASE}/alerts`);
        const orderRes = await axios.get(`${API_BASE}/orders/recent`);
        setMedicines(medRes.data);
        setAlerts(alertRes.data);
        setRecentOrders(orderRes.data);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Poll every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#1E293B] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-white border-r border-[#E2E8F0] flex flex-col">
        <div className="h-20 flex items-center px-6 border-b border-[#F1F5F9]">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200">
            P
          </div>
          <span className="ml-3 font-bold text-xl tracking-tight hidden lg:block text-[#0F172A]">PharmaBuddy</span>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl font-semibold flex items-center lg:gap-3 cursor-pointer">
            <LayoutDashboard size={22} />
            <span className="hidden lg:block text-sm">Dashboard</span>
          </div>
          <div className="p-3 text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] rounded-xl font-medium flex items-center lg:gap-3 cursor-pointer transition-all">
            <MessageSquare size={22} />
            <span className="hidden lg:block text-sm">AI Copilot</span>
          </div>
          <div className="p-3 text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] rounded-xl font-medium flex items-center lg:gap-3 cursor-pointer transition-all">
            <Settings size={22} />
            <span className="hidden lg:block text-sm">Settings</span>
          </div>
        </nav>

        <div className="p-4 border-t border-[#F1F5F9] hidden lg:block">
          <div className="bg-[#0F172A] p-4 rounded-2xl text-white">
            <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mb-2 font-mono">Agent Status</p>
            <p className="text-sm font-medium mb-1">Thinking Mode: Active</p>
            <div className="h-1.5 w-full bg-[#1E293B] rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-[65%] animate-pulse"></div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4 bg-[#F1F5F9] px-4 py-2 rounded-xl border border-transparent focus-within:border-blue-300 focus-within:bg-white transition-all w-96">
            <Search size={18} className="text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search medicines, orders..."
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-[#94A3B8]"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="relative w-10 h-10 rounded-xl hover:bg-[#F1F5F9] flex items-center justify-center transition-all text-[#64748B] group">
              <Bell size={20} />
              {alerts.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <div className="w-px h-6 bg-[#E2E8F0]"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                
                <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">Pharmacy Admin</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <User size={20} />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-[#0F172A]">Pharmacy Dashboard</h1>
              <p className="text-[#64748B] text-sm mt-1">Found 1,195 historical orders. Real-time stock tracked.</p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 text-sm font-bold bg-[#0F172A] text-white rounded-xl shadow-lg shadow-slate-200 hover:shadow-xl transition-all active:scale-95">
                New Order
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Stats - Actual Counts */}
            <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Stock', val: medicines.reduce((acc, m) => acc + (m.total_tablets || 0), 0), color: 'blue' },
                { label: 'Low Stock Items', val: medicines.filter(m => m.total_tablets < m.low_stock_threshold).length, color: 'red' },
                { label: 'Total Orders', val: '1,195', color: 'emerald' },
                { label: 'Near Expiry', val: medicines.filter(m => m.expiry_date && new Date(m.expiry_date) < new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)).length, color: 'amber' }
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-[#F1F5F9] shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className="text-2xl font-black text-[#0F172A]">{stat.val}</p>
                </div>
              ))}
            </div>

            {/* Inventory Table & Recent Orders */}
            <div className="col-span-12 xl:col-span-8 space-y-8">
              {loading ? (
                <div className="h-64 flex items-center justify-center bg-white rounded-2xl border border-[#F1F5F9]">
                  <div className="flex items-center gap-3 text-blue-600 font-bold animate-pulse">
                    <div className="w-8 h-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                    Loading Data...
                  </div>
                </div>
              ) : (
                <>
                  <MedicineTable medicines={medicines} />

                  {/* Recent Orders Table */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                      <h2 className="text-lg font-semibold text-gray-800">Recent Transactions</h2>
                      <span className="text-xs text-gray-400 font-medium">Last 5 Orders</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-gray-400 text-xs uppercase tracking-wider bg-gray-50">
                            <th className="px-6 py-3 font-medium">Customer</th>
                            <th className="px-6 py-3 font-medium">Mobile</th>
                            <th className="px-6 py-3 font-medium text-right">Total Price</th>
                            <th className="px-6 py-3 font-medium text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {recentOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.customer_name || 'Walk-in'}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">{order.mobile || 'N/A'}</td>
                              <td className="px-6 py-4 text-right text-sm font-bold text-blue-600">€{Number(order.total_price).toFixed(2)}</td>
                              <td className="px-6 py-4 text-right text-xs text-gray-400">
                                {new Date(order.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Side Panel: Alerts */}
            <div className="col-span-12 xl:col-span-4 h-full min-h-[500px]">
              <AlertsPanel alerts={alerts} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
