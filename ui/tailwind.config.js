/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0b0d11',
          surface: '#11151c',
          elevated: '#161b24',
          border: '#1f2632',
          hover: '#1c2230',
        },
        text: {
          primary: '#e6e9ef',
          secondary: '#9ba4b3',
          muted: '#5d6675',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#5051e3',
          subtle: '#1e1f3a',
        },
        success: '#10b981',
        warning: '#f59e0b',
        critical: '#ef4444',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
