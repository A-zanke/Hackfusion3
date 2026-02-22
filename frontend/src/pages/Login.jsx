import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import '../App.css';

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('admin@pharma.ai');
    const [password, setPassword] = useState('********');

    const handleLogin = (e) => {
        e.preventDefault();
        navigate('/');
    };

    return (
        <div className="login-gradient min-h-screen flex flex-col items-center justify-center px-4">
            {/* Logo */}
            <div className="mb-8 text-center animate-fade-in">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20M2 12h20" />
                        <path d="M8 6l4-4 4 4" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Agentic AI Pharmacist</h1>
                <p className="text-sm mt-1" style={{ color: '#64748b' }}>Autonomous Smart Healthcare Assistant</p>
            </div>

            {/* Login Card */}
            <div className="glass-card rounded-2xl p-8 w-full max-w-md animate-slide-in-up">
                <h2 className="text-lg font-bold text-white mb-6">Sign in to your account</h2>

                <form onSubmit={handleLogin}>
                    {/* Email */}
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                        style={{ color: '#94a3b8' }}>EMAIL</label>
                    <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Mail size={16} style={{ color: '#64748b' }} />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm w-full text-white placeholder:text-gray-500"
                            placeholder="admin@pharma.ai"
                        />
                    </div>

                    {/* Password */}
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                        style={{ color: '#94a3b8' }}>PASSWORD</label>
                    <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Lock size={16} style={{ color: '#64748b' }} />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm w-full text-white placeholder:text-gray-500"
                            placeholder="••••••••"
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                    >
                        Sign In <ArrowRight size={16} />
                    </button>
                </form>

                {/* Demo Credentials */}
                <div className="mt-8">
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                        style={{ color: '#64748b' }}>DEMO CREDENTIALS</p>

                    <div className="rounded-xl p-3 mb-2 cursor-pointer transition-all"
                        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}
                        onClick={() => { setEmail('admin@pharma.ai'); setPassword('********'); }}>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: '#10b981' }}></div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: '#10b981' }}>Admin Access</p>
                                <p className="text-[11px]" style={{ color: '#64748b' }}>admin@pharma.ai · Full dashboard access</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl p-3 cursor-pointer transition-all"
                        style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}
                        onClick={() => { setEmail('staff@pharma.ai'); setPassword('********'); }}>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }}></div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: '#60a5fa' }}>Staff Access</p>
                                <p className="text-[11px]" style={{ color: '#64748b' }}>staff@pharma.ai · Chat & Orders only</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <p className="mt-8 text-[11px] animate-fade-in" style={{ color: '#475569' }}>
                Agentic AI Pharmacist v3.0 · Intelligent Healthcare · Secured with JWT
            </p>
        </div>
    );
};

export default Login;
