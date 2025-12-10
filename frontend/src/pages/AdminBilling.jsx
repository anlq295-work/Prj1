import React, { useState } from 'react';
import { generateInv, searchInv, publishInv } from '../api';

export default function AdminBilling() {
  const [cycle, setCycle] = useState('09/2025');
  const [invoices, setInvoices] = useState([]);

  const handleGenerate = async () => {
    await generateInv(cycle);
    alert('Đã tính toán xong. Kiểm tra danh sách nháp.');
    loadDrafts();
  };

  const loadDrafts = async () => {
    const res = await searchInv({ cycle });
    setInvoices(res.data);
  };

  const handlePublish = async () => {
    await publishInv(cycle);
    alert('Đã phát hành hóa đơn!');
    loadDrafts();
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Bước 2 & 3: Tính toán và Phát hành</h2>
      <div className="flex gap-4 mb-4">
        <input value={cycle} onChange={e => setCycle(e.target.value)} className="border p-2" />
        <button onClick={handleGenerate} className="bg-yellow-500 text-white p-2 rounded">1. Tạo Nháp</button>
        <button onClick={handlePublish} className="bg-green-600 text-white p-2 rounded">2. Phát Hành</button>
      </div>
      <table className="w-full border mt-2">
        <thead><tr className="bg-gray-200"><th>Căn hộ</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {invoices.map(inv => (
            <tr key={inv.id} className="text-center border-t">
              <td className="p-2">{inv.apartment_code}</td>
              <td>{inv.total_amount.toLocaleString()} đ</td>
              <td className={inv.status === 'PENDING' ? 'text-red-500' : 'text-gray-500'}>{inv.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}