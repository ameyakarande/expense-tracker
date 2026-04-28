/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#171719',
        canvas: '#F5F5F7',
        line: '#E6E7EB',
        positive: '#179C62',
        danger: '#D74C45',
        brand: '#0F766E',
        sky: '#DDF5F2',
      },
      boxShadow: {
        panel: '0 20px 60px rgba(16, 24, 40, 0.08)',
        soft: '0 10px 30px rgba(15, 23, 42, 0.06)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: 0, transform: 'translateY(18px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        pulsebar: {
          '0%': { transform: 'scaleX(0.6)', opacity: 0.65 },
          '100%': { transform: 'scaleX(1)', opacity: 1 },
        },
      },
      animation: {
        rise: 'rise 0.45s ease-out',
        pulsebar: 'pulsebar 0.7s ease-out',
      },
    },
  },
  plugins: [],
}
