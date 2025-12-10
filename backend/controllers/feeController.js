const { FeeConfig } = require('../models');

exports.createFee = async (req, res) => {
    try {
        const newFee = await FeeConfig.create(req.body);
        res.status(201).json(newFee);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getFees = async (req, res) => {
    try {
        const fees = await FeeConfig.findAll({ order: [['createdAt', 'DESC']] });
        res.json(fees);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.toggleFeeStatus = async (req, res) => {
    try {
        const fee = await FeeConfig.findByPk(req.params.id);
        if (!fee) return res.status(404).json({ error: 'Not found' });
        fee.is_active = !fee.is_active;
        await fee.save();
        res.json(fee);
    } catch (err) { res.status(500).json({ error: err.message }); }
};