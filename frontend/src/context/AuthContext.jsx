import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('resqnet_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUser(res.data);
          setLoading(false);
        })
        .catch(() => {
          logout();
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { access_token, user_id, role, full_name } = res.data;
    localStorage.setItem('resqnet_token', access_token);
    setToken(access_token);
    setUser({ id: user_id, email, role, full_name });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('resqnet_token');
    setToken(null);
    setUser(null);
  };

  const switchRole = async (targetRole) => {
    // Helper to log into default seeded account for quick role testing
    const defaultAccounts = {
      user: { email: 'user@resqnet.com', password: 'password123' },
      family: { email: 'family@resqnet.com', password: 'password123' },
      doctor: { email: 'doctor@resqnet.com', password: 'password123' },
      hospital: { email: 'hospital@resqnet.com', password: 'password123' },
      admin: { email: 'admin@resqnet.com', password: 'password123' },
    };

    if (defaultAccounts[targetRole]) {
      const { email, password } = defaultAccounts[targetRole];
      await login(email, password);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
