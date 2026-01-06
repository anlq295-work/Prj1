/**
 * HÀM TÍNH TIỀN BẬC THANG (Logic cốt lõi)
 * Input: 
 * - usage: Số lượng tiêu thụ (VD: 120 kWh)
 * - tierConfig: Array JSON cấu hình ([{from: 0, to: 50, price: 1678}, ...])
 */
const calculateTieredFee = (usage, tierConfig) => {
  // 1. Kiểm tra đầu vào an toàn
  if (!tierConfig || !Array.isArray(tierConfig) || usage <= 0) {
    return { total: 0, breakdown: [] };
  }

  // 2. Sắp xếp bậc thang để đảm bảo tính đúng thứ tự (từ thấp đến cao)
  const sortedTiers = tierConfig.sort((a, b) => a.from - b.from);

  let totalAmount = 0;
  let remainingUsage = usage;
  let breakdown = []; // Mảng lưu chi tiết từng bậc để in hóa đơn

  for (let i = 0; i < sortedTiers.length; i++) {
    const tier = sortedTiers[i];
    
    // Nếu đã tính hết số lượng dùng thì dừng
    if (remainingUsage <= 0) break;

    // Tính độ rộng của bậc này
    let availableInTier;
    
    // Nếu "to" là null hoặc 0 -> Coi như là bậc cuối (vô cùng)
    if (!tier.to) {
      availableInTier = remainingUsage;
    } else {
      // Logic: (Đến số - Từ số + 1). VD: 0->50 là 51 số.
      // Nếu muốn chính xác theo kiểu điện lực (0-50 là 50 số), bạn có thể chỉnh lại công thức ở đây.
      // Với config hiện tại: 0-50, 51-100... thì dùng công thức dưới là an toàn:
      availableInTier = tier.to - tier.from + 1;
      
      // Fix edge case nếu bậc đầu tiên bắt đầu từ 0
      if (tier.from === 0) availableInTier = tier.to; 
    }

    // Số lượng thực tế tính tiền ở bậc này = Min(Số còn lại, Độ rộng bậc)
    const usageInTier = Math.min(remainingUsage, availableInTier);

    // Tính tiền
    const cost = usageInTier * tier.price;
    totalAmount += cost;

    // Lưu chi tiết (Snapshost)
    breakdown.push({
      tierIndex: i + 1,
      from: tier.from,
      to: tier.to || 'Trở lên',
      price: tier.price,
      usage: usageInTier,
      cost: cost
    });

    // Trừ đi số lượng đã tính
    remainingUsage -= usageInTier;
  }

  return { total: totalAmount, breakdown };
};

module.exports = { calculateTieredFee };