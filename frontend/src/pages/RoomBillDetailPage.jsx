import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, User, Calendar, Receipt } from 'lucide-react';

// --- COMPONENT CON: CHI TIẾT BẬC THANG ---
const TierBreakdown = ({ details, unit }) => {
  if (!details || !Array.isArray(details)) return null;
  
  return (
    <div className="bg-slate-50 p-3 rounded-lg mt-3 text-sm border border-slate-200 animate-in slide-in-from-top-2 duration-200">
      <div className="grid grid-cols-10 font-bold text-slate-500 mb-2 border-b border-slate-200 pb-2 text-xs uppercase tracking-wide">
        <span className="col-span-2">Bậc</span>
        <span className="col-span-3 text-right">Đơn giá</span>
        <span className="col-span-2 text-center">Sử dụng</span>
        <span className="col-span-3 text-right">Thành tiền</span>
      </div>
      {details.map((d, i) => (
        <div key={i} className="grid grid-cols-10 py-1.5 text-slate-700 border-b border-slate-100 last:border-0">
          <span className="col-span-2 font-medium">Bậc {d.tierIndex}</span>
          <span className="col-span-3 text-right text-slate-500">{d.price?.toLocaleString()} đ</span>
          <span className="col-span-2 text-center font-bold bg-white rounded border border-slate-100 mx-1">
            {d.usage} <span className="text-[10px] text-slate-400 font-normal">{unit}</span>
          </span>
          <span className="col-span-3 text-right font-medium text-blue-700">{d.cost?.toLocaleString()} đ</span>
        </div>
      ))}
    </div>
  );
};

// --- COMPONENT CHÍNH ---
export default function RoomBillDetail({ roomName, billData }) {
  // billData bao gồm: total, details, month, year, owner_name
  
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpand = (index) => {
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  if (!billData) return <div className="p-8 text-center text-gray-500">Đang tải dữ liệu hóa đơn...</div>;

  const { details, month, year, owner_name, total } = billData;

  // Helper để đoán đơn vị tính cho bậc thang
  const getUnit = (name) => {
      const lowerName = name.toLowerCase();
      if (lowerName.includes('điện')) return 'kWh';
      if (lowerName.includes('nước')) return 'm³';
      return '';
  };

  return (
    <div className="bg-white rounded-xl overflow-hidden">
      
      {/* 1. HEADER HÓA ĐƠN */}
      <div className="bg-blue-600 p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <Receipt size={120} />
        </div>
        <div className="relative z-10 flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <FileText className="text-blue-200"/> Hóa đơn Tiền Nhà
                </h2>
                <div className="flex items-center gap-4 mt-2 text-blue-100 text-sm">
                    <span className="flex items-center gap-1 bg-blue-700 px-2 py-1 rounded"><Calendar size={14}/> Tháng {month}/{year}</span>
                    <span className="flex items-center gap-1"><User size={14}/> {owner_name || 'Chưa cập nhật chủ hộ'}</span>
                </div>
            </div>
            <div className="text-right">
                <div className="text-sm opacity-80 uppercase tracking-wider">Căn hộ</div>
                <div className="text-4xl font-bold">{roomName}</div>
            </div>
        </div>
      </div>

      {/* 2. DANH SÁCH KHOẢN THU */}
      <div className="p-6 space-y-4 bg-gray-50 min-h-[300px]">
        {(!details || details.length === 0) ? (
            <div className="text-center py-10 text-gray-400 italic border-2 border-dashed border-gray-200 rounded-lg">
                Chưa có khoản phí nào được khởi tạo.
            </div>
        ) : (
            details.map((item, index) => {
                const isTiered = item.tieredDetails && item.tieredDetails.length > 0;
                
                return (
                    <div key={index} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
                        <div 
                            className={`p-4 flex justify-between items-center ${isTiered ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                            onClick={() => isTiered && toggleExpand(index)}
                        >
                            {/* Cột Trái: Tên & Mô tả */}
                            <div className="flex items-start gap-3">
                                <div className={`mt-1 w-2 h-2 rounded-full ${isTiered ? 'bg-purple-500' : 'bg-green-500'}`}></div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-base">{item.fee_name}</h4>
                                    <div className="text-sm text-gray-500 mt-0.5">
                                        {item.description || 'Phí quy định'}
                                    </div>
                                    
                                    {/* Nếu không phải bậc thang thì hiện công thức tính: SL x Đơn giá */}
                                    {!isTiered && (
                                        <div className="text-xs text-gray-400 mt-1 bg-gray-100 inline-block px-2 py-0.5 rounded">
                                            {item.quantity} x {item.unit_price?.toLocaleString()} đ
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Cột Phải: Thành tiền & Nút mở rộng */}
                            <div className="text-right">
                                <div className="font-bold text-lg text-gray-800">
                                    {item.amount?.toLocaleString()} đ
                                </div>
                                
                                {isTiered && (
                                    <button className="text-xs text-blue-600 font-medium flex items-center gap-1 ml-auto mt-1 hover:underline">
                                        {expandedItems[index] ? 'Ẩn chi tiết' : 'Xem bậc thang'} 
                                        {expandedItems[index] ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Bảng chi tiết bậc thang (Collapse) */}
                        {expandedItems[index] && isTiered && (
                            <div className="px-4 pb-4 bg-white">
                                <TierBreakdown details={item.tieredDetails} unit={getUnit(item.fee_name)} />
                            </div>
                        )}
                    </div>
                );
            })
        )}
      </div>

      {/* 3. TỔNG CỘNG FOOTER */}
      <div className="bg-white border-t p-4 flex justify-between items-center">
        <div className="text-gray-500 text-sm">
            Tổng cộng ({details?.length || 0} khoản)
        </div>
        <div className="text-right">
            <span className="block text-xs text-gray-400 uppercase font-bold">Thanh toán</span>
            <span className="text-2xl font-bold text-blue-700">
                {total?.toLocaleString()} đ
            </span>
        </div>
      </div>
    </div>
  );
}