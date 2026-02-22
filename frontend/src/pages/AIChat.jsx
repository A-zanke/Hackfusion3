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
            const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            return (
                <p key={i} className="message-text"
                    dangerouslySetInnerHTML={{ __html: formatted || '&nbsp;' }} />
            );
        });
    };

    return (
        <div className="ai-chat-container">
            {/* Title Area */}
            <div className="ai-chat-title-area">
                <h1 className="ai-chat-title">AI Pharmacy Assistant</h1>
                <p className="ai-chat-subtitle">
                    Chat with PharmaAI — supports Hindi, Marathi & English · Voice enabled
                </p>
            </div>

            {/* Grid Layout Container */}
            <div className="ai-chat-grid">

                {/* Chat Panel - Left */}
                <div className="chat-panel">

                    <div className="chat-header">
                        <div className="chat-header-left">
                            <div className="chat-bot-icon">
                                <Bot size={20} />
                            </div>
                            <div>
                                <p className="chat-bot-name">PharmaAI Assistant</p>
                                <p className="chat-bot-status">
                                    <span className="chat-bot-status-dot"></span>
                                    Online — Autonomous Mode
                                </p>
                            </div>
                        </div>
                        <div className="chat-header-right">
                            <span className="lang-badge">
                                🌐 English
                            </span>
                            <button className="header-mic-btn">
                                <Mic size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="chat-messages-area">
                        {messages.map((msg, i) => (
                            <div key={i} className="animate-fade-in message-wrapper">
                                <div className={`message-bubble ${msg.role}`}>
                                    {renderMessageContent(msg.content)}
                                </div>
                                {msg.time && (
                                    <p className="message-time">{msg.time}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="chat-input-area">
                        <div className="chat-input-row">
                            <button className="input-mic-btn">
                                <Mic size={20} />
                            </button>
                            <div className="chat-input-box">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type or speak in Hindi, Marathi, or English..."
                                    className="chat-input-field"
                                />
                            </div>
                            <button onClick={handleSend} className="chat-send-btn">
                                <Send size={18} />
                            </button>
                        </div>

                        <div className="quick-actions-row">
                            {quickActions.map((action, i) => (
                                <button key={i}
                                    onClick={() => setInput(action)}
                                    className="quick-action-btn">
                                    {action}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel - Agentic Decision Engine */}
                <div className="decision-engine-panel">
                    <div className="decision-icon-wrapper">
                        <Cpu size={32} />
                    </div>
                    <h3 className="decision-title">Agentic Decision Engine</h3>
                    <p className="decision-description">
                        Send a message to see the AI reasoning pipeline in real-time
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AIChat;
