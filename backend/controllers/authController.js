const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserProfile = require('../models/UserProfile'); // Để lấy tên thật và avatar

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        // 1. Tìm user trong DB
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(401).json({ message: "Tài khoản không tồn tại!" });
        }

        // 2. Kiểm tra trạng thái hoạt động
        if (!user.is_active) {
            return res.status(403).json({ message: "Tài khoản đã bị khóa!" });
        }

        // 3. So sánh mật khẩu (Hash)
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: "Mật khẩu không đúng!" });
        }

        // 4. Lấy thông tin Profile (nếu có) để hiển thị tên đẹp
        const profile = await UserProfile.findOne({ where: { userId: user.id } });
        const displayName = profile ? profile.fullName : user.username;
        const avatarUrl = profile ? profile.avatarUrl : `https://ui-avatars.com/api/?name=${displayName}&background=random`;

        // 5. Tạo JWT Token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'secret_key_tam_thoi', // Nên để trong .env
            { expiresIn: '1d' }
        );

        // 6. Trả về Client
        res.json({
            message: "Đăng nhập thành công",
            token: token,
            user: {
                id: user.id,
                username: user.username,
                name: displayName,
                role: user.role,
                avatar: avatarUrl
            }
        });

    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        res.status(500).json({ message: "Lỗi Server" });
    }
};

exports.changePassword = async (req, res) => {
    try {
        // Lấy userId từ token (được middleware auth gán vào req.user)
        // Hoặc gửi kèm userId trong body (tùy middleware của bạn)
        // Ở đây giả sử bạn gửi username lên để tìm user
        const { username, oldPassword, newPassword } = req.body;

        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy tài khoản!" });
        }

        // 1. Kiểm tra mật khẩu cũ
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Mật khẩu cũ không đúng!" });
        }

        // 2. Mã hóa mật khẩu mới
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 3. Cập nhật
        user.password = hashedPassword;
        await user.save();

        res.json({ message: "Đổi mật khẩu thành công!" });

    } catch (err) {
        console.error("Lỗi đổi pass:", err);
        res.status(500).json({ error: err.message });
    }
};