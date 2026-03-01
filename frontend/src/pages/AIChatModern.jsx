import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send, Mic, Pill, Settings, Sparkles, Receipt, ShoppingCart, Gift, X, Plus, MessageSquare, Trash2, Edit3, Check } from 'lucide-react';
import '../App.css';
import '../components/ModernChat.css';
import { Link } from "react-router-dom";
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

const socket = io('http://localhost:5000');

const AIChat = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [selectedMedicine, setSelectedMedicine] = useState(null);
    const [showTabletSelector, setShowTabletSelector] = useState(false);
    const [tabletCount, setTabletCount] = useState(1);
    const [isVoiceInput, setIsVoiceInput] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [userLanguage, setUserLanguage] = useState('en');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [chatSessions, setChatSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState('chat-' + Date.now());
    const [editingSessionId, setEditingSessionId] = useState(null);
    const [editingTitle, setEditingTitle] = useState('');
    const chatMessagesRef = useRef(null);

    // Initialize with greeting
    useEffect(() => {
        const initialGreeting = {
            role: 'assistant',
            content: `👋 Hello! I'm **PharmaAI**, your intelligent pharmacy assistant.
I help only with medicine ordering, refills, or pharmacy-related questions.

🎙 You can also use **voice input** — just click the mic button!
How can I assist you today?`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages([initialGreeting]);
        loadChatSessions();
    }, []);

    // Load chat sessions from localStorage
    const loadChatSessions = () => {
        try {
            const sessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
            setChatSessions(sessions);
        } catch (error) {
            console.error('Failed to load chat sessions:', error);
        }
    };

    // Save chat sessions to localStorage
    const saveChatSessions = (sessions) => {
        try {
            localStorage.setItem('chatSessions', JSON.stringify(sessions));
        } catch (error) {
            console.error('Failed to save chat sessions:', error);
        }
    };

    // Create new chat session
    const createNewChat = () => {
        // Save current session if it has messages
        if (messages.length > 1) {
            const currentSession = chatSessions.find(s => s.id === currentSessionId);
            if (!currentSession) {
                const newSession = {
                    id: currentSessionId,
                    title: 'New Chat',
                    messages: messages,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                const updatedSessions = [...chatSessions, newSession];
                setChatSessions(updatedSessions);
                saveChatSessions(updatedSessions);
            }
        }

        // Create new session
        const newSessionId = 'chat-' + Date.now();
        setCurrentSessionId(newSessionId);
        setMessages([{
            role: 'assistant',
            content: `👋 Hello! I'm **PharmaAI**, your intelligent pharmacy assistant.
I help only with medicine ordering, refills, or pharmacy-related questions.

🎙 You can also use **voice input** — just click the mic button!
How can I assist you today?`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setInput('');
        setSuggestions([]);
    };

    // Switch to a chat session
    const switchToSession = (sessionId) => {
        const session = chatSessions.find(s => s.id === sessionId);
        if (session) {
            setCurrentSessionId(sessionId);
            setMessages(session.messages || []);
        }
    };

    // Delete chat session
    const deleteSession = (sessionId, e) => {
        e.stopPropagation();
        const updatedSessions = chatSessions.filter(s => s.id !== sessionId);
        setChatSessions(updatedSessions);
        saveChatSessions(updatedSessions);
        
        if (sessionId === currentSessionId) {
            createNewChat();
        }
    };

    // Start editing session title
    const startEditingSession = (sessionId, e) => {
        e.stopPropagation();
        const session = chatSessions.find(s => s.id === sessionId);
        if (session) {
            setEditingSessionId(sessionId);
            setEditingTitle(session.title);
        }
    };

    // Save session title
    const saveSessionTitle = (sessionId) => {
        const updatedSessions = chatSessions.map(s => 
            s.id === sessionId 
                ? { ...s, title: editingTitle, updatedAt: new Date().toISOString() }
                : s
        );
        setChatSessions(updatedSessions);
        saveChatSessions(updatedSessions);
        setEditingSessionId(null);
        setEditingTitle('');
    };

    // Auto-save current session
    useEffect(() => {
        if (messages.length > 1) {
            const updatedSessions = chatSessions.map(s => 
                s.id === currentSessionId 
                    ? { ...s, messages: messages, updatedAt: new Date().toISOString() }
                    : s
            );
            
            // If current session doesn't exist, add it
            if (!updatedSessions.find(s => s.id === currentSessionId)) {
                const title = messages[1]?.content?.substring(0, 30) + '...' || 'New Chat';
                updatedSessions.push({
                    id: currentSessionId,
                    title: title,
                    messages: messages,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
            
            setChatSessions(updatedSessions);
            saveChatSessions(updatedSessions);
        }
    }, [messages, currentSessionId]);

    const handleSend = async (overrideInput = null, voiceTrigger = false) => {
        const textToSend = overrideInput || input;
        if (!textToSend.trim()) return;

        const userMsg = {
            role: 'user',
            content: textToSend,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setSuggestions([]);
        setShowTabletSelector(false);
        setIsTyping(true);

        try {
            const response = await fetch('http://localhost:5000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: textToSend })
            });

            const data = await response.json();

            if (response.ok) {
                const botMsg = {
                    role: 'assistant',
                    content: data.reply,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                setMessages(prev => [...prev, botMsg]);
                
                if (voiceTrigger) {
                    speakResponse(data.reply, userLanguage);
                }
            } else {
                const errorMsg = {
                    role: 'assistant',
                    content: data.error || 'Sorry, I encountered an error.',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isError: true
                };
                setMessages(prev => [...prev, errorMsg]);
            }
        } catch (error) {
            const errorMsg = {
                role: 'assistant',
                content: 'Network error. Please check your connection.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isError: true
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const speakResponse = (text, langCode = 'en') => {
        const synth = window.speechSynthesis;
        synth.cancel();
        setIsSpeaking(true);

        const cleanText = text
            .replace(/[🎉✅❌⚠️⚕️💊💰📦📝🧾]/g, '')
            .replace(/[★☆♦♥♠♣]/g, '')
            .replace(/[•]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const utter = new SpeechSynthesisUtterance(cleanText);
        utter.lang = langCode === 'hi' ? 'hi-IN' : langCode === 'mr' ? 'mr-IN' : 'en-IN';
        utter.rate = 1.0;
        utter.pitch = 1.0;
        utter.volume = 0.9;

        utter.onend = () => setIsSpeaking(false);
        utter.onerror = () => setIsSpeaking(false);

        synth.speak(utter);
    };

    const startVoiceInput = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Your browser does not support voice recognition.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = userLanguage === 'hi' ? 'hi-IN' : userLanguage === 'mr' ? 'mr-IN' : 'en-US';
        
        recognition.onstart = () => {
            setIsListening(true);
            setIsVoiceInput(true);
        };
        
        recognition.onend = () => {
            setIsListening(false);
        };
        
        recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript;
            setInput(transcript);
            if (event.results[event.results.length - 1].isFinal) {
                setIsVoiceInput(true);
                handleSend(transcript, true);
            }
        };
        recognition.start();
    };

    const stopVoiceInput = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.stop();
            setIsListening(false);
            setIsVoiceInput(false);
        }
    };

    const toggleVoiceInput = () => {
        if (isListening) {
            stopVoiceInput();
        } else {
            startVoiceInput();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const renderMessageContent = (text) => {
        return text.split('\n').map((line, i) => (
            <p key={i} className="message-text" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') || '&nbsp;' }} />
        ));
    };

    return (
        <div className="modern-chat-container">
            {/* Sidebar */}
            <div className={`chat-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <button className="new-chat-btn" onClick={createNewChat}>
                        <Plus size={20} />
                        <span>New Chat</span>
                    </button>
                    <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        <MessageSquare size={20} />
                    </button>
                </div>
                
                <div className="chat-sessions">
                    {chatSessions.map(session => (
                        <div
                            key={session.id}
                            className={`chat-session ${session.id === currentSessionId ? 'active' : ''}`}
                            onClick={() => switchToSession(session.id)}
                        >
                            {editingSessionId === session.id ? (
                                <div className="session-title-edit">
                                    <input
                                        type="text"
                                        value={editingTitle}
                                        onChange={(e) => setEditingTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                saveSessionTitle(session.id);
                                            } else if (e.key === 'Escape') {
                                                setEditingSessionId(null);
                                                setEditingTitle('');
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <button onClick={() => saveSessionTitle(session.id)}>
                                        <Check size={16} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span className="session-title">{session.title}</span>
                                    <div className="session-actions">
                                        <button onClick={(e) => startEditingSession(session.id, e)}>
                                            <Edit3 size={14} />
                                        </button>
                                        <button onClick={(e) => deleteSession(session.id, e)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="chat-main">
                {/* Header */}
                <header className="modern-chat-header">
                    <div className="header-left">
                        <div className="bot-avatar">
                            <Bot size={24} />
                        </div>
                        <div className="header-info">
                            <h1>PharmaAI Assistant</h1>
                            <p className="status">
                                <span className="status-dot"></span>
                                {isSpeaking ? 'Speaking...' : 'Online'}
                            </p>
                        </div>
                    </div>
                    <div className="header-right">
                        {user?.role === 'admin' && (
                            <Link to="/dashboard" style={{ textDecoration: "none" }}>
                                <button className="admin-btn">
                                    <Settings size={18} />
                                    <span>Admin</span>
                                </button>
                            </Link>
                        )}
                    </div>
                </header>

                {/* Messages Area */}
                <div className="messages-area" ref={chatMessagesRef}>
                    {messages.map((msg, i) => (
                        <div key={i} className={`message ${msg.role} ${msg.isError ? 'error' : ''}`}>
                            <div className="message-content">
                                {renderMessageContent(msg.content)}
                            </div>
                            <span className="message-time">{msg.time}</span>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="typing-indicator">
                            <div className="typing-dots">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="input-area">
                    <div className="input-container">
                        <button
                            className={`voice-btn ${isListening ? 'listening' : ''}`}
                            onClick={toggleVoiceInput}
                        >
                            <Mic size={20} />
                            {isListening && (
                                <div className="voice-wave">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            )}
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your message..."
                            className="message-input"
                        />
                        <button
                            className="send-btn"
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isTyping}
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIChat;
