import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Printer, Edit, CreditCard, Save, RotateCcw, Trash2, Plus } from 'lucide-react';
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
    let index = str.length;
    let result = [];
    if (index === 0 || str === 'NaN') return '';
    let arr = [];
    while (index > 0) {
        arr.push(str.substring(Math.max(0, index - 3), index));
        index -= 3;
    }
    for (let i = arr.length - 1; i >= 0; i--) {
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
    if (tram > 0 || (tram === 0 && so.length === 3)) ketQua += soChu[tram] + ' trăm';
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
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        return Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
};

// ==========================================
// 2. COMPONENT CHÍNH
// ==========================================
const RoomBillDetail = ({ invoice, onClose, onRefresh, readOnly = false }) => {
  const [mode, setMode] = useState('VIEW'); 
  const [items, setItems] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]); // Danh sách ID cần xóa
  const [loading, setLoading] = useState(false);
  const receiptRef = useRef(null);

  useEffect(() => {
    const dataItems = invoice?.Items || invoice?.items || [];
    setItems(JSON.parse(JSON.stringify(dataItems)));
    setDeletedIds([]); // Reset khi mở mới
  }, [invoice]);

  if (!invoice) return null;

  // Xử lý ngày tháng an toàn
  let dateSource = invoice.issued_at || invoice.createdAt || new Date();
  let dateObj = new Date(dateSource);
  if (isNaN(dateObj.getTime())) dateObj = new Date(); 

  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1;
  const year = dateObj.getFullYear();
  const displayDateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // --- CÁC HÀM XỬ LÝ DỮ LIỆU ---

  const handleItemChange = (index, field, value) => {
      const newItems = [...items];
      newItems[index][field] = value;
      // Tự động tính lại thành tiền (nếu không phải bậc thang)
      const qty = parseFloat(newItems[index].quantity || 0);
      const price = parseFloat(newItems[index].unit_price || 0);
      const details = safeParseJSON(newItems[index].metadata);
      if (!details) {
         newItems[index].amount = qty * price;
      }
      setItems(newItems);
  };

  const handleDeleteItem = (indexToDelete) => {
      if (!window.confirm("Bạn có chắc chắn muốn xóa dòng này khỏi hóa đơn?")) return;
      
      const itemToDelete = items[indexToDelete];
      // Nếu item đã có trong DB (có id), đưa vào danh sách deletedIds để gửi lên server xóa
      if (itemToDelete.id) {
          setDeletedIds([...deletedIds, itemToDelete.id]);
      }

      const newItems = items.filter((_, index) => index !== indexToDelete);
      setItems(newItems);
  };

  const handleAddItem = () => {
      // Thêm dòng mới, mặc định là loại OTHER (Phí khác)
      setItems([...items, {
          fee_name: '',
          description: '',
          quantity: 1,
          unit_price: 0,
          amount: 0,
          FeeDefinition: { category: 'OTHER', name: 'Phí mới', unit: 'Lần' }
      }]);
  };

  const handleSaveEdit = async () => {
      if(!window.confirm("Lưu thay đổi hóa đơn?")) return;
      setLoading(true);
      try {
          // Gửi cả items và deletedIds lên API
          await updateInvoice(invoice.id, { items: items, deletedIds: deletedIds });
          alert("Cập nhật thành công!");
          setMode('VIEW');
          setDeletedIds([]);
          onRefresh();
      } catch (err) {
          alert("Lỗi: " + (err.response?.data?.message || err.message));
      } finally {
          setLoading(false);
      }
  };

  const handleCancelEdit = () => {
      const dataItems = invoice?.Items || invoice?.items || [];
      setItems(JSON.parse(JSON.stringify(dataItems)));
      setDeletedIds([]);
      setMode('VIEW');
  };

  const handleAdminPayment = async () => {
      if(!window.confirm("Xác nhận đã thu tiền?")) return;
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
        console.error("Lỗi in:", err);
        alert("Không thể tạo PDF");
    }
  };

  // --- PHÂN LOẠI ITEMS (Tách nhóm) ---
  const { monthlyItems, otherItems, currentTotal } = useMemo(() => {
      let mItems = [], oItems = [];
      let total = 0;

      items.forEach((item, idx) => {
          const itemWithIdx = { ...item, originalIndex: idx };
          const amount = parseFloat(item.amount || 0);
          total += amount;

          // Logic: Nếu category là OTHER hoặc không có FeeDefinition (add tay) -> Nhóm Khác
          const isOther = item.FeeDefinition?.category === 'OTHER' || 
                          (item.description && item.description.toLowerCase().includes('phí khác')) ||
                          !item.FeeDefinition;

          if (isOther) oItems.push(itemWithIdx);
          else mItems.push(itemWithIdx);
      });

      return { monthlyItems: mItems, otherItems: oItems, currentTotal: total };
  }, [items]);

  let summaryContent = `Phí dịch vụ tháng ${invoice.month}/${invoice.year}`;
  if (otherItems.length > 0) summaryContent += " và các khoản phí khác";

  // --- RENDER MỘT DÒNG TRONG BẢNG (VIEW & EDIT) ---
  const renderRow = (item, idxInGroup, isOtherGroup = false) => {
    const isEditing = mode === 'EDIT';
    const index = item.originalIndex; 
    const details = safeParseJSON(item.metadata || item.details);
    const hasTiers = details && Array.isArray(details) && details.length > 0;
    const displayName = item.FeeDefinition?.name || item.fee_name || 'Phí dịch vụ';
    
    // [QUAN TRỌNG] Nếu là nhóm Phí Khác (isOtherGroup = true) thì để trống đơn vị
    const unitName = isOtherGroup ? '' : (item.FeeDefinition?.unit || '-');

    return (
        <tr key={index} className="border-b hover:bg-gray-50 border-gray-200">
            <td className="border border-gray-300 p-2 text-center w-10 text-gray-600">{idxInGroup + 1}</td>
            
            {/* Cột 2: Nội dung */}
            <td className="border border-gray-300 p-2">
                {isEditing ? (
                    <div className="space-y-1">
                         <input className="w-full border p-1 rounded text-sm font-bold" value={item.fee_name || displayName} onChange={(e) => handleItemChange(index, 'fee_name', e.target.value)} placeholder="Tên phí" />
                         <input className="w-full border p-1 rounded text-xs" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} placeholder="Mô tả chi tiết" />
                    </div>
                ) : (
                    <div>
                        <div className="font-medium text-gray-800">{displayName}</div>
                        {item.description && <div className="text-xs text-gray-500 italic ml-2">- {item.description}</div>}
                        {hasTiers && (
                            <div className="mt-1 ml-2 text-xs text-gray-500 bg-gray-50 p-1 rounded border border-gray-100">
                                {details.map((t, i) => (
                                    <div key={i}>• Bậc {t.tierIndex || i+1}: {t.usage} x {t.price?.toLocaleString()} = {t.cost?.toLocaleString()}</div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </td>

            {/* Cột 3: Số lượng */}
            <td className="border border-gray-300 p-2 text-center w-20">
                {isEditing ? (
                    <input type="number" className="w-full border p-1 rounded text-center" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} />
                ) : parseFloat(item.quantity).toLocaleString()}
            </td>

            {/* Cột 4: Đơn vị (Ẩn nếu là Phí khác) */}
            <td className="border border-gray-300 p-2 text-center w-16 text-gray-600 bg-gray-50/50">
                {unitName}
            </td>

            {/* Cột 5: Đơn giá */}
            <td className="border border-gray-300 p-2 text-right w-32">
                {isEditing && !hasTiers ? (
                    <input type="number" className="w-full border p-1 rounded text-right" value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)} />
                ) : hasTiers ? '-' : parseFloat(item.unit_price) > 0 ? parseFloat(item.unit_price).toLocaleString() : '-'}
            </td>

            {/* Cột 6: Thành tiền & Nút Xóa */}
            <td className="border border-gray-300 p-2 text-right font-medium text-gray-800 w-36">
                 {isEditing ? (
                    <div className="flex items-center justify-end gap-2">
                        <input type="number" className="w-full border p-1 rounded text-right font-bold" value={item.amount} onChange={(e) => handleItemChange(index, 'amount', e.target.value)} />
                        <button 
                            onClick={() => handleDeleteItem(index)} 
                            className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" 
                            title="Xóa dòng này"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                 ) : parseFloat(item.amount).toLocaleString()}
            </td>
        </tr>
    );
  };

  // --- RENDER MỘT DÒNG TRONG BẢNG IN (PRINT MODE) ---
  const renderPrintRow = (item, idx, isOtherGroup = false) => {
      const unitName = isOtherGroup ? '' : (item.FeeDefinition?.unit || '-');

      return (
        <tr key={`print-${idx}`}>
            <td className="border border-black p-1 text-center">{idx + 1}</td>
            <td className="border border-black p-1">
                {item.FeeDefinition?.name || item.fee_name} 
                <span className='text-xs italic ml-1'>({item.description})</span>
            </td>
            <td className="border border-black p-1 text-center">{parseFloat(item.quantity).toLocaleString()}</td>
            
            {/* Cột đơn vị bản in (Ẩn nếu là Phí khác) */}
            <td className="border border-black p-1 text-center">{unitName}</td>
            
            <td className="border border-black p-1 text-right">
                {parseFloat(item.unit_price) > 0 ? parseFloat(item.unit_price).toLocaleString() : '-'}
            </td>
            <td className="border border-black p-1 text-right">{parseFloat(item.amount).toLocaleString()}</td>
        </tr>
      );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col relative">
        
        {/* --- PHẦN HTML ẨN ĐỂ IN (MẪU 06-TT) --- */}
        <div style={{ position: 'absolute', top: '-10000px', left: 0 }}>
            <div ref={receiptRef} className="bg-white p-12 text-black font-serif text-sm" style={{ width: '210mm', minHeight: '148mm' }}>
                <div className="flex justify-between items-start mb-6">
                    <div><p className="font-bold uppercase">Đơn vị: BAN QUẢN LÝ TÒA NHÀ</p><p>Địa chỉ: Khu Đô Thị Mới, Hà Nội</p></div>
                    <div className="text-center"><p className="font-bold">Mẫu số 06 - TT</p><p className="text-xs italic">(Ban hành theo Thông tư số: 200/2014/TT-BTC ngày 22/12/2014 của BTC)</p></div>
                </div>
                <div className="text-center mb-6"><h1 className="text-3xl font-bold uppercase mb-1">BIÊN LAI THU TIỀN</h1><p className="italic">Ngày {day} tháng {month} năm {year}</p></div>
                <div className="flex justify-end mb-4"><p>Số phiếu: <span className="font-bold text-red-600">#{invoice.id}</span></p></div>
                <div className="space-y-3 mb-6">
                    <div className="flex"><span className="whitespace-nowrap w-36">Họ và tên người nộp:</span><span className="font-bold border-b border-dotted border-black flex-1 uppercase">{invoice.owner_name}</span></div>
                    <div className="flex"><span className="whitespace-nowrap w-36">Địa chỉ (Căn hộ):</span><span className="font-bold border-b border-dotted border-black flex-1">{invoice.apartment_code}</span></div>
                    <div className="flex"><span className="whitespace-nowrap w-36">Nội dung thu:</span><span className="border-b border-dotted border-black flex-1">{summaryContent}</span></div>
                </div>

                {/* Bảng in (Có cột Đơn vị) */}
                <div className="mb-4">
                    <table className="w-full border-collapse border border-black text-sm">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-2 text-center w-10">STT</th>
                                <th className="border border-black p-2 text-left">Nội dung</th>
                                <th className="border border-black p-2 text-center w-20">Số lượng</th>
                                <th className="border border-black p-2 text-center w-16">Đơn vị</th>
                                <th className="border border-black p-2 text-right w-24">Đơn giá</th>
                                <th className="border border-black p-2 text-right w-28">Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyItems.length > 0 && <tr><td colSpan={6} className="border border-black p-1 font-bold bg-gray-100 italic pl-2">I. Các khoản phí hàng tháng</td></tr>}
                            {monthlyItems.map((item, idx) => renderPrintRow(item, idx, false))}

                            {otherItems.length > 0 && <tr><td colSpan={6} className="border border-black p-1 font-bold bg-gray-100 italic pl-2">II. Phí khác / Phát sinh</td></tr>}
                            {otherItems.map((item, idx) => renderPrintRow(item, idx, true))}

                            <tr>
                                <td colSpan={5} className="border border-black p-2 text-center font-bold uppercase">Tổng cộng</td>
                                <td className="border border-black p-2 text-right font-bold">{currentTotal.toLocaleString()} đ</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="flex mb-10"><span className="whitespace-nowrap">Số tiền thu (viết bằng chữ):</span><span className="italic ml-2 font-bold border-b border-dotted border-black flex-1">{docSoThanhChu(currentTotal)}</span></div>
                <div className="flex justify-between mt-4 px-10"><div className="text-center"><p className="font-bold">Người nộp tiền</p><p className="italic text-xs mb-16">(Ký, họ tên)</p><p className="font-bold">{invoice.owner_name}</p></div><div className="text-center"><p className="font-bold">Người thu tiền</p><p className="italic text-xs mb-16">(Ký, họ tên)</p><p className="font-bold">Ban Quản Lý</p></div></div>
            </div>
        </div>

        {/* --- HEADER MODAL (GIAO DIỆN) --- */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800">
                {invoice.status === 'PAID' ? 'BIÊN LAI THU PHÍ' : 'PHIẾU BÁO PHÍ'}
                <span className={`text-sm px-3 py-1 rounded-full font-normal border ${invoice.status === 'PAID' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                    {invoice.status === 'PAID' ? 'Đã thanh toán' : invoice.status === 'PENDING' ? 'Chờ thanh toán' : 'Nháp'}
                </span>
            </h2>
            <div className="text-sm text-gray-500 mt-1 flex gap-4">
                <span>Căn hộ: <strong>{invoice.apartment_code}</strong></span>
                <span>Chủ hộ: <strong>{invoice.owner_name}</strong></span>
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
                            <button onClick={handleAddItem} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 border">
                                <Plus size={18} /> Thêm phí
                            </button>
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
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 ml-2 rounded-full hover:bg-red-50 transition-colors"><X size={24} /></button>
          </div>
        </div>

        {/* --- BODY MODAL (GIAO DIỆN) --- */}
        <div className="p-6 flex-1 overflow-auto bg-gray-50/50">
             <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                 <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
                        <tr>
                            <th className="p-3 border-b text-center w-12">STT</th>
                            <th className="p-3 border-b">Khoản thu</th>
                            <th className="p-3 border-b text-center w-24">Số lượng</th>
                            <th className="p-3 border-b text-center w-20">Đơn vị</th>
                            <th className="p-3 border-b text-right w-40">Đơn giá</th>
                            <th className="p-3 border-b text-right w-40">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {monthlyItems.length > 0 && <tr><td colSpan={6} className="p-2 pl-4 font-bold bg-blue-50 text-blue-800 border-b border-blue-100">I. Các khoản phí hàng tháng</td></tr>}
                        {monthlyItems.map((item, idx) => renderRow(item, idx, false))}

                        {otherItems.length > 0 && <tr><td colSpan={6} className="p-2 pl-4 font-bold bg-orange-50 text-orange-800 border-b border-orange-100 border-t">{monthlyItems.length > 0 ? 'II. Phí phát sinh / Khác' : 'I. Phí phát sinh / Khác'}</td></tr>}
                        {otherItems.map((item, idx) => renderRow(item, idx, true))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 font-bold text-lg border-t-2 border-gray-200">
                            <td colSpan={5} className="p-4 text-right text-gray-700">TỔNG CỘNG:</td>
                            <td className="p-4 text-right text-blue-700">{currentTotal.toLocaleString()} đ</td>
                        </tr>
                        <tr><td colSpan={6} className="p-3 text-right italic text-gray-500 bg-white border-t">(Bằng chữ: {docSoThanhChu(currentTotal)})</td></tr>
                      </tfoot>
                 </table>
             </div>
        </div>
      </div>
    </div>
  );
};

export default RoomBillDetail;