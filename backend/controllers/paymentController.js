const fs = require('fs');
const path = require('path');

// Đường dẫn file lưu cấu hình (nằm ở thư mục gốc của backend)
const CONFIG_FILE = path.join(__dirname, '../payment_config.json');

// Cấu hình mặc định (nếu chưa có file)
const DEFAULT_CONFIG = {
    bank_id: 'MB',
    account_no: '0000000000',
    account_name: 'BAN QUAN LY',
    template: '3AoGQeA'
};

// 1. Lấy cấu hình
exports.getConfig = (req, res) => {
    try {
        // Kiểm tra nếu file chưa tồn tại thì trả về mặc định
        if (!fs.existsSync(CONFIG_FILE)) {
            return res.json(DEFAULT_CONFIG);
        }
        
        // Đọc file
        const rawData = fs.readFileSync(CONFIG_FILE, 'utf8');
        const config = JSON.parse(rawData);
        res.json(config);
    } catch (err) {
        console.error("Read Config Error:", err);
        res.json(DEFAULT_CONFIG); // Lỗi thì trả về mặc định cho an toàn
    }
};

// 2. Cập nhật cấu hình (Admin lưu)
exports.updateConfig = (req, res) => {
    try {
        const { bank_id, account_no, account_name, template } = req.body;

        const newConfig = {
            bank_id,
            account_no,
            account_name: account_name.toUpperCase(), // Tự động viết hoa tên
            template: template || '3AoGQeA'
        };

        // Ghi đè vào file JSON
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf8');

        res.json({ message: "Đã lưu cấu hình thành công!", data: newConfig });
    } catch (err) {
        console.error("Write Config Error:", err);
        res.status(500).json({ message: "Lỗi khi lưu file: " + err.message });
    }
};