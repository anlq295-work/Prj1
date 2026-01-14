/**
 * Tính tiền theo bậc thang (Lũy tiến) - Phiên bản Fix lỗi số học & Logic khoảng
 * @param {number} totalUsage - Tổng số lượng tiêu thụ (VD: 120.5 kWh)
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
    
    // Biến theo dõi mốc cuối của bậc trước (để tính khoảng an toàn)
    let previousTo = 0; 

    // 3. Duyệt qua từng bậc
    for (let i = 0; i < sortedTiers.length; i++) {
        // Fix lỗi số thực: Coi như hết nếu còn dưới 0.0001
        if (remainingUsage <= 0.0001) break;

        const tier = sortedTiers[i];
        let tierLimit = Infinity;

        if (tier.to && tier.to > 0) {
            // [LOGIC MỚI] Tính limit dựa trên mốc to của bậc trước.
            // VD: Bậc 1 (to 50), Bậc 2 (to 100). 
            // Dù Bậc 2 ghi from 50 hay 51 thì khoảng cách vẫn là 100 - 50 = 50.
            tierLimit = tier.to - previousTo;
        }

        // Số lượng tính cho bậc này
        let usageInTier = Math.min(remainingUsage, tierLimit);
        
        // Làm tròn 2 số thập phân để tránh lỗi nhân tiền lẻ
        usageInTier = Math.round(usageInTier * 100) / 100;

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
        
        // Cập nhật mốc previousTo cho vòng lặp sau (nếu bậc này có giới hạn)
        if (tier.to && tier.to > 0) {
            previousTo = tier.to;
        }
    }

    // 4. Xử lý phần dư (nếu dùng vượt quá cấu hình các bậc -> tính theo giá bậc cuối cùng)
    // Dùng > 0.0001 để tránh floating point error
    if (remainingUsage > 0.0001 && sortedTiers.length > 0) {
        const lastTier = sortedTiers[sortedTiers.length - 1];
        
        // Làm tròn lượng dư
        const extraUsage = Math.round(remainingUsage * 100) / 100;
        const extraCost = extraUsage * Number(lastTier.price);
        
        // Cập nhật vào dòng cuối cùng của breakdown
        if (breakdown.length > 0) {
            const lastBreakdown = breakdown[breakdown.length - 1];
            
            // Nếu dòng cuối cùng chính là bậc cuối trong config -> cộng dồn vào
            if (lastBreakdown.price === Number(lastTier.price)) {
                lastBreakdown.usage += extraUsage;
                lastBreakdown.cost += extraCost;
                lastBreakdown.to = null; // Hiển thị là vô cùng
                
                // Fix lại hiển thị số lẻ cho đẹp
                lastBreakdown.usage = Math.round(lastBreakdown.usage * 100) / 100;
            } else {
                // Trường hợp hy hữu: breakdown chưa chứa bậc cuối (do logic nào đó)
                breakdown.push({
                    tierIndex: sortedTiers.length,
                    from: lastTier.from,
                    to: null,
                    price: Number(lastTier.price),
                    usage: extraUsage,
                    cost: extraCost
                });
            }
        } else {
             // Trường hợp chưa vào vòng lặp nào (VD: config lạ)
             breakdown.push({
                tierIndex: sortedTiers.length,
                from: lastTier.from,
                to: null,
                price: Number(lastTier.price),
                usage: extraUsage,
                cost: extraCost
            });
        }
        
        totalCost += extraCost;
    }

    return {
        total: Math.round(totalCost), // Tổng tiền nên làm tròn số nguyên (VND)
        breakdown: breakdown
    };
};

module.exports = { calculateTieredFee };