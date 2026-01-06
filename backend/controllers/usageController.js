const { MeterReading, Apartment, BillingPeriod, FeeType, sequelize } = require('../models');
const { Op } = require('sequelize');

// 1. LẤY CHỈ SỐ (PIVOT DATA)
exports.getUsages = async (req, res) => {
    const { month, year } = req.query;
    try {
        // Lấy tất cả căn hộ
        const apartments = await Apartment.findAll({ order: [['code', 'ASC']] });
        
        // Tìm kỳ thu
        const period = await BillingPeriod.findOne({ where: { month, year } });
        
        let readings = [];
        if (period) {
            readings = await MeterReading.findAll({ 
                where: { billing_period_id: period.id },
                include: [{ model: FeeType }]
            });
        }

        // Pivot dữ liệu: Mỗi căn hộ 1 dòng, có cột old_electric, new_electric...
        const result = apartments.map(apt => {
            const aptReadings = readings.filter(r => r.apartment_id === apt.id);
            
            // Tìm theo category hoặc tên (Khuyên dùng category trong DB mới)
            const electric = aptReadings.find(r => r.FeeType.category === 'UTILITY' && r.FeeType.name.toLowerCase().includes('điện'));
            const water = aptReadings.find(r => r.FeeType.category === 'UTILITY' && r.FeeType.name.toLowerCase().includes('nước'));

            return {
                apartment_id: apt.id,
                apartment_code: apt.code,
                // Điện
                electric_old: electric ? electric.old_value : 0,
                electric_new: electric ? electric.new_value : 0,
                // Nước
                water_old: water ? water.old_value : 0,
                water_new: water ? water.new_value : 0,
            };
        });

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// 2. LƯU CHỈ SỐ
exports.saveUsages = async (req, res) => {
    const { month, year, data } = req.body; 
    const t = await sequelize.transaction();

    try {
        // Tìm/Tạo kỳ thu
        const [period] = await BillingPeriod.findOrCreate({
            where: { month, year },
            defaults: { status: 'OPEN' },
            transaction: t
        });

        // Lấy ID FeeType (Nên cache hoặc define const để tối ưu)
        const electricType = await FeeType.findOne({ where: { name: 'Điện sinh hoạt' } });
        const waterType = await FeeType.findOne({ where: { name: 'Nước sạch' } });

        if (!electricType || !waterType) throw new Error("Chưa cấu hình loại phí Điện/Nước");

        for (const item of data) {
            // Upsert Điện
            if (item.electric_new !== undefined) {
                await MeterReading.upsert({
                    apartment_id: item.apartment_id,
                    fee_type_id: electricType.id,
                    billing_period_id: period.id,
                    old_value: item.electric_old,
                    new_value: item.electric_new
                }, { transaction: t });
            }

            // Upsert Nước
            if (item.water_new !== undefined) {
                await MeterReading.upsert({
                    apartment_id: item.apartment_id,
                    fee_type_id: waterType.id,
                    billing_period_id: period.id,
                    old_value: item.water_old,
                    new_value: item.water_new
                }, { transaction: t });
            }
        }

        await t.commit();
        res.json({ message: "Đã lưu chỉ số thành công!" });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
};