import axios from 'axios';

// 1. Định nghĩa URL gốc (Khai báo biến để dùng chung)
const API_URL = 'http://localhost:5000/api';

// 2. Tạo instance Axios
const api = axios.create({
  baseURL: API_URL, 
  headers: {
    'Content-Type': 'application/json',
  },
});

// 3. Interceptor: Tự động gắn Token vào Header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 4. Xử lý lỗi (Token hết hạn -> Auto logout)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      // Chỉ redirect nếu không phải đang ở trang login để tránh loop
      if (window.location.pathname !== '/login') {
          window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- AUTH API ---
export const loginUser = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    return res.data;
};

// --- FEE API (Quản lý Phí) ---
export const getFees = () => api.get('/fees');
export const getFeeTypes = () => api.get('/fees/types');
export const createFee = (data) => api.post('/fees', data);
export const updateFee = (id, data) => api.put(`/fees/${id}`, data);
export const deleteFee = (id) => api.delete(`/fees/${id}`);

// --- USAGE API (Chỉ số Điện/Nước) ---
export const getUsages = (month, year) => api.get('/usage', { params: { month, year } });
export const saveUsages = (data) => api.post('/usage', data);

// [ĐÃ SỬA] Import Excel
export const importUsages = (formData) => {
    // Sử dụng instance 'api' thay vì 'axios' thường để TỰ ĐỘNG CÓ TOKEN
    // Ghi đè Content-Type thành multipart/form-data
    return api.post('/usage/import', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

// --- INVOICE API (Biên lai) ---
export const generateInvoices = (data) => api.post('/invoices/generate', data);
export const searchInvoices = (params) => api.get('/invoices/search', { params });
export const publishInvoices = (month, year) => api.post('/invoices/publish', { month, year });
export const addAdHocFee = (data) => api.post('/invoices/add-item', data); 
export const updateInvoice = (id, data) => api.put(`/invoices/${id}`, data);
export const payInvoice = (id, data) => api.post(`/invoices/${id}/pay`, data);
export const publicPayInvoice = (id, data) => api.post(`/invoices/public/pay/${id}`, data); // API này có thể ko cần token, nhưng dùng api vẫn ok
export const getPaymentConfig = () => api.get('/payment-config');
export const updatePaymentConfig = (data) => api.post('/payment-config', data);
export const deleteInvoice = (id) => api.delete(`/invoices/${id}`);

export default api;