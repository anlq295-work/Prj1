import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';

// Component con để hiển thị chi tiết các bậc thang (nếu có)
const TierBreakdown = ({ details, unit }) => {
  if (!details) return null;
  return (
    <div className="bg-gray-50 p-3 rounded mt-2 text-sm border border-gray-200">
      <div className="grid grid-cols-3 font-bold text-gray-500 mb-1 border-b pb-1">
        <span>Bậc</span>
        <span className="text-center">Sử dụng ({unit})</span>
        <span className="text-right">Thành tiền</span>
      </div>
      {details.map((d, i) => (
        <div key={i} className="grid grid-cols-3 py-1 text-gray-700">
          <span>Bậc {d.tierIndex} <span className="text-xs text-gray-400">({d.price.toLocaleString()}đ)</span></span>
          <span className="text-center">{d.usage}</span>
          <span className="text-right font-medium">{d.cost.toLocaleString()} đ</span>
        </div>
      ))}
    </div>
  );
};

export default function RoomBillDetail({ roomName, billData }) {
  // billData là dữ liệu trả về từ hàm calculateRoomBill ở backend
  // Ví dụ: { total: 1500000, details: [...] }
  
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!billData) return <div>Đang tính toán...</div>;

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6 border-b pb-4">
        <div className="bg-blue-100 p-3 rounded-full text-blue-600">
            <FileText size={24}/>
        </div>
        <div>
            <h2 className="text-xl font-bold text-gray-800">Chi tiết khoản thu</h2>
            <p className="text-gray-500">Phòng: <span className="font-bold text-blue-600">{roomName}</span></p>
        </div>
      </div>

      <div className="space-y-4">
        {billData.details.map((item, index) => (
          <div key={index} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div 
              className="flex justify-between items-center cursor-pointer"
              onClick={() => item.tieredDetails && toggleExpand(index)}
            >
              <div>
                <h4 className="font-bold text-gray-800">{item.fee_name}</h4>
                <p className="text-sm text-gray-500">{item.note}</p>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg text-blue-600">
                  {item.amount.toLocaleString()} đ
                </div>
                {/* Nếu có chi tiết bậc thang thì hiện mũi tên */}
                {item.tieredDetails && (
                  <button className="text-xs text-gray-400 flex items-center gap-1 ml-auto mt-1 hover:text-blue-500">
                    {expandedItems[index] ? 'Thu gọn' : 'Chi tiết'} 
                    {expandedItems[index] ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                  </button>
                )}
              </div>
            </div>

            {/* Hiển thị bảng chi tiết bậc thang nếu đang expand */}
            {expandedItems[index] && item.tieredDetails && (
              <TierBreakdown details={item.tieredDetails} unit={item.fee_name.includes('điện') ? 'kWh' : 'm3'} />
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center bg-gray-50 p-4 rounded-lg">
        <span className="text-lg font-bold text-gray-700">TỔNG CỘNG</span>
        <span className="text-2xl font-bold text-red-600">
          {billData.total.toLocaleString()} đ
        </span>
      </div>
    </div>
  );
}