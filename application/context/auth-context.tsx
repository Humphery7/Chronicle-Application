import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { authApi, setAuthToken, UserProfile } from '@/lib/api';

const TOKEN_KEY = 'chronicle_auth_token';

// SecureStore has no web implementation, so we fall back to localStorage
// there. On native this is real encrypted keychain/keystore storage, which
// also fixes the old behaviour of losing the session on every app restart.
const tokenStorage = {
  getItem: async (): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(TOKEN_KEY);
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  setItem: async (value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(TOKEN_KEY, value);
      } catch {}
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, value);
    }
  },
  removeItem: async (): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {}
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  },
};

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  isLoading: boolean;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      router.replace('/login');
    } else if (token && inAuthGroup) {
      router.replace('/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `router` identity is not stable across renders
  }, [token, segments, isLoading]);

  const loadToken = async () => {
    try {
      const storedToken = await tokenStorage.getItem();
      if (storedToken) {
        setAuthToken(storedToken);
        setToken(storedToken);
        const profile = await fetchProfile();
        if (!profile) {
          // Token expired/invalid server-side -- clear it so the guard
          // above sends the user back to login instead of a dead session.
          await tokenStorage.removeItem();
          setAuthToken(null);
          setToken(null);
        }
      }
    } catch (e) {
      console.error('Failed to load token', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfile = async (): Promise<UserProfile | null> => {
    try {
      const profile = await authApi.me();
      setUser(profile);
      return profile;
    } catch (e) {
      console.error('Failed to fetch profile', e);
      return null;
    }
  };

  const signIn = async (newToken: string) => {
    await tokenStorage.setItem(newToken);
    setAuthToken(newToken);
    setToken(newToken);
    await fetchProfile();
  };

  const signOut = async () => {
    await tokenStorage.removeItem();
    setAuthToken(null);
    setToken(null);
    setUser(null);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider
      value={{ user, token, signIn, signOut, isLoading, refreshProfile: fetchProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
