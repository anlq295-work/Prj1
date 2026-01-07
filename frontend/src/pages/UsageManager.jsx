import React, { useState, useEffect } from 'react';
import { getUsages, saveUsages } from '../api';
import { Save, RefreshCw, AlertCircle, Lock, Bug } from 'lucide-react';

const UsageManager = () => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // State
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Chế độ Debug (Ẩn, dùng phím tắt)
  const [debugMode, setDebugMode] = useState(false);

  // Logic khóa dữ liệu
  const isTimeLocked = year < currentYear || (year === currentYear && month < currentMonth);
  const isLocked = isTimeLocked && !debugMode;

  const maxMonthToShow = (year === currentYear) ? currentMonth : 12;

  // --- 1. PHÍM TẮT DEBUG (Ctrl + Shift + D) ---
  useEffect(() => {
    const handleKeyDown = (event) => {
        if (event.ctrlKey && event.shiftKey && (event.key === 'D' || event.key === 'd')) {
            event.preventDefault();
            setDebugMode(prev => {
                const newState = !prev;
                alert(newState 
                    ? "🔓 DEBUG MODE: ON\n- Đã mở khóa chỉnh sửa cho các tháng quá khứ." 
                    : "🔒 DEBUG MODE: OFF"
                );
                return newState;
            });
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      
      const processedData = res.data.map(item => ({
          ...item,
          // Mặc định số mới bằng số cũ nếu chưa nhập
          electric_new: item.electric_new !== null ? item.electric_new : item.electric_old,
          water_new: item.water_new !== null ? item.water_new : item.water_old
      }));

      setData(processedData);
    } catch (error) {
      alert("Lỗi tải chỉ số: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (index, field, value) => {
    if (isLocked) return;

    // [MỚI] CHẶN SỐ ÂM NGAY TẠI ĐÂY
    if (value !== '' && parseInt(value) < 0) return;

    const newData = [...data];
    newData[index][field] = value === '' ? '' : parseInt(value);
    setData(newData);
  };

  // --- XỬ LÝ ĐỒNG HỒ QUAY VÒNG (Số Mới < Số Cũ) ---
  const validateData = () => {
    let rolloverList = []; // Danh sách các căn nghi ngờ quay vòng
    let errorList = [];    // Danh sách lỗi logic khác (nếu có)

    data.forEach(item => {
        // Hàm check nội bộ
        const check = (oldVal, newVal, type) => {
            if (newVal !== '' && newVal !== null && oldVal !== null) {
                if (parseInt(newVal) < parseInt(oldVal)) {
                    rolloverList.push(`${item.apartment_code} (${type}: ${oldVal} -> ${newVal})`);
                }
            }
        };

        check(item.electric_old, item.electric_new, 'Điện');
        check(item.water_old, item.water_new, 'Nước');
    });

    // Nếu có trường hợp số mới < số cũ
    if (rolloverList.length > 0) {
        const msg = 
            "PHÁT HIỆN ĐỒNG HỒ QUAY VÒNG (SỐ MỚI < SỐ CŨ)\n\n" +
            "Các căn hộ sau có chỉ số mới nhỏ hơn chỉ số cũ:\n" + 
            rolloverList.join("\n") + 
            "\n\n- Nhấn OK: Xác nhận đây là đồng hồ quay vòng (Hệ thống sẽ tự tính bù).\n" + 
            "- Nhấn Cancel: Để kiểm tra lại số liệu nhập.";
        
        return window.confirm(msg);
    }

    return true;
  };

  const handleSave = async () => {
    if (isLocked) return;
    if (!validateData()) return; 

    if (debugMode && isTimeLocked) {
        if (!window.confirm("⚠️ CẢNH BÁO DEBUG:\nBạn đang sửa dữ liệu của tháng đã qua/đã chốt.\nViệc này có thể làm sai lệch hóa đơn đã in.\nTiếp tục lưu?")) return;
    }

    try {
      setLoading(true);
      await saveUsages({ month, year, data, debug: debugMode });
      alert("✅ Đã lưu chỉ số thành công!");
      fetchData();
    } catch (error) {
      alert("Lỗi khi lưu: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Helper check lỗi hiển thị đỏ
  const hasError = (oldVal, newVal) => {
    if (newVal === '' || newVal === null) return false;
    return parseInt(newVal) < parseInt(oldVal);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                Cập nhật Chỉ Số Điện Nước
                {debugMode && <Bug size={16} className="text-purple-600 animate-pulse" title="Debug Mode Active" />}
            </h1>
            {isTimeLocked && (
                <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm font-bold text-red-600 bg-red-100 px-2 py-1 rounded flex items-center gap-1">
                        <Lock size={14}/> Đã khóa sổ
                    </span>
                    {debugMode && <span className="text-xs text-purple-600 font-bold border border-purple-200 px-1 rounded">UNLOCKED</span>}
                </div>
            )}
        </div>
        
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
          
          {!isLocked && (
            <button 
                onClick={handleSave} 
                disabled={loading}
                className={`px-4 py-2 text-white rounded flex items-center gap-2 shadow-sm font-medium disabled:bg-blue-300 ${
                    debugMode && isTimeLocked ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
                <Save size={18} /> {debugMode && isTimeLocked ? 'Lưu Đè (Debug)' : 'Lưu Chỉ Số'}
            </button>
          )}
        </div>
      </div>

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
                <th className="p-2 text-center border-r w-1/4">Số cũ</th>
                <th className="p-2 text-center border-r w-1/4">Số mới</th>
                <th className="p-2 text-center border-r w-1/4">Số cũ</th>
                <th className="p-2 text-center w-1/4">Số mới</th>
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
                    <td className="p-3 text-center bg-yellow-50/50 border-r text-gray-500 font-mono text-lg">
                        {item.electric_old}
                    </td>
                    <td className={`p-2 bg-yellow-50/30 border-r ${isLocked ? 'bg-gray-100' : ''}`}>
                        <input 
                            type="number" 
                            min="0" // [MỚI] Chặn số âm ở trình duyệt
                            disabled={isLocked}
                            className={`w-full border p-2 rounded text-center font-bold text-lg focus:ring-2 outline-none transition-all
                                ${isLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : ''}
                                ${!isLocked && hasError(item.electric_old, item.electric_new) 
                                    ? 'border-red-500 bg-red-50 text-red-600 focus:ring-red-400' 
                                    : !isLocked ? 'border-gray-300 focus:ring-yellow-400 focus:border-yellow-400 text-blue-700' : ''
                                }`}
                            placeholder={isLocked ? '-' : '...'}
                            value={item.electric_new === 0 ? '0' : (item.electric_new || '')} 
                            onChange={(e) => handleInputChange(index, 'electric_new', e.target.value)}
                            onWheel={(e) => e.target.blur()}
                        />
                    </td>

                    {/* CỘT NƯỚC */}
                    <td className="p-3 text-center bg-blue-50/50 border-r text-gray-500 font-mono text-lg">
                        {item.water_old}
                    </td>
                    <td className={`p-2 bg-blue-50/30 ${isLocked ? 'bg-gray-100' : ''}`}>
                        <input 
                            type="number"
                            min="0" // [MỚI] Chặn số âm ở trình duyệt
                            disabled={isLocked}
                            className={`w-full border p-2 rounded text-center font-bold text-lg focus:ring-2 outline-none transition-all
                                ${isLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : ''}
                                ${!isLocked && hasError(item.water_old, item.water_new) 
                                    ? 'border-red-500 bg-red-50 text-red-600 focus:ring-red-400' 
                                    : !isLocked ? 'border-gray-300 focus:ring-blue-400 focus:border-blue-400 text-blue-700' : ''
                                }`}
                            placeholder={isLocked ? '-' : '...'}
                            value={item.water_new === 0 ? '0' : (item.water_new || '')} 
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
        
        {!isLocked && (
            <div className="p-4 bg-gray-50 border-t text-sm text-gray-500 flex gap-4 items-center justify-between">
                <div className="flex gap-4">
                    <div className="flex items-center gap-1"><AlertCircle size={16}/> Lưu ý:</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-50 border border-red-500 block"></span> Ô màu đỏ: Số mới &lt; Số cũ (Có thể là quay vòng đồng hồ)</div>
                </div>
                {debugMode && <div className="text-purple-600 font-bold">MODE: DEBUGGING</div>}
            </div>
        )}
      </div>
    </div>
  );
};

export default UsageManager;