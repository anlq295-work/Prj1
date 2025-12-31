import React, { useState, useEffect } from 'react';
import { Save, Search, Zap, Droplets } from 'lucide-react';
import api from '../api'; // Import api instance

export default function UsageManager() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [month, year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/usage', { params: { month, year } });
      setData(res.data);
    } catch (err) {
      alert('Lỗi tải dữ liệu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (index, field, value) => {
    const newData = [...data];
    newData[index][field] = value;
    setData(newData);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await api.post('/usage', {
        month,
        year,
        data: data // Gửi toàn bộ mảng về server
      });
      alert('Lưu thành công!');
      fetchData(); // Reload để cập nhật trạng thái
    } catch (err) {
      alert('Lỗi khi lưu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter cho ô tìm kiếm
  const filteredData = data.filter(item => 
    item.apartment_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header & Controls */}
      <div className="flex justify-between items-end mb-6 bg-white p-4 rounded-xl shadow-sm">
        <div className="flex gap-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tháng</label>
                <select value={month} onChange={e => setMonth(e.target.value)} className="border p-2 rounded-lg w-24">
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Năm</label>
                <select value={year} onChange={e => setYear(e.target.value)} className="border p-2 rounded-lg w-24">
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                </select>
            </div>
        </div>
        
        <div className="flex gap-3">
            <div className="relative">
                <Search size={18} className="absolute left-3 top-3 text-gray-400"/>
                <input 
                    placeholder="Tìm phòng..." 
                    className="pl-10 p-2 border rounded-lg w-48"
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <button 
                onClick={handleSave} 
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg"
            >
                <Save size={18}/> Lưu Chỉ Số
            </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-800 text-white text-xs uppercase">
                <tr>
                    <th className="p-3 w-24 sticky left-0 bg-slate-800 z-10">Căn Hộ</th>
                    <th className="p-3 border-l border-slate-700 bg-yellow-900"><Zap size={14} className="inline mr-1"/> Điện Cũ</th>
                    <th className="p-3 bg-yellow-900"><Zap size={14} className="inline mr-1"/> Điện Mới</th>
                    <th className="p-3 bg-yellow-800 font-bold text-yellow-100">Tiêu thụ</th>
                    
                    <th className="p-3 border-l border-slate-700 bg-blue-900"><Droplets size={14} className="inline mr-1"/> Nước Cũ</th>
                    <th className="p-3 bg-blue-900"><Droplets size={14} className="inline mr-1"/> Nước Mới</th>
                    <th className="p-3 bg-blue-800 font-bold text-blue-100">Tiêu thụ</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {loading ? <tr><td colSpan="7" className="p-8 text-center">Đang tải...</td></tr> : filteredData.map((row, index) => {
                    // Tìm index thực trong mảng data gốc để update state đúng
                    const realIndex = data.indexOf(row);
                    const elecUsage = (row.new_electric - row.old_electric);
                    const waterUsage = (row.new_water - row.old_water);

                    return (
                        <tr key={row.apartment_code} className="hover:bg-gray-50">
                            <td className="p-3 font-bold text-gray-700 sticky left-0 bg-white border-r">{row.apartment_code}</td>
                            
                            {/* Điện */}
                            <td className="p-2 bg-yellow-50/30">
                                <input type="number" className="w-full border p-1 rounded text-right outline-none focus:ring-1 focus:ring-yellow-500"
                                    value={row.old_electric}
                                    onChange={e => handleInputChange(realIndex, 'old_electric', e.target.value)}
                                />
                            </td>
                            <td className="p-2 bg-yellow-50/30">
                                <input type="number" className="w-full border p-1 rounded text-right font-bold outline-none focus:ring-2 focus:ring-yellow-500"
                                    value={row.new_electric}
                                    onChange={e => handleInputChange(realIndex, 'new_electric', e.target.value)}
                                />
                            </td>
                            <td className={`p-3 text-right font-bold ${elecUsage < 0 ? 'text-red-500' : 'text-gray-800'} bg-yellow-100/50`}>
                                {elecUsage}
                            </td>

                            {/* Nước */}
                            <td className="p-2 bg-blue-50/30">
                                <input type="number" className="w-full border p-1 rounded text-right outline-none focus:ring-1 focus:ring-blue-500"
                                    value={row.old_water}
                                    onChange={e => handleInputChange(realIndex, 'old_water', e.target.value)}
                                />
                            </td>
                            <td className="p-2 bg-blue-50/30">
                                <input type="number" className="w-full border p-1 rounded text-right font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                    value={row.new_water}
                                    onChange={e => handleInputChange(realIndex, 'new_water', e.target.value)}
                                />
                            </td>
                            <td className={`p-3 text-right font-bold ${waterUsage < 0 ? 'text-red-500' : 'text-gray-800'} bg-blue-100/50`}>
                                {waterUsage}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
      </div>
    </div>
  );
}