import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../App.css';

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Use AuthContext login function
                login(data.user);
                // Redirect to AI chat page after successful login
                navigate('/chat');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (error) {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-wrapper">
            <div className="login-card">
                <div className="login-header">
                    <div className="logo-box">✚</div>
                    <h1 className="login-title">Agentic AI Pharmacist</h1>
                    <p className="login-subtitle">
                        Autonomous Smart Healthcare Assistant
                    </p>
                </div>

                <h2 className="signin-title">Sign in to your account</h2>

                {error && (
                    <div className="error-message" style={{
                        color: '#ef4444',
                        marginBottom: '16px',
                        padding: '12px',
                        backgroundColor: '#fef2f2',
                        borderRadius: '8px',
                        fontSize: '14px'
                    }}>
                        {error}
                    </div>
                )}

                <form className="login-form" onSubmit={handleLogin}>
                    <div className="input-group">
                        <label>EMAIL</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            className="login-input"
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label>PASSWORD</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="login-input"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-button"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In →'}
                    </button>
                </form>

                <div className="signup-link">
                    <p>
                        Don't have an account?
                        <button
                            onClick={() => navigate('/signup')}
                            className="link-button"
                        >
                            Sign up
                        </button>
                    </p>
                </div>

                <p className="footer-text">
                    Agentic AI Pharmacist v3.0 · Intelligent Healthcare
                </p>
            </div>
        </div>
    );
};

export default Login;
