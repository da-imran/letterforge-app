'use client'

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/types';
import { api } from '@/lib/api';

interface UserContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUserId = localStorage.getItem('letterforge_user_id');
    if (storedUserId) {
      api.getUserById(storedUserId)
        .then((fetchedUser) => {
          if (fetchedUser) {
            setUser(fetchedUser);
          } else {
            localStorage.removeItem('letterforge_user_id');
          }
        })
        .catch(() => {
          localStorage.removeItem('letterforge_user_id');
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string) => {
    try {
      // First try to create user directly (backend handles duplicates)
      let targetUser = await api.createUser(email);

      // If creation failed (409 email exists), try to fetch existing user
      if (!targetUser) {
        targetUser = await api.getUserByEmail(email);
      }

      if (!targetUser) {
        throw new Error("Could not initialize user session. The forge might be temporarily unavailable.");
      }

      setUser(targetUser);
      localStorage.setItem('letterforge_user_id', targetUser._id);
    } catch (error: any) {
      console.error("Login session failure:", error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('letterforge_user_id');
  };

  const refreshUser = async () => {
    if (user?._id) {
      try {
        const updated = await api.getUserById(user._id);
        if (updated) {
          setUser(updated);
        }
      } catch (e) {
        console.error("User refresh error:", e);
      }
    }
  };

  return (
    <UserContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
};
