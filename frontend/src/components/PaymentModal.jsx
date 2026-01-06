import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Smartphone } from 'lucide-react';
import api, { publicPayInvoice } from '../api'; // Import api instance

const PaymentModal = ({ invoice, onClose, onSuccess }) => {
    const [transactionCode, setTransactionCode] = useState('');
    const [loading, setLoading] = useState(false);
    
    // State lưu cấu hình ngân hàng lấy từ Server
    const [bankConfig, setBankConfig] = useState(null);

    // [QUAN TRỌNG] Lấy thông tin ngân hàng từ file JSON trên server
    useEffect(() => {
        api.get('/payment-config')
            .then(res => {
                if(res.data && res.data.bank_id) {
                    setBankConfig(res.data);
                }
            })
            .catch(err => console.error("Lỗi lấy config ngân hàng:", err));
    }, []);

    // Nếu chưa tải xong config thì hiện loading hoặc thông báo
    if (!bankConfig) return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center text-white z-50">
            <div className="bg-white p-6 rounded text-black">Đang tải thông tin ngân hàng...</div>
        </div>
    );

    // SỬ DỤNG DỮ LIỆU ĐỘNG TỪ SERVER
    const BANK_ID = bankConfig.bank_id;
    const ACCOUNT_NO = bankConfig.account_no;
    const ACCOUNT_NAME = bankConfig.account_name;
    const AMOUNT = invoice.total_amount;
    const CONTENT = `THANH TOAN HD ${invoice.id}`;

    const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-3AoGQeA.png?amount=${AMOUNT}&addInfo=${CONTENT}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

    const handleConfirm = async (e) => {
        e.preventDefault();
        if (!transactionCode) return alert("Vui lòng nhập mã giao dịch!");
        if(!confirm("Xác nhận đã chuyển khoản?")) return;

        setLoading(true);
        try {
            await publicPayInvoice(invoice.id, {
                payment_method: 'TRANSFER',
                transaction_code: transactionCode,
                note: 'Cư dân thanh toán qua cổng Resident Portal'
            });
            alert("Thanh toán thành công!");
            onSuccess();
            onClose();
        } catch (err) {
            alert("Lỗi: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">
                
                {/* Header */}
                <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Smartphone size={20}/> Thanh toán Biên lai #{invoice.id}
                    </h3>
                    <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded"><X /></button>
                </div>

                <div className="p-6 overflow-auto">
                    <div className="flex flex-col items-center mb-6">
                        <span className="text-gray-500 font-medium mb-4 text-sm uppercase tracking-widest">
                            Quét mã bằng App Ngân hàng
                        </span>
                        
                        {/* Ảnh QR động */}
                        <img 
                            src={qrUrl} 
                            alt="VietQR" 
                            className="w-72 h-72 border-4 border-white shadow-xl rounded-xl"
                        />

                        <div className="mt-6 text-center bg-blue-50 w-full p-3 rounded-lg border border-blue-100">
                            <p className="text-sm text-gray-500 mb-1">Tổng tiền thanh toán</p>
                            <p className="text-3xl font-extrabold text-blue-600 tracking-tight">
                                {parseFloat(AMOUNT).toLocaleString()} đ
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleConfirm} className="border-t pt-6">
                        <label className="block text-sm font-medium mb-2 text-gray-700">
                            Nhập mã giao dịch / Nội dung CK để xác nhận:
                        </label>
                        <input 
                            required
                            type="text" 
                            placeholder="VD: FT123... hoặc Tên người chuyển" 
                            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 bg-gray-50 focus:bg-white transition-colors"
                            value={transactionCode}
                            onChange={e => setTransactionCode(e.target.value)}
                        />
                        
                        <button 
                            disabled={loading}
                            type="submit" 
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-lg flex justify-center items-center gap-2 transition-all shadow-md active:scale-95"
                        >
                            {loading ? 'Đang xử lý...' : <><CheckCircle size={20}/> TÔI ĐÃ CHUYỂN KHOẢN</>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;