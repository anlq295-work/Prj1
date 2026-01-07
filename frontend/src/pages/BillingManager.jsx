import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw, Plus, Calculator, Lock, Bug } from 'lucide-react';
import { 
    generateInvoices, 
    searchInvoices, 
    addAdHocFee, 
    deleteInvoice, 
    publishInvoices 
} from '../api';
import RoomBillDetail from '../components/RoomBillDetail';

const BillingManager = () => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // State
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // [HIDDEN STATE] Chế độ Debug (Mặc định tắt)
  const [debugMode, setDebugMode] = useState(false);

  // [NEW] State lưu trạng thái thực của kỳ thu từ DB
  const [periodStatus, setPeriodStatus] = useState('OPEN');

  // Modal State
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [adHocForm, setAdHocForm] = useState({ apartment_codes: '', fee_name: '', amount: 0, description: '' });

  const maxMonthToShow = (year === currentYear) ? currentMonth : 12;

  // --- 1. LẮNG NGHE PHÍM TẮT (SECRET HOTKEY) ---
  useEffect(() => {
    const handleKeyDown = (event) => {
        // Tổ hợp phím: Ctrl + Shift + D
        if (event.ctrlKey && event.shiftKey && (event.key === 'D' || event.key === 'd')) {
            event.preventDefault();
            setDebugMode(prev => {
                const newState = !prev;
                alert(newState 
                    ? "🔓 ĐÃ BẬT CHẾ ĐỘ DEBUG (DEVELOPER)\n- Cho phép tính lại phí khi đã chốt sổ.\n- Hãy cẩn thận khi thao tác." 
                    : "🔒 ĐÃ TẮT CHẾ ĐỘ DEBUG"
                );
                return newState;
            });
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- 2. LOGIC HIỂN THỊ ---
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  
  // Dùng status chính xác từ DB để xác định đã chốt chưa
  const isPeriodClosed = periodStatus === 'CLOSED';
  
  // Logic hiển thị nút:
  // - Tạm tính: Hiện khi (Chưa chốt) HOẶC (Đã chốt nhưng đang bật Debug Mode)
  const showCalculate = !isPeriodClosed || debugMode; 
  
  // - Chốt sổ: Hiện khi (Chưa chốt) VÀ (Đã có dữ liệu nháp)
  const showPublish = !isPeriodClosed && safeInvoices.length > 0;
  
  // - Phí lẻ: Luôn cho phép
  const canAddFee = true; 

  useEffect(() => {
    handleSearch();
  }, [month, year]);

  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value);
    setYear(newYear);
    if (newYear < currentYear) setMonth(12);
    else if (newYear === currentYear) setMonth(currentMonth);
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await searchInvoices({ month, year });
      const responseData = res.data;

      // Xử lý dữ liệu trả về từ Backend (dạng { data: [], status: '...' })
      if (responseData && Array.isArray(responseData.data)) {
          setInvoices(responseData.data);
          setPeriodStatus(responseData.status); // Cập nhật status chuẩn
      } else if (Array.isArray(responseData)) {
          // Fallback nếu backend trả về mảng cũ
          setInvoices(responseData);
          // Đoán status (không chính xác bằng DB nhưng tạm được)
          const isClosed = responseData.some(inv => inv.status === 'PENDING' || inv.status === 'PAID');
          setPeriodStatus(isClosed ? 'CLOSED' : 'OPEN');
      } else {
          setInvoices([]);
          setPeriodStatus('OPEN');
      }
    } catch (err) {
      console.error(err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    // Cảnh báo nếu đang dùng Debug Mode trên kỳ thu đã đóng
    if (debugMode && isPeriodClosed) {
        if (!window.confirm("⚠️ CẢNH BÁO DEBUG:\nKỳ thu này ĐÃ CHỐT SỔ.\nViệc tính lại có thể làm thay đổi số liệu các hóa đơn đã phát hành (cư dân có thể đã nhìn thấy).\n\nBạn có chắc chắn muốn tiếp tục?")) return;
    }

    setLoading(true);
    try {
      // Gửi tham số debug: true xuống Backend
      const res = await generateInvoices({ month, year, debug: debugMode });
      alert("✅ " + res.data.message);
      handleSearch();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if(!window.confirm(`Bạn đang thực hiện CHỐT SỔ tháng ${month}/${year}.\nHành động này sẽ khóa kỳ thu.\nTiếp tục?`)) return;
    setLoading(true);
    try {
      const res = await publishInvoices(month, year);
      alert("🎉 " + res.data.message);
      handleSearch();
    } catch (err) { alert("Lỗi: " + err.message); } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    // Cho phép xóa nếu (Chưa chốt sổ và chưa thanh toán) HOẶC (Đang Debug Mode)
    if(!confirm("Bạn chắc chắn muốn xóa khoản thu này?")) return;
    try { await deleteInvoice(id); handleSearch(); } catch(e) { alert(e.message); }
  };

  const handleAddAdHoc = async (e) => {
      e.preventDefault();
      try {
          const codes = adHocForm.apartment_codes.split(',').map(c => c.trim()).filter(c => c);
          await addAdHocFee({ ...adHocForm, apartment_codes: codes, month, year });
          alert("Thành công!");
          setShowAdHocModal(false);
          setAdHocForm({ apartment_codes: '', fee_name: '', amount: 0, description: '' });
          handleSearch();
      } catch (err) { alert("Lỗi: " + (err.response?.data?.message || err.message)); }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                Quản lý Biên Lai
                {/* Chỉ hiện icon Bug khi Debug Mode đang bật */}
                {debugMode && (
                    <span className="text-purple-600 bg-purple-100 px-2 py-0.5 rounded text-xs border border-purple-300 flex items-center gap-1 animate-pulse" title="Developer Mode Active">
                        <Bug size={14}/> DEV MODE
                    </span>
                )}
            </h1>
            
            <div className="flex items-center gap-2 mt-1">
                {isPeriodClosed ? (
                    <span className="text-sm font-bold text-red-600 bg-red-100 px-2 py-1 rounded flex items-center gap-1">
                        <Lock size={14}/> ĐÃ CHỐT SỔ (Phí tháng)
                    </span>
                ) : (
                    <span className="text-sm font-bold text-green-600 bg-green-100 px-2 py-1 rounded">
                        🟢 ĐANG MỞ
                    </span>
                )}
            </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="border p-2 rounded bg-white shadow-sm outline-none">
                {[...Array(maxMonthToShow)].map((_, i) => <option key={maxMonthToShow - i} value={maxMonthToShow - i}>Tháng {maxMonthToShow - i}</option>)}
            </select>
            <select value={year} onChange={handleYearChange} className="border p-2 rounded bg-white shadow-sm outline-none">
                {[currentYear, currentYear - 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={handleSearch} className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 border"><RefreshCw size={18}/></button>

            {/* NÚT TẠM TÍNH */}
            {showCalculate && (
                <button 
                    onClick={handleCalculate} 
                    disabled={loading}
                    className={`px-3 py-2 text-white rounded flex items-center gap-2 shadow-sm ${
                        debugMode && isPeriodClosed 
                        ? 'bg-purple-600 hover:bg-purple-700 ring-2 ring-purple-300' // Màu tím khi Debug ép tính
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    title={debugMode && isPeriodClosed ? "Chế độ Debug: Ép tính lại khi đã chốt" : "Tính phí hàng tháng"}
                >
                    <Calculator size={18} /> {debugMode && isPeriodClosed ? 'Ép Tính Lại' : 'Tạm tính'}
                </button>
            )}

            {showPublish && (
                <button onClick={handlePublish} disabled={loading} className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2 shadow-sm">
                    <Lock size={18} /> Chốt Sổ
                </button>
            )}

            {canAddFee && (
                <button onClick={() => setShowAdHocModal(true)} disabled={loading} className="px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 flex items-center gap-2 shadow-sm">
                    <Plus size={18} /> Phí Lẻ
                </button>
            )}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="p-4 font-semibold text-gray-700">Căn hộ</th>
                        <th className="p-4 font-semibold text-gray-700">Chủ hộ</th>
                        <th className="p-4 font-semibold text-gray-700 text-right">Tổng tiền</th>
                        <th className="p-4 font-semibold text-gray-700 text-center">Trạng thái</th>
                        <th className="p-4 font-semibold text-gray-700 text-right">Hành động</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {loading ? (
                        <tr><td colSpan="5" className="p-10 text-center text-gray-500">Đang tải dữ liệu...</td></tr>
                    ) : safeInvoices.length === 0 ? (
                        <tr>
                            <td colSpan="5" className="p-10 text-center text-gray-400 italic">
                                {isPeriodClosed ? "Kỳ thu này không có dữ liệu." : "Chưa có biên lai nào. Hãy bấm 'Tạm tính'."}
                            </td>
                        </tr>
                    ) : (
                        safeInvoices.map(inv => (
                            <tr key={inv.id} className="hover:bg-blue-50/50 transition-colors">
                                <td className="p-4 font-bold text-gray-800">{inv.apartment_code}</td>
                                <td className="p-4 text-gray-600">{inv.owner_name}</td>
                                <td className="p-4 text-right font-bold text-blue-700">{parseFloat(inv.total_amount).toLocaleString()} đ</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                        inv.status === 'PAID' ? 'bg-green-100 text-green-700' : 
                                        inv.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {inv.status === 'PAID' ? 'Đã thanh toán' : 
                                         inv.status === 'PENDING' ? 'Chờ thanh toán' : 'Nháp'}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end items-center gap-3">
                                        <button onClick={() => setSelectedInvoice(inv)} className="text-blue-600 font-medium hover:text-blue-800">Chi tiết</button>
                                        
                                        {/* Logic xóa: Cho phép nếu (Chưa thanh toán) VÀ ((Chưa chốt sổ) HOẶC (Debug Mode ON)) */}
                                        {inv.status !== 'PAID' && (!isPeriodClosed || debugMode) && (
                                            <button onClick={() => handleDelete(inv.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={18} /></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
      
      {selectedInvoice && <RoomBillDetail invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} onRefresh={handleSearch} />}
      
      {showAdHocModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="p-5 border-b bg-gray-50">
                      <h3 className="text-xl font-bold text-gray-800">Thêm Phí Phát Sinh</h3>
                  </div>
                  <form onSubmit={handleAddAdHoc} className="p-6">
                      <div className="space-y-4">
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Mã căn hộ</label>
                              <input required placeholder="VD: P101, P102" value={adHocForm.apartment_codes} onChange={e => setAdHocForm({...adHocForm, apartment_codes: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"/>
                          </div>
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Tên khoản thu</label>
                              <input required placeholder="VD: Phí sửa chữa..." value={adHocForm.fee_name} onChange={e => setAdHocForm({...adHocForm, fee_name: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"/>
                          </div>
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Số tiền (VNĐ)</label>
                              <input required type="number" min="0" value={adHocForm.amount} onChange={e => setAdHocForm({...adHocForm, amount: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"/>
                          </div>
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Ghi chú</label>
                              <textarea value={adHocForm.description} onChange={e => setAdHocForm({...adHocForm, description: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" rows="3"/>
                          </div>
                      </div>
                      <div className="mt-8 flex gap-3">
                          <button type="button" onClick={() => setShowAdHocModal(false)} className="flex-1 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Hủy bỏ</button>
                          <button type="submit" className="flex-1 py-2.5 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 shadow-md">Lưu thông tin</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default BillingManager;