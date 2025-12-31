import axios from 'axios';

// 1. Tạo instance Axios
const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Đảm bảo Backend chạy port 5000
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. Cấu hình Interceptor (Quan trọng)
// Tự động lấy Token từ LocalStorage và gắn vào Header mỗi khi gọi API
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. Xử lý lỗi toàn cục (Optional)
// Nếu Token hết hạn (Lỗi 401), tự động đăng xuất
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token hết hạn hoặc không hợp lệ -> Xóa token và reload trang (hoặc redirect login)
      localStorage.removeItem('token');
      // window.location.href = '/login'; // Bỏ comment dòng này nếu muốn tự động đá về trang login
    }
    return Promise.reject(error);
  }
);

// --- API AUTH (XÁC THỰC) ---
export const loginUser = async (username, password) => {
    // Gọi API login thực tế của Backend
    const response = await api.post('/auth/login', { username, password });
    return response.data; // Trả về { message, token, user }
};

// --- API PHÍ (FEES) ---
export const getFees = () => api.get('/fees');
export const createFee = (data) => api.post('/fees', data);
export const updateFee = (id, data) => api.put(`/fees/${id}`, data);
export const deleteFee = (id) => api.delete(`/fees/${id}`);

// --- API HÓA ĐƠN (INVOICES) ---
// Lưu ý: Backend dùng route /invoices, hãy đảm bảo server.js map đúng route
export const generateInvoices = (month, year) => api.post('/invoices/generate', { month, year });

// Tìm kiếm hóa đơn
export const searchInvoices = (params) => api.get('/invoices/search', { params }); 

// Phát hành hóa đơn (Draft -> Pending)
export const publishInvoices = (month, year) => api.post('/invoices/publish', { month, year });

// Thanh toán hóa đơn
export const payInvoice = (id, method) => api.post(`/invoices/${id}/pay`, { method });

// [MỚI] Thêm phí lẻ/phát sinh thủ công (Ad-hoc)
export const addAdHocFee = (data) => api.post('/invoices/add-item', data);

// --- API CĂN HỘ / CƯ DÂN (Dùng cho dropdown) ---
// Nếu bạn cần lấy danh sách căn hộ để dropdown chọn
export const getApartments = () => api.get('/apartments');

export const getUsages = (month, year) => api.get('/usage', { params: { month, year } });
export const saveUsages = (data) => api.post('/usage', data);

export default api;