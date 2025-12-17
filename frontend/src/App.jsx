// src/App.jsx
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, ShieldCheck, LogOut } from 'lucide-react';

// Import các trang (Sẽ tạo ở bước sau)
import FeeManager from './pages/FeeManager';
import BillingManager from './pages/BillingManager';
import ResidentPortal from './pages/ResidentPortal';

// Giả lập hàm login API (Thay vì import file api.js chưa có)
const loginUser = async (user, pass) => {
    if (user === 'admin' && pass === '123') {
        return { name: 'Admin Quản Trị', role: 'ADMIN' };
    }
    throw new Error('Sai tài khoản hoặc mật khẩu (Thử: admin / 123)');
};

// --- 1. COMPONENT LOGIN ---
function Login({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
        const data = await loginUser(user, pass);
        onLogin(data);
    } catch(err) { alert(err.message); }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-xl w-96">
            <h2 className="text-2xl font-bold mb-6 text-center text-blue-800">Admin Đăng Nhập</h2>
            <input className="w-full p-3 border rounded mb-4" placeholder="Tài khoản (admin)" value={user} onChange={e=>setUser(e.target.value)}/>
            <input className="w-full p-3 border rounded mb-6" type="password" placeholder="Mật khẩu (123)" value={pass} onChange={e=>setPass(e.target.value)}/>
            <button className="w-full bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-700">Đăng Nhập</button>
            <div className="mt-4 text-center">
                <Link to="/resident" className="text-sm text-gray-500 underline">Tôi là cư dân (Tra cứu)</Link>
            </div>
        </form>
    </div>
  );
}

// --- 2. LAYOUT ADMIN ---
function AdminLayout({ children, user, onLogout }) {
    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Sidebar */}
            <div className="w-64 bg-slate-900 text-white p-4">
                <div className="text-xl font-bold mb-8 flex items-center gap-2">
                    <ShieldCheck className="text-blue-400"/> Admin Panel
                </div>
                <nav className="space-y-2">
                    <Link to="/admin/fees" className="block p-3 rounded hover:bg-slate-800 flex items-center gap-3">
                        <LayoutDashboard size={20}/> Quản lý Phí
                    </Link>
                    <Link to="/admin/billing" className="block p-3 rounded hover:bg-slate-800 flex items-center gap-3">
                        <Users size={20}/> Hóa đơn & Thu tiền
                    </Link>
                </nav>
                <button onClick={onLogout} className="mt-8 flex items-center gap-2 text-red-400 hover:text-red-300 w-full">
                    <LogOut size={18}/> Đăng xuất
                </button>
            </div>
            {/* Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                <header className="flex justify-between items-center mb-6 border-b pb-4">
                    <h1 className="text-2xl font-bold text-gray-800">Xin chào, {user.name}</h1>
                </header>
                <div className="bg-white p-6 rounded shadow">
                    {children}
                </div>
            </div>
        </div>
    )
}

// --- 3. MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null); 

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/resident" element={<ResidentPortal />} />
        <Route path="/login" element={!user ? <Login onLogin={setUser} /> : <Navigate to="/admin/billing" />} />
        
        {/* Protected Routes */}
        <Route path="/admin/fees" element={
            user ? <AdminLayout user={user} onLogout={()=>setUser(null)}><FeeManager /></AdminLayout> : <Navigate to="/login" />
        } />
        <Route path="/admin/billing" element={
            user ? <AdminLayout user={user} onLogout={()=>setUser(null)}><BillingManager /></AdminLayout> : <Navigate to="/login" />
        } />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}