/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#e6e6e6',
          100: '#e6e6e6',
          200: '#b3b3b3',
          300: '#b3b3b3',
          400: '#808080',
          500: '#808080',
          600: '#4d4d4d',
          700: '#4d4d4d',
          800: '#4d4d4d',
          900: '#1a1a1a',
          950: '#1a1a1a',
        },
        income: {
          DEFAULT: '#4d4d4d',
          light: '#e6e6e6',
          dark: '#808080',
        },
        expense: {
          DEFAULT: '#1a1a1a',
          light: '#e6e6e6',
          dark: '#4d4d4d',
        },
        brand: {
          50: '#e6e6e6',
          100: '#e6e6e6',
          500: '#808080',
          600: '#4d4d4d',
          700: '#1a1a1a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)',
        nav: '0 -1px 6px 0 rgba(0,0,0,0.06)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};
