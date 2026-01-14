import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShieldCheck, 
  LogOut, 
  User, 
  Lock, 
  Building,
  Zap, 
  Info
} from 'lucide-react'; // Đã xóa Bell khỏi import

import api from './api'; 

// Import các trang
import FeeManager from './pages/FeeManager';
import BillingManager from './pages/BillingManager';
import ResidentPortal from './pages/ResidentPortal';
import UsageManager from './pages/UsageManager'; 
import BuildingInfo from './pages/BuildingInfo';

// --- SERVICE: GỌI API ĐĂNG NHẬP ---
const loginUser = async (username, password) => {
    try {
        const response = await api.post('/auth/login', { username, password });
        // Trả về cả user và token để component xử lý
        return { user: response.data.user, token: response.data.token };
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Lỗi kết nối Server');
    }
};

// --- 1. COMPONENT LOGIN (NỘI BỘ) ---
const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await loginUser(username, password);
      
      // [QUAN TRỌNG] Lưu thông tin vào LocalStorage để giữ đăng nhập
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Cập nhật state cho App
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">Quản Lý Chung Cư</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Tên đăng nhập</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={20} />
              <input 
                type="text" 
                className="w-full pl-10 p-2 border rounded focus:outline-none focus:border-blue-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
              />
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
              <input 
                type="password" 
                className="w-full pl-10 p-2 border rounded focus:outline-none focus:border-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
              />
            </div>
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition-colors font-semibold"
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : 'Đăng Nhập'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- 2. COMPONENT LAYOUT ADMIN ---
const AdminLayout = ({ user, onLogout, children }) => {
    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <div className="w-64 bg-white shadow-md flex flex-col">
                <div className="p-4 border-b font-bold text-xl text-blue-600 flex items-center gap-2">
                    <Building /> Admin Portal
                </div>
                <nav className="flex-1 p-4 space-y-2">
                     <Link to="/admin/billing" className="flex items-center gap-2 p-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors">
                        <Zap size={20}/> Biên lai & Dịch vụ
                     </Link>
                     <Link to="/admin/usage" className="flex items-center gap-2 p-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors">
                        <LayoutDashboard size={20}/> Chỉ số Điện/Nước
                     </Link>
                     <Link to="/admin/fees" className="flex items-center gap-2 p-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors">
                        <ShieldCheck size={20}/> Cấu hình Phí
                     </Link>
                     <Link to="/admin/info" className="flex items-center gap-2 p-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors">
                        <Info size={20}/> Thông tin Tòa nhà
                     </Link>
                </nav>
                <div className="p-4 border-t">
                    <button onClick={onLogout} className="flex items-center gap-2 text-red-600 w-full p-2 hover:bg-red-50 rounded font-medium">
                        <LogOut size={20} /> Đăng xuất
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto flex flex-col">
                <header className="bg-white shadow p-4 flex justify-between items-center sticky top-0 z-10">
                    <h2 className="font-bold text-gray-700 text-lg">Hệ thống quản lý tòa nhà</h2>
                    <div className="flex items-center gap-4">
                        {/* ĐÃ XÓA BUTTON BELL Ở ĐÂY */}
                        
                        <div className="flex items-center gap-2 pl-4">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                {user?.username?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-gray-600">{user?.full_name || user?.username}</span>
                        </div>
                    </div>
                </header>
                <main className="flex-1 p-6">
                    {children}
                </main>
            </div>
        </div>
    );
};

// --- 3. MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null); 
  const [isChecking, setIsChecking] = useState(true); // State để chờ check localStorage xong mới render

  // [QUAN TRỌNG] Khôi phục trạng thái đăng nhập khi F5
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
        try {
            setUser(JSON.parse(storedUser));
        } catch (e) {
            // Nếu dữ liệu lỗi, xóa đi
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }
    setIsChecking(false); // Đã kiểm tra xong
  }, []);

  const handleLogout = () => {
      // Xóa kho lưu trữ khi đăng xuất
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
  }

  // Nếu đang kiểm tra LocalStorage, có thể hiện màn hình loading (hoặc return null)
  if (isChecking) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/resident" element={<ResidentPortal />} />

        <Route path="/" element={<Navigate to="/resident" />} />
        
        {/* Route Login: Nếu đã có user -> Chuyển thẳng vào trang admin, ngược lại hiện form login */}
        <Route path="/login" element={!user ? <Login onLogin={setUser} /> : <Navigate to="/admin/billing" />} />
        
        {/* Protected Routes (Các trang Admin) */}
        <Route path="/admin/fees" element={
            user ? <AdminLayout user={user} onLogout={handleLogout}><FeeManager /></AdminLayout> : <Navigate to="/login" />
        } />
        <Route path="/admin/billing" element={
            user ? <AdminLayout user={user} onLogout={handleLogout}><BillingManager /></AdminLayout> : <Navigate to="/login" />
        } />
        <Route path="/admin/usage" element={
            user ? <AdminLayout user={user} onLogout={handleLogout}><UsageManager /></AdminLayout> : <Navigate to="/login" />
        } />
        <Route path="/admin/info" element={
            user ? <AdminLayout user={user} onLogout={handleLogout}><BuildingInfo /></AdminLayout> : <Navigate to="/login" />
        } />

        {/* Mặc định: Chuyển hướng về login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}