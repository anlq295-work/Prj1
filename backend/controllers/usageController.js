const { Apartment, MeterReading, BillingPeriod, FeeType, Household, sequelize } = require('../models');
const { Op } = require('sequelize');

// ==========================================
// 1. LẤY CHỈ SỐ ĐIỆN & NƯỚC (Giữ nguyên logic)
// ==========================================
exports.getUsages = async (req, res) => {
    try {
        const { month, year } = req.query;
        const curMonth = parseInt(month);
        const curYear = parseInt(year);

        let prevMonth = curMonth - 1;
        let prevYear = curYear;
        if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }

        const currentPeriod = await BillingPeriod.findOne({ where: { month: curMonth, year: curYear } });
        const prevPeriod = await BillingPeriod.findOne({ where: { month: prevMonth, year: prevYear } });

        const feeTypes = await FeeType.findAll();
        const electricType = feeTypes.find(t => t.unit === 'kWh' || t.name.toLowerCase().includes('điện'));
        const waterType = feeTypes.find(t => t.unit === 'm3' || t.name.toLowerCase().includes('nước'));

        const electricTypeId = electricType ? electricType.id : null;
        const waterTypeId = waterType ? waterType.id : null;

        let currentReadings = [];
        let prevReadings = [];

        if (currentPeriod) {
            currentReadings = await MeterReading.findAll({ where: { billing_period_id: currentPeriod.id } });
        }
        if (prevPeriod) {
            prevReadings = await MeterReading.findAll({ where: { billing_period_id: prevPeriod.id } });
        }

        const apartments = await Apartment.findAll({ 
            include: [{ model: Household, where: { status: 'ACTIVE' }, required: false }],
            order: [['code', 'ASC']] 
        });

        const result = apartments.map(apt => {
            const getData = (typeId) => {
                if (!typeId) return { old: 0, new: null };
                const cur = currentReadings.find(r => r.apartment_id === apt.id && r.fee_type_id === typeId);
                const prev = prevReadings.find(r => r.apartment_id === apt.id && r.fee_type_id === typeId);
                
                let valOld = 0;
                if (prev) valOld = prev.new_value; // Ưu tiên số mới tháng trước
                else if (cur) valOld = cur.old_value; // Fallback

                const valNew = cur ? cur.new_value : null;
                return { old: valOld, new: valNew };
            };

            const elec = getData(electricTypeId);
            const water = getData(waterTypeId);

            return {
                apartment_id: apt.id,
                apartment_code: apt.code,
                owner_name: apt.Households[0] ? apt.Households[0].representative_name : '',
                electric_old: elec.old, electric_new: elec.new,
                water_old: water.old, water_new: water.new,
            };
        });

        res.json(result);
    } catch (err) {
        console.error("Get Usage Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// 2. LƯU CHỈ SỐ (CÓ DEBUG MODE)
// ==========================================
exports.saveUsages = async (req, res) => {
    // Nhận thêm tham số debug
    const { month, year, data, debug } = req.body; 
    const t = await sequelize.transaction();

    try {
        const [period] = await BillingPeriod.findOrCreate({
            where: { month, year },
            defaults: { status: 'OPEN', month, year },
            transaction: t
        });

        // [DEBUG LOGIC] Nếu đã chốt sổ VÀ không có debug -> Chặn
        if (period.status === 'CLOSED' && !debug) {
            await t.rollback();
            return res.status(403).json({ message: "Kỳ thu này đã đóng sổ!" });
        }

        const electricType = await FeeType.findOne({ where: { [Op.or]: [{ unit: 'kWh' }, { name: { [Op.iLike]: '%điện%' } }] } });
        const waterType = await FeeType.findOne({ where: { [Op.or]: [{ unit: 'm3' }, { name: { [Op.iLike]: '%nước%' } }] } });

        const upsertReading = async (aptId, feeTypeId, oldVal, newVal) => {
            if (!feeTypeId || newVal === null || newVal === '' || newVal === undefined) return;

            let reading = await MeterReading.findOne({
                where: { apartment_id: aptId, billing_period_id: period.id, fee_type_id: feeTypeId },
                transaction: t
            });

            if (reading) {
                reading.old_value = oldVal;
                reading.new_value = newVal;
                await reading.save({ transaction: t });
            } else {
                await MeterReading.create({
                    apartment_id: aptId,
                    billing_period_id: period.id,
                    fee_type_id: feeTypeId,
                    old_value: oldVal,
                    new_value: newVal,
                    reading_date: new Date()
                }, { transaction: t });
            }
        };

        for (const item of data) {
            await upsertReading(item.apartment_id, electricType?.id, item.electric_old, item.electric_new);
            await upsertReading(item.apartment_id, waterType?.id, item.water_old, item.water_new);
        }

        await t.commit();
        res.json({ message: `Lưu thành công! ${debug ? '(Debug Overwrite)' : ''}` });

    } catch (err) {
        await t.rollback();
        console.error("Save Error:", err);
        res.status(500).json({ error: err.message });
    }
};