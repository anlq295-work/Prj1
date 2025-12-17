// services/BillCalculator.js
const { Op } = require('sequelize');
const FeeConfig = require('../models/FeeConfig');

/**
 * Hàm tính tiền theo bậc thang (Logic cốt lõi)
 */
const calculateTieredFee = (usage, tierConfig) => {
  if (!tierConfig || !Array.isArray(tierConfig) || usage <= 0) return 0;

  let totalAmount = 0;
  let remainingUsage = usage;
  let previousLimit = 0;
  let breakdown = []; // Lưu chi tiết để hiển thị ra frontend

  for (let i = 0; i < tierConfig.length; i++) {
    const tier = tierConfig[i];
    const limit = tier.limit; // Ngưỡng trên (có thể là null nếu là bậc cuối)
    const price = tier.price;

    if (remainingUsage <= 0) break;

    let usageInTier;
    
    // Nếu limit là null (vô cực) hoặc còn lại ít hơn khoảng bậc
    if (limit === null) {
      usageInTier = remainingUsage;
    } else {
      const gap = limit - previousLimit;
      usageInTier = Math.min(remainingUsage, gap);
    }

    const cost = usageInTier * price;
    totalAmount += cost;
    
    breakdown.push({
      tierIndex: i + 1,
      usage: usageInTier,
      price: price,
      cost: cost
    });

    remainingUsage -= usageInTier;
    if (limit !== null) previousLimit = limit;
  }

  return { total: totalAmount, breakdown };
};

/**
 * Hàm tạo chi tiết hóa đơn cho 1 phòng
 */
const calculateRoomBill = async (roomData) => {
  // roomData gồm: { area: 30, electric_usage: 450, water_usage: 25, ... }
  
  // 1. Lấy tất cả loại phí đang kích hoạt
  const activeFees = await FeeConfig.findAll({ where: { is_active: true } });
  
  const billDetails = [];
  let totalBill = 0;

  for (const fee of activeFees) {
    let amount = 0;
    let note = '';
    let tieredDetails = null;

    switch (fee.calc_method) {
      case 'FLAT': // Cố định
        amount = fee.unit_price;
        break;

      case 'PER_M2': // Theo diện tích
        amount = (fee.unit_price || 0) * (roomData.area || 0);
        note = `${roomData.area} m2 x ${fee.unit_price}`;
        break;

      case 'PER_UNIT': // Theo chỉ số (đồng giá)
        const usage = fee.name.toLowerCase().includes('điện') ? roomData.electric_usage 
                    : fee.name.toLowerCase().includes('nước') ? roomData.water_usage 
                    : 0;
        amount = usage * (fee.unit_price || 0);
        note = `${usage} ${fee.unit || ''} x ${fee.unit_price}`;
        break;

      case 'TIERED': // Lũy tiến (Mới)
        const tieredUsage = fee.name.toLowerCase().includes('điện') ? roomData.electric_usage 
                          : fee.name.toLowerCase().includes('nước') ? roomData.water_usage 
                          : 0;
        
        // Gọi hàm tính toán riêng
        const result = calculateTieredFee(tieredUsage, fee.tier_config);
        amount = result.total;
        tieredDetails = result.breakdown; // Lưu lại để frontend hiển thị
        note = `Lũy tiến (${tieredUsage} ${fee.unit || ''})`;
        break;
    }

    totalBill += amount;
    billDetails.push({
      fee_id: fee.id,
      fee_name: fee.name,
      amount: amount,
      note: note,
      tieredDetails: tieredDetails // Trả về breakdown cho client
    });
  }

  return { total: totalBill, details: billDetails };
};

module.exports = { calculateRoomBill };