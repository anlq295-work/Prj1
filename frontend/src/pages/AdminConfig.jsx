import React, { useState, useEffect } from 'react';
import { createFee, getFees, toggleFee } from '../api';

export default function AdminConfig() {
  const [fees, setFees] = useState([]);
  const [form, setForm] = useState({ name: '', unit_price: 0, calc_method: 'PER_M2' });

  useEffect(() => { loadFees(); }, []);
  const loadFees = async () => { const res = await getFees(); setFees(res.data); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createFee(form);
    loadFees();
    alert('Đã thêm loại phí mới!');
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Bước 1: Thiết lập biểu phí</h2>
      <form onSubmit={handleSubmit} className="mb-8 border p-4">
        <input placeholder="Tên phí" onChange={e => setForm({...form, name: e.target.value})} className="border p-2 mr-2" />
        <select onChange={e => setForm({...form, calc_method: e.target.value})} className="border p-2 mr-2">
          <option value="PER_M2">Theo m2</option>
          <option value="FLAT">Cố định</option>
          <option value="PER_UNIT">Theo chỉ số</option>
        </select>
        <input type="number" placeholder="Đơn giá" onChange={e => setForm({...form, unit_price: e.target.value})} className="border p-2 mr-2" />
        <button type="submit" className="bg-blue-500 text-white p-2 rounded">Thêm</button>
      </form>
      <ul>
        {fees.map(fee => (
          <li key={fee.id} className="flex justify-between border-b p-2">
            <span>{fee.name} - {fee.unit_price} ({fee.calc_method})</span>
            <button onClick={async () => { await toggleFee(fee.id); loadFees(); }}
              className={`px-2 py-1 rounded ${fee.is_active ? 'bg-green-500 text-white' : 'bg-gray-300'}`}>
              {fee.is_active ? 'Đang áp dụng' : 'Chưa áp dụng'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}