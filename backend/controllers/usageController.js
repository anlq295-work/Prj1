const XLSX = require('xlsx');
const { Apartment, MeterReading, Household,FeeDefinition, sequelize } = require('../models');
const { Op } = require('sequelize');

// 1. LẤY CHỈ SỐ
exports.getUsages = async (req, res) => {
    try {
        const { month, year } = req.query;
        const curMonth = parseInt(month);
        const curYear = parseInt(year);

        // Tính tháng trước
        let prevMonth = curMonth - 1;
        let prevYear = curYear;
        if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }

        // Tìm ID của Điện và Nước từ bảng FeeDefinition
        const fees = await FeeDefinition.findAll({ where: { is_active: true } });
        
        // Logic tìm: Ưu tiên theo unit (kWh/m3) hoặc theo tên
        const electricFee = fees.find(f => f.unit?.toLowerCase() === 'kwh' || f.name.toLowerCase().includes('điện'));
        const waterFee = fees.find(f => f.unit?.toLowerCase() === 'm3' || f.name.toLowerCase().includes('nước'));

        const electricId = electricFee ? electricFee.id : null;
        const waterId = waterFee ? waterFee.id : null;

        // Lấy Reading
        const currentReadings = await MeterReading.findAll({ where: { month: curMonth, year: curYear } });
        const prevReadings = await MeterReading.findAll({ where: { month: prevMonth, year: prevYear } });

        const apartments = await Apartment.findAll({ 
            include: [{ model: Household, as: 'Households', where: { status: 'ACTIVE' }, required: false }],
            order: [['code', 'ASC']] 
        });

        const result = apartments.map(apt => {
            const getReadingData = (feeId) => {
                if (!feeId) return { old: 0, new: null };

                const cur = currentReadings.find(r => r.apartment_id === apt.id && r.fee_definition_id === feeId);
                const prev = prevReadings.find(r => r.apartment_id === apt.id && r.fee_definition_id === feeId);

                // Logic fallback: Nếu không có số cũ tháng này, lấy số mới tháng trước
                let valOld = cur ? cur.old_value : (prev ? prev.new_value : 0);
                let valNew = cur ? cur.new_value : null;

                return { old: valOld, new: valNew };
            };

            const elec = getReadingData(electricId);
            const water = getReadingData(waterId);

            return {
                apartment_id: apt.id,
                apartment_code: apt.code,
                owner_name: apt.Households?.[0]?.owner_name || '',
                electric_old: elec.old, electric_new: elec.new,
                water_old: water.old, water_new: water.new,
            };
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 2. LƯU CHỈ SỐ
exports.saveUsages = async (req, res) => {
    const { month, year, data } = req.body; 
    const t = await sequelize.transaction();

    try {
        const fees = await FeeDefinition.findAll({ where: { is_active: true } });
        const electricFee = fees.find(f => f.unit?.toLowerCase() === 'kwh' || f.name.toLowerCase().includes('điện'));
        const waterFee = fees.find(f => f.unit?.toLowerCase() === 'm3' || f.name.toLowerCase().includes('nước'));

        const upsertReading = async (aptId, feeDefId, oldVal, newVal) => {
            if (!feeDefId || newVal === null || newVal === '' || newVal === undefined) return;

            const reading = await MeterReading.findOne({
                where: { apartment_id: aptId, fee_definition_id: feeDefId, month, year },
                transaction: t
            });

            if (reading) {
                reading.old_value = oldVal;
                reading.new_value = newVal;
                await reading.save({ transaction: t });
            } else {
                await MeterReading.create({
                    apartment_id: aptId,
                    fee_definition_id: feeDefId,
                    month, year,
                    old_value: oldVal,
                    new_value: newVal,
                    reading_date: new Date()
                }, { transaction: t });
            }
        };

        for (const item of data) {
            await upsertReading(item.apartment_id, electricFee?.id, item.electric_old, item.electric_new);
            await upsertReading(item.apartment_id, waterFee?.id, item.water_old, item.water_new);
        }

        await t.commit();
        res.json({ message: "Lưu chỉ số thành công!" });

    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
};

exports.importUsages = async (req, res) => {
    const { month, year } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ message: "Vui lòng chọn file Excel." });

    const t = await sequelize.transaction();

    try {
        // 1. Đọc file Excel
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet);

        // 2. Lấy ID của loại phí ĐIỆN và NƯỚC để dùng
        // Lưu ý: Đảm bảo trong bảng fee_definitions có category là 'ELECTRIC' và 'WATER'
        // Hoặc bạn có thể tìm theo tên: name: 'Tiền điện', ...
        const electricFee = await FeeDefinition.findOne({ 
            where: { 
                [Op.or]: [{ category: 'ELECTRIC' }, { name: { [Op.iLike]: '%điện%' } }] 
            },
            transaction: t 
        });

        const waterFee = await FeeDefinition.findOne({ 
            where: { 
                [Op.or]: [{ category: 'WATER' }, { name: { [Op.iLike]: '%nước%' } }] 
            },
            transaction: t 
        });

        if (!electricFee || !waterFee) {
            await t.rollback();
            return res.status(400).json({ message: "Chưa cấu hình loại phí Điện/Nước trong hệ thống." });
        }

        let successCount = 0;
        let errors = [];

        // Hàm chuẩn hóa key (để chấp nhận "Mã Căn", "ma can", "Code"...)
        const normalizeKey = (obj, key) => {
            const foundKey = Object.keys(obj).find(k => k.trim().toLowerCase() === key.toLowerCase());
            return foundKey ? obj[foundKey] : undefined;
        };

        // 3. Lặp và Lưu dữ liệu
        for (const row of rawData) {
            const apartmentCode = normalizeKey(row, 'mã căn') || normalizeKey(row, 'ma can') || normalizeKey(row, 'code');
            const electricNew = normalizeKey(row, 'điện mới') || normalizeKey(row, 'dien moi');
            const waterNew = normalizeKey(row, 'nước mới') || normalizeKey(row, 'nuoc moi');

            if (!apartmentCode) continue;

            // Tìm căn hộ
            const apt = await Apartment.findOne({ 
                where: { code: apartmentCode.toString().trim() },
                transaction: t
            });

            if (!apt) {
                errors.push(`Mã căn '${apartmentCode}' không tồn tại.`);
                continue;
            }

            // --- HÀM LƯU (Helper) ---
            const saveReading = async (feeId, newValue) => {
                if (newValue === undefined || newValue === null || newValue === '') return;

                // Tìm chỉ số cũ của tháng trước (để điền vào old_value nếu tạo mới)
                let oldValue = 0;
                // Logic tìm tháng trước:
                let prevMonth = parseInt(month) - 1;
                let prevYear = parseInt(year);
                if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }

                const prevReading = await MeterReading.findOne({
                    where: { apartment_id: apt.id, fee_definition_id: feeId, month: prevMonth, year: prevYear },
                    transaction: t
                });
                if (prevReading) oldValue = prevReading.new_value;

                // Kiểm tra xem tháng này đã nhập chưa
                const currentReading = await MeterReading.findOne({
                    where: { apartment_id: apt.id, fee_definition_id: feeId, month, year },
                    transaction: t
                });

                if (currentReading) {
                    // Nếu có rồi -> Cập nhật số mới
                    currentReading.new_value = parseFloat(newValue);
                    // (Tùy chọn) Có thể cập nhật lại old_value nếu muốn chắc chắn
                    // currentReading.old_value = oldValue; 
                    await currentReading.save({ transaction: t });
                } else {
                    // Nếu chưa có -> Tạo mới
                    await MeterReading.create({
                        apartment_id: apt.id,
                        fee_definition_id: feeId,
                        month,
                        year,
                        old_value: oldValue,
                        new_value: parseFloat(newValue)
                    }, { transaction: t });
                }
            };

            // Thực hiện lưu Điện
            if (electricNew !== undefined) {
                await saveReading(electricFee.id, electricNew);
            }

            // Thực hiện lưu Nước
            if (waterNew !== undefined) {
                await saveReading(waterFee.id, waterNew);
            }

            successCount++;
        }

        await t.commit();
        
        res.json({ 
            message: `Đã nhập liệu thành công ${successCount} dòng.`,
            errors: errors 
        });

    } catch (error) {
        await t.rollback();
        console.error("Import Error:", error);
        res.status(500).json({ message: "Lỗi Server: " + error.message });
    }
};