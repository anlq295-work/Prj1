import axios from 'axios';
const API_URL = 'http://localhost:5000/api';

export const createFee = (data) => axios.post(`${API_URL}/fees`, data);
export const getFees = () => axios.get(`${API_URL}/fees`);
export const toggleFee = (id) => axios.put(`${API_URL}/fees/${id}/toggle`);
export const generateInv = (cycle) => axios.post(`${API_URL}/invoices/generate`, { billing_cycle: cycle });
export const searchInv = (params) => axios.get(`${API_URL}/invoices/search`, { params });
export const publishInv = (cycle) => axios.post(`${API_URL}/invoices/publish`, { cycle });
export const payInv = (id, method) => axios.post(`${API_URL}/invoices/${id}/pay`, { method });