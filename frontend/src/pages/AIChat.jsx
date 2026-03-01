import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send, Mic, Pill, Settings, Sparkles, Receipt, ShoppingCart, Gift, X, Search, Plus, MessageSquare, Trash2, CheckCircle } from 'lucide-react';
import '../App.css';
import { Link } from "react-router-dom";
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import QRCode from 'react-qr-code';
const socket = io('http://localhost:5000');

const AIChat = () => {
    const { user } = useAuth();
    const [input, setInput] = useState('');
    const initialGreeting = {
        role: 'assistant',
        content: `👋 Hello! I'm **PharmaAI**, your intelligent pharmacy assistant.
I help only with medicine ordering, refills, or pharmacy-related questions.

🎙 You can also use **voice input** — just click the mic button!
How can I assist you today?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const getInitialMessages = () => {
        try {
            const stored = localStorage.getItem('pharma_ai_chat_v1');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Date.now() - (parsed.savedAt || 0) < 24 * 60 * 60 * 1000 && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
                    return parsed.messages;
                } else {
                    localStorage.removeItem('pharma_ai_chat_v1');
                }
            }
        } catch (e) {
            console.error('Failed to restore chat history', e);
        }
        return [initialGreeting];
    };

    const [messages, setMessages] = useState(getInitialMessages);
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
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const chatMessagesRef = useRef(null);

    const [userLanguage, setUserLanguage] = useState('en');

    const [currentTime, setCurrentTime] = useState(new Date());
    const navigate = useNavigate();

    // New Sidebar States
    const [showOrdersPanel, setShowOrdersPanel] = useState(false);
    const [showCartDrawer, setShowCartDrawer] = useState(false);
    const [showOffersPanel, setShowOffersPanel] = useState(false);
    const [customerOrders, setCustomerOrders] = useState([]);
    const [orderSearchQuery, setOrderSearchQuery] = useState('');
    const [cartItems, setCartItems] = useState([]);
    const [appliedOffer, setAppliedOffer] = useState(null);
    const [cartData, setCartData] = useState({ items: [], total: 0 });
    const [offersData, setOffersData] = useState([
        { code: 'HEALTH20', desc: 'Flat 20% off on orders above ₹500', discount: 20, minOrder: 500, type: 'percent' },
        { code: 'FIRST50', desc: '₹50 off on your first order', discount: 50, minOrder: 0, type: 'flat' },
        { code: 'WELLNESS10', desc: '10% off on all medicines', discount: 10, minOrder: 100, type: 'percent' },
        { code: 'FREEDEL', desc: 'Free Delivery on orders above ₹300', discount: 0, minOrder: 300, type: 'delivery' },
        { code: 'MEGA30', desc: 'Flat 30% off (Max ₹200) on orders above ₹800', discount: 30, minOrder: 800, type: 'percent', maxDiscount: 200 }
    ]);
    const [paymentState, setPaymentState] = useState({
        status: null,
        qrLink: '',
        orderId: '',
        expiryTime: null
    });

    // Check expiry countdown
    useEffect(() => {
        let interval;
        if (paymentState.status === 'pending' && paymentState.expiryTime) {
            interval = setInterval(() => {
                if (Date.now() > paymentState.expiryTime) {
                    setPaymentState(prev => ({ ...prev, status: 'expired' }));
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [paymentState]);

    const handleCheckout = async () => {
        if (cartItems.length === 0) return;

        try {
            const customerName = user?.username || user?.name || 'Guest';

            const res = await fetch('http://localhost:5000/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cartItems.map(item => {
                        const med = allMedicines.find(m => m.name.toLowerCase() === item.name.toLowerCase() || (m.brand && m.brand.toLowerCase() === item.name.toLowerCase()));
                        return {
                            medicine_id: med ? med.id : null,
                            quantity: item.quantity,
                            price: item.price,
                            name: item.name
                        };
                    }),
                    total_price: getCartTotal(),
                    customer_name: customerName
                })
            });

            if (res.ok) {
                const data = await res.json();
                setPaymentState({
                    status: 'pending',
                    qrLink: data.payment_link,
                    orderId: data.order_id,
                    expiryTime: Date.now() + (data.expires_in_minutes * 60 * 1000)
                });
                const msg = `🛒 Checkout initiated for ${cartItems.length} item(s). Total: ₹${getCartTotal().toFixed(2)}. Please scan the QR code to pay.`;
                setMessages(prev => [...prev, { role: 'assistant', content: msg, time: new Date().toLocaleTimeString(), isOrderSummary: true }]);
            }
        } catch (e) {
            console.error("Checkout failed:", e);
        }
    };

    // Cart helper functions
    const addToCart = (medicine) => {
        setCartItems(prev => {
            const existing = prev.find(item => item.name.toLowerCase() === medicine.name.toLowerCase());
            if (existing) {
                return prev.map(item =>
                    item.name.toLowerCase() === medicine.name.toLowerCase()
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, {
                name: medicine.name,
                quantity: 1,
                price: parseFloat(medicine.price_per_tablet || medicine.price || 0),
                id: medicine.id
            }];
        });
    };

    const removeFromCart = (medicineName) => {
        setCartItems(prev => prev.filter(item => item.name.toLowerCase() !== medicineName.toLowerCase()));
    };

    const updateCartQty = (medicineName, newQty) => {
        if (newQty <= 0) {
            removeFromCart(medicineName);
            return;
        }
        setCartItems(prev => prev.map(item =>
            item.name.toLowerCase() === medicineName.toLowerCase()
                ? { ...item, quantity: newQty }
                : item
        ));
    };

    const getCartTotal = () => {
        let subtotal = cartItems.reduce((s, item) => s + (item.price * item.quantity), 0);
        if (appliedOffer) {
            if (appliedOffer.type === 'percent') {
                let discount = subtotal * (appliedOffer.discount / 100);
                if (appliedOffer.maxDiscount) discount = Math.min(discount, appliedOffer.maxDiscount);
                subtotal -= discount;
            } else if (appliedOffer.type === 'flat') {
                subtotal -= appliedOffer.discount;
            }
        }
        return Math.max(0, subtotal);
    };

    const getDiscount = () => {
        if (!appliedOffer) return 0;
        const subtotal = cartItems.reduce((s, item) => s + (item.price * item.quantity), 0);
        if (appliedOffer.type === 'percent') {
            let discount = subtotal * (appliedOffer.discount / 100);
            if (appliedOffer.maxDiscount) discount = Math.min(discount, appliedOffer.maxDiscount);
            return discount;
        } else if (appliedOffer.type === 'flat') {
            return appliedOffer.discount;
        }
        return 0;
    };

    const applyOffer = (offer) => {
        const subtotal = cartItems.reduce((s, item) => s + (item.price * item.quantity), 0);
        if (subtotal < offer.minOrder) {
            alert(`Minimum order of ₹${offer.minOrder} required for this offer.`);
            return;
        }
        setAppliedOffer(offer);
        setShowOffersPanel(false);
    };

    // Function to fetch ALL orders
    const fetchAllOrders = async (search = '') => {
        try {
            let url = 'http://localhost:5000/api/orders/all';
            if (search.trim()) {
                url += `?search=${encodeURIComponent(search.trim())}`;
            }
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setCustomerOrders(data);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
    };

    // Derived cart items from sessionState
    useEffect(() => {
        if (sessionState && sessionState.pendingMedicines) {
            const items = Object.keys(sessionState.pendingMedicines).map(key => {
                const qty = sessionState.pendingMedicines[key];
                const medInfo = allMedicines.find(m => m.name.toLowerCase() === key.toLowerCase() || (m.brand && m.brand.toLowerCase() === key.toLowerCase()));
                const price = medInfo ? Number(medInfo.price_per_tablet || medInfo.price || 0) : 10;
                return {
                    name: key,
                    quantity: qty,
                    price: price,
                    id: medInfo?.id
                };
            });
            // Merge session items into cart
            items.forEach(sessionItem => {
                const exists = cartItems.find(ci => ci.name.toLowerCase() === sessionItem.name.toLowerCase());
                if (!exists) {
                    setCartItems(prev => [...prev, sessionItem]);
                }
            });
        }
    }, [sessionState, allMedicines]);

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

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        // Fetch medicines on component mount
        const fetchMeds = async () => {
            try {
                const res = await fetch('http://localhost:5000/api/medicines');
                const data = await res.json();
                setAllMedicines(data);
            } catch (e) {
                console.error("Failed to fetch medicines", e);
            }
        };
        fetchMeds();

        // Check login session
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
            } catch (e) {
                console.error("Session parse error", e);
            }
        }

        // --- Realtime WebSocket Integration ---
        socket.on('stock_updated', (data) => {
            console.log('Real-time stock update received:', data);
            fetchMeds();
        });

        socket.on('order_created', (data) => {
            console.log('Real-time order created:', data);
            fetchAllOrders();
        });

        socket.on('order_paid', (data) => {
            console.log('Order paid:', data);
            setPaymentState(prev => {
                if (prev.orderId === data.order_id) {
                    return { ...prev, status: 'paid' };
                }
                return prev;
            });
            fetchAllOrders();
        });

        socket.on('order_expired', (data) => {
            console.log('Order expired:', data);
            setPaymentState(prev => {
                if (prev.orderId === data.order_id) {
                    return { ...prev, status: 'expired' };
                }
                return prev;
            });
            fetchAllOrders();
        });

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
                content: `👋 Hello **${userName}**! Welcome back. I've loaded your profile.\nHow can I assist you today? Would you like to re-order something from your previous list?`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, greeting]);
        }

        return () => {
            clearInterval(timer);
            socket.off('stock_updated');
            socket.off('order_created');
        };
    }, []);


    // Persist chat history on every change
    useEffect(() => {
        try {
            const payload = {
                messages,
                savedAt: Date.now()
            };
            localStorage.setItem('pharma_ai_chat_v1', JSON.stringify(payload));
        } catch (e) {
            console.error('Failed to persist chat history', e);
        }
    }, [messages]);

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

    const detectLanguageClient = (text) => {
        const str = String(text || '').trim();
        const hasDevanagari = /[\u0900-\u097F]/.test(str);
        const lower = str.toLowerCase();

        if (hasDevanagari) {
            if (lower.includes('आहे') || lower.includes('का')) return 'mr';
            return 'hi';
        }
        if (lower.includes('hai kya') || lower.includes('kya hai') || lower.includes('dawa') || lower.includes('karna hai')) {
            return 'hi';
        }
        if (lower.includes('aahe ka') || lower.includes('ahe ka') || lower.includes('ka na')) {
            return 'mr';
        }
        return 'en';
    };

    const handleInputChange = async (e) => {
        const value = e.target.value;
        setInput(value);

        if (value.length > 2) {
            try {
                const response = await fetch(`http://localhost:5000/api/medicines/search?q=${encodeURIComponent(value)}`);
                if (response.ok) {
                    const medicines = await response.json();
                    setSuggestions(medicines);
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

    const processInput = (rawInput) => {
        let processed = rawInput.trim();
        processed = processed.replace(/\s+/g, ' ');

        let quantity = 1;
        let medicineName = processed;

        const quantityMatch = processed.match(/^(.+?)\s*-\s*(\d+)$/);
        if (quantityMatch) {
            medicineName = quantityMatch[1].trim();
            quantity = parseInt(quantityMatch[2], 10);
        }

        return {
            originalInput: rawInput,
            processedInput: processed,
            medicineName: medicineName,
            quantity: quantity,
            hasQuantity: quantityMatch !== null
        };
    };

    const handleSend = async (overrideInput = null, voiceTrigger = false) => {
        const rawInput = overrideInput || input;
        if (!rawInput.trim()) return;

        const inputAnalysis = processInput(rawInput);
        const textToSearch = inputAnalysis.processedInput;

        const detectedLang = detectLanguageClient(textToSearch);
        setUserLanguage(detectedLang);

        let displayContent = textToSearch;
        if (inputAnalysis.hasQuantity) {
            displayContent = `${inputAnalysis.medicineName} (${inputAnalysis.quantity} tablets)`;
        }

        const userMsg = { role: 'user', content: displayContent, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setSuggestions([]);
        setShowTabletSelector(false);
        setIsTyping(true);

        const currentIsVoice = voiceTrigger || isVoiceInput;

        try {
            const history = messages.map(m => ({ role: m.role, content: m.content }));
            const customerName = user?.username || user?.name || 'Guest';
            const response = await fetch('http://localhost:5000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: textToSearch,
                    history,
                    medicineName: inputAnalysis.medicineName,
                    quantity: inputAnalysis.quantity,
                    hasQuantity: inputAnalysis.hasQuantity,
                    customer_name: customerName
                })
            });

            let data;
            try {
                data = await response.json();
            } catch (parseErr) {
                console.error('Failed to parse chat response JSON:', parseErr);
                throw new Error('Invalid response from backend');
            }

            if (!response.ok) {
                const errorText = data.reply || '❌ Backend error while processing your request.';
                const errorMsg = {
                    role: 'assistant',
                    content: errorText,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isError: true
                };
                setMessages(prev => [...prev, errorMsg]);
                return;
            }

            const botMsg = {
                role: 'assistant',
                content: data.reply,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                sessionState: data.sessionState,
                orderPlaced: data.orderPlaced || false,
                orderData: data.orderData || null,
                isOrderSummary: data.reply?.includes('**Order Summary**') || data.reply?.includes('**Order Placed Successfully')
            };
            setMessages(prev => [...prev, botMsg]);
            setSessionState(data.sessionState);
            setDecisionMetadata({
                intent_verified: data.intent_verified,
                safety_checked: data.safety_checked,
                stock_checked: data.stock_checked,
                thinking: data.thinking || "Decision pipeline executed successfully."
            });

            if (currentIsVoice) {
                speakResponse(data.reply, detectedLang || userLanguage);
                setIsVoiceInput(false);
            }

            if (chatMessagesRef.current) {
                chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
            }
            setTimeout(() => {
                if (chatMessagesRef.current) {
                    chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
                }
            }, 100);

            setTimeout(() => {
                const inputField = document.querySelector('.chat-input-field');
                if (inputField) inputField.focus();
            }, 150);

            refreshMedicines();

        } catch (error) {
            console.error("AI Chat Error:", error);

            let errorContent = '❌ Network error while talking to the assistant. Please check your connection and try again.';
            if (error.message.includes('Failed to fetch')) {
                errorContent = '❌ Cannot connect to the backend server. Please make sure the backend is running on port 5000.';
            } else if (error.message.includes('CORS')) {
                errorContent = '❌ CORS error. Please check backend configuration.';
            } else if (error.message) {
                errorContent = `❌ Error: ${error.message}`;
            }

            const errorMsg = {
                role: 'assistant',
                content: errorContent,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isError: true
            };
            setMessages(prev => [...prev, errorMsg]);

            setTimeout(() => {
                const inputField = document.querySelector('.chat-input-field');
                if (inputField) inputField.focus();
            }, 150);
        } finally {
            setIsTyping(false);
        }
    };

    const startVoiceInput = () => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsTyping(false);

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

    const speakResponse = (text, langCode = 'en') => {
        const synth = window.speechSynthesis;
        synth.cancel();
        setIsSpeaking(true);

        const cleanText = text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\([^)]*\)/g, '')
            .replace(/\[[^\]]*\]/g, '')
            .replace(/[🎉✅❌⚠️⚕️💊💰📦📝🧾🛒🚚👤🛡️🔄👋🎙️👉🎯🚀]/g, '')
            .replace(/[★☆♦♥♠♣•\/\\.,;:@#$%^&*_=+|~`<>{}₹—–→←]/g, ' ')
            .replace(/^\s*\d+\.\s*/gm, '')
            .replace(/^\s*[•\-\*]\s*/gm, '')
            .replace(/\s+/g, ' ')
            .trim();

        const utter = new SpeechSynthesisUtterance(cleanText);

        if (langCode === 'hi') {
            utter.lang = 'hi-IN';
        } else if (langCode === 'mr') {
            utter.lang = 'mr-IN';
        } else {
            utter.lang = 'en-IN';
        }

        const voices = synth.getVoices();
        let selectedVoice = voices.find(voice => voice.name.toLowerCase().includes('zira'));
        if (!selectedVoice) {
            if (langCode === 'hi') {
                selectedVoice = voices.find(voice => voice.lang.includes('hi'));
            } else if (langCode === 'mr') {
                selectedVoice = voices.find(voice => voice.lang.includes('mr'));
            } else {
                selectedVoice = voices.find(voice => voice.name.includes('Female') || voice.name.includes('Samantha')) || voices.find(voice => voice.lang.includes('en'));
            }
        }
        if (selectedVoice) utter.voice = selectedVoice;

        utter.rate = 1.15;
        utter.pitch = 1.0;
        utter.volume = 0.9;

        utter.onend = () => setIsSpeaking(false);
        utter.onerror = () => setIsSpeaking(false);

        synth.speak(utter);
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
        if (isListening) stopVoiceInput();
        else startVoiceInput();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const renderMessageContent = (text, msg = null) => {
        return text.split('\n').map((line, i) => {
            if (line.trim() === '[Restock Medicine]') {
                return (
                    <button
                        key={i}
                        className="restock-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSend('Restock Medicine');
                        }}
                    >
                        🔄 Restock Medicine
                    </button>
                );
            }
            const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            return (
                <p key={i} className="message-text"
                    dangerouslySetInnerHTML={{ __html: formatted || '&nbsp;' }} />
            );
        });
    };

    // Add missing state variables
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [chatSessions, setChatSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState('chat-' + Date.now());
    const [latestOrders, setLatestOrders] = useState([]);

    const createNewChat = () => {
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

    const switchToSession = (sessionId) => {
        setCurrentSessionId(sessionId);
    };

    const deleteSession = (sessionId, e) => {
        e.stopPropagation();
    };

    return (
        <div className="enhanced-chat-container">
            {/* Sidebar */}
            <div className={`chat-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <button className="new-chat-btn" onClick={createNewChat}>
                        <Plus size={18} />
                        {sidebarOpen && <span>New Chat</span>}
                    </button>
                    <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        <MessageSquare size={18} />
                    </button>
                </div>

                {sidebarOpen && (
                    <div className="chat-sessions">
                        {chatSessions.map(session => (
                            <div
                                key={session.id}
                                className={`chat-session ${session.id === currentSessionId ? 'active' : ''}`}
                                onClick={() => switchToSession(session.id)}
                            >
                                <span className="session-title">{session.title}</span>
                                <div className="session-actions">
                                    <button onClick={(e) => deleteSession(session.id, e)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Main Chat Area */}
            <div className="chat-main-wrapper">
                {/* Top Header */}
                <header className="pharmacy-header">
                    <div className="pharmacy-info">
                        <div className="pharmacy-name">
                            <Pill size={24} />
                            <h1>MediCare Pharmacy</h1>
                        </div>
                        <div className="datetime-info">
                            <span className="date">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            <span className="time">{new Date().toLocaleTimeString()}</span>
                        </div>
                    </div>

                    <div className="user-info">
                        <div className="user-details">
                            <span className="user-name">{user?.username || user?.name || 'Guest User'}</span>
                            <span className="user-email">{user?.email || 'guest@example.com'}</span>
                        </div>
                        <div className="user-avatar">
                            {(user?.username || user?.name)?.charAt(0)?.toUpperCase() || 'G'}
                        </div>
                    </div>
                </header>

                <div className="chat-content-area">
                    {/* Chat Messages */}
                    <div className="messages-area" ref={chatMessagesRef}>
                        {messages.map((msg, i) => (
                            <div key={i} className={`message ${msg.role} ${msg.isError ? 'error' : ''} ${msg.isOrderSummary ? 'order-summary-msg' : ''} ${msg.orderPlaced ? 'order-success-msg' : ''}`}>
                                {msg.isOrderSummary && (
                                    <div className="order-summary-header">
                                        <Receipt size={16} />
                                        <span>Order Summary</span>
                                    </div>
                                )}
                                {msg.orderPlaced && (
                                    <div className="order-success-header">
                                        <CheckCircle size={16} />
                                        <span>Order Confirmed</span>
                                    </div>
                                )}
                                <div className="message-content">
                                    {renderMessageContent(msg.content, msg)}
                                </div>
                                {/* QR code for placed orders */}
                                {msg.orderPlaced && msg.orderData && (
                                    <div className="chat-qr-section">
                                        <div className="qr-animation-wrapper">
                                            <div className="qr-glow"></div>
                                            <QRCode value={msg.orderData.paymentLink} size={140} />
                                        </div>
                                        <p className="qr-label">Scan to Pay ₹{msg.orderData.total?.toFixed(2)}</p>
                                        <div className="order-placed-badge">
                                            <CheckCircle size={20} />
                                            <span>Order Placed Successfully!</span>
                                        </div>
                                    </div>
                                )}
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

                    {/* Right Sidebar */}
                    <div className="right-sidebar">
                        <div className="sidebar-section">
                            <h3>Quick Actions</h3>
                            <div className="action-buttons">
                                <button className="action-btn prev-orders" onClick={() => { setShowOrdersPanel(true); fetchAllOrders(); }}>
                                    <Receipt size={16} />
                                    Previous Orders
                                </button>
                                <button className="action-btn checkout" onClick={() => setShowCartDrawer(true)}>
                                    <ShoppingCart size={16} />
                                    Checkout {cartItems.length > 0 && <span className="cart-badge">{cartItems.length}</span>}
                                </button>
                                <button className="action-btn offers" onClick={() => setShowOffersPanel(true)}>
                                    <Gift size={16} />
                                    Offers
                                </button>
                            </div>
                        </div>

                        {cartItems.length > 0 && (
                            <div className="sidebar-section cart-summary">
                                <h3>Current Cart</h3>
                                <div className="cart-items">
                                    {cartItems.map((item, idx) => (
                                        <div key={idx} className="cart-item">
                                            <span className="item-name">{item.name}</span>
                                            <span className="item-qty">x{item.quantity}</span>
                                            <span className="item-price">₹{(item.price * item.quantity).toFixed(0)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="cart-total">
                                    <strong>Total: ₹{getCartTotal().toFixed(2)}</strong>
                                    {appliedOffer && <span className="applied-offer-badge">🏷️ {appliedOffer.code}</span>}
                                </div>
                            </div>
                        )}

                        <div className="sidebar-section">
                            <h3>Previous Orders</h3>
                            <div className="recent-orders">
                                {latestOrders.slice(0, 3).map(order => (
                                    <div key={order.id} className="order-item">
                                        <div className="order-info">
                                            <span className="order-id">#{order.id}</span>
                                            <span className="order-status">{order.status}</span>
                                        </div>
                                        <span className="order-total">₹{order.total_price}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
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
                            onChange={handleInputChange}
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

                    {/* Medicine Suggestions */}
                    {suggestions.length > 0 && (
                        <div className="medicine-suggestions">
                            {suggestions.map((med, idx) => (
                                <div key={idx} className="suggestion-item">
                                    <div className="med-info" onClick={() => handleTabletSelect(med.name, 1)}>
                                        <span className="med-name">{med.name}</span>
                                        <span className="med-price">₹{med.price_per_tablet}/tablet</span>
                                    </div>
                                    <button className="add-to-cart-btn" onClick={(e) => { e.stopPropagation(); addToCart(med); }} title="Add to Cart">
                                        <ShoppingCart size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* === Modals & Drawers === */}

            {/* Previous Orders Modal */}
            {showOrdersPanel && (
                <div className="modal-overlay" onClick={() => setShowOrdersPanel(false)}>
                    <div className="modal-container quick-action-modal orders-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Receipt size={20} style={{ verticalAlign: 'text-bottom', marginRight: '8px' }} /> Previous Orders</h3>
                            <button className="modal-close-btn" onClick={() => setShowOrdersPanel(false)}><X size={20} /></button>
                        </div>
                        <div className="orders-search-bar">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search by customer name..."
                                value={orderSearchQuery}
                                onChange={(e) => {
                                    setOrderSearchQuery(e.target.value);
                                    fetchAllOrders(e.target.value);
                                }}
                            />
                        </div>
                        <div className="modal-content">
                            {customerOrders.length === 0 ? (
                                <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>No orders found.</p>
                            ) : (
                                <div className="orders-table-wrapper">
                                    <table className="orders-table">
                                        <thead>
                                            <tr>
                                                <th>Order ID</th>
                                                <th>Customer</th>
                                                <th>Medicine</th>
                                                <th>Qty</th>
                                                <th>Price</th>
                                                <th>Date</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {customerOrders.map((ord, idx) => (
                                                <React.Fragment key={idx}>
                                                    {ord.items && ord.items.length > 0 ? ord.items.map((item, itemIdx) => (
                                                        <tr key={`${idx}-${itemIdx}`} className={itemIdx === 0 ? 'order-first-row' : 'order-sub-row'}>
                                                            {itemIdx === 0 && (
                                                                <>
                                                                    <td rowSpan={ord.items.length} className="order-id-cell">{ord.orderId}</td>
                                                                    <td rowSpan={ord.items.length}>{ord.customerName}</td>
                                                                </>
                                                            )}
                                                            <td>{item.name} <span className="item-qty-badge">x{item.quantity}</span></td>
                                                            <td>{item.quantity}</td>
                                                            <td className="price-cell">₹{(item.price * item.quantity).toFixed(2)}</td>
                                                            {itemIdx === 0 && (
                                                                <>
                                                                    <td rowSpan={ord.items.length}>{ord.date ? new Date(ord.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: '2-digit' }) : 'Recent'}</td>
                                                                    <td rowSpan={ord.items.length}>
                                                                        <span className={`status-badge ${(ord.status || 'completed').toLowerCase()}`}>
                                                                            {(ord.status || 'completed').toUpperCase()}
                                                                        </span>
                                                                    </td>
                                                                </>
                                                            )}
                                                        </tr>
                                                    )) : (
                                                        <tr key={idx}>
                                                            <td>{ord.orderId}</td>
                                                            <td>{ord.customerName}</td>
                                                            <td colSpan={2}>No items</td>
                                                            <td className="price-cell">₹{(ord.grandTotal || 0).toFixed(2)}</td>
                                                            <td>{ord.date ? new Date(ord.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: '2-digit' }) : 'Recent'}</td>
                                                            <td>
                                                                <span className={`status-badge ${(ord.status || 'completed').toLowerCase()}`}>
                                                                    {(ord.status || 'completed').toUpperCase()}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Cart Drawer */}
            {showCartDrawer && (
                <div className="modal-overlay" onClick={() => setShowCartDrawer(false)}>
                    <div className="drawer-container slide-in-right" onClick={e => e.stopPropagation()}>
                        <div className="drawer-header">
                            <h3><ShoppingCart size={20} style={{ verticalAlign: 'text-bottom', marginRight: '8px' }} /> Your Cart</h3>
                            <button className="modal-close-btn" onClick={() => setShowCartDrawer(false)}><X size={20} /></button>
                        </div>
                        <div className="drawer-content">
                            {cartItems.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '40px' }}>
                                    <ShoppingCart size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                                    <p>Your cart is empty.</p>
                                    <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>Type a medicine name in chat or use search to add items.</p>
                                </div>
                            ) : (
                                <div className="cart-items-list">
                                    {cartItems.map((item, idx) => (
                                        <div key={idx} className="cart-item-row">
                                            <div className="ci-info">
                                                <h4>{item.name}</h4>
                                                <p>₹{item.price?.toFixed(2)}/tablet</p>
                                            </div>
                                            <div className="ci-controls">
                                                <button onClick={() => updateCartQty(item.name, item.quantity - 1)}>−</button>
                                                <span>{item.quantity}</span>
                                                <button onClick={() => updateCartQty(item.name, item.quantity + 1)}>+</button>
                                            </div>
                                            <div className="ci-price">
                                                <strong>₹{(item.price * item.quantity).toFixed(2)}</strong>
                                            </div>
                                            <button className="ci-remove" onClick={() => removeFromCart(item.name)}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}

                                    <div className="cart-summary-section">
                                        <div className="cs-row">
                                            <span>Subtotal</span>
                                            <span>₹{cartItems.reduce((s, item) => s + (item.price * item.quantity), 0).toFixed(2)}</span>
                                        </div>
                                        {appliedOffer && (
                                            <div className="cs-row text-green">
                                                <span>Discount ({appliedOffer.code})</span>
                                                <span>-₹{getDiscount().toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="cs-row cs-total">
                                            <span>Total Amount</span>
                                            <span>₹{getCartTotal().toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {!appliedOffer && (
                                        <button className="apply-offer-btn" onClick={() => { setShowCartDrawer(false); setShowOffersPanel(true); }}>
                                            🏷️ Apply Offer Code
                                        </button>
                                    )}

                                    {paymentState.status === null && (
                                        <button className="checkout-pay-btn" onClick={handleCheckout}>
                                            💳 Generate Payment QR
                                        </button>
                                    )}

                                    {paymentState.status === 'pending' && (
                                        <div className="qr-payment-card-drawer">
                                            <h4>Scan to Pay</h4>
                                            <div className="qr-wrapper-animated">
                                                <div className="qr-pulse-ring"></div>
                                                <QRCode value={paymentState.qrLink} size={150} />
                                            </div>
                                            <p className="qr-amount">₹{getCartTotal().toFixed(2)}</p>
                                            <p className="qr-expiry">
                                                Expires in: <span className="countdown">{Math.max(0, Math.floor((paymentState.expiryTime - Date.now()) / 1000))}s</span>
                                            </p>
                                        </div>
                                    )}

                                    {paymentState.status === 'paid' && (
                                        <div className="payment-success-card-drawer">
                                            <div className="success-checkmark">
                                                <CheckCircle size={48} />
                                            </div>
                                            <h4>Payment Successful!</h4>
                                            <p>Order #{paymentState.orderId} has been placed.</p>
                                        </div>
                                    )}

                                    {paymentState.status === 'expired' && (
                                        <div className="payment-expired-card-drawer">
                                            <h4>Payment Expired</h4>
                                            <p>The QR code has timed out.</p>
                                            <button onClick={() => setPaymentState({ status: null, qrLink: '', orderId: '', expiryTime: null })}>
                                                Retry Payment
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Offers Panel */}
            {showOffersPanel && (
                <div className="modal-overlay" onClick={() => setShowOffersPanel(false)}>
                    <div className="modal-container quick-action-modal offers-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Gift size={20} style={{ verticalAlign: 'text-bottom', marginRight: '8px', color: '#8b5cf6' }} /> Special Offers</h3>
                            <button className="modal-close-btn" onClick={() => setShowOffersPanel(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-content offers-content">
                            <div className="offers-grid">
                                {offersData.map((offer, idx) => (
                                    <div key={idx} className={`offer-card ${appliedOffer?.code === offer.code ? 'applied' : ''}`}>
                                        <div className="offer-badge">{offer.code}</div>
                                        <p className="offer-desc">{offer.desc}</p>
                                        {offer.minOrder > 0 && <p className="offer-min">Min order: ₹{offer.minOrder}</p>}
                                        {appliedOffer?.code === offer.code ? (
                                            <button className="offer-applied-btn" onClick={() => setAppliedOffer(null)}>✓ Applied (Remove)</button>
                                        ) : (
                                            <button className="apply-offer-card-btn" onClick={() => applyOffer(offer)}>Apply Offer</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default AIChat;
