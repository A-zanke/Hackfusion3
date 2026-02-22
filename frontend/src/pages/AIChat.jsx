import React, { useState } from 'react';
import { Mic, Send, Bot, Cpu } from 'lucide-react';
import '../App.css';

const AIChat = () => {
    const [input, setInput] = useState('');
    const [messages] = useState([
        {
            role: 'assistant',
            content: `👋 Hello! I'm **PharmaAI**, your intelligent pharmacy assistant.

I can help you with:
• 💊 Ordering medicines (Hindi, Marathi, English)
• 📦 Checking stock levels
• ⏳ Expiry monitoring
• 🔵 Safety & overdose prevention

🎙 You can also use **voice input** — just click the mic button!

How can I assist you today?`,
            time: '01:23 pm',
        },
    ]);

    const quickActions = ['Check stock levels', 'Expiry alerts', 'I need 5 Vitamin C'];

    const handleSend = () => {
        if (!input.trim()) return;
        setInput('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const renderMessageContent = (text) => {
        return text.split('\n').map((line, i) => {
            // Bold
            const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            return (
                <p key={i} className="text-sm leading-relaxed" style={{ color: '#334155' }}
                    dangerouslySetInnerHTML={{ __html: formatted || '&nbsp;' }} />
            );
        });
    };

    return (
        <div>
            {/* Title */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>AI Pharmacy Assistant</h1>
                <p className="text-sm" style={{ color: '#10b981' }}>
                    Chat with PharmaAI — supports Hindi, Marathi & English · Voice enabled
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" style={{ minHeight: 'calc(100vh - 220px)' }}>
                {/* Chat Panel */}
                <div className="lg:col-span-3 bg-white rounded-2xl border flex flex-col"
                    style={{ borderColor: '#f1f5f9' }}>

                    {/* Chat Header */}
                    <div className="flex items-center justify-between px-6 py-4"
                        style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: '#d1fae5' }}>
                                <Bot size={20} style={{ color: '#10b981' }} />
                            </div>
                            <div>
                                <p className="text-sm font-bold" style={{ color: '#0f172a' }}>PharmaAI Assistant</p>
                                <p className="text-[11px]" style={{ color: '#10b981' }}>
                                    ● Online — Autonomous Mode
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1"
                                style={{ background: '#d1fae5', color: '#059669' }}>
                                🌐 English
                            </span>
                            <button className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
                                style={{ color: '#ef4444' }}>
                                <Mic size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {messages.map((msg, i) => (
                            <div key={i} className="max-w-lg animate-fade-in">
                                <div className="rounded-2xl p-5"
                                    style={{
                                        background: msg.role === 'assistant' ? '#f8fafc' : '#10b981',
                                        borderTopLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
                                    }}>
                                    {renderMessageContent(msg.content)}
                                </div>
                                {msg.time && (
                                    <p className="text-[11px] mt-1 ml-1" style={{ color: '#10b981' }}>{msg.time}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Input Area */}
                    <div className="px-6 py-4" style={{ borderTop: '1px solid #f1f5f9' }}>
                        <div className="flex items-center gap-3">
                            <button className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors hover:bg-gray-100"
                                style={{ color: '#94a3b8' }}>
                                <Mic size={18} />
                            </button>
                            <div className="flex-1 flex items-center gap-2 rounded-xl px-4 py-2.5 border"
                                style={{ borderColor: '#e2e8f0' }}>
                                <input
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type or speak in Hindi, Marathi, or English..."
                                    className="flex-1 bg-transparent border-none outline-none text-sm"
                                    style={{ color: '#0f172a' }}
                                />
                            </div>
                            <button
                                onClick={handleSend}
                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white transition-all active:scale-95"
                                style={{ background: '#10b981' }}>
                                <Send size={16} />
                            </button>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex gap-2 mt-3 flex-wrap">
                            {quickActions.map((action, i) => (
                                <button key={i}
                                    onClick={() => setInput(action)}
                                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:bg-gray-50"
                                    style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
                                    {action}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Agentic Decision Engine Panel */}
                <div className="bg-white rounded-2xl border flex flex-col items-center justify-center p-8 text-center"
                    style={{ borderColor: '#f1f5f9' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: '#d1fae5' }}>
                        <Cpu size={24} style={{ color: '#10b981' }} />
                    </div>
                    <h3 className="text-sm font-bold mb-2" style={{ color: '#0f172a' }}>Agentic Decision Engine</h3>
                    <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                        Send a message to see the AI reasoning pipeline in real-time
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AIChat;
