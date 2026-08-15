import axios from 'axios';

let envUrl = (import.meta.env.VITE_API_URL || '').trim();

if (!envUrl) {
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    envUrl = 'https://res-qnet-gilt.vercel.app';
  }
}

const rawBaseUrl = envUrl.replace(/\/$/, '');
let API_BASE_URL = '/api';

if (rawBaseUrl) {
  API_BASE_URL = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('resqnet_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
