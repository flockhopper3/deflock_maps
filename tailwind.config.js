/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
      '3xl': '1920px',   // Full HD+
      '4xl': '2560px',   // QHD / 2K
    },
    extend: {
      colors: {
        dark: {
          900: '#0a0a0f',
          800: '#101018',
          700: '#1a1a24',
          600: '#252530',
          500: '#6b7280',
          400: '#9ca3af',
          300: '#d1d5db',
          200: '#e5e7eb',
          100: '#f3f4f6',
        },
        accent: {
          DEFAULT: '#0080BC',
          hover: '#0095d9',
          muted: 'rgba(0,128,188,0.12)',
        },
        route: {
          direct: '#e5a04d',
          avoid: '#0080BC',
        },
        danger: '#ef4444',
        success: '#22c55e',
        background: '#0a0a0f',
        foreground: '#f3f4f6',
        card: { DEFAULT: '#101018', foreground: '#f3f4f6' },
        popover: { DEFAULT: '#101018', foreground: '#f3f4f6' },
        primary: { DEFAULT: '#0080BC', foreground: '#fafafa' },
        secondary: { DEFAULT: '#1a1a24', foreground: '#f3f4f6' },
        muted: { DEFAULT: '#252530', foreground: '#9ca3af' },
        destructive: { DEFAULT: '#ef4444', foreground: '#fafafa' },
        border: '#252530',
        input: '#1a1a24',
        ring: '#0080BC',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.25rem' }],
        'sm': ['0.875rem', { lineHeight: '1.375rem' }],
        'base': ['0.9375rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.625rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
        'slide-up': 'slideUp 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
