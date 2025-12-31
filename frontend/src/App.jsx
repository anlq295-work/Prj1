// src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  ShieldCheck, 
  LogOut, 
  User, 
  Lock, 
  Bell, 
  ChevronDown,
  Building,
  Zap // <--- Import Zap icon for Utilities
} from 'lucide-react';

import api from './api'; // Import configured axios instance

// Import pages
import FeeManager from './pages/FeeManager';
import BillingManager from './pages/BillingManager';
import ResidentPortal from './pages/ResidentPortal';
import UsageManager from './pages/UsageManager'; // <--- Import UsageManager

// --- REAL LOGIN FUNCTION (CALLS BACKEND) ---
const loginUser = async (username, password) => {
    try {
        const response = await api.post('/auth/login', { username, password });
        
        // Save token to LocalStorage
        localStorage.setItem('token', response.data.token);
        
        // Return user info
        return response.data.user;
    } catch (error) {
        // Throw error for Login component to catch
        throw new Error(error.response?.data?.message || 'Lỗi kết nối Server');
    }
};

// --- 1. LOGIN COMPONENT (VIETNAMESE) ---
function Login({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
        const userData = await loginUser(user, pass);
        // Role check
        if(userData.role !== 'ADMIN' && userData.role !== 'MANAGER') {
            throw new Error('Bạn không có quyền truy cập trang quản trị!');
        }
        onLogin(userData);
    } catch(err) { 
        setError(err.message); 
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all hover:scale-[1.01]">
            <div className="text-center mb-8">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building className="text-blue-600" size={32} />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-800">Quản Lý Chung Cư</h2>
                <p className="text-gray-500 mt-2">Đăng nhập hệ thống quản trị</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-200">
                        {error}
                    </div>
                )}

                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="text-gray-400" size={20} />
                    </div>
                    <input 
                        className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" 
                        placeholder="Tài khoản" 
                        value={user} 
                        onChange={e=>setUser(e.target.value)}
                        required
                    />
                </div>

                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="text-gray-400" size={20} />
                    </div>
                    <input 
                        className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" 
                        type="password" 
                        placeholder="Mật khẩu" 
                        value={pass} 
                        onChange={e=>setPass(e.target.value)}
                        required
                    />
                </div>

                <button 
                    disabled={isLoading}
                    className={`w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition duration-300 shadow-lg ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {isLoading ? 'Đang xác thực...' : 'Đăng Nhập'}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <Link to="/resident" className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center justify-center gap-1">
                    <Users size={16}/> Cổng thông tin cư dân
                </Link>
            </div>
        </div>
    </div>
  );
}

// --- 2. ADMIN LAYOUT (VIETNAMESE SIDEBAR) ---
function AdminLayout({ children, user, onLogout }) {
    const location = useLocation();

    const SidebarLink = ({ to, icon: Icon, label }) => {
        const isActive = location.pathname === to;
        return (
            <Link 
                to={to} 
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 mb-1 font-medium ${
                    isActive 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
                <Icon size={20} /> {label}
            </Link>
        );
    };

    // Helper to get page title in Vietnamese
    const getPageTitle = (path) => {
        switch(path) {
            case '/admin/fees': return 'Cấu hình Biểu phí';
            case '/admin/billing': return 'Quản lý Hóa đơn';
            case '/admin/usage': return 'Chốt Điện Nước';
            default: return 'Bảng điều khiển';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full shadow-xl z-10">
                <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <ShieldCheck className="text-white" size={24}/> 
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight">Admin Panel</h1>
                        <p className="text-xs text-slate-400">Hệ thống quản lý</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 overflow-y-auto">
                    <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider px-3 mt-4">Quản lý</div>
                    <SidebarLink to="/admin/fees" icon={LayoutDashboard} label="Cấu hình Phí" />
                    <SidebarLink to="/admin/billing" icon={Users} label="Hóa đơn & Thu tiền" />
                    <SidebarLink to="/admin/usage" icon={Zap} label="Chốt Điện Nước" />
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button 
                        onClick={onLogout} 
                        className="flex items-center gap-3 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition"
                    >
                        <LogOut size={20}/> Đăng xuất
                    </button>
                </div>
            </aside>

            {/* Content Wrapper */}
            <div className="flex-1 ml-64 flex flex-col min-h-screen">
                <header className="bg-white shadow-sm h-16 flex items-center justify-between px-8 sticky top-0 z-20">
                    <h2 className="text-xl font-bold text-gray-800">
                        {getPageTitle(location.pathname)}
                    </h2>
                    
                    <div className="flex items-center gap-4">
                        <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative">
                            <Bell size={20} />
                            <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                        </button>
                        
                        <div className="flex items-center gap-3 pl-4 border-l">
                            <div className="text-right hidden md:block">
                                <div className="text-sm font-bold text-gray-800">{user.name}</div>
                                <div className="text-xs text-blue-600 font-medium">{user.role}</div>
                            </div>
                            <img 
                                src={user.avatar} 
                                alt="Avatar" 
                                className="w-10 h-10 rounded-full border-2 border-gray-100 shadow-sm"
                            />
                            <ChevronDown size={16} className="text-gray-400 cursor-pointer"/>
                        </div>
                    </div>
                </header>

                <main className="p-8 flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}

// --- 3. MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null); 

  // (Optional) Check login on reload
  useEffect(() => {
    const token = localStorage.getItem('token');
    // Call API /me here if needed
  }, []);

  const handleLogout = () => {
      localStorage.removeItem('token');
      setUser(null);
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/resident" element={<ResidentPortal />} />
        <Route path="/login" element={!user ? <Login onLogin={setUser} /> : <Navigate to="/admin/billing" />} />
        
        {/* Protected Routes */}
        <Route path="/admin/fees" element={
            user ? <AdminLayout user={user} onLogout={handleLogout}><FeeManager /></AdminLayout> : <Navigate to="/login" />
        } />
        <Route path="/admin/billing" element={
            user ? <AdminLayout user={user} onLogout={handleLogout}><BillingManager /></AdminLayout> : <Navigate to="/login" />
        } />
        <Route path="/admin/usage" element={
            user ? <AdminLayout user={user} onLogout={handleLogout}><UsageManager /></AdminLayout> : <Navigate to="/login" />
        } />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}