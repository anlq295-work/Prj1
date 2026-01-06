const { FeeConfig, FeeType, sequelize } = require('../models');

// 1. LẤY DANH SÁCH CẤU HÌNH PHÍ
exports.getAllFees = async (req, res) => {
  try {
    const fees = await FeeConfig.findAll({
      where: { is_active: true }, // Chỉ lấy cái đang hiện hành
      include: [{ model: FeeType }], // Join để lấy tên (Ví dụ: "Điện sinh hoạt")
      order: [['updated_at', 'DESC']]
    });
    res.json(fees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// 2. LẤY DANH SÁCH LOẠI PHÍ (Để đổ vào Dropdown khi tạo mới)
exports.getFeeTypes = async (req, res) => {
    try {
        const types = await FeeType.findAll({ order: [['name', 'ASC']] });
        res.json(types);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 3. TẠO CẤU HÌNH PHÍ MỚI
exports.createFee = async (req, res) => {
  try {
    const { name, fee_type_id, calc_method, unit_price, tier_config } = req.body;

    // Validate cơ bản
    if (!fee_type_id) return res.status(400).json({ message: "Phải chọn loại phí!" });

    const newConfig = await FeeConfig.create({
      name, // Tên bảng giá (VD: Giá điện 2024)
      fee_type_id,
      calc_method, // 'FIXED' hoặc 'TIERED'
      unit_price: calc_method === 'FIXED' ? unit_price : 0,
      tier_config: calc_method === 'TIERED' ? tier_config : null,
      is_active: true
    });

    // Trả về kèm thông tin FeeType
    const result = await FeeConfig.findByPk(newConfig.id, { include: [FeeType] });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. CẬP NHẬT CẤU HÌNH
exports.updateFee = async (req, res) => {
  const { id } = req.params;
  const { name, unit_price, calc_method, tier_config, is_active } = req.body;
  
  try {
    const config = await FeeConfig.findByPk(id);
    if (!config) return res.status(404).json({ message: "Không tìm thấy cấu hình" });

    // Cập nhật
    config.name = name || config.name;
    config.calc_method = calc_method || config.calc_method;
    config.tier_config = tier_config || config.tier_config;
    config.unit_price = unit_price !== undefined ? unit_price : config.unit_price;
    config.is_active = is_active !== undefined ? is_active : config.is_active;

    await config.save();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteFee = async (req, res) => {
    try {
        await FeeConfig.destroy({ where: { id: req.params.id } });
        res.json({ message: "Đã xóa thành công" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}