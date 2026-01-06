import React, { useState, useEffect } from 'react';
import { getUsages, saveUsages } from '../api';
import { Save, RefreshCw, AlertCircle, Lock } from 'lucide-react';

const UsageManager = () => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // State
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const maxMonthToShow = (year === currentYear) ? currentMonth : 12;

  // --- LOGIC KHÓA DỮ LIỆU ---
  // Bị khóa nếu: Năm nhỏ hơn năm nay HOẶC (Năm bằng năm nay VÀ Tháng nhỏ hơn tháng hiện tại)
  const isLocked = year < currentYear || (year === currentYear && month < currentMonth);

  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value);
    setYear(newYear);
    if (newYear < currentYear) {
      setMonth(12);
    } else {
      setMonth(currentMonth);
    }
  };

  useEffect(() => {
    fetchData();
  }, [month, year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getUsages(month, year);
      setData(res.data);
    } catch (error) {
      alert("Lỗi tải chỉ số: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (index, field, value) => {
    if (isLocked) return; // Chặn sửa nếu đang khóa
    const newData = [...data];
    newData[index][field] = value === '' ? '' : parseInt(value);
    setData(newData);
  };

  const validateData = () => {
    for (const item of data) {
      // Kiểm tra Điện
      if (item.electric_new !== '' && item.electric_new !== null) {
        if (parseInt(item.electric_new) < parseInt(item.electric_old)) {
          alert(`❌ LỖI: Căn hộ ${item.apartment_code}\nSố điện mới (${item.electric_new}) NHỎ HƠN số điện cũ (${item.electric_old}).`);
          return false;
        }
      }
      // Kiểm tra Nước
      if (item.water_new !== '' && item.water_new !== null) {
        if (parseInt(item.water_new) < parseInt(item.water_old)) {
          alert(`❌ LỖI: Căn hộ ${item.apartment_code}\nSố nước mới (${item.water_new}) NHỎ HƠN số nước cũ (${item.water_old}).`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (isLocked) return;
    if (!validateData()) return;
    try {
      setLoading(true);
      await saveUsages({ month, year, data });
      alert("✅ Đã lưu chỉ số thành công!");
      fetchData();
    } catch (error) {
      alert("Lỗi khi lưu: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const hasError = (oldVal, newVal) => {
    if (newVal === '' || newVal === null) return false;
    return parseInt(newVal) < parseInt(oldVal);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Cập nhật Chỉ Số Điện Nước</h1>
        
        <div className="flex gap-2">
           <select 
                value={month} 
                onChange={e => setMonth(parseInt(e.target.value))} 
                className="border p-2 rounded bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
                {[...Array(maxMonthToShow)].map((_, i) => {
                    const monthValue = maxMonthToShow - i;
                    return <option key={monthValue} value={monthValue}>Tháng {monthValue}</option>;
                })}
            </select>

            <select 
                value={year} 
                onChange={handleYearChange} 
                className="border p-2 rounded bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                ))}
            </select>

          <button onClick={fetchData} className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-2 border">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span className="hidden md:inline">Làm mới</span>
          </button>
          
          {/* NÚT LƯU: Ẩn nếu bị khóa */}
          {!isLocked && (
            <button 
                onClick={handleSave} 
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 shadow-sm font-medium disabled:bg-blue-300"
            >
                <Save size={18} /> Lưu Chỉ Số
            </button>
          )}
        </div>
      </div>

      {/* THÔNG BÁO NẾU ĐANG KHÓA */}
      {isLocked && (
        <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded text-gray-600 flex items-center gap-2">
            <Lock size={20} />
            <span>Dữ liệu tháng <strong>{month}/{year}</strong> đã qua nên không thể chỉnh sửa.</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-2 w-24 font-semibold text-gray-700 sticky left-0 bg-gray-50 z-20 border-r text-center">Căn hộ</th>
                <th className="p-4 text-center bg-yellow-100 text-yellow-800 border-r" colSpan={2}>⚡ ĐIỆN (kWh)</th>
                <th className="p-4 text-center bg-blue-100 text-blue-800" colSpan={2}>💧 NƯỚC (m3)</th>
              </tr>
              <tr className="text-xs uppercase text-gray-500 font-bold bg-gray-100">
                <th className="p-2 w-24 sticky left-0 bg-gray-100 z-20 border-r"></th>
                <th className="p-2 text-center border-r w-32">Số cũ</th>
                <th className="p-2 text-center border-r w-32">Số mới</th>
                <th className="p-2 text-center border-r w-32">Số cũ</th>
                <th className="p-2 text-center w-32">Số mới</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && data.length === 0 ? (
                <tr><td colSpan="5" className="p-10 text-center text-gray-500">Đang tải dữ liệu...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="5" className="p-10 text-center text-gray-400 italic">Không có dữ liệu căn hộ.</td></tr>
              ) : (
                data.map((item, index) => (
                  <tr key={item.apartment_id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-2 w-24 font-bold text-gray-700 sticky left-0 bg-white border-r z-10 text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        {item.apartment_code}
                    </td>
                    
                    {/* CỘT ĐIỆN */}
                    <td className="p-2 text-center bg-yellow-50/50 border-r text-gray-500 font-mono">
                        {item.electric_old}
                    </td>
                    <td className={`p-2 bg-yellow-50/30 border-r ${isLocked ? 'bg-gray-100' : ''}`}>
                        <input 
                            type="number" 
                            disabled={isLocked} // Khóa input
                            className={`w-full border p-2 rounded text-center font-bold focus:ring-2 outline-none transition-all
                                ${isLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : ''}
                                ${!isLocked && hasError(item.electric_old, item.electric_new) 
                                    ? 'border-red-500 bg-red-50 text-red-600 focus:ring-red-400' 
                                    : !isLocked ? 'border-gray-300 focus:ring-yellow-400 focus:border-yellow-400' : ''
                                }`}
                            placeholder={isLocked ? '-' : '...'}
                            value={item.electric_new === 0 && item.electric_new !== '' ? '0' : (item.electric_new || '')} 
                            onChange={(e) => handleInputChange(index, 'electric_new', e.target.value)}
                            onWheel={(e) => e.target.blur()}
                        />
                    </td>

                    {/* CỘT NƯỚC */}
                    <td className="p-2 text-center bg-blue-50/50 border-r text-gray-500 font-mono">
                        {item.water_old}
                    </td>
                    <td className={`p-2 bg-blue-50/30 ${isLocked ? 'bg-gray-100' : ''}`}>
                        <input 
                            type="number" 
                            disabled={isLocked} // Khóa input
                            className={`w-full border p-2 rounded text-center font-bold focus:ring-2 outline-none transition-all
                                ${isLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : ''}
                                ${!isLocked && hasError(item.water_old, item.water_new) 
                                    ? 'border-red-500 bg-red-50 text-red-600 focus:ring-red-400' 
                                    : !isLocked ? 'border-gray-300 focus:ring-blue-400 focus:border-blue-400' : ''
                                }`}
                            placeholder={isLocked ? '-' : '...'}
                            value={item.water_new === 0 && item.water_new !== '' ? '0' : (item.water_new || '')} 
                            onChange={(e) => handleInputChange(index, 'water_new', e.target.value)}
                            onWheel={(e) => e.target.blur()}
                        />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        {!isLocked && (
            <div className="p-4 bg-gray-50 border-t text-sm text-gray-500 flex gap-4 items-center">
                <div className="flex items-center gap-1"><AlertCircle size={16}/> Lưu ý:</div>
                <div>Số mới phải lớn hơn hoặc bằng số cũ.</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-50 border border-red-500 block"></span> Ô bị lỗi</div>
            </div>
        )}
      </div>
    </div>
  );
};

export default UsageManager;