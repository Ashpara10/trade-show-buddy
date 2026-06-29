/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,ts,tsx}',
    './app/**/*.{js,ts,tsx}',
    './components/**/*.{js,ts,tsx}',
    './lib/**/*.{js,ts,tsx}',
  ],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        // Bundled via expo-font from assets/fonts/. The 4 weight files
        // match Tailwind's normal/medium/semibold/bold modifiers.
        sans: ['Inter', 'Inter-Medium', 'Inter-SemiBold', 'Inter-Bold'],
        // Explicit weight names so the same TTF resolves to the right
        // face when a component does style={{ fontFamily: 'Inter-Bold' }}.
        inter: 'Inter',
        'inter-medium': 'Inter-Medium',
        'inter-semibold': 'Inter-SemiBold',
        'inter-bold': 'Inter-Bold',
      },
      colors: {
        // Brand accent used by the Logo and any spot highlights. Lime,
        // high-contrast on white. Pairs with the otto-* tokens below.
        brand: {
          DEFAULT: '#CBFD40',
          soft: '#ecffae',
        },
        // Otto brand tokens — mirror @tsb/app/globals.css so mobile screens
        // visually match the web app.
        'otto-bg': '#ffffff',
        'otto-bg-soft': '#fafaf9',
        'otto-card': '#ffffff',
        'otto-card-hover': '#f5f5f4',
        'otto-border': '#e7e5e4',
        'otto-border-strong': '#d6d3d1',
        'otto-text': '#1c1917',
        'otto-text-soft': '#44403c',
        'otto-muted': '#78716c',
        'otto-accent': '#16a34a',
        'otto-accent-hover': '#15803d',
        'otto-accent-soft': '#f0fdf4',
        'otto-success': '#16a34a',
        'otto-warning': '#f59e0b',
        'otto-danger': '#dc2626',
      },
    },
  },
  plugins: [],
};
