import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import TraceLogs from './pages/TraceLogs';
import AIChat from './pages/AIChat';
import AdminSummary from './pages/AdminSummary';
import AdminHub from './pages/AdminHub';
import Bin from './pages/Bin';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/admin" element={<AdminSummary />} />
          <Route path="/admin-hub" element={<AdminHub />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/bin" element={<Bin />} />
          <Route path="/trace-logs" element={<TraceLogs />} />
          <Route path="/ai-chat" element={<AIChat />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
