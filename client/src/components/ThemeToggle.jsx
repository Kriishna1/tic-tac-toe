import React from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="theme-toggle">
      <label className="switch">
        <input
          type="checkbox"
          checked={theme === 'dark'}
          onChange={toggleTheme}
        />
        <span className="slider"></span>
      </label>
      <span className="theme-label">{theme === 'dark' ? '🌙' : '☀️'}</span>
    </div>
  );
}

export default ThemeToggle;
