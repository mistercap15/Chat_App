import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const STORAGE_KEY = 'user-selected-theme'; // 'dark' | 'light' | null

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemTheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(systemTheme === 'dark');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedTheme === 'dark') setIsDarkMode(true);
        else if (savedTheme === 'light') setIsDarkMode(false);
        else setIsDarkMode(systemTheme === 'dark'); // fallback
      } catch (e) {
        console.warn('Failed to load theme', e);
      } finally {
        setLoading(false);
      }
    };
    loadTheme();
  }, [systemTheme]);

  const toggleTheme = async () => {
    const newTheme = !isDarkMode ? 'dark' : 'light';
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newTheme);
    } catch (e) {
      console.warn('Failed to save theme', e);
    }
    setIsDarkMode(!isDarkMode);
  };

  if (loading) return null; // or splash screen while loading theme

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
