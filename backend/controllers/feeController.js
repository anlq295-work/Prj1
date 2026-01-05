const { FeeConfig, FeeType, sequelize } = require('../models');

// 1. LẤY DANH SÁCH PHÍ
exports.getAllFees = async (req, res) => {
  try {
    const fees = await FeeConfig.findAll({
      // QUAN TRỌNG: Phải include FeeType để lấy tên và đơn vị chuẩn
      include: [{ model: FeeType }], 
      order: [['updatedAt', 'DESC']]
    });
    res.json(fees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// 2. TẠO MỚI PHÍ
exports.createFee = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name, unit, category, unit_price, calc_method, tier_config } = req.body;

    // B1: Tìm hoặc tạo FeeType trước (Chuẩn hóa tên)
    const [feeType] = await FeeType.findOrCreate({
      where: { name: name },
      defaults: {
        name,
        unit: unit || 'tháng',
        category: category || 'FIXED',
        description: 'Cấu hình từ trang quản lý'
      },
      transaction: t
    });

    // B2: Tạo FeeConfig trỏ vào FeeType đó
    const newConfig = await FeeConfig.create({
      fee_type_id: feeType.id,
      name: name, // Vẫn lưu tên ở đây để dễ debug
      unit_price: unit_price || 0,
      calc_method,
      tier_config,
      is_active: true
    }, { transaction: t });

    await t.commit();

    // Trả về bản ghi đầy đủ với FeeType
    const finalConfig = await FeeConfig.findByPk(newConfig.id, {
      include: [{ model: FeeType }]
    });

    res.status(201).json(finalConfig);
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
};

// 3. CẬP NHẬT PHÍ
exports.updateFee = async (req, res) => {
  const { id } = req.params;
  const { name, unit, unit_price, calc_method, tier_config } = req.body;
  
  const t = await sequelize.transaction();
  try {
    const config = await FeeConfig.findByPk(id, { transaction: t });
    if (!config) throw new Error("Không tìm thấy cấu hình phí");

    // Cập nhật bảng Config
    config.unit_price = unit_price;
    config.calc_method = calc_method;
    config.tier_config = tier_config;
    
    // Nếu đổi tên, phải tìm hoặc tạo FeeType mới và trỏ FeeConfig sang
    if (name && name !== config.name) {
        const [feeType] = await FeeType.findOrCreate({
            where: { name: name },
            defaults: {
                name,
                unit: unit || 'tháng', // Giữ lại unit cũ hoặc mặc định
                category: 'FIXED', // Giả định
                description: 'Cấu hình từ trang quản lý (cập nhật)'
            },
            transaction: t
        });
        config.fee_type_id = feeType.id;
        config.name = name; // Cập nhật tên trên FeeConfig cũng để dễ debug
    }

    // LUÔN CẬP NHẬT ĐƠN VỊ TÍNH CỦA BẢNG CHUẨN
    if (unit) {
        await FeeType.update(
            { unit: unit },
            { where: { id: config.fee_type_id }, transaction: t }
        );
    }

    await config.save({ transaction: t });
    await t.commit();
    
    // Trả về bản ghi đầy đủ với FeeType
    const finalConfig = await FeeConfig.findByPk(config.id, {
      include: [{ model: FeeType }]
    });

    res.json(finalConfig);
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: err.message });
  }
};

// 4. XÓA PHÍ
exports.deleteFee = async (req, res) => {
  try {
    // Chỉ xóa cấu hình giá, không xóa Loại phí (vì có thể dùng cho lịch sử cũ)
    await FeeConfig.destroy({ where: { id: req.params.id } });
    res.json({ message: "Đã xóa cấu hình phí" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};