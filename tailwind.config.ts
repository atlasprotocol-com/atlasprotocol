import type { Config } from "tailwindcss";

// --secondary-50: #fffefb;
// --secondary-100: #fefaf0;
// --secondary-200: #fef3de;
// --secondary-300: #fdeac4;
// --secondary-400: #fcdea3;
// --secondary-500: #facf7a;
// --secondary-600: #f8be4a;
// --secondary-700: #f6ab13;
// --secondary-800: #8d6005;
// --secondary-900: #483103;
// --secondary-950: #312102;
// 'secondary dark gold/secondary dark gold-950': '#312102' },
const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      sm: "600px",
      md: "768px",
      lg: "1000px",
      xl: "1130px",
      "2xl": "1350px",
    },
    extend: {
      colors: {
        primary: "var(--primary)",
        "primary-50": "var(--primary-50)",
        "primary-100": "var(--primary-100)",
        "primary-200": "var(--primary-200)",
        "primary-300": "var(--primary-300)",
        "primary-400": "var(--primary-400)",
        "primary-500": "var(--primary-500)",
        "primary-600": "var(--primary-600)",
        "primary-700": "var(--primary-700)",
        "primary-800": "var(--primary-800)",
        "primary-900": "var(--primary-900)",
        "primary-950": "var(--primary-950)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: {
          50: "var(--secondary-50)",
          100: "var(--secondary-100)",
          200: "var(--secondary-200)",
          300: "var(--secondary-300)",
          400: "var(--secondary-400)",
          500: "var(--secondary-500)",
          600: "var(--secondary-600)",
          700: "var(--secondary-700)",
          800: "var(--secondary-800)",
          900: "var(--secondary-900)",
          950: "var(--secondary-950)",
        },
        neutral: {
          1: "var(--neutral-1)",
          2: "var(--neutral-2)",
          3: "var(--neutral-3)",
          4: "var(--neutral-4)",
          5: "var(--neutral-5)",
          6: "var(--neutral-6)",
          7: "var(--neutral-7)",
          8: "var(--neutral-8)",
          9: "var(--neutral-9)",
          10: "var(--neutral-10)",
          11: "var(--neutral-11)",
        },
        danger: "var(--danger)",
        success: "#5cb85c",
        text: "var(--text)",
        caption: "var(--caption)",
        bg: "var(--bg)",
        "card-bg": "var(--card-bg)",
        "header-bg": "var(--header-bg)",
        "header-border": "var(--header-border)",
        "footer-bg": "var(--footer-bg)",
        "footer-border": "var(--footer-border)",
        border: "var(--border)",
        "modal-bg": "var(--modal-bg)",
        "tab-list-border": "var(--tab-list-border)",
        "tab-active": {
          bg: "var(--tab-bg-active)",
          text: "var(--tab-text-active)",
          border: "var(--tab-border-active)",
        },
        input: {
          bg: "var(--input-bg)",
          border: "var(--input-border)",
        },
      },
      gridTemplateColumns: {
        stakingFinalityProvidersMobile: "2fr 1fr",
        stakingFinalityProvidersDesktop: "2fr 1.5fr 2fr 0.75fr",
      },
    },
  },
};
export default config;
