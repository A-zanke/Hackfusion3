import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send, Mic, Pill, Settings, Sparkles, Receipt, ShoppingCart, Gift, X, Plus, MessageSquare, Trash2, Edit3, Check } from 'lucide-react';
import '../App.css';
import '../components/EnhancedChat.css';
import { Link } from "react-router-dom";
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import QRCode from 'react-qr-code';

const socket = io('http://localhost:5000');

const AIChat = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([{
        role: 'assistant',
        content: `👋 Hello! I'm **PharmaAI**, your intelligent pharmacy assistant.
I help only with medicine ordering, refills, or pharmacy-related questions.

🎙 You can also use **voice input** — just click the mic button!
How can I assist you today?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    const [isTyping, setIsTyping] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [isVoiceInput, setIsVoiceInput] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [userLanguage, setUserLanguage] = useState('en');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [chatSessions, setChatSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState('chat-' + Date.now());
    const [latestOrders, setLatestOrders] = useState([]);
    const [cartData, setCartData] = useState({ items: [], total: 0 });
    const [paymentState, setPaymentState] = useState({
        status: null,
        qrLink: '',
        orderId: '',
        expiryTime: null
    });
    const [allMedicines, setAllMedicines] = useState([]);
    const [showOrdersModal, setShowOrdersModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showOrderDetails, setShowOrderDetails] = useState(false);
    const [selectedMedicines, setSelectedMedicines] = useState([]);
    const [currentOrder, setCurrentOrder] = useState([]);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [rightPanelOpen, setRightPanelOpen] = useState(true);
    const chatMessagesRef = useRef(null);

    const handleLogout = () => {
        if (logout) logout();
        navigate('/login');
    };

    // Fetch medicines on component mount
    useEffect(() => {
        fetchMedicines();
        loadChatSessions();
        fetchUserOrders();
    }, [user]);

    const fetchMedicines = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/medicines');
            if (response.ok) {
                const medicines = await response.json();
                setAllMedicines(medicines);
            }
        } catch (error) {
            console.error('Failed to fetch medicines:', error);
        }
    };

    // Load chat sessions from localStorage and database
    const loadChatSessions = async () => {
        try {
            // Load from localStorage first
            const localSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');

            // Load from database if user is logged in
            if (user) {
                const response = await fetch(`http://localhost:5000/api/chat/sessions/${user.id}`);
                if (response.ok) {
                    const dbSessions = await response.json();
                    // Merge local and database sessions
                    const mergedSessions = mergeChatSessions(localSessions, dbSessions);
                    setChatSessions(mergedSessions);
                    localStorage.setItem('chatSessions', JSON.stringify(mergedSessions));
                } else {
                    setChatSessions(localSessions);
                }
            } else {
                setChatSessions(localSessions);
            }
        } catch (error) {
            console.error('Failed to load chat sessions:', error);
            const fallbackSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
            setChatSessions(fallbackSessions);
        }
    };

    // Fetch user orders from database
    const fetchUserOrders = async () => {
        try {
            if (user) {
                const response = await fetch(`http://localhost:5000/api/orders/user/${user.id}`);
                if (response.ok) {
                    const orders = await response.json();
                    setLatestOrders(orders);
                }
            }
        } catch (error) {
            console.error('Failed to fetch user orders:', error);
        }
    };

    // Merge local and database chat sessions
    const mergeChatSessions = (localSessions, dbSessions) => {
        const sessionMap = new Map();

        // Add database sessions first
        dbSessions.forEach(session => {
            sessionMap.set(session.id, session);
        });

        // Add or update with local sessions (local takes precedence)
        localSessions.forEach(session => {
            sessionMap.set(session.id, session);
        });

        return Array.from(sessionMap.values()).sort((a, b) =>
            new Date(b.updatedAt) - new Date(a.updatedAt)
        );
    };

    // Save chat session to localStorage and database
    const saveChatSession = async (sessionId, title, messages) => {
        const sessionData = {
            id: sessionId,
            title: title || 'New Chat',
            messages: messages,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: user?.id
        };

        try {
            // Save to localStorage immediately
            const existingSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
            const updatedSessions = existingSessions.filter(s => s.id !== sessionId);
            updatedSessions.push(sessionData);
            updatedSessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            setChatSessions(updatedSessions);
            localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));

            // Save to database if user is logged in
            if (user) {
                await fetch('http://localhost:5000/api/chat/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sessionData)
                });
            }
        } catch (error) {
            console.error('Failed to save chat session:', error);
        }
    };

    // Auto-save current session when messages change
    useEffect(() => {
        if (messages.length > 1 && currentSessionId) {
            const title = messages[1]?.content?.substring(0, 50) + '...' || 'New Chat';
            saveChatSession(currentSessionId, title, messages);
        }
    }, [messages, currentSessionId]);

    // Handle input change with medicine suggestions
    const handleInputChange = async (e) => {
        const value = e.target.value;
        setInput(value);

        // Search medicines when typing (more than 2 characters)
        if (value.length > 2) {
            try {
                const response = await fetch(`http://localhost:5000/api/medicines/search?q=${encodeURIComponent(value)}`);
                if (response.ok) {
                    const medicines = await response.json();
                    setSuggestions(medicines.slice(0, 5)); // Limit to 5 suggestions
                } else {
                    setSuggestions([]);
                }
            } catch (error) {
                console.error('Medicine search error:', error);
                setSuggestions([]);
            }
        } else {
            setSuggestions([]);
        }
    };

    const createNewChat = () => {
        // Save current session if it has messages
        if (messages.length > 1) {
            const title = messages[1]?.content?.substring(0, 50) + '...' || 'New Chat';
            saveChatSession(currentSessionId, title, messages);
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

    const switchToSession = async (sessionId) => {
        // Save current session before switching
        if (messages.length > 1 && currentSessionId !== sessionId) {
            const title = messages[1]?.content?.substring(0, 50) + '...' || 'New Chat';
            await saveChatSession(currentSessionId, title, messages);
        }

        // Load the selected session
        const session = chatSessions.find(s => s.id === sessionId);
        if (session) {
            setCurrentSessionId(sessionId);
            setMessages(session.messages || [{
                role: 'assistant',
                content: `👋 Hello! I'm **PharmaAI**, your intelligent pharmacy assistant.
I help only with medicine ordering, refills, or pharmacy-related questions.

🎙 You can also use **voice input** — just click the mic button!
How can I assist you today?`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
            setInput('');
            setSuggestions([]);
        }
    };

    const deleteSession = async (sessionId, e) => {
        e.stopPropagation();

        try {
            // Remove from localStorage
            const updatedSessions = chatSessions.filter(s => s.id !== sessionId);
            setChatSessions(updatedSessions);
            localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));

            // Remove from database if user is logged in
            if (user) {
                await fetch(`http://localhost:5000/api/chat/sessions/${sessionId}`, {
                    method: 'DELETE'
                });
            }
            // If deleting current session, create new chat
            if (sessionId === currentSessionId) {
                createNewChat();
            }
        } catch (error) {
            console.error('Failed to delete session:', error);
        }
    };

    // Enhanced medicine matching logic
    const findMatchingMedicines = (query) => {
        if (!query || query.length < 3) return [];

        const searchTerm = query.toLowerCase();
        const matches = [];

        allMedicines.forEach(med => {
            const name = med.name.toLowerCase();
            const brand = med.brand ? med.brand.toLowerCase() : '';
            const description = med.description ? med.description.toLowerCase() : '';

            // Exact name match
            if (name.includes(searchTerm)) {
                matches.push({ ...med, matchType: 'exact', score: 100 });
            }
            // Brand match
            else if (brand.includes(searchTerm)) {
                matches.push({ ...med, matchType: 'brand', score: 80 });
            }
            // Description match
            else if (description.includes(searchTerm)) {
                matches.push({ ...med, matchType: 'description', score: 60 });
            }
            // Partial name match
            else if (searchTerm.split(' ').some(word => name.includes(word))) {
                matches.push({ ...med, matchType: 'partial', score: 40 });
            }
        });

        return matches
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    };

    // Process user message for medicine requests
    const processMedicineRequest = (message) => {
        const lowerMessage = message.toLowerCase();

        // Check if user is asking about medicine availability
        if (lowerMessage.includes('do you have') || lowerMessage.includes('have') || lowerMessage.includes('available')) {
            const medicineName = extractMedicineName(message);
            if (medicineName) {
                const matches = findMatchingMedicines(medicineName);
                if (matches.length > 0) {
                    return {
                        type: 'medicine_found',
                        medicines: matches,
                        question: `🎉 Yay! I found some amazing options for **${medicineName}**! Which one would you like?\n\n${matches.map((med, idx) =>
                            `${idx + 1}. **${med.name}** - ₹${med.price_per_tablet}/tablet (${med.total_tablets || med.stock_packets * med.tablets_per_packet} in stock)`
                        ).join('\n')}`
                    };
                }
            }
        }

        return null;
    };

    const extractMedicineName = (message) => {
        const words = message.toLowerCase().split(' ');
        const medicineWords = allMedicines.flatMap(med => med.name.toLowerCase().split(' '));

        for (let word of words) {
            if (medicineWords.includes(word) && word.length > 2) {
                return word;
            }
        }

        return null;
    };

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
        setIsTyping(true);

        // Check for medicine requests first
        const medicineResponse = processMedicineRequest(textToSend);
        if (medicineResponse) {
            setTimeout(() => {
                const botMsg = {
                    role: 'assistant',
                    content: medicineResponse.question,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                setMessages(prev => [...prev, botMsg]);
                setIsTyping(false);

                if (voiceTrigger) {
                    speakResponse(medicineResponse.question);
                }
            }, 1000);
            return;
        }

        // Check for quantity requests
        if (selectedMedicines.length > 0 && /\d+/.test(textToSend)) {
            const quantity = parseInt(textToSend.match(/\d+/)[0]);
            const lastMedicine = selectedMedicines[selectedMedicines.length - 1];

            if (lastMedicine && !lastMedicine.quantity) {
                lastMedicine.quantity = quantity;

                const orderSummary = generateOrderSummary();
                const botMsg = {
                    role: 'assistant',
                    content: `🎉 Perfect! I've added **${lastMedicine.name}** (${quantity} tablets) to your order!\n\n${orderSummary}\n\nWould you like to add more medicines? (Y/N)`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                setMessages(prev => [...prev, botMsg]);
                setIsTyping(false);

                if (voiceTrigger) {
                    speakResponse(botMsg.content);
                }
                return;
            }
        }

        // Check for Y/N responses
        if (currentOrder.length > 0 && (textToSend.toLowerCase() === 'y' || textToSend.toLowerCase() === 'yes')) {
            const botMsg = {
                role: 'assistant',
                content: `🎉 Awesome! Adding more medicines to your order! What else would you like to add?`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            setMessages(prev => [...prev, botMsg]);
            setIsTyping(false);

            if (voiceTrigger) {
                speakResponse(botMsg.content);
            }
            return;
        }

        if (currentOrder.length > 0 && (textToSend.toLowerCase() === 'n' || textToSend.toLowerCase() === 'no')) {
            const finalSummary = generateOrderSummary();
            const botMsg = {
                role: 'assistant',
                content: `🚀 Perfect! Here's your final order:\n\n${finalSummary}\n\n🎯 Ready to proceed! Type **"proceed"** to place your order!`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            setMessages(prev => [...prev, botMsg]);
            setIsTyping(false);

            if (voiceTrigger) {
                speakResponse(botMsg.content);
            }
            return;
        }

        // Check for proceed command
        if (currentOrder.length > 0 && textToSend.toLowerCase() === 'proceed') {
            await placeOrder();
            return;
        }

        // Check for medicine selection
        const medicineSelection = extractMedicineSelection(textToSend);
        if (medicineSelection && medicineSelection.medicine) {
            const botMsg = {
                role: 'assistant',
                content: `🎯 Great choice! **${medicineSelection.medicine.name}** it is! How many tablets would you like?`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            selectedMedicines.push(medicineSelection.medicine);
            setIsTyping(false);

            if (voiceTrigger) {
                speakResponse(botMsg.content);
            }
            return;
        }

        // Default AI response
        try {
            const response = await fetch('http://localhost:5000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: textToSend,
                    sessionId: currentSessionId,
                    userId: user?.id
                })
            });

            const data = await response.json();
            setIsTyping(false);

            if (response.ok && data.reply !== undefined) {
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
                    content: data.reply || '⚠️ Oops! Something went wrong. Please try again.',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isError: true
                };
                setMessages(prev => [...prev, errorMsg]);
            }
        } catch (error) {
            setIsTyping(false);
            const errorMsg = {
                role: 'assistant',
                content: '⚠️ Connection error! Please check your internet and try again.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, errorMsg]);
        }
    };
    const extractMedicineSelection = (message) => {
        const words = message.toLowerCase().split(' ');
        const numberWords = ['1', '2', '3', '4', '5', 'one', 'two', 'three', 'four', 'five'];

        for (let word of words) {
            if (numberWords.includes(word)) {
                const index = parseInt(word) || (numberWords.indexOf(word) + 1);
                if (index > 0 && index <= selectedMedicines.length + 1) {
                    return { medicine: selectedMedicines[index - 1] || null };
                }
            }
        }

        return null;
    };

    const generateOrderSummary = () => {
        if (selectedMedicines.length === 0) return 'Your order is empty.';

        const summary = selectedMedicines.map(med =>
            `• **${med.name}** - ${med.quantity || '??'} tablets`
        ).join('\n');

        return `📋 **Current Order:**\n${summary}`;
    };

    const placeOrder = async () => {
        const validMedicines = selectedMedicines.filter(med => med.quantity);

        if (validMedicines.length === 0) {
            const errorMsg = {
                role: 'assistant',
                content: '⚠️ Please add quantities for all medicines before proceeding!',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, errorMsg]);
            return;
        }

        try {
            const orderData = {
                medicines: validMedicines,
                total: validMedicines.reduce((sum, med) => sum + (med.price_per_tablet * med.quantity), 0),
                userId: user?.id
            };

            const response = await fetch('http://localhost:5000/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });

            if (response.ok) {
                const order = await response.json();
                const successMsg = {
                    role: 'assistant',
                    content: `🎉 **Order placed successfully!**\n\n📦 Order ID: #${order.id}\n🚀 Your order will be delivered soon!\n\nThank you for shopping with us! 💊`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                setMessages(prev => [...prev, successMsg]);
                setCurrentOrder([]);
                setSelectedMedicines([]);

                // Update cart data
                setCartData({ items: [], total: 0 });

                speakResponse(successMsg.content);
            } else {
                throw new Error('Order failed');
            }
        } catch (error) {
            const errorMsg = {
                role: 'assistant',
                content: '⚠️ Failed to place order. Please try again.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, errorMsg]);
        }

        setIsTyping(false);
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

    const startVoiceInput = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = userLanguage === 'hi' ? 'hi-IN' : 'en-US';

            recognition.onstart = () => {
                setIsListening(true);
                setIsVoiceInput(true);
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                setIsListening(false);
                setIsVoiceInput(false);

                // Auto-send after voice input
                setTimeout(() => {
                    handleSend(transcript, true);
                }, 500);
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
                setIsVoiceInput(false);
            };

            recognition.onend = () => {
                setIsListening(false);
                setIsVoiceInput(false);
            };

            recognition.start();
        } else {
            alert('Speech recognition is not supported in your browser. Please try Chrome or Edge.');
        }
    };

    const speakResponse = (text, language = 'en') => {
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            // Filter out technical content and keep only main content
            let filteredText = text
                // Remove markdown bold markers but keep content
                .replace(/\*\*(.*?)\*\*/g, '$1')
                // Remove content in parentheses like (757 in stock)
                .replace(/\([^)]*\)/g, '')
                // Remove content in brackets
                .replace(/\[[^\]]*\]/g, '')
                // Remove emojis
                .replace(/❌|✅|⚕️|📊|🤖|🔍|💊|💰|🎉|⚠️|📝|📦|🛒|🧾|🚚|👤|🛡️|🔄|👋|🎙️|👉|🎯|🚀/g, '')
                // Remove special characters that should not be spoken
                .replace(/[\/\\.,;:@#$%^&*_=+|~`<>{}\u20b9\u2014\u2013\u2022\u2192\u2190]/g, ' ')
                // Remove bullet points
                .replace(/^\s*[\u2022\-\*]\s*/gm, '')
                // Remove numbered lists
                .replace(/^\s*\d+\.\s*/gm, '')
                // Remove thinking/agent metadata
                .replace(/thinking\s*:\s*[^.\n]*/gi, '')
                .replace(/intent\s*verified\s*:\s*[^.\n]*/gi, '')
                .replace(/safety\s*checked\s*:\s*[^.\n]*/gi, '')
                .replace(/stock\s*checked\s*:\s*[^.\n]*/gi, '')
                // Normalize spaces
                .replace(/\s+/g, ' ')
                .trim();

            // Only speak if there's meaningful content
            if (!filteredText || filteredText.length < 3) {
                return;
            }

            // Get available voices and select only female voices
            const voices = window.speechSynthesis.getVoices();
            let femaleVoice = null;

            // Try to find Zira first, then any female voice
            femaleVoice = voices.find(voice =>
                voice.name.includes('Zira') ||
                voice.name.includes('Female') ||
                voice.name.includes('Woman') ||
                voice.name.includes('girl')
            );

            // If no specifically female voice found, try common female voice names
            if (!femaleVoice) {
                const commonFemaleVoices = [
                    'Microsoft Zira Desktop',
                    'Google US English Female',
                    'Microsoft Hazel Desktop',
                    'Samantha',
                    'Karen',
                    'Tessa',
                    'Moira',
                    'Veena'
                ];

                for (const femaleVoiceName of commonFemaleVoices) {
                    femaleVoice = voices.find(voice => voice.name.includes(femaleVoiceName));
                    if (femaleVoice) break;
                }
            }

            // Fallback to any voice that doesn't sound male
            if (!femaleVoice) {
                femaleVoice = voices.find(voice =>
                    !voice.name.includes('Male') &&
                    !voice.name.includes('David') &&
                    !voice.name.includes('Mark') &&
                    !voice.name.includes('James')
                ) || voices[0]; // Ultimate fallback
            }

            const utterance = new SpeechSynthesisUtterance(filteredText);
            utterance.voice = femaleVoice;
            utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
            utterance.rate = 0.9;
            utterance.pitch = 1.1; // Slightly higher pitch for more feminine sound
            utterance.volume = 0.9;

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);

            window.speechSynthesis.speak(utterance);
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

    const handleTabletSelect = (medicineName, count = 1) => {
        setInput(`${medicineName} ${count} tablets`);
        setSuggestions([]);
    };

    const handleSuggestionClick = (medicine) => {
        setInput(medicine.name);
        setSuggestions([]);
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

    const handleCheckout = async () => {
        if (cartData.items.length === 0) return;
        // Implementation for checkout
        console.log('Checkout clicked');
    };

    const handleViewOrders = async () => {
        await fetchUserOrders();
        setShowOrdersModal(true);
    };

    const handleOrderClick = (order) => {
        setSelectedOrder(order);
        setShowOrderDetails(true);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDateShort = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: '2-digit'
        });
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'delivered': return '#48bb78';
            case 'processing': return '#ed8936';
            case 'pending': return '#4299e1';
            case 'cancelled': return '#f56565';
            default: return '#718096';
        }
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
                        {chatSessions.length === 0 ? (
                            <div className="no-sessions">
                                <p>No chat history yet</p>
                                <small>Start a conversation to see it here</small>
                            </div>
                        ) : (
                            chatSessions.map(session => (
                                <div
                                    key={session.id}
                                    className={`chat-session ${session.id === currentSessionId ? 'active' : ''}`}
                                    onClick={() => switchToSession(session.id)}
                                >
                                    <div className="session-content">
                                        <span className="session-title">{session.title}</span>
                                        <span className="session-time">
                                            {new Date(session.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="session-actions">
                                        <button onClick={(e) => deleteSession(session.id, e)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Main Chat Area */}
            <div className={`chat-main-wrapper ${rightPanelOpen ? 'panel-open' : 'panel-closed'}`}>
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

                    <div className="user-info" style={{ position: 'relative' }}>
                        <div className="user-details">
                            <span className="user-name">{user?.name || 'Guest User'}</span>
                            <span className="user-email">{user?.email || 'guest@example.com'}</span>
                        </div>
                        <div className="user-avatar" onClick={() => setShowUserMenu(!showUserMenu)} style={{ cursor: 'pointer' }}>
                            {user?.name?.charAt(0)?.toUpperCase() || 'G'}
                        </div>
                        {showUserMenu && (
                            <div className="user-dropdown-menu" style={{ position: 'absolute', top: '100%', right: '0', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 100, marginTop: '8px', minWidth: '150px' }}>
                                <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '8px 12px', color: '#ef4444', borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                <div className="chat-content-area">
                    {/* Chat Messages */}
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
                                <div key={idx} className="suggestion-item" onClick={() => handleSuggestionClick(med)}>
                                    <div className="med-info">
                                        <span className="med-name">{med.name}</span>
                                        <span className="med-price">₹{med.price_per_tablet}/tablet</span>
                                    </div>
                                    <span className="med-stock">{med.total_tablets || med.stock_packets * med.tablets_per_packet} in stock</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Side Compact Panel */}
            <div className={`right-compact-panel ${rightPanelOpen ? 'open' : 'closed'}`}>
                <div className="panel-toggle" onClick={() => setRightPanelOpen(!rightPanelOpen)}>
                    <MessageSquare size={16} />
                </div>

                {rightPanelOpen && (
                    <div className="panel-content">
                        {/* Action Cards */}
                        <div className="action-cards">
                            <div className="action-card" onClick={handleViewOrders}>
                                <div className="card-icon">
                                    <Receipt size={20} />
                                </div>
                                <div className="card-content">
                                    <div className="card-title">1️⃣ Previous Orders</div>
                                    <div className="card-subtitle">View history</div>
                                </div>
                            </div>

                            <div className="action-card" onClick={handleCheckout}>
                                <div className="card-icon">
                                    <ShoppingCart size={20} />
                                </div>
                                <div className="card-content">
                                    <div className="card-title">2️⃣ Checkout Order</div>
                                    <div className="card-subtitle">Complete purchase</div>
                                </div>
                                {selectedMedicines.length > 0 && (
                                    <div className="cart-badge">{selectedMedicines.length}</div>
                                )}
                            </div>

                            <div className="action-card">
                                <div className="card-icon">
                                    <Gift size={20} />
                                </div>
                                <div className="card-content">
                                    <div className="card-title">3️⃣ Offers</div>
                                    <div className="card-subtitle">View discounts</div>
                                </div>
                            </div>
                        </div>

                        {/* Current Cart Preview */}
                        <div className="cart-preview">
                            <div className="cart-header">
                                <span className="cart-title">👉 Current Cart</span>
                                {selectedMedicines.length > 0 && (
                                    <span className="cart-count">{selectedMedicines.length} items</span>
                                )}
                            </div>

                            {selectedMedicines.length === 0 ? (
                                <div className="empty-cart">
                                    <ShoppingCart size={24} />
                                    <p>Your cart is empty</p>
                                    <small>Add medicines to see them here</small>
                                </div>
                            ) : (
                                <div className="cart-items">
                                    {selectedMedicines.map((med, idx) => (
                                        <div key={idx} className="cart-item">
                                            <div className="item-info">
                                                <span className="item-name">{med.name}</span>
                                                <span className="item-quantity">Qty: {med.quantity || 1}</span>
                                            </div>
                                            <div className="item-price">
                                                ₹{((med.price_per_tablet || 0) * (med.quantity || 1)).toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="cart-total">
                                        <span>Total:</span>
                                        <span>₹{selectedMedicines.reduce((sum, med) =>
                                            sum + ((med.price_per_tablet || 0) * (med.quantity || 1)), 0
                                        ).toFixed(2)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Orders Modal */}
            {showOrdersModal && (
                <div className="modal-overlay" onClick={() => setShowOrdersModal(false)}>
                    <div className="orders-modal-enhanced" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                <Receipt size={20} />
                                🧾 Previous Orders
                            </h3>
                            <button className="modal-close" onClick={() => setShowOrdersModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-content">
                            {latestOrders.length === 0 ? (
                                <div className="empty-orders">
                                    <Receipt size={48} />
                                    <p>No orders found</p>
                                    <small>Your order history will appear here</small>
                                </div>
                            ) : (
                                <div className="orders-table-container">
                                    <div className="orders-table-header">
                                        <div className="header-cell">Medicine name</div>
                                        <div className="header-cell">Qty</div>
                                        <div className="header-cell">Price</div>
                                        <div className="header-cell">Date</div>
                                        <div className="header-cell">Status</div>
                                    </div>
                                    <div className="orders-table-body">
                                        {latestOrders.map(order => (
                                            <div key={order.id} className="order-row">
                                                <div className="order-medicines">
                                                    {order.items?.map((item, idx) => (
                                                        <div key={idx} className="medicine-item">
                                                            <span className="medicine-name">{item.name}</span>
                                                            <span className="medicine-quantity">x{item.quantity}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="order-quantity">
                                                    {order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                                                </div>
                                                <div className="order-price">₹{order.total_price}</div>
                                                <div className="order-date">{formatDateShort(order.created_at)}</div>
                                                <div className="order-status">
                                                    <span className="status-badge" style={{ backgroundColor: getStatusColor(order.status) }}>
                                                        {order.status || 'Processing'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Order Details Modal */}
            {showOrderDetails && selectedOrder && (
                <div className="modal-overlay" onClick={() => setShowOrderDetails(false)}>
                    <div className="order-details-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                <Receipt size={20} />
                                Order Details #{selectedOrder.id}
                            </h3>
                            <button className="modal-close" onClick={() => setShowOrderDetails(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-content">
                            <div className="order-meta">
                                <div className="meta-item">
                                    <span className="meta-label">Order Date:</span>
                                    <span className="meta-value">{formatDate(selectedOrder.created_at)}</span>
                                </div>
                                <div className="meta-item">
                                    <span className="meta-label">Status:</span>
                                    <span className="meta-value">
                                        <span className="status-badge" style={{ backgroundColor: getStatusColor(selectedOrder.status) }}>
                                            {selectedOrder.status || 'Processing'}
                                        </span>
                                    </span>
                                </div>
                                <div className="meta-item">
                                    <span className="meta-label">Total Amount:</span>
                                    <span className="meta-value total-amount">₹{selectedOrder.total_price}</span>
                                </div>
                            </div>

                            <div className="order-items-details">
                                <h4>Medicines Ordered</h4>
                                <div className="items-list">
                                    {selectedOrder.items?.map((item, idx) => (
                                        <div key={idx} className="item-row">
                                            <div className="item-info">
                                                <span className="item-name">{item.name}</span>
                                                <span className="item-quantity">Quantity: {item.quantity}</span>
                                            </div>
                                            <div className="item-price">₹{item.price}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="order-actions">
                                <button className="btn-secondary" onClick={() => setShowOrderDetails(false)}>
                                    Close
                                </button>
                                <button className="btn-primary">
                                    Reorder
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIChat;
