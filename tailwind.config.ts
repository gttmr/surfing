import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bmw: {
          blue: "#1c69d4",
          focus: "#0653b6",
          black: "#262626",
          gray: "#757575",
          silver: "#bbbbbb",
        },
        primary: {
          DEFAULT: "#1c69d4",
          hover: "#0653b6",
          dark: "#0653b6",
        },
      },
      fontFamily: {
        sans: ["Helvetica", "Arial", "sans-serif"],
        display: ["Helvetica", "Arial", "sans-serif"],
      },
      lineHeight: {
        tight: "1.15",
        hero: "1.30",
      },
      borderRadius: {
        none: '0px',
        sm: '0px',
        DEFAULT: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '0px',
      },
    },
  },
  plugins: [],
};

export default config;
