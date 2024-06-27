/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'selector',
  theme: {
    fontSize: {
      xs: '0.56rem',
      sm: '0.75rem',
      base: '1rem',
      lg: '1.33rem',
      xl: '1.78rem',
      '2xl': '2.37rem',
      '3xl': '3.16rem',
      '4xl': '4.21rem',
      '5xl': '5.61rem',
      '6xl': '7.48rem',
      '7xl': '9.97rem'
    },
    colors: {
      // Dark Mode
      'dark-content': '#EDEDE9',
      'dark-content-secondary': '#F5EBE0',
      'dark-base': '#282D2D;',
      dark: {
        50: '#CED4D4',
        100: '#C1C8C8',
        200: '#A6B0B0',
        300: '#8B9898',
        400: '#717F7F',
        500: '#596464',
        600: '#414949',
        700: '#282D2D',
        800: '#1F2323',
        900: '#181B1B',
        950: '#131616'
      },

      // Light Mode
      'light-content': '#272D2D',
      'light-content-secondary': '#5E503F',
      'light-base': '#EDEDE9',
      light: {
        50: '#f7f7f5',
        100: '#edede9',
        200: '#d8d7d0',
        300: '#bfbfb2',
        400: '#a5a392',
        500: '#938f7c',
        600: '#868070',
        700: '#706b5e',
        800: '#5d594f',
        900: '#4c4842',
        950: '#282622'
      }
    },
    fontFamily: {
      sans: ['Lexend', 'sans-serif']
    }
  },
  plugins: []
};
// module.exports = {
//   content: ['./src/**/*.{html,js,svelte,ts}'],
//   theme: {
//     extend: {
//       transitionTimingFunction: {
//         grid: 'cubic-bezier(.18,.92,.28,1.23)'
//       }
//     },
//     fontFamily: {
//       sans: ['Lexend', 'sans-serif']
//     }
//   },
//   plugins: [require('daisyui')],
//   daisyui: {
//     themes: [
//       {
//         dark: {
//           '--rounded-btn': '0.2rem',
//           '--rounded-box': '0.2rem',

//           primary: '#edede9',
//           secondary: '#f2e9e4',
//           accent: '#e9d5ff',
//           neutral: '#5e503f',

//           'base-100': '#272D2D',

//           info: '#bae6fd',
//           success: '#bbf7d0',
//           warning: '#fde68a',
//           error: '#fca5a5'
//         },
//         light: {
//           '--rounded-btn': '0.2rem',
//           '--rounded-box': '0.2rem',

//           primary: '#353535',
//           secondary: '#354f52',
//           accent: '#e9d5ff',
//           neutral: '#f5ebe0',

//           'base-100': '#edede9',

//           info: '#bae6fd',
//           success: '#bbf7d0',
//           warning: '#fde68a',
//           error: '#720026'
//         }
//       }
//     ],
//     base: true,
//     styled: true,
//     utils: true,
//     logs: false
//   }
// };
