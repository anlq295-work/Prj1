import React, { useState } from 'react';
import { Search, Home, CreditCard, ArrowLeft, QrCode, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api'; // Đảm bảo đã import api instance

export default function ResidentPortal() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQR, setShowQR] = useState(false); // State hiển thị Modal QR

  // Hàm tra cứu thật từ Backend
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    setShowQR(false);

    try {
      // Gọi API tìm kiếm hóa đơn của tháng hiện tại
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const response = await api.get('/invoices/search', {
        params: {
          code: code.trim(), // Mã căn hộ người dùng nhập
          month: currentMonth,
          year: currentYear
        }
      });

      // API trả về mảng, ta lấy phần tử đầu tiên khớp mã
      // Lưu ý: API search trả về mảng object invoice
      const invoice = response.data.find(inv => 
          (inv.apartment_code || inv.code).toLowerCase() === code.trim().toLowerCase()
      );

      if (invoice) {
          if (invoice.status === 'NOT_CREATED') {
            setError(`Chưa có hóa đơn tháng ${currentMonth}/${currentYear} cho căn hộ này.`);
          } else {
            setResult(invoice);
          }
      } else {
          setError('Không tìm thấy thông tin căn hộ hoặc chưa có dữ liệu.');
      }

    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối server. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  // Helper render chi tiết
  const renderDetails = () => {
    if (!result || !result.InvoiceItems) return null;
    return result.InvoiceItems.map((item, index) => (
        <div key={index} className="flex justify-between text-sm py-1 border-b border-dashed border-gray-100 last:border-0">
            <span className="text-gray-600">
                {item.fee_name} 
                <span className="text-xs text-gray-400 ml-1">({item.quantity} {item.fee_name.toLowerCase().includes('điện') ? 'kWh' : item.fee_name.toLowerCase().includes('nước') ? 'm3' : ''})</span>
            </span>
            <span className="font-medium text-gray-800">{new Intl.NumberFormat('vi-VN').format(item.amount)} đ</span>
        </div>
    ));
  };

  // URL tạo mã VietQR động (Ngân hàng demo: MBBank)
  // Bạn có thể thay đổi số tài khoản và mã ngân hàng của BQL tại đây
  const bankId = 'MB'; // Mã ngân hàng (VD: MB, VCB, TECHCOMBANK)
  const accountNo = '0000123456789'; // Số tài khoản BQL
  const accountName = 'BAN QUAN TRI CHUNG CU'; // Tên chủ tài khoản
  const memo = `P${code} T${new Date().getMonth()+1}`; // Nội dung chuyển khoản: P[Mã phòng] T[Tháng]
  const amount = result ? result.total_amount : 0;
  
  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(accountName)}`;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center pt-10 px-4 pb-10">
      
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-center text-blue-900 mb-2">Cổng Thông Tin Cư Dân</h1>
        <p className="text-center text-gray-500 mb-8">Tra cứu và thanh toán phí dịch vụ tiện lợi</p>

        {/* Ô tìm kiếm */}
        <div className="bg-white p-6 rounded-xl shadow-lg mb-6 transform transition hover:scale-[1.01] duration-300">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Home className="absolute left-3 top-3.5 text-gray-400" size={20}/>
              <input 
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-medium text-gray-700 placeholder:font-normal"
                placeholder="Nhập mã căn hộ (VD: P101)"
                value={code}
                onChange={e => setCode(e.target.value)}
                autoFocus
              />
            </div>
            <button 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <span className="animate-spin">⌛</span> : <Search size={20}/>} Tra cứu
            </button>
          </form>
          {error && <p className="text-red-500 text-sm mt-3 text-center bg-red-50 p-2 rounded border border-red-100">{error}</p>}
        </div>

        {/* Kết quả hiển thị */}
        {result && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`text-white p-4 flex justify-between items-center ${result.status === 'PAID' ? 'bg-green-600' : 'bg-blue-900'}`}>
              <span className="font-bold text-lg">Hóa đơn Tháng {result.month}/{result.year}</span>
              <span className={`text-xs font-bold px-2 py-1 rounded ${result.status === 'PAID' ? 'bg-white text-green-700' : 'bg-yellow-400 text-yellow-900'}`}>
                {result.status === 'PAID' ? 'ĐÃ THANH TOÁN' : result.status === 'DRAFT' ? 'CHƯA PHÁT HÀNH' : 'CHƯA THANH TOÁN'}
              </span>
            </div>
            
            <div className="p-6">
              <div className="flex justify-between mb-4 border-b pb-4">
                <span className="text-gray-500">Chủ hộ:</span>
                <span className="font-bold text-gray-800">{result.owner_name} ({result.apartment_code || result.code})</span>
              </div>

              <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Chi tiết khoản thu</h4>
                {renderDetails()}
                {(!result.InvoiceItems || result.InvoiceItems.length === 0) && <p className="text-gray-400 italic text-sm text-center">Không có chi tiết</p>}
              </div>

              <div className="flex justify-between items-center border-t pt-4 mb-6">
                <span className="font-bold text-lg text-gray-800">Tổng cộng:</span>
                <span className="font-bold text-2xl text-blue-600">
                  {new Intl.NumberFormat('vi-VN').format(result.total_amount)} đ
                </span>
              </div>

              {result.status !== 'PAID' && (
                  <button 
                    onClick={() => setShowQR(true)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2 shadow-lg transform transition hover:-translate-y-1 active:translate-y-0"
                  >
                    <QrCode size={20}/> Quét mã QR thanh toán
                  </button>
              )}
            </div>
          </div>
        )}
        
        {/* Footer Link */}
        <div className="mt-8 text-center">
             <Link to="/login" className="flex items-center justify-center gap-2 text-gray-500 hover:text-blue-600 transition">
                <ArrowLeft size={16}/> Đăng nhập Ban Quản Trị
             </Link>
        </div>

      </div>

      {/* MODAL QR CODE THANH TOÁN */}
      {showQR && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full relative">
                <button 
                    onClick={() => setShowQR(false)}
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500 bg-gray-100 rounded-full p-1"
                >
                    <X size={20}/>
                </button>

                <h3 className="text-center font-bold text-xl text-blue-900 mb-1">Thanh toán phí dịch vụ</h3>
                <p className="text-center text-sm text-gray-500 mb-4">Vui lòng sử dụng App Ngân hàng để quét</p>
                
                <div className="bg-white p-2 border-2 border-blue-100 rounded-xl mb-4">
                    <img 
                        src={qrUrl} 
                        alt="VietQR" 
                        className="w-full h-auto rounded-lg"
                    />
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-sm">
                    <p className="flex justify-between mb-1"><span>Ngân hàng:</span> <span className="font-bold">{bankId}</span></p>
                    <p className="flex justify-between mb-1"><span>Số tài khoản:</span> <span className="font-bold">{accountNo}</span></p>
                    <p className="flex justify-between mb-1"><span>Chủ tài khoản:</span> <span className="font-bold text-blue-800">{accountName}</span></p>
                    <p className="flex justify-between mb-1"><span>Số tiền:</span> <span className="font-bold text-red-600">{new Intl.NumberFormat('vi-VN').format(amount)} đ</span></p>
                    <p className="flex justify-between"><span>Nội dung:</span> <span className="font-mono font-bold bg-white px-1 rounded border">{memo}</span></p>
                </div>
                
                <p className="text-xs text-center text-gray-400 mt-4 italic">
                    * Hệ thống sẽ tự động cập nhật trạng thái sau khi nhận được tiền (Demo)
                </p>
            </div>
        </div>
      )}

    </div>
  );
}