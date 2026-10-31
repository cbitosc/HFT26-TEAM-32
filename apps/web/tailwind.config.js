/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        card: '#111827',
        border: '#1f293d',
        primary: {
          DEFAULT: '#3b82f6',
          foreground: '#ffffff',
          hover: '#2563eb'
        },
        cyber: {
          green: '#10b981',
          red: '#ef4444',
          amber: '#f59e0b',
          blue: '#06b6d4',
          purple: '#8b5cf6'
        }
      }
    },
  },
  plugins: [],
}

