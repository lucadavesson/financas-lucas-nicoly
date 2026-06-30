/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FAF3E0',
          100: '#F5EDD8',
          200: '#E8D5A3',
          300: '#C9A87C',
          400: '#8B6914',
          500: '#8B6914',
          600: '#5C4A0A',
          700: '#3D3007',
        },
        terra: {
          50:  '#FBF0EB',
          100: '#F5D5C3',
          400: '#C4622D',
          600: '#8B3F18',
        },
        marsala: {
          50:  '#F5EBEB',
          100: '#E8C8C8',
          400: '#7B3B3B',
          600: '#5A2525',
        },
        brown: {
          50:  '#F0E8E0',
          100: '#D4C4B0',
          400: '#5C3D2E',
          500: '#2C1810',
          600: '#1C1208',
        },
        cream: '#FAF7F4',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
