'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@/types';
import { api, getToken, setToken, onUnauthorized } from '@/lib/api';

interface UserContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (getToken()) {
      api.getMe()
        .then((fetchedUser) => {
          if (!cancelled) setUser(fetchedUser);
        })
        .catch(() => {
          // getMe already clears the token and fires the unauthorized event on 401.
          if (!cancelled) setUser(null);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    const offUnauthorized = onUnauthorized(() => {
      if (!cancelled) setUser(null);
    });

    return () => {
      cancelled = true;
      offUnauthorized();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user: loggedInUser } = await api.login(email, password);
    setToken(token);
    setUser(loggedInUser);
  };

  const register = async (email: string, password: string, nickname?: string) => {
    const { token, user: registeredUser } = await api.register(email, password, nickname);
    setToken(token);
    setUser(registeredUser);
  };

  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    try {
      const updated = await api.getMe();
      setUser(updated);
    } catch (e) {
      console.error('User refresh error:', e);
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
};
