import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Industrial status colors
        status: {
          online: '#22c55e',
          warning: '#f59e0b',
          critical: '#ef4444',
          maintenance: '#3b82f6',
          offline: '#6b7280',
        },
        // Dark theme surface colors
        surface: {
          950: '#080c10',
          900: '#0d1117',
          850: '#111820',
          800: '#161d27',
          750: '#1a2232',
          700: '#1e283d',
          600: '#243048',
        },
        // Accent - industrial teal
        accent: {
          DEFAULT: '#0ea5e9',
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink': 'blink 1.2s step-end infinite',
        'slide-in': 'slideIn 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        slideIn: {
          from: { transform: 'translateY(-4px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      boxShadow: {
        'glow-green': '0 0 12px rgba(34,197,94,0.25)',
        'glow-amber': '0 0 12px rgba(245,158,11,0.25)',
        'glow-red': '0 0 12px rgba(239,68,68,0.25)',
        'glow-blue': '0 0 12px rgba(59,130,246,0.25)',
        'panel': '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
      },
    },
  },
  plugins: [],
}

export default config
