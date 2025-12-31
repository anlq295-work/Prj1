import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Send, Search, Filter, X, Eye, PlusCircle, CheckSquare, Square, AlertCircle } from 'lucide-react';
import api from '../api';
import RoomBillDetail from '../components/RoomBillDetail'; // Đảm bảo import đúng file .jsx

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

  // --- STATE CHO MODAL THU PHÍ LẺ (AD-HOC) ---
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);
  const [apartmentList, setApartmentList] = useState([]); 
  const [searchTerm, setSearchTerm] = useState(''); 
  
  const [adHocForm, setAdHocForm] = useState({
    selectedCodes: [], 
    fee_name: '',
    amount: '',
    description: ''
  });

  // --- EFFECTS ---
  useEffect(() => {
    fetchInvoices();
  }, [month, year]);

  useEffect(() => {
    if (isAdHocModalOpen) {
        fetchApartments();
    }
  }, [isAdHocModalOpen]);

  // --- CÁC HÀM API ---
  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await api.get('/invoices/search', { params: { month, year } });
      setInvoices(response.data);
    } catch (error) {
      console.error("Lỗi tải hóa đơn:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApartments = async () => {
      try {
          const res = await api.get('/apartments'); 
          setApartmentList(res.data);
      } catch (err) {
          console.error("Lỗi lấy DS căn hộ:", err);
      }
  };

  // 1. TÍNH TOÁN (DRAFT)
  const handleGenerate = async () => {
    if(!window.confirm(`Bạn có chắc muốn chốt sổ và tính toán hóa đơn (Nháp) cho tháng ${month}/${year}?`)) return;

    setLoading(true);
    try {
      const res = await api.post('/invoices/generate', { month, year });
      alert(res.data.message);
      fetchInvoices(); 
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 2. PHÁT HÀNH (PUBLISH)
  const handlePublish = async () => {
    if(!window.confirm(`Xác nhận PHÁT HÀNH hóa đơn tháng ${month}/${year}? \nCư dân sẽ nhìn thấy hóa đơn và có thể thanh toán sau thao tác này.`)) return;

    setLoading(true);
    try {
      const res = await api.post('/invoices/publish', { month, year });
      alert(res.data.message);
      fetchInvoices(); // Load lại để cập nhật trạng thái
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 3. THU PHÍ LẺ
  const handleAddAdHocFee = async (e) => {
    e.preventDefault();
    if(adHocForm.selectedCodes.length === 0 || !adHocForm.amount) return alert("Vui lòng chọn ít nhất 1 căn hộ và nhập số tiền");

    try {
        await api.post('/invoices/add-item', {
            apartment_codes: adHocForm.selectedCodes,
            fee_name: adHocForm.fee_name,
            amount: adHocForm.amount,
            description: adHocForm.description,
            month, 
            year
        });
        alert(`Đã thêm khoản thu cho ${adHocForm.selectedCodes.length} căn hộ!`);
        setIsAdHocModalOpen(false);
        setAdHocForm({ selectedCodes: [], fee_name: '', amount: '', description: '' });
        fetchInvoices();
    } catch (error) {
        alert("Lỗi: " + (error.response?.data?.message || error.message));
    }
  };

  // --- LOGIC UI & HELPER ---

  const handleViewDetail = (bill) => {
    let detailsParsed = [];
    if (bill.InvoiceItems && Array.isArray(bill.InvoiceItems)) {
        detailsParsed = bill.InvoiceItems.map(item => {
            let tieredDetails = null;
            try {
                if (typeof item.details === 'string') {
                    tieredDetails = JSON.parse(item.details);
                } else {
                    tieredDetails = item.details;
                }
            } catch (e) {
                console.error("Lỗi parse details:", e);
            }
            return { ...item, tieredDetails: tieredDetails };
        });
    }

    const billData = {
        total: bill.total_amount,
        details: detailsParsed,
        month: bill.month,
        year: bill.year,
        owner_name: bill.owner_name
    };
    
    setSelectedBill({
        roomName: bill.apartment_code || bill.code, 
        billData: billData
    });
    setIsDetailModalOpen(true);
  };

  const toggleApartmentSelect = (code) => {
      setAdHocForm(prev => {
          const exists = prev.selectedCodes.includes(code);
          if (exists) {
              return { ...prev, selectedCodes: prev.selectedCodes.filter(c => c !== code) };
          } else {
              return { ...prev, selectedCodes: [...prev.selectedCodes, code] };
          }
      });
  };

  const handleSelectAll = () => {
      const visibleCodes = filteredApartments.map(apt => apt.code);
      const allSelected = visibleCodes.every(code => adHocForm.selectedCodes.includes(code));

      if (allSelected) {
          setAdHocForm(prev => ({ ...prev, selectedCodes: prev.selectedCodes.filter(c => !visibleCodes.includes(c)) }));
      } else {
          const newSelection = new Set([...adHocForm.selectedCodes, ...visibleCodes]);
          setAdHocForm(prev => ({ ...prev, selectedCodes: Array.from(newSelection) }));
      }
  };

  const filteredApartments = useMemo(() => {
      return apartmentList.filter(apt => 
          apt.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
          (apt.owner_name && apt.owner_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
  }, [apartmentList, searchTerm]);

  const stats = useMemo(() => {
    return invoices.reduce((acc, curr) => {
      if (curr.status === 'NOT_CREATED') return acc;
      const amount = parseFloat(curr.total_amount) || 0;
      if (curr.status === 'PAID') acc.paid += amount;
      else if (curr.status === 'OVERDUE') acc.overdue += amount;
      else acc.pending += amount;
      return acc;
    }, { paid: 0, pending: 0, overdue: 0 });
  }, [invoices]);

  // --- RENDER ---
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium shadow-md transition transform active:scale-95 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? 'Đang xử lý...' : <><FileText size={18} /> Tính Hóa Đơn (Nháp)</>}
          </button>
          
          <button 
            onClick={handlePublish}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 shadow-md transition transform active:scale-95"
          >
            <Send size={18} /> Phát hành
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
                    <tr><td colSpan="6" className="p-10 text-center text-gray-500 italic">Không tìm thấy dữ liệu.</td></tr>
                ) : invoices.map((inv, index) => (
                <tr key={inv.id || `temp-${index}`} className={`transition-colors duration-150 ${inv.status === 'NOT_CREATED' ? 'bg-gray-50' : 'hover:bg-blue-50'}`}>
                    <td className="p-4 font-bold text-gray-700">{inv.apartment_code || inv.code}</td>
                    <td className="p-4 text-gray-600">{inv.owner_name}</td>
                    <td className="p-4 font-bold text-blue-900">
                        {inv.status === 'NOT_CREATED' 
                            ? <span className="text-gray-300">--</span> 
                            : `${new Intl.NumberFormat('vi-VN').format(inv.total_amount)} đ`
                        }
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                        {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('vi-VN') : '--'}
                    </td>
                    <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold border flex w-fit items-center gap-1
                            ${inv.status === 'PAID' ? 'bg-green-100 text-green-700 border-green-200' : 
                              inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700 border-red-200' : 
                              inv.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                              inv.status === 'DRAFT' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                              'bg-gray-200 text-gray-500 border-gray-300' 
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full 
                                ${inv.status === 'PAID' ? 'bg-green-600' : 
                                  inv.status === 'OVERDUE' ? 'bg-red-600' : 
                                  inv.status === 'PENDING' ? 'bg-yellow-600' :
                                  inv.status === 'DRAFT' ? 'bg-blue-600' : 'bg-gray-500'}`}>
                            </span>
                            {inv.status === 'PAID' ? 'Đã thanh toán' : 
                             inv.status === 'OVERDUE' ? 'Quá hạn' : 
                             inv.status === 'PENDING' ? 'Chờ thanh toán' :
                             inv.status === 'DRAFT' ? 'Nháp (Đã chốt)' : 'Chưa tạo'}
                        </span>
                    </td>
                    <td className="p-4 text-right">
                        {inv.status === 'NOT_CREATED' ? (
                            <div className="text-gray-300 cursor-not-allowed" title="Cần chốt sổ trước"><Eye size={18} /></div>
                        ) : (
                            <button 
                                onClick={() => handleViewDetail(inv)}
                                className="text-blue-600 hover:bg-blue-100 p-2 rounded-full transition" title="Xem chi tiết">
                                <Eye size={18} />
                            </button>
                        )}
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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-0 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-orange-50">
                    <h3 className="font-bold text-lg text-orange-800 flex items-center gap-2">
                        <PlusCircle size={20}/> Thu phí phát sinh
                    </h3>
                    <button onClick={() => setIsAdHocModalOpen(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
                </div>

                <div className="flex flex-col md:flex-row h-full overflow-hidden">
                    <div className="w-full md:w-1/2 flex flex-col border-r border-gray-200 h-[400px] md:h-auto">
                        <div className="p-2 border-b flex gap-2">
                            <Search size={18} className="text-gray-400 mt-1"/>
                            <input 
                                placeholder="Tìm phòng (Mã hoặc tên)..." 
                                className="bg-transparent outline-none w-full text-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="p-2 bg-gray-50 border-b text-xs flex justify-between items-center">
                            <span className="font-bold text-gray-600">Danh sách ({filteredApartments.length})</span>
                            <button onClick={handleSelectAll} className="text-blue-600 hover:underline">
                                {adHocForm.selectedCodes.length === filteredApartments.length && filteredApartments.length > 0 ? 'Bỏ chọn' : 'Chọn tất cả'}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {filteredApartments.map(apt => {
                                const isSelected = adHocForm.selectedCodes.includes(apt.code);
                                return (
                                    <div 
                                        key={apt.code} 
                                        onClick={() => toggleApartmentSelect(apt.code)}
                                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition select-none ${isSelected ? 'bg-orange-100 border border-orange-200' : 'hover:bg-gray-50 border border-transparent'}`}
                                    >
                                        {isSelected 
                                            ? <CheckSquare size={20} className="text-orange-600 flex-shrink-0"/> 
                                            : <Square size={20} className="text-gray-300 flex-shrink-0"/>
                                        }
                                        <div>
                                            <div className="font-bold text-gray-800 text-sm">{apt.code}</div>
                                            <div className="text-xs text-gray-500">{apt.owner_name || 'Chưa có chủ'}</div>
                                        </div>
                                    </div>
                                )
                            })}
                            {filteredApartments.length === 0 && <p className="text-center text-gray-400 text-sm mt-4">Không tìm thấy căn hộ</p>}
                        </div>
                        <div className="p-2 bg-orange-100 border-t text-xs font-bold text-orange-800 text-center">
                            Đã chọn: {adHocForm.selectedCodes.length} căn hộ
                        </div>
                    </div>

                    <div className="w-full md:w-1/2 p-6 bg-gray-50 flex flex-col justify-center">
                        <form onSubmit={handleAddAdHocFee} className="space-y-4">
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                <div className="flex items-center gap-2 mb-2 text-orange-600 font-bold text-sm uppercase">
                                    <AlertCircle size={16}/> Thông tin khoản thu
                                </div>
                                <div className="text-sm text-gray-600 mb-4">
                                    Khoản phí này sẽ được cộng vào hóa đơn tháng <b>{month}/{year}</b> cho các căn hộ đã chọn.
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tên khoản thu <span className="text-red-500">*</span></label>
                                        <input 
                                            required 
                                            placeholder="VD: Phí sửa chữa, Phạt vi phạm..." 
                                            className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-orange-200 outline-none transition"
                                            value={adHocForm.fee_name}
                                            onChange={e => setAdHocForm({...adHocForm, fee_name: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Số tiền (VNĐ) <span className="text-red-500">*</span></label>
                                        <input 
                                            required type="number"
                                            placeholder="0" 
                                            className="w-full border border-gray-300 p-2.5 rounded-lg font-bold text-gray-800 focus:ring-2 focus:ring-orange-200 outline-none transition"
                                            value={adHocForm.amount}
                                            onChange={e => setAdHocForm({...adHocForm, amount: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Ghi chú</label>
                                        <textarea 
                                            rows="3"
                                            placeholder="Chi tiết..." 
                                            className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-orange-200 outline-none resize-none transition"
                                            value={adHocForm.description}
                                            onChange={e => setAdHocForm({...adHocForm, description: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsAdHocModalOpen(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition">Hủy</button>
                                <button type="submit" className="px-5 py-2.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 shadow-lg shadow-orange-200 transition transform active:scale-95">
                                    Xác nhận thu
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}