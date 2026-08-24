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
          "primary-foreground": "var(--brand-primary-foreground)",
          "primary-soft": "var(--brand-primary-soft)",
          "primary-soft-strong": "var(--brand-primary-soft-strong)",
          "primary-soft-accent": "var(--brand-primary-soft-accent)",
          "primary-border": "var(--brand-primary-border)",
          "primary-border-strong": "var(--brand-primary-border-strong)",
          "primary-text": "var(--brand-primary-text)",
          text: "var(--brand-text)",
          "text-muted": "var(--brand-text-muted)",
          "text-subtle": "var(--brand-text-subtle)",
          divider: "var(--brand-divider)",
          "divider-strong": "var(--brand-divider-strong)",
          "dimmed-surface": "var(--brand-dimmed-surface)",
          "dimmed-border": "var(--brand-dimmed-border)",
          "dimmed-text": "var(--brand-dimmed-text)",
          ring: "var(--brand-ring)",
          focus: "var(--brand-focus-outer)",
          overlay: "var(--brand-overlay)",
          companion: "var(--brand-companion)",
          "calendar-sun": "var(--brand-calendar-sun)",
          "calendar-sat": "var(--brand-calendar-sat)",
          success: "var(--brand-success)",
          "success-surface": "var(--brand-success-surface)",
          "success-text": "var(--brand-success-text)",
          "preparing-surface": "var(--brand-preparing-surface)",
          "preparing-text": "var(--brand-preparing-text)",
          danger: "var(--brand-danger)",
          "danger-surface": "var(--brand-danger-surface)",
          "danger-text": "var(--brand-danger-text)",
          error: "var(--brand-error)",
          "surface-glass": "var(--brand-surface-glass)",
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
