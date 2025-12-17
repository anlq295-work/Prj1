import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Send, Search, Filter, X, Eye, PlusCircle } from 'lucide-react';
import api from '../api'; // File cấu hình axios của bạn
import RoomBillDetail from './RoomBillDetail'; // Import component chi tiết đã làm ở bước trước

export default function BillingManager() {
  // --- STATE QUẢN LÝ DỮ LIỆU ---
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // State bộ lọc thời gian
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  
  // State cho Modal Xem Chi Tiết
  const [selectedBill, setSelectedBill] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // State cho Modal Thêm Phí Lẻ (Ad-hoc)
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);
  const [adHocForm, setAdHocForm] = useState({
    apartment_code: '',
    fee_name: '',
    amount: '',
    description: ''
  });

  // --- EFFECTS ---
  useEffect(() => {
    fetchInvoices();
  }, [month, year]);

  // --- CÁC HÀM XỬ LÝ (ACTIONS) ---

  // 1. Lấy danh sách hóa đơn
  const fetchInvoices = async () => {
    setLoading(true);
    try {
      // API Backend: GET /bills?month=10&year=2025
      // Lưu ý: Route này mapping với hàm searchInvoices ở Controller
      const response = await api.get('/bills/search', { params: { month, year } });
      setInvoices(response.data);
    } catch (error) {
      console.error("Lỗi tải hóa đơn:", error);
    } finally {
      setLoading(false);
    }
  };

  // 2. Tạo hóa đơn hàng loạt (Chốt sổ tháng)
  const handleGenerate = async () => {
    if(!window.confirm(`Bạn có chắc muốn chốt sổ và tạo hóa đơn cho tháng ${month}/${year}?`)) return;

    setLoading(true);
    try {
      await api.post('/bills/generate', { month, year });
      alert('Tạo hóa đơn thành công!');
      fetchInvoices(); // Tải lại danh sách sau khi tạo
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 3. Thêm phí lẻ thủ công (API addAdHocItem)
  const handleAddAdHocFee = async (e) => {
    e.preventDefault();
    if(!adHocForm.apartment_code || !adHocForm.amount) return alert("Vui lòng nhập đủ thông tin");

    try {
        await api.post('/invoices/add-item', {
            ...adHocForm,
            month: month, // Lấy theo tháng đang chọn
            year: year
        });
        alert("Thêm phí phát sinh thành công!");
        setIsAdHocModalOpen(false);
        setAdHocForm({ apartment_code: '', fee_name: '', amount: '', description: '' }); // Reset form
        fetchInvoices(); // Cập nhật lại số tiền trên bảng
    } catch (error) {
        alert("Lỗi: " + (error.response?.data?.message || error.message));
    }
  };

  // 4. Mở modal xem chi tiết
  const handleViewDetail = (bill) => {
    // Parse JSON details nếu DB trả về dạng string
    let detailsParsed = [];
    if (bill.InvoiceItems) {
        detailsParsed = bill.InvoiceItems.map(item => ({
            ...item,
            // Nếu item.details là string JSON thì parse, nếu là object thì giữ nguyên
            tieredDetails: (typeof item.details === 'string') ? JSON.parse(item.details) : item.details
        }));
    }

    const billData = {
        total: bill.total_amount,
        details: detailsParsed
    };
    
    setSelectedBill({
        roomName: bill.apartment_code || bill.code, 
        billData: billData
    });
    setIsDetailModalOpen(true);
  };

  // --- TÍNH TOÁN THỐNG KÊ (MEMO) ---
  const stats = useMemo(() => {
    return invoices.reduce((acc, curr) => {
      const amount = parseFloat(curr.total_amount) || 0;
      if (curr.status === 'PAID') acc.paid += amount;
      else if (curr.status === 'OVERDUE') acc.overdue += amount;
      else acc.pending += amount;
      return acc;
    }, { paid: 0, pending: 0, overdue: 0 });
  }, [invoices]);

  // --- RENDER GIAO DIỆN ---
  return (
    <div className="relative min-h-screen bg-gray-50 p-4 sm:p-6">
      
      {/* HEADER & FILTER AREA */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 bg-white p-4 rounded-xl shadow-sm gap-4 border border-gray-100">
        <div className="flex gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tháng</label>
            <select value={month} onChange={e => setMonth(e.target.value)} className="border border-gray-300 rounded-lg p-2 w-32 bg-gray-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition">
              {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                 <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Năm</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="border border-gray-300 rounded-lg p-2 w-32 bg-gray-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition">
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => setIsAdHocModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-500 text-orange-600 font-medium hover:bg-orange-50 transition"
          >
            <PlusCircle size={18} /> Thu phí lẻ
          </button>

          <button 
            onClick={handleGenerate}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium shadow-md transition transform active:scale-95 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {loading ? 'Đang xử lý...' : <><FileText size={18} /> Chốt & Tạo Hóa Đơn</>}
          </button>
          
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-600 text-blue-600 font-medium hover:bg-blue-50 transition">
            <Send size={18} /> Gửi thông báo
          </button>
        </div>
      </div>

      {/* DASHBOARD THỐNG KÊ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-green-500">
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wide">Đã thu</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{stats.paid.toLocaleString()} đ</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-yellow-500">
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wide">Chờ thanh toán</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{stats.pending.toLocaleString()} đ</div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-red-500">
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wide">Quá hạn</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{stats.overdue.toLocaleString()} đ</div>
        </div>
      </div>

      {/* DANH SÁCH HÓA ĐƠN */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b flex gap-2 items-center bg-gray-50">
            <Search size={18} className="text-gray-400"/>
            <input placeholder="Tìm theo mã căn hoặc tên chủ hộ..." className="outline-none flex-1 text-sm bg-transparent"/>
            <Filter size={18} className="text-gray-400 cursor-pointer hover:text-blue-600"/>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-bold tracking-wider">
                <tr>
                <th className="p-4">Mã Căn</th>
                <th className="p-4">Chủ hộ</th>
                <th className="p-4">Tổng tiền</th>
                <th className="p-4">Ngày tạo</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Thao tác</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {invoices.length === 0 ? (
                    <tr><td colSpan="6" className="p-10 text-center text-gray-500 italic">Chưa có hóa đơn nào cho tháng này.</td></tr>
                ) : invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-blue-50 transition-colors duration-150">
                    <td className="p-4 font-bold text-gray-700">{inv.apartment_code || inv.code}</td>
                    <td className="p-4 text-gray-600">{inv.owner_name}</td>
                    <td className="p-4 font-bold text-blue-900">{new Intl.NumberFormat('vi-VN').format(inv.total_amount)} đ</td>
                    <td className="p-4 text-sm text-gray-500">{new Date(inv.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold border flex w-fit items-center gap-1
                        ${inv.status === 'PAID' ? 'bg-green-100 text-green-700 border-green-200' : 
                        inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${inv.status === 'PAID' ? 'bg-green-600' : inv.status === 'OVERDUE' ? 'bg-red-600' : 'bg-yellow-600'}`}></span>
                        {inv.status === 'PAID' ? 'Đã thanh toán' : inv.status === 'OVERDUE' ? 'Quá hạn' : 'Chưa thu'}
                    </span>
                    </td>
                    <td className="p-4 text-right">
                    <button 
                        onClick={() => handleViewDetail(inv)}
                        className="text-blue-600 hover:bg-blue-100 p-2 rounded-full transition" title="Xem chi tiết">
                        <Eye size={18} />
                    </button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>

      {/* --- MODAL 1: XEM CHI TIẾT HÓA ĐƠN --- */}
      {isDetailModalOpen && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                <button 
                    onClick={() => setIsDetailModalOpen(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500 z-10 bg-gray-100 rounded-full p-1 transition"
                >
                    <X size={24}/>
                </button>
                <RoomBillDetail 
                    roomName={selectedBill.roomName} 
                    billData={selectedBill.billData} 
                />
            </div>
        </div>
      )}

      {/* --- MODAL 2: THÊM PHÍ LẺ (AD-HOC) --- */}
      {isAdHocModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <PlusCircle size={20} className="text-orange-600"/> Thêm khoản thu phát sinh
                    </h3>
                    <button onClick={() => setIsAdHocModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                </div>
                
                <p className="text-sm text-gray-500 mb-4 bg-orange-50 p-2 rounded border border-orange-100">
                    Khoản thu này sẽ được cộng trực tiếp vào hóa đơn tháng <b>{month}/{year}</b>.
                </p>

                <form onSubmit={handleAddAdHocFee} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Mã căn hộ <span className="text-red-500">*</span></label>
                        <input 
                            required 
                            placeholder="VD: P301" 
                            className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-orange-200 outline-none uppercase"
                            value={adHocForm.apartment_code}
                            onChange={e => setAdHocForm({...adHocForm, apartment_code: e.target.value.toUpperCase()})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tên khoản thu <span className="text-red-500">*</span></label>
                        <input 
                            required 
                            placeholder="VD: Phạt tiếng ồn, Sửa chữa..." 
                            className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-orange-200 outline-none"
                            value={adHocForm.fee_name}
                            onChange={e => setAdHocForm({...adHocForm, fee_name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Số tiền (VNĐ) <span className="text-red-500">*</span></label>
                        <input 
                            required type="number"
                            placeholder="0" 
                            className="w-full border border-gray-300 p-2.5 rounded-lg font-bold text-gray-800 focus:ring-2 focus:ring-orange-200 outline-none"
                            value={adHocForm.amount}
                            onChange={e => setAdHocForm({...adHocForm, amount: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Ghi chú</label>
                        <textarea 
                            rows="2"
                            placeholder="Chi tiết lỗi vi phạm hoặc hạng mục sửa chữa..." 
                            className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-orange-200 outline-none"
                            value={adHocForm.description}
                            onChange={e => setAdHocForm({...adHocForm, description: e.target.value})}
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                        <button type="button" onClick={() => setIsAdHocModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Hủy</button>
                        <button type="submit" className="px-4 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 shadow-md transition">Xác nhận thu</button>
                    </div>
                </form>
            </div>
        </div>
       )}
    </div>
  );
}