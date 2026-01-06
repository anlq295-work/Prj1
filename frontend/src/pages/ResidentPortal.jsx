import React, { useState } from 'react';
import api from '../api';
import { Search, CheckCircle, AlertCircle, FileText, Zap, CreditCard } from 'lucide-react';
import RoomBillDetail from '../components/RoomBillDetail';
import PaymentModal from '../components/PaymentModal'; // Sử dụng lại Modal thanh toán thủ công

const ResidentPortal = () => {
    const [code, setCode] = useState('');
    const [bills, setBills] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // State cho các Modal
    const [selectedInvoice, setSelectedInvoice] = useState(null); // Modal xem chi tiết
    const [paymentInvoice, setPaymentInvoice] = useState(null);   // Modal thanh toán thủ công

    // --- 1. HÀM TÌM KIẾM ---
    const handleSearch = async (e) => {
        e?.preventDefault();
        if (!code.trim()) return;

        setLoading(true);
        setError('');
        setBills(null);

        try {
            const res = await api.get(`/invoices/public/search?code=${code.trim()}`);
            setBills(res.data);
        } catch (err) {
            setError(err.response?.data?.message || "Lỗi khi tra cứu. Vui lòng kiểm tra lại mã căn hộ.");
            setBills([]);
        } finally {
            setLoading(false);
        }
    };

    // --- 2. HÀM ĐẶT TIÊU ĐỀ THÔNG MINH ---
    const getInvoiceTitle = (bill) => {
        const monthlyKeywords = ['Điện', 'Nước', 'Dịch vụ', 'Quản lý', 'Gửi xe', 'Rác'];
        const feeNames = bill.items ? bill.items.map(i => i.fee_name) : [];
        
        const isMonthlyBill = feeNames.some(name => 
            monthlyKeywords.some(keyword => name.toLowerCase().includes(keyword.toLowerCase()))
        );

        const prefix = bill.status === 'PAID' ? "Biên lai" : "Khoản phí";

        if (isMonthlyBill) {
            return `${prefix} tháng ${bill.month}/${bill.year}`;
        } else {
            if (bill.status === 'PAID') {
                return `Biên lai: ${feeNames.join(', ')}`;
            } else {
                return feeNames.join(', ');
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-10 px-4">
            
            {/* --- HEADER --- */}
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl mb-8 border-t-4 border-blue-600">
                <div className="flex justify-center mb-4">
                    <div className="bg-blue-100 p-3 rounded-full">
                        <Zap size={32} className="text-blue-600" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center text-blue-700 mb-2">CỔNG DỊCH VỤ CƯ DÂN</h1>
                <p className="text-center text-gray-500 mb-6">Tra cứu & Thanh toán biên lai trực tuyến</p>
                
                <form onSubmit={handleSearch} className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Nhập mã căn hộ (VD: P101)..." 
                        className="flex-1 border p-3 rounded-lg text-lg focus:outline-blue-500 focus:ring-2 focus:ring-blue-200 transition-all uppercase"
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                    />
                    <button 
                        disabled={loading}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:bg-gray-400"
                    >
                        {loading ? '...' : <><Search size={20}/> Tra cứu</>}
                    </button>
                </form>
                {error && <div className="mt-4 p-3 bg-red-50 text-red-600 rounded text-center border border-red-100">{error}</div>}
            </div>

            {/* --- KẾT QUẢ --- */}
            {bills && bills.length === 0 && !error && (
                <div className="text-gray-500 italic mt-4">Không tìm thấy dữ liệu nào cho căn hộ này.</div>
            )}

            {bills && bills.length > 0 && (
                <div className="w-full max-w-2xl space-y-4 pb-10">
                    <h3 className="font-bold text-gray-700 ml-1 border-l-4 border-blue-600 pl-3 flex items-baseline gap-2">
                        Kết quả cho: <span className="text-blue-600 text-xl">{code}</span> 
                        <span className="text-gray-400 font-normal text-sm">({bills[0].owner_name})</span>
                    </h3>
                    
                    {bills.map((bill) => (
                        <div key={bill.id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md transition-shadow gap-4">
                            
                            {/* Thông tin bên trái */}
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-bold text-lg ${bill.status === 'PAID' ? 'text-green-700' : 'text-gray-800'}`}>
                                        {getInvoiceTitle(bill)}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-400 mb-2">
                                    Mã GD: #{bill.id} • Ngày lập: {new Date(bill.created_at).toLocaleDateString('vi-VN')}
                                </div>
                                <div className={`text-2xl font-bold ${bill.status === 'PAID' ? 'text-green-600' : 'text-blue-600'}`}>
                                    {parseFloat(bill.total_amount).toLocaleString()} đ
                                </div>
                            </div>

                            {/* Nút hành động bên phải */}
                            <div className="flex flex-col items-end gap-3 w-full sm:w-auto">
                                {bill.status === 'PAID' ? (
                                    <>
                                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-1 uppercase tracking-wide">
                                            <CheckCircle size={14}/> Đã thanh toán
                                        </span>
                                        <button 
                                            onClick={() => setSelectedInvoice(bill)}
                                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded transition-colors text-sm font-medium flex items-center gap-1"
                                        >
                                            <FileText size={16}/> Xem chi tiết
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {/* Nút mở Modal thanh toán thủ công */}
                                        <button 
                                            onClick={() => setPaymentInvoice(bill)}
                                            className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 shadow-md hover:shadow-lg transition-all animate-pulse"
                                        >
                                            <CreditCard size={16}/> THANH TOÁN
                                        </button>

                                        <button 
                                            onClick={() => setSelectedInvoice(bill)}
                                            className="text-gray-500 hover:text-blue-600 px-3 py-1 text-sm font-medium flex items-center gap-1"
                                        >
                                            <FileText size={16}/> Xem chi tiết
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- MODAL CHI TIẾT --- */}
            {selectedInvoice && (
                <RoomBillDetail 
                    invoice={selectedInvoice} 
                    onClose={() => setSelectedInvoice(null)} 
                    readOnly={true} 
                />
            )}

            {/* --- MODAL THANH TOÁN (THỦ CÔNG) --- */}
            {paymentInvoice && (
                <PaymentModal
                    invoice={paymentInvoice}
                    onClose={() => setPaymentInvoice(null)}
                    onSuccess={() => handleSearch()} // Load lại danh sách sau khi user xác nhận
                />
            )}

        </div>
    );
};

export default ResidentPortal;