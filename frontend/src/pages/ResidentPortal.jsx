import React, { useState, useMemo } from 'react';
import api from '../api';
import { Search, CheckCircle, AlertCircle, Zap, CreditCard, Calendar, Phone, Wallet, History, ArrowRight } from 'lucide-react';
import RoomBillDetail from '../components/RoomBillDetail'; // Đảm bảo đường dẫn đúng
import PaymentModal from '../components/PaymentModal';     // Đảm bảo đường dẫn đúng

const ResidentPortal = () => {
    const [phone, setPhone] = useState('');
    const [bills, setBills] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL'); 

    // State quản lý hiển thị Modal
    const [selectedInvoice, setSelectedInvoice] = useState(null); 
    const [paymentInvoice, setPaymentInvoice] = useState(null);   

    const formatDate = (dateString) => {
        if (!dateString) return '---';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '---';
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    };

    const handleSearch = async (e) => {
        e?.preventDefault();
        const cleanPhone = phone.trim();
        if (!cleanPhone || !/^[0-9]{9,11}$/.test(cleanPhone)) {
            setError("Vui lòng nhập số điện thoại hợp lệ.");
            return;
        }

        setLoading(true);
        setError('');
        // Không setBills(null) ngay để tránh nhấp nháy nếu đang refresh
        if(!bills) setBills(null); 
        setFilterStatus('ALL');

        try {
            const res = await api.get(`/invoices/public/search?phone=${cleanPhone}`);
            setBills(res.data);
        } catch (err) {
            setError(err.response?.data?.message || "Không tìm thấy dữ liệu.");
            setBills([]);
        } finally {
            setLoading(false);
        }
    };

    // Hàm chuẩn bị dữ liệu cho Modal Thanh Toán từ danh sách
    const handleOpenPayment = (bill) => {
        // Logic này để đảm bảo tính tổng tiền giống hệt bên trong RoomBillDetail
        // Tổng thanh toán = Tổng hóa đơn + Số dư ví (hoặc nợ cũ)
        const walletBalance = parseFloat(bill.balance || bill.household_balance || 0);
        const currentAmount = parseFloat(bill.total_amount || 0);
        
        const finalBill = {
            ...bill,
            // Cập nhật lại tổng tiền cần thanh toán bao gồm cả số dư
            total_amount: currentAmount + walletBalance 
        };
        setPaymentInvoice(finalBill);
    };

    const getInvoiceTitle = (bill) => {
        const monthlyKeywords = ['Điện', 'Nước', 'Dịch vụ', 'Quản lý', 'Gửi xe', 'Rác'];
        const feeNames = bill.items ? bill.items.map(i => i.fee_name || i.description || (i.FeeDefinition ? i.FeeDefinition.name : "") || "") : [];
        const isMonthlyBill = feeNames.some(name => monthlyKeywords.some(keyword => (name || '').toLowerCase().includes(keyword.toLowerCase())));
        const prefix = bill.status === 'PAID' ? "Biên lai" : "Khoản phí";

        if (isMonthlyBill) return `${prefix} tháng ${bill.month}/${bill.year}`;
        const validNames = feeNames.filter(n => n && n.trim() !== '');
        return validNames.length === 0 ? `${prefix} chung` : (bill.status === 'PAID' ? `Biên lai: ${validNames.join(', ')}` : validNames.join(', '));
    };

    // --- LOGIC TÍNH TOÁN TÀI CHÍNH ---
    const financialSummary = useMemo(() => {
        if (!bills || bills.length === 0) return { totalDebt: 0, totalPaid: 0, countUnpaid: 0, walletBalance: 0, netStatus: 0 };
        
        const walletBalance = parseFloat(bills[0].household_balance || bills[0].balance || 0);

        const stats = bills.reduce((acc, bill) => {
            const amount = parseFloat(bill.total_amount) || 0;
            if (bill.status === 'PAID') {
                acc.totalPaid += amount;
            } else {
                acc.totalDebt += amount;
                acc.countUnpaid += 1;
            }
            return acc;
        }, { totalDebt: 0, totalPaid: 0, countUnpaid: 0 });

        const netStatus = walletBalance - stats.totalDebt;

        return { ...stats, walletBalance, netStatus };
    }, [bills]);

    const filteredBills = useMemo(() => {
        if (!bills) return [];
        if (filterStatus === 'ALL') return bills;
        return bills.filter(bill => {
            if (filterStatus === 'UNPAID') return bill.status !== 'PAID';
            return bill.status === filterStatus;
        });
    }, [bills, filterStatus]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-6 px-4 pb-20">
            
            {/* HEADER */}
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-2xl mb-6 border-t-4 border-blue-600">
                <h1 className="text-xl font-bold text-blue-800 flex items-center gap-2">
                    <Zap size={24} className="text-blue-600" /> CỔNG DỊCH VỤ CƯ DÂN
                </h1>
                <p className="text-xs text-gray-500 mb-4 ml-8">Tra cứu công nợ & Số dư ví</p>
                
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" placeholder="Nhập SĐT..." 
                            className="w-full border p-3 pl-10 rounded-lg focus:outline-blue-500 transition-all"
                            value={phone} onChange={e => setPhone(e.target.value)}
                        />
                    </div>
                    <button disabled={loading} className="bg-blue-600 text-white px-4 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 shadow-md">
                        {loading ? '...' : <Search size={20}/>}
                    </button>
                </form>
                {error && <div className="mt-3 p-2 bg-red-50 text-red-600 text-sm rounded flex gap-2"><AlertCircle size={16}/> {error}</div>}
            </div>

            {/* DASHBOARD */}
            {bills && bills.length > 0 && (
                <div className="w-full max-w-2xl animate-fade-in-up">
                    
                    {/* KHU VỰC TÀI CHÍNH (3 Cards) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                        
                        {/* 1. VÍ CƯ DÂN */}
                        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-4 rounded-xl shadow-lg text-white relative overflow-hidden sm:col-span-3 md:col-span-1">
                            <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full blur-xl"></div>
                            <p className="text-blue-100 text-xs font-bold uppercase tracking-wider flex items-center gap-1 mb-1">
                                <Wallet size={14}/> Số dư ví
                            </p>
                            <h3 className="text-2xl font-bold">
                                {financialSummary.walletBalance.toLocaleString()} đ
                            </h3>
                            <div className="mt-2 pt-2 border-t border-white/20 text-xs text-blue-100">
                                {financialSummary.netStatus >= 0 ? (
                                    <span className="flex items-center gap-1 text-green-300 font-bold">
                                        <CheckCircle size={12}/> Đủ trả nợ
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-orange-300 font-bold">
                                        <AlertCircle size={12}/> Thiếu {Math.abs(financialSummary.netStatus).toLocaleString()}đ
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 2. CẦN THANH TOÁN */}
                        <div className={`bg-white p-4 rounded-xl shadow-sm border relative group cursor-pointer transition-all ${filterStatus === 'UNPAID' ? 'border-orange-500 ring-1 ring-orange-500 bg-orange-50' : 'border-orange-100 hover:border-orange-300'}`} onClick={() => setFilterStatus('UNPAID')}>
                            <div className={`absolute top-2 right-2 p-1.5 rounded-full ${financialSummary.countUnpaid > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                                <CreditCard size={16}/>
                            </div>
                            <p className="text-gray-500 text-xs font-bold uppercase mb-1">Nợ hiện tại</p>
                            <h3 className="text-xl font-bold text-gray-800 group-hover:text-orange-600 transition-colors">
                                {financialSummary.totalDebt.toLocaleString()} đ
                            </h3>
                            <p className="text-xs text-orange-500 mt-1 font-medium">
                                {financialSummary.countUnpaid} hóa đơn
                            </p>
                        </div>

                        {/* 3. ĐÃ THANH TOÁN */}
                        <div className={`bg-white p-4 rounded-xl shadow-sm border relative group cursor-pointer transition-all ${filterStatus === 'PAID' ? 'border-green-500 ring-1 ring-green-500 bg-green-50' : 'border-green-100 hover:border-green-300'}`} onClick={() => setFilterStatus('PAID')}>
                            <div className="absolute top-2 right-2 p-1.5 rounded-full bg-green-100 text-green-600">
                                <History size={16}/>
                            </div>
                            <p className="text-gray-500 text-xs font-bold uppercase mb-1">Đã thanh toán</p>
                            <h3 className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition-colors">
                                {financialSummary.totalPaid.toLocaleString()} đ
                            </h3>
                            <p className="text-xs text-green-500 mt-1 font-medium">Lịch sử</p>
                        </div>
                    </div>

                    {/* FILTER TABS */}
                    <div className="flex items-center gap-2 mb-4">
                        {[
                            { id: 'ALL', label: 'Tất cả', icon: null },
                            { id: 'UNPAID', label: 'Chưa trả', icon: AlertCircle },
                            { id: 'PAID', label: 'Lịch sử', icon: CheckCircle }
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setFilterStatus(tab.id)}
                                className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all ${
                                    filterStatus === tab.id 
                                    ? 'bg-gray-800 text-white shadow-lg transform scale-105' 
                                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'
                                }`}
                            >
                                {tab.icon && <tab.icon size={14}/>} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* LIST */}
                    <div className="space-y-3 pb-10">
                        <div className="flex justify-between items-end px-1">
                             <span className="text-gray-500 text-sm">Chủ hộ: <b>{bills[0].owner_name}</b> ({bills[0].apartment_code})</span>
                        </div>
                        
                        {filteredBills.length === 0 ? (
                            <div className="text-center py-8 bg-white rounded-xl border border-dashed text-gray-400">Không có dữ liệu</div>
                        ) : (
                            filteredBills.map((bill) => (
                                <div key={bill.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center relative overflow-hidden group hover:shadow-md transition-all">
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${bill.status === 'PAID' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                                    
                                    <div className="flex-1 pl-2">
                                        <h4 className={`font-bold ${bill.status === 'PAID' ? 'text-gray-600' : 'text-gray-800'}`}>{getInvoiceTitle(bill)}</h4>
                                        <div className="flex gap-3 text-xs text-gray-500 mt-1">
                                            <span className="bg-gray-100 px-1.5 rounded">#{bill.id}</span>
                                            <span className="flex items-center gap-1"><Calendar size={12}/> {formatDate(bill.createdAt || bill.created_at)}</span>
                                        </div>
                                    </div>

                                    <div className="text-right min-w-[100px]">
                                        <div className={`text-lg font-bold ${bill.status === 'PAID' ? 'text-green-600' : 'text-blue-600'}`}>
                                            {parseFloat(bill.total_amount).toLocaleString()} đ
                                        </div>
                                    </div>

                                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                                        {/* NÚT THANH TOÁN (Chỉ hiện khi chưa trả) */}
                                        {bill.status !== 'PAID' && (
                                            <button 
                                                onClick={() => handleOpenPayment(bill)} 
                                                className="bg-blue-600 hover:bg-blue-700 text-white p-2 px-3 rounded-lg shadow-md transition-transform active:scale-95 flex items-center gap-2 font-bold text-sm"
                                            >
                                                <CreditCard size={18}/> Thanh toán
                                            </button>
                                        )}
                                        {/* NÚT XEM CHI TIẾT */}
                                        <button onClick={() => setSelectedInvoice(bill)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-lg transition-colors">
                                            <ArrowRight size={18}/>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* MODAL CHI TIẾT (Có prop onRefresh để cập nhật list nếu thanh toán bên trong) */}
            {selectedInvoice && (
                <RoomBillDetail 
                    invoice={selectedInvoice} 
                    onClose={() => setSelectedInvoice(null)} 
                    onRefresh={handleSearch} 
                    readOnly={true} // Cho phép hiện nút thanh toán bên trong chi tiết
                />
            )}

            {/* MODAL THANH TOÁN (Trực tiếp từ danh sách) */}
            {paymentInvoice && (
                <PaymentModal 
                    invoice={paymentInvoice} 
                    onClose={() => setPaymentInvoice(null)} 
                    onSuccess={() => { 
                        setPaymentInvoice(null); 
                        handleSearch(); // Tải lại dữ liệu sau khi thanh toán
                    }} 
                />
            )}
        </div>
    );
};

export default ResidentPortal;