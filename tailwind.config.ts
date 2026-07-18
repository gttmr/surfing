import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      sm: "10000px",
      md: "11000px",
      lg: "12000px",
      xl: "13000px",
      "2xl": "14000px",
    },
    extend: {
      colors: {
        brand: {
          page: "var(--brand-page)",
          surface: "var(--brand-surface)",
          "surface-elevated": "var(--brand-surface-elevated)",
          "surface-strong": "var(--brand-surface-strong)",
          primary: "var(--brand-primary)",
          "primary-hover": "var(--brand-primary-hover)",
          "primary-soft": "var(--brand-primary-soft)",
          "primary-border": "var(--brand-primary-border)",
          text: "var(--brand-text)",
          "text-muted": "var(--brand-text-muted)",
          "text-subtle": "var(--brand-text-subtle)",
          divider: "var(--brand-divider)",
          ring: "var(--brand-ring)",
          focus: "var(--brand-focus-outer)",
          overlay: "var(--brand-overlay)",
          companion: "var(--brand-companion)",
          success: "var(--brand-success)",
          "success-surface": "var(--brand-success-surface)",
          "success-text": "var(--brand-success-text)",
          "preparing-surface": "var(--brand-preparing-surface)",
          "preparing-text": "var(--brand-preparing-text)",
          danger: "var(--brand-danger)",
          "danger-surface": "var(--brand-danger-surface)",
          "danger-text": "var(--brand-danger-text)",
          error: "var(--brand-error)",
        },
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      fontFamily: {
        headline: ["var(--font-headline)"],
        body: ["var(--font-sans)"],
        label: ["var(--font-sans)"],
        sans: ["var(--font-sans)"],
      },
      backgroundImage: {
        "hero-gradient":
          "linear-gradient(135deg, var(--brand-primary-border) 0%, var(--brand-primary) 100%)",
      },
      boxShadow: {
        brand: "var(--brand-frame-shadow)",
        header: "var(--brand-header-shadow)",
        avatar: "var(--brand-avatar-shadow)",
      },
    },
  },
  plugins: [],
};

export default config;
