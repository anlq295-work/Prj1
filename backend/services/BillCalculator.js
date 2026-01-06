/**
 * Tính tiền theo bậc thang (Lũy tiến)
 * @param {number} totalUsage - Tổng số lượng tiêu thụ (VD: 120 kWh)
 * @param {Array} tierConfig - Cấu hình bậc [{from, to, price}, ...]
 */
const calculateTieredFee = (totalUsage, tierConfig) => {
    // 1. Validate đầu vào
    if (!tierConfig || !Array.isArray(tierConfig) || tierConfig.length === 0) {
        return { total: 0, breakdown: [] };
    }

    // 2. Sắp xếp bậc thang từ thấp đến cao
    const sortedTiers = tierConfig.sort((a, b) => a.from - b.from);

    let remainingUsage = Number(totalUsage);
    let totalCost = 0;
    let breakdown = [];

    // 3. Duyệt qua từng bậc
    for (let i = 0; i < sortedTiers.length; i++) {
        if (remainingUsage <= 0) break;

        const tier = sortedTiers[i];
        
        // Tính định mức của bậc này (amount in tier)
        // Nếu có 'to', limit = to - from + 1 (hoặc theo logic to - from tùy quy ước).
        // Logic chuẩn thường dùng: 
        // Bậc 1: 0 - 50 -> Limit = 50
        // Bậc 2: 51 - 100 -> Limit = 50
        // => Logic: Limit = tier.to - tier.from + 1 (nếu tính cả mốc), hoặc tier.to (nếu bậc 1)
        
        let tierLimit = Infinity;
        
        if (tier.to && tier.to > 0) {
            // Cách tính limit an toàn:
            if (i === 0) {
                // Bậc đầu tiên: Limit chính là số 'to' (VD: 0-50 -> 50 số)
                tierLimit = tier.to; 
            } else {
                // Các bậc sau: to - from + 1. (VD: 51-100 -> 50 số)
                // Tuy nhiên, thường input lưu: from 50, to 100.
                tierLimit = tier.to - tier.from; 
                // Có thể cần +1 tùy vào cách bạn nhập dữ liệu (0-49 hay 0-50).
                // Ở đây giả sử input chuẩn mốc (0-50, 50-100).
            }
        }

        // Số lượng tính cho bậc này = Min(Phần còn lại, Định mức bậc)
        const usageInTier = Math.min(remainingUsage, tierLimit);
        
        const tierCost = usageInTier * Number(tier.price);

        breakdown.push({
            tierIndex: i + 1,
            from: tier.from,
            to: tier.to,
            price: Number(tier.price),
            usage: usageInTier,
            cost: tierCost
        });

        totalCost += tierCost;
        remainingUsage -= usageInTier;
    }

    // 4. Xử lý phần dư (nếu dùng vượt quá cấu hình bậc -> tính theo giá bậc cuối)
    if (remainingUsage > 0 && sortedTiers.length > 0) {
        const lastTier = sortedTiers[sortedTiers.length - 1];
        const extraCost = remainingUsage * Number(lastTier.price);
        
        // Cập nhật vào dòng cuối cùng của breakdown
        if (breakdown.length > 0) {
            const lastBreakdown = breakdown[breakdown.length - 1];
            lastBreakdown.usage += remainingUsage;
            lastBreakdown.cost += extraCost;
            // Nếu bậc cuối là vô cùng thì xóa 'to' để hiển thị đúng
            lastBreakdown.to = null; 
        } else {
             // Trường hợp hy hữu (chưa vào vòng lặp nào)
             breakdown.push({
                tierIndex: sortedTiers.length,
                from: lastTier.from,
                to: null,
                price: Number(lastTier.price),
                usage: remainingUsage,
                cost: extraCost
            });
        }
        
        totalCost += extraCost;
    }

    return {
        total: totalCost,
        breakdown: breakdown
    };
};

// Xuất module đúng chuẩn
module.exports = { calculateTieredFee };