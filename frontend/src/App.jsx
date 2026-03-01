import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './layout/MainLayout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import TraceLogs from './pages/TraceLogs';
import AIChatEnhanced from './pages/AIChatEnhanced';
import AdminSummary from './pages/AdminSummary';
import AdminHub from './pages/AdminHub';
import Bin from './pages/Bin';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access
  if (requiredRole && user.role !== requiredRole) {
    // Redirect based on user role
    if (user.role === 'admin') {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/chat" replace />;
    }
  }

  return children;
};

// Admin Protected Route (for admin-only routes)
const AdminProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/chat" replace />;
  }

  return children;
};

// Client Protected Route (for client-only routes)
const ClientProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'client') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Public Route Component (no forced redirect to chat)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/admin/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

        {/* AI Chat is for clients only */}
        <Route path="/chat" element={<ClientProtectedRoute><AIChatEnhanced /></ClientProtectedRoute>} />
        <Route path="/ai-chat" element={<ClientProtectedRoute><AIChatEnhanced /></ClientProtectedRoute>} />

          {/* Admin routes with sidebar layout - admin only */}
          <Route element={<AdminProtectedRoute><MainLayout /></AdminProtectedRoute>}>
            <Route path="/admin" element={<AdminSummary />} />
            <Route path="/admin-hub" element={<AdminHub />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/bin" element={<Bin />} />
            <Route path="/trace-logs" element={<TraceLogs />} />
          </Route>

        {/* Default redirect based on authentication */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
