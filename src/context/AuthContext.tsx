import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Subscription } from '../types';
import { api, clearToken, getToken, setToken } from '../lib/api';

interface AuthContextType {
  user: User | null;
  subscription: Subscription | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const curToken = getToken();
    if (!curToken) {
      setUser(null);
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      setUser(data.user);
      setSubscription(data.subscription);
    } catch {
      clearToken();
      setTokenState(null);
      setUser(null);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.login({ email, password: pass });
    setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    await refreshUser();
  };

  const register = async (email: string, pass: string, name: string) => {
    const res = await api.register({ email, password: pass, name });
    setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    await refreshUser();
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Continue cleanup on failure
    }
    clearToken();
    setTokenState(null);
    setUser(null);
    setSubscription(null);
  };

  return (
    <AuthContext.Provider value={{ user, subscription, token, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
