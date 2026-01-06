import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw, Plus, FileCheck } from 'lucide-react';
import { generateInvoices, searchInvoices, addAdHocFee, deleteInvoice } from '../api';
import RoomBillDetail from '../components/RoomBillDetail';

const BillingManager = () => {
  // Lấy thời gian thực tế hiện tại
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // State
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Modal State
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [adHocForm, setAdHocForm] = useState({ apartment_codes: '', fee_name: '', amount: 0, description: '' });

  // --- LOGIC 1: GIỚI HẠN DROPDOWN ---
  const maxMonthToShow = (year === currentYear) ? currentMonth : 12;

  // --- LOGIC 2: ĐIỀU KIỆN HIỂN THỊ NÚT ---
  const isPastMonth = year < currentYear || (year === currentYear && month < currentMonth);
  const hasInvoices = invoices.length > 0;
  
  const canGenerate = !isPastMonth || (isPastMonth && hasInvoices);
  const canAddFee = !isPastMonth;

  // --- EFFECT: TỰ ĐỘNG TÌM KIẾM ---
  useEffect(() => {
    handleSearch();
  }, [month, year]);

  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value);
    setYear(newYear);
    if (newYear < currentYear) {
        setMonth(12);
    } else if (newYear === currentYear) {
        setMonth(currentMonth);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await searchInvoices({ month, year });
      setInvoices(res.data);
    } catch (err) {
      console.error(err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if(!confirm(`Bạn chắc chắn muốn chốt sổ và tính tiền tháng ${month}/${year}?`)) return;
    setLoading(true);
    try {
      const res = await generateInvoices(month, year);
      alert(res.data.message);
      handleSearch();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa khoản thu này? Thao tác này không thể hoàn tác.")) return;
    try {
        await deleteInvoice(id);
        alert("Xóa thành công!");
        handleSearch(); // Tải lại danh sách
    } catch (err) {
        alert("Lỗi: " + (err.response?.data?.message || err.message));
    }
  };

  const handleAddAdHoc = async (e) => {
    e.preventDefault();
    try {
        const codes = adHocForm.apartment_codes.split(',').map(c => c.trim()).filter(c => c);
        await addAdHocFee({ ...adHocForm, apartment_codes: codes, month, year });
        alert("Đã thêm phí thành công!");
        setShowAdHocModal(false);
        setAdHocForm({ apartment_codes: '', fee_name: '', amount: 0, description: '' }); // Reset form
        handleSearch();
    } catch (err) {
        alert("Lỗi: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Biên Lai</h1>
        
        <div className="flex flex-wrap gap-2">
            {/* CHỌN THÁNG */}
            <select 
                value={month} 
                onChange={e => setMonth(parseInt(e.target.value))} 
                className="border p-2 rounded bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
                {[...Array(maxMonthToShow)].map((_, i) => {
                    const monthValue = maxMonthToShow - i;
                    return (
                        <option key={monthValue} value={monthValue}>
                            Tháng {monthValue}
                        </option>
                    );
                })}
            </select>

            {/* CHỌN NĂM */}
            <select 
                value={year} 
                onChange={handleYearChange} 
                className="border p-2 rounded bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                ))}
            </select>

            <button onClick={handleSearch} className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-2 border transition-colors">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                Làm mới
            </button>

            {canGenerate && (
                <button onClick={handleGenerate} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-sm">
                    <FileCheck size={18} /> Chốt Sổ
                </button>
            )}

            {canAddFee && (
                <button onClick={() => setShowAdHocModal(true)} className="px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 flex items-center gap-2 transition-colors shadow-sm">
                    <Plus size={18} /> Phí Lẻ
                </button>
            )}
        </div>
      </div>

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
                    ) : invoices.length === 0 ? (
                        <tr>
                            <td colSpan="5" className="p-10 text-center text-gray-400 italic">
                                {isPastMonth ? `Kỳ ${month}/${year} không có dữ liệu.` : "Chưa có biên lai nào được tạo."}
                            </td>
                        </tr>
                    ) : (
                        invoices.map(inv => (
                            <tr key={inv.id} className="hover:bg-blue-50/50 transition-colors group">
                                <td className="p-4 font-bold text-gray-800">{inv.apartment_code}</td>
                                <td className="p-4 text-gray-600">{inv.owner_name}</td>
                                <td className="p-4 text-right font-bold text-blue-700">
                                    {parseFloat(inv.total_amount).toLocaleString()} đ
                                </td>
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
                                        <button 
                                            onClick={() => setSelectedInvoice(inv)} 
                                            className="text-blue-600 font-medium hover:text-blue-800 transition-colors"
                                        >
                                            Chi tiết
                                        </button>
                                        
                                        {inv.status !== 'PAID' && (
                                            <button 
                                                onClick={() => handleDelete(inv.id)} 
                                                className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                                                title="Xóa khoản thu"
                                            >
                                                <Trash2 size={18} />
                                            </button>
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

      {/* MODAL CHI TIẾT */}
      {selectedInvoice && (
        <RoomBillDetail 
            invoice={selectedInvoice} 
            onClose={() => setSelectedInvoice(null)} 
            onRefresh={handleSearch} 
        />
      )}

      {/* MODAL THÊM PHÍ LẺ */}
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
                              <p className="text-[11px] text-gray-400 mt-1 italic">Nhập nhiều căn hộ cách nhau bằng dấu phẩy</p>
                          </div>
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Tên khoản thu</label>
                              <input required placeholder="VD: Phí sửa chữa, Tiền phạt..." value={adHocForm.fee_name} onChange={e => setAdHocForm({...adHocForm, fee_name: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"/>
                          </div>
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Số tiền (VNĐ)</label>
                              <input required type="number" min="0" value={adHocForm.amount} onChange={e => setAdHocForm({...adHocForm, amount: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"/>
                          </div>
                          <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">Ghi chú / Mô tả</label>
                              <textarea value={adHocForm.description} onChange={e => setAdHocForm({...adHocForm, description: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" rows="3"/>
                          </div>
                      </div>
                      <div className="mt-8 flex gap-3">
                          <button type="button" onClick={() => setShowAdHocModal(false)} className="flex-1 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">
                              Hủy bỏ
                          </button>
                          <button type="submit" className="flex-1 py-2.5 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-all shadow-md active:scale-95">
                              Lưu thông tin
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default BillingManager;