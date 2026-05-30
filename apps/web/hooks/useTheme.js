import { useState, useEffect, useCallback } from 'react';

/**
 * useTheme — reads and toggles the app's dark/light mode.
 *
 * - Source of truth: `localStorage.theme` ('dark' | 'light')
 * - Effect: `.dark` class on `document.documentElement`
 * - Default: 'light' (no prefers-color-scheme fallback)
 */
export function useTheme() {
  const [theme, setThemeState] = useState('light');

  // Read persisted preference on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      setThemeState(saved);
    }
  }, []);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    localStorage.setItem('theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
