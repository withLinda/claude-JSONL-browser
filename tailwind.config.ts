import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Everforest Dark Theme Colors (Medium Contrast)
        everforest: {
          'bg-dim': '#232A2E',
          'bg0': '#2D353B',
          'bg1': '#343F44',
          'bg2': '#3D484D',
          'bg3': '#475258',
          'bg4': '#4F585E',
          'bg5': '#56635F',
          'bg-visual': '#543A48',
          'bg-red': '#514045',
          'bg-yellow': '#4D4C43',
          'bg-green': '#425047',
          'bg-blue': '#3A515D',
          'fg': '#D3C6AA',
          'red': '#E67E80',
          'orange': '#E69875',
          'yellow': '#DBBC7F',
          'green': '#A7C080',
          'aqua': '#83C092',
          'blue': '#7FBBB3',
          'purple': '#D699B6',
          'grey0': '#7A8478',
          'grey1': '#859289',
          'grey2': '#9DA9A0'
        }
      },
      fontFamily: {
        'mono': ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config