import React, { useState, useEffect } from 'react';
import { getFees, getFeeTypes, createFee, updateFee, deleteFee } from '../api';
import { Trash2, Edit, Plus, Save, X } from 'lucide-react';

const FeeManager = () => {
  const [fees, setFees] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]); // List loại phí (Điện, Nước...)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    fee_type_id: '',
    calc_method: 'FIXED', // FIXED hoặc TIERED
    unit_price: 0,
    tier_config: [{ from: 0, to: '', price: 0 }] // Mặc định 1 bậc
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [resFees, resTypes] = await Promise.all([getFees(), getFeeTypes()]);
      setFees(resFees.data);
      setFeeTypes(resTypes.data);
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    }
  };

  // Xử lý thay đổi input thường
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Xử lý thay đổi cấu hình bậc thang (Tier Config)
  const handleTierChange = (index, field, value) => {
    const newTiers = [...formData.tier_config];
    newTiers[index][field] = value === '' ? '' : parseFloat(value);
    setFormData(prev => ({ ...prev, tier_config: newTiers }));
  };

  const addTier = () => {
    setFormData(prev => ({
      ...prev,
      tier_config: [...prev.tier_config, { from: 0, to: '', price: 0 }]
    }));
  };

  const removeTier = (index) => {
    const newTiers = formData.tier_config.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, tier_config: newTiers }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Chuẩn hóa dữ liệu trước khi gửi
      const payload = {
        ...formData,
        unit_price: formData.calc_method === 'FIXED' ? parseFloat(formData.unit_price) : 0,
        tier_config: formData.calc_method === 'TIERED' ? formData.tier_config : null
      };

      if (editingFee) {
        await updateFee(editingFee.id, payload);
      } else {
        await createFee(payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      alert("Lỗi lưu cấu hình: " + (error.response?.data?.message || error.message));
    }
  };

  const openEdit = (fee) => {
    setEditingFee(fee);
    setFormData({
      name: fee.name,
      fee_type_id: fee.fee_type_id,
      calc_method: fee.calc_method,
      unit_price: fee.unit_price || 0,
      tier_config: fee.tier_config || [{ from: 0, to: '', price: 0 }]
    });
    setIsModalOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Quản lý Cấu hình Phí</h1>
        <button onClick={() => { setEditingFee(null); setIsModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
          <Plus size={18} /> Thêm Mới
        </button>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Tên Cấu Hình</th>
              <th className="p-3 text-left">Loại Phí</th>
              <th className="p-3 text-left">Cách Tính</th>
              <th className="p-3 text-left">Giá Trị</th>
              <th className="p-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {fees.map(fee => (
              <tr key={fee.id} className="border-b">
                <td className="p-3 font-medium">{fee.name}</td>
                <td className="p-3">{fee.FeeType?.name} ({fee.FeeType?.unit})</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${fee.calc_method === 'TIERED' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                    {fee.calc_method === 'TIERED' ? 'Bậc thang' : 'Cố định'}
                  </span>
                </td>
                <td className="p-3">
                  {fee.calc_method === 'FIXED' 
                    ? `${parseInt(fee.unit_price).toLocaleString()} đ` 
                    : `${fee.tier_config?.length || 0} bậc giá`}
                </td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => openEdit(fee)} className="text-blue-600 hover:text-blue-800"><Edit size={18} /></button>
                  <button onClick={async () => { if(confirm('Xóa?')) { await deleteFee(fee.id); loadData(); } }} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl p-6">
            <h2 className="text-xl font-bold mb-4">{editingFee ? 'Sửa Cấu Hình' : 'Thêm Mới'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tên cấu hình</label>
                  <input required name="name" value={formData.name} onChange={handleChange} className="w-full border p-2 rounded" placeholder="VD: Giá điện 2024" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Loại phí gốc</label>
                  <select required name="fee_type_id" value={formData.fee_type_id} onChange={handleChange} className="w-full border p-2 rounded">
                    <option value="">-- Chọn loại phí --</option>
                    {feeTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name} ({type.unit})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Phương pháp tính</label>
                <select name="calc_method" value={formData.calc_method} onChange={handleChange} className="w-full border p-2 rounded">
                  <option value="FIXED">Giá Cố định (Flat)</option>
                  <option value="TIERED">Bậc thang (Lũy tiến)</option>
                </select>
              </div>

              {/* LOGIC NHẬP GIÁ */}
              {formData.calc_method === 'FIXED' ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Đơn giá (VNĐ)</label>
                  <input type="number" name="unit_price" value={formData.unit_price} onChange={handleChange} className="w-full border p-2 rounded" />
                </div>
              ) : (
                <div className="mb-4 border p-3 rounded bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-medium text-sm">Cấu hình Bậc thang</label>
                    <button type="button" onClick={addTier} className="text-blue-600 text-xs flex items-center gap-1">+ Thêm bậc</button>
                  </div>
                  {formData.tier_config.map((tier, index) => (
                    <div key={index} className="flex gap-2 mb-2 items-center">
                      <input type="number" placeholder="Từ số" value={tier.from} onChange={(e) => handleTierChange(index, 'from', e.target.value)} className="w-20 border p-1 rounded text-sm" />
                      <span>-</span>
                      <input type="number" placeholder="Đến (bỏ trống = vô cùng)" value={tier.to} onChange={(e) => handleTierChange(index, 'to', e.target.value)} className="w-40 border p-1 rounded text-sm" />
                      <input type="number" placeholder="Giá tiền" value={tier.price} onChange={(e) => handleTierChange(index, 'price', e.target.value)} className="flex-1 border p-1 rounded text-sm" />
                      <button type="button" onClick={() => removeTier(index)} className="text-red-500"><X size={16} /></button>
                    </div>
                  ))}
                  <p className="text-xs text-gray-500 italic">* Để trống ô "Đến" ở bậc cuối cùng để tính cho tất cả số còn lại.</p>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Lưu cấu hình</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeeManager;