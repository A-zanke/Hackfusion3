import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

const Signup = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSignup = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        // Validate passwords match
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Store user info in localStorage
                localStorage.setItem('user', JSON.stringify(data.user));
                // Redirect to login page after successful signup
                navigate('/login');
            } else {
                setError(data.error || 'Signup failed');
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

                <h2 className="signin-title">Create your account</h2>

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

                <form className="login-form" onSubmit={handleSignup}>
                    <div className="input-group">
                        <label>USERNAME</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            className="login-input"
                            required
                        />
                    </div>

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

                    <div className="input-group">
                        <label>CONFIRM PASSWORD</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password"
                            className="login-input"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-button"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Creating account...' : 'Sign Up →'}
                    </button>
                </form>

                <div className="signup-link">
                    <p>
                        Already have an account?
                        <button
                            onClick={() => navigate('/login')}
                            className="link-button"
                        >
                            Sign in
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

export default Signup;
