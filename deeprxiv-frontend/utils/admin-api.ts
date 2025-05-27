import axios from 'axios'
import { useAuthStore } from './auth-store'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Create axios instance
const adminApi = axios.create({
  baseURL: `${API_BASE_URL}/admin`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth interceptor
adminApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Add response interceptor for error handling
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  register: (userData: { email: string; password: string; full_name?: string }) =>
    adminApi.post('/auth/register', userData),

  login: (credentials: { email: string; password: string }) =>
    adminApi.post('/auth/login', credentials),

  googleAuth: (accessToken: string) =>
    adminApi.post('/auth/oauth/google', { access_token: accessToken }),

  githubAuth: (accessToken: string) =>
    adminApi.post('/auth/oauth/github', { access_token: accessToken }),
}

// Analytics API
export const analyticsApi = {
  getOverview: (days = 30) =>
    adminApi.get('/analytics/overview', { params: { days } }),

  getUserAnalytics: (days = 30) =>
    adminApi.get('/analytics/users', { params: { days } }),

  getPaperAnalytics: (days = 30) =>
    adminApi.get('/analytics/papers', { params: { days } }),

  getChatAnalytics: (days = 30) =>
    adminApi.get('/analytics/chats', { params: { days } }),

  getFeedbackAnalytics: (days = 30) =>
    adminApi.get('/analytics/feedback', { params: { days } }),

  getSystemAnalytics: (days = 30) =>
    adminApi.get('/analytics/system', { params: { days } }),
}

// User Management API
export const userApi = {
  getUsers: (params?: { skip?: number; limit?: number; search?: string }) =>
    adminApi.get('/users', { params }),

  getUser: (userId: number) =>
    adminApi.get(`/users/${userId}`),

  updateUser: (userId: number, userData: { full_name?: string; is_admin?: boolean; is_verified?: boolean }) =>
    adminApi.put(`/users/${userId}`, userData),
}

// Feedback API
export const feedbackApi = {
  getFeedback: (params?: { skip?: number; limit?: number; status?: string; feedback_type?: string }) =>
    adminApi.get('/feedback', { params }),

  respondToFeedback: (feedbackId: number, response: { response: string; status?: string }) =>
    adminApi.put(`/feedback/${feedbackId}/respond`, response),
}

// Settings API
export const settingsApi = {
  getSettings: () =>
    adminApi.get('/settings'),

  updateSetting: (setting: { key: string; value: string; description?: string; setting_type?: string }) =>
    adminApi.put('/settings', setting),
}

// System API
export const systemApi = {
  getSystemInfo: () =>
    adminApi.get('/system/info'),
}

export default adminApi 