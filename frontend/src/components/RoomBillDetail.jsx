// src/components/RoomBillDetail.js
import React from 'react';
import { FileText, User, Calendar, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';

export default function RoomBillDetail({ roomName, billData }) {
  // billData bao gồm: total, details (mảng InvoiceItems), month, year, owner_name...

  const { total, details } = billData;

  // Format tiền tệ
  const fmt = (num) => new Intl.NumberFormat('vi-VN').format(num);

  return (
    <div className="bg-white rounded-lg overflow-hidden">
      {/* HEADER */}
      <div className="bg-blue-600 p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileText /> Hóa đơn tiền nhà
            </h2>
            <p className="opacity-80 mt-1">Chi tiết các khoản thu trong tháng</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{roomName}</div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="p-6">
        {/* Bảng chi tiết */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 font-bold uppercase">
              <tr>
                <th className="p-3 border-b">Khoản thu</th>
                <th className="p-3 border-b text-center">SL</th>
                <th className="p-3 border-b text-right">Đơn giá</th>
                <th className="p-3 border-b text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!details || details.length === 0 ? (
                 <tr><td colSpan="4" className="p-4 text-center text-gray-500 italic">Chưa có khoản phí nào.</td></tr>
              ) : (
                details.map((item, idx) => (
                  <React.Fragment key={idx}>
                    {/* Dòng chính */}
                    <tr className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-bold text-gray-800">{item.fee_name}</div>
                        <div className="text-xs text-gray-500 italic">{item.description}</div>
                      </td>
                      <td className="p-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="p-3 text-right text-gray-600">{fmt(item.unit_price)}</td>
                      <td className="p-3 text-right font-bold text-gray-800">{fmt(item.amount)}</td>
                    </tr>

                    {/* Dòng phụ: Nếu có chi tiết bậc thang (tieredDetails) */}
                    {item.tieredDetails && Array.isArray(item.tieredDetails) && item.tieredDetails.length > 0 && (
                      <tr className="bg-gray-50">
                        <td colSpan="4" className="p-2 pl-8">
                          <div className="text-xs text-gray-500 border-l-2 border-gray-300 pl-2">
                            {item.tieredDetails.map((tier, tIdx) => (
                              <div key={tIdx} className="flex justify-between w-64 py-0.5">
                                <span>Bậc {tier.tierIndex} ({fmt(tier.usage)} số x {fmt(tier.price)}):</span>
                                <span className="font-medium">{fmt(tier.cost)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
            {/* FOOTER TỔNG */}
            <tfoot className="bg-blue-50">
              <tr>
                <td colSpan="3" className="p-4 text-right font-bold text-gray-600 uppercase">Tổng cộng phải thu:</td>
                <td className="p-4 text-right font-bold text-blue-700 text-xl">{fmt(total)} đ</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}