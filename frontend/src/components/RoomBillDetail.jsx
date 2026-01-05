import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, User, Calendar, Receipt } from 'lucide-react';

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

export default function RoomBillDetail({ roomName, billData }) {
  const [expandedItems, setExpandedItems] = useState({});

  if (!billData) return <div className="p-8 text-center text-gray-500">Đang tải...</div>;

  const { details, month, year, owner_name, total } = billData;

  const toggleExpand = (index) => {
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const getUnit = (name) => {
      const lower = name.toLowerCase();
      if (lower.includes('điện')) return 'kWh';
      if (lower.includes('nước')) return 'm³';
      return '';
  };

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-lg">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 p-6 text-white relative">
        <Receipt className="absolute top-4 right-4 opacity-20" size={100} />
        <div className="relative z-10 flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <FileText className="text-blue-200"/> Hóa Đơn Dịch Vụ
                </h2>
                <div className="flex items-center gap-4 mt-3 text-blue-100 text-sm">
                    <span className="bg-blue-800/50 px-3 py-1 rounded-full flex items-center gap-2"><Calendar size={14}/> T{month}/{year}</span>
                    <span className="flex items-center gap-2"><User size={14}/> {owner_name || 'Chủ hộ'}</span>
                </div>
            </div>
            <div className="text-right">
                <div className="text-xs uppercase opacity-75 mb-1">Căn hộ</div>
                <div className="text-4xl font-extrabold tracking-tight">{roomName}</div>
            </div>
        </div>
      </div>

      {/* BODY */}
      <div className="p-6 bg-gray-50 min-h-[300px]">
        {!details || details.length === 0 ? (
            <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">Chưa có khoản phí nào.</div>
        ) : (
            <div className="space-y-3">
                {details.map((item, index) => {
                    const isTiered = item.tieredDetails && item.tieredDetails.length > 0;
                    return (
                        <div key={index} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                            <div 
                                className={`p-4 flex justify-between items-center ${isTiered ? 'cursor-pointer' : ''}`}
                                onClick={() => isTiered && toggleExpand(index)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isTiered ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
                                        {isTiered ? <Layers size={20}/> : <DollarSign size={20}/>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800">{item.fee_name}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{item.description || 'Phí định kỳ'}</div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="font-bold text-lg text-gray-800">{item.amount?.toLocaleString()} ₫</div>
                                    {isTiered ? (
                                        <div className="text-xs text-blue-600 flex items-center justify-end gap-1 mt-1 font-medium">
                                            {expandedItems[index] ? 'Thu gọn' : 'Chi tiết'} 
                                            {expandedItems[index] ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-400 mt-1">
                                            {item.quantity} x {item.unit_price?.toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {expandedItems[index] && isTiered && (
                                <div className="px-4 pb-4 pt-0">
                                    <TierBreakdown details={item.tieredDetails} unit={getUnit(item.fee_name)} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="bg-white p-5 border-t border-gray-200 flex justify-between items-center">
        <span className="text-gray-500 text-sm font-medium">Tổng thanh toán</span>
        <span className="text-3xl font-bold text-blue-700">{total?.toLocaleString()} ₫</span>
      </div>
    </div>
  );
}

// Icon import helper (nếu thiếu)
import { Layers, DollarSign } from 'lucide-react';