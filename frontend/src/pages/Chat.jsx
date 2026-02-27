import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Chat = () => {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([
    { id: 1, text: 'Welcome to AI Pharmacy Chat!', sender: 'bot' },
    { id: 2, text: 'How can I help you today?', sender: 'bot' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      const newMessage = {
        id: messages.length + 1,
        text: inputMessage,
        sender: 'user'
      };
      setMessages([...messages, newMessage]);
      
      // Simulate bot response
      setTimeout(() => {
        const botResponse = {
          id: messages.length + 2,
          text: `You said: "${inputMessage}". This is a demo response.`,
          sender: 'bot'
        };
        setMessages(prev => [...prev, botResponse]);
      }, 1000);
      
      setInputMessage('');
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f5f5f5',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#007bff',
        color: 'white',
        padding: '15px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px' }}>AI Pharmacy Chat</h2>
          {user && <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
            Welcome, {user.name}!
          </p>}
        </div>
        <button
          onClick={handleLogout}
          style={{
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Logout
        </button>
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              maxWidth: '70%',
              padding: '10px 15px',
              borderRadius: '10px',
              backgroundColor: message.sender === 'user' ? '#007bff' : '#e9ecef',
              color: message.sender === 'user' ? 'white' : '#333',
              alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
              wordBreak: 'break-word'
            }}
          >
            {message.text}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSendMessage}
        style={{
          padding: '20px',
          backgroundColor: 'white',
          borderTop: '1px solid #ddd',
          display: 'flex',
          gap: '10px'
        }}
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px',
            fontSize: '16px',
            boxSizing: 'border-box'
          }}
        />
        <button
          type="submit"
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
