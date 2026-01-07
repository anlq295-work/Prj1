import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Edit, CreditCard, Save, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas'; 
import { updateInvoice, payInvoice } from '../api';

// ==========================================
// 1. CÁC HÀM TIỆN ÍCH (HELPER)
// ==========================================

const docSoThanhChu = (so) => {
    if (so === 0) return 'Không đồng';
    const donVi = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
    const soChu = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    
    let str = parseInt(so) + '';
    let i = 0;
    let arr = [];
    let index = str.length;
    let result = [];
    
    if (index === 0 || str === 'NaN') return '';
    
    while (index > 0) {
        arr.push(str.substring(Math.max(0, index - 3), index));
        index -= 3;
    }
    
    for (i = arr.length - 1; i >= 0; i--) {
        if (arr[i] !== '' && arr[i] !== '000') {
            result.push(docHangChuc(arr[i], soChu));
            if (donVi[i]) result.push(donVi[i]);
        }
    }
    
    let stringResult = result.join(' ').trim();
    return stringResult.charAt(0).toUpperCase() + stringResult.slice(1) + ' đồng';
};

const docHangChuc = (so, soChu) => {
    let soNhom = parseInt(so);
    let tram = Math.floor(soNhom / 100);
    let chuc = Math.floor((soNhom % 100) / 10);
    let donvi = soNhom % 10;
    let ketQua = '';

    if (tram > 0 || (tram === 0 && so.length === 3)) {
        ketQua += soChu[tram] + ' trăm';
    }
    if (chuc === 0 && donvi !== 0 && tram > 0) ketQua += ' linh';
    if (chuc === 1) ketQua += ' mười';
    if (chuc > 1) ketQua += ' ' + soChu[chuc] + ' mươi';
    if (chuc === 0 && donvi === 0) return ketQua;
    
    if (donvi === 1 && chuc > 1) ketQua += ' mốt';
    else if (donvi === 5 && chuc > 0) ketQua += ' lăm';
    else if (donvi > 0) ketQua += ' ' + soChu[donvi];
    
    return ketQua;
};

const safeParseJSON = (data) => {
    if (!data) return null;
    try {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'string') return safeParseJSON(parsed);
        return Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
};

// ==========================================
// 2. COMPONENT CHÍNH
// ==========================================
const RoomBillDetail = ({ invoice, onClose, onRefresh, readOnly = false }) => {
  const [mode, setMode] = useState('VIEW'); 
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const receiptRef = useRef(null);

  useEffect(() => {
    const dataItems = invoice?.items || invoice?.InvoiceItems || [];
    setItems(JSON.parse(JSON.stringify(dataItems)));
  }, [invoice]);

  // --- [XỬ LÝ NGÀY THÁNG AN TOÀN TUYỆT ĐỐI] ---
  // Nếu invoice null -> return null ngay
  if (!invoice) return null;

  // 1. Ưu tiên createdAt, nếu không có lấy updatedAt, nếu không có nữa lấy ngày hiện tại
  let dateSource = invoice.createdAt || invoice.created_at || invoice.updatedAt || new Date();
  
  // 2. Tạo đối tượng Date
  let dateObj = new Date(dateSource);

  // 3. Kiểm tra xem Date có hợp lệ không (tránh Invalid Date). Nếu lỗi -> lấy ngày hiện tại
  if (isNaN(dateObj.getTime())) {
      dateObj = new Date(); 
  }

  // 4. Trích xuất các biến để dùng chung (đảm bảo không bao giờ bị NaN)
  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1;
  const year = dateObj.getFullYear();
  // String hiển thị trên web
  const displayDateStr = dateObj.toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const handleItemChange = (index, field, value) => {
      const newItems = [...items];
      newItems[index][field] = value;
      const qty = parseFloat(newItems[index].quantity || 0);
      const price = parseFloat(newItems[index].unit_price || 0);
      newItems[index].amount = qty * price;
      setItems(newItems);
  };

  const handleSaveEdit = async () => {
      if(!window.confirm("Bạn chắc chắn muốn lưu thay đổi?")) return;
      setLoading(true);
      try {
          await updateInvoice(invoice.id, { items: items });
          alert("Cập nhật thành công!");
          setMode('VIEW');
          onRefresh();
      } catch (err) {
          alert("Lỗi: " + (err.response?.data?.message || err.message));
      } finally {
          setLoading(false);
      }
  };

  const handleCancelEdit = () => {
      const dataItems = invoice?.items || invoice?.InvoiceItems || [];
      setItems(JSON.parse(JSON.stringify(dataItems)));
      setMode('VIEW');
  };

  const handleAdminPayment = async () => {
      if(!window.confirm("Xác nhận khách đã thanh toán?")) return;
      setLoading(true);
      try {
          await payInvoice(invoice.id);
          alert("Đã xác nhận thanh toán!");
          onRefresh();
          onClose();
      } catch (err) {
          alert("Lỗi: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const handlePrintReceipt = async () => {
    const input = receiptRef.current;
    if(!input) return;

    try {
        const canvas = await html2canvas(input, { scale: 2, useCORS: true }); 
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`BienLai_${invoice.apartment_code}_${invoice.id}.pdf`);
    } catch (err) {
        console.error("Lỗi in biên lai:", err);
        alert("Không thể tạo file PDF");
    }
  };

  const currentTotal = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

  // --- PHÂN LOẠI ITEMS ---
  const itemsWithIndex = items.map((item, idx) => ({ ...item, originalIndex: idx }));
  const isOtherFee = (item) => {
      if (item.FeeType && item.FeeType.category === 'OTHER') return true;
      if (item.FeeType && item.FeeType.category !== 'OTHER') return false;
      if ([6].includes(item.fee_type_id)) return true;
      const name = (item.fee_name || '').toLowerCase();
      const keywords = ['phụ phí', 'phạt', 'khác', 'sửa chữa', 'làm lại', 'thẻ xe', 'biến động', 'truy thu'];
      return keywords.some(k => name.includes(k));
  };
  const monthlyItems = itemsWithIndex.filter(i => !isOtherFee(i));
  const otherItems = itemsWithIndex.filter(i => isOtherFee(i));

  let summaryContent = "";
  if (invoice.month && invoice.year) {
      summaryContent = `Phí tháng ${invoice.month}/${invoice.year}`;
      if (otherItems.length > 0) summaryContent += " & Phụ phí";
  } else {
      summaryContent = items.map(item => item.fee_name).join(', ');
  }

  const renderRow = (item, idxInGroup) => {
    const isEditing = mode === 'EDIT';
    const index = item.originalIndex;
    const details = safeParseJSON(item.details);
    const hasTiers = details && Array.isArray(details) && details.length > 0;

    return (
        <tr key={index} className="border-b hover:bg-gray-50 border-gray-200">
            <td className="border border-gray-300 p-2 text-center w-10 text-gray-600">{idxInGroup + 1}</td>
            <td className="border border-gray-300 p-2">
                {isEditing ? (
                    <input className="w-full border p-1 rounded" value={item.fee_name} onChange={(e) => handleItemChange(index, 'fee_name', e.target.value)} />
                ) : (
                    <div>
                        <div className="font-medium text-gray-800">{item.fee_name}</div>
                        {item.description && (
                            <div className="text-xs text-gray-500 italic ml-2">- {item.description}</div>
                        )}
                        {hasTiers && (
                            <div className="mt-1 ml-2 text-xs text-gray-500">
                                {details.map((t, i) => (
                                    <div key={i}>• Bậc {i+1}: {t.amount} {t.unit} x {t.price.toLocaleString()} = {t.total.toLocaleString()}</div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </td>
            <td className="border border-gray-300 p-2 text-center">
                {isEditing ? (
                    <input type="number" className="w-full border p-1 rounded text-center" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} />
                ) : parseFloat(item.quantity).toLocaleString()}
            </td>
            <td className="border border-gray-300 p-2 text-right">
                {isEditing && !hasTiers ? (
                    <input type="number" className="w-full border p-1 rounded text-right" value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)} />
                ) : hasTiers ? '-' : parseFloat(item.unit_price) > 0 ? parseFloat(item.unit_price).toLocaleString() : '-'}
            </td>
            <td className="border border-gray-300 p-2 text-right font-medium text-gray-800">{parseFloat(item.amount).toLocaleString()}</td>
        </tr>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col relative">
        
        {/* --- 4. PHẦN HTML ẨN ĐỂ IN (MẪU 06-TT) --- */}
        <div style={{ position: 'absolute', top: '-10000px', left: 0 }}>
            <div ref={receiptRef} className="bg-white p-12 text-black font-serif text-sm" style={{ width: '210mm', minHeight: '148mm' }}>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="font-bold uppercase">Đơn vị: BAN QUẢN LÝ TÒA NHÀ</p>
                        <p>Địa chỉ: Khu Đô Thị Mới, Hà Nội</p>
                    </div>
                    <div className="text-center">
                        <p className="font-bold">Mẫu số 06 - TT</p>
                        <p className="text-xs italic">(Ban hành theo Thông tư số: 200/2014/TT-BTC</p>
                        <p className="text-xs italic">ngày 22/12/2014 của BTC)</p>
                    </div>
                </div>

                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold uppercase mb-1">BIÊN LAI THU TIỀN</h1>
                    {/* Sử dụng biến ngày tháng đã xử lý an toàn */}
                    <p className="italic">Ngày {day} tháng {month} năm {year}</p>
                </div>

                <div className="flex justify-end mb-4">
                    <p>Số phiếu: <span className="font-bold text-red-600">#{invoice.id}</span></p>
                </div>

                <div className="space-y-3 mb-6">
                    <div className="flex">
                        <span className="whitespace-nowrap w-36">Họ và tên người nộp:</span>
                        <span className="font-bold border-b border-dotted border-black flex-1 uppercase">{invoice.owner_name}</span>
                    </div>
                    <div className="flex">
                        <span className="whitespace-nowrap w-36">Địa chỉ (Căn hộ):</span>
                        <span className="font-bold border-b border-dotted border-black flex-1">{invoice.apartment_code}</span>
                    </div>
                    <div className="flex">
                        <span className="whitespace-nowrap w-36">Nội dung thu:</span>
                        <span className="border-b border-dotted border-black flex-1">{summaryContent}</span>
                    </div>
                </div>

                <div className="mb-4">
                    <table className="w-full border-collapse border border-black text-sm">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-2 text-center w-12">STT</th>
                                <th className="border border-black p-2 text-left">Nội dung</th>
                                <th className="border border-black p-2 text-center w-24">Số lượng</th>
                                <th className="border border-black p-2 text-right w-32">Đơn giá</th>
                                <th className="border border-black p-2 text-right w-36">Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyItems.length > 0 && (
                                <tr><td colSpan={5} className="border border-black p-1 font-bold bg-gray-100 italic pl-2">I. Các khoản phí hàng tháng</td></tr>
                            )}
                            {monthlyItems.map((item, idx) => (
                                <tr key={`m-${idx}`}>
                                    <td className="border border-black p-1 text-center">{idx + 1}</td>
                                    <td className="border border-black p-1">{item.fee_name}</td>
                                    <td className="border border-black p-1 text-center">{parseFloat(item.quantity).toLocaleString()}</td>
                                    <td className="border border-black p-1 text-right">{parseFloat(item.unit_price) > 0 ? parseFloat(item.unit_price).toLocaleString() : '-'}</td>
                                    <td className="border border-black p-1 text-right">{parseFloat(item.amount).toLocaleString()}</td>
                                </tr>
                            ))}

                            {otherItems.length > 0 && (
                                <tr><td colSpan={5} className="border border-black p-1 font-bold bg-gray-100 italic pl-2">{monthlyItems.length > 0 ? 'II. Phí khác' : 'I. Phí khác'}</td></tr>
                            )}
                            {otherItems.map((item, idx) => (
                                <tr key={`o-${idx}`}>
                                    <td className="border border-black p-1 text-center">{idx + 1}</td>
                                    <td className="border border-black p-1">{item.fee_name}</td>
                                    <td className="border border-black p-1 text-center">{parseFloat(item.quantity).toLocaleString()}</td>
                                    <td className="border border-black p-1 text-right">{parseFloat(item.unit_price) > 0 ? parseFloat(item.unit_price).toLocaleString() : '-'}</td>
                                    <td className="border border-black p-1 text-right">{parseFloat(item.amount).toLocaleString()}</td>
                                </tr>
                            ))}

                            <tr>
                                <td colSpan={4} className="border border-black p-2 text-center font-bold uppercase">Tổng cộng</td>
                                <td className="border border-black p-2 text-right font-bold">{currentTotal.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="flex mb-10">
                    <span className="whitespace-nowrap">Số tiền thu (viết bằng chữ):</span>
                    <span className="italic ml-2 font-bold border-b border-dotted border-black flex-1">{docSoThanhChu(currentTotal)}</span>
                </div>

                <div className="flex justify-between mt-4 px-10">
                    <div className="text-center">
                        <p className="font-bold">Người nộp tiền</p>
                        <p className="italic text-xs mb-16">(Ký, họ tên)</p>
                        <p className="font-bold">{invoice.owner_name}</p>
                    </div>
                    <div className="text-center">
                        <p className="font-bold">Người thu tiền</p>
                        <p className="italic text-xs mb-16">(Ký, họ tên)</p>
                        <p className="font-bold">Ban Quản Lý</p>
                    </div>
                </div>
            </div>
        </div>

        {/* --- 5. HEADER MODAL (GIAO DIỆN WEB) --- */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800">
                {invoice.status === 'PAID' ? 'BIÊN LAI THU PHÍ' : 'PHIẾU BÁO PHÍ'}
                <span className={`text-sm px-3 py-1 rounded-full font-normal border ${invoice.status === 'PAID' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                    {invoice.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                </span>
            </h2>
            <div className="text-sm text-gray-500 mt-1 flex gap-4">
                <span>Căn hộ: <strong>{invoice.apartment_code}</strong></span>
                <span>Chủ hộ: <strong>{invoice.owner_name}</strong></span>
                {/* Sử dụng biến displayDateStr đã xử lý */}
                <span>Ngày lập: <strong>{displayDateStr}</strong></span>
            </div>
          </div>
          
          <div className="flex gap-2">
            {mode === 'VIEW' && invoice.status === 'PAID' && (
                <button onClick={handlePrintReceipt} className="px-4 py-2 text-gray-700 bg-white hover:bg-gray-50 rounded-lg flex items-center gap-2 border border-gray-300 shadow-sm transition-colors">
                    <Printer size={18} /> <span className="font-medium">In biên lai</span>
                </button>
            )}

            {!readOnly && invoice.status !== 'PAID' && (
                <>
                    {mode === 'VIEW' ? (
                        <>
                            <button onClick={() => setMode('EDIT')} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-2 border border-blue-200 transition-colors">
                                <Edit size={18} /> Sửa
                            </button>
                            <button onClick={handleAdminPayment} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-md transition-colors">
                                <CreditCard size={18} /> Xác nhận thu tiền
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={handleSaveEdit} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md">
                                <Save size={18} /> Lưu
                            </button>
                            <button onClick={handleCancelEdit} disabled={loading} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2">
                                <RotateCcw size={18} /> Hủy
                            </button>
                        </>
                    )}
                </>
            )}

            <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 ml-2 rounded-full hover:bg-red-50 transition-colors">
                <X size={24} />
            </button>
          </div>
        </div>

        {/* --- 6. BODY MODAL (GIAO DIỆN WEB) --- */}
        <div className="p-6 flex-1 overflow-auto bg-gray-50/50">
             <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                 <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
                        <tr>
                            <th className="p-3 border-b text-center w-12">STT</th>
                            <th className="p-3 border-b">Khoản thu</th>
                            <th className="p-3 border-b text-center w-32">Số lượng</th>
                            <th className="p-3 border-b text-right w-40">Đơn giá</th>
                            <th className="p-3 border-b text-right w-40">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {monthlyItems.length > 0 && (
                             <tr><td colSpan={5} className="p-2 pl-4 font-bold bg-blue-50 text-blue-800 border-b border-blue-100">I. Các khoản phí hàng tháng</td></tr>
                        )}
                        {monthlyItems.map((item, idx) => renderRow(item, idx))}

                        {otherItems.length > 0 && (
                             <tr><td colSpan={5} className="p-2 pl-4 font-bold bg-orange-50 text-orange-800 border-b border-orange-100 border-t">{monthlyItems.length > 0 ? 'II. Phí phát sinh / Khác' : 'I. Phí phát sinh / Khác'}</td></tr>
                        )}
                        {otherItems.map((item, idx) => renderRow(item, idx))}
                      </tbody>
                      
                      <tfoot>
                        <tr className="bg-gray-50 font-bold text-lg border-t-2 border-gray-200">
                            <td colSpan={4} className="p-4 text-right text-gray-700">TỔNG CỘNG:</td>
                            <td className="p-4 text-right text-blue-700">{currentTotal.toLocaleString()} đ</td>
                        </tr>
                        <tr>
                            <td colSpan={5} className="p-3 text-right italic text-gray-500 bg-white border-t">
                                (Bằng chữ: {docSoThanhChu(currentTotal)})
                            </td>
                        </tr>
                      </tfoot>
                 </table>
             </div>
        </div>
      </div>
    </div>
  );
};

export default RoomBillDetail;