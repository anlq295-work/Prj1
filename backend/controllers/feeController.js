const { FeeDefinition } = require('../models');

exports.getAllFees = async (req, res) => {
  try {
    const fees = await FeeDefinition.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(fees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFeeTypes = async (req, res) => {
    // Trả về danh sách cứng các loại danh mục phí hệ thống hỗ trợ
    // ID ở đây sẽ đóng vai trò là 'category' trong database
    res.json([
        { id: 'ELECTRIC', name: 'Điện sinh hoạt', unit: 'kWh' },
        { id: 'WATER', name: 'Nước sạch', unit: 'm3' },
        { id: 'AREA', name: 'Diện tích', unit: 'm2'},
        { id: 'SERVICE', name: 'Dịch vụ chung cư', unit: 'Tháng' },
        { id: 'PARKING', name: 'Gửi xe', unit: 'Chiếc' },
        { id: 'OTHER', name: 'Khác', unit: 'Lần' }
    ]);
};

exports.createFee = async (req, res) => {
  try {
    const { name, category, calc_method, unit_price, tier_config, unit } = req.body;

    const newFee = await FeeDefinition.create({
      name,
      category, // 'SERVICE', 'WATER', 'ELECTRIC', 'PARKING'
      calc_method,
      unit_price: unit_price || 0,
      tier_config: tier_config || null,
      unit: unit || '',
      is_active: true
    });

    res.status(201).json(newFee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateFee = async (req, res) => {
  const { id } = req.params;
  try {
    const fee = await FeeDefinition.findByPk(id);
    if (!fee) return res.status(404).json({ message: "Không tìm thấy phí" });

    await fee.update(req.body);
    res.json(fee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteFee = async (req, res) => {
    try {
        await FeeDefinition.destroy({ where: { id: req.params.id } });
        res.json({ message: "Đã xóa thành công" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}