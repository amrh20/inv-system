/**
 * Design System - Tailwind Theme
 * Note: Tailwind v4 uses @theme in CSS by default.
 * Colors are defined in src/styles.scss. This file serves as reference
 * and can be loaded via @config "./tailwind.config.js" in styles if needed.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1e40af',
          dark: '#001529',
          success: '#52c41a',
          warning: '#faad14',
          error: '#ff4d4f',
          surface: '#f5f5f5',
        },
      },
      borderRadius: {
        brand: '6px',
      },
      height: {
        input: '38px',
      },
    },
  },
};
