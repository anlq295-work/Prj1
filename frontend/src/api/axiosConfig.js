import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Đảm bảo Backend chạy port 5000
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- API PHÍ (FEES) ---
export const getFees = () => api.get('/fees');
export const createFee = (data) => api.post('/fees', data);
export const toggleFee = (id) => api.put(`/fees/${id}/toggle`);

// --- API HÓA ĐƠN (INVOICES) ---
export const generateInvoices = (month, year) => api.post('/invoices/generate', { month, year });
export const searchInvoices = (params) => api.get('/invoices/search', { params });
export const publishInvoices = (month, year) => api.post('/invoices/publish', { month, year });
export const payInvoice = (id, method) => api.post(`/invoices/${id}/pay`, { method });

// --- API AUTH (LOGIN) ---
// Giả lập login nếu chưa có API backend thực tế
export const loginUser = async (username, password) => {
    // Nếu bạn đã làm API login ở backend thì gọi api.post('/auth/login'...)
    // Ở đây tôi giả lập trả về user admin để demo Frontend chạy được ngay
    if(username === 'admin' && password === '123') {
        return { role: 'ADMIN', name: 'Quản Trị Viên', token: 'fake-jwt-token' };
    }
    throw new Error('Sai tài khoản hoặc mật khẩu');
};

export default api;