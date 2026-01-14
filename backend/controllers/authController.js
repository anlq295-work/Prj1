const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, UserProfile } = require('../models');

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        // 1. Tìm user
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(401).json({ message: "Tài khoản không tồn tại!" });
        }

        // 2. Kiểm tra active
        if (!user.is_active) {
            return res.status(403).json({ message: "Tài khoản đã bị khóa!" });
        }

        // 3. So sánh mật khẩu
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: "Mật khẩu không đúng!" });
        }

        // 4. Lấy Profile (1-1) - Không cần include, query rời cho nhẹ hoặc include với alias 'Profile'
        const profile = await UserProfile.findOne({ where: { user_id: user.id } });
        
        // Map data từ snake_case (DB) sang camelCase (API response)
        const displayName = profile ? profile.full_name : user.username;
        const avatarUrl = profile ? profile.avatar_url : `https://ui-avatars.com/api/?name=${displayName}&background=random`;

        // 5. Tạo Token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'secret_key_demo',
            { expiresIn: '1d' }
        );

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
        console.error("Login Error:", error);
        res.status(500).json({ message: "Lỗi Server" });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { username, oldPassword, newPassword } = req.body;
        const user = await User.findOne({ where: { username } });
        
        if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản!" });

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: "Mật khẩu cũ không đúng!" });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: "Đổi mật khẩu thành công!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};