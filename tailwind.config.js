/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			transitionTimingFunction: {
				'grid': 'cubic-bezier(.18,.92,.28,1.23)',
			}
		},
		fontFamily: {
			sans: ['Lexend', 'sans-serif']
		}
	},
	plugins: [require('daisyui'),],
	daisyui: {
		themes: [{
			dark: {
				"--rounded-btn": "0.2rem",
				"--rounded-box": "0.2rem",

				"primary": "#edede9",
				"secondary": "#f2e9e4",
				"accent": "#e9d5ff",
				"neutral": "#5e503f",

				"base-100": "#272D2D",

				"info": "#bae6fd",
				"success": "#bbf7d0",
				"warning": "#fde68a",
				"error": "#fca5a5",
			}, light: {

				"--rounded-btn": "0.2rem",
				"--rounded-box": "0.2rem",

				"primary": "#353535",
				"secondary": "#354f52",
				"accent": "#e9d5ff",
				"neutral": "#f5ebe0",
				
				"base-100": "#edede9",

				"info": "#bae6fd",
				"success": "#bbf7d0",
				"warning": "#fde68a",
				"error": "#720026",

			},
		}],
		base: true,
		styled: true,
		utils: true,
		logs: false,
	},

};
