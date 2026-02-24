import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

                <form className="login-form" onSubmit={handleLogin}>

                    <div className="input-group">
                        <label>EMAIL</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@pharma.ai"
                            className="login-input"
                        />
                    </div>

                    <div className="input-group">
                        <label>PASSWORD</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="login-input"
                        />
                    </div>

                    <button type="submit" className="login-button">
                        Sign In →
                    </button>
                </form>

                <div className="demo-section">
                    <p className="demo-title">DEMO CREDENTIALS</p>
                    <div className="admin-box" onClick={() => { setEmail('admin@pharma.ai'); setPassword('********'); }}>
                        <strong>Admin Access</strong>
                        <p>admin@pharma.ai · Full dashboard access</p>
                    </div>
                </div>

                <p className="footer-text">
                    Agentic AI Pharmacist v3.0 · Intelligent Healthcare · Secured with JWT
                </p>

            </div>
        </div>
    );
};

export default Login;
