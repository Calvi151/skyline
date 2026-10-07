import type { Config } from 'tailwindcss'

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: token('page'),
        panel: token('panel'),
        raised: token('raised'),
        ink: token('ink'),
        subtle: token('subtle'),
        line: token('line'),
        tint: token('tint'),
        chrome: token('chrome'),
        'on-chrome': token('on-chrome'),
        brand: token('brand'),
        'brand-hover': token('brand-hover'),
        'brand-fg': token('brand-fg'),
        'brand-panel': token('brand-panel'),
        signal: token('signal'),
        'on-signal': token('on-signal'),
        success: token('success'),
        danger: token('danger'),
        'sky-end': token('sky-end'),
      },
      borderRadius: { control: '8px', ticket: '16px' },
      fontFamily: {
        sans: ['"Schibsted Grotesk"', '"Hanken Grotesk"', 'system-ui', 'sans-serif'],
      },
      maxWidth: { content: '1200px' },
    },
  },
  plugins: [],
} satisfies Config
