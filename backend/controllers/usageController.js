const { Apartment, MeterReading, BillingPeriod, FeeType } = require('../models');
const { Op } = require('sequelize');

exports.getUsages = async (req, res) => {
    try {
        const { month, year } = req.query;
        // console.log(`--- LẤY CHỈ SỐ THÁNG ${month}/${year} (Kèm số cuối tháng trước) ---`);

        // 1. XÁC ĐỊNH THỜI GIAN
        const curMonth = parseInt(month);
        const curYear = parseInt(year);

        // Tính tháng trước (Handle trường hợp tháng 1 lùi về tháng 12 năm ngoái)
        let prevMonth = curMonth - 1;
        let prevYear = curYear;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = curYear - 1;
        }

        // 2. TÌM KỲ THU (Hiện tại & Quá khứ)
        const currentPeriod = await BillingPeriod.findOne({ where: { month: curMonth, year: curYear } });
        const prevPeriod = await BillingPeriod.findOne({ where: { month: prevMonth, year: prevYear } });

        // 3. XÁC ĐỊNH ID LOẠI PHÍ (Điện & Nước)
        // Tìm loại phí dựa trên Unit hoặc Tên (để tránh hardcode ID)
        const feeTypes = await FeeType.findAll();
        
        // Helper tìm ID loại phí
        const getFeeTypeId = (keyword, unit) => {
            const type = feeTypes.find(t => 
                t.unit === unit || 
                t.name.toLowerCase().includes(keyword) || 
                t.category === (keyword === 'điện' ? 'ELECTRICITY' : 'WATER')
            );
            return type ? type.id : null;
        };

        const electricTypeId = getFeeTypeId('điện', 'kWh');
        const waterTypeId = getFeeTypeId('nước', 'm3');

        // 4. LẤY DỮ LIỆU ĐỌC SỐ
        let currentReadings = [];
        let prevReadings = [];

        if (currentPeriod) {
            currentReadings = await MeterReading.findAll({ where: { billing_period_id: currentPeriod.id } });
        }
        if (prevPeriod) {
            prevReadings = await MeterReading.findAll({ where: { billing_period_id: prevPeriod.id } });
        }

        // 5. MAP DỮ LIỆU RA DANH SÁCH CĂN HỘ
        const apartments = await Apartment.findAll({ order: [['code', 'ASC']] });

        const result = apartments.map(apt => {
            // Hàm lấy chỉ số (cũ/mới) cho một loại phí cụ thể
            const getReadingData = (typeId) => {
                if (!typeId) return { old: 0, new: 0 };

                // Tìm bản ghi tháng này và tháng trước của căn hộ này
                const cur = currentReadings.find(r => r.apartment_id === apt.id && r.fee_type_id === typeId);
                const prev = prevReadings.find(r => r.apartment_id === apt.id && r.fee_type_id === typeId);

                // LOGIC QUAN TRỌNG:
                // - Số mới: Nếu có nhập rồi thì lấy, chưa thì bằng 0.
                const valNew = cur ? cur.new_value : 0;

                // - Số cũ: 
                //   Ưu tiên 1: Nếu tháng này đã tạo bản ghi -> Lấy old_value của nó (vì có thể user sửa tay).
                //   Ưu tiên 2: Nếu chưa tạo -> Lấy new_value của tháng trước.
                //   Ưu tiên 3: Mặc định 0.
                let valOld = 0;
                if (cur) {
                    valOld = cur.old_value; 
                } else if (prev) {
                    valOld = prev.new_value; 
                }

                return { old: valOld, new: valNew };
            };

            const elecData = getReadingData(electricTypeId);
            const waterData = getReadingData(waterTypeId);

            return {
                apartment_id: apt.id,
                apartment_code: apt.code,
                
                electric_old: elecData.old,
                electric_new: elecData.new,
                
                water_old: waterData.old,
                water_new: waterData.new,
            };
        });

        res.json(result);

    } catch (err) {
        console.error("Get Usage Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// --- HÀM SAVE KHÔNG ĐỔI (Chỉ nhắc lại để bạn biết vị trí) ---
exports.saveUsage = async (req, res) => {
    // Logic saveUsage đã sửa ở tin nhắn trước (có tự động tìm số cũ)
    // Bạn giữ nguyên logic đó là được.
    // ...
    // (Phần code saveUsage tôi đã gửi ở tin nhắn trước)
    const { month, year, data } = req.body; 
    // data format: [{ apartment_id, electric_new, water_new }, ...]

    // --- CHECK BẢO MẬT: CHẶN SỬA THÁNG QUÁ KHỨ ---
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();

    // Logic: Nếu năm cũ HOẶC (năm nay nhưng tháng cũ) thì chặn
    if (year < curYear || (year === curYear && month < curMonth)) {
        return res.status(403).json({ 
            message: `Không được phép thay đổi dữ liệu của tháng quá khứ (${month}/${year}).` 
        });
    }
    
    try {
        // 1. Tìm hoặc Tạo kỳ thu hiện tại
        const [period] = await BillingPeriod.findOrCreate({
            where: { month, year },
            defaults: { status: 'OPEN' }
        });

        if (period.status === 'CLOSED') {
            return res.status(400).json({ message: "Kỳ thu này đã đóng, không thể sửa chỉ số!" });
        }

        // 2. TÍNH TOÁN KỲ TRƯỚC (Để lấy số cũ)
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = year - 1;
        }

        const prevPeriod = await BillingPeriod.findOne({
            where: { month: prevMonth, year: prevYear }
        });

        // 3. Lấy loại phí Điện/Nước
        const electricType = await FeeType.findOne({ 
            where: { [Op.or]: [{ unit: 'kWh' }, { name: { [Op.iLike]: '%điện%' } }] } 
        });
        
        const waterType = await FeeType.findOne({ 
            where: { [Op.or]: [{ unit: 'm3' }, { name: { [Op.iLike]: '%nước%' } }] } 
        });

        if (!electricType || !waterType) {
            return res.status(400).json({ message: "Chưa cấu hình loại phí Điện/Nước." });
        }

        // 4. Lặp qua từng căn hộ để lưu
        for (const item of data) {
            
            // --- HÀM HỖ TRỢ LƯU (Tách ra cho gọn) ---
            const processSave = async (feeTypeId, newValueInput) => {
                if (newValueInput === undefined || newValueInput === null || newValueInput === '') return;
                
                // Ép kiểu về số nguyên
                const newValue = parseInt(newValueInput);

                // Tự động lấy chỉ số cũ (Auto Old Value)
                let autoOldValue = 0;
                if (prevPeriod) {
                    const prevReading = await MeterReading.findOne({
                        where: {
                            apartment_id: item.apartment_id,
                            billing_period_id: prevPeriod.id,
                            fee_type_id: feeTypeId
                        }
                    });
                    if (prevReading) {
                        autoOldValue = prevReading.new_value;
                    }
                }

                // Tìm xem tháng này đã nhập chưa
                let currentReading = await MeterReading.findOne({
                    where: { 
                        apartment_id: item.apartment_id, 
                        billing_period_id: period.id,
                        fee_type_id: feeTypeId
                    }
                });

                if (currentReading) {
                    // Cập nhật: Luôn ưu tiên lấy số cũ từ tháng trước để đảm bảo khớp số
                    currentReading.old_value = autoOldValue; 
                    currentReading.new_value = newValue;
                    await currentReading.save();
                } else {
                    // Tạo mới
                    await MeterReading.create({
                        apartment_id: item.apartment_id,
                        billing_period_id: period.id,
                        fee_type_id: feeTypeId,
                        old_value: autoOldValue, // Tự động điền
                        new_value: newValue,
                        reading_date: new Date()
                    });
                }
            };

            // Lưu Điện
            await processSave(electricType.id, item.electric_new);
            
            // Lưu Nước
            await processSave(waterType.id, item.water_new);
        }

        res.json({ message: "Lưu chỉ số thành công!" });

    } catch (err) {
        console.error("Save Usage Error:", err);
        res.status(500).json({ error: err.message });
    }
};