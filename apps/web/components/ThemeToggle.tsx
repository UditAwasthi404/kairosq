'use client';

import { Moon, Sun } from 'lucide-react';

import { THEME_STORAGE_KEY } from '@/lib/theme';
import styles from '@/styles/shell.module.css';

function applyTheme(next: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label="Toggle color theme"
      onClick={() => {
        const current = document.documentElement.getAttribute('data-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark');
      }}
    >
      <Sun className={styles.iconWhenLight} size={18} aria-hidden="true" />
      <Moon className={styles.iconWhenDark} size={18} aria-hidden="true" />
    </button>
  );
}
