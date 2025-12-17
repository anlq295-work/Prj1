import React, { useState } from 'react';
import { Search, Home, CreditCard, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ResidentPortal() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);

  // Giả lập tra cứu
  const handleSearch = (e) => {
    e.preventDefault();
    if (code.toUpperCase() === 'P101') {
      setResult({
        owner: 'Nguyễn Văn A',
        month: '10/2025',
        total: 1540000,
        status: 'UNPAID',
        items: [
          { name: 'Phí Quản Lý (80m2)', amount: 560000 },
          { name: 'Tiền Điện (120 số)', amount: 380000 },
          { name: 'Gửi xe ô tô', amount: 600000 },
        ]
      });
    } else {
      alert('Không tìm thấy căn hộ này (Thử nhập: P101)');
      setResult(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center pt-20 px-4">
      
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-center text-blue-900 mb-2">Cổng Thông Tin Cư Dân</h1>
        <p className="text-center text-gray-500 mb-8">Tra cứu và thanh toán phí dịch vụ tiện lợi</p>

        {/* Ô tìm kiếm */}
        <div className="bg-white p-6 rounded-xl shadow-lg mb-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Home className="absolute left-3 top-3 text-gray-400" size={20}/>
              <input 
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Nhập mã căn hộ (VD: P101)"
                value={code}
                onChange={e => setCode(e.target.value)}
              />
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2">
              <Search size={20}/> Tra cứu
            </button>
          </form>
        </div>

        {/* Kết quả hiển thị */}
        {result && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-fade-in-up">
            <div className="bg-blue-900 text-white p-4 flex justify-between items-center">
              <span className="font-bold text-lg">Hóa đơn Tháng {result.month}</span>
              <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded">CHƯA THANH TOÁN</span>
            </div>
            
            <div className="p-6">
              <div className="flex justify-between mb-4 border-b pb-4">
                <span className="text-gray-500">Chủ hộ:</span>
                <span className="font-bold text-gray-800">{result.owner} ({code.toUpperCase()})</span>
              </div>

              <div className="space-y-3 mb-6">
                {result.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.name}</span>
                    <span className="font-medium">{new Intl.NumberFormat('vi-VN').format(item.amount)} đ</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center border-t pt-4 mb-6">
                <span className="font-bold text-lg text-gray-800">Tổng cộng:</span>
                <span className="font-bold text-2xl text-blue-600">
                  {new Intl.NumberFormat('vi-VN').format(result.total)} đ
                </span>
              </div>

              <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2 shadow-lg transform transition hover:-translate-y-1">
                <CreditCard size={20}/> Thanh toán ngay (QR Code)
              </button>
            </div>
          </div>
        )}
        
        <div className="mt-8 text-center">
             <Link to="/login" className="flex items-center justify-center gap-2 text-gray-500 hover:text-blue-600">
                <ArrowLeft size={16}/> Đăng nhập Ban Quản Trị
             </Link>
        </div>

      </div>
    </div>
  );
}