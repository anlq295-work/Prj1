import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, CheckCircle, XCircle, Save, X, Zap, DollarSign, Maximize, Layers } from 'lucide-react';
import api from '../api';

export default function FeeManager() {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // State form
  const [formData, setFormData] = useState({
    name: '',
    calc_method: 'FLAT', // FLAT, PER_M2, PER_UNIT, TIERED (Mới)
    price: '', // Dùng cho các loại phí thường
    unit: '',
    tier_config: [] // Mới: Dùng lưu mảng các bậc giá
  });

  // State tạm để xử lý danh sách bậc giá trên giao diện
  const [tiers, setTiers] = useState([{ limit: '', price: '' }]);

  useEffect(() => {
    fetchFees();
  }, []);

  const fetchFees = async () => {
    try {
      const response = await api.get('/fees');
      const mappedFees = response.data.map(f => ({
        id: f.id,
        name: f.name,
        price: f.unit_price || 0,
        unit: f.unit || (f.name.includes('Điện') ? 'kWh' : f.name.includes('Nước') ? 'm3' : 'tháng'),
        calc_method: f.calc_method,
        tier_config: typeof f.tier_config === 'string' ? JSON.parse(f.tier_config) : f.tier_config, // Parse JSON nếu DB trả về string
        active: f.is_active
      }));
      setFees(mappedFees);
    } catch (error) {
      console.error("Lỗi:", error);
    } finally {
      setLoading(false);
    }
  };

  // Xử lý thay đổi input trong bảng bậc giá
  const handleTierChange = (index, field, value) => {
    const newTiers = [...tiers];
    newTiers[index][field] = value;
    setTiers(newTiers);
  };

  const addTier = () => {
    setTiers([...tiers, { limit: '', price: '' }]);
  };

  const removeTier = (index) => {
    const newTiers = tiers.filter((_, i) => i !== index);
    setTiers(newTiers);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    // Validate logic lũy tiến
    let finalTierConfig = null;
    let finalPrice = parseFloat(formData.price);

    if (formData.calc_method === 'TIERED') {
      // Chuyển đổi tiers từ string sang number
      finalTierConfig = tiers.map(t => ({
        limit: t.limit ? parseFloat(t.limit) : null, // null nghĩa là vô cực (bậc cuối)
        price: parseFloat(t.price)
      }));
      finalPrice = 0; // Với lũy tiến, unit_price cơ bản có thể để 0 hoặc để giá bậc 1 tùy logic backend
    }

    const payload = {
      name: formData.name,
      unit_price: finalPrice,
      calc_method: formData.calc_method,
      tier_config: finalTierConfig, // Gửi cục JSON này về Backend
      type: 'FIXED',
      unit: formData.unit, // Đừng quên gửi unit
      is_active: true
    };

    try {
      if (editingId) {
        await api.put(`/fees/${editingId}`, payload);
        alert('Cập nhật thành công!');
      } else {
        await api.post('/fees', payload);
        alert('Thêm mới thành công!');
      }
      fetchFees();
      closeForm();
    } catch (error) {
      alert('Lỗi: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Xóa loại phí này?')) {
      try {
        await api.delete(`/fees/${id}`);
        fetchFees();
      } catch (error) {
        alert('Lỗi: ' + error.message);
      }
    }
  };

  const handleStartAdd = () => {
    setEditingId(null);
    setFormData({ name: '', calc_method: 'FLAT', price: '', unit: '', tier_config: [] });
    setTiers([{ limit: '', price: '' }]); // Reset tiers
    setIsFormOpen(true);
  };

  const handleStartEdit = (fee) => {
    setEditingId(fee.id);
    setFormData({
      name: fee.name,
      calc_method: fee.calc_method,
      price: fee.price,
      unit: fee.unit,
      tier_config: fee.tier_config || []
    });
    
    // Nếu là lũy tiến, load tiers vào state
    if (fee.calc_method === 'TIERED' && fee.tier_config) {
      setTiers(fee.tier_config);
    } else {
      setTiers([{ limit: '', price: '' }]);
    }
    
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  // Render Badge loại phí
  const renderTypeBadge = (method) => {
    switch (method) {
      case 'TIERED':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200"><Layers size={12} /> Lũy tiến</span>;
      case 'PER_UNIT':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200"><Zap size={12} /> Theo chỉ số</span>;
      case 'PER_M2':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200"><Maximize size={12} /> Theo diện tích</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200"><DollarSign size={12} /> Cố định</span>;
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Cấu hình biểu phí</h2>
        <button onClick={handleStartAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2 shadow transition">
          <Plus size={18} /> Thêm loại phí
        </button>
      </div>

      {/* --- FORM MODAL --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 px-4">
          <form onSubmit={handleSave} className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl border-t-4 border-blue-600 relative max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={closeForm} className="absolute top-4 right-4 text-gray-400 hover:text-red-500"><X size={24} /></button>
            <h3 className="font-bold text-xl mb-6 text-gray-800 flex items-center gap-2">
              {editingId ? <Edit size={24} className="text-blue-600" /> : <Plus size={24} className="text-green-600" />}
              {editingId ? 'Chỉnh sửa phí' : 'Thêm phí mới'}
            </h3>

            <div className="space-y-6">
              {/* CHỌN PHƯƠNG THỨC TÍNH */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Cách tính phí:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  
                  {/* 1. Cố Định */}
                  <div onClick={() => setFormData({ ...formData, calc_method: 'FLAT', unit: 'tháng' })}
                    className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center gap-2 transition ${formData.calc_method === 'FLAT' ? 'bg-gray-100 border-gray-500 ring-1 ring-gray-500' : 'hover:bg-gray-50'}`}>
                    <DollarSign size={20} className="text-gray-600" />
                    <span className="text-xs font-bold">Cố định</span>
                  </div>

                  {/* 2. Theo Diện Tích */}
                  <div onClick={() => setFormData({ ...formData, calc_method: 'PER_M2', unit: 'm2' })}
                    className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center gap-2 transition ${formData.calc_method === 'PER_M2' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'hover:bg-gray-50'}`}>
                    <Maximize size={20} className="text-blue-600" />
                    <span className="text-xs font-bold">Diện tích</span>
                  </div>

                  {/* 3. Theo Chỉ Số (Đơn giản) */}
                  <div onClick={() => setFormData({ ...formData, calc_method: 'PER_UNIT', unit: 'kWh' })}
                    className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center gap-2 transition ${formData.calc_method === 'PER_UNIT' ? 'bg-yellow-50 border-yellow-500 ring-1 ring-yellow-500' : 'hover:bg-gray-50'}`}>
                    <Zap size={20} className="text-yellow-600" />
                    <span className="text-xs font-bold">Chỉ số (đều)</span>
                  </div>

                  {/* 4. Lũy Tiến (MỚI) */}
                  <div onClick={() => setFormData({ ...formData, calc_method: 'TIERED', unit: 'kWh' })}
                    className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center gap-2 transition ${formData.calc_method === 'TIERED' ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-500' : 'hover:bg-gray-50'}`}>
                    <Layers size={20} className="text-purple-600" />
                    <span className="text-xs font-bold">Lũy tiến</span>
                  </div>
                </div>
              </div>

              {/* Tên & Đơn vị */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên loại phí</label>
                  <input required placeholder="VD: Tiền điện sinh hoạt" className="w-full border border-gray-300 p-2.5 rounded-lg outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị tính</label>
                  <input required placeholder="kWh, m3, tháng..." className="w-full border border-gray-300 p-2.5 rounded-lg outline-none" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} />
                </div>
              </div>

              {/* LOGIC NHẬP GIÁ (ĐỔI THEO METHOD) */}
              {formData.calc_method !== 'TIERED' ? (
                // FORM NHẬP GIÁ ĐƠN GIẢN
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.calc_method === 'FLAT' ? 'Số tiền trọn gói' : 'Đơn giá / Tỷ giá'} (VNĐ)
                   </label>
                   <input required type="number" className="w-full border border-gray-300 p-2.5 rounded-lg outline-none font-bold text-gray-700" 
                          value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                </div>
              ) : (
                // FORM NHẬP LŨY TIẾN (DYNAMIC LIST)
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <div className="flex justify-between items-center mb-2">
                     <label className="block text-sm font-bold text-purple-800">Cấu hình bậc thang giá</label>
                     <button type="button" onClick={addTier} className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded hover:bg-purple-300 font-bold">+ Thêm bậc</button>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-10 gap-2 text-xs font-semibold text-gray-500">
                      <div className="col-span-1 text-center">Bậc</div>
                      <div className="col-span-4">Mức sử dụng đến (Max)</div>
                      <div className="col-span-4">Đơn giá (VNĐ)</div>
                      <div className="col-span-1"></div>
                    </div>
                    {tiers.map((tier, index) => (
                      <div key={index} className="grid grid-cols-10 gap-2 items-center">
                        <div className="col-span-1 text-center font-bold text-gray-400">{index + 1}</div>
                        <div className="col-span-4">
                          <input 
                            type="number" 
                            placeholder={index === tiers.length - 1 ? "Không GH (để trống)" : "VD: 50"} 
                            className="w-full border border-gray-300 p-2 rounded text-sm focus:border-purple-500 outline-none"
                            value={tier.limit || ''}
                            onChange={(e) => handleTierChange(index, 'limit', e.target.value)}
                          />
                        </div>
                        <div className="col-span-4">
                          <input 
                            required type="number" 
                            placeholder="Giá bậc này" 
                            className="w-full border border-gray-300 p-2 rounded text-sm font-bold text-gray-700 focus:border-purple-500 outline-none"
                            value={tier.price}
                            onChange={(e) => handleTierChange(index, 'price', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1 text-center">
                           {tiers.length > 1 && (
                             <button type="button" onClick={() => removeTier(index)} className="text-red-400 hover:text-red-600"><XCircle size={18}/></button>
                           )}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500 italic mt-2">* Để trống "Mức sử dụng" ở dòng cuối cùng để tính cho tất cả số lượng còn lại (vô cực).</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-8 border-t pt-4">
              <button type="button" onClick={closeForm} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow flex items-center gap-2">
                <Save size={18} /> Lưu cấu hình
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- BẢNG DANH SÁCH --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold">
            <tr>
              <th className="p-4 border-b">Tên phí</th>
              <th className="p-4 border-b">Cách tính</th>
              <th className="p-4 border-b">Đơn giá / Cấu hình</th>
              <th className="p-4 border-b">Trạng thái</th>
              <th className="p-4 border-b text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fees.map(fee => (
              <tr key={fee.id} className="hover:bg-blue-50 transition-colors">
                <td className="p-4 font-semibold text-gray-800">{fee.name}</td>
                <td className="p-4">
                  {renderTypeBadge(fee.calc_method)}
                </td>
                <td className="p-4 text-gray-800">
                  {fee.calc_method === 'TIERED' ? (
                     <div className="text-sm">
                        <div className="font-bold text-purple-700">
                          {fee.tier_config?.length || 0} bậc giá
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {fee.tier_config && fee.tier_config[0] 
                            ? `Bậc 1: ${new Intl.NumberFormat('vi-VN').format(fee.tier_config[0].price)} đ` 
                            : ''}
                          ...
                        </div>
                     </div>
                  ) : (
                     <div className="font-bold">
                        {new Intl.NumberFormat('vi-VN').format(fee.price)} đ 
                        <span className="text-xs font-normal text-gray-500 ml-1">/ {fee.unit}</span>
                     </div>
                  )}
                </td>
                <td className="p-4">
                  {fee.active ? <span className="text-green-600 text-xs font-bold flex items-center gap-1"><CheckCircle size={14} /> Active</span> : <span className="text-gray-400 text-xs font-bold flex items-center gap-1"><XCircle size={14} /> Inactive</span>}
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => handleStartEdit(fee)} className="text-blue-500 hover:bg-blue-100 p-2 rounded-full mx-1"><Edit size={18} /></button>
                  <button onClick={() => handleDelete(fee.id)} className="text-red-500 hover:bg-red-100 p-2 rounded-full mx-1"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}