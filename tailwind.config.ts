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
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        display: ["var(--font-rajdhani)", "Rajdhani", "sans-serif"],
      },
      colors: {
        // Brand colors
        brand: {
          orange: {
            primary: "var(--brand-orange-primary)",
            secondary: "var(--brand-orange-secondary)",
            light: "var(--brand-orange-light)",
          },
          yellow: "var(--brand-yellow)",
          brown: "var(--brand-brown)",
          white: "var(--brand-white)",
          "off-white": "var(--brand-off-white)",
          gray: "var(--brand-gray)",
          "dark-gray": "var(--brand-dark-gray)",
          black: "var(--brand-black)",
        },
        // System colors
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          // Legacy color scale for backward compatibility
          50: "var(--primary-50)",
          100: "var(--primary-100)",
          200: "var(--primary-200)",
          300: "var(--primary-300)",
          400: "var(--primary-400)",
          500: "var(--primary-500)",
          600: "var(--primary-600)",
          700: "var(--primary-700)",
          800: "var(--primary-800)",
          900: "var(--primary-900)",
          950: "var(--primary-950)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
          // Legacy color scale for backward compatibility
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
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        // Legacy neutral colors for backward compatibility
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
        // Legacy semantic colors
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
        "modal-bg": "var(--modal-bg)",
        "tab-list-border": "var(--tab-list-border)",
        "tab-active": {
          bg: "var(--tab-bg-active)",
          text: "var(--tab-text-active)",
          border: "var(--tab-border-active)",
        },
        "input-bg": "var(--input-bg)",
        "input-border": "var(--input-border)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        DEFAULT: "var(--radius)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out forwards",
        "slide-up": "slideUp 0.7s ease-out forwards",
        "slide-in-right": "slideInRight 0.7s ease-out forwards",
        "scale-in": "scaleIn 0.5s ease-out forwards",
        float: "float 4s ease-in-out infinite",
        "pulse-subtle": "pulsate 2s ease-in-out infinite",
      },
      gridTemplateColumns: {
        stakingFinalityProvidersMobile: "2fr 1fr",
        stakingFinalityProvidersDesktop: "2fr 1.5fr 2fr 0.75fr",
      },
    },
  },
  plugins: [],
};
export default config;
