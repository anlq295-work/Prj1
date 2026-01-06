import React, { useState, useEffect } from 'react';
import { Building, Lock, Save, MapPin, Phone, CreditCard, Shield, Landmark } from 'lucide-react';
import api, { getPaymentConfig, updatePaymentConfig } from '../api';

export default function BuildingInfo() {
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'payment', 'security'
  
  // Lấy user từ localStorage
  const token = localStorage.getItem('token');
  const user = token ? JSON.parse(atob(token.split('.')[1])) : { username: 'admin' };

  // --- STATE 1: ĐỔI MẬT KHẨU ---
  const [passForm, setPassForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // --- STATE 2: CẤU HÌNH THANH TOÁN ---
  const [paymentForm, setPaymentForm] = useState({
    bank_id: '',
    account_no: '',
    account_name: '',
    template: '3AoGQeA'
  });

  const [loading, setLoading] = useState(false);

  // Danh sách ngân hàng (để gợi ý)
  const banks = [
    { code: 'MB', name: 'MB Bank' },
    { code: 'VCB', name: 'Vietcombank' },
    { code: 'TCB', name: 'Techcombank' },
    { code: 'ACB', name: 'ACB' },
    { code: 'BIDV', name: 'BIDV' },
    { code: 'ICB', name: 'VietinBank' },
    { code: 'TPB', name: 'TPBank' },
  ];

  // Load cấu hình thanh toán khi vào trang
  useEffect(() => {
    loadPaymentConfig();
  }, []);

  const loadPaymentConfig = async () => {
    try {
        const res = await getPaymentConfig(); // Gọi API lấy thông tin
        if (res.data && res.data.bank_id) {
            setPaymentForm(res.data);
        }
    } catch (err) {
        console.error("Lỗi tải cấu hình thanh toán:", err);
    }
  };

  // Xử lý lưu cấu hình thanh toán
  const handleSavePayment = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
          await updatePaymentConfig(paymentForm);
          alert("Cập nhật thông tin thanh toán thành công!");
          // Load lại để cập nhật view
          loadPaymentConfig(); 
      } catch (err) {
          alert("Lỗi: " + (err.response?.data?.message || err.message));
      } finally {
          setLoading(false);
      }
  };

  // Xử lý đổi mật khẩu
  const handleChangePass = async (e) => {
    e.preventDefault();
    if (passForm.newPassword !== passForm.confirmPassword) {
        return alert("Mật khẩu xác nhận không khớp!");
    }

    setLoading(true);
    try {
        await api.post('/auth/change-password', {
            username: user.username,
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
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Building className="text-blue-600"/> Cấu hình hệ thống
      </h1>

      {/* TABS HEADER */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        <button 
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('info')}
        >
            Thông tin chung
        </button>
        <button 
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'payment' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('payment')}
        >
            Cấu hình Thanh toán
        </button>
        <button 
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'security' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('security')}
        >
            Bảo mật & Tài khoản
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[400px]">
        
        {/* --- TAB 1: THÔNG TIN CHUNG --- */}
        {activeTab === 'info' && (
            <div className="animate-in fade-in duration-300">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <MapPin size={20} className="text-orange-500"/> Thông tin dự án
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
                    <CreditCard size={20} className="text-green-600"/> Tài khoản nhận thanh toán hiện tại
                </h3>
                
                {/* Hiển thị thông tin thanh toán ĐỘNG (Lấy từ API) */}
                {paymentForm.bank_id ? (
                    <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl flex items-center gap-4">
                        <div className="bg-white p-2 rounded shadow-sm">
                            <img 
                                src={`https://img.vietqr.io/image/${paymentForm.bank_id}-${paymentForm.account_no}-3AoGQeA.png?amount=1000&accountName=${encodeURIComponent(paymentForm.account_name)}`} 
                                className="w-24 h-24 object-contain" 
                                alt="QR Demo"
                            />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Ngân hàng: <b className="text-gray-800">{paymentForm.bank_id}</b></p>
                            <p className="text-sm text-gray-500">Số tài khoản: <b className="text-blue-700 text-lg">{paymentForm.account_no}</b></p>
                            <p className="text-sm text-gray-500">Chủ tài khoản: <b className="text-gray-800">{paymentForm.account_name}</b></p>
                        </div>
                    </div>
                ) : (
                    <div className="text-gray-500 italic p-4 bg-gray-50 rounded">Chưa cấu hình tài khoản nhận tiền.</div>
                )}
            </div>
        )}

        {/* --- TAB 2: CẤU HÌNH THANH TOÁN (MỚI) --- */}
        {activeTab === 'payment' && (
            <div className="max-w-3xl animate-in fade-in duration-300">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Landmark size={20} className="text-blue-600"/> Cài đặt Tài khoản Ngân hàng
                </h3>
                <p className="text-sm text-gray-500 mb-6">Thông tin này sẽ được sử dụng để tạo mã QR tự động cho cư dân thanh toán.</p>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* FORM */}
                    <form onSubmit={handleSavePayment} className="flex-1 space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Ngân hàng</label>
                            <select 
                                className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                                value={paymentForm.bank_id}
                                onChange={e => setPaymentForm({...paymentForm, bank_id: e.target.value})}
                                required
                            >
                                <option value="">-- Chọn ngân hàng --</option>
                                {banks.map(b => (
                                    <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Số tài khoản</label>
                            <input 
                                type="text" required
                                className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                value={paymentForm.account_no}
                                onChange={e => setPaymentForm({...paymentForm, account_no: e.target.value})}
                                placeholder="VD: 0333..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Tên chủ tài khoản (Không dấu)</label>
                            <input 
                                type="text" required
                                className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                                value={paymentForm.account_name}
                                onChange={e => setPaymentForm({...paymentForm, account_name: e.target.value.toUpperCase()})}
                                placeholder="NGUYEN VAN A"
                            />
                        </div>

                        <button 
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg transition disabled:opacity-70 mt-4"
                        >
                            {loading ? 'Đang lưu...' : <><Save size={18}/> Lưu Cấu Hình</>}
                        </button>
                    </form>

                    {/* PREVIEW */}
                    <div className="w-full md:w-64">
                         <div className="bg-gray-50 p-4 rounded-lg border text-center">
                            <span className="text-xs font-bold text-gray-400 uppercase mb-2 block">Xem trước QR</span>
                            {paymentForm.bank_id && paymentForm.account_no ? (
                                <img 
                                    src={`https://img.vietqr.io/image/${paymentForm.bank_id}-${paymentForm.account_no}-3AoGQeA.png?amount=1000&accountName=${encodeURIComponent(paymentForm.account_name)}`} 
                                    alt="QR Preview" 
                                    className="w-full h-auto rounded border shadow-sm"
                                />
                            ) : (
                                <div className="h-48 flex items-center justify-center text-gray-400 text-sm border-2 border-dashed rounded">
                                    Nhập thông tin để xem trước
                                </div>
                            )}
                         </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- TAB 3: ĐỔI MẬT KHẨU --- */}
        {activeTab === 'security' && (
            <div className="max-w-md animate-in fade-in duration-300">
                <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
                    <Shield size={20} className="text-red-600"/> Thay đổi mật khẩu
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
                        className="mt-4 bg-red-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-red-700 flex items-center gap-2 shadow-lg transition disabled:opacity-70"
                    >
                        {loading ? 'Đang xử lý...' : <><Save size={18}/> Đổi mật khẩu</>}
                    </button>
                </form>
            </div>
        )}

      </div>
    </div>
  );
}