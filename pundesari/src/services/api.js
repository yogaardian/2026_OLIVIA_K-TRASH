import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create axios instance with base config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ================= AUTH =================
export const authAPI = {
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  register: (data) => apiClient.post('/auth/register', data),
};


// ================= DASHBOARD =================
export const dashboardAPI = {
  // Admin Dashboard
  getAdminStats: () => apiClient.get('/stats/dashboard'),
  getTotalUsers: () => apiClient.get('/stats/total-users'),
  getDailyTransactions: () => apiClient.get('/stats/daily-transactions'),

  // User-specific data
  getUserBalance: (userId) => apiClient.get(`/user/balance/${userId}`),
  getUserTransactions: (userId) => apiClient.get(`/user/transactions/${userId}`),
  getUserOrders: (userId) => apiClient.get(`/orders/user/${userId}`),

  // Recent activities
  getRecentOrders: () => apiClient.get('/orders/recent'),
  getPendingOrders: () => apiClient.get('/orders/pending'),
};

// ================= ORDERS =================
export const ordersAPI = {
  // Get order detail
  getOrderDetail: (orderId) => apiClient.get(`/orders/${orderId}`),
  
  // Create order
  createOrder: (data) => apiClient.post('/orders', data),
  
  // Accept order (driver)
  acceptOrder: (orderId, driverId) => apiClient.patch(`/orders/accept/${orderId}`, {
    driver_id: driverId,
  }),
  
  // Update order status (driver)
  updateOrderStatus: (orderId, data) => apiClient.patch(`/orders/status/${orderId}`, data),
  
  // Approve order (admin)
  approveOrder: (orderId, data) => apiClient.patch(`/orders/approve/${orderId}`, data),
};

// ================= HARGA SAMPAH =================
export const hargaAPI = {
  getByJenis: (jenis) => apiClient.get(`/harga/${jenis}`),
  getByJenisAndSub: (jenis, sub) => apiClient.get(`/harga/${jenis}/${sub}`),
  addHarga: (data) => apiClient.post('/harga', data),
  updateHarga: (id, data) => apiClient.put(`/harga/${id}`, data),
  deleteHarga: (id) => apiClient.delete(`/harga/${id}`),
};

// ================= USERS =================
export const usersAPI = {
  getUsersByRole: (role) => apiClient.get(`/users/role/${role}`),
  createUser: (data) => apiClient.post('/users', data),
  deleteUser: (userId) => apiClient.delete(`/users/${userId}`),
  login: (email, password) => apiClient.post('/login', { email, password }),
  register: (data) => apiClient.post('/register', data),
};

// ================= TRANSACTIONS =================
export const transactionsAPI = {
  // Admin: Pending & All Transactions
  getPendingTransactions: () => apiClient.get('/admin/pending-transactions'),
  getAllTransactions: () => apiClient.get('/admin/transactions'),
  getTransactions: (params) => apiClient.get('/transactions', { params }),
  
  // Admin: Hold Balance Management
  getHoldSummary: () => apiClient.get('/admin/hold-summary'),
  getMinimumHoldBalance: () => apiClient.get('/admin/settings/hold-balance'),
  setMinimumHoldBalance: (amount) => apiClient.patch('/admin/settings/hold-balance', { amount }),
  
  // Admin: Top-up & Approval
  topupUser: (data) => apiClient.post('/admin/topup', data),
  approveTransaction: (transactionId, adminId) => apiClient.patch(`/admin/approve-transaction/${transactionId}`, {
    admin_id: adminId,
  }),
  rejectTransaction: (transactionId, adminId) => apiClient.patch(`/admin/reject-transaction/${transactionId}`, {
    admin_id: adminId,
  }),
};

// ================= MARKETPLACE =================
export const marketplaceAPI = {
  // Public
  getProducts: (params) => apiClient.get('/marketplace/products', { params }),
  getProduct: (id) => apiClient.get(`/marketplace/products/${id}`),
  
  // User
  createOrder: (productId, data) => apiClient.post(`/marketplace/products/${productId}/order`, data),
  getUserOrders: () => apiClient.get('/marketplace/user/orders'),
  
  // Admin
  createProduct: (data) => apiClient.post('/marketplace/products', data),
  updateProduct: (id, data) => apiClient.put(`/marketplace/products/${id}`, data),
  deleteProduct: (id) => apiClient.delete(`/marketplace/products/${id}`),
  getAllOrders: () => apiClient.get('/marketplace/orders'),
  getPendingOrders: () => apiClient.get('/marketplace/admin/orders/pending'),
  updateOrderStatus: (id, data) => apiClient.patch(`/marketplace/orders/${id}/status`, data),
};
export const locationAPI = {
  // Driver: Send location
  sendDriverLocation: (data) => apiClient.post('/driver/location', data),
  
  // Tracking
  getTracking: (orderId) => apiClient.get(`/tracking/${orderId}`),
};

// ================= WALLET =================
export const walletAPI = {
  getWallet: (userId) => apiClient.get(`/wallet/${userId}`),
  addBalance: (data) => apiClient.post('/admin/add-balance', data),
  withdraw: (data) => apiClient.post('/withdraw', data),
};

export default apiClient;