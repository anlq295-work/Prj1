import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Plus, Calculator, Lock, Bug, Search, Filter, RefreshCw } from 'lucide-react';
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

  // --- STATE DỮ LIỆU ---
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [periodStatus, setPeriodStatus] = useState('OPEN');
  const [debugMode, setDebugMode] = useState(false);

  // --- STATE TÌM KIẾM & BỘ LỌC ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, HAS_ADHOC, ONLY_MONTHLY

  // --- MODAL STATE ---
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [adHocForm, setAdHocForm] = useState({ apartment_codes: '', fee_name: '', amount: 0, description: '' });

  const maxMonthToShow = (year === currentYear) ? currentMonth : 12;

  // --- 1. HOTKEY DEBUG ---
  useEffect(() => {
    const handleKeyDown = (event) => {
        if (event.ctrlKey && event.shiftKey && (event.key === 'D' || event.key === 'd')) {
            event.preventDefault();
            setDebugMode(prev => {
                const newState = !prev;
                alert(newState ? "🔓 DEBUG MODE ON" : "🔒 DEBUG MODE OFF");
                return newState;
            });
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- 2. LOGIC LOAD DỮ LIỆU ---
  useEffect(() => {
    handleSearch();
  }, [month, year]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await searchInvoices({ month, year });
      const responseData = res.data;

      if (responseData && Array.isArray(responseData.data)) {
          setInvoices(responseData.data);
          setPeriodStatus(responseData.status);
      } else if (Array.isArray(responseData)) {
          setInvoices(responseData);
          
          // [FIX] Logic xác định trạng thái kỳ sổ
          // Nếu có bất kỳ hóa đơn nào là ISSUED hoặc PAID -> Coi như kỳ này đã chốt/đang thu
          const isClosed = responseData.some(inv => {
              const s = (inv.status || '').toUpperCase();
              return s === 'ISSUED' || s === 'PAID';
          });
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

  // --- 3. LOGIC LỌC DỮ LIỆU ---
  const filteredInvoices = useMemo(() => {
    if (!Array.isArray(invoices)) return [];

    return invoices.filter(inv => {
        // 1. Tìm kiếm theo Mã căn hoặc Tên chủ hộ
        const searchLower = searchTerm.toLowerCase();
        const matchText = 
            (inv.apartment_code || '').toLowerCase().includes(searchLower) ||
            (inv.owner_name || '').toLowerCase().includes(searchLower);

        // 2. Phân loại phí
        let matchType = true;
        const hasAdHoc = inv.items?.some(item => item.FeeDefinition?.category === 'OTHER');
        
        if (filterType === 'HAS_ADHOC') {
            matchType = hasAdHoc;
        } else if (filterType === 'ONLY_MONTHLY') {
            matchType = !hasAdHoc;
        }

        return matchText && matchType;
    });
  }, [invoices, searchTerm, filterType]);

  // --- 4. CÁC HÀM XỬ LÝ HÀNH ĐỘNG ---
  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value);
    setYear(newYear);
    if (newYear < currentYear) setMonth(12);
    else if (newYear === currentYear) setMonth(currentMonth);
  };

  const handleCalculate = async () => {
    // Cảnh báo nội dung chi tiết hơn
    if (periodStatus === 'CLOSED' || invoices.some(i => ['ISSUED', 'PAID'].includes((i.status||'').toUpperCase()))) {
        const confirmMsg = 
            "⚠️ CẢNH BÁO QUAN TRỌNG:\n" +
            "Kỳ này đã có hóa đơn ĐÃ PHÁT HÀNH hoặc ĐÃ THANH TOÁN.\n\n" +
            "• Hóa đơn ĐÃ PHÁT HÀNH (Issued) -> Sẽ bị đưa về NHÁP để tính lại.\n" +
            "• Hóa đơn ĐÃ THANH TOÁN (Paid) -> Sẽ tính chênh lệch và bù trừ vào VÍ.\n\n" +
            "Bạn có chắc chắn muốn tính lại không?";
        
        if (!window.confirm(confirmMsg)) return;
    }

    setLoading(true);
    try {
      const res = await generateInvoices({ month, year, debug: debugMode });
      alert("✅ " + res.data.message);
      handleSearch(); // Load lại để thấy trạng thái mới (DRAFT)
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if(!window.confirm(`Xác nhận chốt sổ và phát hành hóa đơn tháng ${month}/${year}?`)) return;
    setLoading(true);
    try {
      const res = await publishInvoices(month, year);
      alert("🎉 " + res.data.message);
      handleSearch();
    } catch (err) { alert("Lỗi: " + err.message); } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if(!confirm("Xóa khoản thu này?")) return;
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

  const isPeriodClosed = periodStatus === 'CLOSED';
  // Luôn cho phép tính lại (Show button), nhưng sẽ có cảnh báo
  const showPublish = invoices.length > 0; 

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* HEADER & TOOLBAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                Quản lý Biên Lai
                {debugMode && (
                    <span className="text-purple-600 bg-purple-100 px-2 py-0.5 rounded text-xs border border-purple-300 flex items-center gap-1 animate-pulse">
                        <Bug size={14}/> DEV MODE
                    </span>
                )}
            </h1>
            <div className="flex items-center gap-2 mt-1">
                {isPeriodClosed ? (
                    <span className="text-sm font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded flex items-center gap-1">
                        <Lock size={14}/> ĐÃ PHÁT HÀNH / ĐANG THU
                    </span>
                ) : (
                    <span className="text-sm font-bold text-green-600 bg-green-100 px-2 py-1 rounded">
                        🟢 ĐANG MỞ (NHÁP)
                    </span>
                )}
            </div>
        </div>
        
        {/* ACTION BUTTONS */}
        <div className="flex flex-wrap gap-2">
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="border p-2 rounded bg-white shadow-sm outline-none font-medium">
                {[...Array(maxMonthToShow)].map((_, i) => <option key={maxMonthToShow - i} value={maxMonthToShow - i}>Tháng {maxMonthToShow - i}</option>)}
            </select>
            <select value={year} onChange={handleYearChange} className="border p-2 rounded bg-white shadow-sm outline-none font-medium">
                {[currentYear, currentYear - 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            
            <button 
                onClick={handleCalculate} 
                disabled={loading} 
                className={`px-3 py-2 text-white rounded flex items-center gap-2 shadow-sm ${isPeriodClosed ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                title="Tính lại phí dựa trên chỉ số mới nhất"
            >
                <Calculator size={18} /> {isPeriodClosed ? 'Tính Lại Phí' : 'Tạm tính'}
            </button>

            {showPublish && (
                <button onClick={handlePublish} disabled={loading} className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2 shadow-sm">
                    <Lock size={18} /> Chốt Sổ
                </button>
            )}

            <button onClick={() => setShowAdHocModal(true)} disabled={loading} className="px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 flex items-center gap-2 shadow-sm">
                <Plus size={18} /> Phí Lẻ
            </button>
            
            <button onClick={handleSearch} className="p-2 bg-white border rounded hover:bg-gray-50 text-gray-600" title="Làm mới">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
            </button>
        </div>
      </div>

      {/* SEARCH & FILTER BAR */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4 flex flex-wrap gap-4 items-center">
         <div className="relative flex-1 min-w-[200px]">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input 
                 type="text" 
                 placeholder="Tìm mã căn, chủ hộ..." 
                 value={searchTerm} 
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
             />
         </div>

         <div className="relative min-w-[220px]">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
             <select 
                 value={filterType} 
                 onChange={(e) => setFilterType(e.target.value)}
                 className="w-full pl-9 pr-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
             >
                 <option value="ALL">Tất cả biên lai</option>
                 <option value="ONLY_MONTHLY">Chỉ phí hàng tháng</option>
                 <option value="HAS_ADHOC">Có phí khác/Phát sinh</option>
             </select>
         </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="p-4 font-semibold text-gray-700">Căn hộ</th>
                        <th className="p-4 font-semibold text-gray-700">Chủ hộ</th>
                        <th className="p-4 font-semibold text-gray-700">Chi tiết phí</th>
                        <th className="p-4 font-semibold text-gray-700 text-right">Tổng tiền</th>
                        <th className="p-4 font-semibold text-gray-700 text-center">Trạng thái</th>
                        <th className="p-4 font-semibold text-gray-700 text-right">Hành động</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {loading ? (
                        <tr><td colSpan="6" className="p-10 text-center text-gray-500">Đang tải dữ liệu...</td></tr>
                    ) : filteredInvoices.length === 0 ? (
                        <tr>
                            <td colSpan="6" className="p-10 text-center text-gray-400 italic">
                                {searchTerm || filterType !== 'ALL' 
                                    ? "Không tìm thấy kết quả phù hợp bộ lọc." 
                                    : "Không có dữ liệu biên lai."}
                            </td>
                        </tr>
                    ) : (
                        filteredInvoices.map(inv => {
                            const hasAdHoc = inv.items?.some(item => item.FeeDefinition?.category === 'OTHER');
                            
                            return (
                                <tr key={inv.id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="p-4 font-bold text-gray-800">{inv.apartment_code}</td>
                                    <td className="p-4 text-gray-600">{inv.owner_name}</td>
                                    <td className="p-4">
                                        <div className="flex gap-1">
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded border">Cố định</span>
                                            {hasAdHoc && (
                                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded border border-orange-200 font-semibold">
                                                    + Phí khác
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right font-bold text-blue-700">{parseFloat(inv.total_amount).toLocaleString()} đ</td>
                                    
                                    {/* --- CỘT TRẠNG THÁI [ĐÃ SỬA ĐỂ BẮT MỌI CASE] --- */}
                                    <td className="p-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                            (inv.status || '').toUpperCase() === 'PAID' ? 'bg-green-100 text-green-700 border-green-200' :
                                            (inv.status || '').toUpperCase() === 'ISSUED' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                                            (inv.status || '').toUpperCase() === 'PENDING' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                            'bg-gray-100 text-gray-600 border-gray-200'
                                        }`}>
                                            {(() => {
                                                const statusUpper = (inv.status || '').toUpperCase();
                                                switch(statusUpper) {
                                                    case 'PAID': return 'Đã thanh toán';
                                                    case 'ISSUED': return 'Đã phát hành'; 
                                                    case 'PENDING': return 'Chờ thanh toán';
                                                    case 'DRAFT': return 'Nháp';
                                                    default: return `Nháp (${inv.status})`; // Debug
                                                }
                                            })()}
                                        </span>
                                    </td>
                                    {/* ----------------------------- */}

                                    <td className="p-4 text-right">
                                        <div className="flex justify-end items-center gap-3">
                                            <button onClick={() => setSelectedInvoice(inv)} className="text-blue-600 font-medium hover:text-blue-800">Chi tiết</button>
                                            
                                            {/* Nút xóa: Ẩn nếu đã thanh toán hoặc đã phát hành (trừ khi debug) */}
                                            {inv.status !== 'PAID' && (inv.status !== 'ISSUED' || debugMode) && (
                                                <button onClick={() => handleDelete(inv.id)} className="text-gray-400 hover:text-red-600 p-1">
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
      </div>
      
      {/* MODAL CHI TIẾT */}
      {selectedInvoice && <RoomBillDetail invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} onRefresh={handleSearch} />}
      
      {/* MODAL PHÍ LẺ */}
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