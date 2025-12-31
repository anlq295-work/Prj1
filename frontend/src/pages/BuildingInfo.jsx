import React, { useState } from 'react';
import { Building, Lock, Save, MapPin, Phone, CreditCard, Shield } from 'lucide-react';
import api from '../api';

export default function BuildingInfo() {
  const [activeTab, setActiveTab] = useState('info'); // 'info' hoặc 'security'
  
  // Lấy user từ localStorage để biết ai đang đổi pass
  const user = JSON.parse(atob(localStorage.getItem('token').split('.')[1])); // Decode JWT thô sơ để lấy username (hoặc lấy từ state User trong App)

  // State đổi mật khẩu
  const [passForm, setPassForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChangePass = async (e) => {
    e.preventDefault();
    if (passForm.newPassword !== passForm.confirmPassword) {
        return alert("Mật khẩu xác nhận không khớp!");
    }

    setLoading(true);
    try {
        await api.post('/auth/change-password', {
            username: user.username, // Gửi username lấy từ token
            oldPassword: passForm.oldPassword,
            newPassword: passForm.newPassword
        });
        alert("Đổi mật khẩu thành công!");
        setPassForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
        alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Building className="text-blue-600"/> Cấu hình hệ thống
      </h1>

      {/* TABS HEADER */}
      <div className="flex border-b border-gray-200 mb-6">
        <button 
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('info')}
        >
            Thông tin Tòa nhà
        </button>
        <button 
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${activeTab === 'security' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('security')}
        >
            Đổi mật khẩu & Bảo mật
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[400px]">
        
        {/* --- TAB 1: THÔNG TIN TÒA NHÀ (STATIC) --- */}
        {activeTab === 'info' && (
            <div className="animate-in fade-in duration-300">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <MapPin size={20} className="text-orange-500"/> Thông tin chung
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-gray-50 p-4 rounded-lg border">
                        <label className="text-xs font-bold text-gray-400 uppercase">Tên dự án</label>
                        <div className="font-bold text-lg text-blue-900">SUNSHINE APARTMENT</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border">
                        <label className="text-xs font-bold text-gray-400 uppercase">Địa chỉ</label>
                        <div className="font-medium text-gray-700">Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border">
                        <label className="text-xs font-bold text-gray-400 uppercase">Hotline BQL</label>
                        <div className="font-bold text-lg text-red-600 flex items-center gap-2">
                            <Phone size={18}/> 1900 1000
                        </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border">
                        <label className="text-xs font-bold text-gray-400 uppercase">Email hỗ trợ</label>
                        <div className="font-medium text-gray-700">hotro@sunshine.vn</div>
                    </div>
                </div>

                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <CreditCard size={20} className="text-green-600"/> Tài khoản nhận thanh toán
                </h3>
                <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl flex items-center gap-4">
                    <div className="bg-white p-2 rounded shadow-sm">
                        <img src="https://img.vietqr.io/image/MB-0000123456789-compact2.png" className="w-24 h-24 object-contain" alt="QR Demo"/>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Ngân hàng: <b className="text-gray-800">MB Bank</b></p>
                        <p className="text-sm text-gray-500">Số tài khoản: <b className="text-blue-700 text-lg">0000 1234 56789</b></p>
                        <p className="text-sm text-gray-500">Chủ tài khoản: <b className="text-gray-800">BAN QUAN TRI CHUNG CU</b></p>
                    </div>
                </div>
            </div>
        )}

        {/* --- TAB 2: ĐỔI MẬT KHẨU --- */}
        {activeTab === 'security' && (
            <div className="max-w-md animate-in fade-in duration-300">
                <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
                    <Shield size={20} className="text-blue-600"/> Thay đổi mật khẩu
                </h3>
                <p className="text-gray-500 text-sm mb-6">Cập nhật mật khẩu định kỳ để bảo vệ tài khoản quản trị.</p>

                <form onSubmit={handleChangePass} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Mật khẩu hiện tại</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                            <input 
                                type="password" required
                                className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                value={passForm.oldPassword}
                                onChange={e => setPassForm({...passForm, oldPassword: e.target.value})}
                            />
                        </div>
                    </div>
                    
                    <hr className="my-4 border-gray-100"/>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Mật khẩu mới</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                            <input 
                                type="password" required
                                className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                value={passForm.newPassword}
                                onChange={e => setPassForm({...passForm, newPassword: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 text-gray-400" size={18}/>
                            <input 
                                type="password" required
                                className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                value={passForm.confirmPassword}
                                onChange={e => setPassForm({...passForm, confirmPassword: e.target.value})}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={loading}
                        className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg transition disabled:opacity-70"
                    >
                        {loading ? 'Đang xử lý...' : <><Save size={18}/> Lưu thay đổi</>}
                    </button>
                </form>
            </div>
        )}

      </div>
    </div>
  );
}