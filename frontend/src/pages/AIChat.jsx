import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send, Mic, Pill, Cpu, Settings, ChevronRight, Sparkles } from 'lucide-react';
import '../App.css';
import { Link } from "react-router-dom";
const AIChat = () => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `👋 Hello! I'm **PharmaAI**, your intelligent pharmacy assistant.
I help only with medicine ordering, refills, or pharmacy-related questions.

🎙 You can also use **voice input** — just click the mic button!
How can I assist you today?`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [selectedMedicine, setSelectedMedicine] = useState(null);
    const [showTabletSelector, setShowTabletSelector] = useState(false);
    const [tabletCount, setTabletCount] = useState(1);
    const [decisionMetadata, setDecisionMetadata] = useState({
        intent_verified: false,
        safety_checked: false,
        stock_checked: false,
        thinking: ''
    });
    const [sessionState, setSessionState] = useState(null);
    const [allMedicines, setAllMedicines] = useState([]);
    const [selectedTablets, setSelectedTablets] = useState({});
    const [isVoiceInput, setIsVoiceInput] = useState(false);
    const chatMessagesRef = useRef(null);

    const [currentTime, setCurrentTime] = useState(new Date());
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        const fetchMeds = async () => {
            try {
                const res = await fetch('http://localhost:5000/api/medicines');
                const data = await res.json();
                setAllMedicines(data);
            } catch (e) {
                console.error("Failed to fetch medicines for autocomplete", e);
            }
        };
        fetchMeds();

        // Function to refresh medicines data
        const refreshMedicines = async () => {
            try {
                const res = await fetch('http://localhost:5000/api/medicines');
                const data = await res.json();
                setAllMedicines(data);
                console.log('Medicines data refreshed after stock change');
            } catch (e) {
                console.error("Failed to refresh medicines", e);
            }
        };

        // Check login session
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                // Optionally greet the user if they're logged in
            } catch (e) {
                console.error("Session parse error", e);
            }
        }

        // Check for re-order or user parameters
        const params = new URLSearchParams(window.location.search);
        const reorderMed = params.get('reorder');
        const reorderQty = params.get('qty');
        const userName = params.get('user');

        if (reorderMed && reorderQty) {
            const message = `I want to re-order ${reorderQty} tablets of ${reorderMed}`;
            setTimeout(() => {
                handleSend(message);
            }, 800);
        } else if (userName) {
            const greeting = {
                role: 'assistant',
                content: `👋 Hello **${userName}**! Welcome back. I've loaded your profile.
How can I assist you today? Would you like to re-order something from your previous list?`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, greeting]);
        }

        return () => clearInterval(timer);
    }, []);

    const dateStr = currentTime.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const timeStr = currentTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });



    // const handleAdminClick = () => {
    // navigate("/admin/login");
    // };

    const handleInputChange = async (e) => {
        const value = e.target.value;
        setInput(value);

        // Search medicines when typing
        if (value.length > 2) {
            console.log('Searching for medicines with query:', value);
            try {
                const response = await fetch(`http://localhost:5000/api/medicines/search?q=${encodeURIComponent(value)}`);
                if (response.ok) {
                    const medicines = await response.json();
                    console.log('Medicines found:', medicines);
                    setSuggestions(medicines);
                } else {
                    console.error('Search failed with status:', response.status);
                }
            } catch (error) {
                console.error('Medicine search error:', error);
            }
        } else {
            setSuggestions([]);
        }
    };

    const handleTabletSelect = (medicineName, count) => {
        setSelectedTablets(prev => ({ ...prev, [medicineName]: count }));
        setInput(`${medicineName} ${count} tablets`);
        setShowTabletSelector(false);
        setSuggestions([]);
    };

    const handleSend = async (overrideInput = null, voiceTrigger = false) => {
        const textToSearch = overrideInput || input;
        if (!textToSearch.trim()) return;

        const userMsg = { role: 'user', content: textToSearch, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setSuggestions([]);
        setShowTabletSelector(false);
        setIsTyping(true);

        const currentIsVoice = voiceTrigger || isVoiceInput;

        try {
            // Use local backend API instead of OpenAI
            const history = messages.map(m => ({ role: m.role, content: m.content }));
            const response = await fetch('http://localhost:5000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: textToSearch, history })
            });

            if (!response.ok) {
                throw new Error('Backend not responding');
            }

            const data = await response.json();

            const botMsg = {
                role: 'assistant',
                content: data.reply,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                sessionState: data.sessionState
            };
            setMessages(prev => [...prev, botMsg]);
            setSessionState(data.sessionState);
            setDecisionMetadata({
                intent_verified: data.intent_verified,
                safety_checked: data.safety_checked,
                stock_checked: data.stock_checked,
                thinking: data.thinking || "Decision pipeline executed successfully."
            });
            // Only speak if voice input was used
            if (currentIsVoice) {
                speakResponse(data.reply);
                setIsVoiceInput(false);
            }

            // Scroll to bottom immediately
            if (chatMessagesRef.current) {
                chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
            }

            // Also scroll after a short delay to ensure content is rendered
            setTimeout(() => {
                if (chatMessagesRef.current) {
                    chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
                }
            }, 100);

            // Refocus the input field after sending
            setTimeout(() => {
                const inputField = document.querySelector('.chat-input-field');
                if (inputField) {
                    inputField.focus();
                }
            }, 150);

            // Refresh medicines data to show updated stock levels
            refreshMedicines();

        } catch (error) {
            console.error("AI Chat Error:", error);

            // Show error message in chat
            const errorMsg = {
                role: 'assistant',
                content: '❌ Sorry, I encountered an error while processing your request. Please try again or contact support if the problem persists.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isError: true
            };
            setMessages(prev => [...prev, errorMsg]);

            // Also try to show more specific error if available
            if (error.response && error.response.data && error.response.data.reply) {
                const specificErrorMsg = {
                    role: 'assistant',
                    content: error.response.data.reply,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isError: true
                };
                setMessages(prev => [...prev, specificErrorMsg]);
            }

            // Refocus the input field even after error
            setTimeout(() => {
                const inputField = document.querySelector('.chat-input-field');
                if (inputField) {
                    inputField.focus();
                }
            }, 150);
        } finally {
            setIsTyping(false);
        }
    };

    const startVoiceInput = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Your browser does not support voice recognition.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
            setIsVoiceInput(true);
            handleSend(transcript, true); // Pass true explicitly
        };
        recognition.start();
    };

    const speakResponse = (text) => {
        const synth = window.speechSynthesis;
        const utter = new SpeechSynthesisUtterance(text);
        // Try to detect language or just let browser handle it
        synth.speak(utter);
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
        <div className="ai-chat-page">
            {/* Premium Header */}
            <header className="premium-chat-header">
                <div className="header-brand">
                    <div className="brand-logo">
                        <Bot size={28} />
                    </div>
                    <div>
                        <h1 className="brand-title">PharmaAI Assistant</h1>
                        <p className="brand-tagline">Intelligent Autonomous Healthcare</p>
                    </div>
                </div>

                <div className="header-info">
                    <div className="live-clock">
                        <span className="live-date">{dateStr}</span>
                        <span className="live-time">{timeStr}</span>
                    </div>
                    <Link to="/dashboard" style={{ textDecoration: "none" }}>
                        <button className="premium-admin-btn">
                            <Settings size={18} />
                            <span>Admin</span>
                        </button>
                    </Link>
                </div>
            </header>

            <div className="ai-chat-main-container">

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

                    <div className="chat-messages-area" ref={chatMessagesRef}>
                        {messages.map((msg, i) => (
                            <div key={i} className={`animate-fade-in message-wrapper ${msg.role} ${msg.isError ? 'error-message' : ''}`}>
                                <div className={`message-bubble ${msg.role} ${msg.isError ? 'error' : ''}`}>
                                    {renderMessageContent(msg.content)}
                                </div>
                                {msg.time && (
                                    <p className="message-time">{msg.time}</p>
                                )}
                            </div>
                        ))}
                        {isTyping && (
                            <div className="message-wrapper assistant">
                                <div className="message-bubble assistant typing">
                                    <div className="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                    PharmaAI is thinking...
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="chat-input-area">
                        {/* Debug Info - Remove in production */}
                        {process.env.NODE_ENV === 'development' && (
                            <div style={{ fontSize: '10px', color: 'gray', marginBottom: '5px' }}>
                                Debug: Suggestions count: {suggestions.length}, Input: "{input}"
                            </div>
                        )}

                        {/* Medicine Suggestions Bar - Moved inside input area */}
                        {suggestions.length > 0 && (
                            <div className="medicine-suggestions-bar">
                                <div className="suggestions-bar-header">
                                    <Pill size={16} className="suggestions-bar-icon" />
                                    <span>Did you mean?</span>
                                    <button
                                        onClick={() => setSuggestions([])}
                                        className="suggestions-bar-close"
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="suggestions-bar-content">
                                    {suggestions.map((med, i) => (
                                        <div
                                            key={i}
                                            className="suggestion-bar-item"
                                            onClick={() => {
                                                // Populate input and focus for quantity entering
                                                setInput(med.name + ' ');
                                                setSuggestions([]);
                                                // Optional: automatically focus the input
                                                document.querySelector('.chat-input-field')?.focus();
                                            }}
                                        >
                                            <div className="suggestion-bar-info">
                                                <div className="suggestion-bar-name">{med.name}</div>
                                                <div className="suggestion-bar-meta">
                                                    {med.brand && <span className="suggestion-bar-brand">{med.brand}</span>}
                                                    {med.price && <span className="suggestion-bar-price">₹{med.price}</span>}
                                                </div>
                                            </div>
                                            <div className="suggestion-bar-action">
                                                <Send size={14} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="chat-input-row">
                            <button className="input-mic-btn" onClick={() => startVoiceInput()}>
                                <Mic size={20} />
                            </button>
                            <div className="chat-input-box">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={handleInputChange}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Type medicine name or quantity..."
                                    className="chat-input-field"
                                    disabled={isTyping}
                                />
                                <button
                                    className="chat-send-btn"
                                    onClick={() => handleSend()}
                                    disabled={isTyping || !input.trim()}
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                        
                        {showTabletSelector && (
                            <div className="tablet-selector">
                                <div className="tablet-selector-header">
                                    <Pill size={16} />
                                    <span>Select number of tablets:</span>
                                </div>
                                <div className="tablet-options">
                                    {tabletSuggestions.map(count => (
                                        <button
                                            key={count}
                                            className={`tablet-option ${selectedTablets[input.split(' ')[0]] === count ? 'selected' : ''}`}
                                            onClick={() => handleTabletSelect(input.split(' ')[0], count)}
                                        >
                                            {count}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Agentic Decision Engine */}
                <div className="decision-engine-panel">
                    <div className="decision-header">
                        <div className="decision-icon-wrapper">
                            <Cpu size={24} />
                        </div>
                        <h3 className="decision-title">Agentic Decision Engine</h3>
                    </div>

                    <div className="decision-checks">
                        <div className={`decision-check-item ${decisionMetadata.intent_verified ? 'verified' : ''}`}>
                            <span className="check-icon">{decisionMetadata.intent_verified ? '✔' : '○'}</span>
                            <span className="check-label">Intent Verified</span>
                        </div>
                        <div className={`decision-check-item ${decisionMetadata.safety_checked ? 'verified' : ''}`}>
                            <span className="check-icon">{decisionMetadata.safety_checked ? '✔' : '○'}</span>
                            <span className="check-label">Safety Checked</span>
                        </div>
                        <div className={`decision-check-item ${decisionMetadata.stock_checked ? 'verified' : ''}`}>
                            <span className="check-icon">{decisionMetadata.stock_checked ? '✔' : '○'}</span>
                            <span className="check-label">Stock Checked</span>
                        </div>
                    </div>

                    <div className="thinking-area">
                        <p className="thinking-title">Chain of Thought (CoT)</p>
                        <div className="thinking-box">
                            {decisionMetadata.thinking || "AI reasoning pipeline waiting for input..."}
                        </div>
                    </div>

                    <div className="langfuse-link">
                        <p className="decision-description" style={{ marginTop: 'auto', fontSize: '0.8rem', opacity: 0.7 }}>
                            View full traces on <strong>Langfuse</strong>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIChat;
