import React, { useState, useEffect } from 'react';
import { getFees, getFeeTypes, createFee, updateFee, deleteFee } from '../api';
import { Trash2, Edit, Plus, X, Search, Filter, Save, ToggleLeft, ToggleRight } from 'lucide-react'; // Thêm Toggle icons

const FeeManager = () => {
  // --- STATE ---
  const [fees, setFees] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState(null);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMethod, setFilterMethod] = useState('');

  // Form State (Thêm trường is_active)
  const [formData, setFormData] = useState({
    name: '',
    category: '', 
    unit: '', 
    calc_method: 'FIXED',
    unit_price: 0,
    is_active: true, // Mặc định là bật
    tier_config: [{ from: 0, to: '', price: 0 }]
  });

  // --- EFFECT ---
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [resFees, resTypes] = await Promise.all([getFees(), getFeeTypes()]);
      setFees(resFees.data || []);
      setFeeTypes(resTypes.data || []);
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    }
  };

  // --- FILTER LOGIC ---
  const filteredFees = fees.filter(fee => {
    const matchName = fee.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = filterCategory ? fee.category === filterCategory : true;
    const matchMethod = filterMethod ? fee.calc_method === filterMethod : true;
    return matchName && matchCategory && matchMethod;
  });

  // --- HANDLERS ---
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    // Xử lý riêng cho checkbox
    const val = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleCategoryChange = (e) => {
    const selectedCatId = e.target.value;
    const selectedType = feeTypes.find(t => t.id === selectedCatId);
    
    setFormData(prev => ({
        ...prev,
        category: selectedCatId,
        unit: selectedType ? selectedType.unit : '' 
    }));
  };

  const handleTierChange = (index, field, value) => {
    const newTiers = [...formData.tier_config];
    newTiers[index][field] = value === '' ? '' : parseFloat(value);
    setFormData(prev => ({ ...prev, tier_config: newTiers }));
  };

  const addTier = () => {
    setFormData(prev => ({ ...prev, tier_config: [...prev.tier_config, { from: 0, to: '', price: 0 }] }));
  };

  const removeTier = (index) => {
    const newTiers = formData.tier_config.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, tier_config: newTiers }));
  };

  // [MỚI] Hàm bật tắt nhanh trạng thái ngay trên bảng
  const handleToggleStatus = async (fee) => {
      try {
          // Gọi API update chỉ cập nhật trường is_active
          await updateFee(fee.id, { is_active: !fee.is_active });
          // Load lại dữ liệu để cập nhật giao diện
          loadData();
      } catch (error) {
          alert("Lỗi cập nhật trạng thái: " + error.message);
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        unit: formData.unit, 
        calc_method: formData.calc_method,
        unit_price: formData.calc_method === 'FIXED' ? parseFloat(formData.unit_price) : 0,
        tier_config: formData.calc_method === 'TIERED' ? formData.tier_config : null,
        is_active: formData.is_active // Gửi trạng thái lên server
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
      category: fee.category,
      unit: fee.unit || '',
      calc_method: fee.calc_method,
      unit_price: fee.unit_price || 0,
      tier_config: fee.tier_config || [{ from: 0, to: '', price: 0 }],
      is_active: fee.is_active // Load trạng thái cũ
    });
    setIsModalOpen(true);
  };

  const openAdd = () => {
      setEditingFee(null);
      setFormData({
          name: '', category: '', unit: '', 
          calc_method: 'FIXED', unit_price: 0, 
          tier_config: [{from:0, to:'', price:0}],
          is_active: true // Mặc định khi thêm mới là Active
      });
      setIsModalOpen(true);
  };

  const getCategoryDisplay = (catId) => {
      const found = feeTypes.find(t => t.id === catId);
      return found ? found.name : catId;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Cấu hình Phí</h1>
        <button 
          onClick={openAdd} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow flex items-center gap-2 transition-colors"
        >
          <Plus size={18} /> Thêm Mới
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-wrap gap-4 items-center border border-gray-100">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" placeholder="Tìm kiếm tên phí..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        <div className="relative min-w-[180px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer">
                <option value="">-- Tất cả loại phí --</option>
                {feeTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                ))}
            </select>
        </div>

        <div className="min-w-[180px]">
            <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer">
                <option value="">-- Tất cả cách tính --</option>
                <option value="FIXED">Giá Cố định</option>
                <option value="TIERED">Bậc thang</option>
            </select>
        </div>
        
        {(searchTerm || filterCategory || filterMethod) && (
            <button onClick={() => { setSearchTerm(''); setFilterCategory(''); setFilterMethod(''); }} className="text-gray-500 hover:text-red-500 text-sm font-medium underline transition-colors">
                Xóa lọc
            </button>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 text-gray-700 uppercase text-xs tracking-wider border-b">
            <tr>
              <th className="p-4 text-left font-semibold">Tên Cấu Hình</th>
              <th className="p-4 text-left font-semibold">Loại Phí & Đơn Vị</th>
              <th className="p-4 text-left font-semibold">Cách Tính</th>
              <th className="p-4 text-left font-semibold">Chi Tiết Giá</th>
              {/* CỘT MỚI: TRẠNG THÁI */}
              <th className="p-4 text-center font-semibold">Trạng thái</th>
              <th className="p-4 text-right font-semibold">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredFees.length > 0 ? (
                filteredFees.map(fee => (
                <tr key={fee.id} className={`hover:bg-blue-50 transition-colors ${!fee.is_active ? 'opacity-60 bg-gray-50' : ''}`}>
                    <td className="p-4 font-medium text-gray-900">
                        {fee.name}
                        {!fee.is_active && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Đã tắt</span>}
                    </td>
                    <td className="p-4 text-gray-600">
                        <div className="flex flex-col">
                            <span className="font-medium text-gray-800">{getCategoryDisplay(fee.category)}</span>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded w-fit mt-1">
                                Đơn vị: {fee.unit || 'N/A'}
                            </span>
                        </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        fee.calc_method === 'TIERED' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-green-100 text-green-700 border border-green-200'
                      }`}>
                          {fee.calc_method === 'TIERED' ? 'Bậc thang' : 'Cố định'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700 font-mono text-sm">
                      {fee.calc_method === 'TIERED' ? (
                          `${fee.tier_config?.length || 0} bậc giá`
                      ) : (
                          fee.category === 'OTHER' 
                            ? <span className="text-gray-500 italic font-sans bg-gray-100 px-2 py-1 rounded">Tùy chỉnh</span>
                            : `${parseInt(fee.unit_price).toLocaleString('vi-VN')} đ / ${fee.unit}`
                      )}
                    </td>
                    
                    {/* CỘT NÚT SWITCH */}
                    <td className="p-4 text-center">
                        <button 
                            onClick={() => handleToggleStatus(fee)}
                            className="focus:outline-none transition-transform active:scale-95"
                            title={fee.is_active ? "Nhấn để Tắt" : "Nhấn để Bật"}
                        >
                            {fee.is_active ? (
                                <ToggleRight size={32} className="text-green-600" />
                            ) : (
                                <ToggleLeft size={32} className="text-gray-400" />
                            )}
                        </button>
                    </td>

                    <td className="p-4 text-right space-x-3">
                      <button onClick={() => openEdit(fee)} className="text-blue-600 hover:text-blue-800 transition-colors"><Edit size={18} /></button>
                      <button onClick={async () => { if(confirm('Xóa cấu hình này?')) { await deleteFee(fee.id); loadData(); } }} className="text-red-500 hover:text-red-700 transition-colors"><Trash2 size={18} /></button>
                    </td>
                </tr>
                ))
            ) : (
                <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                          <Search size={48} className="text-gray-300 mb-2" />
                          <p>Không tìm thấy dữ liệu.</p>
                        </div>
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-2xl transform transition-all scale-100">
            <div className="flex justify-between items-center mb-5 border-b pb-3">
               <h2 className="text-xl font-bold text-gray-800">{editingFee ? 'Sửa Cấu Hình' : 'Thêm Cấu Hình Mới'}</h2>
               <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              
              {/* Switch kích hoạt trong form */}
              <div className="mb-4 flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <span className="font-medium text-blue-900">Trạng thái hoạt động</span>
                  <label className="flex items-center cursor-pointer">
                      <input 
                          type="checkbox" 
                          name="is_active" 
                          checked={formData.is_active} 
                          onChange={handleChange} 
                          className="sr-only peer"
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ms-3 text-sm font-medium text-gray-700">
                          {formData.is_active ? 'Đang bật' : 'Đang tắt'}
                      </span>
                  </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên cấu hình <span className="text-red-500">*</span></label>
                  <input required name="name" value={formData.name} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="VD: Giá điện 2024" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại phí gốc <span className="text-red-500">*</span></label>
                  <select required name="category" value={formData.category} onChange={handleCategoryChange} className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">-- Chọn loại phí --</option>
                    {feeTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name} ({type.unit})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phương pháp tính</label>
                    <select name="calc_method" value={formData.calc_method} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="FIXED">Giá Cố định (Flat)</option>
                        <option value="TIERED">Bậc thang (Lũy tiến)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị tính (Tự động)</label>
                    <input disabled name="unit" value={formData.unit} className="w-full border border-gray-200 bg-gray-100 p-2 rounded text-gray-500 cursor-not-allowed" />
                  </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                {formData.calc_method === 'FIXED' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Đơn giá (VNĐ)</label>
                    <input 
                        type="number" 
                        name="unit_price" 
                        value={formData.unit_price} 
                        onChange={handleChange} 
                        disabled={formData.category === 'OTHER'} 
                        className={`w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none ${formData.category === 'OTHER' ? 'bg-gray-100 text-gray-500' : ''}`} 
                        placeholder={formData.category === 'OTHER' ? "Nhập khi tạo hóa đơn" : "VD: 5000"} 
                    />
                    {formData.category === 'OTHER' && <p className="text-xs text-gray-500 mt-1 italic">* Giá của "Phí khác" sẽ được nhập cụ thể khi tạo khoản thu cho từng căn hộ.</p>}
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="font-medium text-sm text-gray-700">Cấu hình Bậc thang</label>
                      <button type="button" onClick={addTier} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"><Plus size={16} /> Thêm bậc</button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {formData.tier_config.map((tier, index) => (
                        <div key={index} className="flex gap-2 items-center bg-white p-2 rounded border border-gray-200 shadow-sm">
                          <div className="flex-1 flex gap-2 items-center">
                             <input type="number" placeholder="Từ" value={tier.from} onChange={(e) => handleTierChange(index, 'from', e.target.value)} className="w-20 border p-1.5 rounded text-sm outline-none focus:border-blue-500" />
                             <span className="text-gray-400">-</span>
                             <input type="number" placeholder="Đến" value={tier.to} onChange={(e) => handleTierChange(index, 'to', e.target.value)} className="w-28 border p-1.5 rounded text-sm outline-none focus:border-blue-500" />
                          </div>
                          <div className="flex items-center gap-2">
                             <span className="text-sm text-gray-500">Giá:</span>
                             <input type="number" placeholder="VNĐ" value={tier.price} onChange={(e) => handleTierChange(index, 'price', e.target.value)} className="w-24 border p-1.5 rounded text-sm outline-none focus:border-blue-500 font-medium text-right" />
                          </div>
                          <button type="button" onClick={() => removeTier(index)} className="text-gray-400 hover:text-red-500 p-1"><X size={18} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium">Hủy bỏ</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-colors font-medium flex items-center gap-2"><Save size={18} /> Lưu Cấu Hình</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeeManager;