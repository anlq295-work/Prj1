import React, { useState } from 'react';
import { searchInv, payInv } from '../api';

export default function ResidentSearch() {
  const [code, setCode] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    const res = await searchInv({ code });
    setResults(res.data);
  };

  const handlePayment = async (id) => {
    if (window.confirm('Thanh toán qua VietQR?')) {
        await payInv(id, 'ONLINE');
        alert('Thanh toán thành công!');
        handleSearch();
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Tra cứu & Thanh toán</h2>
      <div className="mb-4">
        <input placeholder="Nhập mã căn hộ (P101...)" onChange={e => setCode(e.target.value)} className="border p-2 mr-2" />
        <button onClick={handleSearch} className="bg-blue-600 text-white p-2 rounded">Tra cứu</button>
      </div>
      <div>
        {results.map(inv => (
          <div key={inv.id} className="border p-4 mb-4 rounded shadow">
            <div className="flex justify-between font-bold">
              <span>Kỳ: {inv.billing_cycle}</span>
              <span className={inv.status === 'PAID' ? 'text-green-600' : 'text-red-600'}>{inv.status}</span>
            </div>
            <div className="my-2">
                {inv.items && inv.items.map((item, idx) => (
                    <div key={idx} className="text-sm text-gray-700">- {item.fee_name}: {item.amount.toLocaleString()} đ</div>
                ))}
            </div>
            <div className="font-bold text-lg border-t pt-2">Tổng: {inv.total_amount.toLocaleString()} đ</div>
            {inv.status !== 'PAID' && (
                <button onClick={() => handlePayment(inv.id)} className="mt-2 bg-purple-600 text-white w-full p-2 rounded">
                    Thanh toán Online (VietQR)
                </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}