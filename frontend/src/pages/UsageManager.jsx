import React, { useState, useEffect, useRef } from 'react';
import { getUsages, saveUsages, importUsages } from '../api';
import { Save, RefreshCw, AlertCircle, Lock, Bug, FileSpreadsheet } from 'lucide-react';

const UsageManager = () => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // --- STATE ---
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef(null);
  const [debugMode, setDebugMode] = useState(false);

  const isTimeLocked = year < currentYear || (year === currentYear && month < currentMonth);
  const isLocked = isTimeLocked && !debugMode;
  const maxMonthToShow = (year === currentYear) ? currentMonth : 12;

  // --- 1. PHÍM TẮT DEBUG ---
  useEffect(() => {
    const handleKeyDown = (event) => {
        if (event.ctrlKey && event.shiftKey && (event.key === 'D' || event.key === 'd')) {
            event.preventDefault();
            setDebugMode(prev => {
                const newState = !prev;
                alert(newState ? "🔓 DEBUG MODE: ON" : "🔒 DEBUG MODE: OFF");
                return newState;
            });
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- 2. LOAD DATA ---
  useEffect(() => {
    fetchData();
  }, [month, year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getUsages(month, year);
      const processedData = res.data.map(item => ({
          ...item,
          electric_new: item.electric_new !== null ? item.electric_new : item.electric_old,
          water_new: item.water_new !== null ? item.water_new : item.water_old
      }));
      
      // Sắp xếp tự nhiên
      processedData.sort((a, b) => {
          return new Intl.Collator('vi', { numeric: true, sensitivity: 'base' })
              .compare(a.apartment_code, b.apartment_code);
      });

      setData(processedData);
    } catch (error) {
      alert("Lỗi tải: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value);
    setYear(newYear);
    if (newYear < currentYear) setMonth(12);
    else setMonth(currentMonth);
  };

  // --- 3. HANDLERS ---
  const handleInputChange = (index, field, value) => {
    if (isLocked) return;
    if (value !== '' && parseInt(value) < 0) return;
    const newData = [...data];
    newData[index][field] = value === '' ? '' : parseInt(value);
    setData(newData);
  };

  const validateData = () => {
    let rolloverList = []; 
    data.forEach(item => {
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

    if (rolloverList.length > 0) {
        return window.confirm(
            "PHÁT HIỆN ĐỒNG HỒ QUAY VÒNG (SỐ MỚI < SỐ CŨ)\n\n" +
            "Các căn hộ sau:\n" + rolloverList.join("\n") + 
            "\n\nNhấn OK để xác nhận (Tính bù), Cancel để kiểm tra lại."
        );
    }
    return true;
  };

  const handleSave = async () => {
    if (isLocked) return;
    if (!validateData()) return; 
    try {
      setLoading(true);
      await saveUsages({ month, year, data, debug: debugMode });
      alert("✅ Đã lưu thành công!");
      fetchData();
    } catch (error) {
      alert("Lỗi lưu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = () => fileInputRef.current.click();

  const handleFileChange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('month', month);
      formData.append('year', year);

      try {
          setLoading(true);
          const res = await importUsages(formData); 
          let msg = res.data?.message || "Import xong.";
          if (res.data?.errors?.length > 0) msg += "\n\nCảnh báo:\n" + res.data.errors.join("\n");
          alert(msg);
          fetchData();
      } catch (err) {
          alert("Lỗi import: " + err.message);
      } finally {
          setLoading(false);
          e.target.value = null;
      }
  };

  const hasError = (oldVal, newVal) => (newVal !== '' && newVal !== null && parseInt(newVal) < parseInt(oldVal));

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 flex flex-col items-center">
      
      {/* --- MAIN CONTAINER (Giới hạn chiều rộng max-w-6xl) --- */}
      <div className="w-full max-w-6xl space-y-4">
        
        {/* HEADER CARD */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    Cập nhật Chỉ Số
                    {debugMode && <Bug size={20} className="text-purple-600 animate-pulse" />}
                </h1>
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                    {isTimeLocked 
                        ? <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-200 flex items-center gap-1"><Lock size={12}/> Đã khóa sổ</span> 
                        : <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold border border-green-200">Đang mở</span>
                    }
                    <span className="text-gray-400">|</span>
                    <span>Kỳ dữ liệu: Tháng {month}/{year}</span>
                </p>
            </div>
            
            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
                <select 
                    value={month} onChange={e => setMonth(parseInt(e.target.value))} 
                    className="h-10 border-gray-300 border rounded-md px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer hover:border-blue-400 transition-colors"
                >
                    {[...Array(maxMonthToShow)].map((_, i) => (
                        <option key={maxMonthToShow - i} value={maxMonthToShow - i}>Tháng {maxMonthToShow - i}</option>
                    ))}
                </select>

                <select 
                    value={year} onChange={handleYearChange} 
                    className="h-10 border-gray-300 border rounded-md px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer hover:border-blue-400 transition-colors"
                >
                    {[currentYear, currentYear - 1].map(y => <option key={y} value={y}>{y}</option>)}
                </select>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                <button onClick={fetchData} className="h-10 w-10 flex items-center justify-center bg-white text-gray-600 rounded-md hover:bg-blue-50 hover:text-blue-600 border border-gray-300 transition-all" title="Làm mới">
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
                
                {!isLocked && (
                    <>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                        <button onClick={handleImportClick} disabled={loading} className="h-10 px-4 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-all hover:shadow">
                            <FileSpreadsheet size={18} /> Excel
                        </button>
                        <button onClick={handleSave} disabled={loading} className="h-10 px-5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 flex items-center gap-2 shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5">
                            <Save size={18} /> Lưu Chỉ Số
                        </button>
                    </>
                )}
            </div>
        </div>

        {/* TABLE CARD */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col h-[80vh]"> {/* Tăng chiều cao container */}
            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse relative">
                    <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm text-sm">
                        <tr>
                            <th className="py-4 px-4 w-28 font-bold text-gray-700 sticky left-0 bg-gray-100 z-30 border-r border-b text-center tracking-wide">CĂN HỘ</th>
                            
                            {/* Header Điện */}
                            <th className="py-3 px-2 text-center bg-yellow-50/80 text-yellow-800 border-r border-b border-yellow-200 backdrop-blur-sm" colSpan={2}>
                                <div className="flex items-center justify-center gap-2 font-bold text-base">⚡ ĐIỆN (kWh)</div>
                            </th>
                            
                            {/* Header Nước */}
                            <th className="py-3 px-2 text-center bg-blue-50/80 text-blue-800 border-b border-blue-200 backdrop-blur-sm" colSpan={2}>
                                <div className="flex items-center justify-center gap-2 font-bold text-base">💧 NƯỚC (m³)</div>
                            </th>
                        </tr>
                        <tr className="text-xs uppercase text-gray-500 font-bold bg-gray-50 border-b border-gray-200">
                            <th className="sticky left-0 bg-gray-50 z-30 border-r"></th>
                            <th className="py-2 px-4 text-center border-r w-1/5 tracking-wider">Số cũ</th>
                            <th className="py-2 px-4 text-center border-r w-1/5 tracking-wider bg-yellow-50/30">Số mới</th>
                            <th className="py-2 px-4 text-center border-r w-1/5 tracking-wider">Số cũ</th>
                            <th className="py-2 px-4 text-center w-1/5 tracking-wider bg-blue-50/30">Số mới</th>
                        </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {loading && data.length === 0 ? (
                            <tr><td colSpan="5" className="p-20 text-center text-gray-400 text-lg">Đang tải dữ liệu...</td></tr>
                        ) : data.length === 0 ? (
                            <tr><td colSpan="5" className="p-20 text-center text-gray-400 italic text-lg">Không có dữ liệu hiển thị.</td></tr>
                        ) : (
                            data.map((item, index) => (
                                <tr key={item.apartment_id} className="hover:bg-gray-50 transition-colors group">
                                    {/* Căn hộ */}
                                    <td className="py-3 px-4 font-bold text-gray-700 sticky left-0 bg-white border-r z-10 text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-gray-50 text-base">
                                        {item.apartment_code}
                                    </td>
                                    
                                    {/* Điện Cũ */}
                                    <td className="py-3 px-4 text-center text-gray-500 border-r text-base font-mono">
                                        {item.electric_old}
                                    </td>
                                    {/* Điện Mới */}
                                    <td className={`p-2 border-r relative ${isLocked ? 'bg-gray-50' : 'bg-yellow-50/10'}`}>
                                        <input 
                                            type="number" min="0" disabled={isLocked}
                                            className={`w-full h-10 px-3 rounded border text-center font-bold text-lg text-gray-800 outline-none transition-all
                                                ${isLocked 
                                                    ? 'bg-transparent border-transparent cursor-not-allowed text-gray-500' 
                                                    : 'bg-white border-gray-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 hover:border-yellow-300'
                                                }
                                                ${!isLocked && hasError(item.electric_old, item.electric_new) ? '!bg-red-50 !text-red-600 !border-red-300 !ring-red-100' : ''}
                                            `}
                                            placeholder="..."
                                            value={item.electric_new === 0 ? '0' : (item.electric_new || '')} 
                                            onChange={(e) => handleInputChange(index, 'electric_new', e.target.value)}
                                            onWheel={(e) => e.target.blur()}
                                        />
                                    </td>

                                    {/* Nước Cũ */}
                                    <td className="py-3 px-4 text-center text-gray-500 border-r text-base font-mono">
                                        {item.water_old}
                                    </td>
                                    {/* Nước Mới */}
                                    <td className={`p-2 relative ${isLocked ? 'bg-gray-50' : 'bg-blue-50/10'}`}>
                                        <input 
                                            type="number" min="0" disabled={isLocked}
                                            className={`w-full h-10 px-3 rounded border text-center font-bold text-lg text-gray-800 outline-none transition-all
                                                ${isLocked 
                                                    ? 'bg-transparent border-transparent cursor-not-allowed text-gray-500' 
                                                    : 'bg-white border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 hover:border-blue-300'
                                                }
                                                ${!isLocked && hasError(item.water_old, item.water_new) ? '!bg-red-50 !text-red-600 !border-red-300 !ring-red-100' : ''}
                                            `}
                                            placeholder="..."
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

            {/* Footer Status */}
            {!isLocked && (
                <div className="px-6 py-3 bg-gray-50 border-t text-sm text-gray-600 flex gap-6 items-center shadow-inner">
                    <span className="font-semibold flex items-center gap-2"><AlertCircle size={16} className="text-blue-600"/> Trạng thái nhập liệu:</span>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-white border border-gray-300 rounded-full"></span> Bình thường</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-100 border border-red-500 rounded-full"></span> Cảnh báo (Số mới &lt; Số cũ)</div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default UsageManager;